import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { makeInMemoryProject } from '../../../src/testing/make-in-memory-project.js';
import { runAnalyzer } from '../../../src/testing/run-analyzer.js';
import { assertAnalyzerContract } from '../../../src/testing/assert-contract.js';
import { analyzerMatchers } from '../../../src/testing/matchers.js';
import { AnalyzerTestkitFeature } from '../../../requirements/features/analyzer-testkit.js';
import type { Analyzer } from '../../../src/types.js';

@FeatureTest(AnalyzerTestkitFeature)
class TestkitTests {
  @Verifies<AnalyzerTestkitFeature>('makeInMemoryProjectResolvesProvidedPaths')
  resolvesPaths() {
    const p = makeInMemoryProject({ 'src/a.ts': 'export const x = 1;' });
    const sf = p.getSourceFile('/src/a.ts');
    expect(sf).toBeDefined();
    expect(sf?.getFullText()).toContain('export const x = 1;');
  }

  @Verifies<AnalyzerTestkitFeature>('makeInMemoryProjectDoesNotWriteDisk')
  noDiskWrite() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-noWrite-'));
    const before = fs.readdirSync(tmp);
    makeInMemoryProject({ 'a.ts': 'class A {}' });
    const after = fs.readdirSync(tmp);
    expect(after).toEqual(before);
    fs.rmdirSync(tmp);
  }

  @Verifies<AnalyzerTestkitFeature>('runAnalyzerSeesProvidedProject')
  seesProject() {
    const p = makeInMemoryProject({ 'a.ts': 'class A {}' });
    let captured: Project | undefined;
    const a: Analyzer = {
      id: 'capture',
      analyze: (ctx) => { captured = ctx.project; return []; },
    };
    return runAnalyzer(a, p).then(() => {
      expect(captured).toBe(p);
    });
  }

  @Verifies<AnalyzerTestkitFeature>('runAnalyzerOptsOverrideContext')
  optsOverride() {
    const p = makeInMemoryProject({});
    let outDir = '';
    let consumerRoot = '';
    const a: Analyzer = {
      id: 'capture',
      analyze: (ctx) => { outDir = ctx.outDir; consumerRoot = ctx.consumerPackageRoot; return []; },
    };
    return runAnalyzer(a, p, {
      outDir: '/custom-out',
      consumerPackageRoot: '/custom-root',
    }).then(() => {
      expect(outDir).toBe('/custom-out');
      expect(consumerRoot).toBe('/custom-root');
    });
  }

  @Verifies<AnalyzerTestkitFeature>('contractAcceptsConformingAnalyzer')
  async accepts() {
    const conforming: Analyzer = {
      id: 'conforming',
      analyze: () => [],
    };
    await expect(assertAnalyzerContract(conforming)).resolves.toBeUndefined();
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsNonDeterministic')
  async rejectsNonDeterministic() {
    let counter = 0;
    const flaky: Analyzer = {
      id: 'flaky',
      analyze: () => {
        counter++;
        return [{
          severity: 'info', code: 'X', message: `run ${counter}`, producerId: 'flaky',
        }];
      },
    };
    await expect(assertAnalyzerContract(flaky)).rejects.toThrow(/non-deterministic/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsVirtFsMutation')
  async rejectsVirtFsMutation() {
    const evil: Analyzer = {
      id: 'evil',
      analyze: (ctx) => {
        // Try to write through a cast — caught by Proxy.
        try {
          (ctx.virtFs as unknown as { addSource: (x: unknown) => void }).addSource({ relPath: 'x.ts', contents: '', producerId: 'evil' });
        } catch {
          /* expected — but the attempt was counted */
        }
        return [];
      },
    };
    await expect(assertAnalyzerContract(evil)).rejects.toThrow(/mutate virtFs/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsProjectMutation')
  async rejectsProjectMutation() {
    const evil: Analyzer = {
      id: 'evil-proj',
      analyze: (ctx) => {
        ctx.project.createSourceFile('/injected.ts', 'export const _ = 1;');
        return [];
      },
    };
    await expect(assertAnalyzerContract(evil)).rejects.toThrow(/mutated Project source/);
  }

  @Verifies<AnalyzerTestkitFeature>('matcherToHaveCodeWorks')
  matcher() {
    const r = analyzerMatchers.toHaveCode(
      [{ severity: 'error', code: 'AN0001', message: 'm', producerId: 'p' }],
      'AN0001',
    );
    expect(r.pass).toBe(true);
    const r2 = analyzerMatchers.toHaveCode([], 'AN0001');
    expect(r2.pass).toBe(false);
  }
}

export { TestkitTests };
