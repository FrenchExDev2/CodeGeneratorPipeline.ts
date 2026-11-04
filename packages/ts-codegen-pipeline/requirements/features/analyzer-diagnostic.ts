import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerDiagnosticRequirement } from '../requirements/req-tscp-analyzer-diagnostic.js';

/**
 * Diagnostic enriched with start/end positions and relatedLocations;
 * diagFromNode helper auto-populates from a ts-morph node.
 */
@Satisfies(ReqTscpAnalyzerDiagnosticRequirement)
export abstract class AnalyzerDiagnosticFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-DIAGNOSTIC';
  readonly title = 'Diagnostic carries start/end and related locations; diagFromNode populates positions';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract diagnosticShapeCompiles(): ACResult;
  abstract backwardsCompatibleWithPreviousSGShape(): ACResult;
  abstract diagFromNodeStartOfFileIsLine1Col1(): ACResult;
  abstract diagFromNodeMultiLineEndAfterStart(): ACResult;
  abstract diagFromNodeColumnsAreOneBased(): ACResult;
  abstract diagFromNodeNoRelatedIsUndefined(): ACResult;
  abstract diagFromNodeRelatedFillsLocations(): ACResult;
}
