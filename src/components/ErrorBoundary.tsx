import { Component, type ReactNode } from "react";

type Props = { area: string; children: ReactNode };
type State = { error: Error | null };

/**
 * WebGL can be unavailable (old GPU, disabled in the browser). The report and
 * model tree still work without the 3D view, so only the viewer falls back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fallback" role="alert">
        <p>
          The {this.props.area} couldn't start: {this.state.error.message}. The clash report still works; enable
          hardware acceleration or try another browser for the 3D view.
        </p>
        <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
          Retry
        </button>
      </div>
    );
  }
}
