import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'
import {
  serializeDropZoneId,
  serializeLayoutNodePath,
  type LayoutCanvasDropZone,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'

// Mock @monaco-editor/react with a controllable textarea, matching the pattern already
// established in layout-canvas-commit.test.tsx: the JSON tab is how FR6/FR7's acceptance
// criterion ("el editorBuffer resultante sigue siendo válido") gets inspected.
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

// Light mock of @dnd-kit/core (see layout-canvas-dnd-wiring.test.tsx, T12): real pointer
// simulation against PointerSensor is impractical in jsdom, so DndContext is replaced with a
// pass-through that captures the onDragEnd handler LayoutCanvasDndContext registers, letting
// tests invoke it directly with synthetic {active, over} pairs. useDraggable/useDroppable keep
// their real implementation.
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

function heading(text: string) {
  return { type: 'heading', props: { text, level: 2 } }
}

function inputNode(fieldId: string) {
  return { type: 'input', props: { fieldId, label: fieldId } }
}

function container(children: unknown[]) {
  return { type: 'container', children }
}

function form(id: string, children: unknown[]) {
  return { type: 'form', id, children }
}

function tabs(items: Array<{ label: string; children: unknown[] }>) {
  return { type: 'tabs', props: { items } }
}

function buildReadyProps(rawConfig: unknown) {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

// DevRuntimeReady mounts both the "background" preview runtime (data-testid="runtime-page")
// and the canvas's own isolated preview (data-testid="layout-canvas") from the *same* config —
// text/label queries must be scoped to the canvas, or they match both copies.
function renderCanvas(rawConfig: unknown) {
  const { initialConfig, initialConfigText } = buildReadyProps(rawConfig)
  const view = render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)
  fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
  fireEvent.click(screen.getByTestId('dev-runtime-tab-visual'))
  const canvas = within(screen.getByTestId('layout-canvas'))
  return { initialConfigText, container: view.container, canvas }
}

function dragEnd(activePath: LayoutNodePath, overZone: LayoutCanvasDropZone | null) {
  expect(capturedOnDragEnd).not.toBeNull()
  act(() => {
    capturedOnDragEnd!({
      active: { id: serializeLayoutNodePath(activePath) },
      over: overZone === null ? null : { id: serializeDropZoneId(overZone) },
    })
  })
}

async function getMonacoJson(): Promise<{ text: string; parsed: Record<string, unknown> }> {
  fireEvent.click(screen.getByTestId('dev-runtime-tab-json'))
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  const text = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
  return { text, parsed: JSON.parse(text) }
}

describe('drag reanida un nodo existente entre forms (FR6/FR7)', () => {
  const FORM_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
  const FORM_B_PATH: LayoutNodePath = [{ field: 'children', index: 1 }]
  const INPUT_A_PATH: LayoutNodePath = [...FORM_A_PATH, { field: 'children', index: 0 }]

  it('reanida un input existente de un form a otro form distinto; el editorBuffer resultante sigue siendo válido', async () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [form('formA', [inputNode('emailA')]), form('formB', [inputNode('emailB')])],
        },
      ],
    })

    dragEnd(INPUT_A_PATH, { parentPath: FORM_B_PATH, index: 1 })

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ children: Array<{ props: { fieldId: string } }> }> }>)[0]

    expect(page.layout[0].children).toEqual([])
    expect(page.layout[1].children.map((node) => node.props.fieldId)).toEqual(['emailB', 'emailA'])
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('arrastrar un input desde un form a un container hermano sin form no cambia el layout (no invoca commit)', async () => {
    const { initialConfigText } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [form('formA', [inputNode('emailA')]), container([heading('Plain')])],
        },
      ],
    })

    dragEnd(INPUT_A_PATH, { parentPath: FORM_B_PATH, index: 1 })

    const { text } = await getMonacoJson()
    expect(text).toBe(initialConfigText)
  })

  it('un intento de drop inválido no cambia el árbol renderizado: el nodo arrastrado conserva su data-node-path original', () => {
    const { container: root } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [form('formA', [inputNode('emailA')]), container([heading('Plain')])],
        },
      ],
    })

    dragEnd(INPUT_A_PATH, { parentPath: FORM_B_PATH, index: 1 })

    expect(root.querySelector(`[data-node-path="${serializeLayoutNodePath(INPUT_A_PATH)}"]`)).not.toBeNull()
    expect(root.querySelectorAll('[data-node-path]').length).toBeGreaterThan(0)
  })
})

