import { Feature, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { ReqTscpDecoratorByNameRequirement } from '../requirements/req-tscp-decorator-by-name.js';

@Satisfies(ReqTscpDecoratorByNameRequirement)
export abstract class DecoratorDiscoveryFeature extends Feature {
  readonly id = 'TSCP-DECORATOR-DISCOVERY';
  readonly title = '@Generate is found by identifier name; multi-stacking and AST-target filtering are first-class';
  readonly priority = Priority.High;
  readonly enabled = true;

  abstract findsDecoratorOnClassDeclaration(): ACResult;
  abstract findsDecoratorOnMethodDeclaration(): ACResult;
  abstract findsDecoratorOnPropertyDeclaration(): ACResult;
  abstract findsDecoratorOnAccessorDeclaration(): ACResult;
  abstract ignoresParameterDecoratorInV1(): ACResult;
  abstract stackingReturnsAllHitsInSourceOrder(): ACResult;
  abstract targetKindFilterHasNoLeakage(): ACResult;
  abstract aliasedImportIsNotDiscovered(): ACResult;
  abstract parsesObjectArgumentLiterally(): ACResult;
  abstract parsesStringAndNumberArguments(): ACResult;
  abstract propertyStackingPreservesEachKind(): ACResult;
  abstract propertyTargetFilterPartitionsHits(): ACResult;
}
