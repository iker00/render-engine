import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock @monaco-editor/react with a controllable textarea
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
        onChange={(e) => (onChange as ((v: string) => void))?.(e.target.value)}
      />
    )
  }),
}))

// T2 (0129): every `heading` fixture in this file now mounts the real `IconPickerPropertyField`
// when selected in editor mode (its generated `props` schema always declares `icon`, regardless
// of whether a given fixture sets it — see `resolveIconPropsSchema`). Without this mock, selecting
// any node walks the real ~3900-icon `lucide-react` namespace and blows the global Vitest timeout
// (same failure mode documented in T1/T2's own suites). `OTHER_MODULE_ICON_NAMES` covers every
// other icon name imported anywhere in the `DevRuntime` render tree (floating toolbar, shell
// config panel, container-columns/tabs-orientation widgets) — ESM named imports resolve those
// bindings at module-load time regardless of which of them actually renders in a given test.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

import { DevRuntime } from '../../dev-runtime/dev-runtime'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import type { TranslationsConfigPanelProps } from '../../dev-runtime/translations-panel/translations-config-panel'
import { validateRuntimeConfig } from '../../config/runtime-config'

// 0131-T5: `saveConfigProvider` is instantiated once at module scope in `dev-runtime.tsx`
// (`createPlatagesSaveConfigProvider()`), same pattern as `translationsProvider` in
// `dev-editor-layer.tsx`. Mocked here so every save-pipeline test controls the outcome of
// `.save(...)` directly, without hitting `fetch`/`postToPlatages`.
const mockSaveConfig = vi.hoisted(() => vi.fn())

vi.mock('../../dev-runtime/endpoints-config/save-config-provider', () => ({
  createPlatagesSaveConfigProvider: () => ({ save: mockSaveConfig }),
}))

// 0131-T5: `DevEditorLayer` doesn't declare the new save-pipeline props yet (endpointsConfig,
// saveResolution/searchResolution/refreshResolution, saveState, saveError, handleSaveConfig) —
// that's T6's contract. This wraps the REAL component (same pattern as the
// `TranslationsConfigPanel` wrap below) purely to capture the full props object `DevRuntimeReady`
// passes down, so tests here can invoke `handleSaveConfig` directly (simulating a future "click"
// from the toolbar) and assert on the resolved props, without depending on T6's UI.
const devEditorLayerPropsRef = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

vi.mock('../../dev-runtime/floating-toolbar/dev-editor-layer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../dev-runtime/floating-toolbar/dev-editor-layer')>()
  return {
    DevEditorLayer: (props: Record<string, unknown>) => {
      devEditorLayerPropsRef.current = props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <actual.DevEditorLayer {...(props as any)} />
    },
  }
})

// `validateRuntimeConfig` is wrapped (not stubbed) so every existing test in this file keeps
// exercising the real validation pipeline unchanged; only 0130-T3's own "invalid commit" test
// below overrides a single call via `mockReturnValueOnce` to simulate a rejection that isn't
// otherwise reachable through the translations panel's own client-side guards (which already
// block the only locally-invalid shapes — blank/duplicate keys and language codes — before a
// commit is ever attempted).
vi.mock('../../config/runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/runtime-config')>()
  return { ...actual, validateRuntimeConfig: vi.fn(actual.validateRuntimeConfig) }
})

// 0130-T2 introduced this ref to capture the `onCommitTranslationsMutation` prop the panel
// receives, back when `TranslationsConfigPanel` was a read-only skeleton with no commit-triggering
// UI of its own (the only way to exercise `commitTranslationsMutation` end-to-end was to invoke
// the captured prop directly). 0130-T3 gives the panel real editing UI, so the mock below now
// renders the actual component (rather than `null`) while still capturing its props through this
// ref — existing tests that call `translationsPanelPropsRef.current!.onCommitTranslationsMutation`
// directly keep working unchanged, and newer tests can also interact with the real rendered panel.
// `vi.hoisted` (rather than a bare top-level `let`) is required here: `vi.mock` factories are
// hoisted above ordinary variable declarations, so referencing an out-of-scope binding that isn't
// itself hoisted throws at mock-setup time.
const translationsPanelPropsRef = vi.hoisted(() => ({ current: null as TranslationsConfigPanelProps | null }))

vi.mock('../../dev-runtime/translations-panel/translations-config-panel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../dev-runtime/translations-panel/translations-config-panel')>()
  return {
    TranslationsConfigPanel: (props: TranslationsConfigPanelProps) => {
      translationsPanelPropsRef.current = props
      return <actual.TranslationsConfigPanel {...props} />
    },
  }
})

const minimalConfig = {
  api: {},
  pages: [{ id: 'home', layout: [{ type: 'heading', props: { text: 'Hello World', level: 1 } }] }],
  initialPage: 'home',
}

const secondConfig = {
  api: {},
  pages: [{ id: 'home', layout: [{ type: 'heading', props: { text: 'Updated Title', level: 1 } }] }],
  initialPage: 'home',
}

// Carries a value on every root key `commitTranslationsMutation` must leave untouched, so a
// regression on any of them is observable in the patched raw text (0130-T2).
const configWithSiblingRootKeys = {
  api: {},
  pages: [{ id: 'home', layout: [{ type: 'heading', props: { text: 'Hello World', level: 1 } }] }],
  initialPage: 'home',
  tokens: { authToken: { value: 'abc123' } },
  shell: { header: { title: 'My App' } },
  preloads: [],
}

