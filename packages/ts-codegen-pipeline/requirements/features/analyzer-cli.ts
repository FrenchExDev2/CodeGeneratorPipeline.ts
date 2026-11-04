import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerCliRequirement } from '../requirements/req-tscp-analyzer-cli.js';

/**
 * CLI: analyze/list/explain subcommands; rich formatter (path:line:col,
 * color, file grouping, perf footer, --json, --no-color).
 */
@Satisfies(ReqTscpAnalyzerCliRequirement)
export abstract class AnalyzerCliFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-CLI';
  readonly title = 'CLI subcommands and rich diagnostic formatter';
  readonly priority = Priority.Medium;
  readonly enabled = true;

  abstract analyzeSubcommandSkipsGenerators(): ACResult;
  abstract onlyFlagRunsSingleAnalyzer(): ACResult;
  abstract onlyFlagUnknownIdErrors(): ACResult;
  abstract listSubcommandPrintsRegisteredAnalyzers(): ACResult;
  abstract explainPrintsDocForKnownCode(): ACResult;
  abstract explainUnknownCodeErrors(): ACResult;
  abstract locationFormatPathLineCol(): ACResult;
  abstract locationPathRelativeToConsumerRoot(): ACResult;
  abstract noColorFlagProducesAsciiPure(): ACResult;
  abstract groupingByFileHeader(): ACResult;
  abstract footerCountsBySeverity(): ACResult;
  abstract footerHasSlowest(): ACResult;
  abstract jsonFlagProducesValidJson(): ACResult;
  abstract dispatchesActualCommandsWithDomainExitCodes(): ACResult; // expects: integration
  abstract actualAnalyzerQueriesResolveAndRejectUnknownTargets(): ACResult; // expects: integration
}
