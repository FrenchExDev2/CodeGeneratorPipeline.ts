import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/** The producer must remain independently usable from the Requirements application. */
export abstract class ReqTscpKernelBoundaryRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-KERNEL-BOUNDARY';
  readonly title = 'Depend only on the shared kernel within the FrenchExDev ecosystem';
  readonly priority = Priority.Critical;
  readonly status = 'Approved' as const;
  readonly kind = 'Constraint' as const;
  readonly statement = { pattern: 'ubiquitous' as const, response: 'The pipeline workspace shall use only requirements-shared-kernel as an external FrenchExDev dependency, including source, contracts, tests and generated test imports. Cross-workspace dependencies shall use exact versions resolved from immutable archives or a registry.' };
  readonly rationale = { kind: 'principle' as const, evidence: [{ kind: 'expert-opinion' as const, expert: 'Maintainer architecture contract', recordedAt: '2026-11-03' }], claim: 'Generic code generation must not depend on the application that consumes it.' };
  readonly fitCriteria = [
    { kind: 'unit-test' as const, describes: 'Package and root manifests and TypeScript imports retain the kernel boundary without cross-workspace source paths.', binds: ['dependsOnlyOnSharedKernel'] },
    { kind: 'unit-test' as const, describes: 'Archive synchronization preserves identical versions and rejects changed bytes under an existing version.', binds: ['preservesImmutableVersionedArchives'] },
  ];
  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-11-03' };
  readonly risk = { level: 'High' as const, ifNotMet: 'Circular dependency or source coupling prevents independent distribution.' };
}