// 0131-T5 fixtures: an endpoints config that declares only `saveConfig` (so `searchTexts`/
// `getTranslationsBatch` resolve to 'operation-not-declared', irrelevant to this task) with a
// `tokenId` of `apiKey`, and a runtime config carrying a matching `tokens.apiKey` entry so
// `resolveEndpointOperation` resolves `saveConfig` to `status: 'ready'`.
const endpointsConfigWithSave = {
  baseUrl: 'https://example.test',
  operations: {
    saveConfig: {
      path: '/save',
      tokenId: 'apiKey',
      idGestion: 123,
      idSeccion: 55,
      idObjetoOcurrencia: 267,
    },
  },
}

const endpointsConfigWithoutSaveOperation = {
  baseUrl: 'https://example.test',
  operations: {},
}

const configWithApiKeyToken = {
  ...minimalConfig,
  tokens: { apiKey: { value: 'secret-token' } },
}

function makeRootElement(config?: object, options?: { endpointsConfig?: object }): HTMLDivElement {
  const el = document.createElement('div')
  if (config) {
    el.dataset.config = JSON.stringify(config)
  }
  if (options?.endpointsConfig !== undefined) {
    el.dataset.endpointsConfig = JSON.stringify(options.endpointsConfig)
  }
  return el
}

// Floating toolbar / Monaco panel helpers (T8, design.md 0103): the drawer and its toggle
// button no longer exist, the toolbar is always mounted and the Monaco panel is a `fixed`
// overlay toggled from it — see DevEditorFloatingToolbar / FloatingMonacoPanel testids.
function openMonaco() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
}

function switchToEditorMode() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
}

function switchToVisualMode() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-visual'))
}

beforeEach(() => {
  vi.clearAllMocks()
  translationsPanelPropsRef.current = null
  devEditorLayerPropsRef.current = null
})

function switchToTranslationsDomain() {
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-translations'))
}

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('DevRuntime bootstrap', () => {
  it('loads currentConfig from data-config when present', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('shows bootstrap error when data-config contains invalid JSON', () => {
    const el = document.createElement('div')
    el.dataset.config = '{invalid-json'
    render(<DevRuntime rootElement={el} />)
    expect(screen.getByTestId('runtime-error-message')).toBeInTheDocument()
  })

  it('shows bootstrap error when config fails validation', () => {
    const invalidConfig = { api: {}, pages: [], initialPage: 'missing' }
    render(<DevRuntime rootElement={makeRootElement(invalidConfig)} />)
    expect(screen.getByTestId('runtime-error-message')).toBeInTheDocument()
  })
})

describe('DevRuntime shell header mount (regression: 0122-T5 wired the panel but never mounted AppShellHeader)', () => {
  it('does not render AppShellHeader when config has no shell block', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })

  it('renders AppShellHeader from the initial config when shell.header is non-empty', () => {
    const configWithShell = {
      ...minimalConfig,
      shell: { header: { title: 'My App' } },
    }
    render(<DevRuntime rootElement={makeRootElement(configWithShell)} />)
    expect(screen.getByTestId('app-shell-header')).toBeInTheDocument()
    expect(screen.getByTestId('app-shell-header-title')).toHaveTextContent('My App')
  })
})

describe('DevRuntime shell sidebar mount (regression: 0123 wired the panel but never mounted AppShellSidebar)', () => {
  it('does not render AppShellSidebar when config has no shell block', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.queryByTestId('app-shell-sidebar')).not.toBeInTheDocument()
  })

  it('does not render AppShellSidebar when shell.sidebar.items is empty', () => {
    const configWithEmptySidebar = {
      ...minimalConfig,
      shell: { sidebar: { items: [] } },
    }
    render(<DevRuntime rootElement={makeRootElement(configWithEmptySidebar)} />)
    expect(screen.queryByTestId('app-shell-sidebar')).not.toBeInTheDocument()
  })

  it('renders AppShellSidebar from the initial config when shell.sidebar.items is non-empty', () => {
    const configWithSidebar = {
      ...minimalConfig,
      shell: {
        sidebar: {
          items: [{ label: 'Home', href: '/home' }],
        },
      },
    }
    render(<DevRuntime rootElement={makeRootElement(configWithSidebar)} />)
    expect(screen.getByTestId('app-shell-sidebar')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renders both AppShellHeader and AppShellSidebar together when both are configured', () => {
    const configWithBoth = {
      ...minimalConfig,
      shell: {
        header: { title: 'My App' },
        sidebar: { items: [{ label: 'Home', href: '/home' }] },
      },
    }
    render(<DevRuntime rootElement={makeRootElement(configWithBoth)} />)
    expect(screen.getByTestId('app-shell-header')).toBeInTheDocument()
    expect(screen.getByTestId('app-shell-sidebar')).toBeInTheDocument()
  })
})

