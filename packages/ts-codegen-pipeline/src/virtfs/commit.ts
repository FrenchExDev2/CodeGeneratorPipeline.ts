import * as path from 'node:path';
import { nodeFs, type FileSystemPort } from '../ports/file-system.js';

/**
 * A file is treated as sourcegen-managed if its name contains `.generated.`
 * (not at the start) AND ends in `.ts`. Catches both `<name>.generated.ts`
 * and `<name>.scaffold.generated.test.ts` shapes used by built-in generators.
 */
function isGeneratedFileName(name: string): boolean {
  return name.endsWith('.ts') && /(?:^|[^.])\.generated\./.test(name);
}

/**
 * Scan an outDir on real disk for pre-existing `*.generated.ts` files.
 * Used at run start so `commitTo` can purge stale outputs at fixpoint.
 * Returns absolute paths. Returns [] if outDir does not exist.
 */
export async function scanExistingGeneratedFiles(
  outDir: string,
  fs: FileSystemPort = nodeFs,
): Promise<string[]> {
  if (!(await fs.exists(outDir))) return [];
  const result: string[] = [];
  const stack: string[] = [outDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let names: readonly string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const abs = path.join(dir, name);
      let stat: { isDirectory(): boolean };
      try {
        stat = await fs.stat(abs);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(abs);
      } else if (isGeneratedFileName(name)) {
        result.push(abs);
      }
    }
  }
  return result;
}

/** Minimal shape for any commit input — both GeneratedFile and EmittedRecord match. */
export interface CommitInput {
  readonly relPath: string;
  readonly contents: string;
}

export interface CommitOptions {
  /** Absolute path of the outDir on real disk. */
  readonly outDir: string;
  /** Final virtFS state, one entry per relPath. */
  readonly emissions: Iterable<CommitInput>;
  /**
   * Pre-existing `*.generated.ts` absolute paths from outDir at run start.
   * Any path in this set NOT covered by the new emissions is purged.
   */
  readonly preCommitFiles: readonly string[];
  /** Defaults to nodeFs. Tests inject a stub for deterministic failure paths. */
  readonly fs?: FileSystemPort;
}

export interface CommitResult {
  readonly written: readonly string[];   // absolute paths written
  readonly purged: readonly string[];    // absolute paths deleted
}

/**
 * Atomic per-file commit at fixpoint. For each emission, write a `.tmp`
 * sibling and rename to final. Then purge any pre-existing generated
 * file not covered by the new emission set. Aborts before any rename if
 * tmp writing fails — leaving the disk untouched.
 */
export async function commitTo(opts: CommitOptions): Promise<CommitResult> {
  const fs = opts.fs ?? nodeFs;
  const written: string[] = [];
  const tmpFiles: string[] = [];

  await fs.mkdir(opts.outDir, { recursive: true });

  // Phase 1 — write all .tmp siblings. If any throws, clean up and rethrow.
  try {
    for (const file of opts.emissions) {
      const finalAbs = path.join(opts.outDir, file.relPath);
      const tmpAbs = finalAbs + '.tmp';
      await fs.mkdir(path.dirname(finalAbs), { recursive: true });
      await fs.writeFile(tmpAbs, file.contents);
      tmpFiles.push(tmpAbs);
    }
  } catch (err) {
    for (const tmp of tmpFiles) {
      await fs.unlink!(tmp).catch(() => undefined);
    }
    throw err;
  }

  // Phase 2 — rename each .tmp to its final path. On failure, unlink
  // any tmp that has not yet been renamed so no orphan lingers.
  let renamedCount = 0;
  try {
    for (const tmpAbs of tmpFiles) {
      const finalAbs = tmpAbs.slice(0, -'.tmp'.length);
      await fs.rename(tmpAbs, finalAbs);
      written.push(finalAbs);
      renamedCount++;
    }
  } catch (err) {
    for (let i = renamedCount; i < tmpFiles.length; i++) {
      await fs.unlink!(tmpFiles[i] as string).catch(() => undefined);
    }
    throw err;
  }

  // Phase 3 — purge stale generated files not covered by the new emission set.
  const writtenSet = new Set(written);
  const purged: string[] = [];
  for (const stale of opts.preCommitFiles) {
    if (writtenSet.has(stale)) continue;
    try {
      await fs.unlink!(stale);
      purged.push(stale);
    } catch {
      // already gone — fine
    }
  }

  return { written, purged };
}
