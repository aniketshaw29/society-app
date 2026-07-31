import React, {
  Component,
  ComponentType,
  ReactNode,
  ErrorInfo,
} from 'react';
import { ErrorFallback } from './ErrorFallback';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If omitted, the default ErrorFallback screen is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ── ErrorBoundary class component ─────────────────────────────────────────────

/**
 * React error boundary that catches unhandled render-time errors and shows a
 * friendly fallback UI instead of a blank/crashed screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console (swap for Sentry.captureException in production)
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Allow caller to supply their own fallback UI
    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <ErrorFallback
        error={this.state.error}
        onReset={this.handleReset}
      />
    );
  }
}

// ── withErrorBoundary HOC ─────────────────────────────────────────────────────

/**
 * Higher-order component that wraps a component with an ErrorBoundary.
 *
 * @param WrappedComponent - Component to protect
 * @param fallback         - Optional custom fallback UI
 */
export function withErrorBoundary<T extends object>(
  WrappedComponent: ComponentType<T>,
  fallback?: ReactNode
): ComponentType<T> {
  const displayName =
    WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component';

  function WithErrorBoundaryWrapper(props: T): ReactNode {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundaryWrapper.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundaryWrapper;
}
