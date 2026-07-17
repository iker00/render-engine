import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import {
  LayoutEditModeProvider,
  type LayoutEditModeContextValue,
} from '../../runtime/layout-edit-mode-context'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

function renderNodes(nodes: LayoutNode[], options?: { editMode?: Partial<LayoutEditModeContextValue> }) {
  const onSelectNode = vi.fn()
  const onHoverNode = vi.fn()

  const content = options?.editMode ? (
    <LayoutEditModeProvider
      value={{
        selectedPath: null,
        hoveredPath: null,
        onSelectNode,
        onHoverNode,
        ...options.editMode,
      }}
    >
      <LayoutRenderer nodes={nodes} />
    </LayoutEditModeProvider>
  ) : (
    <LayoutRenderer nodes={nodes} />
  )

  const result = render(
    <RuntimeStateProvider config={buildConfig()}>{content}</RuntimeStateProvider>,
  )

  return { ...result, onSelectNode, onHoverNode }
}

function buildModalTree(): LayoutNode[] {
  return [
    {
      type: 'modal',
      id: 'modal-1',
      props: {},
      children: [{ type: 'paragraph', props: { text: 'Modal body content' } }],
    } as LayoutNode,
  ]
}

describe('ModalNode without LayoutEditModeProvider (production regression)', () => {
  it('does not render children for a closed modal (defaultOpen: false, never opened)', () => {
    const { container } = renderNodes(buildModalTree())

    expect(screen.queryByText('Modal body content')).not.toBeInTheDocument()
    expect(container.querySelector('[data-testid="modal-overlay"]')).toBeNull()
  })
})

describe('ModalNode with LayoutEditModeProvider', () => {
  it('renders children from the first render, without having opened the modal', () => {
    renderNodes(buildModalTree(), { editMode: {} })

    expect(screen.getByText('Modal body content')).toBeInTheDocument()
  })

  it('exposes a selectable node inside the modal with its correct data-node-path', () => {
    const { onSelectNode } = renderNodes(buildModalTree(), { editMode: {} })

    const paragraph = screen.getByText('Modal body content')
    const wrapper = paragraph.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.children.0')

    fireEvent.click(paragraph)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })
})
