import type {
  ClassDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
} from 'ts-morph';
import type { GenerateArgs } from '../attributes.js';

export type DecoratedTarget =
  | { readonly kind: 'class';    readonly node: ClassDeclaration }
  | { readonly kind: 'method';   readonly node: MethodDeclaration;    readonly owner: ClassDeclaration }
  | { readonly kind: 'property'; readonly node: PropertyDeclaration;  readonly owner: ClassDeclaration }
  | { readonly kind: 'accessor'; readonly node: GetAccessorDeclaration | SetAccessorDeclaration; readonly owner: ClassDeclaration };

export interface DecoratedHit {
  readonly target: DecoratedTarget;
  readonly args: GenerateArgs;
  /** 0-based index among the decorators of the same name on the same node. */
  readonly sourceOrder: number;
}

export type { GenerateArgs };
