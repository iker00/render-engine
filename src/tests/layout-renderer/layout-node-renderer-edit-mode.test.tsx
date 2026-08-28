import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import {
  deserializeLayoutNodePath,
  getNodeAtPath,
  parseDropZoneId,
  pathEndsAtTableCell,
  serializeDropZoneId,
  serializeLayoutNodePath,
  type LayoutCanvasDropZone,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import { AccordionGroupProvider } from '../../runtime/runtime-accordion-group'

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

interface RenderNodesEditModeOptions {
  // `active: false` renders a mounted-but-inert provider (design.md feature 0103 Decisión 9,
  // Visual mode inside DevRuntime); omitted or `active: true` renders the live Editor context
  // this file already exercised before that decision existed. `selectedPath`/`hoveredPath`
  // only apply to the `active: true` shape.
  active?: boolean
  selectedPath?: LayoutNodePath | null
  hoveredPath?: LayoutNodePath | null
}

function renderNodes(
  nodes: LayoutNode[],
  options?: { editMode?: RenderNodesEditModeOptions; dataValues?: Record<string, unknown> },
) {
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

  const result = render(
    <RuntimeStateProvider config={buildConfig()} dataValues={options?.dataValues}>
      {content}
    </RuntimeStateProvider>,
  )

  return { ...result, onSelectNode, onHoverNode }
}

describe('getNodeAtPath', () => {
  const tree: LayoutNode[] = [
    {
      type: 'container',
      props: {},
      children: [
        {
          type: 'form',
          id: 'form-1',
          children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
        },
      ],
    },
  ]

  it('resolves the node at a full children path', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    const node = getNodeAtPath(tree, path)

    expect(node).not.toBeNull()
    expect(node?.type).toBe('input')
  })

  it('returns null when an index is out of range', () => {
    const path: LayoutNodePath = [{ field: 'children', index: 5 }]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null for a template step on a node that is not a repeater', () => {
    const path: LayoutNodePath = [{ field: 'children', index: 0 }, { field: 'template', index: 0 }]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  const tabsTree: LayoutNode[] = [
    {
      type: 'tabs',
      props: {
        items: [
          { label: 'Tab A', children: [{ type: 'heading', props: { text: 'A', level: 2 } }] },
          {
            label: 'Tab B',
            children: [
              { type: 'paragraph', props: { text: 'first' } },
              { type: 'paragraph', props: { text: 'second' } },
            ],
          },
        ],
      },
    },
  ]

  it('resolves the node at a path ending in a tabItem step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 1, index: 0 },
    ]

    const node = getNodeAtPath(tabsTree, path)

    expect(node).not.toBeNull()
    expect(node?.type).toBe('paragraph')
    expect(node && 'props' in node && (node.props as { text?: string }).text).toBe('first')
  })

  it('returns null for a tabItem step on a node that is not tabs', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null when itemIndex is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 5, index: 0 },
    ]

    expect(getNodeAtPath(tabsTree, path)).toBeNull()
  })

  it('returns null when index within the tab item is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 5 },
    ]

    expect(getNodeAtPath(tabsTree, path)).toBeNull()
  })

  const stepsTree: LayoutNode[] = [
    {
      type: 'steps',
      props: {
        items: [
          { label: 'Step A', children: [{ type: 'heading', props: { text: 'A', level: 2 } }] },
          {
            label: 'Step B',
            children: [
              { type: 'paragraph', props: { text: 'first' } },
              { type: 'paragraph', props: { text: 'second' } },
            ],
          },
        ],
      },
    },
  ]

  it('resolves the node at a path ending in a stepItem step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 1, index: 0 },
    ]

    const node = getNodeAtPath(stepsTree, path)

    expect(node).not.toBeNull()
    expect(node?.type).toBe('paragraph')
    expect(node && 'props' in node && (node.props as { text?: string }).text).toBe('first')
  })

  it('returns null for a stepItem step on a node that is not steps', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 0, index: 0 },
    ]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null when itemIndex is out of range for a stepItem step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 5, index: 0 },
    ]

    expect(getNodeAtPath(stepsTree, path)).toBeNull()
  })

  it('returns null when index within the step item is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 0, index: 5 },
    ]

    expect(getNodeAtPath(stepsTree, path)).toBeNull()
  })

  const manualTableTree: LayoutNode[] = [
    {
      type: 'table',
      props: {
        headers: ['Name', 'Status'],
        rows: [
          [
            'Alice',
            {
              type: 'container',
              props: {},
              children: [{ type: 'heading', props: { text: 'Active', level: 3 } }],
            },
          ],
          ['Bob', 'Inactive'],
        ],
      },
    },
  ]

  const dynamicTableTree: LayoutNode[] = [
    {
      type: 'table',
      props: {
        headers: ['Name', 'Status'],
        rows: {
          source: 'queries.items',
          cells: [
            'item.name',
            {
              type: 'container',
              props: {},
              children: [{ type: 'paragraph', props: { text: 'Status cell' } }],
            },
          ],
        },
      },
    },
  ]

  it('resolves a cell-node at a row step in manual mode', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
    ]

    expect(getNodeAtPath(manualTableTree, path)?.type).toBe('container')
  })

  it('resolves a node nested inside a manual-mode cell-container via a subsequent children step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
      { field: 'children', index: 0 },
    ]

    const node = getNodeAtPath(manualTableTree, path)
    expect(node?.type).toBe('heading')
  })

  it('resolves a cell-node at a cells step in dynamic mode', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
    ]

    expect(getNodeAtPath(dynamicTableTree, path)?.type).toBe('container')
  })

  it('resolves a node nested inside a dynamic-mode cell-container via a subsequent children step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
      { field: 'children', index: 0 },
    ]

    const node = getNodeAtPath(dynamicTableTree, path)
    expect(node?.type).toBe('paragraph')
  })

  it('returns null when rowIndex is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 5, index: 0 },
    ]

    expect(getNodeAtPath(manualTableTree, path)).toBeNull()
  })

  it('returns null when the row cell index is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 5 },
    ]

    expect(getNodeAtPath(manualTableTree, path)).toBeNull()
  })

  it('returns null when the cells index is out of range', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 5 },
    ]

    expect(getNodeAtPath(dynamicTableTree, path)).toBeNull()
  })

  it('returns null for a row step against a dynamic-mode table', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 0 },
    ]

    expect(getNodeAtPath(dynamicTableTree, path)).toBeNull()
  })

  it('returns null for a cells step against a manual-mode table', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 0 },
    ]

    expect(getNodeAtPath(manualTableTree, path)).toBeNull()
  })

  it('returns null for a row step against a node that is not a table', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 0 },
    ]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null for a cells step against a node that is not a table', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 0 },
    ]

    expect(getNodeAtPath(tree, path)).toBeNull()
  })

  it('returns null when a row step resolves to a primitive (text) cell', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 1, index: 0 },
    ]

    expect(getNodeAtPath(manualTableTree, path)).toBeNull()
  })

  it('returns null when a cells step resolves to a primitive (text) cell', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 0 },
    ]

    expect(getNodeAtPath(dynamicTableTree, path)).toBeNull()
  })
})

