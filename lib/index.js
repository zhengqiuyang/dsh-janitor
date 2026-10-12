import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { analyze, renderPlanMarkdown } from './vendor/aj-core/plan.js';
import { DEFAULT_CONFIG } from './vendor/aj-core/config.js';
export const name = 'dsh-janitor';
export const inject = ['tools'];
export const Config = Schema.object({
    minAgeDays: Schema.number().default(14).description('artifacts younger than this stay (recent)'),
    protectedPaths: Schema.array(Schema.string()).default([]).description('protected paths (exact file or directory prefix)'),
});
export function apply(ctx, config) {
    const janitorConfig = {
        ...DEFAULT_CONFIG,
        minAgeDays: config.minAgeDays,
        protected: [...DEFAULT_CONFIG.protected, ...config.protectedPaths],
    };
    console.log(`[dsh-janitor] active: janitor_scan tool registered ` +
        `(minAgeDays=${janitorConfig.minAgeDays}, protected=${janitorConfig.protected.length} pattern(s); scan-only, never deletes)`);
    ctx.tools.register(defineTool({
        name: 'janitor_scan',
        description: 'Scan the workspace for agent-session debris (plan docs, scratch scripts, one-off files) ' +
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
    }));
}