// jsdom does not implement ResizeObserver — install a controllable stub that captures the
// registered callback so this describe block can drive a synthetic header resize deterministically
// (same pattern as `src/tests/app/app-shell-scroll-behavior.test.tsx` /
// `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx`).
describe('DevRuntime shell sidebar sticky positioning tracks the header height (0124-T4)', () => {
  type ResizeObserverEntryLike = { contentRect: { height: number } }
  type ResizeObserverCallbackLike = (entries: ResizeObserverEntryLike[]) => void
  let resizeObserverCallbacks: ResizeObserverCallbackLike[] = []

  class MockResizeObserver {
    callback: ResizeObserverCallbackLike
    constructor(callback: ResizeObserverCallbackLike) {
      this.callback = callback
      resizeObserverCallbacks.push(callback)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  beforeEach(() => {
    resizeObserverCallbacks = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is sticky/scrollable in "page" mode and exposes --shell-sidebar-sticky-top from a measured ResizeObserver entry', () => {
    const configWithBoth = {
      ...minimalConfig,
      shell: {
        header: { title: 'My App' },
        sidebar: { items: [{ label: 'Home', href: '/home' }] },
      },
    }
    render(<DevRuntime rootElement={makeRootElement(configWithBoth)} />)

    const sidebar = screen.getByTestId('app-shell-sidebar')
    expect(sidebar).toHaveClass(
      'sticky',
      'top-[var(--shell-sidebar-sticky-top)]',
      'h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]',
      'overflow-y-auto',
    )

    act(() => {
      resizeObserverCallbacks.forEach((callback) => callback([{ contentRect: { height: 40 } }]))
    })

    expect(sidebar).toHaveStyle('--shell-sidebar-sticky-top: 40px')
  })

  it('is not sticky and carries no style attribute in "fixed" mode', () => {
    const configWithBoth = {
      ...minimalConfig,
      shell: {
        scrollBehavior: 'fixed',
        header: { title: 'My App' },
        sidebar: { items: [{ label: 'Home', href: '/home' }] },
      },
    }
    render(<DevRuntime rootElement={makeRootElement(configWithBoth)} />)

    const sidebar = screen.getByTestId('app-shell-sidebar')
    expect(sidebar).not.toHaveClass('sticky')
    expect(sidebar).not.toHaveClass('top-[var(--shell-sidebar-sticky-top)]')
    expect(sidebar).not.toHaveClass('h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]')
    expect(sidebar).not.toHaveAttribute('style')
  })
})

describe('DevRuntime floating toolbar surface', () => {
  it('renders the floating toolbar always visible, in "visual" mode by default', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    const toolbar = screen.getByTestId('dev-editor-toolbar')
    expect(toolbar).toBeInTheDocument()
    expect(screen.getByTestId('dev-editor-toolbar-mode-visual')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('dev-editor-toolbar-mode-editor')).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not render DevRuntimeToggleButton (regression: legacy floating button retired)', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.queryByTestId('dev-runtime-toggle')).not.toBeInTheDocument()
  })

  it('does not render DevRuntimeDrawer (regression: legacy drawer retired)', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.queryByTestId('dev-runtime-drawer')).not.toBeInTheDocument()
  })

  it('does not open any panel on Ctrl+Shift+J (regression: legacy shortcut retired)', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    fireEvent.keyDown(document, { key: 'J', ctrlKey: true, shiftKey: true })

    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()
  })

  it('clicking the disabled "Api" domain tab produces no content change or navigation', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    const hashBefore = window.location.hash

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-api'))

    expect(screen.getByText('Hello World')).toBeInTheDocument()
    expect(window.location.hash).toBe(hashBefore)
  })
})

describe('DevRuntime Monaco panel (via toolbar)', () => {
  it('opens the Monaco panel when the toolbar control is clicked', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()

    openMonaco()

    expect(screen.getByTestId('dev-editor-floating-monaco')).toBeInTheDocument()
  })

  it('closes the Monaco panel when its own close button is clicked', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-close'))
    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()
  })

  it('closes the Monaco panel on Escape while open', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    expect(screen.getByTestId('dev-editor-floating-monaco')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()
  })

  it('Escape has no effect when the Monaco panel is closed (no other global shortcut remains)', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('preserves editor buffer when closing and reopening the panel in the same session', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    const initialJson = JSON.stringify(secondConfig, null, 2)
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), { target: { value: initialJson } })

    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-close'))
    openMonaco()

    expect(screen.getByTestId('monaco-editor-mock')).toHaveValue(initialJson)
  })
})

describe('DevRuntime Apply', () => {
  it('re-renders the runtime with the new config after a valid apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    expect(screen.getByText('Hello World')).toBeInTheDocument()

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })

    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    await waitFor(() => {
      expect(screen.getByText('Updated Title')).toBeInTheDocument()
    })
    expect(screen.queryByText('Hello World')).not.toBeInTheDocument()
  })

  it('clears hasPendingChanges after a valid apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })

    expect(screen.getByTestId('dev-editor-floating-monaco-pending-indicator')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    await waitFor(() => {
      expect(screen.queryByTestId('dev-editor-floating-monaco-pending-indicator')).not.toBeInTheDocument()
    })
  })

  it('does not update runtime and shows error when JSON is syntactically invalid', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: '{invalid json' },
    })

    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    expect(screen.getByText('Hello World')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('dev-editor-floating-monaco-error-panel')).toBeInTheDocument()
    })
  })

  it('preserves the editor buffer text after a valid apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    const editedJson = JSON.stringify(secondConfig, null, 2)
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: editedJson },
    })

    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    await waitFor(() => {
      expect(screen.getByText('Updated Title')).toBeInTheDocument()
    })
    expect(screen.getByTestId('monaco-editor-mock')).toHaveValue(editedJson)
  })

  it('does not update runtime and shows validation error code/message on structural invalid JSON', async () => {
    const invalidConfig = { api: {}, pages: [], initialPage: 'missing-page' }
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(invalidConfig) },
    })

    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    expect(screen.getByText('Hello World')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('dev-editor-floating-monaco-error-panel')).toBeInTheDocument()
    })
    expect(screen.getByText(/initial-page-not-found/)).toBeInTheDocument()
  })
})

