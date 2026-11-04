<p align="center">
  <img src="./../../icons/logo.png" alt="Requirement-As-Code logo" width="150px" />
</p>

# @frenchexdev2/ts-codegen-pipeline

Multi-pass TypeScript source generation and static analysis, with a virtual filesystem and the `sourcegen` CLI.

## Role in the workspace

Generators inspect a TypeScript project and emit managed companion files in memory. The runner repeats generation until a fixpoint, runs optional analyzers on the converged project, then commits output files. This provides a Roslyn-inspired workflow for generated barrels, missing-AC test starters and custom generators.

## Quick start

Create `sourcegen.config.ts` in a consumer project:

```ts
import {
  defineConfig, PackageBarrelGenerator,
} from '@frenchexdev2/ts-codegen-pipeline';
import { builtinAnalyzers } from '@frenchexdev2/ts-codegen-pipeline/analyzers';

export default defineConfig({
  tsconfigPath: './tsconfig.json',
  consumerPackageRoot: import.meta.dirname,
  outDir: 'src',
  generators: [new PackageBarrelGenerator({ srcDir: 'src' })],
  analyzers: [...builtinAnalyzers],
});
```

With a local installation exposing the binary:

```sh
pnpm exec sourcegen run --config sourcegen.config.ts
pnpm exec sourcegen verify --config sourcegen.config.ts
pnpm exec sourcegen analyze --config sourcegen.config.ts --json
pnpm exec sourcegen list analyzers --config sourcegen.config.ts
pnpm exec sourcegen watch --config sourcegen.config.ts
```

`run` commits generated output after convergence and successful analyzer checks. `verify` compares expected generation with disk without committing. `analyze` runs diagnostics, `explain <code>` describes a configured diagnostic, and `watch` reruns the workflow for matching changes. Use `--help` for command-specific options.

From this workspace root, inspect the built CLI with:

```sh
pnpm --filter @frenchexdev2/ts-codegen-pipeline exec node bin/sourcegen-entry.mjs --help
```

## Built-in generators

**PackageBarrelGenerator** emits `index.generated.ts` re-exports for configured source modules, with exclusion and recursion options.

**TestStubGenerator** scans Feature declarations and existing decorated test bindings. It emits stubs for missing ACs, enriches comments from linked Requirement fit criteria and uses fast-check templates for supported property-style AC names. The fallback throws `SCAFFOLD_NOT_IMPLEMENTED:<acName>` so a generated starter cannot silently stand in for an implementation.

```ts
import { TestStubGenerator } from '@frenchexdev2/ts-codegen-pipeline';

const generator = new TestStubGenerator({
  testDirs: ['test'],
  scaffoldSubdir: 'scaffolds',
  specDirs: ['requirements/features', 'requirements/requirements'],
  fastCheckImport: 'fast-check',
});
```

Use an output directory such as `test/unit` when test discovery needs those files. Implement the test in a handwritten file; a later run removes its AC from the managed starter and purges an empty starter. Hand-editing a managed generated file changes its banner hash and is reported by `verify`.

## Custom generators and analyzers

Implement `SourceGenerator` with a stable `id` and an asynchronous `execute(context)` method. Emit through `context.virtFs.addSource`, use `withBanner` for managed content and return `emittedSomething` accurately. `findDecorated` supports inspecting `@Generate` declarations on supported class/member targets; the attribute is available from `/attributes`.

Generators run in lexicographic ID order. Re-emitting identical content is a no-op; a producer may update its own path, while a conflicting producer raises `SG0020`. The default iteration cap is 16; a non-converging run reports `SG0030`. Paths escaping `outDir` are rejected with `SG0040`.

Analyzers inspect the converged project with read-only virtual output. Error diagnostics prevent commit. The `/analyzers` entry point supplies rules for nonempty/unique generator IDs, diagnostic codes and direct filesystem access. `/testing` supplies in-memory project and analyzer assertion helpers.

## Commit and safety scope

Generation and analyzer failures before commit leave user files unwritten by the runner. During commit, output is staged into temporary sibling files and each final rename is atomic. The entire multi-file commit is **not** a rollback transaction: a later rename failure can leave earlier files updated. Stale managed generated files are purged after the new emissions are committed.

The virtual filesystem constrains emitted paths. Custom generator/analyzer JavaScript still executes in the host process; it is not sandboxed, and plugins must respect the injected-port design.

## Public surface and references

The root exports configuration/types, `runFixpoint`, generators, scanning/banner helpers, analyzer composition and filesystem ports. Additional entry points are `/attributes`, `/types`, `/analyzers` and `/testing`; see [package.json](package.json).

See [runner](src/runner/run-fixpoint.ts), [commit implementation](src/virtfs/commit.ts), [analyzer contracts](src/types.ts) and [requirements-scaffolders](../requirements-scaffolders/README.md) for related services. Earlier documentation referenced build-pipeline and sourcegen-example projects; those are not packages in this standalone workspace.
## Development and status

Unreleased ESM package in the standalone RaC workspace. From the `rac.ts` root, use Node.js `^22.22.0 || ^24.0.0 || >=26.0.0` and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @frenchexdev2/ts-codegen-pipeline test
pnpm compliance
```

See the [workspace README](../../README.md) for all checks and the [dated qualification report](../../CORRECTIONS-2026-11-03.md) for measured results and their scope.

## License

See the [FrenchExDev Educational License](../../LICENSE). Production use requires a separate commercial license under its terms.
