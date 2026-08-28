import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import {
  serializeDropZoneId,
  serializeLayoutNodePath,
  type LayoutCanvasDropZone,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import { replaceNodeAt } from '../../dev-runtime/layout-tree-mutations'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'
import { serializePaletteDragId } from '../../dev-runtime/layout-canvas/layout-canvas-palette-drag-id'

// Mock @monaco-editor/react with a controllable textarea (same pattern as
// layout-canvas-reorder-reinsert.test.tsx / layout-canvas-palette-insert.test.tsx): the JSON tab
// is how the mutated config gets inspected after a real drag through DevRuntimeReady.
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange, onMount }) => {
    if (onMount) {
      onMount(
        { getValue: () => value as string },
        { languages: { json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } } } },
      )
    }
    return (
      <textarea
        data-testid="monaco-editor-mock"
        value={value as string}
        onChange={(e) => (onChange as (v: string) => void)?.(e.target.value)}
      />
    )
  }),
}))

// A test file that mounts the full DevRuntimeReady tree pulls in every lucide-react icon import
// anywhere in that module graph regardless of what actually renders (same reasoning as
// layout-canvas-reorder-reinsert.test.tsx / layout-canvas-palette-insert.test.tsx).
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('../dev-runtime/lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

// Light mock of @dnd-kit/core (see layout-canvas-dnd-wiring.test.tsx, T12): DndContext becomes a
// pass-through that captures the onDragEnd handler, letting the test invoke it directly with a
// synthetic {active, over} pair. useDraggable/useDroppable keep their real implementation — same
// mock as layout-canvas-reorder-reinsert.test.tsx / layout-canvas-palette-insert.test.tsx, no
// parallel mock introduced.
let capturedOnDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: { children: React.ReactNode; onDragEnd?: (event: unknown) => void }) => {
      capturedOnDragEnd = props.onDragEnd as typeof capturedOnDragEnd
      return props.children
    },
  }
})

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
  }
}

function renderNodes(
  nodes: LayoutNode[],
  options?: { editMode?: { active?: boolean }; dataValues?: Record<string, unknown> },
) {
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
    <RuntimeStateProvider config={buildConfig()} dataValues={options?.dataValues}>
      {content}
    </RuntimeStateProvider>,
  )

  return { ...result, onSelectNode, onHoverNode }
}

// Same helper as renderNodes, but with a pre-selected/pre-hovered path so the hover/selection
// outline classes are observable without also asserting on onSelectNode/onHoverNode calls.
function renderNodesWithSelection(
  nodes: LayoutNode[],
  selectedPath: LayoutNodePath | null,
  hoveredPath: LayoutNodePath | null = null,
) {
  const onSelectNode = vi.fn()
  const onHoverNode = vi.fn()
  const editModeValue: LayoutEditModeContextValue = { active: true, selectedPath, hoveredPath, onSelectNode, onHoverNode }

  const result = render(
    <RuntimeStateProvider config={buildConfig()}>
      <LayoutEditModeProvider value={editModeValue}>
        <LayoutRenderer nodes={nodes} />
      </LayoutEditModeProvider>
    </RuntimeStateProvider>,
  )

  return { ...result, onSelectNode, onHoverNode }
}

function buttonCell(label: string) {
  return { type: 'button', props: { label } }
}

function containerCell(children: unknown[] = []) {
  return { type: 'container', props: {}, children }
}

function buildManualTableNode(rows: unknown[][], overrides?: Record<string, unknown>): LayoutNode {
  return {
    type: 'table',
    props: {
      headers: ['Name', 'Action'],
      rows,
      ...overrides,
    },
  } as LayoutNode
}

function buildDynamicTableNode(): LayoutNode {
  return {
    type: 'table',
    props: {
      headers: ['Name', 'Action'],
      rows: {
        source: 'queries.users.data.results',
        cells: ['item.name', buttonCell('Ver')],
      },
    },
  } as LayoutNode
}

describe('TableNode without LayoutEditModeProvider (production regression)', () => {
  it('renders no data-node-path/data-empty-placeholder attributes and keeps cell content identical', () => {
    const { container } = renderNodes([
      buildManualTableNode([
        ['Ada', containerCell([{ type: 'paragraph', props: { text: 'Bio' } }])],
        ['Grace', containerCell([])],
      ]),
    ])

    expect(container.querySelectorAll('[data-node-path]')).toHaveLength(0)
    expect(container.querySelector('[data-empty-placeholder]')).toBeNull()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Bio')).toBeInTheDocument()
    expect(screen.getByText('Grace')).toBeInTheDocument()
  })
})

