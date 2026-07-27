import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider, useRuntimeStateActions } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { useEffect } from 'react'

// jsdom does not implement URL.createObjectURL / revokeObjectURL — install stubs
// so vi.spyOn can wrap them in individual tests.
URL.createObjectURL = vi.fn()
URL.revokeObjectURL = vi.fn()

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  vi.restoreAllMocks()
  URL.createObjectURL = vi.fn()
  URL.revokeObjectURL = vi.fn()
})

// --- Helpers ---

function renderRuntimePage(page: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: page.id,
    pages: [page],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithState(page: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: page.id,
    pages: [page],
  }

  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: state,
        state,
        dispatch,
        dispatchAndSyncState,
        getLatestState: () => state,
      }}
    >
      <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
}

function makeFileInputPage(
  fileInputOverrides: Partial<RuntimePageConfig['layout'][0]> = {},
  containerColumns?: number,
): RuntimePageConfig {
  const fileInputNode = {
    type: 'fileInput' as const,
    props: { fieldId: 'attachments', label: 'Attachments' },
    ...fileInputOverrides,
  }

  return {
    id: 'home',
    layout: containerColumns
      ? [
          {
            type: 'container' as const,
            props: { columns: containerColumns },
            children: [
              {
                type: 'form' as const,
                id: 'testForm',
                children: [fileInputNode],
              },
            ],
          },
        ]
      : [
          {
            type: 'form' as const,
            id: 'testForm',
            children: [fileInputNode],
          },
        ],
  }
}

function QueryStateFixture({ queryName }: { queryName: string }) {
  const { initializeQuery, setQueryLoading } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery(queryName)
    setQueryLoading(queryName)
  }, [initializeQuery, setQueryLoading, queryName])

  return null
}

// --- Tests ---

describe('FileInputNode — render attributes', () => {
  it('renders data-layout-node="fileInput" in the DOM', () => {
    const { container } = renderRuntimePage(makeFileInputPage())
    expect(container.querySelector('[data-layout-node="fileInput"]')).toBeInTheDocument()
  })

  it('renders a native <input type="file"> within the node', () => {
    const { container } = renderRuntimePage(makeFileInputPage())
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('associates the label text with the file input for accessibility', () => {
    renderRuntimePage(makeFileInputPage())
    expect(screen.getByLabelText('Attachments')).toBeInTheDocument()
  })

  it('adds the multiple attribute when props.multiple is true', () => {
    renderRuntimePage(makeFileInputPage({ props: { fieldId: 'f', label: 'Files', multiple: true } }))
    expect(screen.getByLabelText('Files')).toHaveAttribute('multiple')
  })

  it('omits the multiple attribute when props.multiple is false', () => {
    renderRuntimePage(makeFileInputPage({ props: { fieldId: 'f', label: 'File', multiple: false } }))
    expect(screen.getByLabelText('File')).not.toHaveAttribute('multiple')
  })

  it('defaults to multiple when props.multiple is absent', () => {
    renderRuntimePage(makeFileInputPage({ props: { fieldId: 'f', label: 'Files' } }))
    expect(screen.getByLabelText('Files')).toHaveAttribute('multiple')
  })

  it('propagates the capture attribute from props.capture', () => {
    renderRuntimePage(
      makeFileInputPage({ props: { fieldId: 'cam', label: 'Camera', capture: 'environment' } }),
    )
    expect(screen.getByLabelText('Camera')).toHaveAttribute('capture', 'environment')
  })

  it('serializes validations.accept as a comma-separated string in the accept attribute', () => {
    renderRuntimePage(
      makeFileInputPage({
        props: {
          fieldId: 'photos',
          label: 'Photos',
          validations: { accept: { value: ['image/jpeg', 'image/png'] } },
        },
      }),
    )
    expect(screen.getByLabelText('Photos')).toHaveAttribute('accept', 'image/jpeg,image/png')
  })

  it('omits the accept attribute when validations.accept is not declared', () => {
    renderRuntimePage(makeFileInputPage({ props: { fieldId: 'docs', label: 'Documents' } }))
    const input = screen.getByLabelText('Documents')
    expect(input).not.toHaveAttribute('accept')
  })
})

describe('FileInputNode — preview rendering', () => {
  it('renders a thumbnail img for an image file after selection', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')

    renderRuntimePage(makeFileInputPage({ props: { fieldId: 'images', label: 'Images' } }))

    const input = screen.getByLabelText('Images')
    const imageFile = new File(['data'], 'photo.png', { type: 'image/png' })

    Object.defineProperty(input, 'files', { configurable: true, value: [imageFile] })
    fireEvent.change(input)

    const img = screen.getByRole('img', { name: 'photo.png' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'blob:mock-url')
  })

  it('renders file name text without img for a non-image file', () => {
    renderRuntimePage(makeFileInputPage({ props: { fieldId: 'docs', label: 'Documents' } }))

    const input = screen.getByLabelText('Documents')
    const pdfFile = new File(['data'], 'report.pdf', { type: 'application/pdf' })

    Object.defineProperty(input, 'files', { configurable: true, value: [pdfFile] })
    fireEvent.change(input)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
  })
})

describe('FileInputNode — maxFiles limit', () => {
  it('shows the limit-reached message and disables the input when maxFiles is reached', () => {
    renderRuntimePage(
      makeFileInputPage({
        props: {
          fieldId: 'limited',
          label: 'Limited',
          multiple: true,
          validations: { maxFiles: { value: 1 } },
        },
      }),
    )

    const input = screen.getByLabelText('Limited')
    expect(input).not.toBeDisabled()

    const file = new File(['data'], 'a.pdf', { type: 'application/pdf' })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    fireEvent.change(input)

    expect(screen.getByLabelText('Limited')).toBeDisabled()
    expect(screen.getByText(/límite de ficheros alcanzado/i)).toBeInTheDocument()
  })
})

describe('FileInputNode — transversal fields', () => {
  it('hides the node completely when visibility evaluates to false', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'hiddenForm',
              children: [
                {
                  type: 'fileInput',
                  visibility: {
                    reference: 'forms.hiddenForm.name.value',
                    operator: 'equals',
                    value: 'show',
                  },
                  props: { fieldId: 'photos', label: 'Hidden Photos' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.queryByLabelText('Hidden Photos')).not.toBeInTheDocument()
  })

  it('replaces the node with the fallback when queryStateFeedback loading state is active', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'feedbackForm',
              children: [
                {
                  type: 'fileInput',
                  queryStateFeedback: {
                    query: 'uploadQuery',
                    states: {
                      loading: {
                        mode: 'fallback',
                        fallback: [
                          {
                            type: 'paragraph',
                            props: { text: 'Cargando...' },
                          },
                        ],
                      },
                    },
                  },
                  props: { fieldId: 'photos', label: 'Photos' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <QueryStateFixture queryName="uploadQuery" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByLabelText('Photos')).not.toBeInTheDocument()
      expect(screen.getByText('Cargando...')).toBeInTheDocument()
    })
  })

  it('applies the layout.span class when inside a grid container', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 4 },
          children: [
            {
              type: 'form',
              id: 'spanForm',
              layout: { span: 2 },
              children: [
                {
                  type: 'fileInput',
                  props: { fieldId: 'docs', label: 'Span Docs' },
                },
              ],
            },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)

    // The form wrapper (which holds the span) should have col-span-2
    const formWrapper = container.querySelector('[data-layout-node="form"]')
    expect(formWrapper?.parentElement).toHaveClass('col-span-2')
  })
})
