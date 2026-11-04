import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

export abstract class ReqTscpDeterministicOrderingRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-DETERMINISTIC-ORDERING';
  readonly title = 'For identical inputs, the runner shall produce byte-identical disk outputs across runs and machines';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'NonFunctional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'Within a single iteration, generators shall be invoked in lexicographic order of their `id`. Banner content shall not include timestamps, hostnames, or random values. The contentHash shall be a deterministic SHA-256 of the body excluding the hash line itself. As a result, two `runFixpoint` invocations on the same source tree shall produce byte-identical files in outDir.',
  };

  readonly rationale = {
    claim: 'Determinism is the basis of `verify` (drift detection): if outputs depend on time of day or machine identity, no diff-based check is possible. It also keeps git history clean — no spurious diffs from re-runs.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — determinism as test substrate 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Property test: for arbitrary deterministic generators, `runFixpoint` produces byte-identical outputs on two consecutive calls.',
      binds: ['twoConsecutiveRunsProduceIdenticalOutputs'] },
    { kind: 'unit-test' as const,
      describes: 'Generators with different ids `b`, `a`, `c` are invoked in order `a`, `b`, `c` regardless of registration order.',
      binds: ['generatorsInvokedInIdLexicographicOrder'] },
    { kind: 'unit-test' as const, describes: 'Banner, generator, runner and virtual-emission source paths contain no wall-clock Date access; an independent SHA-256 calculation over only the body matches hashes under different producer and iteration headers.', binds: ['emissionHasNoWallClockAndHashesOnlyBody'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: '`verify` becomes unreliable; CI signal noisy; reproducibility across developers compromised.',
  };
}
