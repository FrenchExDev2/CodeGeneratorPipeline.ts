import { Node, SyntaxKind, type Decorator } from 'ts-morph';
import type { GenerateArgs } from '../attributes.js';

/**
 * Extract the first argument of a decorator-factory call as a literal JS
 * value. Returns null if the decorator is not a factory (`@Foo` rather
 * than `@Foo({...})`), if it has no argument, or if the argument cannot
 * be statically evaluated to a plain object with a string `kind`.
 *
 * Only literal forms are supported — no identifier resolution, no
 * spread, no shorthand assignments. This is by design: source-gen must
 * stay parsable without a type-checker pass.
 */
export function parseDecoratorArgs(dec: Decorator): GenerateArgs | null {
  if (!dec.isDecoratorFactory()) return null;
  // isDecoratorFactory() guarantees the call expression exists.
  const callExpr = dec.getCallExpression()!;
  const args = callExpr.getArguments();
  if (args.length === 0) return null;
  const first = args[0]!;
  const evaluated = literalEval(first);
  if (evaluated === undefined || evaluated === null) return null;
  if (typeof evaluated !== 'object' || Array.isArray(evaluated)) return null;
  const obj = evaluated as Record<string, unknown>;
  if (typeof obj['kind'] !== 'string') return null;
  return obj as GenerateArgs;
}

function literalEval(node: Node): unknown {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isNumericLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isFalseLiteral(node)) return false;
  if (Node.isNullLiteral(node)) return null;
  if (Node.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const prop of node.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const key = prop.getName();
        const value = literalEval(prop.getInitializerOrThrow());
        if (value === undefined) return undefined;
        out[key] = value;
      } else {
        // Shorthand, spread, computed name — bail out.
        return undefined;
      }
    }
    return out;
  }
  if (Node.isArrayLiteralExpression(node)) {
    const arr: unknown[] = [];
    for (const elem of node.getElements()) {
      const v = literalEval(elem);
      if (v === undefined) return undefined;
      arr.push(v);
    }
    return arr;
  }
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.MinusToken) {
    const operand = literalEval(node.getOperand());
    if (typeof operand === 'number') return -operand;
  }
  return undefined;
}
