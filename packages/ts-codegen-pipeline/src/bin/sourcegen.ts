#!/usr/bin/env node
import { Command } from 'commander';
import * as chokidar from 'chokidar';
import * as path from 'node:path';
import * as url from 'node:url';
import { access } from 'node:fs/promises';
import { runFixpoint } from '../runner/run-fixpoint.js';
import { runAnalyzers } from '../analyze/run-analyzers.js';
import { createVirtFs } from '../virtfs/create.js';
import { shouldIgnore } from '../watch/should-ignore.js';
import { matchesAnyGlob, watchRootsFor } from '../watch/glob-watch.js';
import { Coalescer } from '../watch/coalescer.js';
import {
  formatDiagnostics,
  formatFooter,
  buildFooterInfo,
} from './format-diagnostics.js';
import type {
  Analyzer,
  Diagnostic,
  RunOutcome,
  SourceGenConfig,
} from '../types.js';

interface CommonFlags {
  readonly noColor?: boolean;
  readonly json?: boolean;
}

function consoleLogger(flags: CommonFlags) {
  return {
    info(m: string) { if (flags.json) console.error(m); else console.log(m); },
    warn(m: string) { console.warn(m); },
  };
}

let configReload = 0;
async function loadConfig(configPath: string): Promise<SourceGenConfig> {
  const abs = path.resolve(process.cwd(), configPath);
  try { await access(abs); } catch {
    throw new Error(`sourcegen: config not found at ${abs}`);
  }
  const fileUrl = url.pathToFileURL(abs);
  fileUrl.searchParams.set('sourcegenReload', String(++configReload));
  const mod = await import(fileUrl.href);
  const cfg = mod.default ?? mod;
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.generators)) {
    throw new Error(`sourcegen: ${configPath} did not export a SourceGenConfig`);
  }
  return cfg as SourceGenConfig;
}

function shouldUseColor(flags: CommonFlags): boolean {
  if (flags.noColor) return false;
  return process.stdout.isTTY === true;
}

