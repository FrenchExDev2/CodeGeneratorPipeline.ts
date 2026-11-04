import { expect, vi } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { AnalyzerBuiltinsFeature } from '../../../requirements/features/analyzer-builtins.js';
import { AnalyzerSuppressionFeature } from '../../../requirements/features/analyzer-suppression.js';
import { AnalyzerTestkitFeature } from '../../../requirements/features/analyzer-testkit.js';
import { DiagnosticHasCodeAnalyzer } from '../../../src/analyze/builtin/diagnostic-has-code.js';
import { GeneratorIdNonEmptyAnalyzer } from '../../../src/analyze/builtin/generator-id-non-empty.js';
import { GeneratorIdUniqueAnalyzer } from '../../../src/analyze/builtin/generator-id-unique.js';
import { makeSuppressionChecker } from '../../../src/analyze/suppression.js';
import { runAnalyzers } from '../../../src/analyze/run-analyzers.js';
import { runAnalyzer } from '../../../src/testing/run-analyzer.js';
import { assertAnalyzerContract } from '../../../src/testing/assert-contract.js';
import { makeInMemoryProject } from '../../../src/testing/make-in-memory-project.js';
import type { Diagnostic } from '../../../src/types.js';

@FeatureTest(AnalyzerBuiltinsFeature)
class AnalyzerBoundaryContracts {
  @Verifies<AnalyzerBuiltinsFeature>('an0100LiteralIdOk')
  async ignoresUnrelatedClassesMissingIdsAndExplicitSuppressions() {
    const project=makeInMemoryProject({'/src/a.ts':`
      interface Other {}
      class Plain implements Other { id='plain'; }
      class Missing implements SourceGenerator {}
      class Uninitialized implements SourceGenerator { id: string; }
      class Dynamic implements SourceGenerator { id=runtime; }
      class Empty implements SourceGenerator { id=''; }
    `});
    expect(await runAnalyzer(new GeneratorIdNonEmptyAnalyzer(),project,{isSuppressed:()=>true})).toEqual([]);
    expect(await runAnalyzer(new GeneratorIdUniqueAnalyzer(),project)).toEqual([]);
  }
  @Verifies<AnalyzerBuiltinsFeature>('an0110EmptyCodeError')
  async distinguishesDiagnosticShapesAndSuppressedLocations() {
    const project=makeInMemoryProject({'src/a.ts':`
      const unrelated={a:1};
      const valid={severity:'error',code:'OK',message:'m'};
      const missing={...rest,severity:'error',message:'m',producerId:'p'};
      const dynamic={severity:'error',code:runtime,message:'m'};
    `});
    const analyzer=new DiagnosticHasCodeAnalyzer();
    expect(await runAnalyzer(analyzer,project,{isSuppressed:()=>true})).toEqual([]);
    expect(await runAnalyzer(analyzer,project,{isSuppressed:()=>false})).toHaveLength(1);
    const literal=project.getSourceFiles()[0]!.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[1]!;
    const code=literal.getPropertyOrThrow('code').asKindOrThrow(SyntaxKind.PropertyAssignment);
    const spy=vi.spyOn(code,'getInitializer').mockReturnValue(undefined as never);
    try {expect(await runAnalyzer(analyzer,project,{isSuppressed:()=>false})).toHaveLength(1);}finally{spy.mockRestore();}
  }
}

@FeatureTest(AnalyzerSuppressionFeature)
class SuppressionBoundaryContracts {
  @Verifies<AnalyzerSuppressionFeature>('failSafeRunnerFilter')
  async wildcardOtherLineAndUnknownFileAreIndependent() {
    const project=makeInMemoryProject({'/src/a.ts':'// @sourcegen-disable-next-line\nconst x=1;\nconst y=2;'});
    const sf=project.getSourceFiles()[0]!;
    const checker=makeSuppressionChecker(project);
    expect(checker(sf.getVariableDeclarationOrThrow('y'),'X')).toBe(false);
    const diagnostics:Diagnostic[]=[
      {severity:'error',code:'X',message:'wildcard',producerId:'test',file:sf.getFilePath(),start:{line:2,column:1}},
      {severity:'error',code:'X',message:'next line',producerId:'test',file:sf.getFilePath(),start:{line:3,column:1}},
      {severity:'error',code:'X',message:'unknown',producerId:'test',file:'/absent.ts',start:{line:2,column:1}},
    ];
    const result=await runAnalyzers([{id:'test',analyze:()=>diagnostics}],{
      project,virtFs:{has:()=>false,read:()=>'',listEmitted:()=>[]},consumerPackageRoot:'/',outDir:'/generated',logger:{info:()=>{},warn:()=>{}},
    });
    expect(result.diagnostics.map(d=>d.message)).toEqual(['next line','unknown']);
  }
}

@FeatureTest(AnalyzerTestkitFeature)
class TestkitBoundaryContracts {
  @Verifies<AnalyzerTestkitFeature>('contractRejectsNonDeterministic')
  async changingDiagnosticCountIsRejected() {
    let calls=0;
    await expect(assertAnalyzerContract({id:'unstable',analyze:()=>++calls===1?[]:[{severity:'error',code:'X',message:'changed',producerId:'unstable'}]})).rejects.toThrow(/non-deterministic/);
  }
  @Verifies<AnalyzerTestkitFeature>('runAnalyzerOptsOverrideContext')
  async defaultContextPortsAreUsable() {
    const project=makeInMemoryProject({'/absolute.ts':'export const value=1;'});
    const result=await runAnalyzer({id:'ports',analyze(ctx){
      ctx.logger.info('info');ctx.logger.warn('warning');
      expect(ctx.virtFs.has('x')).toBe(false);
      expect(ctx.virtFs.listEmitted()).toEqual([]);
      expect(()=>ctx.virtFs.read('x')).toThrow('empty test virtFs');
      return [];
    }},project);
    expect(result).toEqual([]);
  }
}
void AnalyzerBoundaryContracts;void SuppressionBoundaryContracts;void TestkitBoundaryContracts;
