import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Functional wrappers (`withSeverity`, `withId`, `only`) let consumers
 * adjust a third-party or builtin analyzer at composition root without
 * modifying the analyzer itself. Pure decorator pattern (GoF).
 */
export abstract class ReqTscpAnalyzerWrappersRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-WRAPPERS';
  readonly title = 'Decorator-pattern wrappers for severity/id/code-set adjustment';
  readonly priority = Priority.Medium;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'The package shall expose three pure decorator-pattern wrapper functions: `withSeverity(a, sev): Analyzer` shall remap every output diagnostic\'s `severity` to `sev` while preserving `id`, `code`, position, and `producerId`. `withId(a, id): Analyzer` shall override the analyzer\'s exposed `id` and propagate the new id to every output diagnostic\'s `producerId`. `only(a, codes): Analyzer` shall keep only output diagnostics whose `code` is in the supplied set.',
  };

  readonly rationale = {
    claim: 'Composition over inheritance: a consumer wanting to downgrade a third-party rule from error to warning, or filter to a subset of codes, can do so at the config root with no fork. The wrappers are stateless functional decorators — testable in isolation, composable.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — SOLID/DRY 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'withSeverity remaps every output diagnostic\'s severity to the target severity.',
      binds: ['withSeverityRemapsAllSeverities'] },
    { kind: 'unit-test' as const,
      describes: 'withSeverity preserves analyzer id and diagnostic code/positions/producerId.',
      binds: ['withSeverityPreservesIdentityFields'] },
    { kind: 'unit-test' as const,
      describes: 'withId exposes the new id on the wrapped analyzer.',
      binds: ['withIdOverridesExposedId'] },
    { kind: 'unit-test' as const,
      describes: 'withId rewrites every output diagnostic\'s producerId to the new id.',
      binds: ['withIdPropagatesToProducerId'] },
    { kind: 'unit-test' as const,
      describes: 'only(a, [c1, c2]) returns an analyzer whose output keeps only diagnostics with code in {c1, c2}.',
      binds: ['onlyKeepsListedCodes'] },
    { kind: 'unit-test' as const,
      describes: 'only filters out diagnostics whose code is not in the supplied set.',
      binds: ['onlyFiltersOutOtherCodes'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'Low' as const,
    ifNotMet: 'Consumers must fork or wrap third-party analyzers manually; severity overrides become ad-hoc and inconsistent.',
  };
}
