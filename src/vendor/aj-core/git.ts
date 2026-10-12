import { spawnSync } from 'node:child_process';

export interface GitResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
}

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

// safe.directory is honored from the command line (protected configuration) and
// guards against "dubious ownership" refusals; quotepath=false keeps non-ASCII
// paths readable in output.
const BASE_ARGS = ['-c', 'safe.directory=*', '-c', 'core.quotepath=false'];

/**
 * Run git synchronously in `root`. Never throws for nonzero git exit codes
 * (those come back as `ok: false`); only spawn failures throw GitError.
 *
 * Determinism: GIT_CONFIG_NOSYSTEM=1 is always set so system-level git config
 * cannot influence behavior. Callers that need full isolation (tests) pass
 * GIT_CONFIG_GLOBAL via opts.env.
 */
export function git(root: string, args: string[], opts: { env?: Record<string, string> } = {}): GitResult {
  const res = spawnSync('git', [...BASE_ARGS, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', ...(opts.env ?? {}) },
  });
  if (res.error) {
    throw new GitError(`failed to spawn git: ${res.error.message}`);
  }
  return { ok: res.status === 0, status: res.status ?? -1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

export function isGitRepository(root: string): boolean {
  try {
    return git(root, ['rev-parse', '--git-dir']).ok;
  } catch {
    return false;
  }
}
