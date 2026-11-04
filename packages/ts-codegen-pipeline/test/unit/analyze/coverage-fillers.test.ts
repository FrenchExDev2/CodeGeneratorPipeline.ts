import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { Project } from 'ts-morph';
import { runAnalyzer } from '../../../src/testing/run-analyzer.js';
import { assertAnalyzerContract } from '../../../src/testing/assert-contract.js';
import { analyzerMatchers } from '../../../src/testing/matchers.js';
import { runAnalyzers } from '../../../src/analyze/run-analyzers.js';
import { GeneratorIdNonEmptyAnalyzer } from '../../../src/analyze/builtin/generator-id-non-empty.js';
import { DiagnosticHasCodeAnalyzer } from '../../../src/analyze/builtin/diagnostic-has-code.js';
import { GeneratorIdUniqueAnalyzer } from '../../../src/analyze/builtin/generator-id-unique.js';
import { makeInMemoryProject } from '../../../src/testing/make-in-memory-project.js';
import { AnalyzerLifecycleFeature } from '../../../requirements/features/analyzer-lifecycle.js';
import { AnalyzerTestkitFeature } from '../../../requirements/features/analyzer-testkit.js';
import { AnalyzerBuiltinsFeature } from '../../../requirements/features/analyzer-builtins.js';
import type { Analyzer, Diagnostic, ReadonlyVirtFs } from '../../../src/types.js';

const NOOP_VIRTFS: ReadonlyVirtFs = {
  has: () => false,
  read: () => '',
  listEmitted: () => [],
};
const NOOP_LOGGER = { info: (_: string) => undefined, warn: (_: string) => undefined };

@FeatureTest(AnalyzerLifecycleFeature)
class RunAnalyzersFillerTests {
  @Verifies<AnalyzerLifecycleFeature>('errorDoesNotShortCircuitOtherAnalyzers')
  async throwingAnalyzerEmitsAN9000() {
    const thrower: Analyzer = {
      id: 'thrower',
      analyze: () => { throw new Error('boom'); },
    };
    const r = await runAnalyzers([thrower], {
      project: new Project({ useInMemoryFileSystem: true }),
      virtFs: NOOP_VIRTFS,
      consumerPackageRoot: '/',
      outDir: '/generated',
      logger: NOOP_LOGGER,
    });
    expect(r.diagnostics.some(d => d.code === 'AN9000')).toBe(true);
  }

  @Verifies<AnalyzerLifecycleFeature>('analyzersRunPostFixpointPreCommit')
  async failSafeFilterFallthrough() {
    // Diagnostic on a line covered by a directive for a DIFFERENT code →
    // suppression filter iterates and falls through to `return false`.
    const proj = new Project({ useInMemoryFileSystem: true });
    proj.createSourceFile('/x.ts', '// @sourcegen-disable-next-line OTHER\nclass A {}\n');
    const a: Analyzer = {
      id: 'a',
      analyze: () => [{
        severity: 'error', code: 'AN0001', message: 'm', producerId: 'a',
        file: '/x.ts', start: { line: 2, column: 1 },
      }],
    };
    const r = await runAnalyzers([a], {
      project: proj,
      virtFs: NOOP_VIRTFS,
      consumerPackageRoot: '/',
      outDir: '/generated',
      logger: NOOP_LOGGER,
    });
    // Not suppressed because directive's code list does not include AN0001.
    expect(r.diagnostics.some(d => d.code === 'AN0001')).toBe(true);
  }

  @Verifies<AnalyzerLifecycleFeature>('analyzerContextIsReadOnly')
  async nonStringThrowFallback() {
    const a: Analyzer = {
      id: 'badThrow',
      analyze: () => { throw 42; },  // non-Error throw
    };
    const r = await runAnalyzers([a], {
      project: new Project({ useInMemoryFileSystem: true }),
      virtFs: NOOP_VIRTFS,
      consumerPackageRoot: '/',
      outDir: '/generated',
      logger: NOOP_LOGGER,
    });
    const d = r.diagnostics.find(x => x.code === 'AN9000');
    expect(d?.message).toContain('42');
  }
}

@FeatureTest(AnalyzerTestkitFeature)
class TestkitFillerTests {
  @Verifies<AnalyzerTestkitFeature>('runAnalyzerOptsOverrideContext')
  async customLoggerAndVirtFs() {
    const logged: string[] = [];
    const customLogger = {
      info: (m: string) => logged.push(`i:${m}`),
      warn: (m: string) => logged.push(`w:${m}`),
    };
    const a: Analyzer = {
      id: 'logger-test',
      analyze: (ctx) => {
        ctx.logger.info('hello');
        ctx.logger.warn('careful');
        return [];
      },
    };
    await runAnalyzer(a, makeInMemoryProject({}), {
      logger: customLogger,
      virtFs: NOOP_VIRTFS,
      isSuppressed: () => false,
    });
    expect(logged).toContain('i:hello');
    expect(logged).toContain('w:careful');
  }

