import { Project } from 'ts-morph';
import type { Analyzer, Diagnostic, ReadonlyVirtFs } from '../types.js';
import { runAnalyzer } from './run-analyzer.js';

interface WriteTrap {
  readonly virtFs: ReadonlyVirtFs;
  readonly attempts: number;
}

/**
 * Build a `ReadonlyVirtFs` Proxy that counts any property access not in
 * the read-only surface (i.e. any attempt to mutate). The runtime
 * counter catches casts via `(virtFs as any).addSource(...)`.
 */
function makeWriteTrapVirtFs(): WriteTrap {
  const allowed = new Set(['has', 'read', 'listEmitted']);
  let attempts = 0;
  const handler: ProxyHandler<ReadonlyVirtFs> = {
    get(target, prop) {
      if (typeof prop === 'string' && !allowed.has(prop)) {
        attempts++;
        return () => { throw new Error(`virtFs.${prop} is forbidden inside an analyzer`); };
      }
      return Reflect.get(target, prop);
    },
  };
  const base: ReadonlyVirtFs = {
    has: () => false,
    read: () => '',
    listEmitted: () => [],
  };
  const proxy = new Proxy(base, handler);
  return {
    virtFs: proxy,
    get attempts() { return attempts; },
  } as WriteTrap;
}

/**
 * Verify that `analyzer` satisfies the `Analyzer` contract:
 *
 * 1. `id` non-empty and stable (same value across instance reads).
 * 2. Two consecutive runs on the same Project return identical diagnostics.
 * 3. The analyzer never writes to virtFS (proxy with write-attempt counter).
 * 4. The analyzer never mutates the Project source (snapshot pre/post).
 * 5. Every emitted diagnostic has a non-empty `code`.
 * 6. Every emitted diagnostic has `producerId === analyzer.id`.
 *
 * Throws on any violation with a message identifying which assertion failed.
 */
export async function assertAnalyzerContract(analyzer: Analyzer): Promise<void> {
  if (!analyzer.id || typeof analyzer.id !== 'string') {
    throw new Error(`assertAnalyzerContract: analyzer.id must be a non-empty string`);
  }
  const idAgain = analyzer.id;
  if (idAgain !== analyzer.id) {
    throw new Error(`assertAnalyzerContract: analyzer.id must be stable across reads`);
  }

  // Build a small Project containing both a non-trigger and a probable-trigger fixture
  // to exercise diagnostic emission paths.
  const project = makeProbeProject();

  // 3+4: trap virtFS writes and Project source mutations.
  const writeTrap = makeWriteTrapVirtFs();
  const snapshot = snapshotProject(project);

  const diags1 = await runAnalyzer(analyzer, project, { virtFs: writeTrap.virtFs });

  // Detect Project mutation BEFORE attempting the second run — a
  // mutating analyzer may otherwise crash on its 2nd call (e.g. file
  // already exists), masking the real violation.
  const postFirst = snapshotProject(project);
  if (snapshot !== postFirst) {
    throw new Error(
      `assertAnalyzerContract: '${analyzer.id}' mutated Project source files`,
    );
  }

  if (writeTrap.attempts > 0) {
    throw new Error(
      `assertAnalyzerContract: '${analyzer.id}' attempted to mutate virtFs ` +
      `(${writeTrap.attempts} attempt(s))`,
    );
  }

  const diags2 = await runAnalyzer(analyzer, project, { virtFs: writeTrap.virtFs });

  if (!diagnosticsEqual(diags1, diags2)) {
    throw new Error(
      `assertAnalyzerContract: '${analyzer.id}' is non-deterministic ` +
      `(two consecutive runs returned different diagnostics)`,
    );
  }

  for (const d of diags1) {
    if (!d.code || d.code.length === 0) {
      throw new Error(
        `assertAnalyzerContract: '${analyzer.id}' emitted a diagnostic with empty code`,
      );
    }
    if (d.producerId !== analyzer.id) {
      throw new Error(
        `assertAnalyzerContract: '${analyzer.id}' emitted a diagnostic with mismatched ` +
        `producerId='${d.producerId}'`,
      );
    }
  }
}

function makeProbeProject(): Project {
  const p = new Project({ useInMemoryFileSystem: true });
  p.createSourceFile('/probe-empty.ts', '');
  p.createSourceFile('/probe-class.ts', `
class ProbeNonGenerator {
  readonly id = 'probe';
}
class ProbeGenerator implements SourceGenerator {
  readonly id = 'probe-generator';
  async execute() { return { emittedSomething: false, diagnostics: [] }; }
}
declare const SourceGenerator: unknown;
  `.trim() + '\n');
  return p;
}

function snapshotProject(p: Project): string {
  const parts: string[] = [];
  for (const sf of p.getSourceFiles()) parts.push(sf.getFilePath() + '\n' + sf.getFullText());
  return parts.join('\n---\n');
}

function diagnosticsEqual(a: readonly Diagnostic[], b: readonly Diagnostic[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.severity !== y.severity || x.code !== y.code || x.message !== y.message ||
        x.producerId !== y.producerId || x.file !== y.file ||
        positionEqual(x.start, y.start) === false ||
        positionEqual(x.end, y.end) === false) {
      return false;
    }
  }
  return true;
}

function positionEqual(a?: { line: number; column: number }, b?: { line: number; column: number }): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.line === b.line && a.column === b.column;
}
