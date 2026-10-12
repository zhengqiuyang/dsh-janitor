import { Config, CategoryName } from './config.js';
export interface DetectedArtifact {
    /** Repo-relative posix path. */
    path: string;
    category: CategoryName;
    /** Human-readable description of what matched (glob or name pattern). */
    matchedBy: string;
}
/** Conservative built-in plan-document conventions (gitignore-style globs). */
export declare const BUILTIN_PLAN_GLOBS: string[];
/** Scratch-script file name convention: scratch/temp/tmp/oneoff/one-off/throwaway as a delimited token. */
export declare const SCRATCH_NAME_RE: RegExp;
export declare const CODE_EXTENSIONS: Set<string>;
export declare const DOC_EXTENSIONS: Set<string>;
export declare function isAlwaysExcluded(relPath: string): boolean;
export declare function extensionOf(relPath: string): string;
/**
 * Compile a gitignore-style glob to a RegExp over repo-relative posix paths.
 * - A pattern without any "/" matches the file name at any depth.
 * - A pattern containing "/" is anchored to the repo root.
 * - "**" as a whole segment matches zero or more path segments.
 * - "*" and "?" do not cross "/" boundaries; "[...]" classes pass through.
 */
export declare function globToRegex(glob: string): RegExp;
export declare function matchGlob(glob: string, relPath: string): boolean;
export declare function matchesScratchName(relPath: string): boolean;
export declare function categoryRank(c: CategoryName): number;
/**
 * Enumerate worktree files via git (tracked + untracked-not-ignored), NUL
 * separated, deduplicated, in git's stable sort order. Paths are relative to
 * the cwd (the scan root).
 */
export declare function listWorktreeFiles(root: string): string[];
/** Remove files that are never candidates (always-excluded dirs, archive dir). */
export declare function filterScannable(files: string[], archiveDir: string): string[];
export declare function detectFromFiles(files: string[], config: Config): DetectedArtifact[];
export declare function detectArtifacts(root: string, config: Config): DetectedArtifact[];
