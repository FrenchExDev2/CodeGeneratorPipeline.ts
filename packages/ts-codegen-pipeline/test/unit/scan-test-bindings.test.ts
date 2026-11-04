import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanExistingBindings } from '../../src/scan/scan-test-bindings.js';
import { DecoratorDiscoveryFeature } from '../../requirements/features/decorator-discovery.js';
import type { FoundFeature } from '../../src/scan/find-features.js';

function fakeFeature(className: string, id: string, acNames: string[] = []): FoundFeature {
  return {
    className,
    id,
    acNames,
    satisfiesRefs: [],
    sourceFile: null as never,
    node: null as never,
  };
}

function mkRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tscp-stb-'));
}

@FeatureTest(DecoratorDiscoveryFeature)
class ScanExistingBindingsTests {
  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  async unrelatedFeatureBindingsAreIgnored() {
    const root=mkRoot();
    try {
      await fs.promises.mkdir(path.join(root,'test/unit'),{recursive:true});
      await fs.promises.mkdir(path.join(root,'src'),{recursive:true});
      await fs.promises.writeFile(path.join(root,'src/impl.ts'),'export const impl=()=>1;','utf8');
      await fs.promises.writeFile(path.join(root,'test/unit/other.test.ts'),"import {impl} from '../../src/impl.js';\n@FeatureTest(OtherFeature)\nclass OtherTests {@Verifies<OtherFeature>('ac1') verifies(){impl();}}",'utf8');
      const bindings=await scanExistingBindings({consumerPackageRoot:root,features:[fakeFeature('KnownFeature','KNOWN')]});
      expect(bindings.size).toBe(0);
    } finally {await fs.promises.rm(root,{recursive:true,force:true});}
  }
  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  async noFeaturesReturnsEmptyMap() {
    const root = mkRoot();
    const out = await scanExistingBindings({ consumerPackageRoot: root, features: [] });
    expect(out.size).toBe(0);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  async noTestDirReturnsEmptyMap() {
    const root = mkRoot();
    const features = [fakeFeature('FooFeature', 'FOO', ['ac1', 'ac2'])];
    const out = await scanExistingBindings({ consumerPackageRoot: root, features });
    // No test/ dir → no bindings → no entry for FooFeature.
    expect(out.has('FooFeature')).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  async detectsBindingFromTestFile() {
    const root = mkRoot();
    fs.mkdirSync(path.join(root, 'test', 'unit'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'foo.ts'), `export function someImpl() { return 1; }\n`);
    fs.writeFileSync(path.join(root, 'test', 'unit', 'foo.test.ts'), `
      import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
      import { someImpl } from '../../src/foo.js';
      class FooFeature {}
      @FeatureTest(FooFeature)
      class FooTests {
        @Verifies<any>('ac1')
        firstTest() { someImpl(); }
        @Verifies<any>('ac2')
        secondTest() { someImpl(); }
      }
    `);
    const features = [fakeFeature('FooFeature', 'FOO', ['ac1', 'ac2', 'ac3'])];
    const out = await scanExistingBindings({ consumerPackageRoot: root, features });
    expect(out.has('FooFeature')).toBe(true);
    expect(out.get('FooFeature')).toEqual(new Set(['ac1', 'ac2']));
    fs.rmSync(root, { recursive: true, force: true });
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  async featureNotInBindingsAbsent() {
    const root = mkRoot();
    fs.mkdirSync(path.join(root, 'test'), { recursive: true });
    fs.writeFileSync(path.join(root, 'test', 'empty.test.ts'), `// nothing here\n`);
    const features = [fakeFeature('UnusedFeature', 'UNUSED', ['ac1'])];
    const out = await scanExistingBindings({ consumerPackageRoot: root, features });
    expect(out.has('UnusedFeature')).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export { ScanExistingBindingsTests };
