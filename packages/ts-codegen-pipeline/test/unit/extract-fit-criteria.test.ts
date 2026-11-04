import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect, vi } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { extractFitCriteria } from '../../src/scan/extract-fit-criteria.js';
import { DecoratorDiscoveryFeature } from '../../requirements/features/decorator-discovery.js';

function reqClass(criteriaSrc: string) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { target: 99, module: 99, experimentalDecorators: true },
  });
  const sf = project.createSourceFile('/x/r.ts', `
    export abstract class ReqX {
      readonly id = 'REQ-X';
      readonly fitCriteria = ${criteriaSrc};
    }
  `);
  const cls = sf.getClassOrThrow('ReqX');
  return extractFitCriteria(cls);
}

@FeatureTest(DecoratorDiscoveryFeature)
class ExtractFitCriteriaTests {
  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  partialAstPropertyWithoutInitializerIsIgnored() {
    const project=new Project({useInMemoryFileSystem:true});
    const cls=project.createSourceFile('/partial.ts',"class R {fitCriteria=[{kind:'unit-test'}];}").getClassOrThrow('R');
    const element=cls.getPropertyOrThrow('fitCriteria').getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression).getElements()[0]!.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const assignment=element.getPropertyOrThrow('kind').asKindOrThrow(SyntaxKind.PropertyAssignment);
    const spy=vi.spyOn(assignment,'getInitializer').mockReturnValue(undefined);
    try{expect(extractFitCriteria(cls)).toEqual([]);}finally{spy.mockRestore();}
  }
  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  skipsDynamicEntriesSpreadsAndNonStringConstAssertions() {
    expect(reqClass(`[other, {...rest, method(){}, kind:123 as const, describes:false as const}, {kind:'unit-test',describes:123,binds:['valid',45 as const]}, {kind:runtime,describes:runtime}]`)).toEqual([{kind:'unit-test',binds:['valid']}]);
  }
  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  emptyCriteriaReturnsEmptyArray() {
    expect(reqClass('[]')).toEqual([]);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  unitTestCriterionWithBindsAndDescribes() {
    const out = reqClass(`[
      { kind: 'unit-test' as const,
        describes: 'first describes',
        binds: ['ac1', 'ac2'] }
    ]`);
    expect(out).toEqual([{ kind: 'unit-test', describes: 'first describes', binds: ['ac1', 'ac2'] }]);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  multipleMixedKindCriteria() {
    const out = reqClass(`[
      { kind: 'inspection' as const, checklist: ['x'], reviewers: ['m'] },
      { kind: 'unit-test' as const, describes: 'desc', binds: ['ac1'] },
      { kind: 'narrative' as const, text: 'note' }
    ]`);
    expect(out).toHaveLength(3);
    expect(out[0]?.kind).toBe('inspection');
    expect(out[1]?.kind).toBe('unit-test');
    expect(out[1]?.describes).toBe('desc');
    expect(out[1]?.binds).toEqual(['ac1']);
    expect(out[2]?.kind).toBe('narrative');
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  criterionMissingDescribes() {
    const out = reqClass(`[{ kind: 'unit-test' as const, binds: ['ac1'] }]`);
    expect(out).toEqual([{ kind: 'unit-test', binds: ['ac1'] }]);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  criterionWithoutKindIsSkipped() {
    const out = reqClass(`[{ describes: 'no-kind', binds: ['ac1'] }]`);
    expect(out).toEqual([]);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  classWithoutFitCriteriaReturnsEmpty() {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('/x/r.ts', `
      export abstract class ReqX { readonly id = 'X'; }
    `);
    expect(extractFitCriteria(sf.getClassOrThrow('ReqX'))).toEqual([]);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  fitCriteriaWithNonArrayInitializerIsSkipped() {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('/x/r.ts', `
      const externalArr: any[] = [];
      export abstract class ReqX {
        readonly id = 'X';
        readonly fitCriteria = externalArr;
      }
    `);
    expect(extractFitCriteria(sf.getClassOrThrow('ReqX'))).toEqual([]);
  }

  @Verifies<DecoratorDiscoveryFeature>('parsesObjectArgumentLiterally')
  bindsWithNonStringElementsAreSkipped() {
    const out = reqClass(`[{ kind: 'unit-test' as const, binds: ['ok', 42, identifier] }]`);
    expect(out).toEqual([{ kind: 'unit-test', binds: ['ok'] }]);
  }
}

export { ExtractFitCriteriaTests };
