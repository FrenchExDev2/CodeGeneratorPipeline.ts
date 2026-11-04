import * as path from 'node:path';
import type { Project } from 'ts-morph';
import type {
  AddSourceResult,
  Diagnostic,
  EmittedRecord,
  GeneratedFile,
  VirtFs,
  VirtFsDelta,
} from '../types.js';
import { validateRelPath } from './path-validation.js';

/**
 * Internal handle returned by buildVirtFs / createVirtFs. Exposes the
 * public VirtFs interface plus controls used by the runner: setting the
 * current iteration, snapshotting the journal, building a delta.
 */
export interface VirtFsHandle {
  readonly virtFs: VirtFs;
  readonly project: Project;
  readonly outDir: string;
  setCurrentIteration(n: number): void;
  /** Returns a frozen snapshot of the journal (no live aliasing). */
  snapshotJournal(): readonly EmittedRecord[];
  /** Final state per relPath — one entry per emitted file. Used by `commitTo`. */
  getFinalEmissions(): ReadonlyMap<string, GeneratedFile>;
  /** Build a VirtFsDelta consistent with the journal at iteration n. */
  buildDelta(currentIteration: number): VirtFsDelta;
}

interface InternalState {
  readonly project: Project;
  readonly outDir: string;
  /** relPath → latest emission. Single source of truth for `has`/`read`. */
  readonly emissions: Map<string, GeneratedFile>;
  /** Append-only emission log (one entry per successful addSource). */
  readonly journal: EmittedRecord[];
  currentIteration: number;
}

/**
 * Pure constructor. Takes a fully-prepared ts-morph Project (its
 * FileSystemHost is the responsibility of the caller — typically
 * `useInMemoryFileSystem: true`). Does no I/O.
 */
export function buildVirtFs(opts: { project: Project; outDir: string }): VirtFsHandle {
  const state: InternalState = {
    project: opts.project,
    outDir: opts.outDir,
    emissions: new Map(),
    journal: [],
    currentIteration: 0,
  };

  const virtFs: VirtFs = {
    has(relPath: string): boolean {
      if (state.emissions.has(relPath)) return true;
      const abs = path.join(state.outDir, relPath);
      return state.project.getSourceFile(abs) !== undefined;
    },

    read(relPath: string): string {
      const emitted = state.emissions.get(relPath);
      if (emitted) return emitted.contents;
      const abs = path.join(state.outDir, relPath);
      const sf = state.project.getSourceFile(abs);
      if (!sf) {
        throw new Error(`VirtFs: relPath not found: ${relPath}`);
      }
      return sf.getFullText();
    },

    addSource(file: GeneratedFile): AddSourceResult {
      // 1. Path validation (SG0040)
      const pathDiag = validateRelPath(file.relPath, file.producerId);
      if (pathDiag) {
        return { newOrChanged: false, diagnostics: [pathDiag] };
      }

      // 2. Idempotence / divergence detection
      const existing = state.emissions.get(file.relPath);
      if (existing) {
        if (existing.contents === file.contents) {
          // Idempotent overlap — no-op (does NOT append to journal).
          return { newOrChanged: false };
        }
        if (existing.producerId !== file.producerId) {
          // Cross-producer divergence (SG0020) — refuse, virtFs unchanged.
          const diag: Diagnostic = {
            severity: 'error',
            code: 'SG0020',
            message: `EmissionDivergence: producers '${existing.producerId}' and '${file.producerId}' both emit different contents for '${file.relPath}'`,
            file: file.relPath,
            producerId: file.producerId,
          };
          return { newOrChanged: false, diagnostics: [diag] };
        }
        // Same producer updating its own emission with new contents — allowed.
      }

      // 3. Apply the write to virtFs map AND to the ts-morph project so
      //    subsequent generators (and ctx.project) see it as a SourceFile.
      state.emissions.set(file.relPath, file);
      const absPath = path.join(state.outDir, file.relPath);
      const existingSf = state.project.getSourceFile(absPath);
      if (existingSf) {
        existingSf.replaceWithText(file.contents);
      } else {
        state.project.createSourceFile(absPath, file.contents, { overwrite: true });
      }

      // 4. Append to journal.
      state.journal.push({
        relPath: file.relPath,
        contents: file.contents,
        producerId: file.producerId,
        emittedAtIteration: state.currentIteration,
      });

      return { newOrChanged: true };
    },

    listEmitted(): readonly EmittedRecord[] {
      return Object.freeze(state.journal.slice());
    },
  };

  return {
    virtFs,
    project: state.project,
    outDir: state.outDir,
    setCurrentIteration(n: number) {
      state.currentIteration = n;
    },
    snapshotJournal() {
      return Object.freeze(state.journal.slice());
    },
    getFinalEmissions() {
      return new Map(state.emissions);
    },
    buildDelta(currentIteration: number): VirtFsDelta {
      const journalCopy = state.journal.slice();
      const lastIter = currentIteration - 1;
      const emittedSinceStart = Object.freeze(journalCopy);
      const emittedLastIteration = Object.freeze(
        journalCopy.filter(r => r.emittedAtIteration === lastIter),
      );
      return {
        emittedSinceStart,
        emittedLastIteration,
        filterEmittedSince(iteration: number) {
          return Object.freeze(journalCopy.filter(r => r.emittedAtIteration >= iteration));
        },
      };
    },
  };
}
