import { Requirement, Priority, Refines } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';
import { ReqTscpVirtfsIsolationRequirement } from './req-tscp-virtfs-isolation.js';

@Refines(ReqTscpVirtfsIsolationRequirement)
export abstract class ReqTscpAtomicCommitRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ATOMIC-COMMIT';
  readonly title = 'The disk commit at fixpoint shall be atomic per file (write-tmp + rename) and shall purge stale outputs';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When the fixpoint is reached without errors,',
    response: 'the runner shall write each emitted file as `<outDir>/<relPath>.tmp` and then rename to `<outDir>/<relPath>`. Pre-existing `*.generated.ts` files in outDir that are not part of the current emission set shall be deleted. No other files outside outDir shall be touched.',
  };

  readonly rationale = {
    claim: 'Per-file atomicity ensures readers never see half-written content. Purging stale outputs ensures that deleting a decorated source removes its generated companion automatically — no manual cleanup, no drift between source intent and generated artifacts.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'precedent' as const, requirement: 'REQ-TSCP-VIRTFS-ISOLATION',
        rationale: 'Atomic commit is the consummation of virtFS isolation: the only moment disk state changes is the final per-file rename.' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'After a successful run, the contents of outDir match exactly the virtFS final state (byte-identical, no extra files).',
      binds: ['commitProducesByteIdenticalOutDir'] },
    { kind: 'unit-test' as const,
      describes: 'Given a pre-existing `Foo.companion.generated.ts` in outDir whose source class is removed, after a successful run the file is gone.',
      binds: ['commitPurgesObsoleteOutputs'] },
    { kind: 'unit-test' as const,
      describes: 'A simulated rename failure leaves outDir consistent (no half-written `.tmp` files visible to consumers in steady state).',
      binds: ['failedRenameLeavesNoTmpFiles'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Concurrent readers see half-written files; deleted source files leave orphan generated files; outDir drifts away from virtFS state.',
  };
}
