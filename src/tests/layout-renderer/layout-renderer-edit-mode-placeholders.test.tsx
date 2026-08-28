import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

interface RenderNodesEditModeOptions {
  active?: boolean
  selectedPath?: LayoutNodePath | null
  hoveredPath?: LayoutNodePath | null
}

function renderNodes(nodes: LayoutNode[], options?: { editMode?: RenderNodesEditModeOptions }) {
  const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
  const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()

  const editModeValue: LayoutEditModeContextValue | null = options?.editMode
    ? options.editMode.active === false
      ? { active: false }
      : {
          active: true,
          selectedPath: options.editMode.selectedPath ?? null,
          hoveredPath: options.editMode.hoveredPath ?? null,
          onSelectNode,
          onHoverNode,
        }
    : null

  const content = editModeValue ? (
    <LayoutEditModeProvider value={editModeValue}>
      <LayoutRenderer nodes={nodes} />
    </LayoutEditModeProvider>
  ) : (
    <LayoutRenderer nodes={nodes} />
  )

  const result = render(<RuntimeStateProvider config={buildConfig()}>{content}</RuntimeStateProvider>)

  return { ...result, onSelectNode, onHoverNode }
}

describe('LayoutRenderer empty container/form placeholders (edit mode)', () => {
  const emptyContainer: LayoutNode[] = [{ type: 'container', props: {}, children: [] }]
  const undefinedChildrenContainer: LayoutNode[] = [{ type: 'container', props: {} }]
  const emptyForm: LayoutNode[] = [{ type: 'form', id: 'form-1' }]
  const emptyLink: LayoutNode[] = [{ type: 'link', props: { href: '#' }, children: [] }]
  const textModeLink: LayoutNode[] = [{ type: 'link', props: { label: 'x' } }]
  const nonEmptyContainer: LayoutNode[] = [
    {
      type: 'container',
      props: {},
      children: [{ type: 'heading', props: { text: 'Title', level: 1 } }],
    },
  ]

  it('renders no placeholder trace for an empty container without a LayoutEditModeProvider (production behavior)', () => {
    const { container } = renderNodes(emptyContainer)

    expect(container.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(container.querySelector('[data-layout-node="container"]')?.textContent).toBe('')
  })

  it('renders a visible, labeled placeholder for the same empty container inside a LayoutEditModeProvider', () => {
    renderNodes(emptyContainer, { editMode: {} })

    const placeholder = screen.getByText('Contenedor vacío')
    expect(placeholder).toHaveAttribute('data-empty-placeholder', 'true')
  })

  it('treats a container with undefined children the same as an empty array in edit mode', () => {
    renderNodes(undefinedChildrenContainer, { editMode: {} })

    expect(screen.getByText('Contenedor vacío')).toBeInTheDocument()
  })

  it('renders a distinct placeholder label for an empty form, and does not mix it up with the container label', () => {
    renderNodes(emptyForm, { editMode: {} })

    expect(screen.getByText('Formulario vacío')).toBeInTheDocument()
    expect(screen.queryByText('Contenedor vacío')).not.toBeInTheDocument()
  })

  it('never shows the placeholder for a container with non-empty children, with or without a provider', () => {
    const { container: withoutProvider } = renderNodes(nonEmptyContainer)
    expect(withoutProvider.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)

    const { container: withProvider } = renderNodes(nonEmptyContainer, { editMode: {} })
    expect(withProvider.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(within(withProvider).getByText('Title')).toBeInTheDocument()
  })

  it('gives the placeholder its own data-node-path, distinct from the container it lives in, and selects itself (not the container) on click', () => {
    const { container, onSelectNode } = renderNodes(emptyContainer, { editMode: {} })

    const containerWrapper = container.querySelector('[data-node-path="children.0"]')
    const placeholder = screen.getByText('Contenedor vacío')

    expect(containerWrapper).not.toBeNull()
    expect(placeholder).toHaveAttribute('data-node-path', 'children.0.children.0')
    expect(placeholder.getAttribute('data-node-path')).not.toBe(containerWrapper?.getAttribute('data-node-path'))

    fireEvent.click(placeholder)

    // Same "first handler wins" marking mechanism as T2: the placeholder is the innermost
    // wrapper under the pointer, so it claims the click and the click keeps bubbling
    // (no stopPropagation) through the container's own wrapper as a no-op.
    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('applies the selected outline to the placeholder itself when its own path is selected, not to the container', () => {
    const placeholderPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    const { container } = renderNodes(emptyContainer, { editMode: { selectedPath: placeholderPath } })

    const placeholder = screen.getByText('Contenedor vacío')
    const containerWrapper = container.querySelector('[data-node-path="children.0"]') as HTMLElement

    expect(placeholder.className).toContain('outline-blue-500')
    expect(containerWrapper.className ?? '').not.toContain('outline-blue-500')
  })

  // design.md feature 0103 Decisión 9: with a mounted-but-inert provider ({ active: false },
  // Visual mode inside DevRuntime), the empty-container placeholder must not appear — only
  // `{ active: true }` (Editor) renders it, same requirement as drop zones in general.
  it('renders no placeholder for the same empty container when the provider is present but { active: false }', () => {
    const { container } = renderNodes(emptyContainer, { editMode: { active: false } })

    expect(container.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(screen.queryByText('Contenedor vacío')).not.toBeInTheDocument()
    expect(container.querySelector('[data-layout-node="container"]')?.textContent).toBe('')
  })

  it('replicates the production acceptance criteria: an empty container inserted into a layout shows no visual trace when rendered as the production preview (no provider)', () => {
    const layoutWithInsertedEmptyContainer: LayoutNode[] = [
      { type: 'heading', props: { text: 'Page title', level: 1 } },
      { type: 'container', props: {}, children: [] },
    ]

    const { container } = renderNodes(layoutWithInsertedEmptyContainer)

    expect(screen.getByText('Page title')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(container.querySelector('[data-layout-node="container"]')?.textContent).toBe('')
  })

  it('renders a visible, labeled placeholder for an empty link inside a LayoutEditModeProvider', () => {
    renderNodes(emptyLink, { editMode: {} })

    const placeholder = screen.getByText('Enlace vacío')
    expect(placeholder).toHaveAttribute('data-empty-placeholder', 'true')
    expect(placeholder.className).toContain('border-dashed')
  })

  it('renders no placeholder trace for an empty link without a LayoutEditModeProvider (production behavior)', () => {
    const { container } = renderNodes(emptyLink)

    expect(container.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(container.querySelector('[data-layout-node="link"]')?.textContent).toBe('')
  })

  it('gives the link placeholder its own data-node-path, connects it as the link\'s own drop zone, and selects itself on click', () => {
    const { container, onSelectNode } = renderNodes(emptyLink, { editMode: {} })

    const linkWrapper = container.querySelector('[data-node-path="children.0"]')
    const placeholder = screen.getByText('Enlace vacío')

    expect(linkWrapper).not.toBeNull()
    expect(placeholder).toHaveAttribute('data-node-path', 'children.0.children.0')
    expect(placeholder.getAttribute('data-node-path')).not.toBe(linkWrapper?.getAttribute('data-node-path'))

    fireEvent.click(placeholder)

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('never shows a placeholder for a text-mode link (props.label set, no children field), in edit mode or production', () => {
    const { container: withoutProvider } = renderNodes(textModeLink)
    expect(withoutProvider.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(within(withoutProvider).getByText('x')).toBeInTheDocument()

    const { container: withProvider } = renderNodes(textModeLink, { editMode: {} })
    expect(withProvider.querySelectorAll('[data-empty-placeholder]')).toHaveLength(0)
    expect(within(withProvider).getByText('x')).toBeInTheDocument()
  })
})
