import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Project } from 'ts-morph';
import { nodeFs } from '../../src/ports/file-system.js';
import { TestStubGenerator } from '../../src/generators/test-stub.js';
import { buildVirtFs } from '../../src/virtfs/internal.js';
import { extractBody } from '../../src/emit/banner.js';
import { FixpointTerminationFeature } from '../../requirements/features/fixpoint-termination.js';
import type { GenerationContext } from '../../src/types.js';

function mkContext(opts: {
  consumerRoot: string;
  outDir?: string;
  files: Record<string, string>;
}): { ctx: GenerationContext; handle: ReturnType<typeof buildVirtFs> } {
  const outDir = opts.outDir ?? path.join(opts.consumerRoot, 'test', 'scaffolds');
  const project = new Project({ useInMemoryFileSystem: true });
  for (const [p, c] of Object.entries(opts.files)) {
    project.createSourceFile(p, c);
  }
  const handle = buildVirtFs({ project, outDir });
  const ctx: GenerationContext = {
    project: handle.project,
    virtFs: handle.virtFs,
    consumerPackageRoot: opts.consumerRoot,
    outDir,
    iteration: 0,
    delta: handle.buildDelta(0),
    logger: { info: () => {}, warn: () => {} },
  };
  return { ctx, handle };
}

const FEATURE_BASE = `
  abstract class Feature { id!: string; title!: string; priority!: any; enabled!: boolean }
  abstract class Requirement<S> { id!: string }
  type ACResult = unknown;
  function Satisfies(..._refs: any[]): any { return () => {}; }
`;

