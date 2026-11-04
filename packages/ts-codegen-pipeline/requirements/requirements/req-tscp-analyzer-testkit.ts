import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Testing kit (sub-export `./testing`) so analyzer authors — internal,
 * npm-tier, or local — can build deterministic tests without
 * reinventing ts-morph in-memory scaffolding. Includes a contract
 * conformance assertion.
 */
export abstract class ReqTscpAnalyzerTestkitRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-TESTKIT';
  readonly title = 'Testing kit at `./testing` sub-export for analyzer authors';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'The package shall expose a `./testing` sub-export providing: `makeInMemoryProject(files: Record<string, string>): Project` building a ts-morph Project on `useInMemoryFileSystem: true` from path→content map; `runAnalyzer(a, project, opts?): Promise<readonly Diagnostic[]>` invoking an analyzer against the Project with optional `consumerPackageRoot`/`outDir` overrides; `assertAnalyzerContract(a): Promise<void>` verifying the analyzer satisfies — non-empty stable id; deterministic output (two runs identical); virtFs read-only (proxy with write counter); Project not mutated (snapshot diff); diagnostic codes non-empty; producerId === analyzer.id. Vitest matchers `toHaveCode`, `toHaveSeverity`, `toHaveLocation` shall be exported for ergonomic assertions.',
  };

  readonly rationale = {
    claim: 'Without a testing kit, every analyzer author reinvents Project scaffolding fragilely. A canonical `assertAnalyzerContract` is what kept the Roslyn ecosystem (Microsoft.CodeAnalysis.Testing) sane — it forces conformance pre-publish.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — DX baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'makeInMemoryProject({"src/a.ts":"..."}) returns a Project that resolves the supplied paths.',
      binds: ['makeInMemoryProjectResolvesProvidedPaths'] },
    { kind: 'unit-test' as const,
      describes: 'makeInMemoryProject does not write to the real disk (verified by tmp-dir snapshot equality).',
      binds: ['makeInMemoryProjectDoesNotWriteDisk'] },
    { kind: 'unit-test' as const,
      describes: 'runAnalyzer invokes analyze(ctx) with ctx.project === supplied project.',
      binds: ['runAnalyzerSeesProvidedProject'] },
    { kind: 'unit-test' as const,
      describes: 'runAnalyzer accepts opts to override consumerPackageRoot and outDir.',
      binds: ['runAnalyzerOptsOverrideContext'] },
    { kind: 'unit-test' as const,
      describes: 'assertAnalyzerContract on a conforming analyzer resolves without throwing.',
      binds: ['contractAcceptsConformingAnalyzer'] },
    { kind: 'unit-test' as const,
      describes: 'assertAnalyzerContract throws when the analyzer is non-deterministic (different output on identical input).',
      binds: ['contractRejectsNonDeterministic'] },
    { kind: 'unit-test' as const,
      describes: 'assertAnalyzerContract throws when the analyzer attempts to write to virtFs.',
      binds: ['contractRejectsVirtFsMutation'] },
    { kind: 'unit-test' as const,
      describes: 'assertAnalyzerContract throws when the analyzer mutates the Project source.',
      binds: ['contractRejectsProjectMutation'] },
    { kind: 'unit-test' as const,
      describes: 'Vitest matcher `toHaveCode("AN0001")` passes for diags array containing AN0001 and fails otherwise.',
      binds: ['matcherToHaveCodeWorks'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Third-party analyzer ecosystem fragments; conformance bugs leak to consumers; testing burden discourages authoring.',
  };
}
