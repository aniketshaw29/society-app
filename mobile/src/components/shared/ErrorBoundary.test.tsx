/**
 * Tests for ErrorBoundary component.
 *
 * Run with: npx jest ErrorBoundary.test.tsx
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A component that throws synchronously during render. */
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <Text testID="child">Child rendered successfully</Text>;
}

/** Silence console.error for expected error output in tests. */
let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  it('renders children normally when no error is thrown', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(getByTestId('child')).toBeTruthy();
  });

  it('renders the default ErrorFallback when a child throws', () => {
    const { getByText, queryByTestId } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Child should not be rendered
    expect(queryByTestId('child')).toBeNull();
    // Default fallback headline should appear
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(
      getByText("We hit an unexpected error. Don't worry — your data is safe.")
    ).toBeTruthy();
  });

  it('renders a custom fallback when provided and a child throws', () => {
    const { getByText, queryByTestId } = render(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(queryByTestId('child')).toBeNull();
    expect(getByText('Custom fallback')).toBeTruthy();
  });

  it('resets error state and re-renders children when onReset is called', () => {
    const { getByText, queryByTestId, getByTestId, rerender } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Boundary has caught the error
    expect(getByText('Something went wrong')).toBeTruthy();

    // Tap "Try Again"
    const tryAgainButton = getByText('Try Again');
    fireEvent.press(tryAgainButton);

    // After reset we need a non-throwing child — re-render with fixed child
    rerender(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(getByTestId('child')).toBeTruthy();
    expect(queryByTestId('error-fallback')).toBeNull();
  });

  it('calls componentDidCatch and logs the error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorBoundary] Uncaught error:',
      expect.any(Error),
      expect.any(String)
    );
  });
});

// ── ErrorFallback standalone tests ───────────────────────────────────────────

describe('ErrorFallback', () => {
  it('renders correctly without props', () => {
    const { getByText } = render(<ErrorFallback />);
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Contact Support')).toBeTruthy();
  });

  it('renders the Try Again button when onReset is provided', () => {
    const onReset = jest.fn();
    const { getByText } = render(<ErrorFallback onReset={onReset} />);
    const button = getByText('Try Again');
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not render Try Again when onReset is not provided', () => {
    const { queryByText } = render(<ErrorFallback />);
    expect(queryByText('Try Again')).toBeNull();
  });
});
