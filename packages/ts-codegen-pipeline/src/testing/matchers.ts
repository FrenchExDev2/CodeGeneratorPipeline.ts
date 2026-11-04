import type { Diagnostic, Severity } from '../types.js';

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

/**
 * Vitest matchers for analyzer test ergonomics.
 *
 * Usage:
 *   import { expect } from 'vitest';
 *   import { analyzerMatchers } from '@frenchexdev2/ts-codegen-pipeline/testing';
 *   expect.extend(analyzerMatchers);
 *
 * Then in tests:
 *   expect(diags).toHaveCode('AN0001');
 *   expect(diags).toHaveSeverity('error');
 *   expect(diags).toHaveLocation({ file: '/x.ts', line: 3 });
 */
export const analyzerMatchers = {
  toHaveCode(received: readonly Diagnostic[], code: string): MatcherResult {
    const pass = received.some(d => d.code === code);
    return {
      pass,
      message: () => pass
        ? `Expected diagnostics not to include code '${code}', but found one.`
        : `Expected diagnostics to include code '${code}', got: [${received.map(d => d.code).join(', ')}]`,
    };
  },
  toHaveSeverity(received: readonly Diagnostic[], severity: Severity): MatcherResult {
    const pass = received.some(d => d.severity === severity);
    return {
      pass,
      message: () => pass
        ? `Expected diagnostics not to include severity '${severity}'.`
        : `Expected diagnostics to include severity '${severity}', got: [${received.map(d => d.severity).join(', ')}]`,
    };
  },
  toHaveLocation(received: readonly Diagnostic[], loc: { file?: string; line?: number; column?: number }): MatcherResult {
    const pass = received.some(d => {
      if (loc.file !== undefined && d.file !== loc.file) return false;
      if (loc.line !== undefined && d.start?.line !== loc.line) return false;
      if (loc.column !== undefined && d.start?.column !== loc.column) return false;
      return true;
    });
    return {
      pass,
      message: () => pass
        ? `Expected no diagnostic at ${JSON.stringify(loc)}.`
        : `Expected a diagnostic at ${JSON.stringify(loc)}, got: ${JSON.stringify(received.map(d => ({ file: d.file, line: d.start?.line, column: d.start?.column })))}`,
    };
  },
};
