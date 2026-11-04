/**
 * Test-bindings-scanner — AST walker over `test/**\/*.test.ts` files.
 *
 * For each class decorated with `@FeatureTest(SomeFeature)` and each method
 * decorated with `@Verifies<SomeFeature>('acName')`, walks the method body,
 * collects every CallExpression / NewExpression callee, resolves the root
 * identifier through the file's import map, filters to `src/**` or
 * `scripts/**`, and emits a `BindingsManifest` in the same shape as the legacy
 * `bindings-scanner` (`Record<featureId, Record<acName, SymbolTarget[]>>`).
 *
 * Pure — no direct `fs`/`child_process` access. Takes a `ReadableFileSystem` port
 * from `src/lib/external.ts`. The parser functions (`parseTestFile`,
 * `collectImports`, `resolveTarget`, `getRootIdentifier`, etc.) are
 * side-effect free and unit-tested in isolation.
 */

import * as ts from 'typescript';
import * as path from 'path';
import type { ReadableFileSystem } from '@frenchexdev2/requirements-shared-kernel/ports';

export interface SymbolTarget {
  file: string;
  symbol: string;
}

/** featureId → acName → [{file, symbol}]. */
export type BindingsManifest = Record<string, Record<string, SymbolTarget[]>>;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ImportKind = 'named' | 'default' | 'namespace';

export interface ImportEntry {
  localName: string;
  moduleSpec: string;
  kind: ImportKind;
}

export interface MethodBinding {
  methodName: string;
  ac: string;
  targets: SymbolTarget[];
}

export interface ParsedTestClass {
  className: string;
  featureClass: string;
  methods: MethodBinding[];
}

export interface TestParseResult {
  file: string;
  classes: ParsedTestClass[];
  warnings: string[];
}

export interface EmptyMethodRef {
  testFile: string;
  className: string;
  methodName: string;
  featureClass: string;
  featureId: string;
  ac: string;
}

export interface TestScanOptions {
  testDirs: readonly string[];
  root: string;
  classToId: Map<string, string>;
  fs: ReadableFileSystem;
  /** Path prefixes (posix-relative-to-root) to keep. Default: src/, scripts/. */
  includeScopes?: readonly string[];
}

export interface TestScanResult {
  manifest: BindingsManifest;
  warnings: string[];
  fileCount: number;
  methodCount: number;
  emptyMethods: EmptyMethodRef[];
}

const DEFAULT_INCLUDE_SCOPES = ['src/', 'scripts/'] as const;

// ────────────────────────────────────────────────────────────────────────────
// Pure parser
// ────────────────────────────────────────────────────────────────────────────

