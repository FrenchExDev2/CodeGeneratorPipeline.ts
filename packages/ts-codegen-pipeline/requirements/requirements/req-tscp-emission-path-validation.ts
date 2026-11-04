import { Requirement, Priority, Refines } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';
import { ReqTscpStrictlyAdditiveEmissionRequirement } from './req-tscp-strictly-additive-emission.js';

@Refines(ReqTscpStrictlyAdditiveEmissionRequirement)
export abstract class ReqTscpEmissionPathValidationRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-EMISSION-PATH-VALIDATION';
  readonly title = 'addSource shall reject paths that escape outDir (SG0040)';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Constraint' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When `addSource` is invoked with a `relPath` that, after normalization, starts with `..`, is absolute, or otherwise resolves outside outDir,',
    response: 'the virtFS shall reject the call with `SG0040 InvalidEmissionPath`, leaving the virtFS state unchanged.',
  };

  readonly rationale = {
    claim: 'A typed contract is necessary but not sufficient — a buggy generator could compose a relPath at runtime that escapes outDir. The runtime check guarantees the additive property even in the face of generator bugs.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'precedent' as const, requirement: 'REQ-TSCP-STRICTLY-ADDITIVE-EMISSION',
        rationale: 'Path validation is the runtime enforcement of the additive contract.' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Property test: any relPath starting with `..`, absolute, or containing `..` after normalization triggers SG0040 and leaves the virtFS unchanged.',
      binds: ['propertyRejectsPathTraversal'] },
    { kind: 'unit-test' as const,
      describes: 'Concrete cases: `../etc/passwd`, `/abs/path`, `foo/../../bar`, `C:\\\\Windows`, all rejected.',
      binds: ['rejectsRelativeParentEscape', 'rejectsAbsolutePath', 'rejectsNormalizedTraversal', 'rejectsWindowsAbsolutePath', 'rejectionLeavesVirtFsUnchanged'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'project-rule', date: '2026-05-02' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'A buggy generator can write outside outDir, defeating the strictly-additive guarantee; security and correctness are both compromised.',
  };
}
