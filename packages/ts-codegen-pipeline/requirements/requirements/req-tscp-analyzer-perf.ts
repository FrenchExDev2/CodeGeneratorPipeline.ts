import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Per-analyzer execution time is collected and surfaced; a configurable
 * threshold triggers a warning when an analyzer is too slow. Pure
 * observability — no enforcement.
 */
export abstract class ReqTscpAnalyzerPerfRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-PERF';
  readonly title = 'Per-analyzer perf timings collected and surfaced';
  readonly priority = Priority.Low;
  readonly status = 'Approved' as const;
  readonly kind = 'NonFunctional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'runAnalyzers shall measure `performance.now()` around each `analyze()` invocation and return `timings: ReadonlyMap<analyzerId, durationMs>`. The CLI footer shall identify the slowest analyzer (`slowest: <id> <ms>ms`). A configurable threshold (default 1000ms) shall trigger a warning when any analyzer exceeds it; no execution shall be aborted by the threshold.',
  };

  readonly rationale = {
    claim: 'Perf observability lets users detect quadratic analyzers before they accumulate. Surfacing the slowest in the footer focuses attention. Threshold warnings catch regressions without forcing a hard limit (which would be brittle across hardware).',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — DX baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'After runAnalyzers with N analyzers, `timings.size === N` and every analyzer.id is a key.',
      binds: ['timingsMapHasEveryAnalyzerId'] },
    { kind: 'unit-test' as const,
      describes: 'Timing values are non-negative numbers (ms).',
      binds: ['timingsAreNonNegative'] },
    { kind: 'unit-test' as const,
      describes: 'CLI footer line contains `slowest: <id>` after a non-empty analyzer run.',
      binds: ['cliFooterIncludesSlowest'] },
    { kind: 'unit-test' as const,
      describes: 'An analyzer that artificially sleeps past the threshold yields a warning diagnostic with code `AN9001`.',
      binds: ['thresholdExceededYieldsWarning'] },
    { kind: 'unit-test' as const,
      describes: 'The threshold is overridable through the runner options / config.',
      binds: ['thresholdOverridable'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'Low' as const,
    ifNotMet: 'Slow analyzers go undetected and accumulate; users cannot identify the bottleneck without external profiling.',
  };
}
