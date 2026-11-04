import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { AtomicCommitFeature } from '../../requirements/features/atomic-commit.js';
import { commitTo, scanExistingGeneratedFiles } from '../../src/virtfs/commit.js';
import { createVirtFs } from '../../src/virtfs/create.js';
import { VirtualFsIsolationFeature } from '../../requirements/features/virtual-fs-isolation.js';
import type { FileSystemPort } from '../../src/ports/file-system.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Stub FileSystemPort that records all calls and can be instructed to
 * throw on any operation by name + nth-call. Used to deterministically
 * cover defensive paths that depend on OS-level failures (rename
 * collision, partial write, unlink-on-already-gone, etc.).
 */
class StubFs implements FileSystemPort {
  readonly calls: { op: string; args: unknown[] }[] = [];
  readonly storage = new Map<string, string>();
  /** Map "<op>:<n>" → throw config (n is the 0-based attempt index). */
  readonly throwOn = new Map<string, Error>();
  private readonly attempts = new Map<string, number>();

  /** Records the attempt and throws if configured BEFORE the operation runs. */
  private track(op: string, args: unknown[]): void {
    const n = this.attempts.get(op) ?? 0;
    this.attempts.set(op, n + 1);
    this.calls.push({ op, args });
    const err = this.throwOn.get(`${op}:${n}`);
    if (err) throw err;
  }

  async readFile(p: string, _encoding: 'utf8'): Promise<string> {
    this.track('readFile', [p]);
    const v = this.storage.get(p);
    if (v === undefined) throw new Error(`StubFs: ENOENT ${p}`);
    return v;
  }
  async writeFile(p: string, c: string): Promise<void> {
    this.track('writeFile', [p, c]);
    this.storage.set(p, c);
  }
  async exists(p: string): Promise<boolean> {
    this.track('exists', [p]);
    return this.storage.has(p);
  }
  async mkdir(p: string, opts?: { recursive?: boolean }): Promise<void> {
    this.track('mkdir', [p, opts]);
  }
  /** Optional pre-set dir entries returned by readdir. */
  readonly dirEntries = new Map<string, readonly string[]>();
  async readdir(p: string): Promise<string[]> {
    this.track('readdir', [p]);
    const entries = this.dirEntries.get(p);
    return entries ? [...entries] : [];
  }
  async stat(p: string) {
    this.track('stat', [p]);
    return { mtimeMs: 0, size: 0, isDirectory: () => false };
  }
  async unlink(p: string): Promise<void> {
    this.track('unlink', [p]);
    this.storage.delete(p);
  }
  async rename(oldPath: string, newPath: string): Promise<void> {
    this.track('rename', [oldPath, newPath]);
    const v = this.storage.get(oldPath);
    if (v === undefined) throw new Error(`StubFs: ENOENT ${oldPath}`);
    this.storage.delete(oldPath);
    this.storage.set(newPath, v);
  }
}

@FeatureTest(AtomicCommitFeature)
class FileSystemStubTests {
  @Verifies<AtomicCommitFeature>('failedRenameLeavesNoTmpFiles')
  async secondWriteFailsCleanupsFirstTmp() {
    // Two emissions; the second writeFile call throws → catch path runs,
    // unlinks the first tmp written. Deterministic, no real disk.
    const stub = new StubFs();
    stub.throwOn.set('writeFile:1', new Error('disk full'));
    let threw = false;
    try {
      await commitTo({
        outDir: '/x/out',
        emissions: [
          { relPath: 'A.generated.ts', contents: 'a' },
          { relPath: 'B.generated.ts', contents: 'b' },
        ],
        preCommitFiles: [],
        fs: stub,
      });
    } catch (err) {
      threw = true;
      expect((err as Error).message).toBe('disk full');
    }
    expect(threw).toBe(true);
    // The first tmp must have been unlinked.
    const unlinks = stub.calls.filter(c => c.op === 'unlink');
    expect(unlinks).toHaveLength(1);
    expect((unlinks[0]?.args[0] as string)).toContain('A.generated.ts.tmp');
  }