describe('serializeLayoutNodePath', () => {
  it('produces stable and distinct strings for different paths', () => {
    const empty = serializeLayoutNodePath([])
    const withTemplate = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'template', index: 1 },
    ])
    const withTabItem = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 1, index: 0 },
    ])
    const withStepItem = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 1, index: 0 },
    ])
    const withRow = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 2, index: 1 },
    ])
    const withCells = serializeLayoutNodePath([
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
    ])

    expect(empty).toBe('')
    expect(withTemplate).toBe('children.0.template.1')
    expect(withTabItem).toBe('children.0.tabItem.1.0')
    expect(withStepItem).toBe('children.0.stepItem.1.0')
    expect(withRow).toBe('children.0.row.2.1')
    expect(withCells).toBe('children.0.cells.1')

    const values = new Set([empty, withTemplate, withTabItem, withStepItem, withRow, withCells])
    expect(values.size).toBe(6)
  })
})

describe('serializeLayoutNodePath / deserializeLayoutNodePath round-trip for tabItem/stepItem paths', () => {
  it('round-trips a path ending in a tabItem step (regression)', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 1, index: 0 },
    ]

    expect(deserializeLayoutNodePath(serializeLayoutNodePath(path))).toEqual(path)
  })

  it('round-trips a path ending in a stepItem step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 1, index: 0 },
    ]

    expect(deserializeLayoutNodePath(serializeLayoutNodePath(path))).toEqual(path)
  })
})

