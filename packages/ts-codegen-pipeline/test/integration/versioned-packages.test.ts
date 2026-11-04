import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { PipelineArchitectureContractsFeature } from '../../requirements/features/architecture-contracts.js';

const execute = promisify(execFile);
const source = fileURLToPath(new URL('../../', import.meta.url));
const synchronizer = fileURLToPath(new URL('../../../../scripts/Sync-VersionedPackage.ps1', import.meta.url));

@FeatureTest(PipelineArchitectureContractsFeature, { timeout: 120_000 })
class VersionedPackageTransportTests {
  @Verifies<PipelineArchitectureContractsFeature>('preservesImmutableVersionedArchives')
  async preservesImmutableVersionedArchives() {
    const consumer = await mkdtemp(join(tmpdir(), 'pipeline-version-é-'));
    try {
      await writeFile(join(consumer, 'pnpm-workspace.yaml'), 'packages: []\noverrides: {}\n', 'utf8');
      const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
      const launcher = join(consumer, 'sync-from-location.ps1');
      await writeFile(launcher, `# Objectif : vérifier les chemins relatifs après Set-Location.
param([string]$Synchronizer,[string]$Directory,[string]$Package)
$utf8=[Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=$utf8;[Console]::OutputEncoding=$utf8;$OutputEncoding=$utf8
Set-Location -LiteralPath $Directory
& $Synchronizer -SourcePackage $Package -ConsumerWorkspace .
`, 'utf8');
      const args = ['-NoProfile', '-File', launcher, '-Synchronizer', synchronizer, '-Directory', consumer, '-Package', relative(consumer, source)];
      await execute('pwsh', args, { encoding: 'utf8', timeout: 45_000 });
      const archive = join(consumer, 'vendor/packages', `${manifest.name.slice(1).replace('/', '-')}-${manifest.version}.tgz`);
      const original = await readFile(archive);
      const metadata = JSON.parse(await readFile(`${archive}.json`, 'utf8'));
      expect(metadata).toMatchObject({ name: manifest.name, version: manifest.version });
      expect(metadata.sha512).toMatch(/^[a-f0-9]{128}$/);
      expect(metadata.sha512).toBe(createHash('sha512').update(original).digest('hex'));
      expect(await readFile(join(consumer, 'pnpm-workspace.yaml'), 'utf8')).toContain(`'${manifest.name}@${manifest.version}': 'file:vendor/packages/`);
      await execute('pwsh', args, { encoding: 'utf8', timeout: 45_000 });
      expect(await readFile(archive)).toEqual(original);
      await writeFile(archive, Buffer.concat([original, Buffer.from('changed')]));
      let failure: { code?: number | string; stderr?: string } | undefined;
      try { await execute('pwsh', args, { encoding: 'utf8', timeout: 45_000 }); }
      catch (error) { failure = error as typeof failure; }
      expect(failure?.code).toBe(1);
      // PowerShell inserts terminal-width-dependent line breaks and | prefixes.
      const message = (failure?.stderr ?? '').replace(/\x1b\[[0-9;]*m/g, '').replace(/\r?\n[ \t]*\|[ \t]*/g, ' ').replace(/\s+/g, ' ');
      expect(message).toContain('already exists with different content. Increment the package version before synchronizing.');
      expect(await readFile(archive)).toEqual(Buffer.concat([original, Buffer.from('changed')]));
    } finally { await rm(consumer, { recursive: true, force: true }); }
  }
}
