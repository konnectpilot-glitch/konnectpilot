import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Top-level error boundary. Catches React render errors before they paint a
 * blank white screen, shows a friendly retry UI, and logs the underlying
 * error to the console for diagnostics.
 *
 * Wraps the entire authenticated app in App.tsx so any uncaught render error
 * degrades gracefully instead of taking the whole tab down.
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // We don't have a remote logger yet, but at least surface it locally so
    // the user can copy-paste it into support. Once we add Sentry, this is
    // the single place to wire it.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-1">Something broke on our end</h1>
          <p className="text-sm text-muted-foreground mb-5">
            The page hit an unexpected error. Reloading usually fixes it — if it keeps happening, drop us a note at support@konnectpilot.com.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload page
            </button>
            <button
              onClick={this.reset}
              className="border border-border text-foreground font-medium px-4 py-2 rounded-lg text-sm hover:bg-secondary"
            >
              Try again
            </button>
          </div>
          {import.meta.env.DEV && (
            <details className="mt-4 text-left text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Dev: error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words bg-secondary/50 p-2 rounded text-[10px]">
                {String(this.state.error?.stack ?? this.state.error?.message)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
