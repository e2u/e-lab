import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { initFirebase } from "./firebase";
import { initAnalyticsTracking } from "./analytics";
import { initErrorLogging } from "./errorLogger";
import "./styles.css";

// Initialize Firebase, Telemetry and Global Error / Bug Logging
void initFirebase().then(() => {
  initAnalyticsTracking();
  initErrorLogging();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
