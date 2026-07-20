import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FloatingNodePalette } from '../../dev-runtime/floating-toolbar/floating-node-palette'
import { getSupportedNodeTypesCatalog } from '../../dev-runtime/layout-canvas/layout-canvas-node-schema'

// FloatingNodePalette re-exposes the existing LayoutCanvasNodePalette (0102) inside a fixed
// side panel driven by the T4 toolbar (FR4 de 0103). The tests here cover the show/hide
// contract and the smoke-check that the reused palette is really mounted; drag insertion
// itself remains covered by layout-canvas-palette-insert.test.tsx.

describe('FloatingNodePalette (T6, FR4)', () => {
  it('no renderiza el panel cuando open=false', () => {
    render(<FloatingNodePalette open={false} onClose={() => {}} />)

    expect(screen.queryByTestId('dev-editor-floating-palette')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-canvas-node-palette')).not.toBeInTheDocument()
  })

  it('renderiza el panel con position fixed cuando open=true', () => {
    render(<FloatingNodePalette open={true} onClose={() => {}} />)

    const panel = screen.getByTestId('dev-editor-floating-palette')
    // La spec exige position:fixed para no alterar el ancho del contenido real.
    // Tailwind expone esa regla vía la clase utilitaria `fixed`.
    expect(panel.className.split(/\s+/)).toContain('fixed')
  })

  it('monta LayoutCanvasNodePalette con una entrada por cada tipo del catálogo', () => {
    render(<FloatingNodePalette open={true} onClose={() => {}} />)

    expect(screen.getByTestId('layout-canvas-node-palette')).toBeInTheDocument()
    for (const type of getSupportedNodeTypesCatalog()) {
      expect(screen.getByTestId(`layout-canvas-palette-item-${type}`)).toBeInTheDocument()
    }
  })

  it('el botón "Cerrar" invoca onClose', () => {
    const onClose = vi.fn()
    render(<FloatingNodePalette open={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('dev-editor-floating-palette-close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cambiar open de true a false desmonta el panel', () => {
    const { rerender } = render(<FloatingNodePalette open={true} onClose={() => {}} />)
    expect(screen.getByTestId('dev-editor-floating-palette')).toBeInTheDocument()

    rerender(<FloatingNodePalette open={false} onClose={() => {}} />)

    expect(screen.queryByTestId('dev-editor-floating-palette')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-canvas-node-palette')).not.toBeInTheDocument()
  })
})
