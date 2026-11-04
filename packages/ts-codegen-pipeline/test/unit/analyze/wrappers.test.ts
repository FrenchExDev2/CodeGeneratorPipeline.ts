import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { withSeverity, withId, only } from '../../../src/analyze/wrappers.js';
import { runAnalyzer } from '../../../src/testing/run-analyzer.js';
import { AnalyzerWrappersFeature } from '../../../requirements/features/analyzer-wrappers.js';
import type { Analyzer, Diagnostic } from '../../../src/types.js';

function fakeAnalyzer(id: string, diags: Diagnostic[]): Analyzer {
  return {
    id,
    description: 'test',
    analyze: () => diags,
  };
}

function emptyProject(): Project {
  return new Project({ useInMemoryFileSystem: true });
}

@FeatureTest(AnalyzerWrappersFeature)
class WrappersTests {
  @Verifies<AnalyzerWrappersFeature>('withSeverityRemapsAllSeverities')
  remapsAll() {
    const a = fakeAnalyzer('a:1', [
      { severity: 'error', code: 'X1', message: 'm', producerId: 'a:1' },
      { severity: 'warning', code: 'X2', message: 'm', producerId: 'a:1' },
      { severity: 'info', code: 'X3', message: 'm', producerId: 'a:1' },
    ]);
    return runAnalyzer(withSeverity(a, 'warning'), emptyProject()).then(diags => {
      expect(diags.every(d => d.severity === 'warning')).toBe(true);
      expect(diags.length).toBe(3);
    });
  }

  @Verifies<AnalyzerWrappersFeature>('withSeverityPreservesIdentityFields')
  preservesIdentity() {
    const a = fakeAnalyzer('a:1', [
      { severity: 'error', code: 'X1', message: 'm', producerId: 'a:1' },
    ]);
    const w = withSeverity(a, 'info');
    expect(w.id).toBe('a:1');
    return runAnalyzer(w, emptyProject()).then(diags => {
      expect(diags[0]?.code).toBe('X1');
      expect(diags[0]?.producerId).toBe('a:1');
    });
  }

  @Verifies<AnalyzerWrappersFeature>('withIdOverridesExposedId')
  overridesId() {
    const a = fakeAnalyzer('a:1', []);
    expect(withId(a, 'b:2').id).toBe('b:2');
  }

  @Verifies<AnalyzerWrappersFeature>('withIdPropagatesToProducerId')
  propagates() {
    const a = fakeAnalyzer('a:1', [
      { severity: 'error', code: 'X1', message: 'm', producerId: 'a:1' },
    ]);
    return runAnalyzer(withId(a, 'b:2'), emptyProject()).then(diags => {
      expect(diags[0]?.producerId).toBe('b:2');
    });
  }

  @Verifies<AnalyzerWrappersFeature>('onlyKeepsListedCodes')
  onlyKeeps() {
    const a = fakeAnalyzer('a:1', [
      { severity: 'error', code: 'X1', message: 'm', producerId: 'a:1' },
      { severity: 'error', code: 'X2', message: 'm', producerId: 'a:1' },
    ]);
    return runAnalyzer(only(a, ['X1']), emptyProject()).then(diags => {
      expect(diags.length).toBe(1);
      expect(diags[0]?.code).toBe('X1');
    });
  }

  @Verifies<AnalyzerWrappersFeature>('onlyFiltersOutOtherCodes')
  onlyFilters() {
    const a = fakeAnalyzer('a:1', [
      { severity: 'error', code: 'X1', message: 'm', producerId: 'a:1' },
      { severity: 'error', code: 'X2', message: 'm', producerId: 'a:1' },
    ]);
    return runAnalyzer(only(a, ['UNKNOWN']), emptyProject()).then(diags => {
      expect(diags.length).toBe(0);
    });
  }
}

export { WrappersTests };
