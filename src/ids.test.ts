import { describe, expect, it } from "vitest";
import { rememberIds, resetSeqForTests, sanitizeCircuitIds, uid, uniqueId } from "./ids";

describe("ids", () => {
  it("does not reuse ids from a reloaded draft", () => {
    resetSeqForTests(1);
    const used = new Set(["d_2", "s_3", "d_4", "s_5"]);
    rememberIds(used);
    const a = uniqueId("d", new Set(used));
    const b = uniqueId("s", new Set([...used, a]));
    expect(used.has(a)).toBe(false);
    expect(used.has(b)).toBe(false);
    expect(a).not.toBe("d_2");
    expect(b).not.toBe("s_3");
  });

  it("keeps uid unique even if the counter is reset", () => {
    resetSeqForTests(1);
    const first = uid("d");
    resetSeqForTests(1);
    const again = uid("d");
    expect(again).not.toBe(first);
  });

  it("renames colliding ids in a saved circuit", () => {
    const circuit = {
      devices: [
        { id: "d_2" },
        { id: "d_2" },
      ],
      symbols: [
        { id: "s_3" },
        { id: "s_3" },
      ],
      wires: [{ id: "w_4" }],
    };
    sanitizeCircuitIds(circuit);
    expect(circuit.devices[0].id).not.toBe(circuit.devices[1].id);
    expect(circuit.symbols[0].id).not.toBe(circuit.symbols[1].id);
  });
});
