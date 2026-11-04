import * as path from 'node:path';
import type { Diagnostic } from '../types.js';

/**
 * Validate a `relPath` argument to `addSource`. Returns null if the path
 * is safe (resolves strictly inside outDir), or an `SG0040` diagnostic
 * otherwise. Strict additive emission: rejects absolute paths (POSIX or
 * Windows), parent traversal (`..`), and any non-canonical form that
 * would resolve outside outDir after normalization.
 */
export function validateRelPath(relPath: string, producerId: string): Diagnostic | null {
  if (relPath.length === 0) {
    return makeSG0040(relPath, producerId, 'empty path');
  }
  if (path.isAbsolute(relPath) || /^[a-zA-Z]:[/\\]/.test(relPath)) {
    return makeSG0040(relPath, producerId, 'absolute path');
  }
  const posixized = relPath.replace(/\\/g, '/');
  const normalized = path.posix.normalize(posixized);
  if (normalized === '..' || normalized.startsWith('../')) {
    return makeSG0040(relPath, producerId, 'path escapes outDir');
  }
  return null;
}

function makeSG0040(relPath: string, producerId: string, reason: string): Diagnostic {
  return {
    severity: 'error',
    code: 'SG0040',
    message: `InvalidEmissionPath: ${reason} (${relPath})`,
    file: relPath,
    producerId,
  };
}