describe('DevRuntime Copy', () => {
  it('copies the current editor buffer to clipboard when clipboard API is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    const editedJson = '{"custom":true}'
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: editedJson },
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-copy'))
    })

    expect(writeText).toHaveBeenCalledWith(editedJson)
  })

  it('falls back to execCommand when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand

    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-copy'))
    })

    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})

describe('DevRuntime no-regression', () => {
  it('renders the runtime content identically to the plain runtime when the Monaco panel is closed', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.queryByTestId('dev-editor-floating-monaco')).not.toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})

const listConfig = {
  api: {},
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.searchUsers.data',
              key: 'id',
            },
            template: [
              {
                type: 'paragraph',
                props: {
                  text: 'item.name',
                },
              },
            ],
          },
        },
      ],
    },
  ],
  initialPage: 'home',
}

describe('DevRuntime data-values pre-seeding', () => {
  it('pre-seeds queries from devDataValuesJson import when data-values attribute is absent', () => {
    vi.mock('../../dev/data-values.json', () => ({
      default: { searchUsers: [{ id: '1', name: 'Juan' }] },
    }))

    render(<DevRuntime rootElement={makeRootElement(listConfig)} />)

    expect(screen.getByText('Juan')).toBeInTheDocument()
  })

  it('shows bootstrap error when data-values attribute contains invalid JSON', () => {
    const el = document.createElement('div')
    el.dataset.config = JSON.stringify(minimalConfig)
    el.dataset.values = '{invalid-json'

    render(<DevRuntime rootElement={el} />)

    expect(screen.getByTestId('runtime-error-message')).toBeInTheDocument()
  })
})

describe('DevRuntime unsaved changes guard', () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>
  let removeEventSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addEventSpy = vi.spyOn(window, 'addEventListener')
    removeEventSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    addEventSpy.mockRestore()
    removeEventSpy.mockRestore()
  })

  function beforeunloadCalls() {
    return addEventSpy.mock.calls.filter(([type]) => type === 'beforeunload')
  }

  function removeBeforeunloadCalls() {
    return removeEventSpy.mock.calls.filter(([type]) => type === 'beforeunload')
  }

  it('does not register a beforeunload listener before any Apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    expect(beforeunloadCalls()).toHaveLength(0)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('registers beforeunload listener exactly once after the first successful Apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    await waitFor(() => expect(screen.getByText('Updated Title')).toBeInTheDocument())

    expect(beforeunloadCalls()).toHaveLength(1)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect((event as BeforeUnloadEvent).returnValue).not.toBe('')
  })

  it('does not register beforeunload listener after a failed Apply due to invalid JSON', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: '{invalid json' },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    expect(beforeunloadCalls()).toHaveLength(0)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('does not register beforeunload listener after a failed Apply due to validation error', async () => {
    const invalidConfig = { api: {}, pages: [], initialPage: 'missing-page' }
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(invalidConfig) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    expect(beforeunloadCalls()).toHaveLength(0)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('registers listener after a failed Apply followed by a successful Apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: '{invalid json' },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    expect(beforeunloadCalls()).toHaveLength(0)

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))

    await waitFor(() => expect(screen.getByText('Updated Title')).toBeInTheDocument())

    expect(beforeunloadCalls()).toHaveLength(1)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect((event as BeforeUnloadEvent).returnValue).not.toBe('')
  })

  it('does not register a duplicate listener after a second successful Apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))
    await waitFor(() => expect(screen.getByText('Updated Title')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(minimalConfig) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))
    await waitFor(() => expect(screen.getByText('Hello World')).toBeInTheDocument())

    expect(beforeunloadCalls()).toHaveLength(1)
  })

  it('removes the beforeunload listener on unmount after a successful Apply', async () => {
    const { unmount } = render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))
    await waitFor(() => expect(screen.getByText('Updated Title')).toBeInTheDocument())

    const registeredHandler = beforeunloadCalls()[0][1] as EventListenerOrEventListenerObject

    unmount()

    const removeCalls = removeBeforeunloadCalls()
    expect(removeCalls).toHaveLength(1)
    expect(removeCalls[0][1]).toBe(registeredHandler)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('does not call addEventListener or removeEventListener for beforeunload when unmounting without any Apply', () => {
    const { unmount } = render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    unmount()

    expect(beforeunloadCalls()).toHaveLength(0)
    expect(removeBeforeunloadCalls()).toHaveLength(0)
  })
})

