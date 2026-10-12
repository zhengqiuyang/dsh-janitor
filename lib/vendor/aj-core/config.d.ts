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
export declare const CONFIG_FILENAME = "agent-janitor.yaml";
export declare const DEFAULT_CONFIG: Config;
export declare class ConfigError extends Error {
    errors: string[];
    constructor(errors: string[]);
}
export declare function configPathFor(root: string): string;
/**
 * Load agent-janitor.yaml. When no explicit path is given and the default file
 * does not exist, defaults are returned (zero-config operation). An explicitly
 * passed config file that is missing is an error. All validation problems are
 * accumulated and reported together.
 */
export declare function loadConfig(root: string, explicitPath?: string): Config;
export declare function validateConfig(doc: unknown, source: string): Config;
