import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerBuiltinsRequirement } from '../requirements/req-tscp-analyzer-builtins.js';

/**
 * Four builtin analyzers (AN0100/AN0101/AN0110/AN0120) auto-analyse
 * `ts-codegen-pipeline` itself.
 */
@Satisfies(ReqTscpAnalyzerBuiltinsRequirement)
export abstract class AnalyzerBuiltinsFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-BUILTINS';
  readonly title = 'Four built-in analyzers dog-fooded on the package itself';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract an0100EmptyIdError(): ACResult;
  abstract an0100LiteralIdOk(): ACResult;
  abstract an0100RuntimeIdWarning(): ACResult;
  abstract an0101DuplicateIdsRelated(): ACResult;
  abstract an0110EmptyCodeError(): ACResult;
  abstract an0110DynamicCodeIgnored(): ACResult;
  abstract an0120NodeFsImportDetected(): ACResult;
  abstract an0120FileSystemPortAllowed(): ACResult;
}
