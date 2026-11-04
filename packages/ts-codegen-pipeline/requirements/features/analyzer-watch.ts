import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerWatchRequirement } from '../requirements/req-tscp-analyzer-watch.js';

/**
 * Watch mode integrates analyzers into the cycle by default;
 * `--no-analyzers` opts out.
 */
@Satisfies(ReqTscpAnalyzerWatchRequirement)
export abstract class AnalyzerWatchFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-WATCH';
  readonly title = 'Watch mode includes analyzers in every cycle by default';
  readonly priority = Priority.Medium;
  readonly enabled = true;

  abstract watchCycleRunsAnalyzers(): ACResult;
  abstract watchDebounceCoalescesBurst(): ACResult;
  abstract noAnalyzersFlagSkipsAnalyzersInWatch(): ACResult;
}