export function parseTestFile(
  src: string,
  file: string,
  root: string,
  includeScopes: readonly string[] = DEFAULT_INCLUDE_SCOPES,
  /**
   * Optional predicate to disambiguate `import '../../src/foo'` between
   * `src/foo.ts` (primary) and `src/foo/index.ts` (barrel). When provided
   * and the primary `.ts` file does not exist, the resolver falls back to
   * the barrel target — matching NodeNext ESM resolution. Default: undefined
   * → primary resolution wins (legacy behaviour, used by pure unit tests).
   */
  fileExists?: (relPath: string) => boolean,
): TestParseResult {
  const result: TestParseResult = { file, classes: [], warnings: [] };
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true);
  const imports = collectImports(sf);
  const localHelpers = collectLocalHelpers(sf);

  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;

    const featureClass = extractFeatureTestArg(stmt);
    if (!featureClass) continue;

    const parsed: ParsedTestClass = {
      className: stmt.name.text,
      featureClass,
      methods: [],
    };

    const classHelpers = collectClassHelpers(stmt);

    for (const member of stmt.members) {
      if (!ts.isMethodDeclaration(member)) continue;
      const methodName = readMemberName(member.name);
      /* Coverage rationale:  -- defensive: readMemberName returns null only for computed names, already v8-ignored */
      if (!methodName) continue;

      const acs = extractVerifiesArgs(member);
      if (acs.length === 0) continue;

      const calleeNames = collectReferencedNamesTransitive(member, localHelpers, classHelpers);
      const targets: SymbolTarget[] = [];
      // `calleeNames` already dedupes via its internal Set — no need to re-filter here.
      for (const name of calleeNames) {
        const imp = imports.get(name);
        if (!imp) continue;
        const resolved = resolveTarget(imp, file, root);
        if (!resolved) continue;
        if (isInScope(resolved.file, includeScopes)) {
          // Primary `<path>.ts` is in scope but may not exist on disk: e.g.
          // `import from '../../src/scaffolders'` → resolveTarget yields
          // `src/scaffolders.ts`, but the real file is `src/scaffolders/index.ts`.
          // When we have a fileExists oracle, prefer the barrel whenever
          // the primary file is absent and the barrel is present.
          if (fileExists && !fileExists(resolved.file)) {
            const barrel = resolveBarrelTarget(imp, file, root);
            if (barrel && isInScope(barrel.file, includeScopes) && fileExists(barrel.file)) {
              targets.push(barrel);
              continue;
            }
          }
          targets.push(resolved);
          continue;
        }
        // Primary resolution out of scope — try barrel fallback (`./dir` → `./dir/index.ts`)
        const barrel = resolveBarrelTarget(imp, file, root);
        if (barrel && isInScope(barrel.file, includeScopes)) {
          targets.push(barrel);
        }
      }
      // Dynamic imports — `await import('../../src/index')` patterns that static
      // import collection misses. Symbol is set to '*' (the whole module).
      for (const dyn of collectDynamicImportTargets(member, file, root, includeScopes)) {
        /* Coverage rationale:  -- exercised indirectly by integration tests in @frenchexdev2/requirements-lib; collectDynamicImportTargets has direct unit coverage in collectors.test.ts */
        targets.push(dyn);
      }

      for (const ac of acs) {
        parsed.methods.push({ methodName, ac, targets: [...targets] });
      }
    }

    // featureClass is guaranteed truthy (we `continue`d above when it was null),
    // so every @FeatureTest-decorated class is reported — even when empty.
    result.classes.push(parsed);
  }

  return result;
}

export function collectImports(sf: ts.SourceFile): Map<string, ImportEntry> {
  const map = new Map<string, ImportEntry>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const clause = stmt.importClause;
    if (!clause || clause.isTypeOnly) continue;
    /* Coverage rationale:  -- type-narrowing guard; real imports always have a string specifier */
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const moduleSpec = stmt.moduleSpecifier.text;

    if (clause.name) {
      map.set(clause.name.text, { localName: clause.name.text, moduleSpec, kind: 'default' });
    }
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      map.set(bindings.name.text, { localName: bindings.name.text, moduleSpec, kind: 'namespace' });
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        if (el.isTypeOnly) continue;
        map.set(el.name.text, { localName: el.name.text, moduleSpec, kind: 'named' });
      }
    }
  }
  return map;
}

/**
 * Walk the method body for `await import('<rel-path>')` / `import('<rel-path>')`
 * expressions and yield one `SymbolTarget` per resolved module that falls within
 * the configured scope.
 *
 * Symbol is `'*'` because dynamic imports return the whole module namespace;
 * this matches the semantics of `import * as ns from '...'`.
 */
