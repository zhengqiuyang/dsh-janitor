/**
 * dsh-janitor — deterministic artifact lifecycle for DeepSeek Harness.
 *
 * Agent sessions leave debris: plan docs, scratch scripts, one-off fixtures.
 * This plugin registers a `janitor_scan` tool that runs the agent-janitor
 * engine over the workspace and returns a REVIEWABLE cleanup plan —
 * protected / keep / recent / needs-review / safe-to-remove, with evidence.
 *
 * The janitor is never an agent: the scan and verdicts are deterministic,
 * and v0.1 never deletes anything. Applying a reviewed plan stays with the
 * upstream CLI (or with you), on purpose.
 *
 * Family: read-guard (what agents read) · pr-gate (what they write) ·
 * attest (what they did) · mcp-test (what they can call) · janitor (what
 * they leave behind).
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "dsh-janitor";
export declare const inject: string[];
export interface Config {
    /** Artifacts younger than this many days are 'recent', never removable. */
    minAgeDays: number;
    /** Extra protected paths (exact file or directory prefix); never removal candidates. */
    protectedPaths: string[];
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
