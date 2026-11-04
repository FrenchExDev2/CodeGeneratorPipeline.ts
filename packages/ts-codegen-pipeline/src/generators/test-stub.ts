import * as path from 'node:path';
import { withBanner } from '../emit/banner.js';
import { findFeatures, type FoundFeature } from '../scan/find-features.js';
import { extractFitCriteria } from '../scan/extract-fit-criteria.js';
import { scanExistingBindings } from '../scan/scan-test-bindings.js';
import {
  fastCheckTemplate,
  isPropertyAcName,
  throwTemplate,
} from './templates/test-stub-templates.js';
import { nodeFs, type FileSystemPort } from '../ports/file-system.js';
import type {
  Diagnostic,
  GenerationContext,
  GenerationResult,
  SourceGenerator,
} from '../types.js';

export interface TestStubConfig {
  /** Stable id, default `'ts-codegen-pipeline.test-stub'`. */
  readonly id?: string;
  /** Test directories scanned for existing bindings, relative to consumer root. Default: `['test']`. */
  readonly testDirs?: readonly string[];
  /**
   * Subdirectory under `outDir` where scaffold files are emitted.
   * Default: `''` (scaffolds land directly under outDir, typically `test/scaffolds/`).
   */
  readonly scaffoldSubdir?: string;
  /** Module name imported as `* as fc` for Tier 2. Default: `'fast-check'`. */
  readonly fastCheckImport?: string;
  /**
   * Directories containing Feature classes (relative to consumer root).
   * The runner's `ctx.project` is built from `tsconfig.include` (typically
   * just `src/`). Feature classes typically live in `requirements/features/`
   * and Requirement classes in `requirements/requirements/` — outside the
   * tsconfig. Files matching this glob are loaded into a SEPARATE
   * ts-morph project at execute time so scanning works regardless of
   * the consumer's tsconfig. Default: `['requirements/features', 'requirements/requirements']`.
   */
  readonly specDirs?: readonly string[];
  /** Defaults to nodeFs. Tests inject a stub. */
  readonly fs?: FileSystemPort;
}

const DEFAULT_ID = 'ts-codegen-pipeline.test-stub';
const SCAFFOLD_SUFFIX = '.scaffold.generated.test.ts';

/**
 * Auto-bootstrap niveau 1 (additive scaffold + Tier 1 + Tier 2).
 *
 * Scans Feature classes in the consumer's `ctx.project`, walks their
 * `@Satisfies(Reqs)` to collect Requirement.fitCriteria.describes,
 * scans existing test bindings via `@frenchexdev2/requirements-lib`,
 * and emits one `<feature-kebab>.scaffold.generated.test.ts` per
 * Feature whose AC set is not fully bound. ACs already bound are
 * absent from the scaffold (additive). Once every AC has a test, the
 * scaffold file is purged at commit.
 */
export class TestStubGenerator implements SourceGenerator {
  readonly id: string;
  readonly cfg: TestStubConfig;

  constructor(cfg: TestStubConfig = {}) {
    this.id = cfg.id ?? DEFAULT_ID;
    this.cfg = cfg;
  }

  async execute(ctx: GenerationContext): Promise<GenerationResult> {
    const fs = this.cfg.fs ?? nodeFs;
    const specDirs = this.cfg.specDirs ?? ['requirements/features', 'requirements/requirements'];
    await loadSpecFiles(ctx, specDirs, fs);

    const features = findFeatures(ctx.project);
    if (features.length === 0) {
      return { emittedSomething: false, diagnostics: [] };
    }

    // Build the AC → JSDoc lines map by walking @Satisfies → Requirement.fitCriteria.
    const reqByName = new Map<string, ReturnType<typeof extractFitCriteria>>();
    for (const sf of ctx.project.getSourceFiles()) {
      for (const cls of sf.getClasses()) {
        const name = cls.getName();
        if (!name) continue;
        // Cheap heuristic: only parse classes whose name might be a Requirement
        // (referenced by some Feature's satisfiesRefs). Avoids parsing every
        // class in the project.
        if (!features.some(f => f.satisfiesRefs.includes(name))) continue;
        reqByName.set(name, extractFitCriteria(cls));
      }
    }

    const bindings = await scanExistingBindings({
      consumerPackageRoot: ctx.consumerPackageRoot,
      testDirs: this.cfg.testDirs ?? ['test'],
      features,
    });

    const sortedFeatures = [...features].sort((a, b) => a.className.localeCompare(b.className));
    const diagnostics: Diagnostic[] = [];
    let emittedSomething = false;

    for (const feature of sortedFeatures) {
      const bound = bindings.get(feature.className) ?? new Set<string>();
      const missing = feature.acNames.filter(ac => !bound.has(ac));
      if (missing.length === 0) continue;

      const acJsdoc = buildJsdocMap(feature, reqByName);
      const usesFastCheck = missing.some(isPropertyAcName);
      const scaffoldRelPath = computeRelPath(
        feature.className,
        this.cfg.scaffoldSubdir ?? '',
      );
      const featureImport = computeFeatureImportPath(
        ctx.outDir,
        scaffoldRelPath,
        feature.sourceFile.getFilePath(),
      );

      const body = renderScaffold({
        feature,
        missing: [...missing].sort(),
        acJsdoc,
        usesFastCheck,
        featureImport,
        fastCheckImport: this.cfg.fastCheckImport ?? 'fast-check',
      });

      const r = ctx.virtFs.addSource({
        relPath: scaffoldRelPath,
        contents: withBanner(body, { producerId: this.id, iteration: ctx.iteration }, ctx.virtFs.has(scaffoldRelPath) ? ctx.virtFs.read(scaffoldRelPath) : undefined),
        producerId: this.id,
      });
      if (r.diagnostics) diagnostics.push(...r.diagnostics);
      if (r.newOrChanged) emittedSomething = true;
    }

    return { emittedSomething, diagnostics };
  }
}