// Feature 0103 (dev editor floating toolbar): end-to-end coverage that the in-place editor
// surface — mode toggle, page navigation, action suppression, node selection — works through
// the real DevRuntime tree, not a duplicated canvas.
const multiPageConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'link',
          props: { label: 'Go via link', action: { type: 'navigateTo', pageId: 'details' } },
        },
        {
          type: 'button',
          props: { label: 'Go via button', action: { type: 'navigateTo', pageId: 'details' } },
        },
        {
          type: 'form',
          id: 'f',
          children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
        },
        {
          type: 'accordion',
          id: 'acc-1',
          props: { label: 'Section one' },
          children: [{ type: 'paragraph', props: { text: 'Body content' } }],
        },
      ],
    },
    { id: 'details', layout: [{ type: 'heading', props: { text: 'Details Page', level: 1 } }] },
  ],
}

describe('DevRuntime / real navigation in visual mode (spec FR-baseline)', () => {
  it('a link with props.action.navigateTo navigates normally: hash changes and the target page renders', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)

    fireEvent.click(screen.getByRole('link', { name: 'Go via link' }))

    expect(screen.getByText('Details Page')).toBeInTheDocument()
    expect(window.location.hash).not.toBe('')
  })
})

describe('DevRuntime / editor mode suppresses declarative navigation and selects instead (T1 + T8)', () => {
  it('clicking a button with a navigateTo action does not navigate; the node is selected instead', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)
    switchToEditorMode()

    fireEvent.click(screen.getByRole('button', { name: 'Go via button' }))

    expect(screen.queryByText('Details Page')).not.toBeInTheDocument()
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()
  })
})

describe('DevRuntime / editor mode inertness and properties panel (T2 + T8)', () => {
  it('the form input is inert (fieldset[disabled] cascade) in editor mode', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)
    switchToEditorMode()

    expect(screen.getByLabelText('Name')).toBeDisabled()
  })

  it('editing a prop from the selection overlay panel commits and re-renders the real node', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)
    switchToEditorMode()

    fireEvent.click(screen.getByLabelText('Name'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('label', { exact: false }), { target: { value: 'Full name' } })

    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })
})

describe('DevRuntime / interactive nodes keep working in editor mode (spec FR11)', () => {
  it('an accordion still toggles aria-expanded when its header is clicked; children stay in the DOM', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)
    switchToEditorMode()

    const header = screen.getByRole('button', { name: 'Section one' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Body content')).toBeInTheDocument()

    fireEvent.click(header)

    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })
})

describe('DevRuntime / page navigation from the toolbar (spec FR2/FR15)', () => {
  it('navigates the runtime for real and clears any prior selection', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)
    switchToEditorMode()

    fireEvent.click(screen.getByLabelText('Name'))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('dev-editor-toolbar-page-select'), { target: { value: 'details' } })

    expect(screen.getByText('Details Page')).toBeInTheDocument()
    expect(window.location.hash).not.toBe('')
    expect(screen.queryByTestId('dev-editor-selection-overlay')).not.toBeInTheDocument()
  })
})

describe('DevRuntime / mode toggle keeps the toolbar in sync', () => {
  it('reflects the active mode on the toolbar pressed state after toggling back and forth', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)

    switchToEditorMode()
    expect(screen.getByTestId('dev-editor-toolbar-mode-editor')).toHaveAttribute('aria-pressed', 'true')

    switchToVisualMode()
    expect(screen.getByTestId('dev-editor-toolbar-mode-visual')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Go via link' })).toBeInTheDocument()
  })
})

describe('DevRuntime / properties panel surfaces rejected commits instead of discarding them (T9)', () => {
  it('switching a button action to executeOperation (which leaves operationName empty) shows the rejection banner, keeps the chosen variant visible, and leaves the rest of the page intact', () => {
    render(<DevRuntime rootElement={makeRootElement(multiPageConfig)} />)
    switchToEditorMode()

    fireEvent.click(screen.getByRole('button', { name: 'Go via button' }))
    expect(screen.getByTestId('dev-editor-selection-overlay')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'executeOperation' } })

    // handleCanvasNodeUpdate no longer discards commitCanvasMutation's result: the full config is
    // momentarily invalid (operationName === ''), so the commit is rejected, but the panel keeps
    // showing the user's own chosen variant instead of silently reverting to navigateTo.
    expect((screen.getByLabelText('action') as HTMLSelectElement).value).toBe('executeOperation')
    expect(screen.getByTestId('layout-canvas-properties-panel-props-error')).toBeInTheDocument()

    // currentConfig was never overwritten with the momentarily-invalid config (the validation gate
    // in commitCanvasMutation is untouched), so the rest of the page renders exactly as before.
    expect(screen.getByRole('link', { name: 'Go via link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Section one' })).toBeInTheDocument()
  })
})

