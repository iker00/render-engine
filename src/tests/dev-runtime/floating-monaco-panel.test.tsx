import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock @monaco-editor/react so DevRuntimeMonacoEditor renders a controllable textarea
vi.mock('@monaco-editor/react', () => {
  return {
    default: vi.fn(({ value, onChange, onMount }) => {
      const fakeEditor = { getValue: () => value }
      if (onMount) {
        onMount(fakeEditor, {
          languages: { json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } } },
        })
      }
      return (
        <textarea
          data-testid="monaco-editor-mock"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )
    }),
  }
})

import { FloatingMonacoPanel } from '../../dev-runtime/floating-toolbar/floating-monaco-panel'

function defaultProps(overrides: Partial<React.ComponentProps<typeof FloatingMonacoPanel>> = {}) {
  return {
    open: true,
    onClose: () => {},
    editorBuffer: '{}',
    onEditorChange: () => {},
    onApply: () => {},
    onCopy: () => {},
    pendingChanges: false,
    errors: null,
    ...overrides,
  } satisfies React.ComponentProps<typeof FloatingMonacoPanel>
}

describe('FloatingMonacoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when open is false', () => {
    render(<FloatingMonacoPanel {...defaultProps({ open: false })} />)
    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()
  })

  it('renders the fixed inset-y-0 right-0 panel when open is true', () => {
    render(<FloatingMonacoPanel {...defaultProps({ open: true })} />)
    const panel = screen.getByTestId('dev-editor-floating-monaco')
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveClass('fixed')
    expect(panel).toHaveClass('inset-y-0')
    expect(panel).toHaveClass('right-0')
  })

  it('mounts DevRuntimeMonacoEditor with editorBuffer as value', () => {
    render(<FloatingMonacoPanel {...defaultProps({ editorBuffer: 'texto' })} />)
    const textarea = screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement
    expect(textarea.value).toBe('texto')
  })

  it('passes an empty string to the editor when editorBuffer is null', () => {
    render(<FloatingMonacoPanel {...defaultProps({ editorBuffer: null })} />)
    const textarea = screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('invokes onEditorChange with the new value when the editor content changes', () => {
    const onEditorChange = vi.fn()
    render(<FloatingMonacoPanel {...defaultProps({ onEditorChange })} />)
    const textarea = screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{"a": 1}' } })
    expect(onEditorChange).toHaveBeenCalledWith('{"a": 1}')
  })

  it('invokes onApply when the Apply button is clicked', () => {
    const onApply = vi.fn()
    render(<FloatingMonacoPanel {...defaultProps({ onApply })} />)
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('invokes onCopy when the Copy button is clicked', () => {
    const onCopy = vi.fn()
    render(<FloatingMonacoPanel {...defaultProps({ onCopy })} />)
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-copy'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('shows the pending changes indicator when pendingChanges is true', () => {
    render(<FloatingMonacoPanel {...defaultProps({ pendingChanges: true })} />)
    expect(screen.getByTestId('dev-editor-floating-monaco-pending-indicator')).toBeInTheDocument()
  })

  it('does not show the pending changes indicator when pendingChanges is false', () => {
    render(<FloatingMonacoPanel {...defaultProps({ pendingChanges: false })} />)
    expect(
      screen.queryByTestId('dev-editor-floating-monaco-pending-indicator'),
    ).not.toBeInTheDocument()
  })

  it('renders the error panel with code and message when errors are present', () => {
    render(
      <FloatingMonacoPanel
        {...defaultProps({ errors: { code: 'invalid-layout', message: 'Bad layout at index 0' } })}
      />,
    )
    const errorPanel = screen.getByTestId('dev-editor-floating-monaco-error-panel')
    expect(errorPanel).toBeInTheDocument()
    expect(errorPanel).toHaveTextContent('invalid-layout')
    expect(errorPanel).toHaveTextContent('Bad layout at index 0')
  })

  it('does not render the error panel when errors is null', () => {
    render(<FloatingMonacoPanel {...defaultProps({ errors: null })} />)
    expect(
      screen.queryByTestId('dev-editor-floating-monaco-error-panel'),
    ).not.toBeInTheDocument()
  })

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<FloatingMonacoPanel {...defaultProps({ onClose })} />)
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