  @Verifies<AtomicCommitFeature>('failedRenameLeavesNoTmpFiles')
  async renameFailsAfterFirstSuccessCleanupRemainingTmps() {
    // Two emissions; both writes succeed; the SECOND rename throws → catch
    // path unlinks remaining un-renamed tmps. Deterministic.
    const stub = new StubFs();
    stub.throwOn.set('rename:1', new Error('rename collision'));
    let threw = false;
    try {
      await commitTo({
        outDir: '/x/out',
        emissions: [
          { relPath: 'A.generated.ts', contents: 'a' },
          { relPath: 'B.generated.ts', contents: 'b' },
        ],
        preCommitFiles: [],
        fs: stub,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    // After the rename failure, B's tmp was unlinked (A's already renamed).
    const unlinks = stub.calls.filter(c => c.op === 'unlink');
    expect(unlinks).toHaveLength(1);
    expect((unlinks[0]?.args[0] as string)).toContain('B.generated.ts.tmp');
  }

  @Verifies<AtomicCommitFeature>('commitPurgesObsoleteOutputs')
  async unlinkOnPurgeFailsIsSwallowed() {
    // preCommitFiles lists a stale path; unlink throws → silently swallowed.
    const stub = new StubFs();
    stub.throwOn.set('unlink:0', new Error('already gone'));
    const result = await commitTo({
      outDir: '/x/out',
      emissions: [{ relPath: 'A.generated.ts', contents: 'a' }],
      preCommitFiles: ['/x/out/Old.generated.ts'],
      fs: stub,
    });
    // Stale was attempted but unlink threw → not in `purged`.
    expect(result.purged).toEqual([]);
    // Real `written` still includes A (rename succeeded).
    expect(result.written).toHaveLength(1);
  }
}

@FeatureTest(AtomicCommitFeature)
class ScanStatFailureCovered {
  @Verifies<AtomicCommitFeature>('commitPurgesObsoleteOutputs')
  async statFailureSkipsEntry() {
    // exists=true, readdir returns ['a.generated.ts', 'b.generated.ts'],
    // first stat throws → continue (skipped); second stat returns isDirectory=false
    // and matches GENERATED_SUFFIX → included.
    const stub = new StubFs();
    stub.storage.set('/x/out', '');  // exists() returns true
    stub.dirEntries.set('/x/out', ['a.generated.ts', 'b.generated.ts']);
    stub.throwOn.set('stat:0', new Error('EACCES'));
    const result = await scanExistingGeneratedFiles('/x/out', stub);
    // Only 'b' was statted successfully; both end with `.generated.ts`, but
    // `a` was skipped due to stat failure. Default stat returns isDirectory=false
    // so 'b' is included.
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('b.generated.ts');
  }
}

@FeatureTest(VirtualFsIsolationFeature)
class CreateVirtFsExistsFalseCovered {
  @Verifies<VirtualFsIsolationFeature>('projectIsConstructedWithUseInMemoryFileSystem')
  async fileFromTsconfigButNotOnDiskIsSkipped() {
    // tsconfig include lists a file; createVirtFs queries fs.exists() — if
    // false (e.g. file deleted between glob and read), the file is skipped.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-stub-cv-'));
    fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler' },
      include: ['src/**/*.ts'],
    }));
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;');
    // Stub returns false for `exists` always → all files skipped.
    const stub = new StubFs();
    const handle = await createVirtFs({
      tsconfigPath: path.join(tmp, 'tsconfig.json'),
      consumerPackageRoot: tmp,
      outDir: path.join(tmp, 'generated'),
      fs: stub,
    });
    // Project ends up empty since no source file passed the exists check.
    expect(handle.project.getSourceFiles()).toHaveLength(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export { FileSystemStubTests, ScanStatFailureCovered, CreateVirtFsExistsFalseCovered };