describe('drag reordena hermanos dentro del mismo container (FR6)', () => {
  it('arrastrar el segundo hermano antes del primero produce el nuevo orden en el árbol renderizado', async () => {
    const CONTAINER_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
    const SECOND_PATH: LayoutNodePath = [...CONTAINER_PATH, { field: 'children', index: 1 }]

    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [container([heading('First'), heading('Second')])] }],
    })

    dragEnd(SECOND_PATH, { parentPath: CONTAINER_PATH, index: 0 })

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ children: Array<{ props: { text: string } }> }> }>)[0]

    expect(page.layout[0].children.map((node) => node.props.text)).toEqual(['Second', 'First'])
  })
})

describe('drag reanida entre items de un mismo tabs (FR7)', () => {
  it('arrastrar un heading de items[0].children a items[1].children lo reanida, desapareciendo de items[0]', async () => {
    const TABS_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
    const HEADING_IN_TAB0_PATH: LayoutNodePath = [
      ...TABS_PATH,
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ]

    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            tabs([
              { label: 'Tab1', children: [heading('TabHeading')] },
              { label: 'Tab2', children: [] },
            ]),
          ],
        },
      ],
    })

    dragEnd(HEADING_IN_TAB0_PATH, { parentPath: TABS_PATH, index: 0, tabItemIndex: 1 })

    const { parsed } = await getMonacoJson()
    const tabsNode = (
      parsed.pages as Array<{
        layout: Array<{ props: { items: Array<{ children: Array<{ props: { text: string } }> }> } }>
      }>
    )[0].layout[0]

    expect(tabsNode.props.items[0].children).toEqual([])
    expect(tabsNode.props.items[1].children.map((node) => node.props.text)).toEqual(['TabHeading'])
  })
})

describe('la selección sigue al nodo arrastrado tras un commit válido (FR6/FR7)', () => {
  it('mueve el nodo seleccionado a otro container y la selección apunta al nuevo data-node-path', () => {
    const CONTAINER_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
    const CONTAINER_B_PATH: LayoutNodePath = [{ field: 'children', index: 1 }]
    const MOVABLE_PATH: LayoutNodePath = [...CONTAINER_A_PATH, { field: 'children', index: 0 }]
    const EXPECTED_NEW_PATH: LayoutNodePath = [...CONTAINER_B_PATH, { field: 'children', index: 1 }]

    const { container: root, canvas } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [container([heading('Movable')]), container([heading('Target sibling')])],
        },
      ],
    })

    fireEvent.click(canvas.getByText('Movable'))
    expect(root.querySelector(`[data-node-path="${serializeLayoutNodePath(MOVABLE_PATH)}"]`)?.className).toContain(
      'outline-blue-500',
    )
    expect(screen.getByTestId('layout-canvas-properties-panel')).toBeInTheDocument()

    dragEnd(MOVABLE_PATH, { parentPath: CONTAINER_B_PATH, index: 1 })

    expect(screen.getByTestId('layout-canvas-properties-panel')).toBeInTheDocument()
    // The "Movable" heading itself now lives at EXPECTED_NEW_PATH and carries the selected
    // outline — asserting via the moved node's own text keeps this test correct even though
    // container A's now-empty placeholder coincidentally reuses MOVABLE_PATH's old string.
    const movedWrapper = canvas.getByText('Movable').closest('[data-node-path]')
    expect(movedWrapper).toHaveAttribute('data-node-path', serializeLayoutNodePath(EXPECTED_NEW_PATH))
    expect(movedWrapper?.className).toContain('outline-blue-500')
    expect(root.querySelectorAll('.outline-blue-500')).toHaveLength(1)
  })

  it('un intento de drop inválido sobre el nodo seleccionado deja la selección intacta', async () => {
    const FORM_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
    const CONTAINER_PATH: LayoutNodePath = [{ field: 'children', index: 1 }]
    const INPUT_A_PATH: LayoutNodePath = [...FORM_A_PATH, { field: 'children', index: 0 }]

    const { container: root, canvas, initialConfigText } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [form('formA', [inputNode('emailA')]), container([heading('Plain')])],
        },
      ],
    })

    fireEvent.click(canvas.getByLabelText('emailA'))
    const selectedBefore = root.querySelector('.outline-blue-500')?.getAttribute('data-node-path')
    expect(selectedBefore).toBe(serializeLayoutNodePath(INPUT_A_PATH))

    // Invalid structurally (input requires a form ancestor, the target container has none) —
    // isValidDropTarget (T13) rejects it before onCommitCanvasMutation is ever invoked, so
    // neither the tree nor the selection change.
    dragEnd(INPUT_A_PATH, { parentPath: CONTAINER_PATH, index: 1 })

    const selectedAfter = root.querySelector('.outline-blue-500')?.getAttribute('data-node-path')
    expect(selectedAfter).toBe(selectedBefore)

    const { text } = await getMonacoJson()
    expect(text).toBe(initialConfigText)
  })
})
