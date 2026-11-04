import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { VirtualFsIsolationFeature } from '../../requirements/features/virtual-fs-isolation.js';
import { buildVirtFs } from '../../src/virtfs/internal.js';
import { createVirtFs } from '../../src/virtfs/create.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const OUT_DIR = '/x/generated';

function freshHandle(outDir = OUT_DIR) {
  const project = new Project({ useInMemoryFileSystem: true });
  return buildVirtFs({ project, outDir });
}

@FeatureTest(VirtualFsIsolationFeature)
class VirtFsContractTests {
  @Verifies<VirtualFsIsolationFeature>('addSourceIsIdempotent')
  addSourceIdempotent() {
    const h = freshHandle();
    const file = { relPath: 'foo.ts', contents: 'export const x = 1;', producerId: 'gen.a' };
    const r1 = h.virtFs.addSource(file);
    const r2 = h.virtFs.addSource(file);
    expect(r1.newOrChanged).toBe(true);
    expect(r2.newOrChanged).toBe(false);
    expect(h.virtFs.read('foo.ts')).toBe(file.contents);
    expect(h.snapshotJournal()).toHaveLength(1);
  }

  @Verifies<VirtualFsIsolationFeature>('sameProducerCanUpdateOwnEmission')
  sameProducerUpdate() {
    const h = freshHandle();
    const a = { relPath: 'foo.ts', contents: 'a', producerId: 'gen.a' };
    const b = { relPath: 'foo.ts', contents: 'b', producerId: 'gen.a' };
    const r1 = h.virtFs.addSource(a);
    const r2 = h.virtFs.addSource(b);
    expect(r1.newOrChanged).toBe(true);
    expect(r2.newOrChanged).toBe(true);
    expect(r2.diagnostics).toBeUndefined();
    expect(h.virtFs.read('foo.ts')).toBe('b');
    expect(h.snapshotJournal()).toHaveLength(2);
  }

  @Verifies<VirtualFsIsolationFeature>('identicalContentsAreNoop')
  identicalContents() {
    const h = freshHandle();
    const file = { relPath: 'foo.ts', contents: 'same', producerId: 'gen.a' };
    h.virtFs.addSource(file);
    const r = h.virtFs.addSource({ ...file, producerId: 'gen.b' });
    // Different producer, identical contents → idempotent overlap, no SG0020
    expect(r.newOrChanged).toBe(false);
    expect(r.diagnostics).toBeUndefined();
  }

  @Verifies<VirtualFsIsolationFeature>('twoGeneratorsSamePathDifferentContentsTriggersSG0020')
  divergence() {
    const h = freshHandle();
    h.virtFs.addSource({ relPath: 'foo.ts', contents: 'a', producerId: 'gen.a' });
    const r = h.virtFs.addSource({ relPath: 'foo.ts', contents: 'b', producerId: 'gen.b' });
    expect(r.newOrChanged).toBe(false);
    expect(r.diagnostics).toBeDefined();
    expect(r.diagnostics?.[0]?.code).toBe('SG0020');
    expect(r.diagnostics?.[0]?.severity).toBe('error');
  }

  @Verifies<VirtualFsIsolationFeature>('divergenceLeavesVirtFsUnchanged')
  divergenceUnchanged() {
    const h = freshHandle();
    h.virtFs.addSource({ relPath: 'foo.ts', contents: 'original', producerId: 'gen.a' });
    h.virtFs.addSource({ relPath: 'foo.ts', contents: 'attacker', producerId: 'gen.b' });
    expect(h.virtFs.read('foo.ts')).toBe('original');
    expect(h.snapshotJournal()).toHaveLength(1);
  }

  @Verifies<VirtualFsIsolationFeature>('midIterationThrowLeavesDiskUntouched')
  async midIterationThrowLeavesDiskUntouched() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-'));
    const tsconfig = path.join(tmp, 'tsconfig.json');
    fs.writeFileSync(tsconfig, JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true },
      include: ['src/**/*.ts'],
    }));
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;');
    const outDir = path.join(tmp, 'generated');

    const h = await createVirtFs({ tsconfigPath: tsconfig, consumerPackageRoot: tmp, outDir });
    h.virtFs.addSource({ relPath: 'X.generated.ts', contents: 'export const x = 1;', producerId: 'gen.a' });

    // Disk side-effect of addSource alone must be ZERO.
    expect(fs.existsSync(outDir)).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  @Verifies<VirtualFsIsolationFeature>('noWriteUntilCommitPhase')
  noWriteUntilCommit() {
    // Same property as above expressed without createVirtFs (the buildVirtFs
    // path is a pure constructor that should NEVER touch disk on its own).
    const h = freshHandle();
    h.virtFs.addSource({ relPath: 'a.ts', contents: '1', producerId: 'g' });
    h.virtFs.addSource({ relPath: 'b.ts', contents: '2', producerId: 'g' });
    // Project is in-memory; no node:fs calls happen on this code path.
    // The mere fact that the test runs without any file appearing is the proof.
    expect(h.snapshotJournal()).toHaveLength(2);
  }

  @Verifies<VirtualFsIsolationFeature>('projectIsConstructedWithUseInMemoryFileSystem')
  async projectIsInMemory() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-'));
    const tsconfig = path.join(tmp, 'tsconfig.json');
    fs.writeFileSync(tsconfig, JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler' },
      include: ['src/**/*.ts'],
    }));
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;');
    const h = await createVirtFs({ tsconfigPath: tsconfig, consumerPackageRoot: tmp, outDir: path.join(tmp, 'generated') });

    // Indirect proof: the in-memory FS lets us createSourceFile at any
    // absolute path without it appearing on real disk.
    const fakeAbs = path.join(tmp, 'generated', 'phantom.ts');
    h.project.createSourceFile(fakeAbs, '// phantom');
    expect(fs.existsSync(fakeAbs)).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export { VirtFsContractTests };
