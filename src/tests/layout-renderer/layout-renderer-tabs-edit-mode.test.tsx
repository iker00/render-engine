import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { parseDropZoneId } from '../../runtime/layout-node-path'

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

function buildTabsTree(): LayoutNode[] {
  return [
    {
      type: 'tabs',
      id: 'tabs-1',
      props: {
        items: [
          { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Content A' } }] },
          { label: 'Tab B', children: [{ type: 'paragraph', props: { text: 'Content B' } }] },
        ],
      },
    } as LayoutNode,
  ]
}

describe('TabsNode with LayoutEditModeProvider', () => {
  it('exposes a node inside items[0].children with a data-node-path ending in a tabItem segment with itemIndex: 0', () => {
    const { onSelectNode } = renderNodes(buildTabsTree(), { editMode: {} })

    const paragraph = screen.getByText('Content A')
    const wrapper = paragraph.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.tabItem.0.0')

    fireEvent.click(paragraph)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ])
  })

  it('after clicking the second tab header, exposes a node inside items[1].children with itemIndex: 1', () => {
    renderNodes(buildTabsTree(), { editMode: {} })

    fireEvent.click(screen.getByRole('button', { name: 'Tab B' }))

    const paragraph = screen.getByText('Content B')
    const wrapper = paragraph.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.tabItem.1.0')
    expect(screen.queryByText('Content A')).not.toBeInTheDocument()
  })

  it('renders a drop zone inside the active panel even when its tab declares no children (regression: an empty tab must still be a valid drop target)', () => {
    const { container } = renderNodes(
      [
        {
          type: 'tabs',
          id: 'tabs-1',
          props: { items: [{ label: 'Tab A' }] },
        } as LayoutNode,
      ],
      { editMode: {} },
    )

    const panel = container.querySelector('[data-layout-node="tabs-panel"]')
    const dropZones = panel ? Array.from(panel.querySelectorAll('[data-drop-zone]')) : []

    expect(dropZones).toHaveLength(1)
    expect(parseDropZoneId(dropZones[0].getAttribute('data-drop-zone')!)).toEqual({
      parentPath: [{ field: 'children', index: 0 }],
      index: 0,
      tabItemIndex: 0,
    })
  })
})

describe('TabsNode without LayoutEditModeProvider (production regression)', () => {
  it('switches the active tab panel exactly as before, with no data-node-path anywhere', () => {
    const { container } = renderNodes(buildTabsTree())

    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.queryByText('Content B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tab B' }))

    expect(screen.queryByText('Content A')).not.toBeInTheDocument()
    expect(screen.getByText('Content B')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-node-path]')).toHaveLength(0)
  })
})
