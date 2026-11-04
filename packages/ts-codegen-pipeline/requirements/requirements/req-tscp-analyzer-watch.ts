import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Watch mode re-runs analyzers as part of every cycle by default,
 * keeping the dev feedback loop tight. `--no-analyzers` opts out.
 */
export abstract class ReqTscpAnalyzerWatchRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-WATCH';
  readonly title = 'Watch mode re-runs analyzers per cycle by default';
  readonly priority = Priority.Medium;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'event-driven' as const,
    feature: 'When `sourcegen watch` is running and a file change triggers a debounced cycle,',
    response: 'the cycle shall execute the full pipeline including analyzers (generators-fixpoint → analyzers → optionally commit). The `--no-analyzers` flag shall opt out, executing only the generator fixpoint and commit. Diagnostics from analyzers shall be reported with the same formatter used by `run`.',
  };

  readonly rationale = {
    claim: 'A watch loop that does not re-run analyzers forces users to manually re-trigger to see analyzer feedback, breaking the interactive dev loop. Default-on aligns with developer expectation; opt-out covers the case where analyzers are too slow at scale.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — DX baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Watch mode cycle invokes runAnalyzers after each generator fixpoint convergence.',
      binds: ['watchCycleRunsAnalyzers'] },
    { kind: 'unit-test' as const,
      describes: 'A burst of file events is coalesced into a single watch cycle by the existing Coalescer.',
      binds: ['watchDebounceCoalescesBurst'] },
    { kind: 'unit-test' as const,
      describes: 'With `--no-analyzers`, runAnalyzers is not invoked during the cycle.',
      binds: ['noAnalyzersFlagSkipsAnalyzersInWatch'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'Medium' as const,
    ifNotMet: 'Interactive dev loop is broken; users disable analyzers entirely or stop using watch.',
  };
}
