import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

export abstract class ReqTscpDivergenceDiagnosticRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-DIVERGENCE-DIAGNOSTIC';
  readonly title = 'When two generators emit different contents at the same relPath, the virtFS shall emit SG0020 instead of silently overwriting';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When `addSource(file)` is invoked for a `relPath` that already exists in the virtFS with different `contents` and a different `producerId`,',
    response: 'the virtFS shall reject the write, return `newOrChanged: false` and a `Diagnostic` with code `SG0020 EmissionDivergence`. The runner shall promote any error-severity SG0020 to a run-level failure (no commit).',
  };

  readonly rationale = {
    claim: 'Silent overwriting between generators is the worst possible behavior — it produces ordering-dependent results that are nearly impossible to debug. Detecting the conflict explicitly forces the user to resolve it (rename, partition by kind, or merge).',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — divergence as first-class diagnostic 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Two generators emit different contents at the same relPath. SG0020 is reported. Run aborts. Disk untouched.',
      binds: ['twoGeneratorsSamePathDifferentContentsTriggersSG0020'] },
    { kind: 'unit-test' as const,
      describes: 'Two generators emit identical contents at the same relPath (idempotent overlap). No SG0020; second call returns newOrChanged=false silently.',
      binds: ['identicalContentsAreNoop'] },
    { kind: 'unit-test' as const,
      describes: 'Same producer re-emitting the same path with new contents updates the virtFS (newOrChanged=true) without SG0020 — only cross-producer conflicts diverge.',
      binds: ['sameProducerCanUpdateOwnEmission'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Generators silently overwrite each other; output depends on generator iteration order; debugging "why is my generated file wrong?" becomes a nightmare.',
  };
}
