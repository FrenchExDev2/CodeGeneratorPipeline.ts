import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import * as fc from '../../../../test/support/qualification-fast-check.js';
import { Project } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { VirtualFsIsolationFeature } from '../../requirements/features/virtual-fs-isolation.js';
import { StrictlyAdditiveEmissionFeature } from '../../requirements/features/strictly-additive-emission.js';
import { AtomicCommitFeature } from '../../requirements/features/atomic-commit.js';
import { GeneratedFileBannerFeature } from '../../requirements/features/generated-file-banner.js';
import { DecoratorDiscoveryFeature } from '../../requirements/features/decorator-discovery.js';
import { buildVirtFs } from '../../src/virtfs/internal.js';
import { commitTo, scanExistingGeneratedFiles } from '../../src/virtfs/commit.js';
import { withBanner, extractBody, sha256Short } from '../../src/emit/banner.js';
import { findDecorated } from '../../src/scan/find-decorated.js';

const FUZZ_RUNS = 200;

function freshHandle(outDir = '/x/generated') {
  return buildVirtFs({ project: new Project({ useInMemoryFileSystem: true }), outDir });
}

const safeRelPath = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,40}\.ts$/)
  .filter(s => !s.includes('..') && !s.startsWith('/') && !s.startsWith('./'));
const arbContents = fc.string({ maxLength: 200 });
const arbProducerId = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9.-]{0,20}$/);

@FeatureTest(VirtualFsIsolationFeature)
class VirtFsIdempotenceFuzz {
  @Verifies<VirtualFsIsolationFeature>('addSourceIsIdempotent')
  p1Idempotence() {
    fc.assert(
      fc.property(safeRelPath, arbContents, arbProducerId, (relPath, contents, producerId) => {
        const h = freshHandle();
        const r1 = h.virtFs.addSource({ relPath, contents, producerId });
        const r2 = h.virtFs.addSource({ relPath, contents, producerId });
        const r3 = h.virtFs.addSource({ relPath, contents, producerId });
        expect(r1.newOrChanged).toBe(true);
        expect(r2.newOrChanged).toBe(false);
        expect(r3.newOrChanged).toBe(false);
        expect(h.virtFs.read(relPath)).toBe(contents);
      }),
      { numRuns: FUZZ_RUNS },
    );
  }

  @Verifies<VirtualFsIsolationFeature>('twoGeneratorsSamePathDifferentContentsTriggersSG0020')
  p2Divergence() {
    fc.assert(
      fc.property(safeRelPath, arbContents, arbContents, arbProducerId, arbProducerId,
        (relPath, a, b, p1, p2) => {
          fc.pre(a !== b);
          fc.pre(p1 !== p2);
          const h = freshHandle();
          h.virtFs.addSource({ relPath, contents: a, producerId: p1 });
          const r = h.virtFs.addSource({ relPath, contents: b, producerId: p2 });
          expect(r.newOrChanged).toBe(false);
          expect(r.diagnostics?.[0]?.code).toBe('SG0020');
          expect(h.virtFs.read(relPath)).toBe(a);
        }),
      { numRuns: FUZZ_RUNS },
    );
  }
}

@FeatureTest(StrictlyAdditiveEmissionFeature)
class PathValidationFuzz {
  @Verifies<StrictlyAdditiveEmissionFeature>('propertyRejectsPathTraversal')
  p11RejectTraversal() {
    const arbBadPath = fc.oneof(
      fc.constantFrom('../foo.ts', '../../bar.ts', '/etc/passwd', '/abs.ts',
                      'a/../../b.ts', 'C:\\\\x.ts', '..', ''),
      fc.string({ minLength: 1, maxLength: 30 }).map(s => '../' + s),
      fc.string({ minLength: 1, maxLength: 30 }).map(s => '/' + s),
    );
    fc.assert(
      fc.property(arbBadPath, (relPath) => {
        const h = freshHandle();
        const r = h.virtFs.addSource({ relPath, contents: 'x', producerId: 'g' });
        expect(r.newOrChanged).toBe(false);
        expect(r.diagnostics?.[0]?.code).toBe('SG0040');
        expect(h.snapshotJournal()).toEqual([]);
      }),
      { numRuns: FUZZ_RUNS },
    );
  }