describe('TableNode with LayoutEditModeProvider — selection in manual mode', () => {
  it('exposes a selectable node-cell with a data-node-path containing the row/cells step', () => {
    const { onSelectNode } = renderNodes(
      [buildManualTableNode([['Ada', buttonCell('Ver Ada')], ['Grace', buttonCell('Ver Grace')]])],
      { editMode: {} },
    )

    const button = screen.getByRole('button', { name: 'Ver Ada' })
    const wrapper = button.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.row.0.1')

    fireEvent.click(button)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
    ])
  })

  it('selecting a cell in the second row addresses that row, not the first', () => {
    const { onSelectNode } = renderNodes(
      [buildManualTableNode([['Ada', buttonCell('Ver Ada')], ['Grace', buttonCell('Ver Grace')]])],
      { editMode: {} },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver Grace' }))

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 1, index: 1 },
    ])
  })

  it('two tables on the same page resolve distinct, non-colliding cell paths', () => {
    const { onSelectNode } = renderNodes(
      [
        buildManualTableNode([['Ada', buttonCell('Ver A')]]),
        buildManualTableNode([['Ada', buttonCell('Ver A')]]),
      ],
      { editMode: {} },
    )

    const [firstButton, secondButton] = screen.getAllByRole('button', { name: 'Ver A' })

    expect(firstButton.closest('[data-node-path]')).toHaveAttribute('data-node-path', 'children.0.row.0.1')
    expect(secondButton.closest('[data-node-path]')).toHaveAttribute('data-node-path', 'children.1.row.0.1')

    fireEvent.click(firstButton)
    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
    ])
  })

  it('hover only outlines the hovered cell, not siblings or the same cell in another table', () => {
    const cellAPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
    ]

    const { container } = renderNodesWithSelection(
      [
        buildManualTableNode([['Ada', buttonCell('Ver A')]]),
        buildManualTableNode([['Ada', buttonCell('Ver A')]]),
      ],
      null,
      cellAPath,
    )

    const outlined = container.querySelectorAll('.outline-blue-300')
    expect(outlined).toHaveLength(1)
    expect(outlined[0]).toHaveAttribute('data-node-path', serializeLayoutNodePath(cellAPath))
  })
})

describe('TableNode with LayoutEditModeProvider — selection in dynamic mode', () => {
  it('exposes a selectable node-cell with a data-node-path using the cells step (shared across rows)', () => {
    const { onSelectNode } = renderNodes([buildDynamicTableNode()], {
      editMode: {},
      dataValues: { users: { results: [{ name: 'Ada' }, { name: 'Grace' }] } },
    })

    const [firstButton] = screen.getAllByRole('button', { name: 'Ver' })
    const wrapper = firstButton.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.cells.1')

    fireEvent.click(firstButton)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
    ])
  })
})

describe('TableNode with LayoutEditModeProvider — nested container children', () => {
  it('a container nested inside a cell exposes its own children at arbitrary depth (path stacked on the row step)', () => {
    const { onSelectNode } = renderNodes(
      [
        buildManualTableNode([
          ['Ada', containerCell([{ type: 'paragraph', props: { text: 'Bio text' } }])],
        ]),
      ],
      { editMode: {} },
    )

    const paragraph = screen.getByText('Bio text')
    const wrapper = paragraph.closest('[data-node-path]')

    expect(wrapper).toHaveAttribute('data-node-path', 'children.0.row.0.1.children.0')

    fireEvent.click(paragraph)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
      { field: 'children', index: 0 },
    ])
  })
})

describe('TableNode with LayoutEditModeProvider — empty container cell placeholder', () => {
  it('shows the EmptyContainerPlaceholder for an empty container cell, selectable, addressed one level below the cell path', () => {
    const { onSelectNode } = renderNodes([buildManualTableNode([['Ada', containerCell([])]])], { editMode: {} })

    const placeholder = screen.getByText('Contenedor vacío')
    expect(placeholder).toHaveAttribute('data-empty-placeholder', 'true')
    expect(placeholder).toHaveAttribute('data-node-path', 'children.0.row.0.1.children.0')

    fireEvent.click(placeholder)

    expect(onSelectNode).toHaveBeenCalledWith([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 1 },
      { field: 'children', index: 0 },
    ])
  })

  it('does not render the placeholder outside Editor mode, same tree as before this task', () => {
    const { container } = renderNodes([buildManualTableNode([['Ada', containerCell([])]])])

    expect(container.querySelector('[data-empty-placeholder]')).toBeNull()
    expect(screen.queryByText('Contenedor vacío')).not.toBeInTheDocument()
  })
})

