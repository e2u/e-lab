import { GRID } from "./types";

/** Approximate rendered width of one character (CJK / full-width glyphs are ~1em). */
function charWidth(ch: string, fontSize: number): number {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x1f300)) {
        return fontSize;
    }
    if (ch === " ") return fontSize * 0.3;
    if (/[ilj.,:;'|!]/.test(ch)) return fontSize * 0.3;
    if (/[mwMW@]/.test(ch)) return fontSize * 0.85;
    if (/[A-Z0-9]/.test(ch)) return fontSize * 0.64;
    return fontSize * 0.55;
}

/** Wrap comment text into lines that fit `maxWidth` px; words wrap whole, CJK wraps per char. */
export function wrapCommentText(text: string, maxWidth: number, fontSize: number): string[] {
    const out: string[] = [];
    for (const para of text.split("\n")) {
        // Tokens: runs of non-space Latin, single CJK chars, or spaces.
        const tokens = para.match(/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|\s+|[^\s\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]+/gu) ?? [];
        let line = "";
        let lineW = 0;
        const flush = () => {
            out.push(line.replace(/\s+$/, ""));
            line = "";
            lineW = 0;
        };
        for (const tok of tokens) {
            const tokW = [...tok].reduce((s, ch) => s + charWidth(ch, fontSize), 0);
            if (/^\s+$/.test(tok)) {
                if (line) {
                    line += tok;
                    lineW += tokW;
                }
                continue;
            }
            if (lineW + tokW <= maxWidth) {
                line += tok;
                lineW += tokW;
                continue;
            }
            if (line) flush();
            if (tokW <= maxWidth) {
                line = tok;
                lineW = tokW;
                continue;
            }
            // Word longer than the box: break by character.
            for (const ch of tok) {
                const cw = charWidth(ch, fontSize);
                if (line && lineW + cw > maxWidth) flush();
                line += ch;
                lineW += cw;
            }
        }
        flush();
    }
    return out;
}

/** Box height (grid units) needed to show all wrapped text at the given width; never below `minH`. */
export function commentFitHeight(text: string, widthGrid: number, fontSize: number, minH: number): number {
    const customW = widthGrid * GRID;
    const lines = wrapCommentText(text || "(Note)", Math.max(customW - 16, fontSize), fontSize);
    // Text block starts at y=13 and each line advances fontSize*1.25; leave ~6px bottom padding.
    const needPx = 13 + lines.length * fontSize * 1.25 + 6;
    return Math.max(minH, Math.ceil(needPx / GRID));
}

/** Title-block DESCRIPTION wrap: mono font, CJK counts as 2 cells; long words break. */
export function titleBlockDescLines(text: string, perChar: number): string[] {
    if (!text) return [""];
    const cells = (s: string) => [...s].reduce((n, ch) => n + (charWidth(ch, 1) >= 1 ? 2 : 1), 0);
    const out: string[] = [];
    for (const para of text.split("\n")) {
        const tokens = para.match(/[\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60]|\s+|[^\s\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60]+/gu) ?? [];
        let cur = "";
        for (const tok of tokens) {
            if (/^\s+$/.test(tok)) { if (cur) cur += " "; continue; }
            if (cells(cur + tok) <= perChar) { cur += tok; continue; }
            if (cur.trim()) out.push(cur.trimEnd());
            cur = "";
            for (const ch of tok) {
                if (cur && cells(cur + ch) > perChar) { out.push(cur); cur = ""; }
                cur += ch;
            }
        }
        out.push(cur.trimEnd());
    }
    return out.length ? out : [""];
}

/** Title-block layout constants (design units; width matches catalog `title-block` w). */
export const TB_W = 28;
// Safety margin: bold mono / fallback fonts render wider than 0.6em.
export const TB_PER_CHAR = Math.max(1, Math.floor((TB_W * GRID - 1.2 * GRID) / (0.68 * 11)));
export function titleBlockDesignH(nLines: number): number {
    const r1h = (0.34 + 0.92 + 0.28) * GRID;
    return 2 * r1h + (0.34 + 0.3 + 0.24) * GRID + nLines * 0.72 * GRID;
}
/** Outer height (grid) keeping width fixed; one line = base height, grows per extra line. */
export function titleBlockFitHeight(description: string, baseH: number): number {
    const n = titleBlockDescLines((description ?? "").toUpperCase(), TB_PER_CHAR).length;
    return Math.ceil(baseH * titleBlockDesignH(n) / titleBlockDesignH(1) - 0.01);
}
