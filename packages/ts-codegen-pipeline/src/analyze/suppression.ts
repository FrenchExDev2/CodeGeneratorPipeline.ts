import type { Node, Project } from 'ts-morph';
import type { SuppressionChecker } from '../types.js';

const DIRECTIVE = '@sourcegen-disable-next-line';

interface SuppressionEntry {
  readonly file: string;
  readonly nextLine: number;     // 1-based — line below the directive
  readonly codes: readonly string[]; // empty array = wildcard
}

/**
 * Build a `SuppressionChecker` over the entire Project. Comments matching
 * `// @sourcegen-disable-next-line CODE1[,CODE2…]` (or block-comment
 * form) suppress diagnostics for the listed codes on the next non-empty
 * line. A directive without any code listed is a wildcard.
 */
export function makeSuppressionChecker(project: Project): SuppressionChecker {
  // `readonly`, matching what `parseDirectives` returns: the entries are only
  // ever read back through `get`, never appended to.
  const byFile = new Map<string, readonly SuppressionEntry[]>();
  for (const sf of project.getSourceFiles()) {
    const path = sf.getFilePath();
    const text = sf.getFullText();
    const entries = parseDirectives(path, text);
    if (entries.length > 0) byFile.set(path, entries);
  }
  return (node: Node, code: string): boolean => {
    const path = node.getSourceFile().getFilePath();
    const entries = byFile.get(path);
    if (!entries) return false;
    const nodeLine = node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
    for (const e of entries) {
      if (e.nextLine !== nodeLine) continue;
      if (e.codes.length === 0) return true; // wildcard
      if (e.codes.includes(code)) return true;
    }
    return false;
  };
}

/**
 * Parse a source text for `@sourcegen-disable-next-line` directives.
 * Returns one entry per directive with the (1-based) next non-empty
 * line and the list of suppressed codes (empty = wildcard).
 *
 * Exported for runner-level fail-safe filter usage and unit tests.
 */
export function parseDirectives(file: string, text: string): readonly SuppressionEntry[] {
  const out: SuppressionEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const codes = extractDirectiveCodes(lines[i]!);
    if (codes === null) continue;
    const nextLine = findNextNonEmptyLine(lines, i + 1);
    if (nextLine === -1) continue;
    out.push({ file, nextLine: nextLine + 1, codes });
  }
  return out;
}

function extractDirectiveCodes(line: string): readonly string[] | null {
  // Match `// @sourcegen-disable-next-line ...` or `/* @sourcegen-disable-next-line ... */`
  const re = new RegExp(`(?://|/\\*)\\s*${escapeRegex(DIRECTIVE)}(?:[ \\t]+([^\\n*/]*))?`);
  const m = line.match(re);
  if (!m) return null;
  const tail = (m[1] ?? '').trim();
  if (tail.length === 0) return [];
  return tail.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function findNextNonEmptyLine(lines: readonly string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0 && extractDirectiveCodes(lines[i]!) === null) return i;
  }
  return -1;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type { SuppressionEntry };
