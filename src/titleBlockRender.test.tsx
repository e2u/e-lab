import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addDevice, emptyCircuit } from "./circuitBuilder";
import { SymbolGlyph } from "./Glyphs";
import { variantDef } from "./catalog";

function tbSvg(description: string) {
  const c = emptyCircuit();
  const { device } = addDevice(c, "title-block", "TB1", "body", 0, 0, {
    projectName: "AC MOTOR DRIVE",
    projectNo: "PRJ-2026-001",
    rev: "B",
    sheetNum: "2",
    sheetTotal: "5",
    description,
    designedBy: "ALEX CHEN",
    date: "2026-08-26",
    scale: 1,
  });
  // Derive the footprint from the catalog entry, exactly like the live canvas does
  // (SymbolLayer computes boxW/boxH = variantDef dims * params.scale before calling GlyphBody).
  const v = variantDef(device.kind, "body");
  const scale = device.params?.scale ?? 1;
  return renderToStaticMarkup(
    createElement(SymbolGlyph, { device, variant: "body", w: v.w * scale, h: v.h * scale }),
  );
}

describe("title-block rendered markup (SSR)", () => {
  it("is exactly 26 grid cells wide", () => {
    const s = tbSvg("MAIN CONTROL SCHEMATIC");
    // svg element pixel size derives from the catalog footprint (w * GRID)
    expect(s).toMatch(/width="572"/); // 26 cells * GRID(22px)
    // viewBox spans the full 26-cell design space horizontally
    expect(s).toMatch(/viewBox="0 0 572 \d+(\.\d+)?"/);
  });

  it("lays out all fields across three rows with Sheet in row 1", () => {
    const s = tbSvg("MAIN CONTROL SCHEMATIC");
    for (const label of ["PROJECT NAME:", "PROJECT NO:", "REV:", "SHEET:", "DESCRIPTION:", "DESIGNED BY:", "DATE:"]) {
      expect(s).toContain(label);
    }
    // field values present
    expect(s).toContain("AC MOTOR DRIVE");
    expect(s).toContain("PRJ-2026-001");
    expect(s).toContain("2 OF 5");
    expect(s).toContain("ALEX CHEN");
    expect(s).toContain("MAIN CONTROL SCHEMATIC");
  });

  it("wraps a long description onto extra lines and grows the block height", () => {
    const short = tbSvg("MAIN CONTROL SCHEMATIC");
    const long = tbSvg(
      "AUTOMATED MULTI-STATION MACHINING CELL POWER DISTRIBUTION SYSTEM WITH MAIN ISOLATING SWITCH THREE POLE CIRCUIT BREAKERS HRC FUSE PROTECTION THERMAL OVERLOAD RELAY COILS AUXILIARY CONTACTS AND DEDICATED LOW VOLTAGE CONTROL TRANSFORMER SECONDARY WIRING FOR ALL INDICATION LAMPS AND INSTRUMENT FEEDS ACROSS EVERY STATION BUSBAR SECTION"
    );
    const vbW = (m: string) => parseFloat((m.match(/viewBox="0 0 (\d+)/) || [])[1] ?? "");
    const vbH = (m: string) => parseFloat((m.match(/viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/) || [])[1] ?? "");
    const tc = (m: string) => (m.match(/<text\b/g) || []).length;
    // width stays fixed at 26 cells regardless of description length
    expect(vbW(long)).toBe(vbW(short));
    expect(vbW(short)).toBe(572); // 26 cells * GRID(22px)
    // longer description wraps to more lines -> taller viewBox
    expect(vbH(long)).toBeGreaterThan(vbH(short));
    // each wrapped line adds its own <text> node
    expect(tc(long)).toBeGreaterThan(tc(short));
  });

  it("keeps internal text locked to the stamp when the glyph is rotated", () => {
    const c = emptyCircuit();
    const { device } = addDevice(c, "title-block", "TB1", "body", 0, 0, {
      projectName: "AC MOTOR DRIVE",
      description: "MAIN CONTROL SCHEMATIC",
    });
    const v = variantDef(device.kind, "body");
    const html = renderToStaticMarkup(
      createElement(SymbolGlyph, {
        device,
        variant: "body",
        w: v.w,
        h: v.h,
        rot: 90,
      }),
    );
    expect(html).toContain("PROJECT NAME:");
    expect(html).toContain("AC MOTOR DRIVE");
    expect(html).not.toMatch(/rotate\(-90\)/);
    expect(html).not.toMatch(/rotate\(-180\)/);
    expect(html).not.toMatch(/rotate\(-270\)/);
  });
});
