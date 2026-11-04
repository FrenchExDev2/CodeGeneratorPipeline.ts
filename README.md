# CodeGenerationPipeline.ts

> **Dep locale:** `@frenchexdev2/requirements-shared-kernel` est resolve via override `link:../SharedKernel.ts/packages/requirements-shared-kernel`.

Independent pnpm workspace containing `@frenchexdev2/ts-codegen-pipeline@0.0.1`.
The package was moved from `Requirements.ts/packages/ts-codegen-pipeline` without deleting its source history or previous test results. The move inventory is retained in `provenance/requirements-workspace-extraction.json`.

Its only external FrenchExDev dependency is `@frenchexdev2/requirements-shared-kernel@0.1.0`. This applies to runtime code, contracts, generated test imports and test support. Third-party dependencies include TypeScript, ts-morph, commander and chokidar. The root workspace references its own package with `workspace:*`.

The generic test-binding AST engine is exported as `@frenchexdev2/ts-codegen-pipeline/test-bindings-scanner`. Requirements consumes this versioned export through its existing `requirements-scanner` facade. The dependency direction is:

```text
Requirements -> ts-codegen-pipeline -> requirements-shared-kernel
```

## Install and validate

Use the Node engine range and pnpm version pinned in `package.json`. Dependencies come from npmjs.org. Follow [RELEASE.md](RELEASE.md) for the initial registry publication and lockfile migration before a frozen installation.

```powershell
pnpm install --frozen-lockfile
pwsh -NoProfile -File scripts/Invoke-Audit.ps1 -Phase Extraction -MaxParallel 2
```

The audit builds the package, runs its decorated unit/integration/fuzz tests with coverage, checks test/contract types, then installs a packed production archive in an isolated Unicode-path consumer. It opens a visible monitoring window, closes it when all checks terminate, and retains logs and summaries in `test-results/`. The returned `Reopen` command opens the retained monitor again.

The package coverage configuration states its exact scope. Passing this campaign does not establish complete Windows/Linux qualification, full AC-level evidence or a complete 100% mutation score. The Requirements qualification engine remains external tooling; it is not a dependency of this producer.

## Versioned dependencies

Manifest dependencies use exact npm versions. The shared kernel is consumed as `@frenchexdev2/requirements-shared-kernel@0.1.0`; no local archive override or cross-workspace source link is used. Publish the independent kernel first, then regenerate and commit this workspace's registry lockfile.

To update a dependency, change its exact version in the consumer manifests, regenerate `pnpm-lock.yaml`, then build and test the consumer. The old `Sync-VersionedPackage.ps1` entry point now stops with migration instructions.

## GitHub Actions and npm releases

See [RELEASE.md](RELEASE.md) for the `NPM_TOKEN` secret, committed release preparation, Windows/Linux checks, stable and prerelease tags, and the initial publication order. A `vX.Y.Z` tag must match the committed package versions. CI never bumps them during publication.
The detailed package API remains in [the package README](packages/ts-codegen-pipeline/README.md).

See [the extraction validation and retained evidence](EXTRACTION.md).

> **Dep locale:** @frenchexdev2/requirements-shared-kernel est resolve via override link:../SharedKernel.ts/packages/requirements-shared-kernel.
