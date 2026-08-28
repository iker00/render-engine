import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'

// Dynamic-mode table cell fixtures below (T5, 0138) need at least one resolved row to render a
// selectable cell — same `preloads` + stubbed `fetch` pattern as layout-canvas-commit.test.tsx's
// `configWithPreloads` suite, the established way to seed `queries.*` state through the real
// DevRuntimeReady pipeline without a separate `dataValues` prop (which DevRuntimeReady does not
// expose).
function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// Mock @monaco-editor/react with a controllable textarea, matching the pattern already
// established in layout-canvas-commit.test.tsx / layout-canvas-palette-insert.test.tsx: the
// JSON tab is how the resulting editorBuffer gets inspected.
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

function buildReadyProps(rawConfig: unknown): { initialConfig: RuntimeConfig; initialConfigText: string } {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

// DevRuntimeReady (0103, T8) edits the real `<RuntimePage />` in place — there is no separate
// canvas preview anymore. Switching to Editor mode from the floating toolbar is what activates
// the LayoutEditModeProvider/LayoutCanvasDndContext wiring on that same tree.
function renderCanvas(rawConfig: unknown) {
  const { initialConfig, initialConfigText } = buildReadyProps(rawConfig)
  const view = render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
  const canvasElement = screen.getByTestId('runtime-page')
  return { initialConfigText, root: view.container, canvas: within(canvasElement), canvasElement }
}

async function getMonacoJson(): Promise<{ text: string; parsed: Record<string, unknown> }> {
  if (screen.queryByTestId('monaco-editor-mock') === null) {
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
  }
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  const text = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
  return { text, parsed: JSON.parse(text) }
}

const CONTAINER_PATH_SELECTOR = '[data-node-path="children.0"]'

function twoChildContainerConfig() {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'container',
            props: { direction: 'row' },
            children: [
              { type: 'heading', props: { text: 'Child A', level: 2 } },
              { type: 'heading', props: { text: 'Child B', level: 3 } },
            ],
          },
        ],
      },
    ],
  }
}

function selectRootContainer(root: HTMLElement) {
  const wrapper = root.querySelector(CONTAINER_PATH_SELECTOR)
  expect(wrapper).not.toBeNull()
  fireEvent.click(wrapper as Element)
}

