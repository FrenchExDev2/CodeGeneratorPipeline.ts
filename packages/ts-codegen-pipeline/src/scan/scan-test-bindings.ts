import { scanTestBindings as scanTestBindingsImpl } from './test-bindings-scanner.js';
import type { FoundFeature } from './find-features.js';
import { nodeFs, type FileSystemPort } from '../ports/file-system.js';

export interface ScanExistingBindingsOptions {
  readonly consumerPackageRoot: string;
  /** Test directories relative to consumer root. Default: `['test']`. */
  readonly testDirs?: readonly string[];
  readonly fs?: FileSystemPort;
  /** Feature classes from `findFeatures` — needed to map className↔id. */
  readonly features: readonly FoundFeature[];
}

/**
 * Returns `Map<featureClassName, Set<acName>>` listing every AC that
 * already has a `@Verifies<F>('acName')` binding in any test file under
 * the configured testDirs. Anything NOT in this map for a Feature class
 * is the "missing-set" the TestStubGenerator will scaffold.
 *
 * Wraps `@frenchexdev2/requirements-lib/analysis` `scanTestBindings`,
 * adapting its `BindingsManifest` (keyed by featureId) to a className
 * keying that the generator's class-level scan needs.
 */
export async function scanExistingBindings(
  opts: ScanExistingBindingsOptions,
): Promise<Map<string, Set<string>>> {
  const fs = opts.fs ?? nodeFs;
  const testDirs = opts.testDirs ?? ['test'];
  const classToId = new Map(opts.features.map(f => [f.className, f.id]));
  const idToClassName = new Map(opts.features.map(f => [f.id, f.className]));

  const result = await scanTestBindingsImpl({
    testDirs,
    root: opts.consumerPackageRoot,
    classToId,
    fs,
  });

  const out = new Map<string, Set<string>>();
  for (const [featureId, acMap] of Object.entries(result.manifest)) {
    const className = idToClassName.get(featureId);
    if (!className) continue;
    out.set(className, new Set(Object.keys(acMap)));
  }
  return out;
}
