import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LayoutNodeType } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
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

// Same mocks as layout-canvas-palette-insert.test.tsx: a controllable Monaco textarea and a
// pass-through DndContext that captures onDragEnd for direct invocation (see that file's own
// comments for the rationale — real PointerSensor simulation is impractical in jsdom).
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

function buildReadyProps(rawConfig: unknown) {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

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

describe('buildDefaultNodeInstance("group") (T15)', () => {
  it('produces a placeholder instance with an empty groupId and an empty params map', () => {
    expect(buildDefaultNodeInstance('group')).toEqual({ type: 'group', props: { groupId: '', params: {} } })
  })

  it('is now listed by getSupportedNodeTypesCatalog() (unlike "slot", which stays excluded)', () => {
    const catalog = getSupportedNodeTypesCatalog()
    expect(catalog).toContain('group')
    expect(catalog).not.toContain('slot')
  })
})

describe('LayoutCanvasNodePalette: exposes a draggable "group" entry', () => {
  it('renders the group palette entry alongside every other supported node type', () => {
    renderCanvas({ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] })

    expect(screen.getByTestId('layout-canvas-palette-item-group')).toBeInTheDocument()
  })
})

describe('drag insert de group desde la paleta (FR8, T15)', () => {
  it('arrastrar group hasta el layout raíz lo inserta con groupId vacío y params: {}, y el config completo sigue siendo válido', async () => {
    renderCanvas({ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] })

    paletteDragEnd('group', { parentPath: [], index: 0 })

    const { parsed } = await getMonacoJson()
    const page = (parsed.pages as Array<{ layout: Array<{ type: string; props: { groupId: string; params: unknown } }> }>)[0]

    expect(page.layout).toHaveLength(1)
    expect(page.layout[0].type).toBe('group')
    expect(page.layout[0].props.groupId).toBe('')
    expect(page.layout[0].props.params).toEqual({})
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })

  it('el nodo group recién insertado queda seleccionable en el canvas (sin selección previa a la espera de que el usuario elija un groupId)', async () => {
    const { container } = renderCanvas({ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] })

    paletteDragEnd('group', { parentPath: [], index: 0 })

    const insertedGroupPath: LayoutNodePath = [{ field: 'children', index: 0 }]
    const serializedPath = serializeLayoutNodePath(insertedGroupPath)
    await waitFor(() =>
      expect(container.querySelector(`[data-node-path="${serializedPath}"]`)).not.toBeNull(),
    )
  })

  it('arrastrar group hasta un container ya existente lo inserta como hijo, junto a otros nodos', async () => {
    renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [{ type: 'container', children: [{ type: 'heading', props: { text: 'A', level: 2 } }] }] }],
    })

    const containerPath: LayoutNodePath = [{ field: 'children', index: 0 }]
    paletteDragEnd('group', { parentPath: containerPath, index: 1 })

    const { parsed } = await getMonacoJson()
    const container = (parsed.pages as Array<{ layout: Array<{ children: Array<{ type: string }> }> }>)[0].layout[0]

    expect(container.children).toHaveLength(2)
    expect(container.children[1].type).toBe('group')
    expect(validateRuntimeConfig(parsed).status).toBe('ready')
  })
})
