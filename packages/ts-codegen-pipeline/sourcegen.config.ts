import { defineConfig, TestStubGenerator } from '@frenchexdev2/ts-codegen-pipeline';
import { builtinAnalyzers } from '@frenchexdev2/ts-codegen-pipeline/analyzers';

/**
 * Self-host: ts-codegen-pipeline uses its own TestStubGenerator to
 * scaffold tests for any AC that has no existing `@Verifies<F>('ac')`
 * binding, AND its own four built-in analyzers (AN0100/AN0101/AN0110/
 * AN0120) to enforce its own conventions on its own source. After
 * implementation, expected outputs are: zero scaffolds (every AC has
 * a test) and zero analyzer diagnostics (every convention upheld).
 */
export default defineConfig({
  tsconfigPath: './tsconfig.json',
  consumerPackageRoot: import.meta.dirname,
  outDir: 'test/unit',
  generators: [
    new TestStubGenerator({ scaffoldSubdir: 'scaffolds', testDirs: ['test'] }),
  ],
  analyzers: [...builtinAnalyzers],
});
