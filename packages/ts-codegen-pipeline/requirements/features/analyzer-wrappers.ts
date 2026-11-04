import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerWrappersRequirement } from '../requirements/req-tscp-analyzer-wrappers.js';

/**
 * Pure functional wrappers: withSeverity, withId, only.
 */
@Satisfies(ReqTscpAnalyzerWrappersRequirement)
export abstract class AnalyzerWrappersFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-WRAPPERS';
  readonly title = 'Decorator-pattern wrappers adjust analyzers at composition root';
  readonly priority = Priority.Medium;
  readonly enabled = true;

  abstract withSeverityRemapsAllSeverities(): ACResult;
  abstract withSeverityPreservesIdentityFields(): ACResult;
  abstract withIdOverridesExposedId(): ACResult;
  abstract withIdPropagatesToProducerId(): ACResult;
  abstract onlyKeepsListedCodes(): ACResult;
  abstract onlyFiltersOutOtherCodes(): ACResult;
}
