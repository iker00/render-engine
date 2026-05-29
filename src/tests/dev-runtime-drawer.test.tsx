import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevRuntimeToggleButton } from '../dev-runtime/dev-runtime-toggle-button'
import { DevRuntimeDrawer } from '../dev-runtime/dev-runtime-drawer'

describe('DevRuntimeToggleButton', () => {
  it('renders with data-testid="dev-runtime-toggle"', () => {
    render(<DevRuntimeToggleButton onToggle={() => {}} />)
    expect(screen.getByTestId('dev-runtime-toggle')).toBeInTheDocument()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<DevRuntimeToggleButton onToggle={onToggle} />)
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('DevRuntimeDrawer', () => {
  it('is hidden by default when open is false', () => {
    const { container } = render(
      <DevRuntimeDrawer
        open={false}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={null}
      >
        <div>editor content</div>
      </DevRuntimeDrawer>,
    )
    // The drawer panel should not be visible (e.g. translated off-screen)
    const panel = container.querySelector('[data-testid="dev-runtime-drawer"]')
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveClass('translate-x-full')
  })

  it('is visible when open is true', () => {
    const { container } = render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={null}
      >
        <div>editor content</div>
      </DevRuntimeDrawer>,
    )
    const panel = container.querySelector('[data-testid="dev-runtime-drawer"]')
    expect(panel).not.toHaveClass('translate-x-full')
  })

  it('renders children inside the drawer', () => {
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={null}
      >
        <div data-testid="slot-content">My editor</div>
      </DevRuntimeDrawer>,
    )
    expect(screen.getByTestId('slot-content')).toBeInTheDocument()
  })

  it('shows pending changes indicator when pendingChanges is true', () => {
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={true}
        errors={null}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    expect(screen.getByTestId('dev-runtime-pending-indicator')).toBeInTheDocument()
  })

  it('does not show pending changes indicator when pendingChanges is false', () => {
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={null}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    expect(screen.queryByTestId('dev-runtime-pending-indicator')).not.toBeInTheDocument()
  })

  it('renders error panel when errors are present', () => {
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={{ code: 'invalid-layout', message: 'Bad layout at index 0', displayMode: 'development-only' }}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    expect(screen.getByTestId('dev-runtime-error-panel')).toBeInTheDocument()
    expect(screen.getByText(/Bad layout at index 0/)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={onClose}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={null}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    fireEvent.click(screen.getByTestId('dev-runtime-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onApply when apply button is clicked', () => {
    const onApply = vi.fn()
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={onApply}
        onCopy={() => {}}
        pendingChanges={false}
        errors={null}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    fireEvent.click(screen.getByTestId('dev-runtime-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('calls onCopy when copy button is clicked', () => {
    const onCopy = vi.fn()
    render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={onCopy}
        pendingChanges={false}
        errors={null}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    fireEvent.click(screen.getByTestId('dev-runtime-copy'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })
})
