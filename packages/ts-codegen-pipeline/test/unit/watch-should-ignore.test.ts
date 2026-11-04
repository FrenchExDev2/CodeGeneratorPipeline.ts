import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { shouldIgnore } from '../../src/watch/should-ignore.js';
import { WatchModeFeature } from '../../requirements/features/watch-mode.js';

const OUT_DIR = '/x/pkg/generated';

@FeatureTest(WatchModeFeature)
class WatchShouldIgnoreTests {
  @Verifies<WatchModeFeature>('ignoresOutDirChildren')
  outDirSelfAndChildrenIgnored() {
    expect(shouldIgnore(OUT_DIR, OUT_DIR)).toBe(true);
    expect(shouldIgnore('/x/pkg/generated/foo.generated.ts', OUT_DIR)).toBe(true);
    expect(shouldIgnore('/x/pkg/generated/sub/bar.generated.ts', OUT_DIR)).toBe(true);
  }

  @Verifies<WatchModeFeature>('ignoresOutDirChildren')
  outDirAsBackslashIsNormalized() {
    // chokidar may emit Windows-style paths.
    expect(shouldIgnore('C:\\x\\pkg\\generated\\foo.ts', 'C:/x/pkg/generated')).toBe(true);
  }

  @Verifies<WatchModeFeature>('ignoresNodeModules')
  nodeModulesIgnored() {
    expect(shouldIgnore('/x/pkg/node_modules/foo/index.ts', OUT_DIR)).toBe(true);
    expect(shouldIgnore('/x/node_modules/deep/dir/file.ts', OUT_DIR)).toBe(true);
  }

  @Verifies<WatchModeFeature>('ignoresDotGit')
  dotGitIgnored() {
    expect(shouldIgnore('/x/pkg/.git/HEAD', OUT_DIR)).toBe(true);
    expect(shouldIgnore('/x/pkg/.git/objects/pack/pack-abc.idx', OUT_DIR)).toBe(true);
  }

  @Verifies<WatchModeFeature>('ignoresDist')
  distIgnored() {
    expect(shouldIgnore('/x/pkg/dist/index.js', OUT_DIR)).toBe(true);
    expect(shouldIgnore('/x/pkg/dist/sub/foo.d.ts', OUT_DIR)).toBe(true);
  }

  @Verifies<WatchModeFeature>('ignoresTestResults')
  testResultsIgnored() {
    expect(shouldIgnore('/x/pkg/test-results/2026-01-01/coverage.json', OUT_DIR)).toBe(true);
  }

  @Verifies<WatchModeFeature>('ignoresGeneratedFilesByMarker')
  generatedMarkerIgnored() {
    // Outside outDir but matching `.generated.` — still ignored.
    expect(shouldIgnore('/x/pkg/src/foo.generated.ts', OUT_DIR)).toBe(true);
    expect(shouldIgnore('/x/pkg/test/unit/scaffolds/x.scaffold.generated.test.ts', OUT_DIR)).toBe(true);
  }

  @Verifies<WatchModeFeature>('acceptsRegularSourceFile')
  regularSourceFileAccepted() {
    expect(shouldIgnore('/x/pkg/src/runner/run-fixpoint.ts', OUT_DIR)).toBe(false);
    expect(shouldIgnore('/x/pkg/requirements/features/foo.ts', OUT_DIR)).toBe(false);
    expect(shouldIgnore('/x/pkg/test/unit/runner.test.ts', OUT_DIR)).toBe(false);
  }
}

export { WatchShouldIgnoreTests };
