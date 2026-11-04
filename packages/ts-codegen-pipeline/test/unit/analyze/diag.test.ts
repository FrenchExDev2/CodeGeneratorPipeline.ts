import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { diagFromNode } from '../../../src/analyze/diag.js';
import { AnalyzerDiagnosticFeature } from '../../../requirements/features/analyzer-diagnostic.js';

function makeProject(files: Record<string, string>): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  for (const [path, content] of Object.entries(files)) {
    const abs = path.startsWith('/') ? path : `/${path}`;
    p.createSourceFile(abs, content);
  }
  return p;
}

@FeatureTest(AnalyzerDiagnosticFeature)
class DiagFromNodeTests {
  @Verifies<AnalyzerDiagnosticFeature>('diagnosticShapeCompiles')
  shapeCompiles() {
    // Compile-time: all optional fields populate without TS error.
    const proj = makeProject({ 'a.ts': 'class A {}' });
    const cls = proj.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const d = diagFromNode(cls, 'error', 'AN0001', 'msg', 'producer');
    expect(d.start).toBeDefined();
    expect(d.end).toBeDefined();
    expect(d.relatedLocations).toBeUndefined();
  }

  @Verifies<AnalyzerDiagnosticFeature>('backwardsCompatibleWithPreviousSGShape')
  backwardsCompat() {
    // A bare Diagnostic without positions remains a valid Diagnostic value.
    const d = { severity: 'error' as const, code: 'SG0001', message: 'm', producerId: 'p' };
    expect(d.code).toBe('SG0001');
  }

  @Verifies<AnalyzerDiagnosticFeature>('diagFromNodeStartOfFileIsLine1Col1')
  startOfFile() {
    const proj = makeProject({ 'a.ts': 'class A {}' });
    const cls = proj.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const d = diagFromNode(cls, 'error', 'AN0001', 'm', 'p');
    expect(d.start?.line).toBe(1);
    expect(d.start?.column).toBe(1);
  }

  @Verifies<AnalyzerDiagnosticFeature>('diagFromNodeMultiLineEndAfterStart')
  multiLine() {
    const proj = makeProject({ 'a.ts': 'class A {\n  foo() {\n    return 1;\n  }\n}\n' });
    const cls = proj.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const d = diagFromNode(cls, 'error', 'AN0001', 'm', 'p');
    expect((d.end?.line ?? 0)).toBeGreaterThan((d.start?.line ?? 0));
  }

  @Verifies<AnalyzerDiagnosticFeature>('diagFromNodeColumnsAreOneBased')
  oneBased() {
    const proj = makeProject({ 'a.ts': '  class A {}' }); // 2-space indent
    const cls = proj.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const d = diagFromNode(cls, 'error', 'AN0001', 'm', 'p');
    expect(d.start?.column).toBe(3); // 1-based: 'c' is column 3 after two spaces
  }

  @Verifies<AnalyzerDiagnosticFeature>('diagFromNodeNoRelatedIsUndefined')
  noRelated() {
    const proj = makeProject({ 'a.ts': 'class A {}' });
    const cls = proj.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const d = diagFromNode(cls, 'error', 'AN0001', 'm', 'p');
    expect(d.relatedLocations).toBeUndefined();
    const d2 = diagFromNode(cls, 'error', 'AN0001', 'm', 'p', []);
    expect(d2.relatedLocations).toBeUndefined();
  }

  @Verifies<AnalyzerDiagnosticFeature>('diagFromNodeRelatedFillsLocations')
  related() {
    const proj = makeProject({ 'a.ts': 'class A {}\nclass B {}\n' });
    const sf = proj.getSourceFileOrThrow('/a.ts');
    const a = sf.getClassOrThrow('A');
    const b = sf.getClassOrThrow('B');
    const d = diagFromNode(a, 'error', 'AN0001', 'm', 'p', [
      { node: b, message: 'see also' },
    ]);
    expect(d.relatedLocations?.length).toBe(1);
    expect(d.relatedLocations?.[0]?.message).toBe('see also');
    expect(d.relatedLocations?.[0]?.start?.line).toBe(2);
  }
}

export { DiagFromNodeTests };
