import { DetectedArtifact } from './detect.js';
import { RefResult } from './refs.js';
import { FileGitMeta, LastCommit } from './gitmeta.js';
import { Config } from './config.js';
export type Verdict = 'protected' | 'keep' | 'recent' | 'needs-review' | 'safe-to-remove';
export interface Evidence {
    /** Number of distinct files referencing the artifact. */
    refs: number;
    refExamples: string[];
    codeRefs: number;
    docRefs: number;
    otherRefs: number;
    ageDays: number;
    lastCommit: LastCommit | null;
    neverCommitted: boolean;
    /** Commit subject matched by the task-merged heuristic (plan docs only). */
    taskMerged?: string;
}
export interface VerdictResult {
    verdict: Verdict;
    reason: string;
    evidence: Evidence;
}
/** Ordered from most removable to least removable. */
export declare const VERDICT_ORDER: Verdict[];
export declare function verdictRank(v: Verdict): number;
export declare function emptySummary(): Record<Verdict, number>;
/** A protected entry matches the exact path or any path underneath it. */
export declare function isProtectedPath(relPath: string, config: Config): boolean;
/**
 * Deterministic verdict engine. Checks run in a fixed order; the first match
 * wins:
 *   1. protected                      -> protected
 *   2. referenced by any code file    -> keep
 *   3. age < minAgeDays               -> recent
 *   4. referenced by docs/other       -> needs-review
 *   5. plan-doc, task merged, 0 refs  -> safe-to-remove
 *   6. 0 refs and age >= minAgeDays   -> safe-to-remove
 *   7. anything else                  -> needs-review
 */
export declare function evaluate(artifact: DetectedArtifact, refs: RefResult, meta: FileGitMeta, config: Config, taskMerged?: string | null): VerdictResult;
