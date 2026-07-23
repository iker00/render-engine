import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// jsdom does not implement URL.createObjectURL / revokeObjectURL
URL.createObjectURL = vi.fn()
URL.revokeObjectURL = vi.fn()
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider, useRuntimeStateActions } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateSnapshot } from '../runtime-state/helpers'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function makeSuccessFetch() {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function FileValueSetter({ formId, fieldId, files }: { formId: string; fieldId: string; files: File[] }) {
  const { setFormFieldValue } = useRuntimeStateActions()
  return (
    <button type="button" onClick={() => setFormFieldValue(formId, fieldId, files)}>
      Set files
    </button>
  )
}

describe('Form submit — fileInput JSON+base64 integration', () => {
  it('sends a JSON body with a base64-encoded file entry at the referenced key', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const photo = new File([bytes], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
          body: { photos: 'forms.uploadForm.photos' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="uploadForm" fieldId="photos" files={[photo]} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    expect(init!.body).not.toBeInstanceOf(FormData)
    expect(typeof init!.body).toBe('string')
    expect((init!.headers as Record<string, string>)['content-type']).toBe('application/json')

    const body = JSON.parse(init!.body as string) as { photos: Array<{ name: string; size: number; mime: string; data: string }> }
    expect(body.photos).toHaveLength(1)
    expect(body.photos[0]!.name).toBe('foto.png')
    expect(body.photos[0]!.size).toBe(bytes.length)
    expect(body.photos[0]!.mime).toBe('image/png')

    // data decoded from base64 reproduces the original bytes byte by byte
    const decoded = base64ToBytes(body.photos[0]!.data)
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })

  it('sends an array of two file entries in selection order when multiple is true', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const fileA = new File([new Uint8Array([10, 20])], 'a.png', { type: 'image/png' })
    const fileB = new File([new Uint8Array([30, 40, 50])], 'b.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
          body: { photos: 'forms.uploadForm.photos' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos', multiple: true } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="uploadForm" fieldId="photos" files={[fileA, fileB]} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as { photos: Array<{ name: string; size: number }> }
    expect(body.photos).toHaveLength(2)
    expect(body.photos[0]!.name).toBe('a.png')
    expect(body.photos[0]!.size).toBe(2)
    expect(body.photos[1]!.name).toBe('b.png')
    expect(body.photos[1]!.size).toBe(3)
  })

  it('includes an empty array at the referenced key when the selection is empty and required is false', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
          body: { photos: 'forms.uploadForm.photos' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
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

    // Submit without setting files — photos value is []
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body).toEqual({ photos: [] })
  })

  it('omits the key entirely for a fileInput with files selected but not referenced in submitAction.body (regression)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File(['contenido'], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        submitOp: {
          method: 'POST',
          endpoint: '/api/submit',
          body: { name: 'forms.myForm.name' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              submitAction: { type: 'executeOperation', operationName: 'submitOp' },
              children: [
                { type: 'input', props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' } },
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="myForm" fieldId="photos" files={[photo]} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    // Identical to a form without any fileInput at all: only the referenced text field
    expect(body).toEqual({ name: 'Ada' })
  })

  it('includes file entries and scalar text field values together in the same body', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File([new Uint8Array([9, 8, 7])], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        submitOp: {
          method: 'POST',
          endpoint: '/api/submit',
          body: {
            name: 'forms.mixedForm.name',
            photos: 'forms.mixedForm.photos',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'mixedForm',
              submitAction: { type: 'executeOperation', operationName: 'submitOp' },
              children: [
                { type: 'input', props: { fieldId: 'name', label: 'Name', defaultValue: 'Grace' } },
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="mixedForm" fieldId="photos" files={[photo]} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as {
      name: string
      photos: Array<{ name: string; size: number; mime: string; data: string }>
    }
    expect(body.name).toBe('Grace')
    expect(body.photos).toHaveLength(1)
    expect(body.photos[0]!.name).toBe('foto.png')
    expect(body.photos[0]!.mime).toBe('image/png')
  })

  it('required fileInput with empty value blocks submit and does not call fetch (regression)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        uploadOp: { method: 'POST', endpoint: '/api/upload' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              children: [
                {
                  type: 'fileInput',
                  props: {
                    fieldId: 'photos',
                    label: 'Fotos',
                    validations: { required: { value: true } },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Submit without files — required validation must block
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"photos":{"value":[]',
      ),
    )

    // Validation error must be present
    await waitFor(() =>
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"error":"Required"',
      ),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('omits the referenced key without request-build-failed when the fileInput is hidden by visibility at submit time', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File(['contenido'], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
          body: { photos: 'forms.uploadForm.hiddenPhoto' },
        },
        toggleQuery: { method: 'GET', endpoint: '/api/toggle' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              children: [
                {
                  type: 'fileInput',
                  visibility: {
                    reference: 'queries.toggleQuery.data.showUpload',
                    operator: 'equals',
                    value: true,
                  },
                  props: { fieldId: 'hiddenPhoto', label: 'Hidden photo' },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="uploadForm" fieldId="hiddenPhoto" files={[photo]} />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Set files for the hidden field (toggleQuery is idle → showUpload is not true → field is hidden)
    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    // Submit — the fileInput is hidden so its key must be omitted, not request-build-failed
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body.photos).toBeUndefined()

    await waitFor(() =>
      expect(screen.getByTestId('runtime-state')).toHaveTextContent('"uploadOp":{"status":"success"'),
    )
  })

  it('executeOperations branch passes the same fileInputSources to every operation', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        op1: {
          method: 'POST',
          endpoint: '/api/op1',
          body: { photos: 'forms.uploadForm.photos' },
        },
        op2: {
          method: 'POST',
          endpoint: '/api/op2',
          body: { photos: 'forms.uploadForm.photos' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1' },
                  { operationName: 'op2' },
                ],
              },
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="uploadForm" fieldId="photos" files={[photo]} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    for (const call of fetchMock.mock.calls) {
      const [, init] = call
      const body = JSON.parse(init!.body as string) as { photos: Array<{ name: string }> }
      expect(body.photos).toHaveLength(1)
      expect(body.photos[0]!.name).toBe('foto.png')
    }
  })

  it('resetOnSuccess clears the file selection after a successful submit (regression)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File(['contenido'], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
          body: { photos: 'forms.uploadForm.photos' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              resetOnSuccess: true,
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="uploadForm" fieldId="photos" files={[photo]} />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-state')).toHaveTextContent('"photos":{"value":[]'),
    )
  })

  it('transitions the operation to status error with code request-build-failed and does not call fetch when encoding fails', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const badFile = new File([new Uint8Array([1, 2, 3])], 'bad.png', { type: 'image/png' })
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')))
    })

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
          body: { photos: 'forms.uploadForm.photos' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              submitAction: { type: 'executeOperation', operationName: 'uploadOp' },
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FileValueSetter formId="uploadForm" fieldId="photos" files={[badFile]} />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"uploadOp":{"status":"error","data":null,"error":{"code":"request-build-failed"',
      ),
    )

    expect(fetchMock).not.toHaveBeenCalled()

    spy.mockRestore()
  })
})
