import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
}

class NodeErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_error: unknown): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    // Error is contained within this boundary — no propagation upward.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="text-sm text-app-danger">
          Error al cargar componente
        </div>
      )
    }
    return this.props.children
  }
}

export function LazyNode({ children }: { children: ReactNode }) {
  return (
    <NodeErrorBoundary>
      <Suspense fallback={null}>{children}</Suspense>
    </NodeErrorBoundary>
  )
}
