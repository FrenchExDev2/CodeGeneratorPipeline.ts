import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpWatchModeRequirement } from '../requirements/req-tscp-watch-mode.js';

@Satisfies(ReqTscpWatchModeRequirement)
export abstract class WatchModeFeature extends Feature {
  readonly id = 'TSCP-WATCH-MODE';
  readonly title = 'CLI `watch` re-runs sourcegen on src/spec changes, ignores generated outputs, serializes runs';
  readonly priority = Priority.Medium;
  readonly enabled = true;

  // shouldIgnore — pure path filter
  abstract ignoresOutDirChildren(): ACResult;
  abstract ignoresNodeModules(): ACResult;
  abstract ignoresDotGit(): ACResult;
  abstract ignoresDist(): ACResult;
  abstract ignoresTestResults(): ACResult;
  abstract ignoresGeneratedFilesByMarker(): ACResult;
  abstract acceptsRegularSourceFile(): ACResult;

  // Coalescer — debounce + queue
  abstract debounceCollapsesBurstToSingleRun(): ACResult;
  abstract concurrentNotifyQueuesExactlyOneAdditionalRun(): ACResult;
  abstract runNowTriggersImmediateInitialRun(): ACResult;
  abstract closeCancelsPendingWorkAndWaitsForActiveRun(): ACResult;
  abstract cliReloadsConfigAndAwaitsWatcherShutdown(): ACResult; // expects: integration

  // glob-watch — chokidar >= 4 dropped glob support, so patterns are resolved
  // to concrete watch roots and re-applied as an event-level filter.
  abstract globBaseDirStopsAtFirstMagicSegment(): ACResult;
  abstract doubleStarSpansZeroOrMoreSegments(): ACResult;
  abstract singleStarStaysWithinOneSegment(): ACResult;
  abstract watchRootsFoldNestedDirsIntoAncestor(): ACResult;
  abstract eventPathsAreScreenedAgainstPatterns(): ACResult;
}
