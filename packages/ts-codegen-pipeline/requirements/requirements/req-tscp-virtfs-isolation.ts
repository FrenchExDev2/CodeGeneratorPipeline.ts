import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Root Requirement for the virtFS isolation property: nothing touches the
 * real disk during iteration. Other REQ-TSCP-* @Refines this when scoped
 * to commit semantics.
 */
export abstract class ReqTscpVirtfsIsolationRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-VIRTFS-ISOLATION';
  readonly title = 'The real disk must not be modified at any point during the fixpoint loop iterations';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Constraint' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'During fixpoint iterations, all generator emissions shall live in an in-memory ts-morph project (`useInMemoryFileSystem: true`). No file outside this in-memory FS shall be created, modified, or deleted before the fixpoint is reached. The disk is read-only from the runner\'s perspective during iteration.',
  };

  readonly rationale = {
    claim: 'If any iteration writes to the real disk, a mid-build failure leaves a partially-written outDir that must be reasoned about and cleaned up. By keeping all writes in memory until the fixpoint is reached, the disk stays clean by construction on failure.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — clean-failure semantics 2026-05-02', recordedAt: '2026-05-02' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Snapshot the outDir before runFixpoint; abort the runner mid-iteration via a thrown generator; verify the outDir is byte-identical to its pre-run snapshot.',
      binds: ['midIterationThrowLeavesDiskUntouched'] },
    { kind: 'unit-test' as const,
      describes: 'During a successful run, outDir is unchanged until the very last step (commit phase).',
      binds: ['noWriteUntilCommitPhase'] },
    { kind: 'unit-test' as const, describes: 'Every ts-morph Project constructed by the pipeline uses an in-memory filesystem; physical writes pass through the filesystem adapter and are invoked only by virtfs/commit.ts.', binds: ['projectsStayInMemoryAndWritesStayBehindCommit', 'noWriteUntilCommitPhase'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-02' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Mid-build failure pollutes outDir; user has to manually reconcile partial generation; CI signal becomes ambiguous.',
  };
}
