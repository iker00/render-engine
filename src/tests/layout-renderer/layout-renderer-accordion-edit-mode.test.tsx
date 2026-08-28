import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { AccordionGroupProvider } from '../../runtime/runtime-accordion-group'

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
    <RuntimeStateProvider config={buildConfig()}>
      <AccordionGroupProvider>{content}</AccordionGroupProvider>
    </RuntimeStateProvider>,
  )

  return { ...result, onSelectNode, onHoverNode }
}

function buildAccordionTree(): LayoutNode[] {
  return [
    {
      type: 'accordion',
      id: 'acc-1',
      props: { label: 'Section one' },
      children: [{ type: 'paragraph', props: { text: 'Body content' } }],
    } as LayoutNode,
  ]
}

describe('AccordionNode without LayoutEditModeProvider (production regression)', () => {
  it('does not render children until the header is clicked, for defaultOpen: false (default)', () => {
    renderNodes(buildAccordionTree())

    expect(screen.queryByText('Body content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Section one' }))

    expect(screen.getByText('Body content')).toBeInTheDocument()
  })
})

describe('AccordionNode with LayoutEditModeProvider', () => {
  it('renders children from the first render, without clicking the header', () => {
    renderNodes(buildAccordionTree(), { editMode: {} })

    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('exposes a selectable node inside the body with a data-node-path relative to the accordion (children segment)', () => {
    const { onSelectNode } = renderNodes(buildAccordionTree(), { editMode: {} })

    const paragraph = screen.getByText('Body content')
    const wrapper = paragraph.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.children.0')

    fireEvent.click(paragraph)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('still toggles aria-expanded correctly on header click, without breaking the toggle', () => {
    renderNodes(buildAccordionTree(), { editMode: {} })

    const header = screen.getByRole('button', { name: 'Section one' })
    expect(header).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')

    // Content stays present in edit mode regardless of aria-expanded.
    expect(screen.getByText('Body content')).toBeInTheDocument()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })
})

// design.md feature 0103 Decisión 9: with a mounted-but-inert provider ({ active: false },
// Visual mode inside DevRuntime), the accordion must behave exactly like production — it must
// NOT force its content visible from the first render.
describe('AccordionNode with LayoutEditModeProvider ({ active: false }, Visual mode)', () => {
  it('does not render children until the header is clicked, same as production', () => {
    renderNodes(buildAccordionTree(), { editMode: { active: false } })

    expect(screen.queryByText('Body content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Section one' }))

    expect(screen.getByText('Body content')).toBeInTheDocument()
  })
})
