import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpWriteOnceRequirement } from '../requirements/req-tscp-write-once.js';
import { ReqTscpDeterministicOrderingRequirement } from '../requirements/req-tscp-deterministic-ordering.js';

@Satisfies(
  ReqTscpWriteOnceRequirement,
  ReqTscpDeterministicOrderingRequirement,
)
export abstract class GeneratedFileBannerFeature extends Feature {
  readonly id = 'TSCP-GENERATED-FILE-BANNER';
  readonly title = 'Every emitted file carries a banner with producer / iteration / SHA-256 contentHash';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract bannerHasFourLineEnvelope(): ACResult;
  abstract bannerCarriesProducerAndIteration(): ACResult;
  abstract bannerCarriesSha256ContentHash(): ACResult;
  abstract bannerHasNoTimestampOrRandomness(): ACResult;
  abstract bannerRoundTripPreservesBody(): ACResult;
  abstract contentHashSelfConsistent(): ACResult;
  abstract propertyBannerRoundTrip(): ACResult;
  abstract propertyBannerDeterministic(): ACResult;
}
