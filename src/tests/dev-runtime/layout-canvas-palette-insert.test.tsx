import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LayoutNode, LayoutNodeType } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { FORM_ONLY_LEAF_NODE_TYPES } from '../../config/layout-placement-rules'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'
import { buildDefaultNodeInstance } from '../../dev-runtime/layout-canvas/layout-canvas-node-palette-defaults'
import { getSupportedNodeTypesCatalog } from '../../dev-runtime/layout-canvas/layout-canvas-node-schema'
import { serializePaletteDragId } from '../../dev-runtime/layout-canvas/layout-canvas-palette-drag-id'
import {
  serializeDropZoneId,
  serializeLayoutNodePath,
  type LayoutCanvasDropZone,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'

// Mock @monaco-editor/react with a controllable textarea, matching the pattern already
// established in layout-canvas-commit.test.tsx / layout-canvas-reorder-reinsert.test.tsx: the
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

// Light mock of @dnd-kit/core (see layout-canvas-dnd-wiring.test.tsx / T12): real pointer
// simulation against PointerSensor is impractical in jsdom, so DndContext is replaced with a
// pass-through that captures the onDragEnd handler LayoutCanvasDndContext registers, letting
// tests invoke it directly with synthetic {active, over} pairs. useDraggable/useDroppable keep
// their real implementation, so the palette entries' own id-construction path is exercised too.
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

function link(children: unknown[]) {
  return { type: 'link', props: { href: '#' }, children }
}

function buildReadyProps(rawConfig: unknown) {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

// DevRuntimeReady (0103, T8) edits the real `<RuntimePage />` in place — there is no separate
// canvas preview anymore. Switching to Editor mode from the floating toolbar activates the
// LayoutEditModeProvider/LayoutCanvasDndContext wiring on that same tree, and the palette (T6)
// is opened explicitly from the toolbar's "Añadir elemento" control.
function renderCanvas(rawConfig: unknown) {
  const { initialConfig, initialConfigText } = buildReadyProps(rawConfig)
  const view = render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
  const canvas = within(screen.getByTestId('runtime-page'))
  return { initialConfigText, container: view.container, canvas }
}

function paletteDragEnd(type: LayoutNodeType, overZone: LayoutCanvasDropZone | null) {
  expect(capturedOnDragEnd).not.toBeNull()
  act(() => {
    capturedOnDragEnd!({
      active: { id: serializePaletteDragId(type) },
      over: overZone === null ? null : { id: serializeDropZoneId(overZone) },
    })
  })
}

async function getMonacoJson(): Promise<{ text: string; parsed: Record<string, unknown> }> {
  if (screen.queryByTestId('monaco-editor-mock') === null) {
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
  }
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  const text = (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
  return { text, parsed: JSON.parse(text) }
}

describe('buildDefaultNodeInstance: every catalog type is validly insertable (FR8)', () => {
  const nodeTypes = getSupportedNodeTypesCatalog()

  it.each(nodeTypes)('type "%s" passes validateRuntimeConfig once inserted into a minimal compatible layout', (type) => {
    const node = buildDefaultNodeInstance(type)
    // Form-only leaf types (input/textarea/select/radioGroup/checkboxGroup/fileInput/toggle/
    // hidden) only make sense as descendants of a form — every other catalog type is inserted
    // directly at the page root, matching how the palette drop-validity engine (T13/T15) would
    // actually allow it to land.
    const layout: LayoutNode[] = FORM_ONLY_LEAF_NODE_TYPES.has(type)
      ? [{ type: 'form', id: 'hostForm', children: [node] } as LayoutNode]
      : [node]

    const config = {
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout }],
    }

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('never bakes a dynamic reference (queries.*/forms.*/{{...}}) into a form field default value', () => {
    for (const type of nodeTypes) {
      const node = buildDefaultNodeInstance(type) as { props?: { defaultValue?: unknown } }
      if (node.props && 'defaultValue' in node.props) {
        expect(node.props.defaultValue).toBeUndefined()
      }
    }
  })
})

describe('items: [] por defecto para select/radioGroup/checkboxGroup (T3, RF10)', () => {
  it.each(['select', 'radioGroup', 'checkboxGroup'] as const)(
    'buildDefaultNodeInstance("%s") produce props.items estrictamente igual a []',
    (type) => {
      const node = buildDefaultNodeInstance(type) as { props: { items: unknown } }
      expect(node.props.items).toEqual([])
    },
  )

  it.each(['select', 'radioGroup', 'checkboxGroup'] as const)(
    'arrastrar %s desde la paleta hasta dentro de un form existente lo inserta con props.items estrictamente igual a []',
    async (type) => {
      renderCanvas({
        api: {},
        initialPage: 'home',
        pages: [{ id: 'home', layout: [form('formA', [])] }],
      })

      paletteDragEnd(type, { parentPath: [{ field: 'children', index: 0 }], index: 0 })

      const { parsed } = await getMonacoJson()
      const formNode = (
        parsed.pages as Array<{ layout: Array<{ children: Array<{ type: string; props: { items: unknown } }> }> }>
      )[0].layout[0]

      expect(formNode.children).toHaveLength(1)
      expect(formNode.children[0].type).toBe(type)
      expect(formNode.children[0].props.items).toEqual([])
      expect(validateRuntimeConfig(parsed).status).toBe('ready')
    },
  )
})

describe('LayoutCanvasNodePalette: lists the full catalog (FR8)', () => {
  it('renders a draggable entry for every supported node type, always visible without a selection', () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [heading('Existing')] }],
    })

    expect(screen.getByTestId('layout-canvas-node-palette')).toBeInTheDocument()
    expect(screen.queryByTestId('layout-canvas-properties-panel')).not.toBeInTheDocument()

    for (const type of getSupportedNodeTypesCatalog()) {
      expect(screen.getByTestId(`layout-canvas-palette-item-${type}`)).toBeInTheDocument()
    }
  })
})

