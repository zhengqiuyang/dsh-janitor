import path from 'node:path';
import { CODE_EXTENSIONS, DOC_EXTENSIONS, extensionOf, isAlwaysExcluded } from './detect.js';
import { readTextFile } from './util.js';

export interface RefResult {
  /** Sorted repo-relative paths of every file that references the artifact. */
  refFiles: string[];
  /** References from files with code extensions. */
  codeRefs: number;
  /** References from documentation files. */
  docRefs: number;
  /** References from any other file. */
  otherRefs: number;
  /** Up to 3 example locations, as "path:line". */
  examples: string[];
  /** Total number of referencing files. */
  total: number;
}

interface CacheEntry {
  lines: string[];
}

/**
 * Lazily reads and caches worktree file contents (line-split, CRLF tolerant)
 * so reference scans across many artifacts read each file at most once.
 */
export class ContentCache {
  private cache = new Map<string, CacheEntry | null>();

  constructor(private root: string, private files: string[]) {}

  get(relPath: string): CacheEntry | null {
    const hit = this.cache.get(relPath);
    if (hit !== undefined) return hit;
    let entry: CacheEntry | null = null;
    const text = readTextFile(path.join(this.root, ...relPath.split('/')));
    if (text !== null) {
      entry = { lines: text.split(/\r?\n/) };
    }
    this.cache.set(relPath, entry);
    return entry;
  }
}

/**
 * Scan all other worktree files for plain substring occurrences of the
 * artifact's basename or its repo-relative path. The artifact itself (and
 * always-excluded plumbing dirs) never count as a referrer.
 */
export function findReferences(
  root: string,
  artifactPath: string,
  files: string[],
  cache?: ContentCache,
): RefResult {
  const c = cache ?? new ContentCache(root, files);
  const base = artifactPath.split('/').pop() ?? artifactPath;
  const needles = base === artifactPath ? [base] : [base, artifactPath];

  const refFiles: string[] = [];
  let codeRefs = 0;
  let docRefs = 0;
  let otherRefs = 0;
  const examples: string[] = [];

  for (const f of files) {
    if (f === artifactPath) continue;
    if (isAlwaysExcluded(f)) continue;
    const entry = c.get(f);
    if (!entry) continue; // missing, binary, or oversized
    let lineIdx = -1;
    for (const needle of needles) {
      lineIdx = entry.lines.findIndex((line) => line.includes(needle));
      if (lineIdx !== -1) break;
    }
    if (lineIdx === -1) continue;

    refFiles.push(f);
    const ext = extensionOf(f);
    if (CODE_EXTENSIONS.has(ext)) codeRefs++;
    else if (DOC_EXTENSIONS.has(ext)) docRefs++;
    else otherRefs++;
    if (examples.length < 3) {
      examples.push(`${f}:${lineIdx + 1}`);
    }
  }

  return { refFiles, codeRefs, docRefs, otherRefs, examples, total: refFiles.length };
}
