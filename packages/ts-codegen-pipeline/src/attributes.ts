export interface GenerateArgs {
  readonly kind: string;
  readonly [key: string]: unknown;
}

type AnyDecorator = ClassDecorator & MethodDecorator & PropertyDecorator & ParameterDecorator;

/**
 * Marker decorator. No runtime effect — only consumed by the AST scan.
 * Stackable on the same node; supported targets: class, method, property,
 * accessor (parameter is reserved for a future version).
 */
export function Generate(_args: GenerateArgs): AnyDecorator {
  return ((..._: unknown[]) => { /* marker only */ }) as AnyDecorator;
}
