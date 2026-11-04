import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * In-source suppression directives on a per-node basis, mirroring
 * ESLint's `eslint-disable-next-line`. Without this, any analyzer with
 * a single legitimate exception becomes "the boy who cried wolf".
 */
export abstract class ReqTscpAnalyzerSuppressionRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-SUPPRESSION';
  readonly title = 'Per-node suppression via `@sourcegen-disable-next-line` comments';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When an AST node carries a leading `// @sourcegen-disable-next-line CODE1[,CODE2…]` comment (or its block-comment form),',
    response: 'analyzer diagnostics matching any listed CODE on that node shall be suppressed. Whitespace around codes is tolerated. A directive without any code listed shall suppress all `AN*` and `SG*` diagnostics on that node. The runner shall provide an `isSuppressed(node, code)` helper via `AnalysisContext`. As a fail-safe, the runner shall apply a final filter on aggregated diagnostics (matching `file` + `start.line`) for any analyzer that omits the explicit `isSuppressed` check.',
  };

  readonly rationale = {
    claim: 'Suppression directives are necessary at scale; without them an analyzer with one legitimate exception becomes a dev-experience tax. The fail-safe runner-level filter prevents an unaware analyzer from forcing a workaround. Convention favors explicit per-node check (more efficient, more precise) but tolerates omission.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — DX baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'A `// @sourcegen-disable-next-line AN0001` comment above a node suppresses AN0001 on that node.',
      binds: ['singleCodeNextLineSuppression'] },
    { kind: 'unit-test' as const,
      describes: 'The same directive does NOT suppress a different code (e.g. AN0002).',
      binds: ['otherCodesNotAffected'] },
    { kind: 'unit-test' as const,
      describes: 'Multi-code form `AN0001,AN0002` (no/with whitespace) suppresses both.',
      binds: ['multiCodeCommaSeparated'] },
    { kind: 'unit-test' as const,
      describes: 'Whitespace around codes is tolerated (`AN0001 , AN0002`).',
      binds: ['whitespaceAroundCodesTolerated'] },
    { kind: 'unit-test' as const,
      describes: 'A directive with no code listed suppresses any AN*/SG* diagnostic on that node.',
      binds: ['emptyCodeSuppressesAll'] },
    { kind: 'unit-test' as const,
      describes: 'The runner-level fail-safe filter suppresses a diagnostic on a node carrying the directive even if the analyzer never called isSuppressed.',
      binds: ['failSafeRunnerFilter'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Analyzers cannot be tolerated by humans at scale; users disable analyzers entirely or fork the rule, undermining adoption.',
  };
}
