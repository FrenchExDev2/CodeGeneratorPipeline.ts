import * as path from 'node:path';
import type { Diagnostic, GeneratedFile } from '../types.js';
import { verifyBanneredHash } from './banner.js';
import { scanExistingGeneratedFiles } from '../virtfs/commit.js';
import { nodeFs, type FileSystemPort } from '../ports/file-system.js';

export interface VerifyOptions {
  /** Absolute path of outDir on real disk. */
  readonly outDir: string;
  /** Final virtFS state after a fixpoint run (no commit performed). */
  readonly emissions: ReadonlyMap<string, GeneratedFile>;
  /** Defaults to nodeFs. Tests inject a stub for deterministic failure paths. */
  readonly fs?: FileSystemPort;
}

export interface VerifyResult {
  /** True iff disk state matches virtFS exactly (no drift, no hand-edit, no extras). */
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Compare an in-memory virtFS state to disk without committing. Reports:
 * - `SG0010 GeneratedFileEditedByHand` when a disk file's banner hash
 *   does not match its body (hand edit).
 * - `SG0011 RegenerationDrift` when disk content differs from virtFS but
 *   the banner hash is consistent (the user changed sources without
 *   re-running) OR a virtFS file is missing on disk OR a disk file
 *   should be purged but is still there.
 */
export async function verifyAgainstDisk(opts: VerifyOptions): Promise<VerifyResult> {
  const fs = opts.fs ?? nodeFs;
  const diagnostics: Diagnostic[] = [];

  // 1. Compare each virtFS emission to its disk counterpart.
  for (const file of opts.emissions.values()) {
    const diskAbs = path.join(opts.outDir, file.relPath);
    let diskContents: string | null;
    try {
      diskContents = await fs.readFile(diskAbs, 'utf8');
    } catch {
      diskContents = null;
    }
    if (diskContents === null) {
      diagnostics.push({
        severity: 'error',
        code: 'SG0011',
        message: `RegenerationDrift: file missing on disk: ${file.relPath}`,
        file: file.relPath,
        producerId: 'verify',
      });
      continue;
    }
    if (diskContents === file.contents) continue;
    // Differ — distinguish hand-edit from regeneration drift.
    const hashConsistent = verifyBanneredHash(diskContents);
    diagnostics.push({
      severity: 'error',
      code: hashConsistent ? 'SG0011' : 'SG0010',
      message: hashConsistent
        ? `RegenerationDrift: ${file.relPath} differs from current generation`
        : `GeneratedFileEditedByHand: ${file.relPath}`,
      file: file.relPath,
      producerId: 'verify',
    });
  }

  // 2. Pre-existing *.generated.ts on disk that virtFS does NOT cover are stale (drift).
  const onDisk = await scanExistingGeneratedFiles(opts.outDir, fs);
  const expectedAbs = new Set(
    [...opts.emissions.values()].map(f => path.join(opts.outDir, f.relPath)),
  );
  for (const stale of onDisk) {
    if (expectedAbs.has(stale)) continue;
    diagnostics.push({
      severity: 'error',
      code: 'SG0011',
      message: `RegenerationDrift: stale generated file on disk (would be purged at next run): ${path.relative(opts.outDir, stale)}`,
      file: path.relative(opts.outDir, stale),
      producerId: 'verify',
    });
  }

  return { ok: diagnostics.length === 0, diagnostics };
}