// 0130-T2: `commitTranslationsMutation` end-to-end through DevRuntimeReady/DevEditorLayer.
// `ShellConfigPanel`'s equivalent pipeline (`commitShellMutation`) has no direct coverage in this
// file, so this is the first such pipeline test here rather than an extension of an existing one.
describe('DevRuntime / commitTranslationsMutation pipeline (0130-T2)', () => {
  it('applies a valid mutation: updates currentConfig (visible after switching back to Layout), the Monaco buffer, and touches no sibling root key', async () => {
    render(<DevRuntime rootElement={makeRootElement(configWithSiblingRootKeys)} />)
    switchToTranslationsDomain()

    expect(translationsPanelPropsRef.current).not.toBeNull()

    let result: CommitCanvasMutationResult | undefined
    act(() => {
      result = translationsPanelPropsRef.current!.onCommitTranslationsMutation(() => ({ hola: { es: 'Hola' } }))
    })
    expect(result).toEqual({ status: 'applied' })

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-layout'))
    expect(screen.getByText('Hello World')).toBeInTheDocument()

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
    const parsedBuffer = JSON.parse((screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value)

    expect(parsedBuffer.translations).toEqual({ hola: { es: 'Hola' } })
    // Regression: no sibling root key changed shape or value.
    expect(parsedBuffer.api).toEqual(configWithSiblingRootKeys.api)
    expect(parsedBuffer.initialPage).toBe(configWithSiblingRootKeys.initialPage)
    expect(parsedBuffer.pages).toEqual(configWithSiblingRootKeys.pages)
    expect(parsedBuffer.tokens).toEqual(configWithSiblingRootKeys.tokens)
    expect(parsedBuffer.shell).toEqual(configWithSiblingRootKeys.shell)
    expect(parsedBuffer.preloads).toEqual(configWithSiblingRootKeys.preloads)
  })

  it('rejects an invalid mutation (non-string translation value) without touching currentConfig or the Monaco buffer', async () => {
    render(<DevRuntime rootElement={makeRootElement(configWithSiblingRootKeys)} />)
    switchToTranslationsDomain()

    expect(translationsPanelPropsRef.current).not.toBeNull()

    let result: CommitCanvasMutationResult | undefined
    act(() => {
      result = translationsPanelPropsRef.current!.onCommitTranslationsMutation(
        () => ({ hola: { es: 42 as unknown as string } }),
      )
    })

    expect(result?.status).toBe('rejected')
    if (result?.status === 'rejected') {
      expect(result.error.code).toBe('invalid-layout')
    }

    // currentConfig was never overwritten: switching back to Layout still shows the original page.
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-layout'))
    expect(screen.getByText('Hello World')).toBeInTheDocument()

    // editorBuffer was never set by the rejected commit: it is still the pristine `null` state.
    // Opening Monaco for the first time seeds it lazily from `initialConfigText` (dev-runtime.tsx,
    // unrelated to the commit pipeline), so the buffer at this point is exactly the original raw
    // config text — no `translations` key, none of the sibling keys altered.
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
    const parsedBuffer = JSON.parse((screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value)
    expect(parsedBuffer).toEqual(configWithSiblingRootKeys)
    expect(parsedBuffer.translations).toBeUndefined()
  })
})

// 0130-T3: the manual editor's own real UI (add entry, add language, edit cell, delete) driving
// `commitTranslationsMutation` end-to-end. The full add/edit/delete/add-language/token-dropdown
// matrix is covered in isolation in `translations-config-panel.test.tsx`; this only confirms the
// real panel is wired into the real pipeline the same way `ShellConfigPanel` is.
describe('DevRuntime / TranslationsConfigPanel manual editor end-to-end (0130-T3)', () => {
  it('adds a manual entry with two languages from the real panel, reflected in currentConfig/Monaco buffer, leaving sibling root keys untouched', async () => {
    render(<DevRuntime rootElement={makeRootElement(configWithSiblingRootKeys)} />)
    switchToTranslationsDomain()

    // No translations yet, so no language column exists: add both language columns first, then
    // fill them in on the "Añadir entrada" form.
    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'es' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))
    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'eu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))

    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'hola' } })
    fireEvent.change(screen.getByLabelText('es'), { target: { value: 'Hola' } })
    fireEvent.change(screen.getByLabelText('eu'), { target: { value: 'Kaixo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-layout'))
    expect(screen.getByText('Hello World')).toBeInTheDocument()

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
    const parsedBuffer = JSON.parse((screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value)

    expect(parsedBuffer.translations).toEqual({ hola: { es: 'Hola', eu: 'Kaixo' } })
    // Regression: no sibling root key changed shape or value.
    expect(parsedBuffer.api).toEqual(configWithSiblingRootKeys.api)
    expect(parsedBuffer.initialPage).toBe(configWithSiblingRootKeys.initialPage)
    expect(parsedBuffer.pages).toEqual(configWithSiblingRootKeys.pages)
    expect(parsedBuffer.tokens).toEqual(configWithSiblingRootKeys.tokens)
    expect(parsedBuffer.shell).toEqual(configWithSiblingRootKeys.shell)
    expect(parsedBuffer.preloads).toEqual(configWithSiblingRootKeys.preloads)
  })

  it('shows the rejection alert without touching currentConfig or the Monaco buffer when the commit is invalid', async () => {
    render(<DevRuntime rootElement={makeRootElement(configWithSiblingRootKeys)} />)
    switchToTranslationsDomain()

    // Every shape the panel's own client-side guards let through is schema-valid, so a genuine
    // rejection is simulated the same way the task's own restrictions allow: override a single
    // `validateRuntimeConfig` call. Queued only now (after the initial bootstrap validation has
    // already run for real) so it lands on the commit triggered by "Añadir" below, not on mount.
    vi.mocked(validateRuntimeConfig).mockReturnValueOnce({
      status: 'error',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Simulated rejection' },
    })

    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-layout'))
    expect(screen.getByText('Hello World')).toBeInTheDocument()

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
    const parsedBuffer = JSON.parse((screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value)
    expect(parsedBuffer).toEqual(configWithSiblingRootKeys)
    expect(parsedBuffer.translations).toBeUndefined()
  })
})

