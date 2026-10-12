/** Convert a filesystem path to posix separators. */
export declare function toPosix(p: string): string;
/** Normalize a repo-relative path: posix separators, no leading ./ or trailing slashes. */
export declare function normalizeRelPath(p: string): string;
/** True when `child` equals `dir` or lives underneath it (both repo-relative posix). */
export declare function isUnderDir(child: string, dir: string): boolean;
/** yyyyMMdd-HHmmss in local time (used for plan file names). */
export declare function stampFromDate(d: Date): string;
/** yyyyMMdd in local time (used for archive subdirectories). */
export declare function dateStampFromDate(d: Date): string;
/** Heuristic binary check: a NUL byte in the first 8 KiB marks binary content. */
export declare function isBinaryBuffer(buf: Buffer): boolean;
/**
 * Read a file as UTF-8 text. Returns null when the path is missing, is not a
 * regular file, exceeds maxBytes, or looks binary. CRLF content is returned
 * verbatim; all consumers are CRLF-tolerant.
 */
export declare function readTextFile(absPath: string, maxBytes?: number): string | null;
export declare function sha256Text(text: string): string;
/** Content hash used for plan snapshots; null for unreadable/binary/oversized files. */
export declare function sha256FileSync(absPath: string): string | null;
export declare function setColorEnabled(v: boolean): void;
export declare const COLOR_CODES: {
    readonly red: "31";
    readonly green: "32";
    readonly yellow: "33";
    readonly blue: "34";
    readonly magenta: "35";
    readonly cyan: "36";
    readonly gray: "90";
};
export declare function colorize(text: string, code: string): string;
export declare function verdictColor(verdict: string): string;
export declare function padCell(text: string, width: number): string;
