import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpWriteOnceRequirement } from '../requirements/req-tscp-write-once.js';

@Satisfies(ReqTscpWriteOnceRequirement)
export abstract class DriftDetectionFeature extends Feature {
  readonly id = 'TSCP-DRIFT-DETECTION';
  readonly title = '`sourcegen verify` detects hand-edits and regeneration drift via banner contentHash';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract verifyExitsZeroOnCleanState(): ACResult;
  abstract verifyDetectsHandEdit(): ACResult;
  abstract verifyEmitsSG0010ForHandEdit(): ACResult;
  abstract verifyDetectsRegenerationDrift(): ACResult;
  abstract verifyEmitsSG0011ForRegenerationDrift(): ACResult;
  abstract verifyNeverWritesToDisk(): ACResult;
  abstract verifyExitsNonZeroOnMaxIterations(): ACResult;
}
