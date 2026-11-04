import { Node, type ClassDeclaration, type Expression } from 'ts-morph';

export interface FitCriterion {
  /** e.g. 'unit-test', 'inspection', 'narrative', 'quality-gate'. */
  readonly kind: string;
  /** Sentence describing what's being verified — embedded as JSDoc on stubs. */
  readonly describes?: string;
  /** AC names referenced by this criterion (`binds: ['acName1', ...]`). */
  readonly binds: readonly string[];
}

/**
 * Extract `readonly fitCriteria = [ ... ]` from a Requirement class declaration.
 *
 * Handles literal object expressions only. Any non-literal entry (spread,
 * computed property, identifier reference) is silently skipped — Tier 1
 * is a best-effort enrichment, not a parser of arbitrary expressions.
 *
 * Returns an array of criteria; absent / empty `fitCriteria` returns [].
 */
export function extractFitCriteria(cls: ClassDeclaration): readonly FitCriterion[] {
  const prop = cls.getProperties().find(p => p.getName() === 'fitCriteria');
  if (!prop) return [];
  const init = prop.getInitializer();
  if (!init || !Node.isArrayLiteralExpression(init)) return [];

  const out: FitCriterion[] = [];
  for (const elem of init.getElements()) {
    if (!Node.isObjectLiteralExpression(elem)) continue;
    let kind: string | undefined;
    let describes: string | undefined;
    const binds: string[] = [];

    for (const p of elem.getProperties()) {
      if (!Node.isPropertyAssignment(p)) continue;
      const key = p.getName();
      const valueExpr = p.getInitializer();
      if (!valueExpr) continue;

      if (key === 'kind') {
        const litStr = stringLiteralValue(valueExpr);
        if (litStr !== null) kind = litStr;
      } else if (key === 'describes') {
        const litStr = stringLiteralValue(valueExpr);
        if (litStr !== null) describes = litStr;
      } else if (key === 'binds' && Node.isArrayLiteralExpression(valueExpr)) {
        for (const item of valueExpr.getElements()) {
          const s = stringLiteralValue(item);
          if (s !== null) binds.push(s);
        }
      }
    }

    if (kind === undefined) continue;
    out.push({ kind, ...(describes !== undefined ? { describes } : {}), binds });
  }
  return out;
}

function stringLiteralValue(node: Expression): string | null {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  // Handle `'...' as const` (TS const-assertion wrapper).
  if (Node.isAsExpression(node)) {
    const inner = node.getExpression();
    if (Node.isStringLiteral(inner) || Node.isNoSubstitutionTemplateLiteral(inner)) {
      return inner.getLiteralValue();
    }
  }
  return null;
}
