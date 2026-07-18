import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// React Query catches errors from its own queries/mutations, but a render-time throw (a bad
// prop shape reaching a component, a bug in a formatter) escapes that and would otherwise
// blank the whole app. This is the last-resort net for exactly that case.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado en la UI:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="alerta-error">
          Ocurrió un error inesperado en la interfaz. Recargá la página e intentá de nuevo.
        </div>
      );
    }
    return this.props.children;
  }
}
