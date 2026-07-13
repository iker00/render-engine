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

function FileValueSetter({ formId, fieldId, files }: { formId: string; fieldId: string; files: File[] }) {
  const { setFormFieldValue } = useRuntimeStateActions()
  return (
    <button type="button" onClick={() => setFormFieldValue(formId, fieldId, files)}>
      Set files
    </button>
  )
}

describe('Form submit — fileInput multipart integration', () => {
  it('sends files in FormData body when fileInput has a File in store', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File(['contenido'], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        uploadOp: {
          method: 'POST',
          endpoint: '/api/upload',
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
    expect(init!.body).toBeInstanceOf(FormData)

    const formData = init!.body as FormData
    const received = formData.get('photos') as File
    expect(received).toBeInstanceOf(File)
    expect(received.name).toBe(photo.name)
    expect(received.size).toBe(photo.size)
    expect(received.type).toBe(photo.type)
  })

  it('sends multiple files under the same fieldId key when two Files are in store', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const file1 = new File(['a'], 'foto1.png', { type: 'image/png' })
    const file2 = new File(['b'], 'foto2.png', { type: 'image/png' })

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
        <FileValueSetter formId="uploadForm" fieldId="photos" files={[file1, file2]} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    expect(init!.body).toBeInstanceOf(FormData)

    const formData = init!.body as FormData
    const entries = formData.getAll('photos') as File[]
    expect(entries).toHaveLength(2)
    expect(entries[0]!.name).toBe(file1.name)
    expect(entries[0]!.size).toBe(file1.size)
    expect(entries[1]!.name).toBe(file2.name)
    expect(entries[1]!.size).toBe(file2.size)
  })

  it('omits requestParams.files and uses JSON body when fileInput value is empty', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

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
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    // Submit without setting files — photos value is []
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    // No files → body must be a JSON string, not FormData
    expect(typeof init!.body).toBe('string')
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body).toEqual({ name: 'Ada' })
  })

  it('does not include files from a fileInput hidden by visibility', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File(['contenido'], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        uploadOp: { method: 'POST', endpoint: '/api/upload' },
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
      </RuntimeStateProvider>,
    )

    // Set files for the hidden field (toggleQuery is idle → showUpload is not true → field is hidden)
    fireEvent.click(screen.getByRole('button', { name: 'Set files' }))
    // Submit — the fileInput is hidden so its files must not be included
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    // Hidden fileInput → no files → body must NOT be FormData
    expect(init!.body).not.toBeInstanceOf(FormData)
  })

  it('executeOperations branch passes the same files to every operation', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const photo = new File(['contenido'], 'foto.png', { type: 'image/png' })

    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
        op2: { method: 'POST', endpoint: '/api/op2' },
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
      expect(init!.body).toBeInstanceOf(FormData)
      const formData = init!.body as FormData
      const received = formData.get('photos') as File
      expect(received).toBeInstanceOf(File)
      expect(received.name).toBe(photo.name)
      expect(received.size).toBe(photo.size)
    }
  })

  it('required fileInput with empty value blocks submit and does not call fetch', async () => {
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
})
