import fs from 'node:fs';
import path from 'node:path';
import { detectFromFiles, filterScannable, listWorktreeFiles } from './detect.js';
import { ContentCache, findReferences } from './refs.js';
import { findTaskMerged, getFileGitMeta, planStems } from './gitmeta.js';
import { evaluate, emptySummary, VERDICT_ORDER } from './verdict.js';
import { readTextFile, sha256Text, stampFromDate } from './util.js';
export const PLAN_DIR = '.agent-janitor';
/**
 * Full deterministic analysis of a repo: detect artifacts, gather evidence
 * (references, git age, task-merged), and assign verdicts. This is the shared
 * core of `scan` and `plan`.
 */
export function analyze(root, config, now = Date.now()) {
    const files = filterScannable(listWorktreeFiles(root), config.archiveDir);
    const artifacts = detectFromFiles(files, config);
    const cache = new ContentCache(root, files);
    const items = [];
    for (const artifact of artifacts) {
        const refs = findReferences(root, artifact.path, files, cache);
        const meta = getFileGitMeta(root, artifact.path, now);
        const taskMerged = artifact.category === 'plan-docs' ? findTaskMerged(root, planStems(artifact.path)) : undefined;
        const result = evaluate(artifact, refs, meta, config, taskMerged);
        const text = readTextFile(path.join(root, ...artifact.path.split('/')));
        items.push({
            path: artifact.path,
            category: artifact.category,
            verdict: result.verdict,
            reason: result.reason,
            evidence: result.evidence,
            snapshot: {
                sha256: text !== null ? sha256Text(text) : null,
                lastCommitHash: meta.lastCommit ? meta.lastCommit.hash : null,
                refFiles: refs.refFiles,
            },
        });
    }
    const summary = emptySummary();
    for (const it of items)
        summary[it.verdict]++;
    return {
        version: 1,
        generatedAt: new Date(now).toISOString(),
        root: path.resolve(root),
        config: {
            minAgeDays: config.minAgeDays,
            archiveDir: config.archiveDir,
            protected: [...config.protected],
        },
        items,
        summary,
    };
}
export function renderPlanMarkdown(plan) {
    const lines = [];
    lines.push('# agent-janitor cleanup plan');
    lines.push('');
    lines.push(`- Generated: ${plan.generatedAt}`);
    lines.push(`- Root: ${plan.root}`);
    lines.push(`- Min age: ${plan.config.minAgeDays}d`);
    lines.push('- Apply: agent-janitor apply --plan <plan.json> [--mode archive|delete] [--include-review]');
    lines.push('- Verify: agent-janitor verify-plan <plan.json>');
    lines.push('');
    lines.push('## summary');
    lines.push('');
    lines.push('| verdict | count |');
    lines.push('|---|---|');
    for (const v of VERDICT_ORDER) {
        lines.push(`| ${v} | ${plan.summary[v]} |`);
    }
    lines.push('');
    for (const v of VERDICT_ORDER) {
        const group = plan.items.filter((i) => i.verdict === v);
        if (group.length === 0)
            continue;
        lines.push(`## ${v} (${group.length})`);
        lines.push('');
        for (const item of group) {
            lines.push(`### ${item.path}`);
            lines.push('');
            lines.push(`- category: ${item.category}`);
            lines.push(`- reason: ${item.reason}`);
            const lc = item.evidence.lastCommit;
            const lastCommitPart = lc ? ` — last commit ${lc.short} ${lc.date} "${lc.subject}"` : '';
            lines.push(`- age: ${item.evidence.ageDays}d${item.evidence.neverCommitted ? ' (never committed)' : ''}${lastCommitPart}`);
            const examples = item.evidence.refExamples.length > 0 ? ` — e.g. ${item.evidence.refExamples.join(', ')}` : '';
            lines.push(`- references: ${item.evidence.refs} (code ${item.evidence.codeRefs} / docs ${item.evidence.docRefs} / other ${item.evidence.otherRefs})${examples}`);
            if (item.evidence.taskMerged) {
                lines.push(`- task merged: commit "${item.evidence.taskMerged}"`);
            }
            lines.push('');
        }
    }
    return lines.join('\n') + '\n';
}
/** Write the JSON plan and the human-readable cleanup-plan.md. */
export function writePlanFiles(root, plan) {
    const dir = path.join(root, PLAN_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = stampFromDate(new Date(plan.generatedAt));
    const jsonPath = path.join(dir, `plan-${stamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
    const mdPath = path.join(dir, 'cleanup-plan.md');
    fs.writeFileSync(mdPath, renderPlanMarkdown(plan), 'utf8');
    return { jsonPath, mdPath };
}
// ---------------------------------------------------------------------------
// Plan file reading / validation (errors accumulated, like config validation)
// ---------------------------------------------------------------------------
export class PlanError extends Error {
    errors;
    constructor(errors) {
        super(`invalid plan file:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
        this.errors = errors;
        this.name = 'PlanError';
    }
}
const VERDICT_SET = new Set(VERDICT_ORDER);
export function readPlanFile(planFile) {
    let raw;
    try {
        raw = fs.readFileSync(planFile, 'utf8');
    }
    catch {
        throw new PlanError([`plan file not found: ${planFile}`]);
    }
    let doc;
    try {
        doc = JSON.parse(raw);
    }
    catch (e) {
        throw new PlanError([`invalid JSON: ${e.message}`]);
    }
    const errors = [];
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
        throw new PlanError(['top-level value must be an object']);
    }
    if (doc.version !== 1) {
        errors.push(`unsupported plan version ${JSON.stringify(doc.version)} (expected 1)`);
    }
    if (typeof doc.root !== 'string' || doc.root.trim() === '') {
        errors.push('"root" must be a non-empty string');
    }
    if (typeof doc.generatedAt !== 'string' || Number.isNaN(Date.parse(doc.generatedAt))) {
        errors.push('"generatedAt" must be an ISO timestamp');
    }
    const cfg = doc.config;
    if (typeof cfg !== 'object' || cfg === null || typeof cfg.archiveDir !== 'string') {
        errors.push('"config.archiveDir" must be a string');
    }
    if (!Array.isArray(doc.items)) {
        errors.push('"items" must be an array');
    }
    else {
        doc.items.forEach((rawItem, i) => {
            const at = `items[${i}]`;
            if (typeof rawItem !== 'object' || rawItem === null) {
                errors.push(`${at} must be an object`);
                return;
            }
            const it = rawItem;
            if (typeof it.path !== 'string' || it.path.trim() === '') {
                errors.push(`${at}.path must be a non-empty string`);
            }
            if (typeof it.category !== 'string' || it.category.trim() === '') {
                errors.push(`${at}.category must be a non-empty string`);
            }
            if (typeof it.verdict !== 'string' || !VERDICT_SET.has(it.verdict)) {
                errors.push(`${at}.verdict must be one of: ${VERDICT_ORDER.join(', ')}`);
            }
            if (typeof it.reason !== 'string') {
                errors.push(`${at}.reason must be a string`);
            }
            if (typeof it.evidence !== 'object' || it.evidence === null) {
                errors.push(`${at}.evidence must be an object`);
            }
            if (typeof it.snapshot !== 'object' || it.snapshot === null) {
                errors.push(`${at}.snapshot must be an object`);
            }
            else {
                const snap = it.snapshot;
                if (snap.sha256 !== null && typeof snap.sha256 !== 'string') {
                    errors.push(`${at}.snapshot.sha256 must be a string or null`);
                }
                if (snap.lastCommitHash !== null && typeof snap.lastCommitHash !== 'string') {
                    errors.push(`${at}.snapshot.lastCommitHash must be a string or null`);
                }
                if (!Array.isArray(snap.refFiles) || !snap.refFiles.every((f) => typeof f === 'string')) {
                    errors.push(`${at}.snapshot.refFiles must be an array of strings`);
                }
            }
        });
    }
    if (errors.length > 0) {
        throw new PlanError(errors);
    }
    const items = doc.items;
    const summary = emptySummary();
    for (const it of items) {
        if (VERDICT_SET.has(it.verdict))
            summary[it.verdict]++;
    }
    return {
        version: 1,
        root: doc.root,
        generatedAt: doc.generatedAt,
        config: cfg,
        items,
        summary,
    };
}
