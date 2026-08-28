import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimeStateSnapshot } from '../runtime-state/helpers'
import { readRuntimeStateSnapshot } from '../runtime-state/read-runtime-state-snapshot'

function LinkDownloadFixture({ config }: { config: RuntimeConfig }) {
  return (
    <RuntimeStateProvider config={config}>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>
  )
}

function LinkDownloadSeedInnerFixture({ seedQueryName, seedData }: { seedQueryName: string; seedData: unknown }) {
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

function LinkDownloadWithSeedFixture({ config, seedQueryName, seedData }: {
  config: RuntimeConfig
  seedQueryName: string
  seedData: unknown
}) {
  return (
    <RuntimeStateProvider config={config}>
      <LinkDownloadSeedInnerFixture seedQueryName={seedQueryName} seedData={seedData} />
    </RuntimeStateProvider>
  )
}

function blobResponse(text: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(new Blob([text]), { status, headers })
}

/**
 * `downloadOperation` links intentionally render without `href` (T7), which means
 * the anchor loses its implicit `link` accessible role. Locate it by its visible
 * text and tag instead of `getByRole('link', ...)`.
 */
function getDownloadLinkByText(text: string): HTMLAnchorElement {
  return screen.getByText(text, { selector: 'a[data-layout-node="link"]' }) as HTMLAnchorElement
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

describe('LinkNode downloadOperation lifecycle', () => {
  let anchorClickSpy: ReturnType<typeof vi.spyOn>
  let createObjectUrlSpy: ReturnType<typeof vi.fn>
  let revokeObjectUrlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock-url')
    revokeObjectUrlSpy = vi.fn()

    URL.createObjectURL = createObjectUrlSpy
    URL.revokeObjectURL = revokeObjectUrlSpy

    // The `link` node itself renders a real `<a>` via JSX, so unlike the `button`
    // node's download test, `document.createElement('a')` cannot be swapped for a
    // fake object without breaking React's own rendering of the anchor. Spy on
    // `HTMLAnchorElement.prototype.click` instead: it only fires for the temporary
    // anchor created imperatively by `triggerBrowserDownload`, never for
    // `fireEvent.click`, which dispatches a click event without invoking `.click()`.
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
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
              type: 'link',
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

    render(<LinkDownloadFixture config={config} />)
    fireEvent.click(getDownloadLinkByText('Download'))

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
              type: 'link',
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

    render(<LinkDownloadFixture config={config} />)
    fireEvent.click(getDownloadLinkByText('Download'))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )

    expect(createObjectUrlSpy).not.toHaveBeenCalled()
  })

  it('disables the link while the download is in progress and ignores a second click', async () => {
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
              type: 'link',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<LinkDownloadFixture config={config} />)
    const link = getDownloadLinkByText('Download')

    fireEvent.click(link)

    await waitFor(() => expect(link).toHaveAttribute('aria-disabled', 'true'))

    fireEvent.click(link)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    deferred.resolve(blobResponse('content'))

    await waitFor(() => expect(link).not.toHaveAttribute('aria-disabled'))
  })

  it('does not render an href attribute for downloadOperation actions', async () => {
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
              type: 'link',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<LinkDownloadFixture config={config} />)
    const link = getDownloadLinkByText('Download')

    expect(link).not.toHaveAttribute('href')
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
              type: 'link',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<LinkDownloadFixture config={config} />)
    fireEvent.click(getDownloadLinkByText('Download'))

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
              type: 'link',
              props: { label: 'Download', action: { type: 'downloadOperation', operationName: 'downloadReport' } },
            },
          ],
        },
      ],
    }

    render(<LinkDownloadFixture config={config} />)
    fireEvent.click(getDownloadLinkByText('Download'))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.queries.downloadReport?.status).toBe('error')
    })
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
                    type: 'link',
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

    render(<LinkDownloadWithSeedFixture config={config} seedQueryName="items" seedData={[{ id: 'row-1' }]} />)

    await waitFor(() => expect(getDownloadLinkByText('Download item')).toBeInTheDocument())
    fireEvent.click(getDownloadLinkByText('Download item'))

    await waitFor(() => expect(createObjectUrlSpy).toHaveBeenCalledTimes(1))

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ id: 'row-1' })
  })

  it('keeps navigateTo/goBack behavior without lifecycle when action is not downloadOperation', async () => {
    const config: RuntimeConfig = {
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'link',
              props: { label: 'Go to other page', action: { type: 'navigateTo', pageId: 'other' } },
            },
          ],
        },
        { id: 'other', layout: [] },
      ],
    }

    render(<LinkDownloadFixture config={config} />)
    const link = screen.getByRole('link', { name: 'Go to other page' })

    expect(link).toHaveAttribute('href', '#/other')
    expect(link).not.toHaveAttribute('aria-disabled')

    fireEvent.click(link)

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'other'),
    )
  })
})
