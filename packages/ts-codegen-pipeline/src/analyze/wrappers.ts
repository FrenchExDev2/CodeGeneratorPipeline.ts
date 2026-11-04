import type { Analyzer, AnalysisContext, Diagnostic, Severity } from '../types.js';

/**
 * Pure decorator-pattern wrappers that adjust an analyzer's output at the
 * composition root, without modifying the analyzer itself. Stateless,
 * testable in isolation, composable.
 */

/** Remap every output diagnostic's severity to `sev`. Identity fields preserved. */
export function withSeverity(a: Analyzer, sev: Severity): Analyzer {
  return {
    id: a.id,
    description: a.description,
    docsUrl: a.docsUrl,
    async analyze(ctx: AnalysisContext): Promise<readonly Diagnostic[]> {
      const diags = await a.analyze(ctx);
      return diags.map(d => ({ ...d, severity: sev }));
    },
  };
}

/** Override the analyzer's exposed `id`; producerId of every diag follows. */
export function withId(a: Analyzer, id: string): Analyzer {
  return {
    id,
    description: a.description,
    docsUrl: a.docsUrl,
    async analyze(ctx: AnalysisContext): Promise<readonly Diagnostic[]> {
      const diags = await a.analyze(ctx);
      return diags.map(d => ({ ...d, producerId: id }));
    },
  };
}

/** Keep only diagnostics whose `code` is in `codes`. */
export function only(a: Analyzer, codes: readonly string[]): Analyzer {
  const set = new Set(codes);
  return {
    id: a.id,
    description: a.description,
    docsUrl: a.docsUrl,
    async analyze(ctx: AnalysisContext): Promise<readonly Diagnostic[]> {
      const diags = await a.analyze(ctx);
      return diags.filter(d => set.has(d.code));
    },
  };
}
