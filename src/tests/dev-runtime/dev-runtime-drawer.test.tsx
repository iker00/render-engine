import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevRuntimeToggleButton } from '../../dev-runtime/dev-runtime-toggle-button'
import { DevRuntimeDrawer } from '../../dev-runtime/dev-runtime-drawer'

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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
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
        activeTab="json"
        onTabChange={() => {}}
        visualContent={<div>visual content</div>}
      >
        <div>editor</div>
      </DevRuntimeDrawer>,
    )
    fireEvent.click(screen.getByTestId('dev-runtime-copy'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })
})

describe('DevRuntimeDrawer Visual/JSON tabs', () => {
  function renderDrawer(overrides?: {
    activeTab?: 'visual' | 'json'
    onTabChange?: (tab: 'visual' | 'json') => void
    errors?: { code: string; message: string } | null
  }) {
    const onTabChange = overrides?.onTabChange ?? vi.fn()
    const utils = render(
      <DevRuntimeDrawer
        open={true}
        onClose={() => {}}
        onApply={() => {}}
        onCopy={() => {}}
        pendingChanges={false}
        errors={overrides?.errors ?? null}
        activeTab={overrides?.activeTab ?? 'json'}
        onTabChange={onTabChange}
        visualContent={<div data-testid="visual-slot-content">canvas content</div>}
      >
        <div data-testid="json-slot-content">editor content</div>
      </DevRuntimeDrawer>,
    )
    return { ...utils, onTabChange }
  }

  it('shows both the Visual and JSON tab controls', () => {
    renderDrawer()
    expect(screen.getByTestId('dev-runtime-tab-visual')).toBeInTheDocument()
    expect(screen.getByTestId('dev-runtime-tab-json')).toBeInTheDocument()
  })

  it('renders only the JSON slot when activeTab is "json"', () => {
    renderDrawer({ activeTab: 'json' })
    expect(screen.getByTestId('json-slot-content')).toBeInTheDocument()
    expect(screen.queryByTestId('visual-slot-content')).not.toBeInTheDocument()
  })

  it('renders only the visualContent slot when activeTab is "visual"', () => {
    renderDrawer({ activeTab: 'visual' })
    expect(screen.getByTestId('visual-slot-content')).toBeInTheDocument()
    expect(screen.queryByTestId('json-slot-content')).not.toBeInTheDocument()
  })

  it('calls onTabChange with "visual" when the Visual tab is clicked', () => {
    const { onTabChange } = renderDrawer({ activeTab: 'json' })
    fireEvent.click(screen.getByTestId('dev-runtime-tab-visual'))
    expect(onTabChange).toHaveBeenCalledWith('visual')
  })

  it('calls onTabChange with "json" when the JSON tab is clicked', () => {
    const { onTabChange } = renderDrawer({ activeTab: 'visual' })
    fireEvent.click(screen.getByTestId('dev-runtime-tab-json'))
    expect(onTabChange).toHaveBeenCalledWith('json')
  })

  it('keeps the error panel visible regardless of the active tab', () => {
    const errors = { code: 'invalid-layout', message: 'Bad layout at index 0' }
    renderDrawer({ activeTab: 'visual', errors })
    expect(screen.getByTestId('dev-runtime-error-panel')).toBeInTheDocument()
  })

  it('keeps the Copy/Apply action bar visible regardless of the active tab', () => {
    renderDrawer({ activeTab: 'visual' })
    expect(screen.getByTestId('dev-runtime-copy')).toBeInTheDocument()
    expect(screen.getByTestId('dev-runtime-apply')).toBeInTheDocument()
  })
})
