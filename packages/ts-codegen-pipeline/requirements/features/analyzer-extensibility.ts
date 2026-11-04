import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerExtensibilityRequirement } from '../requirements/req-tscp-analyzer-extensibility.js';

/**
 * Three analyzer provenances (builtin, npm third-party, local) register
 * through the same Analyzer interface; runner doesn't discriminate.
 */
@Satisfies(ReqTscpAnalyzerExtensibilityRequirement)
export abstract class AnalyzerExtensibilityFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-EXTENSIBILITY';
  readonly title = 'Analyzers from any provenance compose uniformly via `analyzers: [...]`';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract builtinsExposedViaSubExport(): ACResult;
  abstract thirdPartyArrayIsConsumable(): ACResult;
  abstract thirdPartyFactoryIsConsumable(): ACResult;
  abstract runnerDoesNotDiscriminateProvenance(): ACResult;
  abstract executionOrderMatchesListOrder(): ACResult;
}
