import type { Analyzer } from '../../types.js';
import { GeneratorIdNonEmptyAnalyzer } from './generator-id-non-empty.js';
import { GeneratorIdUniqueAnalyzer } from './generator-id-unique.js';
import { DiagnosticHasCodeAnalyzer } from './diagnostic-has-code.js';
import { NoDirectFsAnalyzer } from './no-direct-fs.js';

export { GeneratorIdNonEmptyAnalyzer } from './generator-id-non-empty.js';
export { GeneratorIdUniqueAnalyzer } from './generator-id-unique.js';
export { DiagnosticHasCodeAnalyzer } from './diagnostic-has-code.js';
export { NoDirectFsAnalyzer } from './no-direct-fs.js';

/**
 * The four builtin analyzers shipped with `ts-codegen-pipeline`.
 * Consumers spread them into their `analyzers: [...]` config array.
 */
export const builtinAnalyzers: readonly Analyzer[] = [
  new GeneratorIdNonEmptyAnalyzer(),
  new GeneratorIdUniqueAnalyzer(),
  new DiagnosticHasCodeAnalyzer(),
  new NoDirectFsAnalyzer(),
];
