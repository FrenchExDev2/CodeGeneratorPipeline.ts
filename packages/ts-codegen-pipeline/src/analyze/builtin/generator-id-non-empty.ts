import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, PropertyDeclaration } from 'ts-morph';
import type { Analyzer, AnalysisContext, Diagnostic } from '../../types.js';
import { diagFromNode } from '../diag.js';

const ID = 'analyzer:generator-id-non-empty';
const CODE = 'AN0100';

/**
 * AN0100 — Every class implementing `SourceGenerator` must initialize
 * its `id` property to a non-empty string literal. An empty literal
 * yields an error; a runtime-resolved value (identifier, expression)
 * yields a warning.
 */
export class GeneratorIdNonEmptyAnalyzer implements Analyzer {
  readonly id = ID;
  readonly description =
    'SourceGenerator subclasses must declare a non-empty literal `id`.';
  readonly docsUrl =
    'https://github.com/frenchexdev/ts-codegen-pipeline#an0100';

  analyze(ctx: AnalysisContext): readonly Diagnostic[] {
    const diags: Diagnostic[] = [];
    for (const sf of ctx.project.getSourceFiles()) {
      for (const cls of sf.getClasses()) {
        if (!implementsSourceGenerator(cls)) continue;
        const idProp = cls.getProperty('id');
        if (!idProp) continue;
        if (ctx.isSuppressed(idProp, CODE)) continue;
        diags.push(...diagnoseIdInitializer(idProp, this.id));
      }
    }
    return diags;
  }
}

function implementsSourceGenerator(cls: ClassDeclaration): boolean {
  for (const impl of cls.getImplements()) {
    if (impl.getExpression().getText() === 'SourceGenerator') return true;
  }
  return false;
}

function diagnoseIdInitializer(prop: PropertyDeclaration, producerId: string): readonly Diagnostic[] {
  const init: Node | undefined = prop.getInitializer();
  if (!init) {
    return [diagFromNode(prop, 'error', CODE,
      `Generator class missing 'id' initializer.`, producerId)];
  }
  if (init.getKind() === SyntaxKind.StringLiteral) {
    const text = init.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText();
    if (text.length === 0) {
      return [diagFromNode(init, 'error', CODE,
        `Generator 'id' must be a non-empty string literal.`, producerId)];
    }
    return [];
  }
  // Anything else (Identifier, PropertyAccessExpression, TemplateLiteral with
  // no expressions, etc.) — we cannot statically prove non-emptiness.
  return [diagFromNode(init, 'warning', CODE,
    `Generator 'id' should be a literal string, not a runtime expression.`, producerId)];
}
