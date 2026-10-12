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
export declare class ContentCache {
    private root;
    private files;
    private cache;
    constructor(root: string, files: string[]);
    get(relPath: string): CacheEntry | null;
}
/**
 * Scan all other worktree files for plain substring occurrences of the
 * artifact's basename or its repo-relative path. The artifact itself (and
 * always-excluded plumbing dirs) never count as a referrer.
 */
export declare function findReferences(root: string, artifactPath: string, files: string[], cache?: ContentCache): RefResult;
export {};
