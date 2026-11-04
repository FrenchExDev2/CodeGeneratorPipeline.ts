import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerLifecycleRequirement } from '../requirements/req-tscp-analyzer-lifecycle.js';

/**
 * Analyzer concept and lifecycle: distinct from SourceGenerator,
 * post-fixpoint pre-commit, errors abort commit, sync-or-async.
 */
@Satisfies(ReqTscpAnalyzerLifecycleRequirement)
export abstract class AnalyzerLifecycleFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-LIFECYCLE';
  readonly title = 'Analyzer is read-only and runs post-fixpoint pre-commit; errors abort commit';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract analyzerContextIsReadOnly(): ACResult;
  abstract analyzersRunPostFixpointPreCommit(): ACResult;
  abstract errorAbortsCommit(): ACResult;
  abstract errorDoesNotShortCircuitOtherAnalyzers(): ACResult;
  abstract supportsSyncReturn(): ACResult;
  abstract supportsAsyncReturn(): ACResult;
}
