/** Ordered from most removable to least removable. */
export const VERDICT_ORDER = ['safe-to-remove', 'needs-review', 'recent', 'keep', 'protected'];
export function verdictRank(v) {
    return VERDICT_ORDER.indexOf(v);
}
export function emptySummary() {
    const s = {};
    for (const v of VERDICT_ORDER)
        s[v] = 0;
    return s;
}
/** A protected entry matches the exact path or any path underneath it. */
export function isProtectedPath(relPath, config) {
    return config.protected.some((p) => p === relPath || relPath.startsWith(p + '/'));
}
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
export function evaluate(artifact, refs, meta, config, taskMerged) {
    const evidence = {
        refs: refs.total,
        refExamples: refs.examples,
        codeRefs: refs.codeRefs,
        docRefs: refs.docRefs,
        otherRefs: refs.otherRefs,
        ageDays: meta.ageDays,
        lastCommit: meta.lastCommit,
        neverCommitted: meta.neverCommitted,
    };
    if (taskMerged) {
        evidence.taskMerged = taskMerged;
    }
    if (isProtectedPath(artifact.path, config)) {
        return { verdict: 'protected', reason: 'listed in config protected paths', evidence };
    }
    if (refs.codeRefs > 0) {
        return {
            verdict: 'keep',
            reason: `referenced by ${refs.codeRefs} code file(s) (e.g. ${refs.examples[0] ?? 'unknown'})`,
            evidence,
        };
    }
    if (meta.ageDays < config.minAgeDays) {
        return {
            verdict: 'recent',
            reason: `last touched ${meta.ageDays}d ago (< minAgeDays ${config.minAgeDays})` +
                (meta.neverCommitted ? '; never committed' : ''),
            evidence,
        };
    }
    if (refs.total > 0) {
        return {
            verdict: 'needs-review',
            reason: `referenced by ${refs.total} non-code file(s) (e.g. ${refs.examples[0] ?? 'unknown'}); a human should decide`,
            evidence,
        };
    }
    if (artifact.category === 'plan-docs' && taskMerged) {
        return {
            verdict: 'safe-to-remove',
            reason: `plan task merged (commit "${taskMerged}") and no references found`,
            evidence,
        };
    }
    if (refs.total === 0 && meta.ageDays >= config.minAgeDays) {
        return {
            verdict: 'safe-to-remove',
            reason: `no references found and age ${meta.ageDays}d >= minAgeDays ${config.minAgeDays}`,
            evidence,
        };
    }
    return { verdict: 'needs-review', reason: 'no stronger rule applied; needs human review', evidence };
}