describe('drag insert desde la paleta (FR8)', () => {
  it('arrastrar container desde la paleta hasta el layout raíz lo inserta vacío, con su placeholder (T10) visible', async () => {
    const { container: root } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [heading('Existing')] }],
    })

    paletteDragEnd('container', { parentPath: [], index: 1 })

    // Checked before switching to the JSON tab: DevRuntimeDrawer only mounts one of
    // `visualContent`/`children` at a time (see dev-runtime-drawer.tsx), so the canvas DOM —
    // and the placeholder inside it — is gone once the JSON tab takes over.
    const insertedContainerPath: LayoutNodePath = [{ field: 'children', index: 1 }]
    const placeholderPath = serializeLayoutNodePath([...insertedContainerPath, { field: 'children', index: 0 }])
    expect(root.querySelector(`[data-empty-placeholder="true"][data-node-path="${placeholderPath}"]`)).not.toBeNull()

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ type: string }> }>)[0]

    expect(page.layout).toHaveLength(2)
    expect(page.layout[1].type).toBe('container')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('arrastrar input desde la paleta hasta un destino sin form ancestro no inserta nada (destino inválido)', async () => {
    const { initialConfigText } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [container([heading('Plain')])] }],
    })

    paletteDragEnd('input', { parentPath: [{ field: 'children', index: 0 }], index: 0 })

    const { text } = await getMonacoJson()
    expect(text).toBe(initialConfigText)
  })

  it('arrastrar input desde la paleta hasta dentro de un form existente lo inserta con un fieldId que no colisiona', async () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [form('formA', [inputNode('existingField')])] }],
    })

    paletteDragEnd('input', { parentPath: [{ field: 'children', index: 0 }], index: 1 })

    const { parsed } = await getMonacoJson()
    const formNode = (
      parsed.pages as Array<{ layout: Array<{ children: Array<{ props: { fieldId: string } }> }> }>
    )[0].layout[0]

    expect(formNode.children).toHaveLength(2)
    const fieldIds = formNode.children.map((child) => child.props.fieldId)
    expect(new Set(fieldIds).size).toBe(2)
    expect(fieldIds).toContain('existingField')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('arrastrar heading desde la paleta a la zona intermedia index 1 de un container grid con 3 hijos lo inserta con los defaults del catálogo (feature 0106 / RF2)', async () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              props: { columns: 3 },
              children: [heading('A'), heading('B'), heading('C')],
            },
          ],
        },
      ],
    })

    const gridContainerPath: LayoutNodePath = [{ field: 'children', index: 0 }]
    paletteDragEnd('heading', { parentPath: gridContainerPath, index: 1 })

    const { parsed } = await getMonacoJson()
    const container = (parsed.pages as Array<{ layout: Array<{ children: Array<{ type: string; props: { text: string } }> }> }>)[0].layout[0]

    expect(container.children).toHaveLength(4)
    expect(container.children.map((child) => child.type)).toEqual(['heading', 'heading', 'heading', 'heading'])
    const insertedTextsInOrder = container.children.map((child) => child.props.text)
    expect(insertedTextsInOrder[0]).toBe('A')
    expect(insertedTextsInOrder[2]).toBe('B')
    expect(insertedTextsInOrder[3]).toBe('C')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  // 0126-T3 restriction: confirm `link` is a valid palette-drop destination end-to-end, not just
  // by analogy with `container`/`form` above — a `link` already in "Elementos anidados" mode
  // (`children: []`, reachable from the properties panel's content-mode widget once T1's
  // validation relaxation is in place) must accept a drag-inserted child the same way.
  it('arrastrar heading desde la paleta hasta un link en modo "Elementos anidados" lo inserta dentro de children', async () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [link([])] }],
    })

    paletteDragEnd('heading', { parentPath: [{ field: 'children', index: 0 }], index: 0 })

    const { parsed } = await getMonacoJson()
    const linkNode = (parsed.pages as Array<{ layout: Array<{ type: string; children: Array<{ type: string }> }> }>)[0].layout[0]

    expect(linkNode.type).toBe('link')
    expect(linkNode.children).toHaveLength(1)
    expect(linkNode.children[0].type).toBe('heading')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('un drop de paleta con destino inválido no cambia el árbol renderizado', () => {
    const { container: root } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [container([heading('Plain')])] }],
    })

    const beforeNodePaths = Array.from(root.querySelectorAll('[data-node-path]')).map((el) =>
      el.getAttribute('data-node-path'),
    )

    paletteDragEnd('input', { parentPath: [{ field: 'children', index: 0 }], index: 0 })

    const afterNodePaths = Array.from(root.querySelectorAll('[data-node-path]')).map((el) =>
      el.getAttribute('data-node-path'),
    )
    expect(afterNodePaths).toEqual(beforeNodePaths)
  })
})
