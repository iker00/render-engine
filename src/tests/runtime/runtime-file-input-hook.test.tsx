import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileInputLayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState } from '../../runtime/runtime-state/use-runtime-state'
import { FormContextProvider } from '../../runtime/form-context'
import { FileInputNode } from '../../runtime/nodes/file-input-layout-node'

// jsdom does not implement URL.createObjectURL or URL.revokeObjectURL — install stubs
// so vi.spyOn can wrap them in individual tests.
URL.createObjectURL = vi.fn()
URL.revokeObjectURL = vi.fn()

afterEach(() => {
  vi.restoreAllMocks()
  // Restore stubs to identity functions after each test so they never carry over state
  URL.createObjectURL = vi.fn()
  URL.revokeObjectURL = vi.fn()
})

function makeFile(name: string, type: string, sizeBytes = 100): File {
  return new File(['x'.repeat(sizeBytes)], name, { type })
}

const minimalConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

function StateReader({ formId, fieldId }: { formId: string; fieldId: string }) {
  const state = useRuntimeState()
  const fieldState = state.forms[formId]?.[fieldId]
  const files = Array.isArray(fieldState?.value) ? (fieldState.value as File[]) : []
  return (
    <>
      <span data-testid="file-count">{files.length}</span>
      <span data-testid="field-error">{fieldState?.error ?? ''}</span>
    </>
  )
}

function renderFileInput(node: FileInputLayoutNode) {
  return render(
    <RuntimeStateProvider config={minimalConfig}>
      <StateReader formId="testForm" fieldId={node.props.fieldId} />
      <FormContextProvider value={{ formId: 'testForm' }}>
        <FileInputNode node={node} />
      </FormContextProvider>
    </RuntimeStateProvider>,
  )
}

function simulateFileSelection(input: HTMLElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  })
  fireEvent.change(input)
}

describe('FileInputNode — file selection behavior', () => {
  it('updates store value with accepted files when valid files are selected', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'attachments', label: 'Attachments' },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Attachments')
    const file1 = makeFile('doc1.pdf', 'application/pdf')
    const file2 = makeFile('doc2.pdf', 'application/pdf')

    simulateFileSelection(input, [file1, file2])

    expect(screen.getByTestId('file-count')).toHaveTextContent('2')
    expect(screen.getByTestId('field-error')).toHaveTextContent('')
  })

  it('clears previous error when valid files are selected after a rejection', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: {
        fieldId: 'photos',
        label: 'Photos',
        validations: {
          accept: { value: ['image/jpeg'] },
        },
      },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Photos')

    // First: invalid file → error set
    simulateFileSelection(input, [makeFile('doc.pdf', 'application/pdf')])
    expect(screen.getByTestId('field-error')).not.toHaveTextContent('')

    // Then: valid file → error cleared
    simulateFileSelection(input, [makeFile('photo.jpg', 'image/jpeg')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('1')
    expect(screen.getByTestId('field-error')).toHaveTextContent('')
  })

  it('sets error message in store when a file is rejected due to accept mismatch', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: {
        fieldId: 'photos',
        label: 'Photos',
        validations: {
          accept: { value: ['image/jpeg', 'image/png'] },
        },
      },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Photos')
    simulateFileSelection(input, [makeFile('report.pdf', 'application/pdf')])

    expect(screen.getByTestId('file-count')).toHaveTextContent('0')
    expect(screen.getByTestId('field-error')).not.toHaveTextContent('')
  })

  it('sets error message when a file exceeds maxFileSize', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: {
        fieldId: 'docs',
        label: 'Documents',
        validations: {
          maxFileSize: { value: 0.0001 }, // 0.0001 MB = ~100 bytes — files of 100 bytes will exceed this
        },
      },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Documents')
    const bigFile = makeFile('big.pdf', 'application/pdf', 200)

    simulateFileSelection(input, [bigFile])

    expect(screen.getByTestId('file-count')).toHaveTextContent('0')
    expect(screen.getByTestId('field-error')).not.toHaveTextContent('')
  })

  it('replaces value when multiple: false and a second file is selected', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'single', label: 'Single', multiple: false },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Single')

    simulateFileSelection(input, [makeFile('first.pdf', 'application/pdf')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('1')

    simulateFileSelection(input, [makeFile('second.pdf', 'application/pdf')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('1')
  })

  it('concatenates files when multiple: true and files are selected sequentially', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'multi', label: 'Multi', multiple: true },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Multi')

    simulateFileSelection(input, [makeFile('first.pdf', 'application/pdf')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('1')

    simulateFileSelection(input, [makeFile('second.pdf', 'application/pdf')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('2')
  })

  it('removes the file from store value when delete button is clicked', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'docs', label: 'Documents' },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Documents')
    simulateFileSelection(input, [makeFile('doc.pdf', 'application/pdf')])

    expect(screen.getByTestId('file-count')).toHaveTextContent('1')

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(screen.getByTestId('file-count')).toHaveTextContent('0')
  })

  it('revokes object URL for an image when that file is removed', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')

    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'images', label: 'Images' },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Images')
    simulateFileSelection(input, [makeFile('photo.png', 'image/png')])

    expect(screen.getByRole('img', { name: 'photo.png' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('revokes all pending object URLs when the component unmounts', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')

    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'images', label: 'Images' },
    }

    const { unmount } = renderFileInput(node)

    const input = screen.getByLabelText('Images')
    simulateFileSelection(input, [makeFile('photo.png', 'image/png')])

    unmount()

    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('rejects a file with 0 bytes and sets an error message', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'docs', label: 'Documents' },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Documents')
    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' })

    simulateFileSelection(input, [emptyFile])

    expect(screen.getByTestId('file-count')).toHaveTextContent('0')
    expect(screen.getByTestId('field-error')).not.toHaveTextContent('')
  })

  it('rejects a file whose name duplicates one already in the value', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'docs', label: 'Documents', multiple: true },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Documents')

    simulateFileSelection(input, [makeFile('duplicate.pdf', 'application/pdf')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('1')

    simulateFileSelection(input, [makeFile('duplicate.pdf', 'application/pdf')])
    expect(screen.getByTestId('file-count')).toHaveTextContent('1')
    expect(screen.getByTestId('field-error')).not.toHaveTextContent('')
  })

  it('disables the input when maxFiles is reached and re-enables when a file is removed', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: {
        fieldId: 'limited',
        label: 'Limited',
        multiple: true,
        validations: { maxFiles: { value: 1 } },
      },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Limited')
    expect(input).not.toBeDisabled()

    simulateFileSelection(input, [makeFile('a.pdf', 'application/pdf')])

    // Re-query after state update
    expect(screen.getByLabelText('Limited')).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }))

    expect(screen.getByLabelText('Limited')).not.toBeDisabled()
  })
})

describe('FileInputNode — preview rendering', () => {
  it('renders a thumbnail img for an image file', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')

    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'images', label: 'Images' },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Images')
    simulateFileSelection(input, [makeFile('photo.png', 'image/png')])

    const img = screen.getByRole('img', { name: 'photo.png' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'blob:mock-url')
  })

  it('renders file name text (no img element) for a non-image file', () => {
    const node: FileInputLayoutNode = {
      type: 'fileInput',
      props: { fieldId: 'docs', label: 'Documents' },
    }

    renderFileInput(node)

    const input = screen.getByLabelText('Documents')
    simulateFileSelection(input, [makeFile('report.pdf', 'application/pdf')])

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
  })
})
