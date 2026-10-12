import { Config } from './config.js';
import { Evidence, Verdict } from './verdict.js';
export interface PlanItem {
    path: string;
    category: string;
    verdict: Verdict;
    reason: string;
    evidence: Evidence;
    /** Snapshot taken at plan time; verify-plan compares against it. */
    snapshot: {
        sha256: string | null;
        lastCommitHash: string | null;
        refFiles: string[];
    };
}
export interface PlanData {
    version: 1;
    generatedAt: string;
    root: string;
    config: {
        minAgeDays: number;
        archiveDir: string;
        protected: string[];
    };
    items: PlanItem[];
    summary: Record<Verdict, number>;
}
export declare const PLAN_DIR = ".agent-janitor";
/**
 * Full deterministic analysis of a repo: detect artifacts, gather evidence
 * (references, git age, task-merged), and assign verdicts. This is the shared
 * core of `scan` and `plan`.
 */
export declare function analyze(root: string, config: Config, now?: number): PlanData;
export declare function renderPlanMarkdown(plan: PlanData): string;
/** Write the JSON plan and the human-readable cleanup-plan.md. */
export declare function writePlanFiles(root: string, plan: PlanData): {
    jsonPath: string;
    mdPath: string;
};
export declare class PlanError extends Error {
    errors: string[];
    constructor(errors: string[]);
}
export declare function readPlanFile(planFile: string): PlanData;
