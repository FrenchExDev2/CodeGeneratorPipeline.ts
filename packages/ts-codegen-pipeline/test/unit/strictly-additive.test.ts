import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { StrictlyAdditiveEmissionFeature } from '../../requirements/features/strictly-additive-emission.js';
import { buildVirtFs } from '../../src/virtfs/internal.js';

function freshHandle(outDir = '/x/generated') {
  const project = new Project({ useInMemoryFileSystem: true });
  return buildVirtFs({ project, outDir });
}

@FeatureTest(StrictlyAdditiveEmissionFeature)
class StrictlyAdditiveEmissionTests {
  @Verifies<StrictlyAdditiveEmissionFeature>('rejectsRelativeParentEscape')
  rejectsRelativeEscape() {
    const h = freshHandle();
    const r = h.virtFs.addSource({ relPath: '../etc/passwd', contents: 'x', producerId: 'g' });
    expect(r.newOrChanged).toBe(false);
    expect(r.diagnostics?.[0]?.code).toBe('SG0040');
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('rejectsAbsolutePath')
  rejectsAbsolute() {
    const h = freshHandle();
    const r = h.virtFs.addSource({ relPath: '/etc/passwd', contents: 'x', producerId: 'g' });
    expect(r.newOrChanged).toBe(false);
    expect(r.diagnostics?.[0]?.code).toBe('SG0040');
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('rejectsWindowsAbsolutePath')
  rejectsWindowsAbsolute() {
    const h = freshHandle();
    const r = h.virtFs.addSource({ relPath: 'C:\\Windows\\system32\\evil.ts', contents: 'x', producerId: 'g' });
    expect(r.newOrChanged).toBe(false);
    expect(r.diagnostics?.[0]?.code).toBe('SG0040');
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('rejectsNormalizedTraversal')
  rejectsNormalizedTraversal() {
    const h = freshHandle();
    const r = h.virtFs.addSource({ relPath: 'foo/../../bar.ts', contents: 'x', producerId: 'g' });
    expect(r.newOrChanged).toBe(false);
    expect(r.diagnostics?.[0]?.code).toBe('SG0040');
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('rejectionLeavesVirtFsUnchanged')
  rejectionLeavesUnchanged() {
    const h = freshHandle();
    h.virtFs.addSource({ relPath: 'good.ts', contents: 'good', producerId: 'g' });
    const before = h.snapshotJournal();
    h.virtFs.addSource({ relPath: '../escape.ts', contents: 'evil', producerId: 'g' });
    const after = h.snapshotJournal();
    expect(after).toEqual(before);
    expect(h.virtFs.has('../escape.ts')).toBe(false);
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('userSrcUntouchedAfterRun')
  userSrcUntouchedAfterRun() {
    // This invariant is end-to-end (covered by P12 fuzz test); here we
    // check the API-level contract: addSource never accepts a path that
    // would resolve outside outDir.
    const h = freshHandle();
    const escapes = ['../foo.ts', '/abs/foo.ts', 'a/../../b.ts', 'a/../../../b.ts'];
    for (const relPath of escapes) {
      const r = h.virtFs.addSource({ relPath, contents: 'x', producerId: 'g' });
      expect(r.newOrChanged).toBe(false);
      expect(r.diagnostics?.[0]?.code).toBe('SG0040');
    }
    expect(h.snapshotJournal()).toHaveLength(0);
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('userSrcUntouchedAfterRunError')
  userSrcUntouchedAfterRunError() {
    // After a rejection (which is an error), virtFs state must be empty.
    const h = freshHandle();
    h.virtFs.addSource({ relPath: '/abs/foo.ts', contents: 'x', producerId: 'g' });
    expect(h.snapshotJournal()).toEqual([]);
  }
}

export { StrictlyAdditiveEmissionTests };