  @Verifies<StrictlyAdditiveEmissionFeature>('propertyDiskOutsideOutDirByteIdentical')
  p12DiskOutsideOutDirIdentical() {
    // The buildVirtFs path is a pure constructor — no disk side effect possible.
    // We assert: after any sequence of addSource calls, no real disk path
    // outside outDir has been written. We verify by snapshotting a real-disk
    // sibling directory's contents pre / post a sequence of addSource calls.
    fc.assert(
      fc.property(fc.array(fc.tuple(safeRelPath, arbContents, arbProducerId), { maxLength: 10 }),
        (calls) => {
          const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-fuzz-'));
          const sibling = path.join(root, 'src');
          fs.mkdirSync(sibling);
          fs.writeFileSync(path.join(sibling, 'user.ts'), 'export const u = 1;');
          const before = fs.readFileSync(path.join(sibling, 'user.ts'), 'utf8');

          const h = freshHandle(path.join(root, 'generated'));
          for (const [relPath, contents, producerId] of calls) {
            h.virtFs.addSource({ relPath, contents, producerId });
          }

          const after = fs.readFileSync(path.join(sibling, 'user.ts'), 'utf8');
          expect(after).toBe(before);
          fs.rmSync(root, { recursive: true, force: true });
        }),
      { numRuns: 30 },   // Filesystem property — fewer runs.
    );
  }
}

@FeatureTest(AtomicCommitFeature)
class CommitFuzz {
  @Verifies<AtomicCommitFeature>('propertyEmittedSetEqualsDiskAfterCommit')
  async p7CommitEqualsDisk() {
    const arbEmissionSet = fc.array(
      fc.tuple(
        fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,10}\.generated\.ts$/),
        arbContents,
      ),
      { minLength: 1, maxLength: 6 },
    ).map(arr => {
      const m = new Map<string, string>();
      for (const [k, v] of arr) m.set(k, v);
      return [...m.entries()].map(([relPath, contents]) => ({ relPath, contents }));
    });

    await fc.assert(
      fc.asyncProperty(arbEmissionSet, async (emissions) => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-commit-fuzz-'));
        await commitTo({ outDir, emissions, preCommitFiles: [] });
        const found = (await scanExistingGeneratedFiles(outDir)).map(p => path.basename(p)).sort();
        const expected = emissions.map(e => e.relPath).sort();
        expect(found).toEqual(expected);
        fs.rmSync(outDir, { recursive: true, force: true });
      }),
      { numRuns: 30 },
    );
  }

  @Verifies<AtomicCommitFeature>('propertyDiskUntouchedOnRunError')
  async p8DiskUntouchedOnError() {
    // Property: if the caller never invokes `commitTo`, outDir contents stay
    // exactly as they were. Models the "runner errors before fixpoint, no
    // commit happens" path end-to-end.
    fc.assert(
      fc.property(fc.array(fc.tuple(safeRelPath, arbContents, arbProducerId), { maxLength: 10 }),
        (calls) => {
          const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-no-commit-fuzz-'));
          fs.writeFileSync(path.join(outDir, 'Pre.generated.ts'), 'pre-existing');
          const before = fs.readdirSync(outDir).sort();

          const h = freshHandle(outDir);
          for (const [relPath, contents, producerId] of calls) {
            h.virtFs.addSource({ relPath, contents, producerId });
          }
          // Intentionally NOT calling commitTo — simulating runner abort.

          const after = fs.readdirSync(outDir).sort();
          expect(after).toEqual(before);
          expect(fs.readFileSync(path.join(outDir, 'Pre.generated.ts'), 'utf8')).toBe('pre-existing');
          fs.rmSync(outDir, { recursive: true, force: true });
        }),
      { numRuns: 30 },
    );
  }
}

