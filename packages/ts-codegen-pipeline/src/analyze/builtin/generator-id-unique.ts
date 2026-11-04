import { SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, Node } from 'ts-morph';
import type { Analyzer, AnalysisContext, Diagnostic } from '../../types.js';
import { diagFromNode } from '../diag.js';

const ID = 'analyzer:generator-id-unique';
const CODE = 'AN0101';

/**
 * AN0101 — Two generator classes shall not share the same literal `id`.
 * On collision, emit a single diagnostic with `relatedLocations`
 * pointing to every additional declaration site.
 */
export class GeneratorIdUniqueAnalyzer implements Analyzer {
  readonly id = ID;
  readonly description =
    'No two SourceGenerator classes may share the same literal `id`.';
  readonly docsUrl =
    'https://github.com/frenchexdev/ts-codegen-pipeline#an0101';

  analyze(ctx: AnalysisContext): readonly Diagnostic[] {
    const byId = new Map<string, Node[]>();
    for (const sf of ctx.project.getSourceFiles()) {
      for (const cls of sf.getClasses()) {
        if (!implementsSourceGenerator(cls)) continue;
        const literalNode = readLiteralIdNode(cls);
        if (!literalNode) continue;
        const text = literalNode.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText();
        if (text.length === 0) continue; // empty handled by AN0100
        const arr = byId.get(text) ?? [];
        arr.push(literalNode);
        byId.set(text, arr);
      }
    }
    const diags: Diagnostic[] = [];
    for (const [idText, nodes] of byId) {
      if (nodes.length < 2) continue;
      // The length guard above guarantees a primary and at least one duplicate.
      const primary = nodes[0]!;
      const rest = nodes.slice(1);
      diags.push(diagFromNode(
        primary, 'error', CODE,
        `Generator id '${idText}' is declared in ${nodes.length} classes; ids must be unique.`,
        this.id,
        rest.map(n => ({ node: n, message: 'also declared here' })),
      ));
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

function readLiteralIdNode(cls: ClassDeclaration): Node | undefined {
  const idProp = cls.getProperty('id');
  if (!idProp) return undefined;
  const init = idProp.getInitializer();
  if (!init || init.getKind() !== SyntaxKind.StringLiteral) return undefined;
  return init;
}
