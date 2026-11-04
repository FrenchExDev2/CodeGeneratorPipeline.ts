import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpFixpointLoopRequirement } from '../requirements/req-tscp-fixpoint-loop.js';
import { ReqTscpIterationCapRequirement } from '../requirements/req-tscp-iteration-cap.js';
import { ReqTscpDeterministicOrderingRequirement } from '../requirements/req-tscp-deterministic-ordering.js';

@Satisfies(
  ReqTscpFixpointLoopRequirement,
  ReqTscpIterationCapRequirement,
  ReqTscpDeterministicOrderingRequirement,
)
export abstract class FixpointTerminationFeature extends Feature {
  readonly id = 'TSCP-FIXPOINT-TERMINATION';
  readonly title = 'Runner converges to a fixpoint or fails at MAX_ITERATIONS, with deterministic ordering';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract terminatesWhenNoGeneratorEmitsAnything(): ACResult;
  abstract reportsIterationCountInDiagnostics(): ACResult;
  abstract failsWithSG0030WhenMaxIterationsReached(): ACResult;
  abstract leavesDiskUntouchedOnNonConvergence(): ACResult;
  abstract leavesDiskUntouchedOnError(): ACResult;
  abstract twoConsecutiveRunsProduceIdenticalOutputs(): ACResult;
  abstract generatorsInvokedInIdLexicographicOrder(): ACResult;
  abstract propertyConvergenceForPureIdempotentGenerators(): ACResult;
}
