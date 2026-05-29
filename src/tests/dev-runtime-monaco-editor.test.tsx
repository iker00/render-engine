import { render, act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock @monaco-editor/react before importing the component
vi.mock('@monaco-editor/react', () => {
  return {
    default: vi.fn(({ value, onChange, onMount }) => {
      // Simulate onMount with a fake monaco instance
      const fakeEditor = { getValue: () => value }
      if (onMount) {
        onMount(fakeEditor, { languages: { json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } } } })
      }
      return (
        <textarea
          data-testid="monaco-editor-mock"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )
    }),
  }
})

import { DevRuntimeMonacoEditor } from '../dev-runtime/dev-runtime-monaco-editor'

describe('DevRuntimeMonacoEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls onMount with the editor instance when mounted', async () => {
    const onMount = vi.fn()
    render(<DevRuntimeMonacoEditor value="{}" onChange={() => {}} onMount={onMount} />)

    await act(async () => {})
    expect(onMount).toHaveBeenCalled()
  })

  it('calls onChange when the mock editor simulates editing', async () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <DevRuntimeMonacoEditor value="{}" onChange={onChange} onMount={() => {}} />,
    )

    await act(async () => {})
    const textarea = getByTestId('monaco-editor-mock') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{"key": 1}' } })
    expect(onChange).toHaveBeenCalledWith('{"key": 1}')
  })

  it('does not throw when monaco.languages.json is unavailable', async () => {
    const { default: MonacoEditorMock } = await import('@monaco-editor/react')
    vi.mocked(MonacoEditorMock).mockImplementationOnce(({ value, onMount }) => {
      if (onMount) {
        // Pass a mock without json support
        onMount({ getValue: () => value }, {} as never)
      }
      return <div data-testid="monaco-no-json" />
    })

    expect(() => {
      render(<DevRuntimeMonacoEditor value="{}" onChange={() => {}} onMount={() => {}} />)
    }).not.toThrow()
  })
})