// 0131-T5: the save-config pipeline (handleSaveConfig + the global Ctrl+S/Cmd+S listener) end to
// end through the real DevRuntime tree. `DevEditorLayer` is wrapped (not replaced) so these tests
// can invoke `handleSaveConfig` directly, simulating the future toolbar "Guardar" click that T6
// wires up, and can inspect the three endpoint resolutions/save state passed down to it.
describe('DevRuntime / save-config pipeline (0131-T5)', () => {
  it('reads endpointsConfig once at bootstrap and passes the three resolutions to DevEditorLayer', () => {
    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    expect(devEditorLayerPropsRef.current?.endpointsConfig).toEqual(endpointsConfigWithSave)
    expect(devEditorLayerPropsRef.current?.saveResolution).toEqual({
      status: 'ready',
      url: 'https://example.test/save',
      token: 'secret-token',
    })
    // Neither declared in `endpointsConfigWithSave.operations`, out of scope for this task but
    // observable here as a side effect of the shared useMemo (design.md D7).
    expect(devEditorLayerPropsRef.current?.searchResolution).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })
    expect(devEditorLayerPropsRef.current?.refreshResolution).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })
    expect(devEditorLayerPropsRef.current?.saveState).toBe('idle')
    expect(devEditorLayerPropsRef.current?.saveError).toBeNull()
  })

  it('sends the minified lastValidConfigText (not JSON.stringify(currentConfig)) with the three IDs from endpointsConfig.operations.saveConfig, transitioning loading -> success without touching currentConfig/editorBuffer', async () => {
    mockSaveConfig.mockResolvedValueOnce({ status: 'ok' })

    // dataset.config is deliberately pretty-printed to prove the sent JSON is minified
    // (no literal newlines) regardless of the source text's own formatting (design.md D5,
    // corrected: Guardar re-minifies lastValidConfigText, it does not reserialize the
    // normalized in-memory currentConfig — see the "preloads raw vs. normalized shape" test
    // below for the case where the two would actually diverge).
    const el = makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })
    const prettyConfigText = JSON.stringify(configWithApiKeyToken, null, 2)
    el.dataset.config = prettyConfigText

    render(<DevRuntime rootElement={el} />)

    expect(devEditorLayerPropsRef.current?.saveState).toBe('idle')

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })

    expect(devEditorLayerPropsRef.current?.saveState).toBe('loading')

    await waitFor(() => expect(devEditorLayerPropsRef.current?.saveState).toBe('success'))

    expect(mockSaveConfig).toHaveBeenCalledTimes(1)
    const sentArgs = mockSaveConfig.mock.calls[0][0]
    expect(sentArgs.url).toBe('https://example.test/save')
    expect(sentArgs.token).toBe('secret-token')
    expect(sentArgs.idGestion).toBe(123)
    expect(sentArgs.idSeccion).toBe(55)
    expect(sentArgs.idObjetoOcurrencia).toBe(267)
    expect(sentArgs.configJson).not.toContain('\n')
    expect(JSON.parse(sentArgs.configJson)).toEqual(configWithApiKeyToken)

    // currentConfig/editorBuffer untouched: the layout still renders unchanged, and opening
    // Monaco for the first time still lazily seeds from the original raw (pretty) text.
    expect(screen.getByText('Hello World')).toBeInTheDocument()
    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
    expect(screen.getByTestId('monaco-editor-mock')).toHaveValue(prettyConfigText)
  })

  it('regression: sends preloads in their raw config shape, not the normalized runtime shape (bug: JSON.stringify(currentConfig) previously sent { operationName, requestParams, when } instead of the raw { "opName": {...}, when })', async () => {
    mockSaveConfig.mockResolvedValueOnce({ status: 'ok' })

    // `pages[].preloads` accepts `when` (unlike root `preloads`, which rejects it — see
    // validate-preloads.ts). The raw shape keys the operation name directly (`{ "opName": {...} }`);
    // validateRuntimeConfig normalizes that in currentConfig to `{ operationName, requestParams }`.
    // Sending the normalized shape back out is not valid input the next time this document is
    // loaded (design.md D5, corrected).
    const configWithPagePreloads = {
      api: {
        obtenerFichaPersonaOrigen: { method: 'GET', endpoint: '/ficha' },
      },
      pages: [
        {
          id: 'home',
          layout: [{ type: 'heading', props: { text: 'Hello World', level: 1 } }],
          preloads: [
            {
              obtenerFichaPersonaOrigen: {},
              when: { reference: 'params.id_persona', operator: 'isTruthy' },
            },
          ],
        },
      ],
      initialPage: 'home',
      tokens: { apiKey: { value: 'secret-token' } },
    }

    render(
      <DevRuntime
        rootElement={makeRootElement(configWithPagePreloads, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    await waitFor(() => expect(mockSaveConfig).toHaveBeenCalledTimes(1))

    const sentConfig = JSON.parse(mockSaveConfig.mock.calls[0][0].configJson)
    expect(sentConfig.pages[0].preloads).toEqual([
      {
        obtenerFichaPersonaOrigen: {},
        when: { reference: 'params.id_persona', operator: 'isTruthy' },
      },
    ])
    // The normalized shape must NOT be what gets sent.
    expect(sentConfig.pages[0].preloads[0].operationName).toBeUndefined()
    expect(sentConfig.pages[0].preloads[0].requestParams).toBeUndefined()
  })

  it('transitions to error with saveError.kind "auth" on an auth failure, without touching currentConfig', async () => {
    mockSaveConfig.mockResolvedValueOnce({
      status: 'error',
      error: { kind: 'auth', message: 'La autenticación falló.' },
    })

    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })

    await waitFor(() => expect(devEditorLayerPropsRef.current?.saveState).toBe('error'))
    expect(devEditorLayerPropsRef.current?.saveError).toEqual({ kind: 'auth', message: 'La autenticación falló.' })
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('transitions to error with saveError.kind "integration" on an integration failure, without touching currentConfig', async () => {
    mockSaveConfig.mockResolvedValueOnce({
      status: 'error',
      error: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
    })

    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })

    await waitFor(() => expect(devEditorLayerPropsRef.current?.saveState).toBe('error'))
    expect(devEditorLayerPropsRef.current?.saveError).toEqual({
      kind: 'integration',
      message: 'No se pudo contactar con el proveedor externo.',
    })
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('does not send a second request when handleSaveConfig is invoked again while a save is already loading (click/prop double-invocation, FR7)', async () => {
    let resolveSave!: (value: { status: 'ok' }) => void
    mockSaveConfig.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )

    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    act(() => {
      devEditorLayerPropsRef.current!.handleSaveConfig()
    })
    expect(devEditorLayerPropsRef.current?.saveState).toBe('loading')

    act(() => {
      devEditorLayerPropsRef.current!.handleSaveConfig()
    })

    expect(mockSaveConfig).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSave({ status: 'ok' })
    })
  })

  it('does not send a second request on a second Ctrl+S while the first is still loading', async () => {
    let resolveSave!: (value: { status: 'ok' }) => void
    mockSaveConfig.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )

    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    fireEvent.keyDown(document, { key: 's', ctrlKey: true })

    expect(mockSaveConfig).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSave({ status: 'ok' })
    })
  })

  it('a second Ctrl+S after a valid Apply sends the newly applied currentConfig, not a stale one', async () => {
    mockSaveConfig.mockResolvedValue({ status: 'ok' })

    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    await waitFor(() => expect(mockSaveConfig).toHaveBeenCalledTimes(1))
    expect(JSON.parse(mockSaveConfig.mock.calls[0][0].configJson)).toEqual(configWithApiKeyToken)

    openMonaco()
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    const updatedConfig = { ...secondConfig, tokens: configWithApiKeyToken.tokens }
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), { target: { value: JSON.stringify(updatedConfig) } })
    fireEvent.click(screen.getByTestId('dev-editor-floating-monaco-apply'))
    await waitFor(() => expect(screen.getByText('Updated Title')).toBeInTheDocument())

    fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    await waitFor(() => expect(mockSaveConfig).toHaveBeenCalledTimes(2))
    expect(JSON.parse(mockSaveConfig.mock.calls[1][0].configJson)).toEqual(updatedConfig)
  })
})

