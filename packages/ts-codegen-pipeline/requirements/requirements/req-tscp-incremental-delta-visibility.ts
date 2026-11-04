import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

export abstract class ReqTscpIncrementalDeltaVisibilityRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-INCREMENTAL-DELTA-VISIBILITY';
  readonly title = 'GenerationContext.delta exposes a consistent view of what previous iterations emitted';
  readonly priority = Priority.Medium;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'At each iteration `n`, `ctx.delta.emittedLastIteration` shall equal exactly the set of successful `addSource` calls performed during iteration `n-1`, in their original emission order. `ctx.delta.emittedSinceStart` shall be the cumulative concatenation across iterations 0..n-1. At iteration 0, both shall be empty.',
  };

  readonly rationale = {
    claim: 'Without an explicit delta, every generator must re-scan the full virtFS each iteration to detect what changed — costly and bug-prone (a generator that re-processes a stable node may oscillate). The delta lets generators react only to genuine new inputs.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — incremental codegen note 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Property test: at any iteration n, delta.emittedLastIteration equals exactly the addSource records of iteration n-1 (order preserved).',
      binds: ['deltaLastIterationMatchesPriorEmissions'] },
    { kind: 'unit-test' as const,
      describes: 'delta.emittedSinceStart at iteration n is the concatenation of emissions across iterations 0..n-1.',
      binds: ['deltaSinceStartIsCumulative'] },
    { kind: 'unit-test' as const,
      describes: 'At iteration 0, both delta arrays are empty.',
      binds: ['deltaEmptyAtIterationZero'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'Low' as const,
    ifNotMet: 'Generators cannot implement incremental processing; performance scales poorly with virtFS size; oscillation bugs are easier to write.',
  };
}
