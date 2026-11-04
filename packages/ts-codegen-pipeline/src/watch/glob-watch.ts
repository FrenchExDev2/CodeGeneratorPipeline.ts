/**
 * Glob support for the `watch` command. Pure functions — fully testable in
 * isolation, like the rest of `src/watch/`.
 *
 * Why this exists: chokidar removed glob support in v4 ("remove glob support
 * and bundled fsevents", Sep 2024). Handing `chokidar.watch()` a pattern like
 * `src/**\/*.ts` no longer expands it — chokidar treats it as a literal path,
 * finds no such directory, and silently watches nothing. The documented
 * replacement is to watch concrete directories and filter events yourself.
 *
 * So the watcher now subscribes to the static base directory of each pattern
 * and screens the emitted paths through {@link matchesAnyGlob}. Filtering has
 * to happen on the *event*, never in chokidar's `ignored` predicate: `ignored`
 * is consulted for directories too, and a directory never matches a pattern
 * like `**\/*.ts`, so using it there would prune the traversal before reaching
 * any file.
 *
 * Supported syntax — the subset the `-w/--watch` flag documents:
 *   - `**` any number of path segments, including zero
 *   - `*`  any run of characters inside a single segment
 *   - `?`  exactly one character inside a single segment
 * Everything else matches literally. Paths and patterns are compared
 * case-sensitively, and both must be posix-normalized first.
 */

/** Characters that make a path segment non-static. */
const MAGIC = /[*?[\]{}]/;

/** Regex metacharacters that must survive as literals. */
const REGEX_SPECIAL = /[.+^${}()|[\]\\]/g;

/**
 * The longest leading run of magic-free segments — the directory chokidar can
 * actually watch. A pattern with no magic at all is its own base, which is
 * valid: chokidar accepts a concrete file path.
 *
 * `/x/pkg/src/**\/*.ts` → `/x/pkg/src`
 */
export function globBaseDir(globPosix: string): string {
  const segments = globPosix.split('/');
  const staticSegments: string[] = [];
  for (const segment of segments) {
    if (MAGIC.test(segment)) break;
    staticSegments.push(segment);
  }
  // A leading '/' yields an empty first segment; keep it as the root.
  return staticSegments.join('/') || '/';
}

/** Translate the supported glob subset into an anchored RegExp. */
export function globToRegExp(globPosix: string): RegExp {
  let source = '';
  for (let i = 0; i < globPosix.length; i++) {
    const char = globPosix[i]!;

    if (char === '*') {
      if (globPosix[i + 1] === '*') {
        if (globPosix[i + 2] === '/') {
          // `**/` spans zero or more whole segments, so `a/**/b` matches `a/b`.
          source += '(?:[^/]*/)*';
          i += 2;
        } else {
          source += '.*';
          i += 1;
        }
      } else {
        source += '[^/]*';
      }
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += char.replace(REGEX_SPECIAL, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/**
 * Does an absolute path match any of the watch patterns? Accepts Windows-style
 * separators, since chokidar emits native paths.
 */
export function matchesAnyGlob(absPath: string, globsPosix: readonly string[]): boolean {
  const norm = absPath.replace(/\\/g, '/');
  return globsPosix.some(glob => globToRegExp(glob).test(norm));
}

/**
 * Concrete directories to hand chokidar: the base dir of every pattern, minus
 * any that already sit inside another. Watching both `src` and `src/nested`
 * would double-report every event under `src/nested`.
 */
export function watchRootsFor(globsPosix: readonly string[]): string[] {
  const bases = [...new Set(globsPosix.map(globBaseDir))].sort();
  const roots: string[] = [];
  for (const base of bases) {
    // Sorted ascending, so any ancestor of `base` is already in `roots`.
    if (roots.some(root => base === root || base.startsWith(root + '/'))) continue;
    roots.push(base);
  }
  return roots;
}
