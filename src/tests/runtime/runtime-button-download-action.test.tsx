import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimeStateSnapshot } from '../runtime-state/helpers'
import { readRuntimeStateSnapshot } from '../runtime-state/read-runtime-state-snapshot'

function ButtonDownloadFixture({ config }: { config: RuntimeConfig }) {
  return (
    <RuntimeStateProvider config={config}>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>
  )
}

function ButtonDownloadSeedInnerFixture({ seedQueryName, seedData }: { seedQueryName: string; seedData: unknown }) {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery(seedQueryName)
    setQuerySuccess(seedQueryName, seedData)
  }, [initializeQuery, setQuerySuccess, seedQueryName, seedData])

  return (
    <>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function ButtonDownloadWithSeedFixture({ config, seedQueryName, seedData }: {
  config: RuntimeConfig
  seedQueryName: string
  seedData: unknown
}) {
  return (
    <RuntimeStateProvider config={config}>
      <ButtonDownloadSeedInnerFixture seedQueryName={seedQueryName} seedData={seedData} />
    </RuntimeStateProvider>
  )
}

function blobResponse(text: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(new Blob([text]), { status, headers })
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('ButtonNode downloadOperation lifecycle', () => {
  let anchorClickSpy: ReturnType<typeof vi.fn>
  let createObjectUrlSpy: ReturnType<typeof vi.fn>
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    anchorClickSpy = vi.fn()
    createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock-url')
    revokeObjectUrlSpy = vi.fn()

    URL.createObjectURL = createObjectUrlSpy
    URL.revokeObjectURL = revokeObjectUrlSpy

    const actualCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return { href: '', download: '', click: anchorClickSpy } as unknown as HTMLAnchorElement
      }
      return actualCreateElement(tagName)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    // jsdom does not implement these by default; undo the direct assignment from beforeEach.
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  })

  it('triggers the download and runs onSuccess when the fetch resolves ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(blobResponse('content', 200, { 'content-disposition': 'attachment; filename="report.pdf"' }))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
                },
              },
            },
          ],
        },
        { id: 'success-page', layout: [] },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'success-page'),
    )

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
  })

  it('does not trigger the browser download and runs onError on an HTTP error response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onError: [{ type: 'navigateTo', pageId: 'error-page' }],
                },
              },
            },
          ],
        },
        { id: 'error-page', layout: [] },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )

    expect(createObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('does not trigger the browser download and runs onError on a network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network failure'))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Download',
                action: {
                  type: 'downloadOperation',
                  operationName: 'downloadReport',
                  onError: [{ type: 'navigateTo', pageId: 'error-page' }],
                },
              },
            },
          ],
        },
        { id: 'error-page', layout: [] },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )

    expect(createObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('disables the button while the download is in progress and ignores a second click', async () => {
    const deferred = createDeferred<Response>()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    const button = screen.getByRole('button', { name: 'Download' })

    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())

    fireEvent.click(button)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    deferred.resolve(blobResponse('content'))

    await waitFor(() => expect(button).not.toBeDisabled())
  })

  it('reflects loading then success in queries.{operationName}.status', async () => {
    const deferred = createDeferred<Response>()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.downloadReport?.status).toBe('loading')
    })

    deferred.resolve(blobResponse('content'))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.downloadReport?.status).toBe('success')
    })
  })

  it('reflects error in queries.{operationName}.status when the fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.downloadReport?.status).toBe('error')
    })
  })

  it('keeps disabled state independent between two buttons sharing the same operationName while both read the same query status', async () => {
    const deferred = createDeferred<Response>()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { sharedDownload: { method: 'GET', endpoint: '/api/shared/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Download A', action: { type: 'downloadOperation', operationName: 'sharedDownload' } },
            },
            {
              type: 'button',
              props: { label: 'Download B', action: { type: 'downloadOperation', operationName: 'sharedDownload' } },
            },
          ],
        },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    const buttonA = screen.getByRole('button', { name: 'Download A' })
    const buttonB = screen.getByRole('button', { name: 'Download B' })

    fireEvent.click(buttonA)

    await waitFor(() => expect(buttonA).toBeDisabled())
    expect(buttonB).not.toBeDisabled()

    const state = readRuntimeStateSnapshot('runtime-state')
    expect(state.queries.sharedDownload?.status).toBe('loading')

    deferred.resolve(blobResponse('content'))

    await waitFor(() => expect(buttonA).not.toBeDisabled())
  })

  it('resolves item.* references inside a repeater when downloading', async () => {
    const fetchMock = vi.fn().mockResolvedValue(blobResponse('content'))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadItem: { method: 'POST', endpoint: '/api/items/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.items.data', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Download item',
                      action: {
                        type: 'downloadOperation',
                        operationName: 'downloadItem',
                        body: { id: 'item.id' },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    render(<ButtonDownloadWithSeedFixture config={config} seedQueryName="items" seedData={[{ id: 'row-1' }]} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download item' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Download item' }))

    await waitFor(() => expect(createObjectUrlSpy).toHaveBeenCalledTimes(1))

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ id: 'row-1' })
  })

  it('triggers the download when no onSuccess/onError are declared', async () => {
    const fetchMock = vi.fn().mockResolvedValue(blobResponse('content'))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: { downloadReport: { method: 'GET', endpoint: '/api/reports/download' } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<ButtonDownloadFixture config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(createObjectUrlSpy).toHaveBeenCalledTimes(1))
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(1)
  })
})
