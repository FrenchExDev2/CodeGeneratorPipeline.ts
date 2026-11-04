/**
 * Decide whether a path emitted by chokidar should be ignored by the
 * watcher. Pure function — fully testable in isolation.
 *
 * Ignored:
 *   - anything under outDir (prevents the runner's own commit from
 *     re-triggering the watcher = infinite loop)
 *   - common noise: node_modules, .git, dist, test-results
 *   - any file whose name contains `.generated.` (covers
 *     `*.generated.ts` and `*.scaffold.generated.test.ts`)
 *
 * `outDirPosix` is the absolute path of the runner's outDir, normalized
 * to forward slashes (`path.replace(/\\/g, '/')`).
 */
export function shouldIgnore(absPath: string, outDirPosix: string): boolean {
  const norm = absPath.replace(/\\/g, '/');
  if (norm === outDirPosix || norm.startsWith(outDirPosix + '/')) return true;
  if (norm.includes('/node_modules/')) return true;
  if (norm.includes('/.git/')) return true;
  if (norm.includes('/dist/')) return true;
  if (norm.includes('/test-results/')) return true;
  if (/(?:^|[^.])\.generated\./.test(norm)) return true;
  return false;
}