describe('LayoutCanvas: eliminar nodo seleccionado (FR9)', () => {
  it('elimina el container seleccionado y ambos hijos del layout resultante', async () => {
    const { root } = renderCanvas(twoChildContainerConfig())

    selectRootContainer(root)
    expect(screen.getByTestId('layout-canvas-delete-node-button')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: LayoutNode[] }>)[0]

    expect(page.layout).toHaveLength(0)
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('tras el borrado la selección queda limpia: sin outline de selección, sin panel de propiedades ni breadcrumb', () => {
    const { root } = renderCanvas(twoChildContainerConfig())

    selectRootContainer(root)
    // FloatingSelectionOverlay (0103, T5/T8) renders the breadcrumb/properties panel as a
    // `position: fixed` sibling of `<RuntimePage />`, not nested inside it — so these are
    // global queries now, not scoped to the canvas element.
    expect(screen.getByTestId('layout-canvas-properties-panel')).toBeInTheDocument()
    expect(screen.getByTestId('layout-canvas-breadcrumb')).toBeInTheDocument()
    expect(root.querySelector('.outline-blue-500')).not.toBeNull()

    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    expect(root.querySelector('.outline-blue-500')).toBeNull()
    expect(screen.queryByTestId('layout-canvas-properties-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-canvas-breadcrumb')).not.toBeInTheDocument()
  })

  it('sin ningún nodo seleccionado no existe ninguna acción de borrado disponible', () => {
    renderCanvas(twoChildContainerConfig())

    expect(screen.queryByTestId('layout-canvas-delete-node-button')).not.toBeInTheDocument()
  })

  it('el borrado actualiza Monaco de inmediato al cambiar a la pestaña JSON, sin pulsar "Aplicar"', async () => {
    const { root, initialConfigText } = renderCanvas(twoChildContainerConfig())

    selectRootContainer(root)
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    const { text } = await getMonacoJson()
    expect(text).not.toBe(initialConfigText)
    expect(JSON.parse(text).pages[0].layout).toHaveLength(0)
  })

  // T4 (0133): the node-panel tab bar (T1/T2) is active alongside delete — deleting the node
  // while a non-Props tab is selected must close the panel cleanly, with no leftover errors.
  it('elimina el nodo seleccionado sin errores mientras una pestaña distinta de Props está activa', () => {
    const { root } = renderCanvas(twoChildContainerConfig())

    selectRootContainer(root)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.getByRole('tab', { name: 'Visibilidad' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    expect(screen.queryByTestId('layout-canvas-properties-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-canvas-breadcrumb')).not.toBeInTheDocument()
  })
})

// T5 (0138): "Eliminar nodo" over a table cell-node is special-cased — it reverts the cell to its
// empty-text literal (in place, same position, same row/cells length) instead of removing it,
// because removing an entry from `props.rows`/`props.rows.cells` would misalign the row against
// `headers`/the other cells. Manual mode (`row` step) and dynamic mode (`cells` step) use
// different literals — see `EMPTY_TABLE_CELL_TEXT_VALUE`/`EMPTY_DYNAMIC_TABLE_CELL_TEXT_VALUE` in
// layout-canvas-node-palette-defaults.ts — because `validateTableDynamicRows` rejects `''` for a
// dynamic-mode cell (regression pinned in runtime-config-validation-image-table.test.ts).
describe('LayoutCanvas: "Eliminar nodo" sobre una celda de tabla (T5, 0138)', () => {
  function manualCellTableConfig() {
    return {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Nombre', 'Info'],
                rows: [['Ada', { type: 'heading', props: { text: 'Cell Heading', level: 2 } }]],
              },
            },
          ],
        },
      ],
    }
  }

  function manualCellWithSubtreeConfig() {
    return {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Nombre', 'Info'],
                rows: [
                  [
                    'Ada',
                    {
                      type: 'container',
                      props: {},
                      children: [
                        { type: 'heading', props: { text: 'Title', level: 2 } },
                        { type: 'paragraph', props: { text: 'Body' } },
                      ],
                    },
                  ],
                ],
              },
            },
          ],
        },
      ],
    }
  }

  // Dynamic mode needs at least one resolved collection item to render a selectable cell, so the
  // fixture wires a real `preloads` entry against `api.users` (seeded via stubbed `fetch`, see
  // module-level `createJsonResponse`/`afterEach` above) instead of a static literal `values`
  // shape — `validateTableDynamicRows` rejects a `values` key on `props.rows` (see
  // `validate-table-node.ts`).
  function dynamicCellTableConfig() {
    return {
      api: { users: { method: 'GET', endpoint: '/users' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          preloads: [{ users: {} }],
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Nombre', 'Info'],
                rows: {
                  source: 'queries.users.data',
                  cells: ['item.name', { type: 'heading', props: { text: 'Cell Heading', level: 2 } }],
                },
              },
            },
          ],
        },
      ],
    }
  }

  function dynamicCellWithSubtreeConfig() {
    return {
      api: { users: { method: 'GET', endpoint: '/users' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          preloads: [{ users: {} }],
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Nombre', 'Info'],
                rows: {
                  source: 'queries.users.data',
                  cells: [
                    'item.name',
                    {
                      type: 'container',
                      props: {},
                      children: [
                        { type: 'heading', props: { text: 'Title', level: 2 } },
                        { type: 'paragraph', props: { text: 'Body' } },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    }
  }

  function selectCell(root: HTMLElement, dataNodePath: string) {
    const wrapper = root.querySelector(`[data-node-path="${dataNodePath}"]`)
    expect(wrapper).not.toBeNull()
    fireEvent.click(wrapper as Element)
  }

  async function selectCellAfterPreload(root: HTMLElement, dataNodePath: string) {
    await waitFor(() => expect(root.querySelector(`[data-node-path="${dataNodePath}"]`)).not.toBeNull())
    selectCell(root, dataNodePath)
  }

  it('en modo manual revierte la celda-nodo seleccionada a \'\' en la misma posición, sin cambiar la longitud de la fila ni la de headers/rows, y limpia la selección', async () => {
    const { root } = renderCanvas(manualCellTableConfig())

    selectCell(root, 'children.0.row.0.1')
    expect(screen.getByTestId('layout-canvas-delete-node-button')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    const { parsed } = await getMonacoJson()
    const table = (parsed.pages as Array<{ layout: Array<{ props: { headers: string[]; rows: unknown[][] } }> }>)[0]
      .layout[0]

    expect(table.props.rows).toHaveLength(1)
    expect(table.props.rows[0]).toHaveLength(2)
    expect(table.props.rows[0][1]).toBe('')
    expect(table.props.headers).toHaveLength(2)
    expect(validateRuntimeConfig(parsed).status).toBe('ready')

    expect(screen.queryByTestId('layout-canvas-properties-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-canvas-breadcrumb')).not.toBeInTheDocument()
  })

  it('en modo dinámico revierte la celda-nodo seleccionada a \'—\' en la misma posición de cells, sin cambiar su longitud, y el commit pasa validateRuntimeConfig', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse([{ name: 'Ada' }])))
    const { root } = renderCanvas(dynamicCellTableConfig())

    await selectCellAfterPreload(root, 'children.0.cells.1')
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    const { parsed } = await getMonacoJson()
    const table = (
      parsed.pages as Array<{ layout: Array<{ props: { headers: string[]; rows: { cells: unknown[] } } }> }>
    )[0].layout[0]

    expect(table.props.rows.cells).toHaveLength(2)
    expect(table.props.rows.cells[1]).toBe('—')
    expect(table.props.rows.cells[0]).toBe('item.name')
    // Regression check for the blocker this task closes: before this fix, reverting a dynamic
    // cell to '' produced a commit rejected by validateTableDynamicRows.
    expect(validateRuntimeConfig(parsed).status).toBe('ready')

    expect(screen.queryByTestId('layout-canvas-properties-panel')).not.toBeInTheDocument()
  })

  it('en modo manual, una celda-container con subárbol se revierte de una sola vez a \'\' sin aviso de confirmación adicional', async () => {
    const { root } = renderCanvas(manualCellWithSubtreeConfig())

    selectCell(root, 'children.0.row.0.1')
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    const { parsed } = await getMonacoJson()
    const table = (parsed.pages as Array<{ layout: Array<{ props: { rows: unknown[][] } }> }>)[0].layout[0]

    expect(table.props.rows[0]).toHaveLength(2)
    expect(table.props.rows[0][1]).toBe('')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('en modo dinámico, una celda-container con subárbol se revierte de una sola vez a \'—\' sin aviso de confirmación adicional', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse([{ name: 'Ada' }])))
    const { root } = renderCanvas(dynamicCellWithSubtreeConfig())

    await selectCellAfterPreload(root, 'children.0.cells.1')
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))

    const { parsed } = await getMonacoJson()
    const table = (parsed.pages as Array<{ layout: Array<{ props: { rows: { cells: unknown[] } } }> }>)[0].layout[0]

    expect(table.props.rows.cells).toHaveLength(2)
    expect(table.props.rows.cells[1]).toBe('—')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })
})
