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

import { DevRuntime } from '../../dev-runtime/dev-runtime'

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

function makeRootElement(config?: object): HTMLDivElement {
  const el = document.createElement('div')
  if (config) {
    el.dataset.config = JSON.stringify(config)
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

async function getMonacoValue(): Promise<string> {
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  return (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
}

beforeEach(() => {
  vi.clearAllMocks()
})

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
