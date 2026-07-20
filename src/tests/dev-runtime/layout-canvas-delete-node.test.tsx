import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'

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
})
