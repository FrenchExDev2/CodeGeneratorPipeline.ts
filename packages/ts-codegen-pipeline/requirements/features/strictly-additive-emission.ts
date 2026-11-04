import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpStrictlyAdditiveEmissionRequirement } from '../requirements/req-tscp-strictly-additive-emission.js';
import { ReqTscpEmissionPathValidationRequirement } from '../requirements/req-tscp-emission-path-validation.js';

@Satisfies(
  ReqTscpStrictlyAdditiveEmissionRequirement,
  ReqTscpEmissionPathValidationRequirement,
)
export abstract class StrictlyAdditiveEmissionFeature extends Feature {
  readonly id = 'TSCP-STRICTLY-ADDITIVE-EMISSION';
  readonly title = 'Generators may only write inside outDir; addSource rejects path traversal with SG0040';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract userSrcUntouchedAfterRun(): ACResult;
  abstract userSrcUntouchedAfterRunError(): ACResult;
  abstract rejectsRelativeParentEscape(): ACResult;
  abstract rejectsAbsolutePath(): ACResult;
  abstract rejectsWindowsAbsolutePath(): ACResult;
  abstract rejectsNormalizedTraversal(): ACResult;
  abstract rejectionLeavesVirtFsUnchanged(): ACResult;
  abstract propertyRejectsPathTraversal(): ACResult;
  abstract propertyDiskOutsideOutDirByteIdentical(): ACResult;
}