describe('serializeDropZoneId / parseDropZoneId with tabItemIndex/stepItemIndex', () => {
  it('round-trips a stepItemIndex disambiguator for a drop target inside a steps node', () => {
    const zone: LayoutCanvasDropZone = { parentPath: [{ field: 'children', index: 0 }], index: 1, stepItemIndex: 0 }

    const id = serializeDropZoneId(zone)

    expect(id).toBe('drop:children.0:1:stepItem.0')
    expect(parseDropZoneId(id)).toEqual({ parentPath: [{ field: 'children', index: 0 }], index: 1, stepItemIndex: 0 })
  })

  it('still returns tabItemIndex (not stepItemIndex) for an id with a :tabItem. suffix (regression)', () => {
    const zone: LayoutCanvasDropZone = { parentPath: [{ field: 'children', index: 0 }], index: 1, tabItemIndex: 0 }

    const id = serializeDropZoneId(zone)

    expect(id).toBe('drop:children.0:1:tabItem.0')
    const parsed = parseDropZoneId(id)
    expect(parsed).toEqual({ parentPath: [{ field: 'children', index: 0 }], index: 1, tabItemIndex: 0 })
    expect(parsed?.stepItemIndex).toBeUndefined()
  })
})

describe('serializeLayoutNodePath / deserializeLayoutNodePath round-trip for table cell paths', () => {
  it('round-trips a path ending in a row step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 2, index: 1 },
    ]

    expect(deserializeLayoutNodePath(serializeLayoutNodePath(path))).toEqual(path)
  })

  it('round-trips a path ending in a cells step', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
    ]

    expect(deserializeLayoutNodePath(serializeLayoutNodePath(path))).toEqual(path)
  })

  it('round-trips a row step followed by a children step (cell-container with children)', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
      { field: 'children', index: 0 },
    ]

    expect(deserializeLayoutNodePath(serializeLayoutNodePath(path))).toEqual(path)
  })

  it('round-trips a cells step followed by a children step (cell-container with children)', () => {
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
      { field: 'children', index: 0 },
    ]

    expect(deserializeLayoutNodePath(serializeLayoutNodePath(path))).toEqual(path)
  })
})

describe('deserializeLayoutNodePath — malformed row/cells tokens', () => {
  it('returns null when the row rowIndex token is not an integer', () => {
    expect(deserializeLayoutNodePath('children.0.row.abc.0')).toBeNull()
  })

  it('returns null when the row index token is not an integer', () => {
    expect(deserializeLayoutNodePath('children.0.row.0.abc')).toBeNull()
  })

  it('returns null when the row rowIndex is negative', () => {
    expect(deserializeLayoutNodePath('children.0.row.-1.0')).toBeNull()
  })

  it('returns null when the row index is negative', () => {
    expect(deserializeLayoutNodePath('children.0.row.0.-1')).toBeNull()
  })

  it('returns null when the row index token is absent', () => {
    expect(deserializeLayoutNodePath('children.0.row.0')).toBeNull()
  })

  it('returns null when both row tokens are absent', () => {
    expect(deserializeLayoutNodePath('children.0.row')).toBeNull()
  })

  it('returns null when the cells index token is not an integer', () => {
    expect(deserializeLayoutNodePath('children.0.cells.abc')).toBeNull()
  })

  it('returns null when the cells index is negative', () => {
    expect(deserializeLayoutNodePath('children.0.cells.-1')).toBeNull()
  })

  it('returns null when the cells index token is absent', () => {
    expect(deserializeLayoutNodePath('children.0.cells')).toBeNull()
  })
})

describe('pathEndsAtTableCell', () => {
  it('returns false for the empty path', () => {
    expect(pathEndsAtTableCell([])).toBe(false)
  })

  it('returns true when the last step is a row step', () => {
    expect(
      pathEndsAtTableCell([{ field: 'children', index: 0 }, { field: 'row', rowIndex: 0, index: 1 }]),
    ).toBe(true)
  })

  it('returns true when the last step is a cells step', () => {
    expect(pathEndsAtTableCell([{ field: 'children', index: 0 }, { field: 'cells', index: 1 }])).toBe(
      true,
    )
  })

  it('returns false when the last step is children, even right after a row step', () => {
    expect(
      pathEndsAtTableCell([
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 1 },
        { field: 'children', index: 0 },
      ]),
    ).toBe(false)
  })

  it('returns false when the last step is children, even right after a cells step', () => {
    expect(
      pathEndsAtTableCell([
        { field: 'children', index: 0 },
        { field: 'cells', index: 1 },
        { field: 'children', index: 0 },
      ]),
    ).toBe(false)
  })

  it('returns false for a path ending in a plain children step', () => {
    expect(pathEndsAtTableCell([{ field: 'children', index: 0 }])).toBe(false)
  })

  it('returns false for a path ending in a template step', () => {
    expect(pathEndsAtTableCell([{ field: 'template', index: 0 }])).toBe(false)
  })

  it('returns false for a path ending in a tabItem step', () => {
    expect(pathEndsAtTableCell([{ field: 'tabItem', itemIndex: 0, index: 0 }])).toBe(false)
  })
})

