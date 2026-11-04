import type { ClassDeclaration, Project, SourceFile } from 'ts-morph';
import { Node, SyntaxKind } from 'ts-morph';

export interface FoundFeature {
  /** Class name as written in source. */
  readonly className: string;
  /** Value of `readonly id = '...'` (mandatory). */
  readonly id: string;
  /** Names of `abstract X(): ACResult;` methods, in source order. */
  readonly acNames: readonly string[];
  /** Identifier names listed in `@Satisfies(A, B, ...)` on the class. */
  readonly satisfiesRefs: readonly string[];
  readonly sourceFile: SourceFile;
  readonly node: ClassDeclaration;
}

/**
 * Find every class declared in `project` that `extends Feature`.
 *
 * Discovery is by source-text identifier (the heritage clause's bare
 * identifier is `Feature`); aliasing (`import { Feature as F }` +
 * `extends F`) is intentionally NOT supported, mirroring the
 * decorator-by-name convention used elsewhere.
 *
 * For each Feature class we extract:
 *   - className
 *   - `readonly id = '...'` (string literal)
 *   - abstract method names → AC names
 *   - `@Satisfies(A, B, ...)` identifier args → Requirement class names
 *
 * Classes without an `id` literal are skipped (the engine cannot reason
 * about a Feature with no stable identifier).
 */
export function findFeatures(project: Project): readonly FoundFeature[] {
  const out: FoundFeature[] = [];
  for (const sf of project.getSourceFiles()) {
    for (const cls of sf.getClasses()) {
      if (!extendsFeature(cls)) continue;
      const name = cls.getName();
      if (!name) continue;
      const id = readStringIdProperty(cls);
      if (!id) continue;
      const acNames = abstractMethodNames(cls);
      const satisfiesRefs = extractSatisfiesArgs(cls);
      out.push({ className: name, id, acNames, satisfiesRefs, sourceFile: sf, node: cls });
    }
  }
  return out;
}

function extendsFeature(cls: ClassDeclaration): boolean {
  const heritage = cls.getExtends();
  if (!heritage) return false;
  const expr = heritage.getExpression();
  return Node.isIdentifier(expr) && expr.getText() === 'Feature';
}

function readStringIdProperty(cls: ClassDeclaration): string | null {
  for (const prop of cls.getProperties()) {
    if (prop.getName() !== 'id') continue;
    const init = prop.getInitializer();
    if (!init) return null;
    if (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init)) {
      return init.getLiteralValue();
    }
    return null;
  }
  return null;
}

function abstractMethodNames(cls: ClassDeclaration): string[] {
  const names: string[] = [];
  for (const method of cls.getMethods()) {
    if (!method.isAbstract()) continue;
    const nameNode = method.getNameNode();
    if (!Node.isIdentifier(nameNode)) continue;
    names.push(nameNode.getText());
  }
  return names;
}

function extractSatisfiesArgs(cls: ClassDeclaration): string[] {
  const dec = cls.getDecorator('Satisfies');
  if (!dec) return [];
  return dec.getArguments()
    .filter(a => a.getKind() === SyntaxKind.Identifier)
    .map(a => a.getText());
}
