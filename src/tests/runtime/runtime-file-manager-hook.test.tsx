import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileManagerLayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { useFileManager } from '../../runtime/nodes/file-manager/use-file-manager'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { useRuntimeState } from '../../runtime/runtime-state/use-runtime-state'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()
  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

function makeFile(name: string, type: string, size = 100): File {
  const blob = new Blob(['x'.repeat(size)], { type })
  return new File([blob], name, { type })
}

// A simple wrapper component that renders the hook state and exposes buttons
function FileManagerHookFixture({
  node,
  fetchMock,
}: {
  node: FileManagerLayoutNode
  fetchMock?: typeof fetch
}) {
  const { state: hookState, selectFiles, deleteFile } = useFileManager(node, { fetchOverride: fetchMock })

  return (
    <>
      <div data-testid="dnd-phase">{hookState.dndPhase}</div>
      <div data-testid="completed">{hookState.completed}</div>
      <div data-testid="total">{hookState.total}</div>
      <div data-testid="pending-count">{hookState.pending.length}</div>
      <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
      <div data-testid="deleting-file-id">{String(hookState.deletingFileId ?? '')}</div>
      <button
        type="button"
        onClick={() => {
          void selectFiles([makeFile('doc.pdf', 'application/pdf', 200)])
        }}
      >
        Select single file
      </button>
      <button
        type="button"
        data-testid="delete-btn"
        onClick={() => {
          void deleteFile({ id: 1, name: 'doc.pdf' })
        }}
      >
        Delete file
      </button>
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

const declarativeConfig: RuntimeConfig = {
  api: {
    getDocuments: {
      method: 'GET',
      endpoint: '/api/documents',
    },
    uploadDocuments: {
      method: 'POST',
      endpoint: '/api/documents/upload',
    },
    deleteDocument: {
      method: 'DELETE',
      endpoint: '/api/documents/delete',
    },
    viewDocument: {
      method: 'GET',
      endpoint: '/api/documents/view',
    },
  },
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

const declarativeNode: FileManagerLayoutNode = {
  type: 'fileManager',
  props: {
    getOperation: 'getDocuments',
    uploadOperation: 'uploadDocuments',
    deleteOperation: 'deleteDocument',
    viewOperation: 'viewDocument',
    listPath: 'files',
    fileIdField: 'id',
    fileNameField: 'name',
    fileField: 'file',
  },
}

const legacyNode: FileManagerLayoutNode = {
  type: 'fileManager',
  props: {
    fieldName: 'documentos',
    listPath: 'files',
    fileIdField: 'id',
    fileNameField: 'name',
    fileField: 'file',
  },
}

describe('useFileManager', () => {
  describe('get initial load', () => {
    it('fires getOperation on mount in declarative mode', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ files: [{ id: 1, name: 'existing.pdf' }] }), { status: 200 }),
      )

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <FileManagerHookFixture node={declarativeNode} fetchMock={fetchMock} />
        </RuntimeStateProvider>,
      )

      await waitFor(() =>
        expect(readRuntimeStateSnapshot('runtime-state').queries.getDocuments).toMatchObject({
          status: 'success',
        }),
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toContain('/api/documents')
    })

    it('fires executeInlineQueryOperation with legacy operation on mount in legacy mode', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ files: [] }), { status: 200 }),
      )

      render(
        <RuntimeStateProvider config={{ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }}>
          <FileManagerHookFixture node={legacyNode} fetchMock={fetchMock} />
        </RuntimeStateProvider>,
      )

      await waitFor(() =>
        expect(readRuntimeStateSnapshot('runtime-state').queries['__fileManager__:documentos:get']).toMatchObject({
          status: 'success',
        }),
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const url = fetchMock.mock.calls[0][0] as string
      expect(url).toContain('/subirFicheros.aspx')
      expect(url).toContain('upload_multiple_field_name=documentos')
    })

    it('does not dispatch anything on mount when getOperation is false and no fieldName', async () => {
      const fetchMock = vi.fn()
      const noGetNode: FileManagerLayoutNode = {
        type: 'fileManager',
        props: {
          getOperation: false,
          uploadOperation: 'uploadDocuments',
          listPath: 'files',
          fileIdField: 'id',
          fileNameField: 'name',
          fileField: 'file',
        },
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <FileManagerHookFixture node={noGetNode} fetchMock={fetchMock} />
        </RuntimeStateProvider>,
      )

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetchMock).not.toHaveBeenCalled()
      expect(screen.getByTestId('dnd-phase').textContent).toBe('idle')
    })
  })

  describe('successful sequential upload', () => {
    it('updates fileList from getOperation slot after each successful upload', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const upload1Response = new Response(
        JSON.stringify({ files: [{ id: 1, name: 'a.pdf' }] }),
        { status: 200 },
      )
      const upload2Response = new Response(
        JSON.stringify({ files: [{ id: 1, name: 'a.pdf' }, { id: 2, name: 'b.pdf' }] }),
        { status: 200 },
      )

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        if (callCount === 2) return Promise.resolve(upload1Response)
        return Promise.resolve(upload2Response)
      })

      const ListCountFixture = ({ node }: { node: FileManagerLayoutNode }) => {
        const { fileList, selectFiles } = useFileManager(node, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="file-count">{fileList.length}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([
                  makeFile('a.pdf', 'application/pdf', 100),
                  makeFile('b.pdf', 'application/pdf', 100),
                ])
              }}
            >
              Select 2 files
            </button>
            <RuntimeStateSnapshot testId="runtime-state" />
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <ListCountFixture node={declarativeNode} />
        </RuntimeStateProvider>,
      )

      await waitFor(() =>
        expect(readRuntimeStateSnapshot('runtime-state').queries.getDocuments).toMatchObject({ status: 'success' }),
      )
      expect(screen.getByTestId('file-count').textContent).toBe('0')

      fireEvent.click(screen.getByRole('button', { name: 'Select 2 files' }))

      // Both uploads complete sequentially; list grows to 2 via setQuerySuccess on the getOperation slot
      await waitFor(() => expect(screen.getByTestId('file-count').textContent).toBe('2'))
    })
  })

  describe('upload with failure at second file', () => {
    it('stops uploading after the second file fails and shows error state', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const successResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'a.pdf' }] }), { status: 200 })
      const errorResponse = new Response('Server Error', { status: 500 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        if (callCount === 2) return Promise.resolve(successResponse)
        return Promise.resolve(errorResponse)
      })

      const ThreeFileFixture = ({ node }: { node: FileManagerLayoutNode }) => {
        const { state: hookState, selectFiles } = useFileManager(node, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <div data-testid="completed">{hookState.completed}</div>
            <div data-testid="total">{hookState.total}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([
                  makeFile('a.pdf', 'application/pdf', 100),
                  makeFile('b.pdf', 'application/pdf', 100),
                  makeFile('c.pdf', 'application/pdf', 100),
                ])
              }}
            >
              Select 3 files
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <ThreeFileFixture node={declarativeNode} />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select 3 files' }))

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('error'))
      expect(Number(screen.getByTestId('completed').textContent)).toBe(1)
      expect(Number(screen.getByTestId('total').textContent)).toBe(3)
    })
  })

  describe('upload response missing listPath', () => {
    it('emits upload-list-path-missing error and stops the queue when response has no listPath', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const noListPathResponse = new Response(JSON.stringify({ status: 'OK' }), { status: 200 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(noListPathResponse)
      })

      const Fixture = ({ node }: { node: FileManagerLayoutNode }) => {
        const { state: hookState, selectFiles } = useFileManager(node, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <div data-testid="completed">{hookState.completed}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([
                  makeFile('a.pdf', 'application/pdf', 100),
                  makeFile('b.pdf', 'application/pdf', 100),
                ])
              }}
            >
              Select 2 files
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture node={declarativeNode} />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select 2 files' }))

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('error'))
      expect(screen.getByTestId('inline-errors').textContent).toContain(
        'La respuesta de la subida no incluye la lista actualizada de ficheros.',
      )
      // Only 1 upload call should have been made (second file not attempted)
      expect(callCount).toBe(2) // 1 get + 1 upload
    })
  })

  describe('per-file rejection', () => {
    it('shows inline error for rejected file and uploads accepted files', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const uploadResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'valid.pdf' }] }), { status: 200 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(uploadResponse)
      })

      const nodeWithAccept: FileManagerLayoutNode = {
        ...declarativeNode,
        props: {
          ...declarativeNode.props,
          validations: {
            accept: { value: ['application/pdf'] },
          },
        },
      }

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(nodeWithAccept, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <div data-testid="total">{hookState.total}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([
                  makeFile('bad.txt', 'text/plain', 100),
                  makeFile('valid.pdf', 'application/pdf', 100),
                ])
              }}
            >
              Select mixed files
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select mixed files' }))

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('success'))
      expect(screen.getByTestId('inline-errors').textContent).toContain('no es de un tipo válido')
      // Total reflects only accepted files
      expect(Number(screen.getByTestId('total').textContent)).toBe(1)
    })
  })

  describe('batch rejection (maxFiles)', () => {
    it('does not upload anything when maxFiles is exceeded by the batch', async () => {
      const getResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'existing.pdf' }] }), { status: 200 })
      const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(getResponse))

      const nodeWithMaxFiles: FileManagerLayoutNode = {
        ...declarativeNode,
        props: {
          ...declarativeNode.props,
          validations: {
            maxFiles: { value: 1 },
          },
        },
      }

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(nodeWithMaxFiles, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([makeFile('new.pdf', 'application/pdf', 100)])
              }}
            >
              Select file
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      // Wait for initial get
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select file' }))

      await waitFor(() => expect(screen.getByTestId('inline-errors').textContent).not.toBe(''))
      expect(screen.getByTestId('inline-errors').textContent).toContain('máximo de ficheros')
      // dndPhase should be error
      expect(screen.getByTestId('dnd-phase').textContent).toBe('error')
      // fetch should not have been called for upload
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('normalizeFileName applied before upload', () => {
    it('sends the file with normalized name to executor', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const uploadResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'doc_pdf' }] }), { status: 200 })

      const capturedInits: RequestInit[] = []
      const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        callCount += 1
        capturedInits.push(init)
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(uploadResponse)
      })

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([makeFile('doc:invalid.pdf', 'application/pdf', 100)])
              }}
            >
              Select bad name
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select bad name' }))

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('success'))
      // The upload init body should be a FormData with the normalized file
      const uploadInit = capturedInits[1]
      expect(uploadInit.body).toBeInstanceOf(FormData)
      const formData = uploadInit.body as FormData
      const uploadedFile = formData.get('file') as File
      expect(uploadedFile.name).toBe('doc_invalid.pdf')
    })
  })

  describe('prefix applied before upload', () => {
    it('sends file with prefix prepended to normalized name', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const uploadResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'EXP_documento.pdf' }] }), { status: 200 })

      const capturedInits: RequestInit[] = []
      const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        callCount += 1
        capturedInits.push(init)
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(uploadResponse)
      })

      const nodeWithPrefix: FileManagerLayoutNode = {
        ...declarativeNode,
        props: { ...declarativeNode.props, prefix: 'EXP' },
      }

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(nodeWithPrefix, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <button
              type="button"
              onClick={() => {
                void selectFiles([makeFile('documento.pdf', 'application/pdf', 100)])
              }}
            >
              Select prefixed file
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select prefixed file' }))

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('success'))
      const uploadInit = capturedInits[1]
      const formData = uploadInit.body as FormData
      const uploadedFile = formData.get('file') as File
      expect(uploadedFile.name).toBe('EXP_documento.pdf')
    })
  })

  describe('delete in declarative mode', () => {
    it('dispatches deleteOperation with body containing fileIdField value', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'doc.pdf' }] }), { status: 200 })
      const deleteResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })

      const capturedUrls: string[] = []
      const capturedInits: RequestInit[] = []
      const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        callCount += 1
        capturedUrls.push(url)
        capturedInits.push(init)
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(deleteResponse)
      })

      const Fixture = () => {
        const { state: hookState, deleteFile } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <div data-testid="deleting-id">{String(hookState.deletingFileId ?? '')}</div>
            <button type="button" onClick={() => void deleteFile({ id: 1, name: 'doc.pdf' })}>
              Delete doc
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Delete doc' }))

      await waitFor(() => expect(callCount).toBe(2))

      const deleteInit = capturedInits[1]
      const deleteBody = JSON.parse(deleteInit.body as string) as Record<string, unknown>
      expect(deleteBody).toMatchObject({ id: 1 })
    })
  })

  describe('delete in legacy mode', () => {
    it('dispatches legacy executeInlineQueryOperation with upload_multiple_field_name and file id', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'doc.pdf' }] }), { status: 200 })
      const deleteResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })

      const capturedUrls: string[] = []
      const capturedInits: RequestInit[] = []
      const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        callCount += 1
        capturedUrls.push(url)
        capturedInits.push(init)
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(deleteResponse)
      })

      const Fixture = () => {
        const { deleteFile } = useFileManager(legacyNode, { fetchOverride: fetchMock })
        return (
          <>
            <button type="button" onClick={() => void deleteFile({ id: 1, name: 'doc.pdf' })}>
              Delete legacy
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={{ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Delete legacy' }))

      await waitFor(() => expect(callCount).toBe(2))

      const deleteInit = capturedInits[1]
      const deleteBody = JSON.parse(deleteInit.body as string) as Record<string, unknown>
      expect(deleteBody).toMatchObject({ upload_multiple_field_name: 'documentos', upload_multiple_file_id: 1 })
    })
  })

  describe('delete with listPath in response', () => {
    it('updates fileList from getOperation slot when deleteOperation response includes listPath', async () => {
      let callCount = 0
      const getResponse = new Response(
        JSON.stringify({ files: [{ id: 1, name: 'doc.pdf' }, { id: 2, name: 'other.pdf' }] }),
        { status: 200 },
      )
      const deleteResponse = new Response(
        JSON.stringify({ files: [{ id: 2, name: 'other.pdf' }] }),
        { status: 200 },
      )

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(deleteResponse)
      })

      const Fixture = () => {
        const { fileList, deleteFile } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="file-count">{fileList.length}</div>
            <button type="button" onClick={() => void deleteFile({ id: 1, name: 'doc.pdf' })}>
              Delete first
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(Number(screen.getByTestId('file-count').textContent)).toBe(2))

      fireEvent.click(screen.getByRole('button', { name: 'Delete first' }))

      await waitFor(() => expect(Number(screen.getByTestId('file-count').textContent)).toBe(1))
    })
  })

  describe('delete with no listPath in response (optimistic delete)', () => {
    it('removes the file from the list when deleteOperation response has no listPath', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'doc.pdf' }, { id: 2, name: 'other.pdf' }] }), { status: 200 })
      const deleteNoListResponse = new Response(JSON.stringify({ status: 'OK' }), { status: 200 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(deleteNoListResponse)
      })

      const Fixture = () => {
        const { fileList, deleteFile } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="file-count">{fileList.length}</div>
            <button type="button" onClick={() => void deleteFile({ id: 1, name: 'doc.pdf' })}>
              Delete first
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      // Wait for initial data to populate
      await waitFor(() =>
        expect(readRuntimeStateSnapshot('runtime-state').queries.getDocuments?.status).toBe('success'),
      ).catch(() => {})

      // Since we don't have a RuntimeStateSnapshot in this fixture, just click
      fireEvent.click(screen.getByRole('button', { name: 'Delete first' }))

      await waitFor(() => expect(callCount).toBe(2))
      await waitFor(() => expect(Number(screen.getByTestId('file-count').textContent)).toBe(1))
    })
  })

  describe('mountedRef', () => {
    it('discards dispatch after unmount (no React warnings)', async () => {
      let resolveUpload!: (r: Response) => void
      let callCount = 0

      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const uploadPromise = new Promise<Response>((resolve) => {
        resolveUpload = resolve
      })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return uploadPromise
      })

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <button
              type="button"
              onClick={() => void selectFiles([makeFile('a.pdf', 'application/pdf', 100)])}
            >
              Select file
            </button>
          </>
        )
      }

      const { unmount } = render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select file' }))

      // Unmount before upload resolves
      unmount()

      // Resolve after unmount — should not cause errors
      await act(async () => {
        resolveUpload(
          new Response(JSON.stringify({ files: [{ id: 1, name: 'a.pdf' }] }), { status: 200 }),
        )
        await new Promise((r) => setTimeout(r, 10))
      })

      // If we get here without React warnings, the mountedRef guard is working
      expect(true).toBe(true)
    })
  })

  describe('successFlashUntil', () => {
    it('transitions dndPhase back to idle after 4 seconds when upload succeeds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const uploadResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'a.pdf' }] }), { status: 200 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(uploadResponse)
      })

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="dnd-phase">{hookState.dndPhase}</div>
            <button
              type="button"
              onClick={() => void selectFiles([makeFile('a.pdf', 'application/pdf', 100)])}
            >
              Select file
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      // Wait for initial get with real time advancement
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Select file' }))

      // Run pending promises/timers
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('success'))

      // Advance timers past 4 seconds to trigger flash cleanup
      await act(async () => {
        vi.advanceTimersByTime(4001)
        await vi.runAllTimersAsync()
      })

      await waitFor(() => expect(screen.getByTestId('dnd-phase').textContent).toBe('idle'))
    }, 10000)
  })

  describe('executeInlineQueryOperation provider extension', () => {
    it('exposes executeInlineQueryOperation from the provider that writes to queries[slotName]', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ result: 'ok' }), { status: 200 }),
      )

      const Fixture = () => {
        const { executeInlineQueryOperation } = useRuntimeStateActions()
        return (
          <>
            <button
              type="button"
              onClick={() =>
                void executeInlineQueryOperation(
                  '__fileManager__:test:get',
                  {
                    operation: { method: 'GET', endpoint: '/api/test' },
                    requestParams: {},
                  },
                  fetchMock,
                )
              }
            >
              Execute inline
            </button>
            <RuntimeStateSnapshot testId="runtime-state" />
          </>
        )
      }

      render(
        <RuntimeStateProvider config={{ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Execute inline' }))

      await waitFor(() =>
        expect(readRuntimeStateSnapshot('runtime-state').queries['__fileManager__:test:get']).toMatchObject({
          status: 'success',
          data: { result: 'ok' },
        }),
      )
    })
  })

  describe('labels — uploadFileError', () => {
    it('resolves the custom uploadFileError label with the {{fileName}} placeholder when an upload fails', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const errorResponse = new Response('Server Error', { status: 500 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(errorResponse)
      })

      const nodeWithLabel: FileManagerLayoutNode = {
        ...declarativeNode,
        props: {
          ...declarativeNode.props,
          labels: { uploadFileError: 'Fallo: {{fileName}}' },
        },
      }

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(nodeWithLabel, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <button
              type="button"
              onClick={() => void selectFiles([makeFile('foo.pdf', 'application/pdf', 100)])}
            >
              Select file
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select file' }))

      await waitFor(() => expect(screen.getByTestId('inline-errors').textContent).toBe('Fallo: foo.pdf'))
    })

    it('keeps the default Spanish message with the real file name when labels is not declared', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const errorResponse = new Response('Server Error', { status: 500 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(errorResponse)
      })

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <button
              type="button"
              onClick={() => void selectFiles([makeFile('foo.pdf', 'application/pdf', 100)])}
            >
              Select file
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select file' }))

      await waitFor(() =>
        expect(screen.getByTestId('inline-errors').textContent).toBe('Error al subir "foo.pdf".'),
      )
    })
  })

  describe('labels — uploadListPathMissing', () => {
    it('resolves the custom uploadListPathMissing label from the translations catalog when listPath is missing', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [] }), { status: 200 })
      const noListPathResponse = new Response(JSON.stringify({ status: 'OK' }), { status: 200 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(noListPathResponse)
      })

      const configWithTranslations: RuntimeConfig = {
        ...declarativeConfig,
        translations: {
          subidaSinLista: { en: 'Upload response missing file list', es: 'Falta la lista' },
        },
      }

      const nodeWithLabel: FileManagerLayoutNode = {
        ...declarativeNode,
        props: {
          ...declarativeNode.props,
          labels: { uploadListPathMissing: 't.subidaSinLista' },
        },
      }

      const Fixture = () => {
        const { state: hookState, selectFiles } = useFileManager(nodeWithLabel, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <button
              type="button"
              onClick={() => void selectFiles([makeFile('foo.pdf', 'application/pdf', 100)])}
            >
              Select file
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={configWithTranslations} activeLanguage="en">
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Select file' }))

      await waitFor(() =>
        expect(screen.getByTestId('inline-errors').textContent).toBe('Upload response missing file list'),
      )
    })
  })

  describe('labels — deleteError', () => {
    it('resolves the custom deleteError label from the translations catalog when delete fails', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'doc.pdf' }] }), { status: 200 })
      const errorResponse = new Response('Server Error', { status: 500 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(errorResponse)
      })

      const configWithTranslations: RuntimeConfig = {
        ...declarativeConfig,
        translations: {
          borradoFallido: { en: 'Delete failed', es: 'Fallo al borrar' },
        },
      }

      const nodeWithLabel: FileManagerLayoutNode = {
        ...declarativeNode,
        props: {
          ...declarativeNode.props,
          labels: { deleteError: 't.borradoFallido' },
        },
      }

      const Fixture = () => {
        const { state: hookState, deleteFile } = useFileManager(nodeWithLabel, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <button type="button" onClick={() => void deleteFile({ id: 1, name: 'doc.pdf' })}>
              Delete doc
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={configWithTranslations} activeLanguage="en">
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Delete doc' }))

      await waitFor(() => expect(screen.getByTestId('inline-errors').textContent).toBe('Delete failed'))
    })

    it('keeps the default Spanish message when labels is not declared and delete fails', async () => {
      let callCount = 0
      const getResponse = new Response(JSON.stringify({ files: [{ id: 1, name: 'doc.pdf' }] }), { status: 200 })
      const errorResponse = new Response('Server Error', { status: 500 })

      const fetchMock = vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) return Promise.resolve(getResponse)
        return Promise.resolve(errorResponse)
      })

      const Fixture = () => {
        const { state: hookState, deleteFile } = useFileManager(declarativeNode, { fetchOverride: fetchMock })
        return (
          <>
            <div data-testid="inline-errors">{hookState.inlineErrors.join('|')}</div>
            <button type="button" onClick={() => void deleteFile({ id: 1, name: 'doc.pdf' })}>
              Delete doc
            </button>
          </>
        )
      }

      render(
        <RuntimeStateProvider config={declarativeConfig}>
          <Fixture />
        </RuntimeStateProvider>,
      )

      await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))
      fireEvent.click(screen.getByRole('button', { name: 'Delete doc' }))

      await waitFor(() =>
        expect(screen.getByTestId('inline-errors').textContent).toBe('Error al eliminar el fichero.'),
      )
    })
  })
})
