import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Route-level error boundary so malformed API data cannot blank the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("UI error boundary caught", error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-lg font-semibold">
          {this.props.fallbackTitle ?? "This view hit an unexpected error"}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.state.message ?? "Try reloading this page. Your library data on the local daemon is unchanged."}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={this.handleReset}>
            Try again
          </Button>
          <Button type="button" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
