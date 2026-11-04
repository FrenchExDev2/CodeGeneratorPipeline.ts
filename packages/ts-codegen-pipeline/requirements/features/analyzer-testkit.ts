import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpAnalyzerTestkitRequirement } from '../requirements/req-tscp-analyzer-testkit.js';

/**
 * Testing kit at `./testing` sub-export: Project builder, run helper,
 * conformance assertion, vitest matchers.
 */
@Satisfies(ReqTscpAnalyzerTestkitRequirement)
export abstract class AnalyzerTestkitFeature extends Feature {
  readonly id = 'TSCP-ANALYZER-TESTKIT';
  readonly title = 'Sub-export `./testing` provides scaffolding helpers and assertAnalyzerContract';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract makeInMemoryProjectResolvesProvidedPaths(): ACResult;
  abstract makeInMemoryProjectDoesNotWriteDisk(): ACResult;
  abstract runAnalyzerSeesProvidedProject(): ACResult;
  abstract runAnalyzerOptsOverrideContext(): ACResult;
  abstract contractAcceptsConformingAnalyzer(): ACResult;
  abstract contractRejectsNonDeterministic(): ACResult;
  abstract contractRejectsVirtFsMutation(): ACResult;
  abstract contractRejectsProjectMutation(): ACResult;
  abstract matcherToHaveCodeWorks(): ACResult;
}
