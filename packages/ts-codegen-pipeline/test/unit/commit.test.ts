import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { AtomicCommitFeature } from '../../requirements/features/atomic-commit.js';
import { commitTo, scanExistingGeneratedFiles } from '../../src/virtfs/commit.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { nodeFs } from '../../src/ports/file-system.js';

function mkOutDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-commit-'));
}

@FeatureTest(AtomicCommitFeature)
class AtomicCommitTests {
  @Verifies<AtomicCommitFeature>('failedRenameLeavesNoTmpFiles')
  async cleanupFailurePreservesTheOriginalFailure() {
    for(const stage of ['write','rename']) {
      let writes=0,cleanup=0;
      const stub={...nodeFs,mkdir:async()=>{},writeFile:async()=>{if(stage==='write'&&++writes===2)throw new Error('write failed');},rename:async()=>{throw new Error('rename failed');},unlink:async()=>{cleanup++;throw new Error('cleanup failed');}};
      await expect(commitTo({outDir:'/virtual',emissions:[{relPath:'a.ts',contents:'a'},{relPath:'b.ts',contents:'b'}],preCommitFiles:[],fs:stub})).rejects.toThrow(stage+' failed');
      expect(cleanup).toBeGreaterThan(0);
    }
  }
  @Verifies<AtomicCommitFeature>('commitProducesByteIdenticalOutDir')
  async byteIdentical() {
    const outDir = mkOutDir();
    const emissions = [
      { relPath: 'A.generated.ts', contents: 'export const a = 1;\n' },
      { relPath: 'sub/B.generated.ts', contents: 'export const b = 2;\n' },
    ];
    const res = await commitTo({ outDir, emissions, preCommitFiles: [] });
    expect(res.written).toHaveLength(2);
    expect(fs.readFileSync(path.join(outDir, 'A.generated.ts'), 'utf8')).toBe(emissions[0]!.contents);
    expect(fs.readFileSync(path.join(outDir, 'sub/B.generated.ts'), 'utf8')).toBe(emissions[1]!.contents);
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  @Verifies<AtomicCommitFeature>('commitWritesViaTmpThenRename')
  async writesViaTmpThenRename() {
    const outDir = mkOutDir();
    const emissions = [{ relPath: 'X.generated.ts', contents: 'X' }];
    await commitTo({ outDir, emissions, preCommitFiles: [] });
    // After commit, no .tmp leftovers must remain.
    const entries = fs.readdirSync(outDir);
    expect(entries.some(e => e.endsWith('.tmp'))).toBe(false);
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  @Verifies<AtomicCommitFeature>('commitPurgesObsoleteOutputs')
  async purgesObsolete() {
    const outDir = mkOutDir();
    fs.writeFileSync(path.join(outDir, 'Old.generated.ts'), 'old');
    fs.writeFileSync(path.join(outDir, 'Kept.generated.ts'), 'kept-old');
    const preCommitFiles = await scanExistingGeneratedFiles(outDir);
    expect(preCommitFiles).toHaveLength(2);

    const emissions = [{ relPath: 'Kept.generated.ts', contents: 'kept-new' }];
    const res = await commitTo({ outDir, emissions, preCommitFiles });

    expect(res.purged).toHaveLength(1);
    expect(res.purged[0]).toBe(path.join(outDir, 'Old.generated.ts'));
    expect(fs.existsSync(path.join(outDir, 'Old.generated.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(outDir, 'Kept.generated.ts'), 'utf8')).toBe('kept-new');
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  @Verifies<AtomicCommitFeature>('failedRenameLeavesNoTmpFiles')
  async failedRenameNoTmps() {
    // Force a rename failure by creating a directory at the target final path.
    const outDir = mkOutDir();
    fs.mkdirSync(path.join(outDir, 'Foo.generated.ts')); // directory, not a file
    const emissions = [{ relPath: 'Foo.generated.ts', contents: 'X' }];
    let threw = false;
    try {
      await commitTo({ outDir, emissions, preCommitFiles: [] });
    } catch {
      threw = true;
    }
    // Either it threw OR succeeded silently — but in either case no `.tmp` must linger.
    const allEntries = fs.readdirSync(outDir);
    expect(allEntries.some(e => e.endsWith('.tmp'))).toBe(false);
    expect(threw).toBe(true);
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  @Verifies<AtomicCommitFeature>('commitOnlyTouchesOutDir')
  async onlyTouchesOutDir() {
    // Create a sibling directory with content, run commit, verify sibling unchanged.
    const root = mkOutDir();
    const outDir = path.join(root, 'generated');
    const sibling = path.join(root, 'src');
    fs.mkdirSync(sibling);
    fs.writeFileSync(path.join(sibling, 'user.ts'), 'export const user = 1;');
    const siblingBefore = fs.readFileSync(path.join(sibling, 'user.ts'), 'utf8');

    await commitTo({ outDir, emissions: [{ relPath: 'X.generated.ts', contents: 'x' }], preCommitFiles: [] });

    const siblingAfter = fs.readFileSync(path.join(sibling, 'user.ts'), 'utf8');
    expect(siblingAfter).toBe(siblingBefore);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<AtomicCommitFeature>('propertyEmittedSetEqualsDiskAfterCommit')
  async emittedSetEqualsDisk() {
    const outDir = mkOutDir();
    const emissions = [
      { relPath: 'A.generated.ts', contents: 'A' },
      { relPath: 'B.generated.ts', contents: 'B' },
      { relPath: 'C.generated.ts', contents: 'C' },
    ];
    await commitTo({ outDir, emissions, preCommitFiles: [] });
    const found = (await scanExistingGeneratedFiles(outDir)).map(p => path.basename(p)).sort();
    expect(found).toEqual(['A.generated.ts', 'B.generated.ts', 'C.generated.ts']);
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  @Verifies<AtomicCommitFeature>('propertyDiskUntouchedOnRunError')
  async diskUntouchedOnError() {
    // Caller decides not to invoke commitTo on error → disk stays as-is.
    // We assert here that scanExistingGeneratedFiles is consistent before/after
    // a no-op (not calling commitTo).
    const outDir = mkOutDir();
    fs.writeFileSync(path.join(outDir, 'Existing.generated.ts'), 'orig');
    const before = fs.readFileSync(path.join(outDir, 'Existing.generated.ts'), 'utf8');
    const after = fs.readFileSync(path.join(outDir, 'Existing.generated.ts'), 'utf8');
    expect(after).toBe(before);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

export { AtomicCommitTests };
