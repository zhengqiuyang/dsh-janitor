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
import { defineTool } from '@deepseek-ai/dsh-tools';
import { analyze, renderPlanMarkdown } from './vendor/aj-core/plan.js';
import { DEFAULT_CONFIG, type Config as JanitorConfig } from './vendor/aj-core/config.js';

export const name = 'dsh-janitor';
export const inject = ['tools'];

export interface Config {
  /** Artifacts younger than this many days are 'recent', never removable. */
  minAgeDays: number;
  /** Extra protected paths (exact file or directory prefix); never removal candidates. */
  protectedPaths: string[];
}

export const Config: Schema<Config> = Schema.object({
  minAgeDays: Schema.number().default(14).description('artifacts younger than this stay (recent)'),
  protectedPaths: Schema.array(Schema.string()).default([]).description('protected paths (exact file or directory prefix)'),
});

export function apply(ctx: Context, config: Config) {
  const janitorConfig: JanitorConfig = {
    ...DEFAULT_CONFIG,
    minAgeDays: config.minAgeDays,
    protected: [...DEFAULT_CONFIG.protected, ...config.protectedPaths],
  };

  console.log(
    `[dsh-janitor] active: janitor_scan tool registered ` +
      `(minAgeDays=${janitorConfig.minAgeDays}, protected=${janitorConfig.protected.length} pattern(s); scan-only, never deletes)`,
  );

  ctx.tools.register(
    defineTool({
      name: 'janitor_scan',
      description:
        'Scan the workspace for agent-session debris (plan docs, scratch scripts, one-off files) ' +
        'and return a deterministic, reviewable cleanup plan with per-file verdicts and evidence. ' +
        'Never deletes anything — present the plan to the user.',
      parameters: {
        root: {
          type: 'string',
          description: 'Workspace root to scan; defaults to the session working directory.',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const root = typeof args.root === 'string' && args.root.length > 0 ? args.root : process.cwd();
        const plan = analyze(root, janitorConfig);
        return renderPlanMarkdown(plan);
      },
    }),
  );
}
