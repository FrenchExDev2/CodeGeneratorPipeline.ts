import type { Node } from 'ts-morph';
import type {
  Diagnostic,
  DiagnosticLocation,
  DiagnosticPosition,
  Severity,
} from '../types.js';

export interface RelatedNode {
  readonly node: Node;
  readonly message?: string;
}

/**
 * Build a `Diagnostic` from a ts-morph `Node`. `file/start/end` are
 * extracted automatically; `relatedLocations` are built from any
 * supplied `related` nodes.
 *
 * Lines and columns are 1-based to match the convention used by editors
 * and `path:line:col` terminal hyperlinks.
 */
export function diagFromNode(
  node: Node,
  severity: Severity,
  code: string,
  message: string,
  producerId: string,
  related?: readonly RelatedNode[],
): Diagnostic {
  const sf = node.getSourceFile();
  const start = positionAt(node, sf.getLineAndColumnAtPos(node.getStart()));
  const end = positionAt(node, sf.getLineAndColumnAtPos(node.getEnd()));
  const relatedLocations: readonly DiagnosticLocation[] | undefined =
    related && related.length > 0
      ? related.map(({ node: n, message: m }) => buildLocation(n, m))
      : undefined;
  return {
    severity,
    code,
    message,
    producerId,
    file: sf.getFilePath(),
    start,
    end,
    relatedLocations,
  };
}

function buildLocation(node: Node, message?: string): DiagnosticLocation {
  const sf = node.getSourceFile();
  return {
    file: sf.getFilePath(),
    start: sf.getLineAndColumnAtPos(node.getStart()),
    end: sf.getLineAndColumnAtPos(node.getEnd()),
    message,
  };
}

function positionAt(_node: Node, p: { line: number; column: number }): DiagnosticPosition {
  return { line: p.line, column: p.column };
}
