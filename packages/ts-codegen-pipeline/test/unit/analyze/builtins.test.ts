import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import { GeneratorIdNonEmptyAnalyzer } from '../../../src/analyze/builtin/generator-id-non-empty.js';
import { GeneratorIdUniqueAnalyzer } from '../../../src/analyze/builtin/generator-id-unique.js';
import { DiagnosticHasCodeAnalyzer } from '../../../src/analyze/builtin/diagnostic-has-code.js';
import { NoDirectFsAnalyzer } from '../../../src/analyze/builtin/no-direct-fs.js';
import { makeInMemoryProject } from '../../../src/testing/make-in-memory-project.js';
import { runAnalyzer } from '../../../src/testing/run-analyzer.js';
import { AnalyzerBuiltinsFeature } from '../../../requirements/features/analyzer-builtins.js';

@FeatureTest(AnalyzerBuiltinsFeature)
class BuiltinTests {
  @Verifies<AnalyzerBuiltinsFeature>('an0100EmptyIdError')
  async an0100Empty() {
    const proj = makeInMemoryProject({
      'src/g.ts': `
        declare class SourceGenerator {}
        export class Bad implements SourceGenerator {
          readonly id = '';
        }
      `,
    });
    const diags = await runAnalyzer(new GeneratorIdNonEmptyAnalyzer(), proj);
    const d = diags.find(x => x.code === 'AN0100');
    expect(d?.severity).toBe('error');
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0100LiteralIdOk')
  async an0100Ok() {
    const proj = makeInMemoryProject({
      'src/g.ts': `
        declare class SourceGenerator {}
        export class Good implements SourceGenerator {
          readonly id = 'good';
        }
      `,
    });
    const diags = await runAnalyzer(new GeneratorIdNonEmptyAnalyzer(), proj);
    expect(diags.filter(d => d.code === 'AN0100').length).toBe(0);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0100RuntimeIdWarning')
  async an0100Runtime() {
    const proj = makeInMemoryProject({
      'src/g.ts': `
        declare const ID: string;
        declare class SourceGenerator {}
        export class Maybe implements SourceGenerator {
          readonly id = ID;
        }
      `,
    });
    const diags = await runAnalyzer(new GeneratorIdNonEmptyAnalyzer(), proj);
    const d = diags.find(x => x.code === 'AN0100');
    expect(d?.severity).toBe('warning');
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0101DuplicateIdsRelated')
  async an0101Dup() {
    const proj = makeInMemoryProject({
      'src/a.ts': `declare class SourceGenerator {} export class A implements SourceGenerator { readonly id = 'dup'; }`,
      'src/b.ts': `declare class SourceGenerator {} export class B implements SourceGenerator { readonly id = 'dup'; }`,
    });
    const diags = await runAnalyzer(new GeneratorIdUniqueAnalyzer(), proj);
    const dup = diags.find(d => d.code === 'AN0101');
    expect(dup).toBeDefined();
    expect(dup?.relatedLocations?.length).toBe(1);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0110EmptyCodeError')
  async an0110Empty() {
    const proj = makeInMemoryProject({
      'src/x.ts': `
        const d = {
          severity: 'error',
          code: '',
          message: 'm',
          producerId: 'p',
        };
      `,
    });
    const diags = await runAnalyzer(new DiagnosticHasCodeAnalyzer(), proj);
    expect(diags.some(d => d.code === 'AN0110' && d.severity === 'error')).toBe(true);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0110DynamicCodeIgnored')
  async an0110Dyn() {
    const proj = makeInMemoryProject({
      'src/x.ts': `
        declare const someCode: string;
        const d = {
          severity: 'error',
          code: someCode,
          message: 'm',
          producerId: 'p',
        };
      `,
    });
    const diags = await runAnalyzer(new DiagnosticHasCodeAnalyzer(), proj);
    expect(diags.filter(d => d.code === 'AN0110').length).toBe(0);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0120NodeFsImportDetected')
  async an0120Detected() {
    const proj = makeInMemoryProject({
      'src/analyze/bad.ts': `import * as fs from 'node:fs';\nexport const _ = fs;\n`,
    });
    const diags = await runAnalyzer(new NoDirectFsAnalyzer(), proj, {
      consumerPackageRoot: '/',
    });
    expect(diags.some(d => d.code === 'AN0120')).toBe(true);
  }

  @Verifies<AnalyzerBuiltinsFeature>('an0120FileSystemPortAllowed')
  async an0120Ok() {
    const proj = makeInMemoryProject({
      'src/analyze/ok.ts':
        `import type { FileSystemPort } from '../ports/file-system.js';\n` +
        `export const _: FileSystemPort | null = null;\n`,
    });
    const diags = await runAnalyzer(new NoDirectFsAnalyzer(), proj, {
      consumerPackageRoot: '/',
    });
    expect(diags.filter(d => d.code === 'AN0120').length).toBe(0);
  }
}

export { BuiltinTests };
