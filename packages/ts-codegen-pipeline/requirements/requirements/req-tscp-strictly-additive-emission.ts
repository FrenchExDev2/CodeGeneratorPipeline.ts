import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Root Requirement of the strictly-additive emission family. v1 forbids
 * mutation of any file outside outDir. To extend a user class, generators
 * emit companion files (inheritance / mixin / TS module augmentation),
 * never patch sources in place.
 */
export abstract class ReqTscpStrictlyAdditiveEmissionRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-STRICTLY-ADDITIVE-EMISSION';
  readonly title = 'Generators may only create files under outDir; no source file outside outDir may be modified';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Constraint' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'A SourceGenerator shall only invoke `ctx.virtFs.addSource` to produce content. The virtFS shall reject (with `SG0040 InvalidEmissionPath`) any attempt to address a path that resolves outside `outDir` after normalization. The runner shall provide no API for mutating user-authored sources, dependencies, or another generator\'s output.',
  };

  readonly rationale = {
    claim: 'Source-of-truth boundaries (human-authored vs machine-generated) must remain visible in `git diff`. Mutation of human sources destroys intent without audit, makes fixpoint convergence undecidable (a generator that mutates a file another generator reads can oscillate indefinitely), and turns recovery into chirurgical `git revert`. The Roslyn analogue (partial classes) is reproducible in TS via inheritance, mixins, and TypeScript module augmentation — without mutation.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — strictly-additive decision 2026-05-02', recordedAt: '2026-05-02' },
      { kind: 'precedent' as const, requirement: 'REQ-TSCP-FIXPOINT-LOOP',
        rationale: 'Strict additive emission makes the fixpoint trivially decidable: each iteration only adds files; the loop terminates as soon as no generator returns emittedSomething=true.' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'For any successful or failed run, every file outside outDir on disk is byte-identical pre/post-run.',
      binds: ['userSrcUntouchedAfterRun'] },
    { kind: 'unit-test' as const, describes: 'The pipeline exposes additive emission rather than a codemod mutation API and does not import the Requirements rename codemod; source-editing workflows use the separate codemod interface.', binds: ['codemodMutationIsSeparateFromEmissionApi', 'userSrcUntouchedAfterRun'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Generators step on user code; convergence proofs become impossible; recovery requires git surgery; mental model diverges from Roslyn.',
  };
}