describe('TableNode — original row index survives filtering, sorting and pagination (critical regression)', () => {
  it('sorting ascending resolves a click on the visually-reordered row to its real props.rows index', () => {
    const nodes: LayoutNode[] = [
      buildManualTableNode(
        [
          ['Bravo', buttonCell('Row0')],
          ['Alpha', buttonCell('Row1')],
          ['Charlie', buttonCell('Row2')],
        ],
        { columns: [{ id: 'Name', sortable: true }] },
      ),
    ]

    const { onSelectNode } = renderNodes(nodes, { editMode: {} })

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar Name' }))
    // Ascending: Alpha (original index 1), Bravo (0), Charlie (2).
    const sortedFirstRowButton = screen.getByRole('button', { name: 'Row1' })
    fireEvent.click(sortedFirstRowButton)

    // The sort toggle click above also bubbles to the table's own selection wrapper (it isn't a
    // LayoutNodeRenderer-owned node itself), so the row-cell click is the *last*, not first, call.
    const capturedPath = onSelectNode.mock.calls.at(-1)![0] as LayoutNodePath
    expect(capturedPath).toEqual([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 1, index: 1 },
    ])

    const mutated = replaceNodeAt(nodes, capturedPath, (node) => {
      if (node.type !== 'button') throw new Error('expected a button node')
      return { ...node, props: { ...node.props, label: 'RENAMED' } }
    })

    const tableNode = mutated[0] as LayoutNode & { props: { rows: unknown[][] } }
    expect((tableNode.props.rows[1][1] as { props: { label: string } }).props.label).toBe('RENAMED')
    expect((tableNode.props.rows[0][1] as { props: { label: string } }).props.label).toBe('Row0')
    expect((tableNode.props.rows[2][1] as { props: { label: string } }).props.label).toBe('Row2')
  })

  it('filtering out the first row resolves a click on the remaining visible row to its real props.rows index', () => {
    const nodes: LayoutNode[] = [
      buildManualTableNode(
        [
          ['Bravo', buttonCell('Row0')],
          ['Alpha', buttonCell('Row1')],
          ['Charlie', buttonCell('Row2')],
        ],
        { columns: [{ id: 'Name', filterable: true }] },
      ),
    ]

    const { onSelectNode } = renderNodes(nodes, { editMode: {} })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar Name' }), { target: { value: 'Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Row1' }))

    const capturedPath = onSelectNode.mock.calls[0][0] as LayoutNodePath
    expect(capturedPath).toEqual([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 1, index: 1 },
    ])

    const mutated = replaceNodeAt(nodes, capturedPath, (node) => {
      if (node.type !== 'button') throw new Error('expected a button node')
      return { ...node, props: { ...node.props, label: 'RENAMED' } }
    })
    const tableNode = mutated[0] as LayoutNode & { props: { rows: unknown[][] } }
    expect((tableNode.props.rows[1][1] as { props: { label: string } }).props.label).toBe('RENAMED')
  })

  it('a cell selected on the second page of pagination resolves to its real props.rows index', () => {
    const nodes: LayoutNode[] = [
      buildManualTableNode(
        [
          ['Row0', buttonCell('B0')],
          ['Row1', buttonCell('B1')],
          ['Row2', buttonCell('B2')],
        ],
        { pagination: { enabled: true, pageSize: 1 } },
      ),
    ]

    const { onSelectNode } = renderNodes(nodes, { editMode: {} })

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'B1' }))

    // The "Siguiente" click also bubbles to the table's own selection wrapper, so the row-cell
    // click is the *last*, not first, call.
    const capturedPath = onSelectNode.mock.calls.at(-1)![0] as LayoutNodePath
    expect(capturedPath).toEqual([
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 1, index: 1 },
    ])
  })
})

