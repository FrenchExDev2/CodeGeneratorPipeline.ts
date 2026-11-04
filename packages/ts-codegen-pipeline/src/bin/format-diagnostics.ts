import * as path from 'node:path';
import type { Diagnostic, Severity } from '../types.js';

export interface FormatOptions {
  readonly color?: boolean;
  readonly consumerPackageRoot?: string;
}

export interface FooterInfo {
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly analyzerCount: number;
  readonly totalMs: number;
  readonly slowest?: { readonly id: string; readonly ms: number };
}

const ANSI = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
} as const;

/**
 * Format a list of diagnostics for human terminal output:
 * - grouped under per-file headers (relative to consumerPackageRoot if supplied)
 * - location printed as `path:line:col`
 * - colorized by severity if color enabled
 * - related locations indented under their parent diag
 *
 * Returns the rendered text (no trailing newline; one logical line per diag).
 */
export function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  opts: FormatOptions = {},
): string {
  if (diagnostics.length === 0) return '';
  const useColor = opts.color ?? true;
  const root = opts.consumerPackageRoot;
  const grouped = groupByFile(diagnostics);
  const out: string[] = [];
  for (const [file, group] of grouped) {
    const header = relPath(file, root);
    out.push(useColor ? `${ANSI.bold}${header}${ANSI.reset}` : header);
    for (const d of group) {
      out.push(formatOne(d, root, useColor));
      if (d.relatedLocations) {
        for (const loc of d.relatedLocations) {
          const where = formatLocation(loc.file, loc.start?.line, loc.start?.column, root);
          const msg = loc.message ?? 'related';
          out.push(`    ${useColor ? ANSI.dim : ''}↳ ${where}  ${msg}${useColor ? ANSI.reset : ''}`);
        }
      }
    }
  }
  return out.join('\n');
}

/** Format a single diagnostic line (no header). Exported for fine-grained tests. */
export function formatOne(d: Diagnostic, consumerPackageRoot?: string, color = true): string {
  const sev = formatSeverity(d.severity, color);
  const where = d.file
    ? `  ${color ? ANSI.dim : ''}${formatLocation(d.file, d.start?.line, d.start?.column, consumerPackageRoot)}${color ? ANSI.reset : ''}`
    : '';
  return `  ${sev} ${d.code}  ${d.message}${where}  (${d.producerId})`;
}

export function formatLocation(
  file: string,
  line?: number,
  column?: number,
  consumerPackageRoot?: string,
): string {
  const p = relPath(file, consumerPackageRoot);
  if (line === undefined) return p;
  if (column === undefined) return `${p}:${line}`;
  return `${p}:${line}:${column}`;
}

export function formatFooter(info: FooterInfo, color = true): string {
  const parts: string[] = [];
  parts.push(`${info.errors} error${info.errors === 1 ? '' : 's'}`);
  parts.push(`${info.warnings} warning${info.warnings === 1 ? '' : 's'}`);
  if (info.analyzerCount > 0) {
    parts.push(`${info.analyzerCount} analyzer${info.analyzerCount === 1 ? '' : 's'} ran in ${Math.round(info.totalMs)}ms`);
    if (info.slowest) parts.push(`slowest: ${info.slowest.id} ${Math.round(info.slowest.ms)}ms`);
  }
  const text = parts.join(' · ');
  return color ? `${ANSI.dim}${text}${ANSI.reset}` : text;
}

export function buildFooterInfo(
  diagnostics: readonly Diagnostic[],
  timings?: ReadonlyMap<string, number>,
): FooterInfo {
  let errors = 0, warnings = 0, infos = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }
  let totalMs = 0;
  let slowest: { id: string; ms: number } | undefined;
  if (timings) {
    for (const [id, ms] of timings) {
      totalMs += ms;
      if (!slowest || ms > slowest.ms) slowest = { id, ms };
    }
  }
  return {
    errors, warnings, infos,
    analyzerCount: timings?.size ?? 0,
    totalMs,
    slowest,
  };
}

function formatSeverity(s: Severity, color: boolean): string {
  const tag = s === 'error' ? 'ERROR' : s === 'warning' ? 'WARN' : 'INFO';
  if (!color) return tag;
  const c = s === 'error' ? ANSI.red : s === 'warning' ? ANSI.yellow : ANSI.cyan;
  return `${c}${tag}${ANSI.reset}`;
}

function groupByFile(diags: readonly Diagnostic[]): Map<string, Diagnostic[]> {
  const out = new Map<string, Diagnostic[]>();
  for (const d of diags) {
    const key = d.file ?? '<no file>';
    const arr = out.get(key) ?? [];
    arr.push(d);
    out.set(key, arr);
  }
  return out;
}

function relPath(file: string, root?: string): string {
  if (!root) return file;
  const r = path.relative(root, file).replace(/\\/g, '/');
  return r.length === 0 ? file : r;
}
