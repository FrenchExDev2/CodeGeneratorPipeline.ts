export interface StubTemplateInput {
  /** AC name as written in the Feature class. */
  readonly acName: string;
  /** Generic Feature class name (for `@Verifies<F>(...)` type arg). */
  readonly featureClassName: string;
  /**
   * Tier 1 enrichment — joined `Requirement.fitCriteria.describes` sentences
   * for this AC. Empty if no fitCriterion binds this AC.
   */
  readonly jsdocLines: readonly string[];
}

/** Default body for an AC stub: distinctive throw, greppable. */
export function throwTemplate(input: StubTemplateInput): string {
  const jsdoc = renderJsdoc(input.jsdocLines);
  return [
    jsdoc,
    `  @Verifies<${input.featureClassName}>('${input.acName}')`,
    `  async ${input.acName}() {`,
    `    throw new Error('SCAFFOLD_NOT_IMPLEMENTED:${input.acName}');`,
    `  }`,
  ].filter(s => s !== '').join('\n');
}

/**
 * Tier 2 — for ACs whose name matches `^property*`, emit a fast-check
 * `fc.assert(fc.property(...))` skeleton.  The arbitrary and the
 * assertion are TODO; the stub still throws inside the predicate so a
 * non-implemented property test fails loudly.
 */
export function fastCheckTemplate(input: StubTemplateInput): string {
  const jsdoc = renderJsdoc([
    ...input.jsdocLines,
    'Property test — fill the arbitrary and the assertion.',
  ]);
  return [
    jsdoc,
    `  @Verifies<${input.featureClassName}>('${input.acName}')`,
    `  async ${input.acName}() {`,
    `    fc.assert(fc.property(fc.anything(), (_input) => {`,
    `      throw new Error('SCAFFOLD_NOT_IMPLEMENTED:${input.acName}');`,
    `    }));`,
    `  }`,
  ].filter(s => s !== '').join('\n');
}

/** Heuristic: AC names starting with `property` get the fast-check template. */
export function isPropertyAcName(acName: string): boolean {
  return /^property/.test(acName);
}

function renderJsdoc(lines: readonly string[]): string {
  if (lines.length === 0) return '';
  if (lines.length === 1) return `  /** ${lines[0]} */`;
  const body = lines.map(l => `   *  ${l}`).join('\n');
  return [`  /**`, body, `   */`].join('\n');
}
