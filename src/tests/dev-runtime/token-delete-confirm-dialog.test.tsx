import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TokenDeleteConfirmDialog } from '../../dev-runtime/tokens-config-panel/token-delete-confirm-dialog'
import type { TokenHeaderReferenceScan } from '../../dev-runtime/tokens-config-panel/scan-orphan-token-header-references'

function emptyScan(): TokenHeaderReferenceScan {
  return { totalCount: 0, sources: [] }
}

function scanWithSources(): TokenHeaderReferenceScan {
  return {
    totalCount: 3,
    sources: [
      { label: 'en la operación «fetchUser»', count: 2 },
      { label: 'en la página «home»', count: 1 },
    ],
  }
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof TokenDeleteConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const props = {
    tokenId: 'apiKey',
    scan: emptyScan(),
    onConfirm,
    onCancel,
    ...overrides,
  } satisfies React.ComponentProps<typeof TokenDeleteConfirmDialog>
  const utils = render(<TokenDeleteConfirmDialog {...props} />)
  return { ...utils, onConfirm, onCancel }
}

describe('TokenDeleteConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with role alertdialog and no warning block when totalCount is 0', () => {
    renderDialog({ scan: emptyScan() })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByTestId('token-delete-confirm-orphan-warning')).not.toBeInTheDocument()
  })

  it('includes the tokenId in the accessible name of the dialog', () => {
    renderDialog({ tokenId: 'apiKey' })
    expect(screen.getByRole('alertdialog', { name: /apiKey/ })).toBeInTheDocument()
  })

  it('shows the warning block with each source label/count and the total when totalCount > 0', () => {
    renderDialog({ scan: scanWithSources() })
    const warning = screen.getByTestId('token-delete-confirm-orphan-warning')
    expect(warning).toHaveTextContent('3')
    expect(warning).toHaveTextContent('en la operación «fetchUser»')
    expect(warning).toHaveTextContent('2')
    expect(warning).toHaveTextContent('en la página «home»')
    expect(warning).toHaveTextContent('1')
  })

  it('invokes onCancel when Escape is pressed', () => {
    const { onCancel } = renderDialog()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('invokes onCancel when clicking the overlay outside the dialog box', () => {
    const { onCancel } = renderDialog()
    fireEvent.click(screen.getByTestId('token-delete-confirm-overlay'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onCancel when clicking inside the dialog box', () => {
    const { onCancel } = renderDialog()
    fireEvent.click(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('invokes onConfirm when clicking Eliminar and onCancel when clicking Cancelar', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('moves focus inside the dialog on mount', () => {
    renderDialog()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('returns focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Borrar token'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = renderDialog()
    expect(document.activeElement).not.toBe(trigger)

    unmount()
    expect(document.activeElement).toBe(trigger)

    document.body.removeChild(trigger)
  })

  it('traps focus: Tab from the last focusable element wraps to the first', () => {
    renderDialog()
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    last.focus()
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('traps focus: Shift+Tab from the first focusable element wraps to the last', () => {
    renderDialog()
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    first.focus()
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