describe('DevRuntime / Ctrl+S / Cmd+S global shortcut (0131-T5, design.md D6/D9)', () => {
  it('triggers the save pipeline and calls preventDefault with Ctrl+S', async () => {
    mockSaveConfig.mockResolvedValueOnce({ status: 'ok' })
    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(mockSaveConfig).toHaveBeenCalledTimes(1)

    // Waited out (not left fire-and-forget) so handleSaveConfig's post-await state update
    // (setSaveState('success')) settles here instead of leaking into the next test.
    await waitFor(() => expect(devEditorLayerPropsRef.current?.saveState).toBe('success'))
  })

  it('triggers the save pipeline and calls preventDefault with Cmd+S (metaKey)', async () => {
    mockSaveConfig.mockResolvedValueOnce({ status: 'ok' })
    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, cancelable: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(mockSaveConfig).toHaveBeenCalledTimes(1)

    await waitFor(() => expect(devEditorLayerPropsRef.current?.saveState).toBe('success'))
  })

  it('does nothing on a plain "s" keydown without Ctrl/Cmd', () => {
    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithSave })}
      />,
    )

    const event = new KeyboardEvent('keydown', { key: 's', cancelable: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(false)
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  it('still calls preventDefault but does not call the provider when saveConfig is not declared (operation-not-declared, FR5/FR9)', () => {
    render(
      <DevRuntime
        rootElement={makeRootElement(configWithApiKeyToken, { endpointsConfig: endpointsConfigWithoutSaveOperation })}
      />,
    )

    expect(devEditorLayerPropsRef.current?.saveResolution).toEqual({
      status: 'unavailable',
      reason: 'operation-not-declared',
    })

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })

  it('still calls preventDefault but does not call the provider when the token cannot be resolved (token-not-resolvable, FR5/FR9)', () => {
    // minimalConfig has no `tokens` block at all, so the `apiKey` tokenId declared by
    // `endpointsConfigWithSave.operations.saveConfig` cannot resolve — independent regression
    // from the `operation-not-declared` case above, covering the other FR5 cause.
    render(
      <DevRuntime rootElement={makeRootElement(minimalConfig, { endpointsConfig: endpointsConfigWithSave })} />,
    )

    expect(devEditorLayerPropsRef.current?.saveResolution).toEqual({
      status: 'unavailable',
      reason: 'token-not-resolvable',
    })

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(mockSaveConfig).not.toHaveBeenCalled()
  })
})
