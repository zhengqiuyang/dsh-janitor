import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Convert a filesystem path to posix separators. */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Normalize a repo-relative path: posix separators, no leading ./ or trailing slashes. */
export function normalizeRelPath(p: string): string {
  let out = toPosix(p).trim();
  while (out.startsWith('./')) out = out.slice(2);
  while (out.endsWith('/') && out.length > 1) out = out.slice(0, -1);
  return out;
}

/** True when `child` equals `dir` or lives underneath it (both repo-relative posix). */
export function isUnderDir(child: string, dir: string): boolean {
  const d = normalizeRelPath(dir);
  if (d === '' || d === '.') return false;
  return child === d || child.startsWith(d + '/');
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** yyyyMMdd-HHmmss in local time (used for plan file names). */
export function stampFromDate(d: Date): string {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

/** yyyyMMdd in local time (used for archive subdirectories). */
export function dateStampFromDate(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/** Heuristic binary check: a NUL byte in the first 8 KiB marks binary content. */
export function isBinaryBuffer(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/**
 * Read a file as UTF-8 text. Returns null when the path is missing, is not a
 * regular file, exceeds maxBytes, or looks binary. CRLF content is returned
 * verbatim; all consumers are CRLF-tolerant.
 */
export function readTextFile(absPath: string, maxBytes = 2 * 1024 * 1024): string | null {
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile() || st.size > maxBytes) return null;
    const buf = fs.readFileSync(absPath);
    if (isBinaryBuffer(buf)) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

export function sha256Text(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Content hash used for plan snapshots; null for unreadable/binary/oversized files. */
export function sha256FileSync(absPath: string): string | null {
  const text = readTextFile(absPath);
  return text === null ? null : sha256Text(text);
}

// ---------------------------------------------------------------------------
// Output helpers (colors are disabled for non-TTY stdout, NO_COLOR, and tests)
// ---------------------------------------------------------------------------

let colorEnabled = process.stdout.isTTY === true && !process.env.NO_COLOR && process.env.FORCE_COLOR !== '0';

export function setColorEnabled(v: boolean): void {
  colorEnabled = v;
}

export const COLOR_CODES = {
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  gray: '90',
} as const;

export function colorize(text: string, code: string): string {
  return colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export function verdictColor(verdict: string): string {
  switch (verdict) {
    case 'safe-to-remove':
      return COLOR_CODES.green;
    case 'needs-review':
      return COLOR_CODES.yellow;
    case 'recent':
      return COLOR_CODES.blue;
    case 'keep':
      return COLOR_CODES.cyan;
    case 'protected':
      return COLOR_CODES.magenta;
    default:
      return COLOR_CODES.gray;
  }
}

export function padCell(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}
