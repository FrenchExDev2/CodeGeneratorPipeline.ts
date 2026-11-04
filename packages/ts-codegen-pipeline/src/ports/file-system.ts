import * as fsp from 'node:fs/promises';
import type { FileSystem } from '@frenchexdev2/requirements-shared-kernel/ports';

/**
 * FileSystem port for ts-codegen-pipeline. Extends the shared
 * `@frenchexdev2/requirements-shared-kernel/ports` `FileSystem` with `rename`
 * (required for atomic write-tmp + rename commits). All operations are
 * async — callers (createVirtFs, commitTo, scanExistingGeneratedFiles,
 * verifyAgainstDisk) are async too.
 *
 * Tests inject a stub that can be instructed to throw on any operation
 * to deterministically cover OS-specific defensive paths.
 */
export interface FileSystemPort extends FileSystem {
  rename(oldPath: string, newPath: string): Promise<void>;
}

/** Default implementation backed by `node:fs/promises`. */
export const nodeFs: FileSystemPort = {
  async readFile(p, encoding) {
    return fsp.readFile(p, encoding);
  },
  async writeFile(p, c) {
    await fsp.writeFile(p, c, 'utf8');
  },
  async exists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
  },
  async mkdir(p, opts) {
    await fsp.mkdir(p, opts);
  },
  async readdir(p) {
    return fsp.readdir(p);
  },
  async stat(p) {
    const st = await fsp.stat(p);
    return { mtimeMs: st.mtimeMs, size: st.size, isDirectory: () => st.isDirectory() };
  },
  async unlink(p) {
    await fsp.unlink(p);
  },
  async rename(oldPath, newPath) {
    await fsp.rename(oldPath, newPath);
  },
};