function buildJsdocMap(
  feature: FoundFeature,
  reqByName: Map<string, ReturnType<typeof extractFitCriteria>>,
): Map<string, string[]> {
  const acJsdoc = new Map<string, string[]>();
  for (const reqName of feature.satisfiesRefs) {
    const criteria = reqByName.get(reqName);
    if (!criteria) continue;
    for (const c of criteria) {
      if (!c.describes) continue;
      const reqId = reqName.replace(/Requirement$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toUpperCase();
      const sentence = `From REQ-${reqId} (${c.kind}): ${c.describes}`;
      for (const ac of c.binds) {
        const list = acJsdoc.get(ac) ?? [];
        list.push(sentence);
        acJsdoc.set(ac, list);
      }
    }
  }
  return acJsdoc;
}

function renderScaffold(opts: {
  feature: FoundFeature;
  missing: readonly string[];
  acJsdoc: Map<string, string[]>;
  usesFastCheck: boolean;
  featureImport: string;
  fastCheckImport: string;
}): string {
  const { feature, missing, acJsdoc, usesFastCheck, featureImport, fastCheckImport } = opts;
  const scaffoldClass = feature.className.replace(/Feature$/, '') + 'Scaffold';

  const stubs = missing.map(ac => {
    const jsdocLines = acJsdoc.get(ac) ?? [];
    const input = { acName: ac, featureClassName: feature.className, jsdocLines };
    return isPropertyAcName(ac) ? fastCheckTemplate(input) : throwTemplate(input);
  });

  const importLines: string[] = [
    `import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';`,
  ];
  if (usesFastCheck) {
    importLines.push(`import * as fc from '${fastCheckImport}';`);
  }
  importLines.push(`import { ${feature.className} } from '${featureImport}';`);

  return [
    importLines.join('\n'),
    '',
    `@FeatureTest(${feature.className})`,
    `class ${scaffoldClass} {`,
    stubs.join('\n\n'),
    `}`,
    '',
    `export { ${scaffoldClass} };`,
    '',
  ].join('\n');
}

function pascalToKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-feature$/, '');
}

function computeRelPath(featureClassName: string, scaffoldSubdir: string): string {
  const kebab = pascalToKebab(featureClassName);
  const subdir = scaffoldSubdir ? scaffoldSubdir.replace(/^\/+|\/+$/g, '') + '/' : '';
  return `${subdir}${kebab}${SCAFFOLD_SUFFIX}`;
}

function computeFeatureImportPath(
  outDir: string,
  scaffoldRelPath: string,
  featureAbsPath: string,
): string {
  const outDirPosix = outDir.replace(/\\/g, '/');
  const scaffoldAbs = path.posix.join(outDirPosix, scaffoldRelPath);
  const scaffoldDir = path.posix.dirname(scaffoldAbs);
  const featurePosix = featureAbsPath.replace(/\\/g, '/').replace(/\.ts$/, '.js');
  let rel = path.posix.relative(scaffoldDir, featurePosix);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

/**
 * Load `*.ts` files from each `specDir` (relative to consumer root) into
 * `ctx.project`. The runner's project is built from `tsconfig.include`
 * which typically only covers `src/`; Feature/Requirement classes living
 * under `requirements/` need to be added manually so `findFeatures` can
 * see them. Files already present in the project are left untouched.
 */
async function loadSpecFiles(
  ctx: GenerationContext,
  specDirs: readonly string[],
  fs: FileSystemPort,
): Promise<void> {
  for (const dir of specDirs) {
    const absDir = path.resolve(ctx.consumerPackageRoot, dir);
    await loadSpecDirRecursive(ctx, absDir, fs);
  }
}

async function loadSpecDirRecursive(
  ctx: GenerationContext,
  absDir: string,
  fs: FileSystemPort,
): Promise<void> {
  if (!(await fs.exists(absDir))) return;
  let entries: readonly string[];
  try {
    entries = await fs.readdir(absDir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = path.join(absDir, name);
    let stat: { isDirectory(): boolean };
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      await loadSpecDirRecursive(ctx, full, fs);
      continue;
    }
    if (!name.endsWith('.ts')) continue;
    if (name.endsWith('.test.ts')) continue;
    if (name.endsWith('.generated.ts')) continue;
    // Skip if already in the project (already seeded by createVirtFs).
    if (ctx.project.getSourceFile(full)) continue;
    const text = await fs.readFile(full, 'utf8');
    ctx.project.createSourceFile(full, text, { overwrite: true });
  }
}
