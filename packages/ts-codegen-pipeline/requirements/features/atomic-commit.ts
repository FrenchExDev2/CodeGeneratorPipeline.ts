import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAtomicCommitRequirement } from '../requirements/req-tscp-atomic-commit.js';
import { ReqTscpStrictlyAdditiveEmissionRequirement } from '../requirements/req-tscp-strictly-additive-emission.js';

@Satisfies(
  ReqTscpAtomicCommitRequirement,
  ReqTscpStrictlyAdditiveEmissionRequirement,
)
export abstract class AtomicCommitFeature extends Feature {
  readonly id = 'TSCP-ATOMIC-COMMIT';
  readonly title = 'At fixpoint, commit virtFS to disk atomically per file with stale-output purge';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract commitProducesByteIdenticalOutDir(): ACResult;
  abstract commitWritesViaTmpThenRename(): ACResult;
  abstract commitPurgesObsoleteOutputs(): ACResult;
  abstract failedRenameLeavesNoTmpFiles(): ACResult;
  abstract commitOnlyTouchesOutDir(): ACResult;
  abstract propertyEmittedSetEqualsDiskAfterCommit(): ACResult;
  abstract propertyDiskUntouchedOnRunError(): ACResult;
  abstract defaultNodeFsPortRoundTripsDiskOperations(): ACResult;
}
