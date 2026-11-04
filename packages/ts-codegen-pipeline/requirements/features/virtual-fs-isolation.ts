import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpVirtfsIsolationRequirement } from '../requirements/req-tscp-virtfs-isolation.js';
import { ReqTscpDivergenceDiagnosticRequirement } from '../requirements/req-tscp-divergence-diagnostic.js';

/**
 * VirtFs is the only writer between iterations. This Feature covers both
 * the isolation property (no real-disk writes during the loop) and the
 * write-contract semantics (idempotent addSource, cross-producer divergence
 * detection) — both live behind the same VirtFs abstraction.
 */
@Satisfies(
  ReqTscpVirtfsIsolationRequirement,
  ReqTscpDivergenceDiagnosticRequirement,
)
export abstract class VirtualFsIsolationFeature extends Feature {
  readonly id = 'TSCP-VIRTUAL-FS-ISOLATION';
  readonly title = 'VirtFs isolates the disk during iterations and enforces idempotent / divergence-aware addSource';
  readonly priority = Priority.High;
  readonly enabled = true;

  // Isolation
  abstract midIterationThrowLeavesDiskUntouched(): ACResult;
  abstract noWriteUntilCommitPhase(): ACResult;
  abstract projectIsConstructedWithUseInMemoryFileSystem(): ACResult;

  // addSource contract
  abstract addSourceIsIdempotent(): ACResult;
  abstract sameProducerCanUpdateOwnEmission(): ACResult;
  abstract identicalContentsAreNoop(): ACResult;
  abstract twoGeneratorsSamePathDifferentContentsTriggersSG0020(): ACResult;
  abstract divergenceLeavesVirtFsUnchanged(): ACResult;
}
