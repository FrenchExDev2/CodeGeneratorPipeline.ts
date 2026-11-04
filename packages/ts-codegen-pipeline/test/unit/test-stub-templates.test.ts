import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { expect } from 'vitest';
import {
  throwTemplate,
  fastCheckTemplate,
  isPropertyAcName,
} from '../../src/generators/templates/test-stub-templates.js';
import { GeneratedFileBannerFeature } from '../../requirements/features/generated-file-banner.js';

@FeatureTest(GeneratedFileBannerFeature)
class TestStubTemplatesTests {
  @Verifies<GeneratedFileBannerFeature>('bannerHasFourLineEnvelope')
  throwTemplateWithoutJsdoc() {
    const out = throwTemplate({
      acName: 'someAc',
      featureClassName: 'FooFeature',
      jsdocLines: [],
    });
    expect(out).toBe(
      `  @Verifies<FooFeature>('someAc')\n` +
      `  async someAc() {\n` +
      `    throw new Error('SCAFFOLD_NOT_IMPLEMENTED:someAc');\n` +
      `  }`,
    );
  }

  @Verifies<GeneratedFileBannerFeature>('bannerHasFourLineEnvelope')
  throwTemplateWithSingleJsdocLine() {
    const out = throwTemplate({
      acName: 'someAc',
      featureClassName: 'FooFeature',
      jsdocLines: ['One sentence describes.'],
    });
    expect(out).toContain(`  /** One sentence describes. */`);
  }

  @Verifies<GeneratedFileBannerFeature>('bannerHasFourLineEnvelope')
  throwTemplateWithMultiJsdocLines() {
    const out = throwTemplate({
      acName: 'someAc',
      featureClassName: 'FooFeature',
      jsdocLines: ['First.', 'Second.'],
    });
    expect(out).toContain(`  /**\n   *  First.\n   *  Second.\n   */`);
  }

  @Verifies<GeneratedFileBannerFeature>('bannerHasFourLineEnvelope')
  fastCheckTemplateBaseline() {
    const out = fastCheckTemplate({
      acName: 'propertyXIsIdempotent',
      featureClassName: 'FooFeature',
      jsdocLines: [],
    });
    expect(out).toContain('fc.assert(fc.property(fc.anything()');
    expect(out).toContain(`@Verifies<FooFeature>('propertyXIsIdempotent')`);
    expect(out).toContain(`'SCAFFOLD_NOT_IMPLEMENTED:propertyXIsIdempotent'`);
    expect(out).toContain('Property test');
  }

  @Verifies<GeneratedFileBannerFeature>('bannerHasFourLineEnvelope')
  fastCheckTemplatePrependsExistingJsdoc() {
    const out = fastCheckTemplate({
      acName: 'propertyFoo',
      featureClassName: 'FooFeature',
      jsdocLines: ['From REQ-X (unit-test): for any input, idempotence holds.'],
    });
    expect(out).toMatch(/From REQ-X[\s\S]+Property test/);
  }

  @Verifies<GeneratedFileBannerFeature>('bannerHasFourLineEnvelope')
  isPropertyAcNameMatchesAndDoesNotMatch() {
    expect(isPropertyAcName('propertyFoo')).toBe(true);
    expect(isPropertyAcName('propertyABC')).toBe(true);
    expect(isPropertyAcName('property')).toBe(true);
    expect(isPropertyAcName('addPropertyToCart')).toBe(false);
    expect(isPropertyAcName('justAReg')).toBe(false);
  }
}

export { TestStubTemplatesTests };
