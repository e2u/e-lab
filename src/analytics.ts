import { getFirebaseAnalytics, logEvent, getFirebaseDb, collection, addDoc, serverTimestamp } from "./firebase";

// Unique visitor ID (persistent across sessions in localStorage)
export function getVisitorId(): string {
  try {
    let vid = localStorage.getItem("elab.visitorId");
    if (!vid) {
      vid = "v_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36);
      localStorage.setItem("elab.visitorId", vid);
    }
    return vid;
  } catch {
    return "v_unknown";
  }
}

// Session ID (ephemeral per browser tab in sessionStorage)
export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem("elab.sessionId");
    if (!sid) {
      sid = "s_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36);
      sessionStorage.setItem("elab.sessionId", sid);
    }
    return sid;
  } catch {
    return "s_unknown";
  }
}

let sessionStartTime = Date.now();
let isInitialized = false;

// Safe event logger
export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  try {
    const analytics = getFirebaseAnalytics();
    const enrichedParams = {
      ...params,
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
    };

    if (analytics) {
      logEvent(analytics, eventName, enrichedParams);
    }

    if (import.meta.env.DEV) {
      // Helpful in development mode
      // console.debug(`[Analytics] ${eventName}:`, enrichedParams);
    }
  } catch (err) {
    // Analytics should never crash the app
    console.warn("[Analytics] Error tracking event:", eventName, err);
  }
}

// Track session start and page views with rich metadata
export function initAnalyticsTracking(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;
  sessionStartTime = Date.now();

  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const referrer = document.referrer || "direct";
  const url = window.location.href;
  const screenRes = `${window.innerWidth}x${window.innerHeight}`;
  const language = navigator.language || "unknown";
  const userAgent = navigator.userAgent || "unknown";

  // 1. Log Session / Visit
  trackEvent("session_init", {
    referrer,
    screen_resolution: screenRes,
    language,
    user_agent: userAgent,
    page_url: url,
    source: referrer.includes("google")
      ? "google"
      : referrer.includes("github")
        ? "github"
        : referrer === "direct"
          ? "direct"
          : "other",
  });

  // 2. Track Session Duration on page unload or visibility change
  const reportDuration = () => {
    const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    if (durationSec > 1) {
      trackEvent("session_duration", {
        duration_seconds: durationSec,
      });
    }
  };

  window.addEventListener("beforeunload", reportDuration);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportDuration();
    }
  });

  // Optional: Firestore session registration (if db available and wanted)
  tryRecordSessionInFirestore({
    visitorId,
    sessionId,
    referrer,
    screenRes,
    language,
    userAgent,
    url,
  });
}

async function tryRecordSessionInFirestore(info: Record<string, any>) {
  try {
    const db = getFirebaseDb();
    if (!db) return;

    // Check if session was already recorded to avoid duplicate writes
    if (sessionStorage.getItem("elab.sessionLogged")) return;
    sessionStorage.setItem("elab.sessionLogged", "1");

    await addDoc(collection(db, "telemetry_sessions"), {
      ...info,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Ignore Firestore errors (e.g. offline or rules restriction)
  }
}

// Domain-Specific Telemetry Helpers

export function trackComponentPlaced(kind: string, group?: string, totalCount?: number) {
  trackEvent("component_placed", {
    kind,
    group: group || "default",
    total_symbols: totalCount ?? 0,
  });
}

export function trackComponentDeleted(kind?: string) {
  trackEvent("component_deleted", {
    kind: kind || "unknown",
  });
}

export function trackCircuitRun(stats: { symbolCount: number; wireCount: number; deviceCount: number }) {
  trackEvent("circuit_run", {
    symbol_count: stats.symbolCount,
    wire_count: stats.wireCount,
    device_count: stats.deviceCount,
  });
}

export function trackCircuitPause() {
  trackEvent("circuit_pause");
}

export function trackCircuitReset() {
  trackEvent("circuit_reset");
}

export function trackCircuitStep() {
  trackEvent("circuit_step");
}

export function trackLadderView(details: { source: string; symbolCount?: number }) {
  trackEvent("ladder_view", {
    source: details.source,
    symbol_count: details.symbolCount ?? 0,
  });
}

export function trackExportJson(details: { symbolCount: number; deviceCount: number; hasName: boolean }) {
  trackEvent("export_json", details);
}

export function trackOpenJson(details: { source: "file" | "example" | "url_hash" | "local_save"; symbolCount?: number; name?: string }) {
  trackEvent("open_json", details);
}

export function trackExportImage(format: "svg" | "png" | "print") {
  trackEvent("export_image", { format });
}

export function trackExampleLoaded(id: string, name?: string) {
  trackEvent("example_loaded", {
    example_id: id,
    example_name: name || id,
  });
}

export function trackShareLinkCreated(details: { symbolCount: number }) {
  trackEvent("share_link_created", details);
}

export function trackSaveToLibrary(name: string) {
  trackEvent("save_to_library", { doc_name: name });
}

export function trackThemeChange(theme: string) {
  trackEvent("theme_changed", { theme });
}

export function trackLangChange(lang: string) {
  trackEvent("lang_changed", { lang });
}

export function trackTutorialAction(stageId: string, action: string) {
  trackEvent("tutorial_action", { stage_id: stageId, action });
}
