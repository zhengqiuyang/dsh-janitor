import { Config, CategoryName } from './config.js';
import { git } from './git.js';
import { isUnderDir, normalizeRelPath } from './util.js';

export interface DetectedArtifact {
  /** Repo-relative posix path. */
  path: string;
  category: CategoryName;
  /** Human-readable description of what matched (glob or name pattern). */
  matchedBy: string;
}

/** Conservative built-in plan-document conventions (gitignore-style globs). */
export const BUILTIN_PLAN_GLOBS: string[] = [
  '.agents/plans/**',
  '.claude/plans/**',
  'plans/**',
  'docs/plans/**',
  '**/*.plan.md',
  'PLAN*.md',
  'HANDOFF*.md',
  '.handoff/**',
];

/** Scratch-script file name convention: scratch/temp/tmp/oneoff/one-off/throwaway as a delimited token. */
export const SCRATCH_NAME_RE = /(?:^|[-_.])(scratch|temp|tmp|oneoff|one-off|throwaway)(?:[-_.]|$)/i;

export const CODE_EXTENSIONS = new Set([
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'swift', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh',
  'ps1', 'psm1', 'bat', 'cmd', 'pl', 'lua', 'sql', 'r', 'scala', 'dart',
  'ex', 'exs', 'erl', 'hs', 'jl', 'vue', 'svelte',
]);

export const DOC_EXTENSIONS = new Set(['md', 'mdx', 'txt', 'rst', 'adoc', 'org']);

const ALWAYS_EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.agent-janitor']);

export function isAlwaysExcluded(relPath: string): boolean {
  return relPath.split('/').some((seg) => ALWAYS_EXCLUDED_SEGMENTS.has(seg));
}

export function extensionOf(relPath: string): string {
  const base = relPath.split('/').pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// gitignore-style glob matching
// ---------------------------------------------------------------------------

/**
 * Compile a gitignore-style glob to a RegExp over repo-relative posix paths.
 * - A pattern without any "/" matches the file name at any depth.
 * - A pattern containing "/" is anchored to the repo root.
 * - "**" as a whole segment matches zero or more path segments.
 * - "*" and "?" do not cross "/" boundaries; "[...]" classes pass through.
 */
export function globToRegex(glob: string): RegExp {
  let pattern = normalizeRelPath(glob);
  if (pattern.startsWith('/')) pattern = pattern.slice(1);
  if (pattern === '') throw new Error('empty glob pattern');
  let body: string;
  if (!pattern.includes('/')) {
    body = '^(?:.*/)?' + segmentToRegex(pattern) + '$';
  } else {
    const segs = pattern.split('/');
    let re = '^';
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const last = i === segs.length - 1;
      if (seg === '**') {
        re += last ? '.*' : '(?:[^/]+/)*';
      } else {
        re += segmentToRegex(seg);
        if (!last) re += '/';
      }
    }
    body = re;
  }
  return new RegExp(body);
}

function segmentToRegex(seg: string): string {
  let out = '';
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (c === '[') {
      const end = seg.indexOf(']', i + 1);
      if (end === -1) {
        out += '\\[';
      } else {
        out += seg.slice(i, end + 1); // pass char class through verbatim
        i = end;
      }
    } else if ('\\^$.|+(){}'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return out;
}

const globRegexCache = new Map<string, RegExp>();

export function matchGlob(glob: string, relPath: string): boolean {
  let re = globRegexCache.get(glob);
  if (!re) {
    re = globToRegex(glob);
    globRegexCache.set(glob, re);
  }
  return re.test(relPath);
}

export function matchesScratchName(relPath: string): boolean {
  const base = relPath.split('/').pop() ?? '';
  if (!CODE_EXTENSIONS.has(extensionOf(base))) return false;
  return SCRATCH_NAME_RE.test(base);
}

export function categoryRank(c: CategoryName): number {
  switch (c) {
    case 'plan-docs':
      return 0;
    case 'scratch-scripts':
      return 1;
    default:
      return 2;
  }
}

/**
 * Enumerate worktree files via git (tracked + untracked-not-ignored), NUL
 * separated, deduplicated, in git's stable sort order. Paths are relative to
 * the cwd (the scan root).
 */
export function listWorktreeFiles(root: string): string[] {
  const res = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (!res.ok) {
    throw new Error(`git ls-files failed: ${res.stderr.trim()}`);
  }
  const seen = new Set<string>();
  const files: string[] = [];
  for (const entry of res.stdout.split('\0')) {
    if (entry === '' || seen.has(entry)) continue;
    seen.add(entry);
    files.push(entry);
  }
  return files;
}

/** Remove files that are never candidates (always-excluded dirs, archive dir). */
export function filterScannable(files: string[], archiveDir: string): string[] {
  return files.filter((f) => !isAlwaysExcluded(f) && !isUnderDir(f, archiveDir));
}

export function detectFromFiles(files: string[], config: Config): DetectedArtifact[] {
  const planCfg = config.categories['plan-docs'] ?? {};
  const scratchCfg = config.categories['scratch-scripts'] ?? {};
  const customCfg = config.categories.custom ?? {};
  const planGlobs = [...BUILTIN_PLAN_GLOBS, ...(planCfg.include ?? [])];
  const planExcludes = planCfg.exclude ?? [];
  const scratchExcludes = scratchCfg.exclude ?? [];
  const customIncludes = customCfg.include ?? [];
  const customExcludes = customCfg.exclude ?? [];

  const artifacts: DetectedArtifact[] = [];
  for (const f of files) {
    // Defense in depth: analyze() pre-filters these, but detectFromFiles must
    // stay safe when called directly.
    if (isAlwaysExcluded(f) || isUnderDir(f, config.archiveDir)) continue;
    if (planExcludes.some((g) => matchGlob(g, f))) continue;
    const planHit = planGlobs.find((g) => matchGlob(g, f));
    if (planHit) {
      artifacts.push({ path: f, category: 'plan-docs', matchedBy: planHit });
      continue;
    }
    if (scratchExcludes.some((g) => matchGlob(g, f))) continue;
    if (matchesScratchName(f)) {
      artifacts.push({ path: f, category: 'scratch-scripts', matchedBy: `name pattern ${SCRATCH_NAME_RE.toString()} (code extensions only)` });
      continue;
    }
    if (customExcludes.some((g) => matchGlob(g, f))) continue;
    const customHit = customIncludes.find((g) => matchGlob(g, f));
    if (customHit) {
      artifacts.push({ path: f, category: 'custom', matchedBy: customHit });
    }
  }
  artifacts.sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return artifacts;
}

export function detectArtifacts(root: string, config: Config): DetectedArtifact[] {
  const files = filterScannable(listWorktreeFiles(root), config.archiveDir);
  return detectFromFiles(files, config);
}
