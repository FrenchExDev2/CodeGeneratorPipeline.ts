import { Requirement, Priority } from '@frenchexdev2/requirements-shared-kernel';
import type { PipelineRequirementStyle } from '../vocabulary.js';

/**
 * Diagnostics carry source-position info (1-based line/column for start
 * and end) and optional related locations for "X must match Y" patterns.
 * `diagFromNode` auto-populates positions from a ts-morph node.
 */
export abstract class ReqTscpAnalyzerDiagnosticRequirement extends Requirement<PipelineRequirementStyle> {
  readonly id = 'REQ-TSCP-ANALYZER-DIAGNOSTIC';
  readonly title = 'Diagnostics carry start/end positions and optional related locations';
  readonly priority = Priority.High;
  readonly status = 'Approved' as const;
  readonly kind = 'Functional' as const;

  readonly statement = {
    pattern: 'ubiquitous' as const,
    response: 'Diagnostic shall carry optional `start` and `end` (each: 1-based `line` and `column`), and optional `relatedLocations` (each carrying file/start/end/message). The shape additions are backwards-compatible: pre-existing `SG*` diagnostics that omit positions remain valid. The helper `diagFromNode(node, severity, code, message, producerId, related?)` shall extract `file/start/end` from a ts-morph node and map any `related` argument to fully-positioned `DiagnosticLocation` entries.',
  };

  readonly rationale = {
    claim: 'Without start/end, an analyzer pointing inside a 500-line file is unactionable — terminals cannot make `path:line:col` clickable, IDEs cannot squiggle. Freezing the shape in v0 prevents a breaking change for npm-tier analyzer authors.',
    kind: 'principle' as const,
    evidence: [
      { kind: 'expert-opinion' as const, expert: 'Stéphane Erard — DX baseline 2026-05-07', recordedAt: '2026-05-07' },
    ],
  };

  readonly fitCriteria = [
    { kind: 'unit-test' as const,
      describes: 'Diagnostic shape compiles with `start`/`end` (DiagnosticPosition) and `relatedLocations` (DiagnosticLocation[]) all optional.',
      binds: ['diagnosticShapeCompiles'] },
    { kind: 'unit-test' as const,
      describes: 'A pre-existing SG* diagnostic that omits positions remains a valid `Diagnostic`.',
      binds: ['backwardsCompatibleWithPreviousSGShape'] },
    { kind: 'unit-test' as const,
      describes: 'diagFromNode for a node at the very start of the file returns `start.line === 1` and `start.column === 1`.',
      binds: ['diagFromNodeStartOfFileIsLine1Col1'] },
    { kind: 'unit-test' as const,
      describes: 'diagFromNode for a multi-line node returns `end.line > start.line`.',
      binds: ['diagFromNodeMultiLineEndAfterStart'] },
    { kind: 'unit-test' as const,
      describes: 'diagFromNode columns are 1-based (no zero-based off-by-one).',
      binds: ['diagFromNodeColumnsAreOneBased'] },
    { kind: 'unit-test' as const,
      describes: 'diagFromNode without `related` argument returns `relatedLocations === undefined`.',
      binds: ['diagFromNodeNoRelatedIsUndefined'] },
    { kind: 'unit-test' as const,
      describes: 'diagFromNode with `related` of length N returns `relatedLocations.length === N` with positions filled.',
      binds: ['diagFromNodeRelatedFillsLocations'] },
  ];

  readonly verificationMethod = 'Test' as const;
  readonly source = { type: 'stakeholder' as const, role: 'maintainer', date: '2026-05-07' };
  readonly risk = {
    level: 'High' as const,
    ifNotMet: 'Diagnostics are unactionable in IDE/terminal; adding positions later is a breaking change for any third-party analyzer package.',
  };
}
