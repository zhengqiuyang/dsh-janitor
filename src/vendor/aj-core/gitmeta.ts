import { git } from './git.js';

export interface LastCommit {
  /** Full 40-char hash. */
  hash: string;
  /** Short hash for display. */
  short: string;
  subject: string;
  /** ISO 8601 timestamp of the commit. */
  date: string;
}

export interface FileGitMeta {
  /** Whole days since the last commit touching the file; 0 when never committed. */
  ageDays: number;
  lastCommit: LastCommit | null;
  /** True when the file has never been committed (staged or untracked). */
  neverCommitted: boolean;
}

const DAY_MS = 86_400_000;

/** Age and last-commit information for one file, from `git log -1 -- <path>`. */
export function getFileGitMeta(root: string, relPath: string, now = Date.now()): FileGitMeta {
  const res = git(root, ['log', '-1', '--format=%H%x1f%ct%x1f%s', '--', relPath]);
  const line = res.stdout.split('\n').find((l) => l.trim() !== '');
  if (!res.ok || !line) {
    // No commit touching the file (or a repo without commits).
    return { ageDays: 0, lastCommit: null, neverCommitted: true };
  }
  const parts = line.split('\x1f');
  const hash = parts[0] ?? '';
  const commitTime = parseInt(parts[1] ?? '0', 10) * 1000;
  const subject = parts.slice(2).join('\x1f');
  const ageDays = Math.max(0, Math.floor((now - commitTime) / DAY_MS));
  return {
    ageDays,
    lastCommit: {
      hash,
      short: hash.slice(0, 12),
      subject,
      date: new Date(commitTime).toISOString(),
    },
    neverCommitted: false,
  };
}

/**
 * Task-merged heuristic for plan docs: newest commit reachable from HEAD whose
 * message mentions one of `stems` (fixed-string, case-insensitive). Commits
 * only on abandoned branches are unreachable from HEAD and therefore never
 * match. Returns the matching commit subject, or null.
 */
export function findTaskMerged(root: string, stems: string[]): string | null {
  for (const raw of stems) {
    const s = raw.trim();
    if (s === '') continue;
    const res = git(root, ['log', '-i', '--fixed-strings', `--grep=${s}`, '--format=%s', '-n', '1']);
    if (!res.ok) return null;
    const subject = res.stdout.split('\n').find((l) => l.trim() !== '');
    if (subject) return subject;
  }
  return null;
}

/**
 * Candidate task-name stems for a plan doc, most specific first. We strip one
 * extension, and for "*.plan.md" conventions also offer the name without
 * ".plan": "plans/feature-x.plan.md" -> ["feature-x.plan", "feature-x"].
 */
export function planStems(relPath: string): string[] {
  const base = relPath.split('/').pop() ?? '';
  const i = base.lastIndexOf('.');
  const stems: string[] = [];
  if (i > 0) {
    const one = base.slice(0, i);
    stems.push(one);
    if (one.toLowerCase().endsWith('.plan')) {
      const two = one.slice(0, -'.plan'.length);
      if (two !== '') stems.push(two);
    }
  } else {
    stems.push(base);
  }
  return stems;
}
