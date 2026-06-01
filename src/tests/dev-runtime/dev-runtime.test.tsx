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

describe('DevRuntime toggle and drawer', () => {
  it('renders the toggle button always visible', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.getByTestId('dev-runtime-toggle')).toBeInTheDocument()
  })

  it('opens the drawer when toggle is clicked', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    expect(screen.getByTestId('dev-runtime-drawer')).toHaveClass('translate-x-full')

    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))

    expect(screen.getByTestId('dev-runtime-drawer')).not.toHaveClass('translate-x-full')
  })

  it('closes the drawer when close button is clicked', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    fireEvent.click(screen.getByTestId('dev-runtime-close'))
    expect(screen.getByTestId('dev-runtime-drawer')).toHaveClass('translate-x-full')
  })

  it('preserves editor buffer when closing and reopening the drawer in the same session', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    // Open drawer
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    // Edit buffer
    const initialJson = JSON.stringify(secondConfig, null, 2)
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), { target: { value: initialJson } })

    // Close and reopen
    fireEvent.click(screen.getByTestId('dev-runtime-close'))
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))

    // Buffer should still have the edited value
    expect(screen.getByTestId('monaco-editor-mock')).toHaveValue(initialJson)
  })
})

describe('DevRuntime Apply', () => {
  it('re-renders the runtime with the new config after a valid apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)

    expect(screen.getByText('Hello World')).toBeInTheDocument()

    // Open drawer and change content
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })

    // Apply
    fireEvent.click(screen.getByTestId('dev-runtime-apply'))

    await waitFor(() => {
      expect(screen.getByText('Updated Title')).toBeInTheDocument()
    })
    expect(screen.queryByText('Hello World')).not.toBeInTheDocument()
  })

  it('clears hasPendingChanges after a valid apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(secondConfig) },
    })

    expect(screen.getByTestId('dev-runtime-pending-indicator')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dev-runtime-apply'))

    await waitFor(() => {
      expect(screen.queryByTestId('dev-runtime-pending-indicator')).not.toBeInTheDocument()
    })
  })

  it('does not update runtime and shows error when JSON is syntactically invalid', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: '{invalid json' },
    })

    fireEvent.click(screen.getByTestId('dev-runtime-apply'))

    expect(screen.getByText('Hello World')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('dev-runtime-error-panel')).toBeInTheDocument()
    })
  })

  it('preserves the editor buffer text after a valid apply', async () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    const editedJson = JSON.stringify(secondConfig, null, 2)
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: editedJson },
    })

    fireEvent.click(screen.getByTestId('dev-runtime-apply'))

    await waitFor(() => {
      expect(screen.getByText('Updated Title')).toBeInTheDocument()
    })
    // Buffer is kept as-is after apply; re-serializing validation.config would
    // produce the normalized preload format and break a subsequent apply.
    expect(screen.getByTestId('monaco-editor-mock')).toHaveValue(editedJson)
  })

  it('does not update runtime and shows validation error code/message on structural invalid JSON', async () => {
    const invalidConfig = { api: {}, pages: [], initialPage: 'missing-page' }
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: JSON.stringify(invalidConfig) },
    })

    fireEvent.click(screen.getByTestId('dev-runtime-apply'))

    expect(screen.getByText('Hello World')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('dev-runtime-error-panel')).toBeInTheDocument()
    })
    // Should show the canonical error code/message from validateRuntimeConfig
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
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    const editedJson = '{"custom": true}'
    fireEvent.change(screen.getByTestId('monaco-editor-mock'), {
      target: { value: editedJson },
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-runtime-copy'))
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
    fireEvent.click(screen.getByTestId('dev-runtime-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-runtime-copy'))
    })

    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})

describe('DevRuntime no-regression', () => {
  it('renders the runtime content identically to the plain runtime when drawer is closed', () => {
    render(<DevRuntime rootElement={makeRootElement(minimalConfig)} />)
    // Editor is closed by default
    expect(screen.getByTestId('dev-runtime-drawer')).toHaveClass('translate-x-full')
    // Runtime renders the same content
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
