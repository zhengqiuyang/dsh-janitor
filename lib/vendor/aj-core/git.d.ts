export interface GitResult {
    ok: boolean;
    status: number;
    stdout: string;
    stderr: string;
}
export declare class GitError extends Error {
    constructor(message: string);
}
/**
 * Run git synchronously in `root`. Never throws for nonzero git exit codes
 * (those come back as `ok: false`); only spawn failures throw GitError.
 *
 * Determinism: GIT_CONFIG_NOSYSTEM=1 is always set so system-level git config
 * cannot influence behavior. Callers that need full isolation (tests) pass
 * GIT_CONFIG_GLOBAL via opts.env.
 */
export declare function git(root: string, args: string[], opts?: {
    env?: Record<string, string>;
}): GitResult;
export declare function isGitRepository(root: string): boolean;
