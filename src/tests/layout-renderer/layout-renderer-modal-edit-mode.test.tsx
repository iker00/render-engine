import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

function renderNodes(nodes: LayoutNode[], options?: { editMode?: { active?: boolean } }) {
  const onSelectNode = vi.fn()
  const onHoverNode = vi.fn()

  const editModeValue: LayoutEditModeContextValue | null = options?.editMode
    ? options.editMode.active === false
      ? { active: false }
      : { active: true, selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }
    : null

  const content = editModeValue ? (
    <LayoutEditModeProvider value={editModeValue}>
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

// design.md feature 0103 Decisión 9: with a mounted-but-inert provider ({ active: false },
// Visual mode inside DevRuntime), the modal must behave exactly like production — only open
// when the real modal state says so, never forced open.
describe('ModalNode with LayoutEditModeProvider ({ active: false }, Visual mode)', () => {
  it('does not render children for a closed modal, same as production', () => {
    const { container } = renderNodes(buildModalTree(), { editMode: { active: false } })

    expect(screen.queryByText('Modal body content')).not.toBeInTheDocument()
    expect(container.querySelector('[data-testid="modal-overlay"]')).toBeNull()
  })
})
