/**
 * ExoPlayerBoundary — ErrorBoundary wrapper for <ExoPlayerView>.
 *
 * WHY THIS EXISTS:
 * In Fabric (React Native new architecture), a Paper view manager that is
 * absent or missing a Codegen spec throws "View config not found for component
 * ExoPlayerView" during the React reconciler's completeWork phase. That error
 * originates inside the render cycle, so it IS catchable by a class-component
 * ErrorBoundary via getDerivedStateFromError / componentDidCatch.
 *
 * Without this boundary, the crash propagates up and unmounts the entire
 * viewer screen. With it, we catch the throw and route it to onError, which
 * shows the normal retry overlay in ViewerItem — the rest of the UI is
 * completely unaffected.
 *
 * Once a new EAS / local build with ExoPlayerPackage compiled and linked is
 * installed on the device, this boundary is a silent no-op.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Called once when the boundary catches a render error. */
  onError: (message: string) => void;
  /** Changing this key resets the boundary so the player can retry. */
  resetKey?: string;
}

interface State {
  caught: boolean;
}

export class ExoPlayerBoundary extends React.Component<Props, State> {
  state: State = { caught: false };

  static getDerivedStateFromError(): State {
    return { caught: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error?.message ?? 'ExoPlayer unavailable');
  }

  componentDidUpdate(prevProps: Props) {
    // Allow the boundary to reset when the parent supplies a new key,
    // e.g. after the user taps "retry" which generates a new displayUri.
    if (prevProps.resetKey !== this.props.resetKey && this.state.caught) {
      this.setState({ caught: false });
    }
  }

  render() {
    // Once caught, render nothing — the parent shows its own error overlay.
    if (this.state.caught) return null;
    return this.props.children;
  }
}
