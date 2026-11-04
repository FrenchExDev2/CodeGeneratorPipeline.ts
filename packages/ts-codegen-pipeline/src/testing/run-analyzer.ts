import type { Project } from 'ts-morph';
import type {
  Analyzer,
  AnalysisContext,
  Diagnostic,
  ReadonlyVirtFs,
  SuppressionChecker,
} from '../types.js';
import { makeSuppressionChecker } from '../analyze/suppression.js';

export interface RunAnalyzerOptions {
  readonly consumerPackageRoot?: string;
  readonly outDir?: string;
  readonly virtFs?: ReadonlyVirtFs;
  readonly logger?: { info(m: string): void; warn(m: string): void };
  readonly isSuppressed?: SuppressionChecker;
}

const NOOP_VIRTFS: ReadonlyVirtFs = {
  has: () => false,
  read: () => { throw new Error('read on empty test virtFs'); },
  listEmitted: () => [],
};
const NOOP_LOGGER = { info: (_: string) => undefined, warn: (_: string) => undefined };

/**
 * Execute a single analyzer against an in-memory `Project`. The analyzer
 * sees the supplied Project unmodified, with sensible defaults for
 * context fields that the test does not care about. For overriding the
 * suppression behaviour pass `opts.isSuppressed`.
 */
export async function runAnalyzer(
  analyzer: Analyzer,
  project: Project,
  opts: RunAnalyzerOptions = {},
): Promise<readonly Diagnostic[]> {
  const ctx: AnalysisContext = {
    project,
    virtFs: opts.virtFs ?? NOOP_VIRTFS,
    consumerPackageRoot: opts.consumerPackageRoot ?? '/',
    outDir: opts.outDir ?? '/generated',
    logger: opts.logger ?? NOOP_LOGGER,
    isSuppressed: opts.isSuppressed ?? makeSuppressionChecker(project),
  };
  return await analyzer.analyze(ctx);
}
