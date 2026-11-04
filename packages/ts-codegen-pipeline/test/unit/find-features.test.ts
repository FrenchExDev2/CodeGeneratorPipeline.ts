import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { findFeatures } from '../../src/scan/find-features.js';
import { DecoratorDiscoveryFeature } from '../../requirements/features/decorator-discovery.js';

function projectWith(source: string, fileName = '/x/feature.ts'): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { target: 99, module: 99, experimentalDecorators: true },
  });
  project.createSourceFile(fileName, source);
  return project;
}

@FeatureTest(DecoratorDiscoveryFeature)
class FindFeaturesTests {
  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresAnonymousClassesAndNonIdentifierAcNames() {
    const project=projectWith(`
      export default class extends Feature { readonly id='ANONYMOUS'; }
      abstract class Named extends Feature {
        readonly title='before id'; readonly id='NAMED';
        abstract ['computed'](): unknown;
        abstract ordinary(): unknown;
      }
    `);
    expect(findFeatures(project).map(f=>({id:f.id,acs:f.acNames}))).toEqual([{id:'NAMED',acs:['ordinary']}]);
  }
  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  findsClassWithExtendsFeatureAndId() {
    const project = projectWith(`
      abstract class Feature { id!: string; title!: string; priority!: any; enabled!: boolean }
      type ACResult = unknown;
      export abstract class FooFeature extends Feature {
        readonly id = 'TSCP-FOO';
        readonly title = 'Foo';
        abstract first(): ACResult;
        abstract second(): ACResult;
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(1);
    expect(found[0]?.className).toBe('FooFeature');
    expect(found[0]?.id).toBe('TSCP-FOO');
    expect(found[0]?.acNames).toEqual(['first', 'second']);
    expect(found[0]?.satisfiesRefs).toEqual([]);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresClassWithoutExtendsFeature() {
    const project = projectWith(`
      abstract class NotFeature { id!: string }
      export abstract class FooFeature extends NotFeature {
        readonly id = 'TSCP-FOO';
        abstract first(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(0);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresFeatureClassWithoutId() {
    const project = projectWith(`
      abstract class Feature {}
      export abstract class FooFeature extends Feature {
        abstract first(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(0);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresFeatureClassWithNonStringIdInitializer() {
    const project = projectWith(`
      abstract class Feature {}
      export abstract class FooFeature extends Feature {
        readonly id = 42;
        abstract first(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(0);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresFeatureClassWithoutInitializerOnId() {
    const project = projectWith(`
      abstract class Feature {}
      export abstract class FooFeature extends Feature {
        readonly id!: string;
        abstract first(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(0);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  extractsSatisfiesIdentifierArgs() {
    const project = projectWith(`
      abstract class Feature {}
      function Satisfies(..._refs: any[]): any { return () => {}; }
      class ReqA {} class ReqB {}
      @Satisfies(ReqA, ReqB)
      export abstract class FooFeature extends Feature {
        readonly id = 'TSCP-FOO';
        abstract first(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(1);
    expect(found[0]?.satisfiesRefs).toEqual(['ReqA', 'ReqB']);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresNonIdentifierSatisfiesArgs() {
    const project = projectWith(`
      abstract class Feature {}
      function Satisfies(..._refs: any[]): any { return () => {}; }
      class ReqA {}
      @Satisfies(ReqA, 'not-a-class', 42)
      export abstract class FooFeature extends Feature {
        readonly id = 'TSCP-FOO';
        abstract first(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found[0]?.satisfiesRefs).toEqual(['ReqA']);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  zeroAcsIsAcceptedAndReturnsEmptyArray() {
    const project = projectWith(`
      abstract class Feature {}
      export abstract class EmptyFeature extends Feature {
        readonly id = 'TSCP-EMPTY';
      }
    `);
    const found = findFeatures(project);
    expect(found).toHaveLength(1);
    expect(found[0]?.acNames).toEqual([]);
  }

  @Verifies<DecoratorDiscoveryFeature>('findsDecoratorOnClassDeclaration')
  ignoresConcreteMethods() {
    const project = projectWith(`
      abstract class Feature {}
      export abstract class FooFeature extends Feature {
        readonly id = 'TSCP-FOO';
        abstract abstractOne(): unknown;
        concreteOne() { return 1; }
        abstract abstractTwo(): unknown;
      }
    `);
    const found = findFeatures(project);
    expect(found[0]?.acNames).toEqual(['abstractOne', 'abstractTwo']);
  }
}

export { FindFeaturesTests };
