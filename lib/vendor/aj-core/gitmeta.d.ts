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
/** Age and last-commit information for one file, from `git log -1 -- <path>`. */
export declare function getFileGitMeta(root: string, relPath: string, now?: number): FileGitMeta;
/**
 * Task-merged heuristic for plan docs: newest commit reachable from HEAD whose
 * message mentions one of `stems` (fixed-string, case-insensitive). Commits
 * only on abandoned branches are unreachable from HEAD and therefore never
 * match. Returns the matching commit subject, or null.
 */
export declare function findTaskMerged(root: string, stems: string[]): string | null;
/**
 * Candidate task-name stems for a plan doc, most specific first. We strip one
 * extension, and for "*.plan.md" conventions also offer the name without
 * ".plan": "plans/feature-x.plan.md" -> ["feature-x.plan", "feature-x"].
 */
export declare function planStems(relPath: string): string[];
