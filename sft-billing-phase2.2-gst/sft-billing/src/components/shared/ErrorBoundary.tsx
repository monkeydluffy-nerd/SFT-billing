import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-[300px] items-center justify-center px-4">
          <div className="text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-caution" aria-hidden="true" />
            <div>
              <h3 className="font-display text-xl text-ink">Something went wrong</h3>
              <p className="mt-2 text-sm text-ink-muted">
                We couldn't load the overview. Please try reloading the page.
              </p>
              {this.state.error && (
                <details className="mt-4 text-left text-xs text-ink-muted">
                  <summary className="cursor-pointer select-none">Error details</summary>
                  <pre className="mt-2 p-3 overflow-auto rounded bg-canvas border border-border">
                    {this.state.error.message}
                    {this.state.error.stack && `\n\n${this.state.error.stack}`}
                  </pre>
                </details>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-micro hover:bg-accent/90"
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}