import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { resolve } from 'node:path';
import { PackageBarrelGenerator } from '../../src/generators/package-barrel.js';
import { buildVirtFs } from '../../src/virtfs/internal.js';
import { extractBody } from '../../src/emit/banner.js';
import { FixpointTerminationFeature } from '../../requirements/features/fixpoint-termination.js';
import type { GenerationContext } from '../../src/types.js';

function makeContext(opts: {
  files: Record<string, string>;
  consumerRoot?: string;
  outDir?: string;
}) {
  const consumerRoot = opts.consumerRoot ?? '/x';
  const outDir = opts.outDir ?? `${consumerRoot}/src`;
  const project = new Project({ useInMemoryFileSystem: true });
  for (const [p, c] of Object.entries(opts.files)) {
    project.createSourceFile(p, c);
  }
  const handle = buildVirtFs({ project, outDir });
  const ctx: GenerationContext = {
    project: handle.project,
    virtFs: handle.virtFs,
    consumerPackageRoot: consumerRoot,
    outDir,
    iteration: 0,
    delta: handle.buildDelta(0),
    logger: { info: () => {}, warn: () => {} },
  };
  return { ctx, handle };
}

@FeatureTest(FixpointTerminationFeature)
class PackageBarrelGeneratorTests {
  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async defaultsAndResourceFilesDoNotLeakIntoBarrels() {
    const root=resolve('test-results/barrel-boundary').replace(/\\/g,'/');
    const {ctx,handle}=makeContext({consumerRoot:root,files:{
      [`${root}/src/public.ts`]:'export const value=1;',
      [`${root}/src/types.d.ts`]:'declare const hidden:number;',
      [`${root}/src/old.generated.ts`]:'export const old=1;',
      [`${root}/outside.ts`]:'export const outside=1;',
    }});
    await new PackageBarrelGenerator().execute(ctx);
    expect(extractBody(handle.virtFs.read('index.generated.ts'))).toBe("export * from './public.js';\n");
    const diagnostics=[{severity:'error' as const,code:'VIRT',message:'rejected',producerId:'test'}];
    const rejected={...ctx,virtFs:{...ctx.virtFs,addSource:()=>({newOrChanged:false,diagnostics})}};
    expect((await new PackageBarrelGenerator({srcDir:root+'/src/'}).execute(rejected)).diagnostics).toEqual(diagnostics);
  }
  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async emitsAlphabeticalReExports() {
    const { ctx, handle } = makeContext({
      files: {
        '/x/src/foo.ts': 'export const foo = 1;',
        '/x/src/bar.ts': 'export const bar = 2;',
        '/x/src/zed.ts': 'export const zed = 3;',
      },
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src' });
    const r = await gen.execute(ctx);
    expect(r.emittedSomething).toBe(true);
    const emitted = handle.virtFs.read('index.generated.ts');
    const body = extractBody(emitted);
    expect(body).toBe(
      `export * from './bar.js';\n` +
      `export * from './foo.js';\n` +
      `export * from './zed.js';\n`,
    );
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async skipsIndexAndTestAndPrivate() {
    const { ctx, handle } = makeContext({
      files: {
        '/x/src/foo.ts': 'export const foo = 1;',
        '/x/src/index.ts': 'export const handcrafted = 1;',
        '/x/src/bar.test.ts': 'export const t = 1;',
        '/x/src/_private.ts': 'export const p = 1;',
      },
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src' });
    await gen.execute(ctx);
    const body = extractBody(handle.virtFs.read('index.generated.ts'));
    expect(body).toBe(`export * from './foo.js';\n`);
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async respectsExcludeList() {
    const { ctx, handle } = makeContext({
      files: {
        '/x/src/foo.ts': 'export const foo = 1;',
        '/x/src/bar.ts': 'export const bar = 1;',
      },
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src', exclude: ['bar'] });
    await gen.execute(ctx);
    const body = extractBody(handle.virtFs.read('index.generated.ts'));
    expect(body).toBe(`export * from './foo.js';\n`);
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async nonRecursiveByDefault() {
    const { ctx, handle } = makeContext({
      files: {
        '/x/src/foo.ts': 'export const foo = 1;',
        '/x/src/sub/bar.ts': 'export const bar = 1;',
      },
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src' });
    await gen.execute(ctx);
    const body = extractBody(handle.virtFs.read('index.generated.ts'));
    expect(body).toBe(`export * from './foo.js';\n`);
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async recursiveIncludesSubdirs() {
    const { ctx, handle } = makeContext({
      files: {
        '/x/src/foo.ts': 'export const foo = 1;',
        '/x/src/sub/bar.ts': 'export const bar = 1;',
      },
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src', recursive: true });
    await gen.execute(ctx);
    const body = extractBody(handle.virtFs.read('index.generated.ts'));
    expect(body).toBe(
      `export * from './foo.js';\n` +
      `export * from './sub/bar.js';\n`,
    );
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async emptySourceProducesNoOutput() {
    const { ctx, handle } = makeContext({
      files: { '/x/src/index.ts': 'export const x = 1;' }, // only index → skipped
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src' });
    const r = await gen.execute(ctx);
    expect(r.emittedSomething).toBe(false);
    expect(handle.virtFs.has('index.generated.ts')).toBe(false);
  }

  @Verifies<FixpointTerminationFeature>('twoConsecutiveRunsProduceIdenticalOutputs')
  async skipsPrivateSubdirs() {
    const { ctx, handle } = makeContext({
      files: {
        '/x/src/foo.ts': 'export const foo = 1;',
        '/x/src/_internal/secret.ts': 'export const secret = 1;',
      },
    });
    const gen = new PackageBarrelGenerator({ srcDir: '/x/src', recursive: true });
    await gen.execute(ctx);
    const body = extractBody(handle.virtFs.read('index.generated.ts'));
    expect(body).toBe(`export * from './foo.js';\n`);
  }
}

export { PackageBarrelGeneratorTests };