export function collectDynamicImportTargets(
  method: ts.MethodDeclaration,
  testFile: string,
  root: string,
  scopes: readonly string[],
): SymbolTarget[] {
  const out: SymbolTarget[] = [];
  /* Coverage rationale:  -- defensive: abstract / declared methods are filtered upstream by parseTestFile */
  if (!method.body) return out;
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments.length >= 1
    ) {
      const arg = n.arguments[0]!;
      if (ts.isStringLiteral(arg)) {
        const spec = arg.text;
        if (spec.startsWith('.')) {
          const resolved = resolveTarget(
            { localName: '*', moduleSpec: spec, kind: 'namespace' },
            testFile,
            root,
          );
          if (resolved && isInScope(resolved.file, scopes)) {
            out.push(resolved);
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(method.body);
  return out;
}

export function resolveTarget(imp: ImportEntry, testFile: string, root: string): SymbolTarget | null {
  const spec = imp.moduleSpec;
  if (!spec.startsWith('.')) return null;
  const abs = path.resolve(path.dirname(testFile), spec);
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  // NodeNext ESM convention: source is `.ts`, but imports refer to it as `.js`.
  const resolvedFile = rel.endsWith('.ts')
    ? rel
    : rel.endsWith('.js')
      ? `${rel.slice(0, -3)}.ts`
      : `${rel}.ts`;
  return { file: resolvedFile, symbol: imp.localName };
}

/**
 * Resolve an import as a barrel: `import x from '../../src'` → `src/index.ts`.
 *
 * Complement to `resolveTarget`, which assumes the spec names a file. When
 * the primary resolution lands outside the configured scope (e.g. `src.ts`
 * for an import of `'../../src'`), the caller should try this resolution
 * before giving up.
 *
 * Returns null if the spec already has an explicit `.ts`/`.js` extension
 * (in which case `resolveTarget` is authoritative).
 */
export function resolveBarrelTarget(imp: ImportEntry, testFile: string, root: string): SymbolTarget | null {
  const spec = imp.moduleSpec;
  if (!spec.startsWith('.')) return null;
  if (spec.endsWith('.ts') || spec.endsWith('.js')) return null;
  const abs = path.resolve(path.dirname(testFile), spec, 'index');
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  return { file: `${rel}.ts`, symbol: imp.localName };
}

export function isInScope(relPath: string, scopes: readonly string[]): boolean {
  for (const scope of scopes) {
    if (relPath.startsWith(scope)) return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Decorator extraction
// ────────────────────────────────────────────────────────────────────────────

function getDecorators(node: ts.Node): readonly ts.Decorator[] {
  const mods = (node as { modifiers?: readonly ts.ModifierLike[] }).modifiers;
  if (!mods) return [];
  return mods.filter((m): m is ts.Decorator => m.kind === ts.SyntaxKind.Decorator);
}

export function extractFeatureTestArg(cls: ts.ClassDeclaration): string | null {
  for (const dec of getDecorators(cls)) {
    if (!ts.isCallExpression(dec.expression)) continue;
    const callee = dec.expression.expression;
    if (!ts.isIdentifier(callee) || callee.text !== 'FeatureTest') continue;
    const firstArg = dec.expression.arguments[0];
    if (firstArg && ts.isIdentifier(firstArg)) return firstArg.text;
  }
  return null;
}

/**
 * Returns true if the method carries a `@TypeCheckOnly()` decorator.
 * Used by audit tools to suppress `empty-targets` smells on tests that
 * verify a type-level invariant by design.
 */
export function hasTypeCheckOnlyDecorator(method: ts.MethodDeclaration): boolean {
  for (const dec of getDecorators(method)) {
    /* Coverage rationale:  -- defensive: real decorator usage is always a call expression `@TypeCheckOnly()` */
    if (!ts.isCallExpression(dec.expression)) continue;
    const callee = dec.expression.expression;
    if (ts.isIdentifier(callee) && callee.text === 'TypeCheckOnly') return true;
  }
  return false;
}

export function extractVerifiesArgs(method: ts.MethodDeclaration): string[] {
  const out: string[] = [];
  for (const dec of getDecorators(method)) {
    if (!ts.isCallExpression(dec.expression)) continue;
    const callee = dec.expression.expression;
    if (!ts.isIdentifier(callee) || callee.text !== 'Verifies') continue;
    const firstArg = dec.expression.arguments[0];
    if (firstArg && ts.isStringLiteralLike(firstArg)) out.push(firstArg.text);
  }
  return out;
}

function readMemberName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : /* Coverage rationale:  -- defensive: test methods never use computed / numeric property names */ null;
}

// ────────────────────────────────────────────────────────────────────────────
// Callee collection
// ────────────────────────────────────────────────────────────────────────────

export function collectCalleeNames(method: ts.MethodDeclaration): string[] {
  const out = new Set<string>();
  if (!method.body) return [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const root = getRootIdentifier(node.expression);
      if (root) out.add(root);
    }
    ts.forEachChild(node, visit);
  };
  visit(method.body);
  return [...out];
}

/**
 * Collects every identifier referenced in a *value* position inside a method
 * body. Superset of `collectCalleeNames` — also catches bare references like
 * `expect(CONST).toBe(x)`, `arr.map(myHelper)`, `new MyClass`. Filters out:
 *  - type nodes (type references never resolve to runtime imports)
 *  - the `.name` of PropertyAccessExpression / PropertyAssignment
 *  - declaration sides (let/const/param/binding/class/function/method names)
 *
 * The caller filters this set against the import map; unresolved locals
 * naturally drop out, so false positives become no-ops.
 */
export function collectReferencedNames(method: ts.MethodDeclaration): string[] {
  return [...collectReferencedNamesFromNode(method.body).bare];
}

interface CollectedNames {
  /** Plain identifier references (both imported symbols and locals). */
  bare: Set<string>;
  /** Names accessed via `this.xxx` — resolved against the class helper map. */
  thisMembers: Set<string>;
}

function collectReferencedNamesFromNode(root: ts.Node | undefined): CollectedNames {
  const out: CollectedNames = { bare: new Set(), thisMembers: new Set() };
  if (!root) return out;

  const visit = (node: ts.Node): void => {
    // Skip type nodes entirely — they never contribute value references.
    if (isTypePosition(node)) return;

    // `this.foo` → capture `foo` as a class-helper reference (not a bare
    // identifier, because the parent is a PropertyAccessExpression which
    // would normally filter it out).
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      out.thisMembers.add(node.name.text);
    }

    if (ts.isIdentifier(node) && isValueReference(node)) {
      out.bare.add(node.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(root);
  return out;
}

/**
 * Transitive version of `collectReferencedNames`: when a referenced name
 * resolves to a same-file top-level helper (from `collectLocalHelpers`), the
 * helper's body is walked too, recursively, with a visited set to break cycles.
 *
 * This is the difference between "my test only calls a local `setup()` helper
 * (empty binding)" and "my test transitively reaches `createAccentMachine`
 * via `setup()` (bound to src/lib/accent-preview-state.ts)".
 */
export function collectReferencedNamesTransitive(
  method: ts.MethodDeclaration,
  helpers: Map<string, ts.Node>,
  classHelpers: Map<string, ts.Node> = new Map(),
): string[] {
  const out = new Set<string>();
  const visitedBare = new Set<string>();
  const visitedThis = new Set<string>();

  const walk = (node: ts.Node | undefined): void => {
    const refs = collectReferencedNamesFromNode(node);
    for (const name of refs.bare) {
      out.add(name);
      if (visitedBare.has(name)) continue;
      visitedBare.add(name);
      const helperBody = helpers.get(name);
      if (helperBody) walk(helperBody);
    }
    for (const name of refs.thisMembers) {
      if (visitedThis.has(name)) continue;
      visitedThis.add(name);
      const helperBody = classHelpers.get(name);
      if (helperBody) walk(helperBody);
    }
  };

  walk(method.body);
  return [...out];
}

/**
 * Builds a map of top-level helper name → body node for a test file.
 * Captures:
 *  - `function foo() { … }` → maps `foo` to the FunctionDeclaration's body
 *  - `const foo = () => { … }` → maps `foo` to the arrow function body
 *  - `const foo = function() { … }` → maps `foo` to the function expression body
 * Skips class declarations (those are the `@FeatureTest`-decorated test classes).
 */
export function collectLocalHelpers(sf: ts.SourceFile): Map<string, ts.Node> {
  const map = new Map<string, ts.Node>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      map.set(stmt.name.text, stmt.body);
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const init = decl.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          map.set(decl.name.text, init.body);
        }
      }
    }
  }
  return map;
}

/**
 * Builds a map of class-method name → method body for the non-`@Verifies`
 * members of a test class (setup / teardown / private helpers). When a
 * `@Verifies` method calls `this.makeSomething()`, the transitive walker
 * follows the helper's body to pick up the imported symbols it reaches.
 */
export function collectClassHelpers(cls: ts.ClassDeclaration): Map<string, ts.Node> {
  const map = new Map<string, ts.Node>();
  for (const member of cls.members) {
    if (!ts.isMethodDeclaration(member) || !member.body) continue;
    if (extractVerifiesArgs(member).length > 0) continue; // @Verifies methods aren't helpers
    const name = readMemberName(member.name);
    /* Coverage rationale:  -- defensive: readMemberName returns null only for computed names */
    if (!name) continue;
    map.set(name, member.body);
  }
  return map;
}

function isTypePosition(node: ts.Node): boolean {
  // TypeNode parents: TypeReference, TypeLiteral, TypeQuery, etc.
  // These are skipped before we descend.
  return (
    ts.isTypeReferenceNode(node) ||
    ts.isTypeLiteralNode(node) ||
    ts.isTypeQueryNode(node) ||
    ts.isTypePredicateNode(node) ||
    ts.isArrayTypeNode(node) ||
    ts.isTupleTypeNode(node) ||
    ts.isUnionTypeNode(node) ||
    ts.isIntersectionTypeNode(node) ||
    ts.isConditionalTypeNode(node) ||
    ts.isIndexedAccessTypeNode(node) ||
    ts.isMappedTypeNode(node) ||
    ts.isTypeOperatorNode(node) ||
    ts.isParenthesizedTypeNode(node) ||
    ts.isTemplateLiteralTypeNode(node) ||
    ts.isImportTypeNode(node)
  );
}

function isValueReference(id: ts.Identifier): boolean {
  const parent = (id as unknown as { parent?: ts.Node }).parent;
  /* Coverage rationale:  -- defensive: identifiers inside parsed SourceFile always have parent set */
  if (!parent) return false;

  // `.name` of a PropertyAccessExpression: `foo.bar` → only `foo` is the reference.
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;

  // Object literal key: `{ foo: 1 }`. Shorthand `{ foo }` IS a reference, but
  // PropertyAssignment has a separate initializer so its `.name` is just the key.
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === id) return false;
  if (ts.isGetAccessor(parent) && parent.name === id) return false;
  if (ts.isSetAccessor(parent) && parent.name === id) return false;

  // Declarations — LHS names don't reference imports.
  if (ts.isVariableDeclaration(parent) && parent.name === id) return false;
  if (ts.isParameter(parent) && parent.name === id) return false;
  if (ts.isBindingElement(parent) && parent.name === id) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === id) return false;
  if (ts.isClassDeclaration(parent) && parent.name === id) return false;
  if (ts.isFunctionExpression(parent) && parent.name === id) return false;
  if (ts.isClassExpression(parent) && parent.name === id) return false;

  // Label on labeled statements / break/continue.
  if (ts.isLabeledStatement(parent) && parent.label === id) return false;
  if (ts.isBreakStatement(parent) && parent.label === id) return false;
  if (ts.isContinueStatement(parent) && parent.label === id) return false;

  return true;
}