function reportOutcome(outcome: RunOutcome, cfg: SourceGenConfig, flags: CommonFlags): void {
  if (flags.json) {
    const out = {
      ok: outcome.ok,
      committed: outcome.committed ?? false,
      iterations: outcome.iterations,
      diagnostics: outcome.diagnostics,
      timings: outcome.analyzerTimings ? Object.fromEntries(outcome.analyzerTimings) : {},
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const color = shouldUseColor(flags);
  const body = formatDiagnostics(outcome.diagnostics, {
    color,
    consumerPackageRoot: cfg.consumerPackageRoot,
  });
  if (body.length > 0) console.log(body);
  const footer = formatFooter(buildFooterInfo(outcome.diagnostics, outcome.analyzerTimings), color);
  console.log(footer);
}

function reportAnalyzeOnly(
  diagnostics: readonly Diagnostic[],
  timings: ReadonlyMap<string, number>,
  cfg: SourceGenConfig,
  flags: CommonFlags,
): void {
  if (flags.json) {
    console.log(JSON.stringify({
      diagnostics,
      timings: Object.fromEntries(timings),
    }, null, 2));
    return;
  }
  const color = shouldUseColor(flags);
  const body = formatDiagnostics(diagnostics, { color, consumerPackageRoot: cfg.consumerPackageRoot });
  if (body.length > 0) console.log(body);
  console.log(formatFooter(buildFooterInfo(diagnostics, timings), color));
}

/** Create an isolated command tree; importing this module never dispatches a command. */
export function createSourcegenProgram(): Command {
const program = new Command();
program
  .name('sourcegen')
  .description('Roslyn-style multi-stage TypeScript source generator pipeline')
  .version('0.0.1');

program
  .command('run')
  .description('Execute the pipeline (generators + analyzers) to fixpoint and commit')
  .option('-c, --config <path>', 'Path to sourcegen.config.ts (or .js)', 'sourcegen.config.ts')
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Emit machine-readable JSON instead of human format')
  .action(async (opts: { config: string; color: boolean; json?: boolean }) => {
    const flags: CommonFlags = { noColor: !opts.color, json: opts.json };
    try {
      const cfg = await loadConfig(opts.config);
      const outcome = await runFixpoint(cfg, { logger: consoleLogger(flags) });
      reportOutcome(outcome, cfg, flags);
      process.exitCode = outcome.ok ? 0 : 1;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1; return;
    }
  });

program
  .command('verify')
  .description('Execute pipeline in-memory only and compare to disk; never writes')
  .option('-c, --config <path>', 'Path to sourcegen.config.ts', 'sourcegen.config.ts')
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Emit machine-readable JSON')
  .action(async (opts: { config: string; color: boolean; json?: boolean }) => {
    const flags: CommonFlags = { noColor: !opts.color, json: opts.json };
    try {
      const cfg = await loadConfig(opts.config);
      const outcome = await runFixpoint(cfg, { verifyOnly: true, logger: consoleLogger(flags) });
      reportOutcome(outcome, cfg, flags);
      if (outcome.ok) { process.exitCode = 0; return; }
      const hasDrift = outcome.diagnostics.some(d => d.code === 'SG0010' || d.code === 'SG0011');
      process.exitCode = hasDrift ? 2 : 1;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1; return;
    }
  });

program
  .command('analyze')
  .description('Run analyzers only (skip generator fixpoint); useful when iterating on an analyzer')
  .option('-c, --config <path>', 'Path to sourcegen.config.ts', 'sourcegen.config.ts')
  .option('--only <id>', 'Run only the analyzer with this id')
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Emit machine-readable JSON')
  .action(async (opts: { config: string; only?: string; color: boolean; json?: boolean }) => {
    const flags: CommonFlags = { noColor: !opts.color, json: opts.json };
    try {
      const cfg = await loadConfig(opts.config);
      const all = cfg.analyzers ?? [];
      const selected = opts.only
        ? all.filter(a => a.id === opts.only)
        : all;
      if (opts.only && selected.length === 0) {
        console.error(`sourcegen: no analyzer registered with id '${opts.only}'`);
        process.exitCode = 1; return;
      }
      const outDir = path.resolve(cfg.consumerPackageRoot, cfg.outDir ?? 'generated');
      const handle = await createVirtFs({
        tsconfigPath: cfg.tsconfigPath,
        consumerPackageRoot: cfg.consumerPackageRoot,
        outDir,
      });
      const result = await runAnalyzers(selected, {
        project: handle.project,
        virtFs: handle.virtFs,
        consumerPackageRoot: cfg.consumerPackageRoot,
        outDir,
        logger: consoleLogger(flags),
        slowThresholdMs: cfg.slowAnalyzerThresholdMs,
      });
      reportAnalyzeOnly(result.diagnostics, result.timings, cfg, flags);
      const hasError = result.diagnostics.some(d => d.severity === 'error');
      process.exitCode = hasError ? 1 : 0;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1; return;
    }
  });

program
  .command('list')
  .description('List registered analyzers from the loaded config')
  .argument('<what>', 'What to list (only `analyzers` is supported)')
  .option('-c, --config <path>', 'Path to sourcegen.config.ts', 'sourcegen.config.ts')
  .action(async (what: string, opts: { config: string }) => {
    if (what !== 'analyzers') {
      console.error(`sourcegen list: '${what}' is not a known target. Try: list analyzers`);
      process.exitCode = 1; return;
    }
    try {
      const cfg = await loadConfig(opts.config);
      const all = cfg.analyzers ?? [];
      if (all.length === 0) {
        console.log('(no analyzers registered)');
        return;
      }
      for (const a of all) {
        const desc = a.description ?? '';
        console.log(`${a.id}  ${desc}`);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1; return;
    }
  });

program
  .command('explain')
  .description('Print the description and docsUrl of the analyzer owning a given diagnostic code')
  .argument('<code>', 'Diagnostic code, e.g. AN0100')
  .option('-c, --config <path>', 'Path to sourcegen.config.ts', 'sourcegen.config.ts')
  .action(async (code: string, opts: { config: string }) => {
    try {
      const cfg = await loadConfig(opts.config);
      const all = cfg.analyzers ?? [];
      // Match either by analyzer.id (rare) or by reverse-lookup of the code prefix.
      // Convention: the analyzer id contains a substring related to the code in
      // the README; simplest reliable lookup is by id.
      const found = all.find(a => a.id === code) ?? findByCodePrefix(all, code);
      if (!found) {
        console.error(`sourcegen explain: no analyzer found for '${code}'`);
        process.exitCode = 1; return;
      }
      console.log(`${found.id}`);
      if (found.description) console.log(found.description);
      if (found.docsUrl) console.log(found.docsUrl);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1; return;
    }
  });

function findByCodePrefix(all: readonly Analyzer[], code: string): Analyzer | undefined {
  // Builtin convention: analyzer id slug → look up by docsUrl anchor or
  // by id substring matching the code's tail. Simplest heuristic for v0:
  // pick the analyzer whose id contains the code's lowercase form, or
  // (for the four builtins) match the well-known mapping below.
  const builtinMap: Record<string, string> = {
    AN0100: 'analyzer:generator-id-non-empty',
    AN0101: 'analyzer:generator-id-unique',
    AN0110: 'analyzer:diagnostic-has-code',
    AN0120: 'analyzer:no-direct-fs',
  };
  const mapped = builtinMap[code];
  if (mapped) return all.find(a => a.id === mapped);
  return undefined;
}

program
  .command('watch')
  .description('Watch consumer src/spec dirs and re-run on changes (debounced, chokidar)')
  .option('-c, --config <path>', 'Path to sourcegen.config.ts', 'sourcegen.config.ts')
  .option('-d, --debounce <ms>', 'Debounce in ms', '250')
  .option('-w, --watch <glob...>',
    'Globs to watch (relative to consumer root). Default: src/**/*.ts + requirements/**/*.ts')
  .option('--no-color', 'Disable colored output')
  .option('--json', 'Emit machine-readable JSON')
  .option('--no-analyzers', 'Skip the analyzer phase during watch cycles')
  .action(async (opts: {
    config: string; debounce: string; watch?: string[];
    color: boolean; json?: boolean; analyzers: boolean;
  }) => {
    const flags: CommonFlags = { noColor: !opts.color, json: opts.json };
    const debounceMs = Number(opts.debounce);
    const cfg = await loadConfig(opts.config);
    const root = cfg.consumerPackageRoot;
    const outDirAbs = path.resolve(root, cfg.outDir ?? 'generated');
    const outDirPosix = outDirAbs.replace(/\\/g, '/');

    const watchGlobs = (opts.watch && opts.watch.length > 0
      ? opts.watch
      : ['src/**/*.ts', 'requirements/**/*.ts']
    ).map(g => path.resolve(root, g).replace(/\\/g, '/'));

    const coalescer = new Coalescer({
      debounceMs,
      run: async (reason) => {
        try {
          console.log(`\n[watch] ${reason} — re-running`);
          const fresh = await loadConfig(opts.config);
          // `--no-analyzers` strips analyzers from the cycle.
          const cycleCfg: SourceGenConfig = opts.analyzers === false
            ? { ...fresh, analyzers: [] }
            : fresh;
          const outcome = await runFixpoint(cycleCfg, { logger: consoleLogger(flags) });
          reportOutcome(outcome, cycleCfg, flags);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
        }
      },
    });

    // chokidar dropped glob support in v4, so watch the concrete base directory
    // of each pattern and re-apply the pattern as an event filter. The filter
    // cannot live in `ignored` — that predicate also runs for directories, and
    // a directory never matches `**/*.ts`, which would prune the traversal.
    const watchRoots = watchRootsFor(watchGlobs);

    const onEvent = (event: string, filePath: string) => {
      if (!matchesAnyGlob(filePath, watchGlobs)) return;
      const rel = path.relative(root, filePath).replace(/\\/g, '/');
      coalescer.notify(`${event} ${rel}`);
    };

    const watcher = chokidar.watch(watchRoots, {
      ignoreInitial: true,
      ignored: (p: string): boolean => shouldIgnore(p, outDirPosix),
    });

    watcher.on('add', p => onEvent('add', p));
    watcher.on('change', p => onEvent('change', p));
    watcher.on('unlink', p => onEvent('unlink', p));

    console.log(`Watching ${watchRoots.length} dir(s) for ${watchGlobs.length} pattern(s) (debounce ${debounceMs}ms, ignoring ${outDirPosix})`);
    for (const g of watchGlobs) console.log(`  - ${g}`);
    process.once('SIGINT', () => {
      console.log('\n[watch] shutting down');
      void (async () => {
        await coalescer.close();
        await watcher.close();
        process.exitCode = 0;
      })().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
    });
    await coalescer.runNow('initial run');
  });

return program;
}

/** Await every action and preserve its process exit status. */
export async function main(argv: string[] = process.argv): Promise<void> {
  const args = argv[2] === '--' ? [...argv.slice(0, 2), ...argv.slice(3)] : argv;
  try { await createSourcegenProgram().parseAsync(args); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === url.pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
