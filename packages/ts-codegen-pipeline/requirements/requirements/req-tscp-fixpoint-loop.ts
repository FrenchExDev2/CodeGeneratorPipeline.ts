import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Root Requirement of @frenchexdev2/ts-codegen-pipeline.
 * Other REQ-TSCP-* @Refines this one when scoped to fixpoint semantics.
 */
export abstract class ReqTscpFixpointLoopRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-FIXPOINT-LOOP';
  readonly title = 'Source generators run on the in-memory virtFS in a fixpoint loop until no new emissions, then disk is committed once';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'When `runFixpoint` is invoked, the runner shall re-invoke every registered SourceGenerator on the in-memory virtFS until an iteration produces zero new or changed files, then atomically commit the virtFS to disk under the consumer\'s outDir. If any error-severity diagnostic is emitted, the disk shall remain unchanged.',
  };

  readonly rationale = {
    claim: 'Roslyn-style codegen feedback: a generator emitting attribute-decorated code must be visible as input to subsequent generators in the same build. The fixpoint is the only correctness criterion; the disk is touched once or never, so failures in mid-build leave no half-written outDir to clean up.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — sourcegen architecture decision 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Given N idempotent generators forming a chain (stage k emits files consumed by stage k+1), `runFixpoint` terminates within N+1 iterations.',
      binds: ['terminatesWhenNoGeneratorEmitsAnything', 'reportsIterationCountInDiagnostics'] },
    { kind: 'unit-test' as const,
      describes: 'When a generator throws or emits an error-severity diagnostic, no file under outDir is created or modified.',
      binds: ['leavesDiskUntouchedOnError'] },
    { kind: 'unit-test' as const, describes: "Two consecutive fixpoint runs on the same source tree produce byte-identical disk artifacts.", binds: ["twoConsecutiveRunsProduceIdenticalOutputs"] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Generators that depend on other generators\' outputs cannot be composed; a partial-failure leaves a polluted outDir requiring manual cleanup.',
  };
}
