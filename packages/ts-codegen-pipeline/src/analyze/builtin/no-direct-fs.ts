import * as path from 'node:path';
import type { Analyzer, AnalysisContext, Diagnostic } from '../../types.js';
import { diagFromNode } from '../diag.js';

const ID = 'analyzer:no-direct-fs';
const CODE = 'AN0120';
const FORBIDDEN_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);
const ENFORCED_DIRS = ['src/generators', 'src/analyze', 'src/scan'];

/**
 * AN0120 — Source files under `src/generators/`, `src/analyze/`,
 * `src/scan/` shall not import `fs` / `node:fs` / `fs/promises`
 * directly. Use `FileSystemPort` instead so virtFS isolation and
 * testability are preserved.
 */
export class NoDirectFsAnalyzer implements Analyzer {
  readonly id = ID;
  readonly description =
    'Pipeline runtime dirs must not import node:fs directly; use FileSystemPort.';
  readonly docsUrl =
    'https://github.com/frenchexdev/ts-codegen-pipeline#an0120';

  analyze(ctx: AnalysisContext): readonly Diagnostic[] {
    const diags: Diagnostic[] = [];
    for (const sf of ctx.project.getSourceFiles()) {
      const rel = path.relative(ctx.consumerPackageRoot, sf.getFilePath()).replace(/\\/g, '/');
      if (!ENFORCED_DIRS.some(d => rel.startsWith(`${d}/`) || rel.startsWith(d))) continue;
      for (const imp of sf.getImportDeclarations()) {
        const target = imp.getModuleSpecifierValue();
        if (!FORBIDDEN_MODULES.has(target)) continue;
        if (ctx.isSuppressed(imp, CODE)) continue;
        diags.push(diagFromNode(
          imp, 'error', CODE,
          `Direct '${target}' import is forbidden in ${rel}; use FileSystemPort.`,
          this.id,
        ));
      }
    }
    return diags;
  }
}
