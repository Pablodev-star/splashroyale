import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level safety net. Without this, an uncaught render error anywhere in the
 * tree unmounts the whole app and leaves `#root` empty — a blank page with no
 * indication anything went wrong. This catches that and offers a reload
 * instead of silent failure.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Splash Royale crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-abyss flex h-full w-full items-center justify-center p-4">
          <PixelPanel title="Something broke" variant="danger" className="w-full max-w-sm">
            <p className="text-[11px] leading-snug">
              Splash Royale hit an unexpected error and had to stop. Reloading usually clears it.
            </p>
            <p className="text-mist/50 mt-2 text-[9px] leading-snug break-words">
              {this.state.error.message}
            </p>
            <PixelButton
              className="mt-3"
              variant="primary"
              size="md"
              fullWidth
              onClick={() => window.location.reload()}
            >
              Reload
            </PixelButton>
          </PixelPanel>
        </div>
      );
    }

    return this.props.children;
  }
}
