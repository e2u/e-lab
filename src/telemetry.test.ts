import { describe, it, expect, beforeEach, vi } from "vitest";
import { initFirebase, isFirebaseConfigured } from "./firebase";
import {
  initAnalyticsTracking,
  trackEvent,
  trackComponentPlaced,
  trackComponentDeleted,
  trackCircuitRun,
  trackLadderView,
  trackExportJson,
  trackOpenJson,
  getVisitorId,
  getSessionId,
} from "./analytics";
import { initErrorLogging, reportError } from "./errorLogger";

describe("Firebase & Telemetry Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should check firebase configuration status safely", () => {
    // Under test environment without .env.local, isFirebaseConfigured should return false
    expect(typeof isFirebaseConfigured()).toBe("boolean");
  });

  it("should initialize Firebase safely without throwing errors", async () => {
    const result = await initFirebase();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("app");
    expect(result).toHaveProperty("analytics");
    expect(result).toHaveProperty("db");
  });

  it("should generate and persist unique visitorId and sessionId", () => {
    const vid1 = getVisitorId();
    const vid2 = getVisitorId();
    expect(vid1).toBeDefined();
    expect(vid1).toBe(vid2);

    const sid1 = getSessionId();
    const sid2 = getSessionId();
    expect(sid1).toBeDefined();
    expect(sid1).toBe(sid2);
  });

  it("should record domain telemetry events safely without crashing", () => {
    expect(() => {
      initAnalyticsTracking();
      trackEvent("test_event", { key: "value" });
      trackComponentPlaced("contactor", "relays", 5);
      trackComponentDeleted("relay");
      trackCircuitRun({ symbolCount: 10, wireCount: 8, deviceCount: 4 });
      trackLadderView({ source: "toggle", symbolCount: 12 });
      trackExportJson({ symbolCount: 15, deviceCount: 6, hasName: true });
      trackOpenJson({ source: "file", symbolCount: 15, name: "Motor Control" });
    }).not.toThrow();
  });

  it("should intercept and report errors safely without crashing", async () => {
    expect(() => {
      initErrorLogging();
    }).not.toThrow();

    await expect(
      reportError("uncaught", "Test Error Message", {
        filename: "test.ts",
        lineno: 42,
        colno: 1,
      }),
    ).resolves.not.toThrow();
  });
});
