import * as path from 'node:path';
import { withBanner } from '../emit/banner.js';
import type {
  Diagnostic,
  GenerationContext,
  GenerationResult,
  SourceGenerator,
} from '../types.js';

export interface PackageBarrelConfig {
  /** Stable ID, default `'ts-codegen-pipeline.package-barrel'`. */
  readonly id?: string;
  /**
   * Source root to scan (relative to consumer package root). Default `'src'`.
   * Only files DIRECTLY under this root are included by default — recursion
   * is governed by `recursive`.
   */
  readonly srcDir?: string;
  /** Recurse into subdirectories of srcDir. Default false. */
  readonly recursive?: boolean;
  /**
   * RelPath of the emitted barrel (relative to outDir).
   * Default `'index.generated.ts'`.
   */
  readonly outRelPath?: string;
  /**
   * Explicit list of base file names (no extension) to EXCLUDE from the
   * barrel — typically modules that need selective re-exports in the
   * hand-written index.ts. Compared against the file name without `.ts`.
   */
  readonly exclude?: readonly string[];
}

/**
 * Reusable generator that scans a consumer package's `src/` and emits a
 * mechanical re-export barrel `<outDir>/<outRelPath>` with one
 * `export * from './<rel>.js';` line per TS file (alphabetical).
 *
 * Convention:
 *   - skip `index.ts`, `*.test.ts`, `*.d.ts`, files starting with `_`,
 *     and any file whose stem is in `exclude`.
 *   - the generator does NOT replace the consumer's `index.ts`. The
 *     consumer keeps a hand-written `index.ts` that may add external
 *     re-exports / selective exports, and ends with
 *     `export * from './index.generated.js';`
 */
export class PackageBarrelGenerator implements SourceGenerator {
  readonly id: string;
  readonly cfg: PackageBarrelConfig;

  constructor(cfg: PackageBarrelConfig = {}) {
    this.id = cfg.id ?? 'ts-codegen-pipeline.package-barrel';
    this.cfg = cfg;
  }

  async execute(ctx: GenerationContext): Promise<GenerationResult> {
    const diagnostics: Diagnostic[] = [];
    const exclude = new Set(this.cfg.exclude ?? []);
    const srcDirInput = this.cfg.srcDir ?? 'src';
    const srcDirAbs = path.isAbsolute(srcDirInput)
      ? srcDirInput
      : path.resolve(ctx.consumerPackageRoot, srcDirInput);
    const srcDirPosix = srcDirAbs.replace(/\\/g, '/');
    const srcDirPrefix = srcDirPosix.endsWith('/') ? srcDirPosix : srcDirPosix + '/';

    const moduleStems: string[] = [];
    for (const sf of ctx.project.getSourceFiles()) {
      const fp = sf.getFilePath().replace(/\\/g, '/');
      if (!fp.startsWith(srcDirPrefix)) continue;
      const rel = fp.slice(srcDirPrefix.length);
      // Recursion control: if non-recursive, skip files in subdirectories.
      if (!this.cfg.recursive && rel.includes('/')) continue;
      const base = path.basename(rel);
      if (base === 'index.ts') continue;
      if (base.endsWith('.test.ts')) continue;
      if (base.endsWith('.d.ts')) continue;
      if (base.endsWith('.generated.ts')) continue;
      if (base.startsWith('_')) continue;
      const stem = rel.replace(/\.ts$/, '');
      if (exclude.has(stem)) continue;
      // Skip files in private subdirs (`_foo/`, e.g.)
      if (stem.split('/').some(seg => seg.startsWith('_'))) continue;
      moduleStems.push(stem);
    }

    if (moduleStems.length === 0) {
      return { emittedSomething: false, diagnostics };
    }

    moduleStems.sort();
    const body = moduleStems
      .map(s => `export * from './${s}.js';`)
      .join('\n') + '\n';

    const relPath = this.cfg.outRelPath ?? 'index.generated.ts';
    const r = ctx.virtFs.addSource({
      relPath,
      contents: withBanner(body, { producerId: this.id, iteration: ctx.iteration }, ctx.virtFs.has(relPath) ? ctx.virtFs.read(relPath) : undefined),
      producerId: this.id,
    });
    if (r.diagnostics) diagnostics.push(...r.diagnostics);
    return { emittedSomething: r.newOrChanged, diagnostics };
  }
}