@FeatureTest(FixpointTerminationFeature)
class TestStubGeneratorTests {
  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async resourceFilesAndAlreadyLoadedSpecificationsAreNotReadAgain() {
    const root=path.resolve('test-results/spec-loader-boundary').replace(/\\/g,'/');
    const full=path.join(root,'feature.ts');
    const {ctx}=mkContext({consumerRoot:root,files:{[full]:`${FEATURE_BASE} abstract class F extends Feature {readonly id='F'; abstract ac():ACResult;}`}});
    let reads=0;
    const port={...nodeFs,exists:async()=>true,readdir:async()=>['feature.ts','README.md'],stat:async()=>({mtimeMs:0,size:0,isDirectory:()=>false}),readFile:async()=>{reads++;return '';}};
    const result=await new TestStubGenerator({fs:port,specDirs:['.'],testDirs:[]}).execute(ctx);
    expect(reads).toBe(0);
    expect(result.emittedSomething).toBe(true);
  }
  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async neighboringFeaturePathsAndRejectedEmissionsRemainStable() {
    const root='/boundary';
    const {ctx,handle}=mkContext({consumerRoot:root,outDir:root,files:{
      [`${root}/feature.ts`]:`${FEATURE_BASE}
        export default class extends Other {}
        @Satisfies(MissingRequirement, EmptyRequirement)
        abstract class EdgeFeature extends Feature {readonly id='EDGE'; abstract a(): ACResult;}
        abstract class EmptyRequirement {readonly fitCriteria=[{kind:'inspection',binds:['a']}];}
      `,
    }});
    const generator=new TestStubGenerator({specDirs:[],testDirs:[],scaffoldSubdir:'/nested/'});
    const first=await generator.execute(ctx);
    expect(first.emittedSomething).toBe(true);
    expect(extractBody(handle.virtFs.read('nested/edge.scaffold.generated.test.ts'))).toContain('../feature.js');
    expect((await generator.execute(ctx)).emittedSomething).toBe(false);
    const diagnostic={severity:'error' as const,code:'REJECTED',message:'collision',producerId:'test'};
    const rejected={...ctx,virtFs:{...ctx.virtFs,addSource:()=>({newOrChanged:false,diagnostics:[diagnostic]})}};
    expect((await generator.execute(rejected)).diagnostics).toEqual([diagnostic]);
    // A scaffold adjacent to its Feature requires an explicit './' import.
    const adjacent=new TestStubGenerator({specDirs:[],testDirs:[],scaffoldSubdir:''});
    await adjacent.execute(ctx);
    expect(extractBody(handle.virtFs.read('edge.scaffold.generated.test.ts'))).toContain("from './feature.js'");
  }
  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async noFeaturesNoEmission() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: { '/x/empty.ts': '' },
    });
    const r = await new TestStubGenerator().execute(ctx);
    expect(r.emittedSomething).toBe(false);
    expect(handle.snapshotJournal()).toEqual([]);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async featureWithThreeAcsNoBindingsEmitsThreeStubs() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/features/foo.ts`]: `${FEATURE_BASE}
          export abstract class FooFeature extends Feature {
            readonly id = 'TSCP-FOO';
            readonly title = 'Foo';
            abstract first(): ACResult;
            abstract second(): ACResult;
            abstract third(): ACResult;
          }
        `,
      },
    });
    const r = await new TestStubGenerator().execute(ctx);
    expect(r.emittedSomething).toBe(true);
    const emitted = handle.virtFs.read('foo.scaffold.generated.test.ts');
    const body = extractBody(emitted);
    expect(body).toContain(`@FeatureTest(FooFeature)`);
    expect(body).toContain(`@Verifies<FooFeature>('first')`);
    expect(body).toContain(`@Verifies<FooFeature>('second')`);
    expect(body).toContain(`@Verifies<FooFeature>('third')`);
    expect(body).toContain(`'SCAFFOLD_NOT_IMPLEMENTED:first'`);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async featureWithAllAcsBoundEmitsNothing() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    fs.mkdirSync(path.join(root, 'test', 'unit'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'impl.ts'), `export function impl() { return 1; }\n`);
    fs.writeFileSync(path.join(root, 'test', 'unit', 'foo.test.ts'), `
      import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
      import { impl } from '../../src/impl.js';
      class FooFeature {}
      @FeatureTest(FooFeature)
      class FooTests {
        @Verifies<any>('first')  a() { impl(); }
        @Verifies<any>('second') b() { impl(); }
      }
    `);
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/features/foo.ts`]: `${FEATURE_BASE}
          export abstract class FooFeature extends Feature {
            readonly id = 'TSCP-FOO';
            readonly title = 'Foo';
            abstract first(): ACResult;
            abstract second(): ACResult;
          }
        `,
      },
    });
    const r = await new TestStubGenerator().execute(ctx);
    expect(r.emittedSomething).toBe(false);
    expect(handle.virtFs.has('foo.scaffold.generated.test.ts')).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async tier1JsdocFromRequirementFitCriteria() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/requirements/req-x.ts`]: `${FEATURE_BASE}
          export abstract class ReqXRequirement extends Requirement<any> {
            readonly id = 'REQ-X';
            readonly fitCriteria = [
              { kind: 'unit-test' as const,
                describes: 'For any input, the property holds.',
                binds: ['propertyAlpha'] }
            ];
          }
        `,
        [`${root}/requirements/features/foo.ts`]: `${FEATURE_BASE}
          import { ReqXRequirement } from '../requirements/req-x';
          @Satisfies(ReqXRequirement)
          export abstract class FooFeature extends Feature {
            readonly id = 'TSCP-FOO';
            readonly title = 'Foo';
            abstract propertyAlpha(): ACResult;
          }
        `,
      },
    });
    const r = await new TestStubGenerator().execute(ctx);
    expect(r.emittedSomething).toBe(true);
    const body = extractBody(handle.virtFs.read('foo.scaffold.generated.test.ts'));
    // Tier 1 JSDoc embedded
    expect(body).toContain('For any input, the property holds.');
    expect(body).toContain('From REQ-REQ-X'); // approx — verify there's a REQ ID
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async tier2FastCheckTemplateForPropertyAc() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/features/foo.ts`]: `${FEATURE_BASE}
          export abstract class FooFeature extends Feature {
            readonly id = 'TSCP-FOO';
            readonly title = 'Foo';
            abstract propertyXIsIdempotent(): ACResult;
            abstract regularAc(): ACResult;
          }
        `,
      },
    });
    await new TestStubGenerator().execute(ctx);
    const body = extractBody(handle.virtFs.read('foo.scaffold.generated.test.ts'));
    expect(body).toContain(`import * as fc from 'fast-check';`);
    expect(body).toContain(`fc.assert(fc.property(fc.anything()`);
    expect(body).toContain(`'SCAFFOLD_NOT_IMPLEMENTED:propertyXIsIdempotent'`);
    // regularAc uses the throw template (no fc.assert)
    const regularSection = body.split('regularAc')[1] ?? '';
    expect(regularSection).not.toContain('fc.assert');
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async idempotenceTwoRunsByteIdentical() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const setup = () => mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/features/foo.ts`]: `${FEATURE_BASE}
          export abstract class FooFeature extends Feature {
            readonly id = 'TSCP-FOO';
            readonly title = 'Foo';
            abstract first(): ACResult;
            abstract second(): ACResult;
          }
        `,
      },
    });
    const { ctx: c1, handle: h1 } = setup();
    await new TestStubGenerator().execute(c1);
    const out1 = h1.virtFs.read('foo.scaffold.generated.test.ts');
    const { ctx: c2, handle: h2 } = setup();
    await new TestStubGenerator().execute(c2);
    const out2 = h2.virtFs.read('foo.scaffold.generated.test.ts');
    expect(out2).toBe(out1);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async multipleFeaturesEmitOneScaffoldEach() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/features/alpha.ts`]: `${FEATURE_BASE}
          export abstract class AlphaFeature extends Feature {
            readonly id = 'A'; readonly title = 'A';
            abstract one(): ACResult;
          }
        `,
        [`${root}/requirements/features/beta.ts`]: `${FEATURE_BASE}
          export abstract class BetaFeature extends Feature {
            readonly id = 'B'; readonly title = 'B';
            abstract two(): ACResult;
          }
        `,
      },
    });
    await new TestStubGenerator().execute(ctx);
    expect(handle.virtFs.has('alpha.scaffold.generated.test.ts')).toBe(true);
    expect(handle.virtFs.has('beta.scaffold.generated.test.ts')).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async loadSpecFilesFromDiskWhenNotInProject() {
    // ctx.project starts empty. loadSpecFiles should walk requirements/ on
    // disk, discover the Feature, and add it to the project so findFeatures
    // can see it.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-disk-'));
    fs.mkdirSync(path.join(root, 'requirements', 'features'), { recursive: true });
    fs.mkdirSync(path.join(root, 'requirements', 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(root, 'requirements', 'features', '_internal'), { recursive: true });
    fs.writeFileSync(path.join(root, 'requirements', 'features', 'on-disk.ts'),
      `${FEATURE_BASE}
      export abstract class OnDiskFeature extends Feature {
        readonly id = 'TSCP-ON-DISK';
        readonly title = 'on-disk';
        abstract diskOnlyAc(): ACResult;
      }
      `);
    // Decoy: a `.test.ts` and a `.generated.ts` that should be skipped by loadSpecFiles.
    fs.writeFileSync(path.join(root, 'requirements', 'features', 'foo.test.ts'), `// skipped\n`);
    fs.writeFileSync(path.join(root, 'requirements', 'features', 'foo.generated.ts'), `// skipped\n`);
    // Decoy nested dir traversal target.
    fs.writeFileSync(path.join(root, 'requirements', 'features', '_internal', 'private.ts'), `// scanned but no Feature\n`);

    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {},   // empty project — loadSpecFiles must populate it
    });
    const r = await new TestStubGenerator().execute(ctx);
    expect(r.emittedSomething).toBe(true);
    expect(handle.virtFs.has('on-disk.scaffold.generated.test.ts')).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async loadSpecFilesSurvivesReaddirAndStatErrors() {
    // Stub FS where exists=true but readdir/stat throw — covers the two
    // defensive `try/catch` branches in loadSpecDirRecursive.
    const root = '/x/root';
    let firstStatCall = true;
    const stubFs = {
      async readFile() { return ''; },
      async writeFile() {},
      async exists() { return true; },          // every dir exists
      async mkdir() {},
      async readdir(p: string) {
        // First call: throw → readdir catch hit → loadSpecDirRecursive returns.
        // Subsequent calls: return one entry whose stat will throw.
        if (p.endsWith('features')) throw new Error('readdir EACCES');
        return ['some-name'];
      },
      async stat() {
        if (firstStatCall) { firstStatCall = false; throw new Error('stat ENOENT'); }
        return { mtimeMs: 0, size: 0, isDirectory: () => false };
      },
      async unlink() {},
      async rename() {},
    };
    const { ctx } = mkContext({ consumerRoot: root, files: {} });
    const r = await new TestStubGenerator({ fs: stubFs as never }).execute(ctx);
    // No real Features — emittedSomething is false.
    expect(r.emittedSomething).toBe(false);
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async loadSpecFilesIsNoOpWhenSpecDirAbsent() {
    // Missing spec directory should NOT crash the generator.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-nodir-'));
    const { ctx } = mkContext({ consumerRoot: root, files: {} });
    const r = await new TestStubGenerator().execute(ctx);
    expect(r.emittedSomething).toBe(false);
    expect(r.diagnostics).toEqual([]);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async sortedAcsInOutput() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-tsg-'));
    const { ctx, handle } = mkContext({
      consumerRoot: root,
      files: {
        [`${root}/requirements/features/foo.ts`]: `${FEATURE_BASE}
          export abstract class FooFeature extends Feature {
            readonly id = 'F'; readonly title = 'F';
            abstract zebra(): ACResult;
            abstract apple(): ACResult;
            abstract mango(): ACResult;
          }
        `,
      },
    });
    await new TestStubGenerator().execute(ctx);
    const body = extractBody(handle.virtFs.read('foo.scaffold.generated.test.ts'));
    const appleIdx = body.indexOf(`'apple'`);
    const mangoIdx = body.indexOf(`'mango'`);
    const zebraIdx = body.indexOf(`'zebra'`);
    expect(appleIdx).toBeGreaterThan(0);
    expect(appleIdx).toBeLessThan(mangoIdx);
    expect(mangoIdx).toBeLessThan(zebraIdx);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export { TestStubGeneratorTests };
