import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * CLI exposes new sub-commands (`analyze`, `list analyzers`,
 * `explain <code>`) and a richer formatter: `path:line:col` clickable
 * locations, color by severity, grouping by file, footer perf summary,
 * `--json` machine output, `--no-color` opt-out.
 */
export abstract class ReqTscpAnalyzerCliRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-CLI';
  readonly title = 'CLI subcommands and rich diagnostic formatter';
  readonly priority = Priority.Medium;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When the user invokes the sourcegen CLI,',
    response: '`npx sourcegen analyze` shall load the config and run analyzers without invoking generators, building the Project from disk. `--only <id>` shall execute exactly one analyzer; an unknown id shall produce an explicit error and non-zero exit. `npx sourcegen list analyzers` shall print one row per registered analyzer with `id · description`. `npx sourcegen explain <code>` shall print the description and docsUrl of the analyzer owning that code; an unknown code shall produce an explicit error. The diagnostic formatter shall: print location as `path:line:col` (path relative to consumerPackageRoot); colorize by severity (red error / yellow warning / cyan info), respecting `--no-color`; group consecutive diagnostics under a per-file header; emit a footer summary `<errors> errors, <warnings> warnings · <N> analyzers ran in <total>ms (slowest: <id> <ms>ms)`; print related locations indented under the parent diagnostic; with `--json`, emit a machine-readable object `{ diagnostics, timings }` instead of human format.',
  };

  readonly rationale = {
    claim: 'Clickable path:line:col is the primary affordance modern terminals offer for fast navigation; without it analyzers are unactionable in practice. Grouping by file matches how humans read diagnostics. Perf footer surfaces slow analyzers immediately. JSON output is the integration boundary for CI tooling.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — DX baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: '`analyze` subcommand invokes runAnalyzers but never invokes any generator.',
      binds: ['analyzeSubcommandSkipsGenerators'] },
    { kind: 'unit-test' as const,
      describes: '`analyze --only <id>` runs only the specified analyzer.',
      binds: ['onlyFlagRunsSingleAnalyzer'] },
    { kind: 'unit-test' as const,
      describes: '`analyze --only <unknown-id>` produces an explicit error and non-zero exit.',
      binds: ['onlyFlagUnknownIdErrors'] },
    { kind: 'unit-test' as const,
      describes: '`list analyzers` prints one line per registered analyzer with id and description.',
      binds: ['listSubcommandPrintsRegisteredAnalyzers'] },
    { kind: 'unit-test' as const,
      describes: '`explain <code>` prints description and docsUrl of the analyzer.',
      binds: ['explainPrintsDocForKnownCode'] },
    { kind: 'unit-test' as const,
      describes: '`explain <unknown-code>` produces an explicit error.',
      binds: ['explainUnknownCodeErrors'] },
    { kind: 'unit-test' as const,
      describes: 'Diagnostic location matches the regex `[^:]+:\\d+:\\d+` (path:line:col).',
      binds: ['locationFormatPathLineCol'] },
    { kind: 'unit-test' as const,
      describes: 'Path printed in location is relative to consumerPackageRoot.',
      binds: ['locationPathRelativeToConsumerRoot'] },
    { kind: 'unit-test' as const,
      describes: 'Color codes are emitted by default on TTY and absent under `--no-color`.',
      binds: ['noColorFlagProducesAsciiPure'] },
    { kind: 'unit-test' as const,
      describes: 'Two diagnostics on the same file appear under a single per-file header.',
      binds: ['groupingByFileHeader'] },
    { kind: 'unit-test' as const,
      describes: 'Footer line includes `<errors> errors, <warnings> warnings`.',
      binds: ['footerCountsBySeverity'] },
    { kind: 'unit-test' as const,
      describes: 'Footer line includes `slowest: <id>` when at least one analyzer ran.',
      binds: ['footerHasSlowest'] },
    { kind: 'unit-test' as const,
      describes: '`--json` output is parseable JSON conforming to the documented schema { diagnostics, timings }.',
      binds: ['jsonFlagProducesValidJson'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Diagnostics are unactionable; users cannot iterate quickly on a single analyzer; CI cannot integrate; ecosystem adoption stalls.',
  };
}
