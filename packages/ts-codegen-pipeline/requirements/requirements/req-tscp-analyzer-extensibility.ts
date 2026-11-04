import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Three analyzer provenances — builtin, npm third-party, local —
 * register through the same interface. The runner does not distinguish
 * the source. Builtins live behind a `./analyzers` sub-export; the
 * runtime `index.ts` does NOT export them.
 */
export abstract class ReqTscpAnalyzerExtensibilityRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-EXTENSIBILITY';
  readonly title = 'Analyzers from any provenance register identically; OCP-strict';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Constraint' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'The package shall expose `builtinAnalyzers: readonly Analyzer[]` via the sub-export `./analyzers` declared in package.json `exports`. The runtime `index.ts` shall NOT re-export the builtins. A consumer composing `analyzers: [...builtinAnalyzers, ...orgRules, new LocalAnalyzer()]` shall obtain identical runner behavior regardless of analyzer provenance, with execution order matching list order. No file inside `ts-codegen-pipeline` shall change to absorb a new third-party or local analyzer.',
  };

  readonly rationale = {
    claim: 'Open/Closed strict: the runner depends on the `Analyzer` abstraction, never on a concrete class. The `./analyzers` sub-export segregates builtins so they can be opted into explicitly (DRY composition), and tree-shaken if unused. Identical handling across provenances enforces LSP and prevents accidental discrimination by source.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — SOLID/DRY stance 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Importing `@frenchexdev2/ts-codegen-pipeline/analyzers` resolves and exports `builtinAnalyzers: readonly Analyzer[]`.',
      binds: ['builtinsExposedViaSubExport'] },
    { kind: 'unit-test' as const, describes: 'The package declares ./analyzers and ./testing exports; importing the analyzers sub-export resolves; the root API exposes neither builtinAnalyzers nor builtin analyzer classes.', binds: ['builtinsExposedViaSubExport', 'separatesBuiltinAnalyzerExportsAndPreservesConfigIdentity'] },
    { kind: 'unit-test' as const,
      describes: 'A test fixture simulating a third-party package (an `Analyzer[]` exported from a sibling test module) is consumed by the runner with no special-casing.',
      binds: ['thirdPartyArrayIsConsumable'] },
    { kind: 'unit-test' as const,
      describes: 'A factory function `(opts) => Analyzer[]` from a fixture third-party module is consumable via spread.',
      binds: ['thirdPartyFactoryIsConsumable'] },
    { kind: 'unit-test' as const,
      describes: 'The runner does not branch on analyzer provenance — all `Analyzer` instances run through the same code path.',
      binds: ['runnerDoesNotDiscriminateProvenance'] },
    { kind: 'unit-test' as const,
      describes: 'Execution order of analyzers matches the order of the `analyzers: [...]` list (no auto-sort like generators).',
      binds: ['executionOrderMatchesListOrder'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Adding a new analyzer requires editing pipeline internals; npm-tier ecosystem cannot exist; or runner accidentally treats provenances differently and breaks LSP guarantees.',
  };
}
