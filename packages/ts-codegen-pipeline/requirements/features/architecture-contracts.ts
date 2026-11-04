import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerExtensibilityRequirement } from '../requirements/req-tscp-analyzer-extensibility.js';
import { ReqTscpDeterministicOrderingRequirement } from '../requirements/req-tscp-deterministic-ordering.js';
import { ReqTscpVirtfsIsolationRequirement } from '../requirements/req-tscp-virtfs-isolation.js';
import { ReqTscpStrictlyAdditiveEmissionRequirement } from '../requirements/req-tscp-strictly-additive-emission.js';
import { ReqTscpKernelBoundaryRequirement } from '../requirements/req-tscp-kernel-boundary.js';

@Satisfies(ReqTscpAnalyzerExtensibilityRequirement, ReqTscpDeterministicOrderingRequirement, ReqTscpVirtfsIsolationRequirement, ReqTscpStrictlyAdditiveEmissionRequirement, ReqTscpKernelBoundaryRequirement)
export abstract class PipelineArchitectureContractsFeature extends Feature {
  readonly id = 'TSCP-ARCHITECTURE-CONTRACTS';
  readonly title = 'Observable public export, clock, emission and physical-write boundaries';
  readonly priority = Priority.Critical;
  abstract separatesBuiltinAnalyzerExportsAndPreservesConfigIdentity(): ACResult;
  abstract emissionHasNoWallClockAndHashesOnlyBody(): ACResult;
  abstract projectsStayInMemoryAndWritesStayBehindCommit(): ACResult;
  abstract codemodMutationIsSeparateFromEmissionApi(): ACResult;
  abstract dependsOnlyOnSharedKernel(): ACResult;
  abstract preservesImmutableVersionedArchives(): ACResult;
}
