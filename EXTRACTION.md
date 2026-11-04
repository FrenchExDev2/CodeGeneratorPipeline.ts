# Extraction validation — 2026-11-03

`ts-codegen-pipeline` now belongs to the independent `CodeGenerationPipeline.ts` pnpm workspace. Its only FrenchExDev dependency is `requirements-shared-kernel@0.0.1`. The generic AST engine is exported through `./test-bindings-scanner`; Requirements retains its public scanner API as a facade over `ts-codegen-pipeline@0.0.1`.

Dependencies between the workspaces use exact manifest versions and retained archives under `vendor/packages/`, with SHA-512 metadata and version-qualified overrides. Frozen offline installations passed in both Windows workspaces and in the independent Linux producer. The old producer directory is absent; built JavaScript/declarations contain no core/scanner/styles/compliance dependency.

The producer passed 426 tests on Windows and 426 on Linux. Both platforms passed builds, test/contract type checking and production installation in an isolated consumer (six exports and the sourcegen CLI). Coverage within the existing package scope is 1163/1163 lines, 1399/1399 statements, 210/210 functions and 867/867 branches on both platforms. The scope still excludes CLI implementation, index files and type declarations; no exclusion was added to obtain these results.

The archive transport test also passed on both platforms after checking relative paths following Set-Location, identical archive synchronization, independently computed SHA-512 and rejection of changed bytes under the same version. The facade's 122 tests, the consumer library's 147 tests, the workspace's 21 integration tests, build and type checks passed on Windows in `Requirements.ts/test-results/extraction-bridge-verified/`. The facade and library re-export coverage have zero executable local statements; their 0/0 measurements do not establish a separate code-coverage achievement.

Complete machine-readable evidence selection is in [extraction-validation.json](test-results/extraction-validation.json). Historical failed campaigns remain retained. Follow-up checks fixed a residual fuzz-helper import, incomplete contract metadata, shared Vitest cache invalidation, a terminal-width-dependent error-message assertion and an omitted licence in the Linux staging copy. A parsing test exceeded its unchanged five-second limit under concurrent load; the final consumer campaign passed with the established two-worker-per-package configuration. Linux JSON and coverage reports have been copied back alongside the host logs.

Visible monitor windows were opened for every test campaign and close automatically after saving terminal summaries. A retained monitor can be reopened with:

```powershell
pwsh -NoProfile -File test-results/extraction-transport-verified-linux/Watch-Audit.ps1 -StatePath test-results/extraction-transport-verified-linux/state.json -AdditionalStatePath test-results/extraction-transport-verified-windows/state.json
```

This report validates the extraction and dependency boundary. It does not establish complete AC-level qualification, whole-product 100% executable coverage or a complete standard Stryker score of 100%. The larger Requirements self-qualification remains unfinished. No package has been published and no commit has been created.
