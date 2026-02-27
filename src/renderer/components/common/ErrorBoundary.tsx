import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props): void {
    // Reset error state when resetKeys change
    if (this.props.resetKeys) {
      const hasResetKeysChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeysChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 bg-odin-bg-primary">
          <div className="max-w-lg w-full">
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4 font-mono">
                Something went wrong
              </h2>
              <p className="text-odin-text-secondary text-sm mb-4 font-mono">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              {this.state.errorInfo && (
                <details className="mb-4">
                  <summary className="text-odin-text-tertiary text-xs cursor-pointer font-mono hover:text-odin-text-secondary">
                    Error Details
                  </summary>
                  <pre className="mt-2 p-3 bg-odin-bg-tertiary rounded text-xs text-odin-text-tertiary font-mono overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3">
                <button
                  onClick={this.reset}
                  className="px-4 py-2 bg-odin-cyan text-odin-bg-primary font-mono text-sm font-medium rounded hover:bg-odin-cyan/80 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-odin-bg-tertiary text-odin-text-primary font-mono text-sm rounded border border-odin-border hover:bg-odin-border transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for programmatic error handling
export function useErrorHandler() {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}
