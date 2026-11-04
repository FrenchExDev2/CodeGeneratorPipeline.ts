import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

export abstract class ReqTscpDecoratorByNameRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-DECORATOR-BY-NAME';
  readonly title = '@Generate is discovered by identifier name; multi-stacking and target-kind filtering are first-class';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'The scan helper `findDecorated(project, "Generate")` shall locate every node carrying a decorator whose identifier matches the given name, regardless of import path or alias. It shall return one `DecoratedHit` per stacked decorator (preserving source order), with `target.kind` set to `"class" | "method" | "property" | "accessor"` so generators can filter by AST target. `ParameterDeclaration` is out-of-scope for v1.',
  };

  readonly rationale = {
    claim: 'Discovery by AST shape (e.g. "any class with a method named X") is fragile; discovery by identifier name is the open/closed approach: a new decorator kind = a new value of `args.kind`, not a new generator infrastructure piece. Multi-stacking is non-negotiable — a single class may need to drive multiple generators (companion + validator + serializer).',
    kind: 'evidence-based' as const,
    evidence: [
      { kind: 'precedent' as const, requirement: 'feedback_dsl_open_closed_via_generators',
        rationale: 'Project-wide rule: a DSL is parameterized by an ontology produced by a Source Generator, never bound to a pre-built library. Decorator-by-name is the discovery side of that rule.' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'A class carrying three stacked `@Generate` decorators with kinds `companion`, `validator`, `serializer` returns three DecoratedHit entries with sourceOrder 0, 1, 2.',
      binds: ['stackingReturnsAllHitsInSourceOrder'] },
    { kind: 'unit-test' as const,
      describes: 'A mix of `@Generate` decorators on classes, methods, and properties: filtering by `target.kind === "class"` returns only ClassDeclaration hits — no leakage from method or property targets.',
      binds: ['targetKindFilterHasNoLeakage'] },
    { kind: 'unit-test' as const,
      describes: 'An imported alias `import { Generate as Gen } from ...` followed by `@Gen({...})` is NOT discovered (decorator name is the identifier as written in the source, not the original export name).',
      binds: ['aliasedImportIsNotDiscovered'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Adding a new generator kind requires modifying the scan helper, breaking open/closed; multi-stacking edge cases (same class, multiple kinds) silently swallowed.',
  };
}