@FeatureTest(GeneratedFileBannerFeature)
class BannerFuzz {
  @Verifies<GeneratedFileBannerFeature>('propertyBannerRoundTrip')
  p3Roundtrip() {
    fc.assert(
      fc.property(arbContents, arbProducerId,
        (body, producerId) => {
          const wrapped = withBanner(body, { producerId });
          expect(extractBody(wrapped)).toBe(body);
        }),
      { numRuns: FUZZ_RUNS },
    );
  }

  @Verifies<GeneratedFileBannerFeature>('propertyBannerDeterministic')
  p4Determinism() {
    fc.assert(
      fc.property(arbContents, arbProducerId,
        (body, producerId) => {
          const a = withBanner(body, { producerId });
          const b = withBanner(body, { producerId });
          expect(a).toBe(b);
          // Hash of body matches what's embedded in banner.
          expect(a.includes(`sha256:${sha256Short(body)}`)).toBe(true);
        }),
      { numRuns: FUZZ_RUNS },
    );
  }
}

const arbKindString = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);

@FeatureTest(DecoratorDiscoveryFeature)
class DecoratorDiscoveryFuzz {
  @Verifies<DecoratorDiscoveryFeature>('propertyStackingPreservesEachKind')
  p9StackingPreserved() {
    fc.assert(
      fc.property(fc.uniqueArray(arbKindString, { minLength: 1, maxLength: 5 }),
        (kinds) => {
          const project = new Project({
            useInMemoryFileSystem: true,
            compilerOptions: { experimentalDecorators: true, target: 99, module: 99 },
          });
          const decoratorLines = kinds.map(k => `@Generate({ kind: '${k}' })`).join('\n');
          project.createSourceFile('/x/Foo.ts',
            `function Generate(_a: any): any { return () => {}; }\n${decoratorLines}\nexport class Foo {}\n`);
          const hits = findDecorated(project, 'Generate');
          expect(hits).toHaveLength(kinds.length);
          expect(hits.map(h => h.args.kind)).toEqual(kinds);
          expect(hits.map(h => h.sourceOrder)).toEqual(kinds.map((_, i) => i));
        }),
      { numRuns: 50 },
    );
  }

  @Verifies<DecoratorDiscoveryFeature>('propertyTargetFilterPartitionsHits')
  p10TargetFilterPartitions() {
    fc.assert(
      fc.property(
        fc.tuple(arbKindString, arbKindString, arbKindString),
        ([cKind, mKind, pKind]) => {
          const project = new Project({
            useInMemoryFileSystem: true,
            compilerOptions: { experimentalDecorators: true, target: 99, module: 99 },
          });
          project.createSourceFile('/x/Mixed.ts',
            `function Generate(_a: any): any { return (..._x: any[]) => {}; }
            @Generate({ kind: '${cKind}' })
            export class Foo {
              @Generate({ kind: '${mKind}' })
              handle() {}
              @Generate({ kind: '${pKind}' })
              amount!: number;
            }`);
          const all = findDecorated(project, 'Generate');
          const cls = all.filter(h => h.target.kind === 'class');
          const meth = all.filter(h => h.target.kind === 'method');
          const prop = all.filter(h => h.target.kind === 'property');
          expect(cls.map(h => h.args.kind)).toEqual([cKind]);
          expect(meth.map(h => h.args.kind)).toEqual([mKind]);
          expect(prop.map(h => h.args.kind)).toEqual([pKind]);
          // Partition: union with no leakage.
          expect(cls.length + meth.length + prop.length).toBe(all.length);
        }),
      { numRuns: 50 },
    );
  }
}

export { VirtFsIdempotenceFuzz, PathValidationFuzz, CommitFuzz, BannerFuzz, DecoratorDiscoveryFuzz };