function StatefulEditModeHarness({ nodes }: { nodes: LayoutNode[] }) {
  const [selectedPath, setSelectedPath] = useState<LayoutNodePath | null>(null)
  const [hoveredPath, setHoveredPath] = useState<LayoutNodePath | null>(null)

  return (
    <RuntimeStateProvider config={buildConfig()}>
      <LayoutEditModeProvider
        value={{
          active: true,
          selectedPath,
          hoveredPath,
          onSelectNode: setSelectedPath,
          onHoverNode: setHoveredPath,
        }}
      >
        <LayoutRenderer nodes={nodes} />
      </LayoutEditModeProvider>
    </RuntimeStateProvider>
  )
}

describe('LayoutRenderer path threading', () => {
  const nodes: LayoutNode[] = [
    { type: 'heading', props: { text: 'First', level: 1 } },
    { type: 'heading', props: { text: 'Second', level: 1 } },
  ]

  const compoundTree: LayoutNode[] = [
    {
      type: 'container',
      props: {},
      children: [
        {
          type: 'form',
          id: 'compound-form',
          children: [{ type: 'heading', props: { text: 'Nested heading', level: 2 } }],
        },
      ],
    },
  ]

  const compoundContainerPath: LayoutNodePath = [{ field: 'children', index: 0 }]
  const compoundFormPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]
  const compoundHeadingPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]

  it('builds each child path with the default {field: "children", index} step', () => {
    renderNodes(nodes, { editMode: {} })

    expect(screen.getByText('First').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'children.0',
    )
    expect(screen.getByText('Second').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'children.1',
    )
  })

  it('uses a custom buildChildPath to compute the path of each child', () => {
    const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
    const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()

    render(
      <RuntimeStateProvider config={buildConfig()}>
        <LayoutEditModeProvider
          value={{ active: true, selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }}
        >
          <LayoutRenderer
            nodes={nodes}
            path={[]}
            buildChildPath={(index) => [{ field: 'template', index }]}
          />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    expect(screen.getByText('First').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'template.0',
    )
    expect(screen.getByText('Second').closest('[data-node-path]')).toHaveAttribute(
      'data-node-path',
      'template.1',
    )
  })

  it('accumulates the real path across three levels of container > form > heading recursion', () => {
    const expectedSerialized = serializeLayoutNodePath(compoundHeadingPath)

    // Sanity check: the expected path really does resolve to the heading node.
    expect(getNodeAtPath(compoundTree, compoundHeadingPath)?.type).toBe('heading')

    const { onSelectNode } = renderNodes(compoundTree, { editMode: {} })

    const headingText = screen.getByText('Nested heading')
    const wrapper = headingText.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', expectedSerialized)
    expect(expectedSerialized.split('.').filter((segment) => segment === 'children').length).toBe(3)

    fireEvent.click(headingText)

    // The click bubbles through the (intentionally non-stopPropagation) ancestor wrappers
    // (form, then container) too, but the heading's own wrapper — the actual click target —
    // fires first, and it carries the heading's exact 3-level path, not a collapsed one.
    expect(onSelectNode).toHaveBeenCalled()
    expect(onSelectNode.mock.calls[0][0]).toEqual(compoundHeadingPath)
  })

  it('invokes onSelectNode exactly once for a click on a deeply nested node, even though the click bubbles through two more selectable ancestor wrappers', () => {
    // This is the precise guarantee the "first handler wins" marking mechanism provides:
    // only the innermost wrapper under the pointer (the heading's own) is allowed to call
    // onSelectNode; the form and container wrappers above it see the click too (bubbling,
    // no stopPropagation) but must no-op because the native event is already marked.
    const { onSelectNode } = renderNodes(compoundTree, { editMode: {} })

    fireEvent.click(screen.getByText('Nested heading'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith(compoundHeadingPath)
  })

  it('leaves the FINAL selection state pointing at the clicked node, not at an outer ancestor, after a real click applies onSelectNode to React state (container > form > heading)', () => {
    // Reproduces the bug end-to-end: onSelectNode here is wired to setState, exactly like
    // the real dev-editor canvas wires LayoutEditModeProvider. Before the fix, the outermost
    // ancestor wrapper (container) ran its onSelectNode call LAST during bubbling, so it won
    // the state race and the final selection was the container/form, never the heading.
    const { container } = render(<StatefulEditModeHarness nodes={compoundTree} />)

    fireEvent.click(screen.getByText('Nested heading'))

    const headingWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundHeadingPath)}"]`,
    )
    const formWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundFormPath)}"]`,
    )
    const containerWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundContainerPath)}"]`,
    )

    expect(headingWrapper?.className).toContain('outline-blue-500')
    expect(formWrapper?.className ?? '').not.toContain('outline-blue-500')
    expect(containerWrapper?.className ?? '').not.toContain('outline-blue-500')
  })

  it('leaves the FINAL hovered state pointing at the innermost node under the pointer, not at an outer ancestor, after mouseEnter on a nested node (container > form > heading)', () => {
    const { container } = render(<StatefulEditModeHarness nodes={compoundTree} />)

    const headingWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundHeadingPath)}"]`,
    ) as HTMLElement

    fireEvent.mouseEnter(headingWrapper)

    const formWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundFormPath)}"]`,
    )
    const containerWrapper = container.querySelector(
      `[data-node-path="${serializeLayoutNodePath(compoundContainerPath)}"]`,
    )

    expect(headingWrapper.className).toContain('outline-blue-300')
    expect(formWrapper?.className ?? '').not.toContain('outline-blue-300')
    expect(containerWrapper?.className ?? '').not.toContain('outline-blue-300')
  })
})

