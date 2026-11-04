import { Requirement, Priority, Refines } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';
import { ReqTscpFixpointLoopRequirement } from './req-tscp-fixpoint-loop.js';

@Refines(ReqTscpFixpointLoopRequirement)
export abstract class ReqTscpIterationCapRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ITERATION-CAP';
  readonly title = 'The fixpoint loop must abort with SG0030 if no convergence is reached within MAX_ITERATIONS';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Constraint' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When the fixpoint loop has executed `MAX_ITERATIONS` (default 16) iterations without reaching a fixpoint,',
    response: 'the runner shall emit `SG0030 MaxIterationsReached`, abort, and leave the disk unchanged. No commit shall occur.',
  };

  readonly rationale = {
    claim: 'A non-converging loop typically signals two generators that emit conflicting contents on each pass (oscillation). A hard cap turns an indefinite hang into an actionable diagnostic.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — sourcegen architecture decision 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'A pair of generators that toggle the same file\'s contents each iteration causes the runner to abort with SG0030 after MAX_ITERATIONS, with disk untouched.',
      binds: ['failsWithSG0030WhenMaxIterationsReached', 'leavesDiskUntouchedOnNonConvergence'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'project-rule', date: '2026-05-02' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'A misbehaving generator pair causes infinite loop in CI; user has no actionable diagnostic to fix the divergence.',
  };
}
