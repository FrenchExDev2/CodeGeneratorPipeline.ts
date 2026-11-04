import type {
  ClassDeclaration,
  GetAccessorDeclaration,
  MethodDeclaration,
  Project,
  PropertyDeclaration,
  SetAccessorDeclaration,
} from 'ts-morph';
import type { DecoratedHit, DecoratedTarget } from './types.js';
import { parseDecoratorArgs } from './parse-decorator-args.js';

/**
 * Walk every SourceFile in the project and return one DecoratedHit per
 * decorator whose identifier matches `decoratorName`. Discovery is by
 * source-text identifier (no symbol resolution): `import { Generate as Gen }`
 * + `@Gen(...)` is NOT discovered when looking for `Generate`.
 *
 * Stacking is supported: N `@<name>` decorators on the same node yield
 * N hits in source order (top-to-bottom in the file).
 */
export function findDecorated(project: Project, decoratorName: string): readonly DecoratedHit[] {
  const out: DecoratedHit[] = [];
  for (const sf of project.getSourceFiles()) {
    for (const cls of sf.getClasses()) {
      collectClassDecorators(cls, decoratorName, out);
      for (const method of cls.getMethods()) {
        collectFromNode(method, { kind: 'method', node: method, owner: cls }, decoratorName, out);
      }
      for (const prop of cls.getProperties()) {
        collectFromNode(prop, { kind: 'property', node: prop, owner: cls }, decoratorName, out);
      }
      for (const acc of cls.getGetAccessors()) {
        collectFromNode(acc, { kind: 'accessor', node: acc, owner: cls }, decoratorName, out);
      }
      for (const acc of cls.getSetAccessors()) {
        collectFromNode(acc, { kind: 'accessor', node: acc, owner: cls }, decoratorName, out);
      }
    }
  }
  return out;
}

type DecoratedNode =
  | ClassDeclaration
  | MethodDeclaration
  | PropertyDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration;

function collectClassDecorators(cls: ClassDeclaration, decoratorName: string, out: DecoratedHit[]): void {
  collectFromNode(cls, { kind: 'class', node: cls }, decoratorName, out);
}

function collectFromNode(
  node: DecoratedNode,
  target: DecoratedTarget,
  decoratorName: string,
  out: DecoratedHit[],
): void {
  let sourceOrder = 0;
  for (const dec of node.getDecorators()) {
    if (dec.getName() !== decoratorName) continue;
    const args = parseDecoratorArgs(dec);
    if (!args) continue;
    out.push({ target, args, sourceOrder });
    sourceOrder++;
  }
}