describe('LayoutNodeRenderer edit mode wrapper', () => {
  const representativeTree: LayoutNode[] = [
    {
      type: 'container',
      props: { direction: 'row', gap: 'sm' },
      children: [{ type: 'heading', props: { text: 'Title', level: 1 } }],
    },
    {
      type: 'form',
      id: 'form-1',
      children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
    },
    {
      type: 'repeater',
      props: {
        items: { source: 'queries.posts.data.results', key: 'id' },
        template: [{ type: 'paragraph', props: { text: 'item.title' } }],
      },
    },
    { type: 'button', props: { label: 'Click me' } },
  ]

  it('produces no data-node-path attribute or edit-mode wrapper without a LayoutEditModeProvider', () => {
    const { container } = renderNodes(representativeTree, {
      dataValues: { posts: { results: [{ id: 1, title: 'One' }] } },
    })

    expect(container.querySelectorAll('[data-node-path]')).toHaveLength(0)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Click me')).toBeInTheDocument()
    expect(screen.getByText('One')).toBeInTheDocument()
  })

  it('exposes data-node-path on every top-level node when a provider is present with no selection', () => {
    const { container } = renderNodes(representativeTree, {
      editMode: {},
      dataValues: { posts: { results: [{ id: 1, title: 'One' }] } },
    })

    const containerWrapper = container.querySelector('[data-node-path="children.0"]')
    const formWrapper = container.querySelector('[data-node-path="children.1"]')
    const repeaterWrapper = container.querySelector('[data-node-path="children.2"]')
    const buttonWrapper = container.querySelector('[data-node-path="children.3"]')

    expect(containerWrapper?.textContent).toContain('Title')
    expect(formWrapper?.textContent).toContain('Name')
    expect(repeaterWrapper?.textContent).toContain('One')
    expect(buttonWrapper?.textContent).toContain('Click me')
  })

  it('invokes onSelectNode with the exact path of the clicked node', () => {
    // The button is a standalone top-level node (no wrapped ancestor above it in this
    // tree), so clicking it only bubbles through its own wrapper.
    const { onSelectNode } = renderNodes(representativeTree, { editMode: {} })

    fireEvent.click(screen.getByText('Click me'))

    expect(onSelectNode).toHaveBeenCalledTimes(1)
    expect(onSelectNode).toHaveBeenCalledWith([{ field: 'children', index: 3 }])
  })

  it('invokes onHoverNode(path) on mouseEnter and onHoverNode(null) on mouseLeave without touching selection', () => {
    const { onHoverNode, onSelectNode } = renderNodes(representativeTree, { editMode: {} })

    const buttonWrapper = screen.getByText('Click me').closest('[data-node-path]') as HTMLElement

    fireEvent.mouseEnter(buttonWrapper)
    expect(onHoverNode).toHaveBeenLastCalledWith([{ field: 'children', index: 3 }])

    fireEvent.mouseLeave(buttonWrapper)
    expect(onHoverNode).toHaveBeenLastCalledWith(null)

    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it('applies the selection class to the selected node and the hover class to a different hovered node', () => {
    const { container } = renderNodes(representativeTree, {
      editMode: {
        selectedPath: [{ field: 'children', index: 0 }],
        hoveredPath: [{ field: 'children', index: 3 }],
      },
    })

    const selectedWrapper = container.querySelector('[data-node-path="children.0"]') as HTMLElement
    const hoveredWrapper = container.querySelector('[data-node-path="children.3"]') as HTMLElement

    expect(selectedWrapper.className).toContain('outline-blue-500')
    expect(selectedWrapper.className).not.toContain('outline-blue-300')

    expect(hoveredWrapper.className).toContain('outline-blue-300')
    expect(hoveredWrapper.className).not.toContain('outline-blue-500')
  })

  it('bubbles a click on an inner interactive control up to the nearest node wrapper without stopPropagation, without breaking the control own handler', () => {
    const treeWithAction: LayoutNode[] = [
      {
        type: 'form',
        id: 'form-with-button',
        children: [
          {
            type: 'button',
            props: { label: 'Open modal', action: { type: 'openModal', modalId: 'demo-modal' } },
          },
        ],
      },
    ]

    const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
    const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()
    const config = buildConfig()
    const state = createRuntimeState(config)
    const dispatch = vi.fn()
    const dispatchAndSyncState = vi.fn()

    render(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: state,
          state,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => state,
        }}
      >
        <LayoutEditModeProvider
          value={{ active: true, selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }}
        >
          <LayoutRenderer nodes={treeWithAction} />
        </LayoutEditModeProvider>
      </RuntimeStateContext.Provider>,
    )

    const button = screen.getByRole('button', { name: 'Open modal' })

    fireEvent.click(button)

    // The button's own onClick handler ran, but T1's centralized suppression in
    // useRuntimeStateActions makes openModal a no-op in edit mode, so no
    // modal/open action ever reaches the reducer.
    expect(dispatchAndSyncState).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'modal/open', payload: expect.objectContaining({ modalId: 'demo-modal' }) }),
    )

    // ...and the click also reached the button's own node wrapper (the nearest ancestor
    // with data-node-path) as the first call, since no stopPropagation is used anywhere
    // in the edit-mode wrapper chain — it then keeps bubbling to the form wrapper above it.
    expect(onSelectNode.mock.calls[0][0]).toEqual([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })
})

