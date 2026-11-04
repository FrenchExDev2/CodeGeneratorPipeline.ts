import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpIncrementalDeltaVisibilityRequirement } from '../requirements/req-tscp-incremental-delta-visibility.js';

@Satisfies(ReqTscpIncrementalDeltaVisibilityRequirement)
export abstract class IncrementalDeltaFeature extends Feature {
  readonly id = 'TSCP-INCREMENTAL-DELTA';
  readonly title = 'GenerationContext.delta exposes a read-only view of recent virtFS activity for incremental processing';
  readonly priority = Priority.Medium;
  readonly enabled = true;

  abstract deltaEmptyAtIterationZero(): ACResult;
  abstract deltaLastIterationMatchesPriorEmissions(): ACResult;
  abstract deltaSinceStartIsCumulative(): ACResult;
  abstract filterEmittedSinceReturnsExpectedSlice(): ACResult;
  abstract propertyDeltaConsistentWithJournal(): ACResult;
}
