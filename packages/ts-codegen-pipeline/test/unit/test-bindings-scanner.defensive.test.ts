import { expect } from 'vitest';
import * as ts from 'typescript';
import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { TestBindingsScannerFeature } from '../../requirements/features/test-bindings-scanner.js';
import { collectImports, collectClassHelpers, collectReferencedNames, collectDynamicImportTargets, hasTypeCheckOnlyDecorator, parseTestFile } from '../../src/scan/test-bindings-scanner.js';

@FeatureTest(TestBindingsScannerFeature)
class ScannerDefensiveSyntaxTests {
  @Verifies<TestBindingsScannerFeature>('resolvesDynamicImportsInDecoratedMethods')
  resolvesDynamicImportsInDecoratedMethods() {
    const parsed = parseTestFile(`
      @FeatureTest(F) class Tests {
        @Verifies<F>('loadsModule') async loads() { return await import('../../src/lazy.js'); }
      }`, '/consumer/test/unit/lazy.test.ts', '/consumer');
    expect(parsed.classes[0]!.methods).toEqual([{ methodName: 'loads', ac: 'loadsModule', targets: [{ file: 'src/lazy.ts', symbol: '*' }] }]);
  }

  @Verifies<TestBindingsScannerFeature>('rejectsUnsupportedComputedMethodBindings')
  rejectsUnsupportedComputedMethodBindings() {
    const parsed = parseTestFile(`
      @FeatureTest(F) class Tests {
        @Verifies<F>('computed') ['method']() { imported(); }
        ['helper']() { imported(); }
      }`, '/consumer/test/unit/computed.test.ts', '/consumer');
    expect(parsed.classes[0]!.methods).toEqual([]);
    const file = ts.createSourceFile('computed.ts', `class C { ['helper']() { imported(); } }`, ts.ScriptTarget.Latest, true);
    expect(collectClassHelpers(file.statements[0] as ts.ClassDeclaration).size).toBe(0);
  }

  @Verifies<TestBindingsScannerFeature>('handlesIncompleteSyntaxTreesWithoutInventingBindings')
  handlesIncompleteSyntaxTreesWithoutInventingBindings() {
    const file = ts.createSourceFile('incomplete.ts', '', ts.ScriptTarget.Latest, true);
    const malformed = ts.factory.createImportDeclaration(undefined,
      ts.factory.createImportClause(false, ts.factory.createIdentifier('value'), undefined),
      ts.factory.createIdentifier('notAString'), undefined);
    expect(collectImports(ts.factory.updateSourceFile(file, [malformed])).size).toBe(0);
    const abstractFile = ts.createSourceFile('abstract.ts', 'abstract class C { abstract method(): void; }', ts.ScriptTarget.Latest, true);
    const method = (abstractFile.statements[0] as ts.ClassDeclaration).members[0] as ts.MethodDeclaration;
    expect(collectDynamicImportTargets(method, '/consumer/test/a.ts', '/consumer', ['src/'])).toEqual([]);
    const bare = ts.createSourceFile('bare.ts', 'class C { @TypeCheckOnly method() {} }', ts.ScriptTarget.Latest, true);
    expect(hasTypeCheckOnlyDecorator((bare.statements[0] as ts.ClassDeclaration).members[0] as ts.MethodDeclaration)).toBe(false);
    const detached = ts.createSourceFile('detached.ts', 'class C { method() { imported(); } }', ts.ScriptTarget.Latest, false);
    expect(collectReferencedNames((detached.statements[0] as ts.ClassDeclaration).members[0] as ts.MethodDeclaration)).toEqual([]);
  }
}
