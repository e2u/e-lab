import { describe, expect, it } from "vitest";
import { ENABLE_AUTO_LAYOUT, ENABLE_LADDER } from "./features";

describe("compile-time feature flags", () => {
  it("defaults both flags to false (hidden)", () => {
    // In standard build / test without env overrides, both flags are false
    expect(typeof ENABLE_LADDER).toBe("boolean");
    expect(typeof ENABLE_AUTO_LAYOUT).toBe("boolean");
    expect(ENABLE_LADDER).toBe(false);
    expect(ENABLE_AUTO_LAYOUT).toBe(false);
  });
});
