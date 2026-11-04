import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Four built-in analyzers that auto-analyse `ts-codegen-pipeline` itself
 * (dog-fooding): non-empty generator id (AN0100), id uniqueness (AN0101),
 * non-empty diagnostic code (AN0110), no direct fs imports in core dirs
 * (AN0120).
 */
export abstract class ReqTscpAnalyzerBuiltinsRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-BUILTINS';
  readonly title = 'Four built-in analyzers (AN0100/AN0101/AN0110/AN0120) auto-analyse the package';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'The package shall ship four built-in analyzers exposed via the `./analyzers` sub-export. AN0100 GeneratorIdNonEmpty: every class implementing `SourceGenerator` shall have a non-empty literal `id` property; an empty literal yields severity `error`; a runtime-resolved id (variable, expression) yields severity `warning`. AN0101 GeneratorIdUnique: two generator classes sharing the same literal `id` yield a single diagnostic with `relatedLocations` pointing to both. AN0110 DiagnosticHasCode: every literal Diagnostic object returned from a generator/analyzer shall have a non-empty `code` property; empty literal yields error; a dynamic value (variable) is ignored as best-effort static analysis. AN0120 NoDirectFsInRuntime: source files under `src/generators/`, `src/analyze/`, `src/scan/` shall not import `fs` or `node:fs` directly; importing the `FileSystemPort` is allowed.',
  };

  readonly rationale = {
    claim: 'Dog-fooding the analyzer subsystem on its own host package is the strongest possible validation of both the API and the execution model. The four chosen rules each enforce an existing convention in the codebase that has been violated historically and is easy to violate again.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — auto-analyse decision 2026-05-06', recordedAt: '2026-05-06' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'AN0100 emits an error for `class X implements SourceGenerator { readonly id = "" }`.',
      binds: ['an0100EmptyIdError'] },
    { kind: 'unit-test' as const,
      describes: 'AN0100 emits no diagnostic for `readonly id = "valid-id"`.',
      binds: ['an0100LiteralIdOk'] },
    { kind: 'unit-test' as const,
      describes: 'AN0100 emits a warning for `readonly id = SOME_CONST` where the resolved value is not a literal.',
      binds: ['an0100RuntimeIdWarning'] },
    { kind: 'unit-test' as const,
      describes: 'AN0101 emits exactly one diagnostic for two generators sharing id, with relatedLocations pointing to both.',
      binds: ['an0101DuplicateIdsRelated'] },
    { kind: 'unit-test' as const,
      describes: 'AN0110 emits an error for an explicit `code: ""` literal in a returned Diagnostic.',
      binds: ['an0110EmptyCodeError'] },
    { kind: 'unit-test' as const,
      describes: 'AN0110 emits no diagnostic for a runtime/dynamic code value (best-effort static).',
      binds: ['an0110DynamicCodeIgnored'] },
    { kind: 'unit-test' as const,
      describes: 'AN0120 emits an error for `import * as fs from "node:fs"` in a file under `src/analyze/`.',
      binds: ['an0120NodeFsImportDetected'] },
    { kind: 'unit-test' as const,
      describes: 'AN0120 emits no diagnostic for `import { FileSystemPort } from "../ports/file-system.js"`.',
      binds: ['an0120FileSystemPortAllowed'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-06' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Conventions invariants regress silently; the package fails to dog-food its own subsystem; trust in analyzers degrades without proof of self-application.',
  };
}
