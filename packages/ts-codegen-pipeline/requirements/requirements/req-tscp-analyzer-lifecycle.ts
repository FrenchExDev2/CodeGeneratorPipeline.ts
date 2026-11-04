import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Analyzers are first-class citizens distinct from SourceGenerators:
 * read-only over the converged virtFS, executed once after fixpoint and
 * before disk commit. An error severity from any analyzer aborts the
 * commit so failed code never lands on disk.
 */
export abstract class ReqTscpAnalyzerLifecycleRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-LIFECYCLE';
  readonly title = 'Analyzers run post-fixpoint, pre-commit; errors abort commit';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When the generator fixpoint converges with zero error diagnostics,',
    response: 'the runner shall execute every registered Analyzer exactly once on the converged Project + virtFS. The Analyzer interface accepts both synchronous (`Diagnostic[]`) and asynchronous (`Promise<Diagnostic[]>`) returns; the runner awaits in both cases. If any analyzer emits a diagnostic of severity `error`, the runner shall NOT commit virtFS to disk and shall return a non-zero exit code; all analyzer diagnostics from the same run are collected exhaustively (no early stop).',
  };

  readonly rationale = {
    claim: 'Post-fixpoint placement gives analyzers the converged virtFS to inspect (sources + every generated artefact). Pre-commit placement preserves the by-construction clean-failure invariant: an analyzer rejection is exactly as recoverable as a generator failure — disk untouched, no rollback needed. Sync-or-async return removes Promise overhead for the dominant analyzer case.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — analyzer baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'AnalysisContext exposes virtFs as ReadonlyVirtFs and has no `iteration`, `delta`, or `emittedSomething` surface.',
      binds: ['analyzerContextIsReadOnly'] },
    { kind: 'unit-test' as const,
      describes: 'runAnalyzers runs strictly after the fixpoint loop returns, strictly before commitTo is invoked.',
      binds: ['analyzersRunPostFixpointPreCommit'] },
    { kind: 'unit-test' as const,
      describes: 'A single error diagnostic from any analyzer prevents commitTo from being called.',
      binds: ['errorAbortsCommit'] },
    { kind: 'unit-test' as const,
      describes: 'When one analyzer errors, all subsequent analyzers still run; diagnostics are aggregated exhaustively.',
      binds: ['errorDoesNotShortCircuitOtherAnalyzers'] },
    { kind: 'unit-test' as const,
      describes: 'A synchronous analyzer (returns `Diagnostic[]` directly, no Promise) is correctly awaited by the runner.',
      binds: ['supportsSyncReturn'] },
    { kind: 'unit-test' as const,
      describes: 'An asynchronous analyzer (returns `Promise<Diagnostic[]>`) is correctly awaited by the runner.',
      binds: ['supportsAsyncReturn'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Bad code reaches disk; users have to manually undo committed bad generations; clean-failure semantics broken; analyzers become advisory rather than enforcing.',
  };
}
