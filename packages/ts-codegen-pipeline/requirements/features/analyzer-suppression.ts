import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerSuppressionRequirement } from '../requirements/req-tscp-analyzer-suppression.js';

/**
 * Per-node suppression directives: `// @sourcegen-disable-next-line CODE`.
 */
@Satisfies(ReqTscpAnalyzerSuppressionRequirement)
export abstract class AnalyzerSuppressionFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-SUPPRESSION';
  readonly title = 'In-source `@sourcegen-disable-next-line` directives suppress analyzer diagnostics per-node';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract singleCodeNextLineSuppression(): ACResult;
  abstract otherCodesNotAffected(): ACResult;
  abstract multiCodeCommaSeparated(): ACResult;
  abstract whitespaceAroundCodesTolerated(): ACResult;
  abstract emptyCodeSuppressesAll(): ACResult;
  abstract failSafeRunnerFilter(): ACResult;
}
