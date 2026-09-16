import { Component } from "react";
import { createCrashSnapshot, getLastCrashSnapshot } from "../lib/diagnostics";
import CrashDiagnosticModal from "./CrashDiagnosticModal";

/**
 * Error Boundary Global de El Callejón POS.
 * Atrapa cualquier fallo en el ciclo de vida de React, genera un snapshot
 * y despliega la pantalla de diagnóstico asistido para que nada falle en silencio.
 */
export default class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      snapshot: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const snapshot = createCrashSnapshot(
      error,
      errorInfo?.componentStack || "",
      { boundary: this.props.name || "GlobalErrorBoundary" }
    );
    this.setState({ snapshot });
    console.error("[GlobalErrorBoundary] Crash capturado:", snapshot);
  }

  handleRetry = () => {
    this.setState({ hasError: false, snapshot: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const snap = this.state.snapshot || getLastCrashSnapshot();
      return (
        <CrashDiagnosticModal
          snapshot={snap}
          onRetry={this.handleRetry}
          isFatal={this.props.isFatal || false}
        />
      );
    }

    return this.props.children;
  }
}
