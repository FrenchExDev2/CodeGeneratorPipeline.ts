import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { makeSuppressionChecker, parseDirectives } from '../../../src/analyze/suppression.js';
import { AnalyzerSuppressionFeature } from '../../../requirements/features/analyzer-suppression.js';

function project(files: Record<string, string>): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  for (const [k, v] of Object.entries(files)) p.createSourceFile(k.startsWith('/') ? k : `/${k}`, v);
  return p;
}

@FeatureTest(AnalyzerSuppressionFeature)
class SuppressionTests {
  @Verifies<AnalyzerSuppressionFeature>('singleCodeNextLineSuppression')
  singleCode() {
    const p = project({ 'a.ts': '// @sourcegen-disable-next-line AN0001\nclass A {}\n' });
    const cls = p.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const isSup = makeSuppressionChecker(p);
    expect(isSup(cls, 'AN0001')).toBe(true);
  }

  @Verifies<AnalyzerSuppressionFeature>('otherCodesNotAffected')
  otherCodes() {
    const p = project({ 'a.ts': '// @sourcegen-disable-next-line AN0001\nclass A {}\n' });
    const cls = p.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const isSup = makeSuppressionChecker(p);
    expect(isSup(cls, 'AN0002')).toBe(false);
  }

  @Verifies<AnalyzerSuppressionFeature>('multiCodeCommaSeparated')
  multi() {
    const p = project({ 'a.ts': '// @sourcegen-disable-next-line AN0001,AN0002\nclass A {}\n' });
    const cls = p.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const isSup = makeSuppressionChecker(p);
    expect(isSup(cls, 'AN0001')).toBe(true);
    expect(isSup(cls, 'AN0002')).toBe(true);
    expect(isSup(cls, 'AN0003')).toBe(false);
  }

  @Verifies<AnalyzerSuppressionFeature>('whitespaceAroundCodesTolerated')
  whitespace() {
    const p = project({ 'a.ts': '// @sourcegen-disable-next-line   AN0001 ,  AN0002  \nclass A {}\n' });
    const cls = p.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const isSup = makeSuppressionChecker(p);
    expect(isSup(cls, 'AN0001')).toBe(true);
    expect(isSup(cls, 'AN0002')).toBe(true);
  }

  @Verifies<AnalyzerSuppressionFeature>('emptyCodeSuppressesAll')
  emptyCode() {
    const p = project({ 'a.ts': '// @sourcegen-disable-next-line\nclass A {}\n' });
    const cls = p.getSourceFileOrThrow('/a.ts').getClassOrThrow('A');
    const isSup = makeSuppressionChecker(p);
    expect(isSup(cls, 'AN0001')).toBe(true);
    expect(isSup(cls, 'SG0010')).toBe(true);
    expect(isSup(cls, 'WHATEVER')).toBe(true);
  }

  @Verifies<AnalyzerSuppressionFeature>('failSafeRunnerFilter')
  failSafe() {
    // parseDirectives returns the entry that the runner-level filter uses.
    const entries = parseDirectives('/a.ts',
      '// @sourcegen-disable-next-line AN0001\nclass A {}\n');
    expect(entries.length).toBe(1);
    expect(entries[0]?.nextLine).toBe(2);
    expect(entries[0]?.codes).toEqual(['AN0001']);
  }

  @Verifies<AnalyzerSuppressionFeature>('failSafeRunnerFilter')
  trailingDirectiveYieldsNoEntry() {
    // Directive on the final line with nothing after → findNextNonEmptyLine returns -1.
    const entries = parseDirectives('/a.ts', '// @sourcegen-disable-next-line AN0001\n');
    expect(entries.length).toBe(0);
  }
}

export { SuppressionTests };
