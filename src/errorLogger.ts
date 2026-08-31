import { getFirebaseDb, collection, addDoc, serverTimestamp } from "./firebase";
import { getSessionId, getVisitorId, trackEvent } from "./analytics";
import { useLab } from "./store";

interface ErrorReport {
  message: string;
  stack?: string;
  type: "uncaught" | "unhandledrejection" | "console_error" | "react_boundary" | "sim_error";
  filename?: string;
  lineno?: number;
  colno?: number;
  url: string;
  userAgent: string;
  language: string;
  sessionId: string;
  visitorId: string;
  circuitSummary?: {
    symbolCount: number;
    wireCount: number;
    deviceCount: number;
    mode: string;
    layoutMode: string;
  };
}

const reportedErrors = new Set<string>();
const MAX_ERRORS_PER_SESSION = 15;
let sessionErrorCount = 0;
let isInitialized = false;

function getCircuitSummary() {
  try {
    const s = useLab.getState();
    return {
      symbolCount: s.circuit?.symbols?.length ?? 0,
      wireCount: s.circuit?.wires?.length ?? 0,
      deviceCount: s.circuit?.devices?.length ?? 0,
      mode: s.mode,
      layoutMode: s.layoutMode,
    };
  } catch {
    return undefined;
  }
}

export async function reportError(
  errorType: ErrorReport["type"],
  message: string,
  extra: {
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
  } = {},
): Promise<void> {
  try {
    // 1. Deduplicate by signature
    const signature = `${errorType}:${message}:${extra.filename || ""}:${extra.lineno || ""}`;
    if (reportedErrors.has(signature)) return;
    reportedErrors.add(signature);

    // 2. Track via Analytics
    trackEvent("app_bug_occurred", {
      error_type: errorType,
      error_msg: message.slice(0, 100),
      file: extra.filename || "unknown",
      line: extra.lineno || 0,
    });

    // 3. Rate limit Firestore writes to strictly preserve Spark free tier quota
    if (sessionErrorCount >= MAX_ERRORS_PER_SESSION) {
      return;
    }
    sessionErrorCount += 1;

    // 4. Save detailed record in Firestore
    const db = getFirebaseDb();
    if (!db) return;

    const report: ErrorReport = {
      message: message || "Unknown error",
      stack: extra.stack?.slice(0, 2000), // Protect payload size
      type: errorType,
      filename: extra.filename,
      lineno: extra.lineno,
      colno: extra.colno,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      language: typeof navigator !== "undefined" ? navigator.language : "",
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      circuitSummary: getCircuitSummary(),
    };

    await addDoc(collection(db, "errors"), {
      ...report,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Fail silently, error reporting must never crash app
  }
}

export function initErrorLogging(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // A. Catch Global Uncaught Exceptions
  window.addEventListener("error", (event: ErrorEvent) => {
    reportError("uncaught", event.message || "Unknown Window Error", {
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // B. Catch Unhandled Promise Rejections
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason instanceof Error
          ? reason.message
          : JSON.stringify(reason);

    reportError("unhandledrejection", message || "Unhandled Promise Rejection", {
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // C. Intercept console.error to catch runtime logged issues
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Call original console.error so developer tools display normally
    originalConsoleError.apply(console, args);

    try {
      const msg = args
        .map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack}` : typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" ");

      // Ignore intentional test warnings or benign messages if needed
      if (msg && !msg.includes("[Firebase]") && !msg.includes("[Analytics]")) {
        const firstError = args.find((a) => a instanceof Error) as Error | undefined;
        reportError("console_error", msg.slice(0, 500), {
          stack: firstError?.stack,
        });
      }
    } catch {
      // Ignore errors inside error hook
    }
  };
}
