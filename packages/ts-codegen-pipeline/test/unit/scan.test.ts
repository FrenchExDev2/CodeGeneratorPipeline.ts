import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { DecoratorDiscoveryFeature } from '../../requirements/features/decorator-discovery.js';
import { findDecorated } from '../../src/scan/find-decorated.js';

function projectWith(source: string, fileName = '/x/src/Foo.ts'): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99 /* ES2022 */,
      module: 99 /* ESNext */,
      experimentalDecorators: true,
    },
  });
  project.createSourceFile(fileName, source);
  return project;
}

@FeatureTest(DecoratorDiscoveryFeature)
class DecoratorDiscoveryTests {
  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  findsOnClass() {
    const project = projectWith(`
      function Generate(_args: any): any { return () => {}; }
      @Generate({ kind: 'companion' })
      export class Foo { id!: string; }
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.target.kind).toBe('class');
    expect(hits[0]?.args.kind).toBe('companion');
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnMethodDeclaration')
  findsOnMethod() {
    const project = projectWith(`
      function Generate(_args: any): any { return (..._x: any[]) => {}; }
      export class Foo {
        @Generate({ kind: 'route' })
        handle() {}
      }
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.target.kind).toBe('method');
    if (hits[0]?.target.kind === 'method') {
      expect(hits[0].target.owner.getName()).toBe('Foo');
    }
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnPropertyDeclaration')
  findsOnProperty() {
    const project = projectWith(`
      function Generate(_args: any): any { return (..._x: any[]) => {}; }
      export class Foo {
        @Generate({ kind: 'validate' })
        amount!: number;
      }
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.target.kind).toBe('property');
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnAccessorDeclaration')
  findsOnAccessor() {
    const project = projectWith(`
      function Generate(_args: any): any { return (..._x: any[]) => {}; }
      export class Foo {
        @Generate({ kind: 'memo' })
        get total() { return 0; }
      }
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.target.kind).toBe('accessor');
  }

  @Verifies<DecoratorDiscoveryFeature>('ignoresParameterDecoratorInV1')
  ignoresParameter() {
    const project = projectWith(`
      function Generate(_args: any): any { return (..._x: any[]) => {}; }
      export class Foo {
        handle(@Generate({ kind: 'inject' }) svc: any) {}
      }
    `);
    const hits = findDecorated(project, 'Generate');
    // Parameter decorators are deliberately NOT discovered in v1.
    expect(hits.filter(h => h.target.kind === ('parameter' as never))).toHaveLength(0);
  }

  @Verifies<DecoratorDiscoveryFeature>('stackingReturnsAllHitsInSourceOrder')
  stackingPreservesOrder() {
    const project = projectWith(`
      function Generate(_args: any): any { return () => {}; }
      @Generate({ kind: 'companion' })
      @Generate({ kind: 'validator', strict: true })
      @Generate({ kind: 'serializer', format: 'json' })
      export class Order { id!: string; }
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(3);
    expect(hits.map(h => h.args.kind)).toEqual(['companion', 'validator', 'serializer']);
    expect(hits.map(h => h.sourceOrder)).toEqual([0, 1, 2]);
  }

  @Verifies<DecoratorDiscoveryFeature>('targetKindFilterHasNoLeakage')
  targetKindFilterIsClean() {
    const project = projectWith(`
      function Generate(_args: any): any { return (..._x: any[]) => {}; }
      @Generate({ kind: 'companion' })
      export class Foo {
        @Generate({ kind: 'route' })
        handle() {}
        @Generate({ kind: 'validate' })
        amount!: number;
      }
    `);
    const all = findDecorated(project, 'Generate');
    const classes = all.filter(h => h.target.kind === 'class');
    const methods = all.filter(h => h.target.kind === 'method');
    const props = all.filter(h => h.target.kind === 'property');
    expect(all).toHaveLength(3);
    expect(classes).toHaveLength(1);
    expect(methods).toHaveLength(1);
    expect(props).toHaveLength(1);
    expect(classes[0]?.args.kind).toBe('companion');
    expect(methods[0]?.args.kind).toBe('route');
    expect(props[0]?.args.kind).toBe('validate');
  }

  @Verifies<DecoratorDiscoveryFeature>('aliasedImportIsNotDiscovered')
  aliasedNotDiscovered() {
    const project = projectWith(`
      function Generate(_args: any): any { return () => {}; }
      const Gen = Generate;
      @Gen({ kind: 'companion' })
      export class Foo {}
    `);
    const hits = findDecorated(project, 'Generate');
    // @Gen is the identifier in source — looking for @Generate finds nothing.
    expect(hits).toHaveLength(0);
    const hitsForGen = findDecorated(project, 'Gen');
    expect(hitsForGen).toHaveLength(1);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  parsesObjectArg() {
    const project = projectWith(`
      function Generate(_args: any): any { return () => {}; }
      @Generate({ kind: 'companion', strict: true, count: 7, name: 'foo' })
      export class Foo {}
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.args).toEqual({ kind: 'companion', strict: true, count: 7, name: 'foo' });
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesStringAndNumberArguments')
  parsesPrimitiveArgs() {
    const project = projectWith(`
      function Generate(_args: any): any { return () => {}; }
      @Generate({ kind: 'a', n: -3, neg: false, nul: null })
      export class Foo {}
    `);
    const hits = findDecorated(project, 'Generate');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.args).toEqual({ kind: 'a', n: -3, neg: false, nul: null });
  }
}

export { DecoratorDiscoveryTests };