export function getRootIdentifier(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return getRootIdentifier(expr.expression);
  if (ts.isElementAccessExpression(expr)) return getRootIdentifier(expr.expression);
  if (ts.isCallExpression(expr) || ts.isNewExpression(expr)) return getRootIdentifier(expr.expression);
  if (ts.isParenthesizedExpression(expr)) return getRootIdentifier(expr.expression);
  if (ts.isNonNullExpression(expr)) return getRootIdentifier(expr.expression);
  if (ts.isAsExpression(expr)) return getRootIdentifier(expr.expression);
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregation
// ────────────────────────────────────────────────────────────────────────────

export interface AggregateInput {
  parsed: TestParseResult[];
  classToId: Map<string, string>;
}

export function aggregateTestBindings(input: AggregateInput): {
  manifest: BindingsManifest;
  emptyMethods: EmptyMethodRef[];
  methodCount: number;
  warnings: string[];
} {
  const manifest: BindingsManifest = {};
  const emptyMethods: EmptyMethodRef[] = [];
  const warnings: string[] = [];
  let methodCount = 0;

  for (const file of input.parsed) {
    warnings.push(...file.warnings);
    for (const cls of file.classes) {
      const featureId = input.classToId.get(cls.featureClass) ?? cls.featureClass;
      const acMap = (manifest[featureId] ??= {});
      for (const m of cls.methods) {
        methodCount++;
        if (m.targets.length === 0) {
          emptyMethods.push({
            testFile: file.file,
            className: cls.className,
            methodName: m.methodName,
            featureClass: cls.featureClass,
            featureId,
            ac: m.ac,
          });
          continue;
        }
        const existing = acMap[m.ac] ?? [];
        const merged = [...existing];
        const seen = new Set(existing.map(t => `${t.file}::${t.symbol}`));
        for (const t of m.targets) {
          const key = `${t.file}::${t.symbol}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(t);
        }
        acMap[m.ac] = merged;
      }
    }
  }

  return { manifest: sortManifest(manifest), emptyMethods, methodCount, warnings };
}

export function sortManifest(manifest: BindingsManifest): BindingsManifest {
  const sorted: BindingsManifest = {};
  for (const featureId of Object.keys(manifest).sort()) {
    const inner = manifest[featureId]!;
    const sortedInner: Record<string, SymbolTarget[]> = {};
    for (const ac of Object.keys(inner).sort()) {
      sortedInner[ac] = [...inner[ac]!].sort((a, b) =>
        a.file.localeCompare(b.file) || a.symbol.localeCompare(b.symbol),
      );
    }
    sorted[featureId] = sortedInner;
  }
  return sorted;
}

// ────────────────────────────────────────────────────────────────────────────
// IO orchestration (via ReadableFileSystem port)
// ────────────────────────────────────────────────────────────────────────────

export async function collectTestFiles(fs: ReadableFileSystem, rootDir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let isDir = false;
      try {
        isDir = (await fs.stat(full)).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        await walk(full);
      } else if (name.endsWith('.test.ts') || name.endsWith('.spec.ts')) {
        out.push(full);
      }
    }
  };
  await walk(rootDir);
  return out.sort();
}

/**
 * Walk every `scope` directory under `root` and return a sync predicate that
 * answers whether a given root-relative posix path is a regular file on disk.
 * Used by `parseTestFile` to disambiguate `<path>.ts` vs `<path>/index.ts`
 * (NodeNext barrel imports). Pure-async: only reads via the ReadableFileSystem port.
 */
export async function buildFileExistsPredicate(
  fs: ReadableFileSystem,
  root: string,
  scopes: readonly string[],
): Promise<(relPath: string) => boolean> {
  const set = new Set<string>();
  const walk = async (current: string): Promise<void> => {
    let entries: string[];
    try {
      entries = await fs.readdir(current);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(current, name);
      let isDir = false;
      try {
        isDir = (await fs.stat(full)).isDirectory();
      } catch {
        /* Coverage rationale:  -- defensive: same pattern as collectTestFiles (covered by collectTestFilesSkipsUnstatableEntries) but on a different walker */
        continue;
      }
      if (isDir) {
        await walk(full);
      } else {
        set.add(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  };
  for (const scope of scopes) {
    // path.resolve drops any trailing separator from `scope` (e.g. 'src/')
    // and yields a normalised absolute path that the ReadableFileSystem mock's
    // path.normalize lookup can match.
    await walk(path.resolve(root, scope));
  }
  return (rel: string): boolean => set.has(rel);
}

export async function scanTestBindings(opts: TestScanOptions): Promise<TestScanResult> {
  const scopes = opts.includeScopes ?? DEFAULT_INCLUDE_SCOPES;
  const files: string[] = [];
  for (const dir of opts.testDirs) {
    const abs = path.isAbsolute(dir) ? dir : path.join(opts.root, dir);
    files.push(...(await collectTestFiles(opts.fs, abs)));
  }

  // Pre-walk every scope dir so parseTestFile can prefer barrel resolution
  // when `<path>.ts` does not exist but `<path>/index.ts` does.
  const fileExists = await buildFileExistsPredicate(opts.fs, opts.root, scopes);

  const parsed: TestParseResult[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = await opts.fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    parsed.push(parseTestFile(src, file, opts.root, scopes, fileExists));
  }

  const agg = aggregateTestBindings({ parsed, classToId: opts.classToId });
  return {
    manifest: agg.manifest,
    warnings: agg.warnings,
    fileCount: files.length,
    methodCount: agg.methodCount,
    emptyMethods: agg.emptyMethods,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Diff (dual-run helper — compare inferred vs legacy manual manifest)
// ────────────────────────────────────────────────────────────────────────────

export interface ManifestDiff {
  featuresOnlyInManual: string[];
  featuresOnlyInInferred: string[];
  acsOnlyInManual: Array<{ featureId: string; ac: string }>;
  acsOnlyInInferred: Array<{ featureId: string; ac: string }>;
  symbolsOnlyInManual: Array<{ featureId: string; ac: string; target: SymbolTarget }>;
  symbolsOnlyInInferred: Array<{ featureId: string; ac: string; target: SymbolTarget }>;
}

export function diffManifests(manual: BindingsManifest, inferred: BindingsManifest): ManifestDiff {
  const diff: ManifestDiff = {
    featuresOnlyInManual: [],
    featuresOnlyInInferred: [],
    acsOnlyInManual: [],
    acsOnlyInInferred: [],
    symbolsOnlyInManual: [],
    symbolsOnlyInInferred: [],
  };

  const manualFeatures = new Set(Object.keys(manual));
  const inferredFeatures = new Set(Object.keys(inferred));

  for (const f of manualFeatures) if (!inferredFeatures.has(f)) diff.featuresOnlyInManual.push(f);
  for (const f of inferredFeatures) if (!manualFeatures.has(f)) diff.featuresOnlyInInferred.push(f);

  for (const featureId of manualFeatures) {
    // featureId comes from Object.keys(manual) so manual[featureId] is defined;
    // inferred[featureId] may still be undefined (feature only in manual).
    const manAcs = manual[featureId]!;
    const infAcs = inferred[featureId] ?? {};
    const allAcs = new Set([...Object.keys(manAcs), ...Object.keys(infAcs)]);
    for (const ac of allAcs) {
      const manTargets = manAcs[ac] ?? [];
      const infTargets = infAcs[ac] ?? [];
      const inInferred = Object.prototype.hasOwnProperty.call(infAcs, ac);
      const inManual = Object.prototype.hasOwnProperty.call(manAcs, ac);
      if (inManual && !inInferred) diff.acsOnlyInManual.push({ featureId, ac });
      if (inInferred && !inManual) diff.acsOnlyInInferred.push({ featureId, ac });

      const manKeys = new Set(manTargets.map(t => `${t.file}::${t.symbol}`));
      const infKeys = new Set(infTargets.map(t => `${t.file}::${t.symbol}`));
      for (const t of manTargets) {
        if (!infKeys.has(`${t.file}::${t.symbol}`)) {
          diff.symbolsOnlyInManual.push({ featureId, ac, target: t });
        }
      }
      for (const t of infTargets) {
        if (!manKeys.has(`${t.file}::${t.symbol}`)) {
          diff.symbolsOnlyInInferred.push({ featureId, ac, target: t });
        }
      }
    }
  }

  for (const featureId of inferredFeatures) {
    if (manualFeatures.has(featureId)) continue;
    // featureId comes from Object.keys(inferred) — definitely defined.
    const infAcs = inferred[featureId]!;
    for (const ac of Object.keys(infAcs)) {
      diff.acsOnlyInInferred.push({ featureId, ac });
      // ac comes from Object.keys(infAcs) — definitely defined.
      for (const t of infAcs[ac]!) {
        diff.symbolsOnlyInInferred.push({ featureId, ac, target: t });
      }
    }
  }

  return diff;
}
