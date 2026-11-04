import type { Project } from 'ts-morph';
import type {
  Analyzer,
  AnalysisContext,
  Diagnostic,
  ReadonlyVirtFs,
} from '../types.js';
import { makeSuppressionChecker, parseDirectives } from './suppression.js';

const DEFAULT_SLOW_THRESHOLD_MS = 1000;
/** Code emitted when an analyzer exceeds the configured slow threshold. */
export const SLOW_ANALYZER_CODE = 'AN9001';

export interface RunAnalyzersOptions {
  readonly project: Project;
  readonly virtFs: ReadonlyVirtFs;
  readonly consumerPackageRoot: string;
  readonly outDir: string;
  readonly logger: { info(m: string): void; warn(m: string): void };
  readonly slowThresholdMs?: number;
}

export interface RunAnalyzersResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly timings: ReadonlyMap<string, number>;
}

/**
 * Execute every analyzer once on the converged Project / virtFS.
 *
 * Contract:
 * - Errors do NOT short-circuit: every analyzer runs even if a prior one
 *   errored. Diagnostics are aggregated exhaustively.
 * - A wrapping try/catch turns thrown analyzers into a single error
 *   diagnostic with code `AN9000`.
 * - Per-analyzer execution time is collected. An analyzer exceeding
 *   `slowThresholdMs` (default 1000) emits a warning `AN9001`.
 * - A fail-safe filter removes any aggregated diagnostic that lands on a
 *   line annotated with `@sourcegen-disable-next-line` for that code,
 *   even if the analyzer didn't call `ctx.isSuppressed`.
 */
export async function runAnalyzers(
  analyzers: readonly Analyzer[],
  opts: RunAnalyzersOptions,
): Promise<RunAnalyzersResult> {
  const isSuppressed = makeSuppressionChecker(opts.project);
  const ctx: AnalysisContext = {
    project: opts.project,
    virtFs: opts.virtFs,
    consumerPackageRoot: opts.consumerPackageRoot,
    outDir: opts.outDir,
    logger: opts.logger,
    isSuppressed,
  };
  const threshold = opts.slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS;
  const diagnostics: Diagnostic[] = [];
  const timings = new Map<string, number>();
  for (const a of analyzers) {
    const t0 = performance.now();
    try {
      const out = await a.analyze(ctx);
      diagnostics.push(...out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push({
        severity: 'error',
        code: 'AN9000',
        message: `AnalyzerThrew: ${a.id}: ${msg}`,
        producerId: a.id,
      });
    }
    const dt = performance.now() - t0;
    timings.set(a.id, dt);
    if (dt > threshold) {
      diagnostics.push({
        severity: 'warning',
        code: SLOW_ANALYZER_CODE,
        message: `SlowAnalyzer: ${a.id} took ${Math.round(dt)}ms (> ${threshold}ms threshold)`,
        producerId: a.id,
      });
    }
  }
  const filtered = applyFailSafeSuppressionFilter(diagnostics, opts.project);
  return { diagnostics: filtered, timings };
}

/**
 * Final filter pass: removes diagnostics whose `start.line + file` falls
 * on a node annotated with `@sourcegen-disable-next-line CODE` (or the
 * wildcard form). Independent of whether the analyzer called
 * `ctx.isSuppressed` — a fail-safe so a naive third-party analyzer is
 * still tolerable.
 */
function applyFailSafeSuppressionFilter(
  diagnostics: readonly Diagnostic[],
  project: Project,
): readonly Diagnostic[] {
  const byFile = new Map<string, ReturnType<typeof parseDirectives>>();
  for (const sf of project.getSourceFiles()) {
    const path = sf.getFilePath();
    const entries = parseDirectives(path, sf.getFullText());
    if (entries.length > 0) byFile.set(path, entries);
  }
  return diagnostics.filter(d => !isDiagnosticSuppressed(d, byFile));
}

function isDiagnosticSuppressed(
  d: Diagnostic,
  byFile: Map<string, ReturnType<typeof parseDirectives>>,
): boolean {
  if (!d.file || !d.start) return false;
  const entries = byFile.get(d.file);
  if (!entries) return false;
  for (const e of entries) {
    if (e.nextLine !== d.start.line) continue;
    if (e.codes.length === 0) return true;
    if (e.codes.includes(d.code)) return true;
  }
  return false;
}
