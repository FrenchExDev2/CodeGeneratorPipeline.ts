import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerPerfRequirement } from '../requirements/req-tscp-analyzer-perf.js';

/**
 * Per-analyzer perf timings: collect, surface in CLI footer, threshold
 * warning emit.
 */
@Satisfies(ReqTscpAnalyzerPerfRequirement)
export abstract class AnalyzerPerfFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-PERF';
  readonly title = 'Per-analyzer execution timings observable; threshold warning';
  readonly priority = Priority.Low;
  readonly enabled = true;

  abstract timingsMapHasEveryAnalyzerId(): ACResult;
  abstract timingsAreNonNegative(): ACResult;
  abstract cliFooterIncludesSlowest(): ACResult;
  abstract thresholdExceededYieldsWarning(): ACResult;
  abstract thresholdOverridable(): ACResult;
}
