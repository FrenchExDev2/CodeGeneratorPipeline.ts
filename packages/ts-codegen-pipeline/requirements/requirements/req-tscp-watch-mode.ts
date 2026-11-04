import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Watch mode = chokidar-based file watcher that re-runs `runFixpoint`
 * on changes to consumer source / spec directories. Must avoid
 * self-feedback (the runner's own outDir writes), coalesce bursts of
 * events, and serialize concurrent runs.
 */
export abstract class ReqTscpWatchModeRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-WATCH-MODE';
  readonly title = 'Watch mode reacts to source/spec changes, ignores generated outputs, and serializes runs';
  readonly priority = Priority.Medium;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When `sourcegen watch` is invoked,',
    response: 'the CLI shall watch consumer source globs (default `src/**/*.ts` + `requirements/**/*.ts`), perform an initial run, then debounce subsequent file events and re-invoke `runFixpoint`. Events under `outDir`, `node_modules`, `.git`, `dist`, `test-results`, or matching `*.generated.*` shall be ignored. Concurrent file events while a run is in progress shall queue at most one additional run.',
  };

  readonly rationale = {
    claim: 'A naive watcher that re-runs unconditionally on its own outDir writes loops infinitely. Ignoring generated outputs by file-name marker (`.generated.`) AND by outDir prefix is required for stability. Debounce + queue prevent thrashing on bulk edits (e.g. branch switch).',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — watch mode brief 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'shouldIgnore returns true for paths under outDir, node_modules, .git, dist, test-results, and for any path containing `.generated.`.',
      binds: ['ignoresOutDirChildren', 'ignoresNodeModules', 'ignoresDotGit', 'ignoresDist', 'ignoresTestResults', 'ignoresGeneratedFilesByMarker'] },
    { kind: 'unit-test' as const,
      describes: 'shouldIgnore returns false for a regular `.ts` file under src/ that is not generated.',
      binds: ['acceptsRegularSourceFile'] },
    { kind: 'unit-test' as const,
      describes: 'Coalescer collapses N notify() calls within the debounce window into a single run() invocation with the LAST reason.',
      binds: ['debounceCollapsesBurstToSingleRun'] },
    { kind: 'unit-test' as const,
      describes: 'Coalescer queues at most one additional run when notify() fires during an in-progress run; subsequent notifies during the same in-progress run all collapse into that single queued run.',
      binds: ['concurrentNotifyQueuesExactlyOneAdditionalRun'] },
    { kind: 'unit-test' as const,
      describes: 'Coalescer.runNow() triggers a run synchronously (used for the initial watch start-up run before any file event).',
      binds: ['runNowTriggersImmediateInitialRun'] },
    { kind: 'unit-test' as const, describes: 'The CLI uses chokidar; every trigger re-evaluates the configuration; SIGINT cancels pending work, awaits active work and watcher closure, then completes with exit status zero.', binds: ['cliReloadsConfigAndAwaitsWatcherShutdown', 'closeCancelsPendingWorkAndWaitsForActiveRun'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Watch mode loops infinitely on its own commits, or thrashes on burst edits, or misses changes during concurrent runs — making the dev loop unusable.',
  };
}
