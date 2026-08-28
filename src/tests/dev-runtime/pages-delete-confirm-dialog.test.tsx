import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PagesDeleteConfirmDialog } from '../../dev-runtime/pages-config-panel/pages-delete-confirm-dialog'
import type { OrphanNavigateToReferenceScan } from '../../dev-runtime/pages-config-panel/scan-orphan-navigate-to-references'

function emptyScan(): OrphanNavigateToReferenceScan {
  return { totalCount: 0, sources: [] }
}

function scanWithSources(): OrphanNavigateToReferenceScan {
  return {
    totalCount: 3,
    sources: [
      { label: 'en la página «home»', count: 2 },
      { label: 'en el sidebar', count: 1 },
    ],
  }
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof PagesDeleteConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const props = {
    pageId: 'checkout',
    orphanScan: emptyScan(),
    onConfirm,
    onCancel,
    ...overrides,
  } satisfies React.ComponentProps<typeof PagesDeleteConfirmDialog>
  const utils = render(<PagesDeleteConfirmDialog {...props} />)
  return { ...utils, onConfirm, onCancel }
}

describe('PagesDeleteConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with role alertdialog and no orphan warning when totalCount is 0', () => {
    renderDialog({ orphanScan: emptyScan() })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByTestId('pages-delete-confirm-orphan-warning')).not.toBeInTheDocument()
  })

  it('includes the pageId in the accessible name of the dialog', () => {
    renderDialog({ pageId: 'checkout' })
    expect(screen.getByRole('alertdialog', { name: /checkout/ })).toBeInTheDocument()
  })

  it('shows the orphan warning block with each source label/count and the total when totalCount > 0', () => {
    renderDialog({ orphanScan: scanWithSources() })
    const warning = screen.getByTestId('pages-delete-confirm-orphan-warning')
    expect(warning).toHaveTextContent('3')
    expect(warning).toHaveTextContent('en la página «home»')
    expect(warning).toHaveTextContent('2')
    expect(warning).toHaveTextContent('en el sidebar')
    expect(warning).toHaveTextContent('1')
  })

  it('invokes onCancel when Escape is pressed', () => {
    const { onCancel } = renderDialog()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('invokes onCancel when clicking the overlay outside the dialog box', () => {
    const { onCancel } = renderDialog()
    fireEvent.click(screen.getByTestId('pages-delete-confirm-overlay'))
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
    trigger.textContent = 'Borrar página'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = renderDialog()
    expect(document.activeElement).not.toBe(trigger)

    unmount()
    expect(document.activeElement).toBe(trigger)

    document.body.removeChild(trigger)
  })
})