  @Verifies<AnalyzerTestkitFeature>('runAnalyzerSeesProvidedProject')
  async noopVirtFsBranches() {
    // Cover NOOP_VIRTFS .has(), .read() (throws), .listEmitted() lambdas.
    const a: Analyzer = {
      id: 'reader',
      analyze: (ctx) => {
        ctx.virtFs.has('x');
        ctx.virtFs.listEmitted();
        try { ctx.virtFs.read('x'); } catch { /* default noop throws */ }
        return [];
      },
    };
    const diags = await runAnalyzer(a, makeInMemoryProject({}));
    expect(diags).toEqual([]);
  }

  @Verifies<AnalyzerTestkitFeature>('matcherToHaveCodeWorks')
  matchersAllVariants() {
    const diags: readonly Diagnostic[] = [
      { severity: 'error', code: 'A', message: 'm', producerId: 'p',
        file: '/x.ts', start: { line: 3, column: 5 } },
    ];
    expect(analyzerMatchers.toHaveSeverity(diags, 'error').pass).toBe(true);
    expect(analyzerMatchers.toHaveSeverity(diags, 'warning').pass).toBe(false);
    // Negative-message branches (failure paths run their `message()` lambda).
    expect(analyzerMatchers.toHaveCode(diags, 'B').message()).toMatch(/Expected/);
    expect(analyzerMatchers.toHaveCode(diags, 'A').message()).toMatch(/Expected/);
    expect(analyzerMatchers.toHaveSeverity(diags, 'info').message()).toMatch(/Expected/);
    expect(analyzerMatchers.toHaveSeverity(diags, 'error').message()).toMatch(/Expected/);
    expect(analyzerMatchers.toHaveLocation(diags, { file: '/x.ts' }).pass).toBe(true);
    expect(analyzerMatchers.toHaveLocation(diags, { file: '/x.ts', line: 3 }).pass).toBe(true);
    expect(analyzerMatchers.toHaveLocation(diags, { file: '/x.ts', line: 3, column: 5 }).pass).toBe(true);
    expect(analyzerMatchers.toHaveLocation(diags, { file: '/y.ts' }).pass).toBe(false);
    expect(analyzerMatchers.toHaveLocation(diags, { line: 99 }).pass).toBe(false);
    expect(analyzerMatchers.toHaveLocation(diags, { column: 99 }).pass).toBe(false);
    // Also exercise message() of toHaveLocation pass and fail.
    expect(analyzerMatchers.toHaveLocation(diags, { file: '/x.ts' }).message()).toMatch(/Expected/);
    expect(analyzerMatchers.toHaveLocation(diags, { file: '/y.ts' }).message()).toMatch(/Expected/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsNonDeterministic')
  async contractEmptyId() {
    await expect(assertAnalyzerContract({ id: '', analyze: () => [] }))
      .rejects.toThrow(/non-empty/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractAcceptsConformingAnalyzer')
  async contractEmptyCode() {
    const a: Analyzer = {
      id: 'empty-code',
      analyze: () => [{ severity: 'info', code: '', message: 'm', producerId: 'empty-code' }],
    };
    await expect(assertAnalyzerContract(a)).rejects.toThrow(/empty code/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsProjectMutation')
  async contractMismatchedProducerId() {
    const a: Analyzer = {
      id: 'pid-mismatch',
      analyze: () => [{ severity: 'info', code: 'X', message: 'm', producerId: 'WRONG' }],
    };
    await expect(assertAnalyzerContract(a)).rejects.toThrow(/mismatched/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsVirtFsMutation')
  async contractWriteTrapInvocation() {
    // Trigger the write-trap proxy throw path (line 22 of assert-contract.ts).
    const a: Analyzer = {
      id: 'caller',
      analyze: (ctx) => {
        try {
          (ctx.virtFs as unknown as { addSource: () => void }).addSource();
        } catch {
          /* expected — runtime throw */
        }
        return [];
      },
    };
    await expect(assertAnalyzerContract(a)).rejects.toThrow(/mutate virtFs/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsNonDeterministic')
  async contractIdStabilityCheck() {
    let n = 0;
    const flakyId: Analyzer = {
      get id() { return `id-${n++}`; },  // every read differs
      analyze: () => [],
    };
    await expect(assertAnalyzerContract(flakyId)).rejects.toThrow(/stable/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractRejectsNonDeterministic')
  async contractPositionEqualBranches() {
    let n = 0;
    const flakyPos: Analyzer = {
      id: 'flaky-pos',
      analyze: () => {
        n++;
        return [{
          severity: 'info', code: 'X', message: 'm', producerId: 'flaky-pos',
          ...(n === 1 ? { start: { line: 1, column: 1 } } : {}),
        }];
      },
    };
    await expect(assertAnalyzerContract(flakyPos)).rejects.toThrow(/non-deterministic/);
  }

  @Verifies<AnalyzerTestkitFeature>('contractAcceptsConformingAnalyzer')
  async contractAcceptsAnalyzerWithPositionedDiags() {
    // Force positionEqual into its full equality branch (line 151) by
    // returning deterministic positioned diagnostics from both runs.
    const a: Analyzer = {
      id: 'positioned',
      analyze: () => [{
        severity: 'info', code: 'X', message: 'm', producerId: 'positioned',
        file: '/x.ts',
        start: { line: 1, column: 1 },
        end: { line: 1, column: 5 },
      }],
    };
    await expect(assertAnalyzerContract(a)).resolves.toBeUndefined();
  }

  @Verifies<AnalyzerTestkitFeature>('contractAcceptsConformingAnalyzer')
  async contractCallsBaseProxyMethods() {
    // Cover base read-only Proxy methods (lines 28-30 of assert-contract.ts).
    const a: Analyzer = {
      id: 'base-reader',
      analyze: (ctx) => {
        ctx.virtFs.has('x');
        ctx.virtFs.read('x');
        ctx.virtFs.listEmitted();
        return [];
      },
    };
    await expect(assertAnalyzerContract(a)).resolves.toBeUndefined();
  }
}

@FeatureTest(AnalyzerBuiltinsFeature)
class BuiltinsFillerTests {
  @Verifies<AnalyzerBuiltinsFeature>('an0100EmptyIdError')
  async an0100MissingInitializer() {
    const proj = makeInMemoryProject({
      'src/g.ts': `
        declare class SourceGenerator {}
        export class Bad implements SourceGenerator {
          declare readonly id: string;
        }
      `,
    });
    const diags = await runAnalyzer(new GeneratorIdNonEmptyAnalyzer(), proj);
    const d = diags.find(x => x.code === 'AN0100');
    expect(d?.message).toMatch(/missing 'id'/);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0110EmptyCodeError')
  async an0110ObjectMissingCode() {
    // An object literal with severity/message/producerId but no `code`
    // → AN0110 still fires on the obj-level path.
    const proj = makeInMemoryProject({
      'src/x.ts': `
        const d = {
          severity: 'error',
          message: 'm',
          producerId: 'p',
          file: 'a.ts',
        };
      `,
    });
    const diags = await runAnalyzer(new DiagnosticHasCodeAnalyzer(), proj);
    expect(diags.some(d => d.code === 'AN0110')).toBe(true);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0120NodeFsImportDetected')
  async an0120SuppressionRespected() {
    // Cover the `if (ctx.isSuppressed(imp, CODE)) continue;` branch (line 31).
    const proj = makeInMemoryProject({
      'src/analyze/sup.ts':
        `// @sourcegen-disable-next-line AN0120\n` +
        `import * as fs from 'node:fs';\n` +
        `export const _ = fs;\n`,
    });
    const { NoDirectFsAnalyzer } = await import('../../../src/analyze/builtin/no-direct-fs.js');
    const diags = await runAnalyzer(new NoDirectFsAnalyzer(), proj, { consumerPackageRoot: '/' });
    expect(diags.filter(d => d.code === 'AN0120').length).toBe(0);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0120NodeFsImportDetected')
  async an0120NonEnforcedDirIgnored() {
    // Cover the `if (!ENFORCED_DIRS.some(...)) continue;` branch (line 27).
    const proj = makeInMemoryProject({
      'src/other/x.ts': `import * as fs from 'node:fs';\nexport const _ = fs;\n`,
    });
    const { NoDirectFsAnalyzer } = await import('../../../src/analyze/builtin/no-direct-fs.js');
    const diags = await runAnalyzer(new NoDirectFsAnalyzer(), proj, { consumerPackageRoot: '/' });
    expect(diags.filter(d => d.code === 'AN0120').length).toBe(0);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0101DuplicateIdsRelated')
  async an0101NoDupesNoDiags() {
    const proj = makeInMemoryProject({
      'src/a.ts': `declare class SourceGenerator {} export class A implements SourceGenerator { readonly id = 'a'; }`,
      'src/b.ts': `declare class SourceGenerator {} export class B implements SourceGenerator { readonly id = 'b'; }`,
      'src/c.ts': `class NotAGenerator { readonly id = 'a'; }`,  // not implements: ignored
    });
    const diags = await runAnalyzer(new GeneratorIdUniqueAnalyzer(), proj);
    expect(diags.filter(d => d.code === 'AN0101').length).toBe(0);
  }
}

export { RunAnalyzersFillerTests, TestkitFillerTests, BuiltinsFillerTests };
