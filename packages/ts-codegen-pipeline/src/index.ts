import type { SourceGenConfig } from './types.js';

export type {
  AddSourceResult,
  Analyzer,
  AnalysisContext,
  Diagnostic,
  DiagnosticLocation,
  DiagnosticPosition,
  EmittedRecord,
  GeneratedFile,
  GenerationContext,
  GenerationResult,
  ReadonlyVirtFs,
  RunOutcome,
  Severity,
  SourceGenConfig,
  SourceGenerator,
  SuppressionChecker,
  VirtFs,
  VirtFsDelta,
} from './types.js';

export { diagFromNode, type RelatedNode } from './analyze/diag.js';
export { withSeverity, withId, only } from './analyze/wrappers.js';
export { makeSuppressionChecker, parseDirectives, type SuppressionEntry } from './analyze/suppression.js';
export { runAnalyzers, type RunAnalyzersOptions, type RunAnalyzersResult, SLOW_ANALYZER_CODE } from './analyze/run-analyzers.js';

export type { DecoratedHit, DecoratedTarget } from './scan/types.js';
export { findDecorated } from './scan/find-decorated.js';
export { withBanner, extractBody, extractMeta, verifyBanneredHash, sha256Short } from './emit/banner.js';
export type { BannerMeta, ParsedBanner } from './emit/banner.js';
export { runFixpoint } from './runner/run-fixpoint.js';
export type { RunFixpointOptions } from './runner/run-fixpoint.js';
export { PackageBarrelGenerator } from './generators/package-barrel.js';
export type { PackageBarrelConfig } from './generators/package-barrel.js';
export { TestStubGenerator } from './generators/test-stub.js';
export type { TestStubConfig } from './generators/test-stub.js';
export { findFeatures } from './scan/find-features.js';
export type { FoundFeature } from './scan/find-features.js';
export { extractFitCriteria } from './scan/extract-fit-criteria.js';
export type { FitCriterion } from './scan/extract-fit-criteria.js';
export type { FileSystemPort } from './ports/file-system.js';
export { nodeFs } from './ports/file-system.js';

/** Identity helper for typed `sourcegen.config.ts` files. */
export function defineConfig(c: SourceGenConfig): SourceGenConfig {
  return c;
}
