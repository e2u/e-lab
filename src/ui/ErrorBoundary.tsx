import React, { Component, type ReactNode } from "react";
import { t } from "../i18n";
import { reportError } from "../errorLogger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    reportError("react_boundary", error.message, {
      stack: `${error.stack || ""}\nComponent Stack: ${errorInfo.componentStack || ""}`,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetState = () => {
    try {
      localStorage.removeItem("elab.draft");
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          padding: "2rem",
          background: "var(--bg-panel, #1e293b)",
          color: "var(--text-main, #f8fafc)",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}>
          <h2 style={{ marginBottom: "1rem", color: "#ef4444" }}>
            系統發生非預期錯誤 / An unexpected error occurred
          </h2>
          <p style={{ maxWidth: 600, marginBottom: "1.5rem", color: "#94a3b8", fontSize: "0.95rem" }}>
            {t("error.canvasFallback")}
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "6px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              重新整理 / Reload
            </button>
            <button
              onClick={this.handleResetState}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "6px",
                border: "1px solid #64748b",
                background: "transparent",
                color: "#cbd5e1",
                cursor: "pointer",
              }}
            >
              重置暫存 / Reset Draft
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
