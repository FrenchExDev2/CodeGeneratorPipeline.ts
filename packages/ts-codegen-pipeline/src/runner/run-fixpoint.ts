import * as path from 'node:path';
import type {
  Diagnostic,
  GenerationContext,
  GenerationResult,
  RunOutcome,
  SourceGenConfig,
  SourceGenerator,
} from '../types.js';
import { createVirtFs } from '../virtfs/create.js';
import { commitTo, scanExistingGeneratedFiles } from '../virtfs/commit.js';
import { verifyAgainstDisk, type VerifyResult } from '../emit/verify.js';
import type { VirtFsHandle } from '../virtfs/internal.js';
import { nodeFs, type FileSystemPort } from '../ports/file-system.js';
import { runAnalyzers } from '../analyze/run-analyzers.js';

const DEFAULT_MAX_ITERATIONS = 16;

export interface RunFixpointOptions {
  /** When true, skip the disk commit; return drift/edit diagnostics instead. */
  readonly verifyOnly?: boolean;
  /** Override the default `console.info` / `console.warn` logger. */
  readonly logger?: { info(m: string): void; warn(m: string): void };
  /** Defaults to nodeFs. Tests inject a stub for deterministic failure paths. */
  readonly fs?: FileSystemPort;
}

const DEFAULT_LOGGER = {
  info(_: string) { /* silent by default; CLI overrides */ },
  warn(_: string) { /* silent by default; CLI overrides */ },
};

/**
 * Roslyn-style multi-pass codegen runner.
 *
 * Loop invariant: at iteration N, every registered generator runs with a
 * `ctx.delta` view of what was emitted in iteration N-1. If an entire
 * iteration produces no new emissions, the fixpoint is reached and the
 * virtFS is committed to disk atomically. If `MAX_ITERATIONS` is reached
 * without convergence, the runner aborts with `SG0030` and the disk is
 * left untouched.
 */
export async function runFixpoint(
  cfg: SourceGenConfig,
  opts: RunFixpointOptions = {},
): Promise<RunOutcome> {
  const logger = opts.logger ?? DEFAULT_LOGGER;
  const fs = opts.fs ?? nodeFs;
  const max = cfg.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const consumerRoot = cfg.consumerPackageRoot;
  const outDir = path.resolve(consumerRoot, cfg.outDir ?? 'generated');
  const allDiagnostics: Diagnostic[] = [];

  const handle = await createVirtFs({
    tsconfigPath: cfg.tsconfigPath,
    consumerPackageRoot: consumerRoot,
    outDir,
    fs,
  });

  const generators = [...cfg.generators].sort((a, b) => a.id.localeCompare(b.id));

  let iteration = 0;
  for (; iteration < max; iteration++) {
    handle.setCurrentIteration(iteration);
    const delta = handle.buildDelta(iteration);
    let anyEmitted = false;
    for (const gen of generators) {
      const ctx: GenerationContext = {
        project: handle.project,
        virtFs: handle.virtFs,
        consumerPackageRoot: consumerRoot,
        outDir,
        iteration,
        delta,
        logger,
      };
      const res = await safeExecute(gen, ctx);
      allDiagnostics.push(...res.diagnostics);
      if (res.emittedSomething) anyEmitted = true;
    }

    if (allDiagnostics.some(d => d.severity === 'error')) {
      // Hard error in this or a previous iteration → abort, do not commit.
      return { ok: false, iterations: iteration + 1, diagnostics: allDiagnostics };
    }

    if (!anyEmitted) {
      // Fixpoint reached. Run analyzers (if any) on the converged state.
      const analyzers = cfg.analyzers ?? [];
      const analyzerResult = analyzers.length > 0
        ? await runAnalyzers(analyzers, {
            project: handle.project,
            virtFs: handle.virtFs,
            consumerPackageRoot: consumerRoot,
            outDir,
            logger,
            slowThresholdMs: cfg.slowAnalyzerThresholdMs,
          })
        : { diagnostics: [], timings: new Map<string, number>() };
      allDiagnostics.push(...analyzerResult.diagnostics);

      const analyzerErrors = analyzerResult.diagnostics.some(d => d.severity === 'error');

      if (opts.verifyOnly) {
        const verifyOutcome: VerifyResult = await verifyAgainstDisk({
          outDir,
          emissions: handle.getFinalEmissions(),
          fs,
        });
        return {
          ok: verifyOutcome.ok && !analyzerErrors,
          iterations: iteration + 1,
          diagnostics: [...allDiagnostics, ...verifyOutcome.diagnostics],
          analyzerTimings: analyzerResult.timings,
          committed: false,
        };
      }

      if (analyzerErrors) {
        // Pre-commit gate: any analyzer error aborts the commit.
        return {
          ok: false,
          iterations: iteration + 1,
          diagnostics: allDiagnostics,
          analyzerTimings: analyzerResult.timings,
          committed: false,
        };
      }

      const preCommitFiles = await scanExistingGeneratedFiles(outDir, fs);
      await commitTo({
        outDir,
        emissions: handle.getFinalEmissions().values(),
        preCommitFiles,
        fs,
      });
      return {
        ok: true,
        iterations: iteration + 1,
        diagnostics: allDiagnostics,
        analyzerTimings: analyzerResult.timings,
        committed: true,
      };
    }
  }

  // Did not converge within MAX_ITERATIONS.
  allDiagnostics.push({
    severity: 'error',
    code: 'SG0030',
    message: `MaxIterationsReached: fixpoint not reached within ${max} iterations`,
    producerId: 'runner',
  });
  return { ok: false, iterations: iteration, diagnostics: allDiagnostics };
}

async function safeExecute(gen: SourceGenerator, ctx: GenerationContext): Promise<GenerationResult> {
  try {
    return await gen.execute(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      emittedSomething: false,
      diagnostics: [{
        severity: 'error',
        code: 'SG0050',
        message: `GeneratorThrew: ${gen.id}: ${msg}`,
        producerId: gen.id,
      }],
    };
  }
}

/** Re-export for VirtFsHandle consumers (the CLI / tests). */
export type { VirtFsHandle };
