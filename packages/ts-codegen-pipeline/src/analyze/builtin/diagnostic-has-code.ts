import { SyntaxKind } from 'ts-morph';
import type { ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { Analyzer, AnalysisContext, Diagnostic } from '../../types.js';
import { diagFromNode } from '../diag.js';

const ID = 'analyzer:diagnostic-has-code';
const CODE = 'AN0110';

const DIAG_KEY_HINTS = ['severity', 'code', 'message', 'producerId'] as const;

/**
 * AN0110 — Every Diagnostic-shaped object literal must declare a non-empty
 * `code` string literal. Detection is structural: an object literal that
 * carries at least three of {severity, code, message, producerId} is
 * treated as a Diagnostic. Dynamic `code` values (variable, expression)
 * are ignored as best-effort static analysis.
 */
export class DiagnosticHasCodeAnalyzer implements Analyzer {
  readonly id = ID;
  readonly description =
    'Diagnostic object literals must have a non-empty `code` string literal.';
  readonly docsUrl =
    'https://github.com/frenchexdev/ts-codegen-pipeline#an0110';

  analyze(ctx: AnalysisContext): readonly Diagnostic[] {
    const diags: Diagnostic[] = [];
    for (const sf of ctx.project.getSourceFiles()) {
      sf.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.ObjectLiteralExpression) return;
        const obj = node.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        if (!looksLikeDiagnosticLiteral(obj)) return;
        const codeProp = findPropertyAssignment(obj, 'code');
        if (!codeProp) {
          if (ctx.isSuppressed(obj, CODE)) return;
          diags.push(diagFromNode(obj, 'error', CODE,
            `Diagnostic literal missing 'code' property.`, this.id));
          return;
        }
        if (ctx.isSuppressed(codeProp, CODE)) return;
        const init = codeProp.getInitializer();
        if (!init) return;
        if (init.getKind() !== SyntaxKind.StringLiteral) return; // dynamic — ignore
        const text = init.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText();
        if (text.length === 0) {
          diags.push(diagFromNode(init, 'error', CODE,
            `Diagnostic 'code' must be a non-empty string literal.`, this.id));
        }
      });
    }
    return diags;
  }
}

function looksLikeDiagnosticLiteral(obj: ObjectLiteralExpression): boolean {
  const keys = new Set(
    obj.getProperties()
      .filter(p => p.getKind() === SyntaxKind.PropertyAssignment)
      .map(p => (p as PropertyAssignment).getName()),
  );
  let hits = 0;
  for (const k of DIAG_KEY_HINTS) if (keys.has(k)) hits++;
  return hits >= 3;
}

function findPropertyAssignment(obj: ObjectLiteralExpression, name: string): PropertyAssignment | undefined {
  for (const p of obj.getProperties()) {
    if (p.getKind() !== SyntaxKind.PropertyAssignment) continue;
    const pa = p as PropertyAssignment;
    if (pa.getName() === name) return pa;
  }
  return undefined;
}
