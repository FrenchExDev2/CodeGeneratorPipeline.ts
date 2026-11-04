import { expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as ts from 'typescript';
import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { PipelineArchitectureContractsFeature } from '../../requirements/features/architecture-contracts.js';
import * as api from '../../src/index.js';
import { builtinAnalyzers } from '../../src/analyze/builtin/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file: string) => readFile(resolve(root, file), 'utf8');
async function sources(directory: string): Promise<string[]> {
  return (await Promise.all((await readdir(resolve(root, directory), { withFileTypes: true })).map(entry =>
    entry.isDirectory() ? sources(`${directory}/${entry.name}`) : entry.name.endsWith('.ts') ? [`${directory}/${entry.name}`] : []))).flat();
}
function descendants(source: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(source); return nodes;
}
async function tree(file: string) { return ts.createSourceFile(file, await read(file), ts.ScriptTarget.Latest, true); }

@FeatureTest(PipelineArchitectureContractsFeature, { timeout: 120_000 })
class PipelineArchitectureContracts {
  @Verifies<PipelineArchitectureContractsFeature>('dependsOnlyOnSharedKernel')
  async dependsOnlyOnSharedKernel() {
    const kernel = '@frenchexdev2/requirements-shared-kernel';
    for (const manifestPath of ['package.json', '../../package.json']) {
      const manifest = JSON.parse(await read(manifestPath));
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const [name, version] of Object.entries(manifest[section] ?? {})) {
          if (!name.startsWith('@frenchexdev2/')) continue;
          if (manifestPath === '../../package.json' && name === '@frenchexdev2/ts-codegen-pipeline') {
            expect(version).toBe('workspace:*');
          } else {
            expect(name).toBe(kernel);
            expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
          }
        }
      }
    }
    for (const directory of ['src', 'requirements', 'test']) for (const file of await sources(directory)) {
      for (const node of descendants(await tree(file))) {
        let specifier: ts.Expression | undefined;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) specifier = node.arguments[0];
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal as ts.Expression;
        if (!specifier || !ts.isStringLiteralLike(specifier)) continue;
        const name = specifier.text;
        if (name.startsWith('@frenchexdev2/')) expect(name === kernel || name.startsWith(`${kernel}/`) || name === '@frenchexdev2/ts-codegen-pipeline' || name.startsWith('@frenchexdev2/ts-codegen-pipeline/'), file).toBe(true);
        expect(name, file).not.toMatch(/(?:^|[/\\])Requirements\.ts(?:[/\\]|$)/);
      }
    }
    expect(await read('src/generators/test-stub.ts')).toContain(`from '${kernel}'`);
  }

  @Verifies<PipelineArchitectureContractsFeature>('separatesBuiltinAnalyzerExportsAndPreservesConfigIdentity')
  async separatesBuiltinAnalyzerExportsAndPreservesConfigIdentity() {
    const manifest = JSON.parse(await read('package.json'));
    expect(manifest.exports).toHaveProperty('./analyzers'); expect(manifest.exports).toHaveProperty('./testing');
    expect(builtinAnalyzers.length).toBeGreaterThan(0);
    expect(api).not.toHaveProperty('builtinAnalyzers');
    for (const analyzer of builtinAnalyzers) expect(Object.values(api)).not.toContain(analyzer.constructor);
    const rootExports = (await tree('src/index.ts')).statements.filter(ts.isExportDeclaration);
    expect(rootExports.some(node => node.moduleSpecifier && /(?:\/analyzers|\/analyze\/builtin)/.test(node.moduleSpecifier.getText()))).toBe(false);
    const config: api.SourceGenConfig = { tsconfigPath: '/consumer/tsconfig.json', consumerPackageRoot: '/consumer', generators: [] };
    expect(api.defineConfig(config)).toBe(config);
    expect(config.generators).toEqual([]);
  }

  @Verifies<PipelineArchitectureContractsFeature>('emissionHasNoWallClockAndHashesOnlyBody')
  async emissionHasNoWallClockAndHashesOnlyBody() {
    for (const directory of ['src/emit', 'src/generators', 'src/runner', 'src/virtfs']) {
      for (const file of await sources(directory)) expect(descendants(await tree(file)).filter(node => ts.isIdentifier(node) && node.text === 'Date'), file).toEqual([]);
    }
    const body = 'export const accent = "é😀";\n';
    const expected = createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 12);
    for (const [producerId, iteration] of [['first', 0], ['other', 99]] as const) {
      const generated = api.withBanner(body, { producerId, iteration });
      expect(api.extractMeta(generated)).toEqual({ producerId, iteration, contentHash: expected });
      expect(api.extractBody(generated)).toBe(body);
    }
  }

  @Verifies<PipelineArchitectureContractsFeature>('projectsStayInMemoryAndWritesStayBehindCommit')
  async projectsStayInMemoryAndWritesStayBehindCommit() {
    const constructors: string[] = [], diskWrites: string[] = [];
    for (const file of await sources('src')) for (const node of descendants(await tree(file))) {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Project') {
        constructors.push(file);
        const options = node.arguments?.[0];
        expect(options && ts.isObjectLiteralExpression(options), file).toBe(true);
        expect((options as ts.ObjectLiteralExpression).properties.some(property => ts.isPropertyAssignment(property) && property.name.getText() === 'useInMemoryFileSystem' && property.initializer.kind === ts.SyntaxKind.TrueKeyword), file).toBe(true);
      }
      if (ts.isCallExpression(node) && (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression))) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text : node.expression.name.text;
        if (['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'createWriteStream', 'mkdir', 'mkdirSync', 'rename', 'renameSync', 'unlink', 'unlinkSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync', 'truncate', 'truncateSync'].includes(name)) diskWrites.push(file);
      }
    }
    expect(constructors).toContain('src/virtfs/create.ts');
    expect([...new Set(diskWrites)].sort()).toEqual(['src/ports/file-system.ts', 'src/virtfs/commit.ts']);
  }

  @Verifies<PipelineArchitectureContractsFeature>('codemodMutationIsSeparateFromEmissionApi')
  async codemodMutationIsSeparateFromEmissionApi() {
    for (const name of ['renameFeature', 'renameRequirement', 'renameAc', 'runRename']) expect(api).not.toHaveProperty(name);
    for (const file of await sources('src')) {
      const imports = (await tree(file)).statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.getText());
      expect(imports.filter(name => name.includes('rename-core')), file).toEqual([]);
    }
    const declaration = (await tree('src/types.ts')).statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'VirtFs');
    expect(declaration).toBeDefined();
    expect(declaration!.members.map(member => member.name!.getText()).sort()).toEqual(['addSource', 'has', 'listEmitted', 'read']);
  }
}