describe('LayoutNodeRenderer edit mode <fieldset disabled> wrapper for form fields', () => {
  const inputForm: LayoutNode[] = [
    {
      type: 'form',
      id: 'f',
      children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
    },
  ]

  it('wraps a form > input in <fieldset disabled className="contents"> nested INSIDE the selection wrapper when the edit mode provider is present', () => {
    const { container } = renderNodes(inputForm, { editMode: {} })

    const input = screen.getByLabelText('Name') as HTMLInputElement
    // The input node path is form (children.0) > input (children.0) → "children.0.children.0"
    const selectionWrapper = container.querySelector(
      '[data-node-path="children.0.children.0"]',
    ) as HTMLElement

    expect(selectionWrapper).not.toBeNull()

    const fieldset = selectionWrapper.querySelector('fieldset') as HTMLFieldSetElement | null
    expect(fieldset).not.toBeNull()
    expect(fieldset!.disabled).toBe(true)
    // "contents" is required so the fieldset does not introduce a box of its own.
    expect(fieldset!.className).toContain('contents')

    // Ordering: the fieldset is INSIDE the selection wrapper (so a click on the
    // control still bubbles to the wrapper's onClick and triggers selection).
    expect(selectionWrapper.contains(fieldset)).toBe(true)
    expect(fieldset!.contains(input)).toBe(true)
    // Sanity: the wrapper is not itself nested inside a <fieldset> ancestor,
    // which would flip the required order.
    expect(fieldset!.contains(selectionWrapper)).toBe(false)
  })

  it('marks a form input as inert through the fieldset[disabled] ancestor so browsers block user input', () => {
    renderNodes(inputForm, { editMode: {} })

    const input = screen.getByLabelText('Name') as HTMLInputElement

    // toBeDisabled follows the fieldset[disabled] cascade defined by HTML —
    // real browsers use exactly this cascade to prevent typing, focusing, and
    // firing change/input events on the control. (The JSDOM+React test harness
    // does not simulate that browser gate for synthetic events, so the
    // observable here is the disabled state itself.)
    expect(input).toBeDisabled()
    expect(input.matches(':disabled')).toBe(true)
  })

  it('selects the input node when clicking on the input in edit mode (click bubbles to the selection wrapper above the fieldset)', () => {
    const { onSelectNode } = renderNodes(inputForm, { editMode: {} })

    const input = screen.getByLabelText('Name')
    fireEvent.click(input)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('does not check a radioGroup option when clicking on its <label>, and selects the radioGroup node', () => {
    const radioForm: LayoutNode[] = [
      {
        type: 'form',
        id: 'f',
        children: [
          {
            type: 'radioGroup',
            props: {
              fieldId: 'role',
              label: 'Role',
              items: [
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
              ],
            },
          },
        ],
      },
    ]

    const { onSelectNode } = renderNodes(radioForm, { editMode: {} })

    const adminRadio = screen.getByRole('radio', { name: 'Admin' }) as HTMLInputElement
    const adminLabel = adminRadio.closest('label') as HTMLLabelElement

    // The radio is disabled via the fieldset[disabled] cascade — this is the
    // exact case pointer-events-none alone would NOT cover (label-driven
    // activation would still toggle the input).
    expect(adminRadio).toBeDisabled()
    expect(adminRadio.checked).toBe(false)

    fireEvent.click(adminLabel)

    expect(adminRadio.checked).toBe(false)
    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('marks the toggle button as inert through the fieldset[disabled] cascade so browsers block activation; clicking the toggle label still selects the toggle node', () => {
    const toggleForm: LayoutNode[] = [
      {
        type: 'form',
        id: 'f',
        children: [{ type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } }],
      },
    ]

    const { onSelectNode } = renderNodes(toggleForm, { editMode: {} })

    const toggle = screen.getByRole('switch')
    // Real browsers block the click event on a disabled button — the observable
    // in JSDOM is the disabled state itself (browser-enforced downstream).
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    // Clicking the toggle's own label text bubbles up to the selection wrapper
    // without touching the disabled control (no activation path from a plain
    // <span> label to the button), so aria-checked stays unchanged and the
    // toggle node is selected.
    fireEvent.click(screen.getByText('Agree'))

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('does not wrap a form > button (with a navigateTo action) in a fieldset; the button stays clickable and selection still works', () => {
    const buttonForm: LayoutNode[] = [
      {
        type: 'form',
        id: 'f',
        children: [
          {
            type: 'button',
            props: { label: 'Go home', action: { type: 'navigateTo', pageId: 'home' } },
          },
        ],
      },
    ]

    const { container, onSelectNode } = renderNodes(buttonForm, { editMode: {} })

    const button = screen.getByRole('button', { name: 'Go home' })
    const buttonWrapper = container.querySelector(
      '[data-node-path="children.0.children.0"]',
    ) as HTMLElement

    expect(buttonWrapper).not.toBeNull()
    // No <fieldset> anywhere inside the button's own wrapper — the inert set
    // deliberately excludes 'button' (a disabled <button> would drop the click
    // event entirely and break selection).
    expect(buttonWrapper.querySelector('fieldset')).toBeNull()
    expect(button).not.toBeDisabled()

    fireEvent.click(button)

    // Selection still works (T2 of feature 0102); the non-navigation is T1's
    // responsibility (navigateToPage is a no-op in edit mode).
    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ])
  })

  it('does not wrap an accordion header in a fieldset; clicking the header toggles aria-expanded (local state preserved) and selects the accordion node', () => {
    const accordionTree: LayoutNode[] = [
      {
        type: 'accordion',
        props: { label: 'Section' },
        children: [{ type: 'paragraph', props: { text: 'body' } }],
      },
    ]

    const onSelectNode = vi.fn<(path: LayoutNodePath) => void>()
    const onHoverNode = vi.fn<(path: LayoutNodePath | null) => void>()

    const { container } = render(
      <RuntimeStateProvider config={buildConfig()}>
        <AccordionGroupProvider>
          <LayoutEditModeProvider
            value={{ active: true, selectedPath: null, hoveredPath: null, onSelectNode, onHoverNode }}
          >
            <LayoutRenderer nodes={accordionTree} />
          </LayoutEditModeProvider>
        </AccordionGroupProvider>
      </RuntimeStateProvider>,
    )

    const header = screen.getByRole('button', { name: 'Section' })
    const accordionWrapper = container.querySelector(
      '[data-node-path="children.0"]',
    ) as HTMLElement

    expect(accordionWrapper).not.toBeNull()
    // 'accordion' is not in the inert set — its internal open/close state is
    // component-local and preserved in edit mode per spec FR11.
    expect(accordionWrapper.querySelector('fieldset')).toBeNull()
    expect(header).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(header)

    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(onSelectNode).toHaveBeenCalledWith([{ field: 'children', index: 0 }])
  })

  it('produces the same DOM as production (no <fieldset>) for a form > input WITHOUT a LayoutEditModeProvider; writing to the input updates state normally', () => {
    const { container } = renderNodes(inputForm)

    expect(container.querySelectorAll('fieldset')).toHaveLength(0)

    const input = screen.getByLabelText('Name') as HTMLInputElement
    expect(input).not.toBeDisabled()

    fireEvent.change(input, { target: { value: 'jane' } })

    // Without the provider, useRuntimeStateActions dispatches normally and the
    // controlled input reflects the updated state.forms.f.name.value.
    expect(input.value).toBe('jane')
  })
})

// design.md feature 0103 Decisión 9: a provider mounted with `{ active: false }` (Visual mode
// inside DevRuntime) keeps the same wrapper/fieldset PRESENCE as `{ active: true }` (so toggling
// modes never remounts a node), but every behavior gated on ".active" stays inert — no outline,
// no click-to-select, fieldset present but not disabled.
describe('LayoutNodeRenderer edit mode wrapper — { active: false } (Visual mode inside DevRuntime)', () => {
  const representativeTree: LayoutNode[] = [
    {
      type: 'container',
      props: { direction: 'row', gap: 'sm' },
      children: [{ type: 'heading', props: { text: 'Title', level: 1 } }],
    },
    { type: 'button', props: { label: 'Click me' } },
  ]

  it('still exposes data-node-path on every top-level node (wrapper presence never toggles on .active)', () => {
    const { container } = renderNodes(representativeTree, { editMode: { active: false } })

    expect(container.querySelector('[data-node-path="children.0"]')?.textContent).toContain('Title')
    expect(container.querySelector('[data-node-path="children.1"]')?.textContent).toContain('Click me')
  })

  it('does not call onSelectNode on click and does not apply any outline class', () => {
    const { onSelectNode, onHoverNode } = renderNodes(representativeTree, { editMode: { active: false } })

    const buttonWrapper = screen.getByText('Click me').closest('[data-node-path]') as HTMLElement
    fireEvent.click(buttonWrapper)
    fireEvent.mouseEnter(buttonWrapper)

    expect(onSelectNode).not.toHaveBeenCalled()
    expect(onHoverNode).not.toHaveBeenCalled()
    expect(buttonWrapper.className).not.toContain('outline')
  })

  it('renders <fieldset> for a form field but NOT disabled, and writing to the input updates state normally', () => {
    const inputForm: LayoutNode[] = [
      {
        type: 'form',
        id: 'f',
        children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
      },
    ]

    const { container } = renderNodes(inputForm, { editMode: { active: false } })

    const selectionWrapper = container.querySelector(
      '[data-node-path="children.0.children.0"]',
    ) as HTMLElement
    const fieldset = selectionWrapper.querySelector('fieldset') as HTMLFieldSetElement | null

    expect(fieldset).not.toBeNull()
    expect(fieldset!.disabled).toBe(false)

    const input = screen.getByLabelText('Name') as HTMLInputElement
    expect(input).not.toBeDisabled()

    fireEvent.change(input, { target: { value: 'jane' } })
    expect(input.value).toBe('jane')
  })
})