// design.md feature 0103 Decisión 9: with a mounted-but-inert provider ({ active: false }, Visual
// mode inside DevRuntime), table cells must behave exactly like production — no selection outline
// nor placeholder — same criterion already applied to repeater/accordion in this same suite family.
describe('TableNode with LayoutEditModeProvider ({ active: false }, Visual mode)', () => {
  it('does not show the EmptyContainerPlaceholder for an empty container cell, same as production', () => {
    renderNodes([buildManualTableNode([['Ada', containerCell([])]])], { editMode: { active: false } })

    expect(screen.queryByText('Contenedor vacío')).not.toBeInTheDocument()
  })
})

// --- Drag end-to-end through the real DevRuntimeReady pipeline: same DnD/monaco mocks as
// layout-canvas-reorder-reinsert.test.tsx / layout-canvas-palette-insert.test.tsx, no separate
// harness. Confirms a cell-container's own children accept the same insert/reorder drop rules as
// any other container, now that its path threads correctly through the row/cells step (T3).
function buildReadyProps(rawConfig: unknown) {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

function renderCanvas(rawConfig: unknown, options?: { openPalette?: boolean }) {
  const { initialConfig, initialConfigText } = buildReadyProps(rawConfig)
  const view = render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
  if (options?.openPalette) {
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
  }
  const canvas = within(screen.getByTestId('runtime-page'))
  return { initialConfigText, container: view.container, canvas }
}

function dragEnd(activeId: string, overZone: LayoutCanvasDropZone | null) {
  expect(capturedOnDragEnd).not.toBeNull()
  act(() => {
    capturedOnDragEnd!({
      active: { id: activeId },
      over: overZone === null ? null : { id: serializeDropZoneId(overZone) },
    })
  })
}

async function getMonacoJson(): Promise<{ parsed: Record<string, unknown> }> {
  if (screen.queryByTestId('monaco-editor-mock') === null) {
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
  }
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  const text = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
  return { parsed: JSON.parse(text) }
}

describe('drag end-to-end into/inside a container-in-cell (same drop rules as any other container)', () => {
  const CELL_PATH: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'row', rowIndex: 0, index: 0 },
  ]

  it('inserts the first child of an empty cell-container from the floating palette', async () => {
    renderCanvas(
      {
        api: {},
        initialPage: 'home',
        pages: [
          {
            id: 'home',
            layout: [{ type: 'table', props: { headers: ['Info'], rows: [[{ type: 'container', props: {}, children: [] }]] } }],
          },
        ],
      },
      { openPalette: true },
    )

    dragEnd(serializePaletteDragId('heading'), { parentPath: CELL_PATH, index: 0 })

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ props: { rows: Array<Array<{ children: Array<{ type: string }> }>> } }> }>)[0]

    expect(page.layout[0].props.rows[0][0].children).toHaveLength(1)
    expect(page.layout[0].props.rows[0][0].children[0].type).toBe('heading')
  })

  it('inserts an additional node into an already-populated cell-container from the palette', async () => {
    renderCanvas(
      {
        api: {},
        initialPage: 'home',
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'table',
                props: {
                  headers: ['Info'],
                  rows: [[{ type: 'container', props: {}, children: [{ type: 'heading', props: { text: 'First', level: 2 } }] }]],
                },
              },
            ],
          },
        ],
      },
      { openPalette: true },
    )

    dragEnd(serializePaletteDragId('paragraph'), { parentPath: CELL_PATH, index: 1 })

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ props: { rows: Array<Array<{ children: Array<{ type: string }> }>> } }> }>)[0]

    expect(page.layout[0].props.rows[0][0].children.map((child) => child.type)).toEqual(['heading', 'paragraph'])
  })

  it('reorders the existing children of a cell-container', async () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Info'],
                rows: [
                  [
                    {
                      type: 'container',
                      props: {},
                      children: [
                        { type: 'heading', props: { text: 'First', level: 2 } },
                        { type: 'heading', props: { text: 'Second', level: 2 } },
                      ],
                    },
                  ],
                ],
              },
            },
          ],
        },
      ],
    })

    dragEnd(serializeLayoutNodePath([...CELL_PATH, { field: 'children', index: 1 }]), { parentPath: CELL_PATH, index: 0 })

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ props: { rows: Array<Array<{ children: Array<{ props: { text: string } }> }>> } }> }>)[0]

    expect(page.layout[0].props.rows[0][0].children.map((child) => child.props.text)).toEqual(['Second', 'First'])
  })
})
