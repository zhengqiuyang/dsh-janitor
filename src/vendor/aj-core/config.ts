import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { normalizeRelPath } from './util.js';

export type CategoryName = 'plan-docs' | 'scratch-scripts' | 'custom';

export interface CategoryConfig {
  /** Extra gitignore-style globs that add candidates to this category. */
  include?: string[];
  /** Globs that remove candidates from this category entirely. */
  exclude?: string[];
}

export interface Config {
  minAgeDays: number;
  archiveDir: string;
  protected: string[];
  categories: Record<CategoryName, CategoryConfig>;
}

export const CONFIG_FILENAME = 'agent-janitor.yaml';

export const DEFAULT_CONFIG: Config = {
  minAgeDays: 14,
  archiveDir: '.agent-janitor/archive',
  protected: [],
  categories: { 'plan-docs': {}, 'scratch-scripts': {}, custom: {} },
};

export class ConfigError extends Error {
  constructor(public errors: string[]) {
    super(`invalid agent-janitor config:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

function emptyCategories(): Record<CategoryName, CategoryConfig> {
  return { 'plan-docs': {}, 'scratch-scripts': {}, custom: {} };
}

export function configPathFor(root: string): string {
  return path.join(root, CONFIG_FILENAME);
}

/**
 * Load agent-janitor.yaml. When no explicit path is given and the default file
 * does not exist, defaults are returned (zero-config operation). An explicitly
 * passed config file that is missing is an error. All validation problems are
 * accumulated and reported together.
 */
export function loadConfig(root: string, explicitPath?: string): Config {
  const file = explicitPath ? path.resolve(explicitPath) : configPathFor(root);
  if (!fs.existsSync(file)) {
    if (explicitPath) {
      throw new ConfigError([`config file not found: ${explicitPath}`]);
    }
    return { ...DEFAULT_CONFIG, protected: [], categories: emptyCategories() };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new ConfigError([`cannot read config file ${file}: ${(e as Error).message}`]);
  }
  let doc: unknown;
  try {
    doc = parse(raw);
  } catch (e) {
    throw new ConfigError([`YAML parse error in ${file}: ${(e as Error).message}`]);
  }
  return validateConfig(doc, file);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateConfig(doc: unknown, source: string): Config {
  const errors: string[] = [];
  const cfg: Config = {
    minAgeDays: DEFAULT_CONFIG.minAgeDays,
    archiveDir: DEFAULT_CONFIG.archiveDir,
    protected: [],
    categories: emptyCategories(),
  };
  if (doc === undefined || doc === null) {
    return cfg; // empty config file means defaults
  }
  if (!isPlainObject(doc)) {
    throw new ConfigError(['top-level value must be a mapping']);
  }
  const knownTop = new Set(['minAgeDays', 'archiveDir', 'protected', 'categories']);
  for (const key of Object.keys(doc)) {
    if (!knownTop.has(key)) {
      errors.push(`unknown top-level key "${key}" (expected: minAgeDays, archiveDir, protected, categories)`);
    }
  }
  if (doc.minAgeDays !== undefined) {
    const v = doc.minAgeDays;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
      cfg.minAgeDays = v;
    } else {
      errors.push(`"minAgeDays" must be a non-negative integer (got ${JSON.stringify(v)})`);
    }
  }
  if (doc.archiveDir !== undefined) {
    const v = doc.archiveDir;
    const bad =
      typeof v !== 'string' ||
      v.trim() === '' ||
      path.isAbsolute(v) ||
      normalizeRelPath(v)
        .split('/')
        .includes('..');
    if (bad) {
      errors.push(`"archiveDir" must be a relative path without ".." (got ${JSON.stringify(v)})`);
    } else {
      cfg.archiveDir = normalizeRelPath(v);
    }
  }
  if (doc.protected !== undefined) {
    const v = doc.protected;
    if (Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== '')) {
      cfg.protected = (v as string[]).map(normalizeRelPath);
    } else {
      errors.push('"protected" must be an array of non-empty relative paths');
    }
  }
  if (doc.categories !== undefined) {
    if (!isPlainObject(doc.categories)) {
      errors.push('"categories" must be a mapping of category names to include/exclude objects');
    } else {
      const allowed: CategoryName[] = ['plan-docs', 'scratch-scripts', 'custom'];
      for (const key of Object.keys(doc.categories)) {
        if (!allowed.includes(key as CategoryName)) {
          errors.push(`unknown category "${key}" (expected: ${allowed.join(', ')})`);
          continue;
        }
        const val = (doc.categories as Record<string, unknown>)[key];
        if (!isPlainObject(val)) {
          errors.push(`categories.${key} must be a mapping with optional include/exclude arrays`);
          continue;
        }
        const cat: CategoryConfig = {};
        for (const field of ['include', 'exclude'] as const) {
          const v = val[field];
          if (v === undefined) continue;
          if (Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== '')) {
            cat[field] = (v as string[]).map(normalizeRelPath);
          } else {
            errors.push(`categories.${key}.${field} must be an array of non-empty glob strings`);
          }
        }
        for (const extra of Object.keys(val)) {
          if (extra !== 'include' && extra !== 'exclude') {
            errors.push(`unknown key "categories.${key}.${extra}" (expected: include, exclude)`);
          }
        }
        cfg.categories[key as CategoryName] = cat;
      }
    }
  }
  if (errors.length > 0) {
    throw new ConfigError(errors);
  }
  return cfg;
}
