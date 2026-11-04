import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { globBaseDir, globToRegExp, matchesAnyGlob, watchRootsFor } from '../../src/watch/glob-watch.js';
import { WatchModeFeature } from '../../requirements/features/watch-mode.js';

const ROOT = '/x/pkg';
const DEFAULT_GLOBS = [`${ROOT}/src/**/*.ts`, `${ROOT}/requirements/**/*.ts`];

@FeatureTest(WatchModeFeature)
class WatchGlobTests {
  @Verifies<WatchModeFeature>('globBaseDirStopsAtFirstMagicSegment')
  baseDirIsTheStaticPrefix() {
    expect(globBaseDir(`${ROOT}/src/**/*.ts`)).toBe(`${ROOT}/src`);
    expect(globBaseDir(`${ROOT}/requirements/**/*.ts`)).toBe(`${ROOT}/requirements`);
    expect(globBaseDir(`${ROOT}/src/gen/*.ts`)).toBe(`${ROOT}/src/gen`);
    // `?` is magic too.
    expect(globBaseDir(`${ROOT}/src/a?/b.ts`)).toBe(`${ROOT}/src`);
  }

  @Verifies<WatchModeFeature>('globBaseDirStopsAtFirstMagicSegment')
  patternWithoutMagicIsItsOwnBase() {
    // chokidar accepts a concrete file path, so this stays watchable.
    expect(globBaseDir(`${ROOT}/src/only.ts`)).toBe(`${ROOT}/src/only.ts`);
    expect(globBaseDir('**/*.ts')).toBe('/');
  }

  @Verifies<WatchModeFeature>('doubleStarSpansZeroOrMoreSegments')
  doubleStarMatchesZeroSegments() {
    const re = globToRegExp(`${ROOT}/src/**/*.ts`);
    // The regression this guards: `src/a.ts` must match `src/**/*.ts`.
    expect(re.test(`${ROOT}/src/a.ts`)).toBe(true);
    expect(re.test(`${ROOT}/src/nested/a.ts`)).toBe(true);
    expect(re.test(`${ROOT}/src/deeply/nested/a.ts`)).toBe(true);
    const suffix = globToRegExp(`${ROOT}/src/**`);
    expect(suffix.test(`${ROOT}/src/`)).toBe(true);
    expect(suffix.test(`${ROOT}/src/a/b.ts`)).toBe(true);
    expect(suffix.test(`${ROOT}/other/a.ts`)).toBe(false);
    expect(globToRegExp('**.ts').test('deep/a.ts')).toBe(true);
  }

  @Verifies<WatchModeFeature>('doubleStarSpansZeroOrMoreSegments')
  doubleStarRespectsExtensionAndPrefix() {
    const re = globToRegExp(`${ROOT}/src/**/*.ts`);
    expect(re.test(`${ROOT}/src/a.js`)).toBe(false);
    expect(re.test(`${ROOT}/other/a.ts`)).toBe(false);
    expect(re.test(`${ROOT}/src`)).toBe(false);
  }

  @Verifies<WatchModeFeature>('singleStarStaysWithinOneSegment')
  singleStarDoesNotCrossSeparators() {
    const re = globToRegExp(`${ROOT}/src/*.ts`);
    expect(re.test(`${ROOT}/src/a.ts`)).toBe(true);
    expect(re.test(`${ROOT}/src/nested/a.ts`)).toBe(false);
  }

  @Verifies<WatchModeFeature>('singleStarStaysWithinOneSegment')
  questionMarkMatchesExactlyOneChar() {
    const re = globToRegExp(`${ROOT}/src/a?.ts`);
    expect(re.test(`${ROOT}/src/ab.ts`)).toBe(true);
    expect(re.test(`${ROOT}/src/a.ts`)).toBe(false);
    expect(re.test(`${ROOT}/src/abc.ts`)).toBe(false);
  }

  @Verifies<WatchModeFeature>('singleStarStaysWithinOneSegment')
  dotsAreLiteralNotWildcards() {
    const re = globToRegExp(`${ROOT}/src/a.ts`);
    expect(re.test(`${ROOT}/src/a.ts`)).toBe(true);
    // A raw regex would let `.` match the `x` here.
    expect(re.test(`${ROOT}/src/axts`)).toBe(false);
  }

  @Verifies<WatchModeFeature>('watchRootsFoldNestedDirsIntoAncestor')
  defaultGlobsYieldTwoRoots() {
    expect(watchRootsFor(DEFAULT_GLOBS)).toEqual([`${ROOT}/requirements`, `${ROOT}/src`]);
  }

  @Verifies<WatchModeFeature>('watchRootsFoldNestedDirsIntoAncestor')
  nestedRootsCollapseIntoTheirAncestor() {
    const roots = watchRootsFor([`${ROOT}/src/**/*.ts`, `${ROOT}/src/nested/**/*.ts`]);
    expect(roots).toEqual([`${ROOT}/src`]);
  }

  @Verifies<WatchModeFeature>('watchRootsFoldNestedDirsIntoAncestor')
  siblingPrefixIsNotTreatedAsNested() {
    // `/x/pkg/srcgen` must not be swallowed by `/x/pkg/src`.
    const roots = watchRootsFor([`${ROOT}/src/**/*.ts`, `${ROOT}/srcgen/**/*.ts`]);
    expect(roots).toEqual([`${ROOT}/src`, `${ROOT}/srcgen`]);
  }

  @Verifies<WatchModeFeature>('watchRootsFoldNestedDirsIntoAncestor')
  duplicatePatternsCollapse() {
    expect(watchRootsFor([`${ROOT}/src/**/*.ts`, `${ROOT}/src/**/*.ts`])).toEqual([`${ROOT}/src`]);
  }

  @Verifies<WatchModeFeature>('eventPathsAreScreenedAgainstPatterns')
  onlyMatchingEventPathsPass() {
    expect(matchesAnyGlob(`${ROOT}/src/a.ts`, DEFAULT_GLOBS)).toBe(true);
    expect(matchesAnyGlob(`${ROOT}/requirements/features/f.ts`, DEFAULT_GLOBS)).toBe(true);
    // Under a watched root, but not a pattern match — this is what the event
    // filter exists for, since chokidar reports every file beneath the root.
    expect(matchesAnyGlob(`${ROOT}/src/notes.md`, DEFAULT_GLOBS)).toBe(false);
    expect(matchesAnyGlob(`${ROOT}/README.md`, DEFAULT_GLOBS)).toBe(false);
  }

  @Verifies<WatchModeFeature>('eventPathsAreScreenedAgainstPatterns')
  windowsSeparatorsAreNormalized() {
    // chokidar emits native paths on Windows.
    expect(matchesAnyGlob('C:\\x\\pkg\\src\\a.ts', ['C:/x/pkg/src/**/*.ts'])).toBe(true);
    expect(matchesAnyGlob('C:\\x\\pkg\\src\\deep\\a.ts', ['C:/x/pkg/src/**/*.ts'])).toBe(true);
  }

  @Verifies<WatchModeFeature>('eventPathsAreScreenedAgainstPatterns')
  emptyPatternListMatchesNothing() {
    expect(matchesAnyGlob(`${ROOT}/src/a.ts`, [])).toBe(false);
  }
}

export { WatchGlobTests };
