import { describe, expect, it } from "vitest";
import { ENABLE_AUTO_LAYOUT, ENABLE_LADDER } from "./features";

describe("compile-time feature flags", () => {
  it("defaults both flags to false (hidden)", () => {
    // Viewing schematic/ladder is always on. ENABLE_LADDER is reserved for editing.
    expect(typeof ENABLE_LADDER).toBe("boolean");
    expect(typeof ENABLE_AUTO_LAYOUT).toBe("boolean");
    expect(ENABLE_LADDER).toBe(false);
    expect(ENABLE_AUTO_LAYOUT).toBe(false);
  });
});
