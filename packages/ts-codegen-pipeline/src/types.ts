import type { Node, Project } from 'ts-morph';

/**
 * A source generator. Roslyn analogue: ISourceGenerator.
 *
 * Generators must be deterministic and idempotent: running twice on the
 * same virtFS state must yield the same emissions. This is the load-bearing
 * property for fixpoint convergence.
 */
export interface SourceGenerator {
  readonly id: string;
  execute(ctx: GenerationContext): Promise<GenerationResult>;
}

/** Roslyn analogue: GeneratorExecutionContext. */
export interface GenerationContext {
  readonly project: Project;
  readonly virtFs: VirtFs;
  readonly consumerPackageRoot: string;
  readonly outDir: string;
  readonly iteration: number;
  readonly delta: VirtFsDelta;
  readonly logger: { info(m: string): void; warn(m: string): void };
}

/**
 * Read-only journal slice so a generator can react only to what is new,
 * instead of rescanning the whole virtFS each iteration.
 */
export interface VirtFsDelta {
  readonly emittedSinceStart: readonly EmittedRecord[];
  /** Emissions made during iteration `iteration - 1`. Empty at iteration 0. */
  readonly emittedLastIteration: readonly EmittedRecord[];
  filterEmittedSince(iteration: number): readonly EmittedRecord[];
}

export interface EmittedRecord {
  readonly relPath: string;
  readonly contents: string;
  readonly producerId: string;
  readonly emittedAtIteration: number;
}

/**
 * In-memory FS, the only writer between iterations. Strictly additive:
 * `addSource` only accepts paths inside `outDir`; paths escaping yield
 * `SG0040 InvalidEmissionPath`. Two generators emitting different
 * contents for the same `relPath` yield `SG0020 EmissionDivergence`.
 */
export interface VirtFs {
  has(relPath: string): boolean;
  read(relPath: string): string;
  addSource(file: GeneratedFile): AddSourceResult;
  listEmitted(): readonly EmittedRecord[];
}

export interface AddSourceResult {
  readonly newOrChanged: boolean;
  readonly diagnostics?: readonly Diagnostic[];
}

/** Roslyn analogue: GeneratedSourceResult. */
export interface GeneratedFile {
  readonly relPath: string;
  readonly contents: string;
  readonly producerId: string;
}

export type Severity = 'error' | 'warning' | 'info';

/** 1-based line/column position for surfaceable diagnostics. */
export interface DiagnosticPosition {
  readonly line: number;
  readonly column: number;
}

/** Secondary location pointed at by a diagnostic ("X must match Y"). */
export interface DiagnosticLocation {
  readonly file: string;
  readonly start?: DiagnosticPosition;
  readonly end?: DiagnosticPosition;
  readonly message?: string;
}

export interface Diagnostic {
  readonly severity: Severity;
  /** Stable code, e.g. `SG0010`, `SG0020`, `AN0100`. */
  readonly code: string;
  readonly message: string;
  readonly producerId: string;
  readonly file?: string;
  readonly start?: DiagnosticPosition;
  readonly end?: DiagnosticPosition;
  /** "X must match Y" — secondary locations the consumer should see. */
  readonly relatedLocations?: readonly DiagnosticLocation[];
}

/**
 * Returned by `SourceGenerator.execute`. The runner reaches the fixpoint
 * when an entire iteration completes with no generator returning
 * `emittedSomething: true`.
 */
export interface GenerationResult {
  readonly emittedSomething: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export interface SourceGenConfig {
  readonly tsconfigPath: string;
  readonly consumerPackageRoot: string;
  readonly generators: readonly SourceGenerator[];
  /** Optional analyzer phase, run once after fixpoint, before commit. */
  readonly analyzers?: readonly Analyzer[];
  /** Default 16. Caps oscillating non-converging generators. */
  readonly maxIterations?: number;
  /**
   * Output directory for generated files. Relative paths are resolved
   * against `consumerPackageRoot`. Defaults to `'generated'`. Use
   * `'src'` for in-source barrels (the strictly-additive guarantee
   * still holds: emissions stay under outDir).
   */
  readonly outDir?: string;
  /**
   * Threshold (ms) above which an analyzer that took too long emits a
   * warning. Default 1000. Pure observability — never aborts.
   */
  readonly slowAnalyzerThresholdMs?: number;
}

/** Read-only slice of VirtFs handed to analyzers — no emission allowed. */
export type ReadonlyVirtFs = Pick<VirtFs, 'has' | 'read' | 'listEmitted'>;

/** Per-node suppression query injected into AnalysisContext. */
export type SuppressionChecker = (node: Node, code: string) => boolean;

/**
 * An analyzer. Roslyn analogue: DiagnosticAnalyzer.
 *
 * Analyzers are read-only over the converged virtFS. They run exactly
 * once after the fixpoint loop has terminated and before the disk
 * commit. An error severity from any analyzer aborts the commit.
 */
export interface Analyzer {
  /** Stable id, e.g. 'analyzer:generator-id-non-empty'. */
  readonly id: string;
  /** One-line description shown by `sourcegen list analyzers` and `explain`. */
  readonly description?: string;
  /** Optional URL to the rule documentation. */
  readonly docsUrl?: string;
  analyze(ctx: AnalysisContext):
    | readonly Diagnostic[]
    | Promise<readonly Diagnostic[]>;
}

export interface AnalysisContext {
  readonly project: Project;
  readonly virtFs: ReadonlyVirtFs;
  readonly consumerPackageRoot: string;
  readonly outDir: string;
  readonly logger: { info(m: string): void; warn(m: string): void };
  readonly isSuppressed: SuppressionChecker;
}

export interface RunOutcome {
  readonly ok: boolean;
  readonly iterations: number;
  readonly diagnostics: readonly Diagnostic[];
  /**
   * Per-analyzer execution timings (ms). Empty if no analyzers ran.
   * Pure observability — keys are analyzer.id, values are durations.
   */
  readonly analyzerTimings?: ReadonlyMap<string, number>;
  /** True when the commit was performed (false on error or verifyOnly). */
  readonly committed?: boolean;
}
