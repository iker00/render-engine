import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import { RuntimeStateProvider, useRuntimeState } from '../runtime/runtime-state/runtime-state-provider'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

function RuntimeStateSnapshot() {
  const state = useRuntimeState()

  return <pre data-testid="runtime-state">{JSON.stringify(state)}</pre>
}

function readRuntimeState() {
  return JSON.parse(screen.getByTestId('runtime-state').textContent ?? '') as RuntimeState
}

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

const navigationConfig: RuntimeConfig = {
  api: {
    loadHome: {
      method: 'GET',
      endpoint: '/api/home',
    },
    loadDetails: {
      method: 'GET',
      endpoint: '/api/details',
    },
  },
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      preloads: ['loadHome'],
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Home',
            level: 1,
          },
        },
        {
          type: 'button',
          props: {
            label: 'Open details',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
        {
          type: 'button',
          props: {
            label: 'Stay here',
            action: {
              type: 'navigateTo',
              pageId: 'home',
            },
          },
        },
      ],
    },
    {
      id: 'details',
      preloads: ['loadDetails'],
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Details',
            level: 1,
          },
        },
        {
          type: 'button',
          props: {
            label: 'Back home',
            action: {
              type: 'goBack',
            },
          },
        },
        {
          type: 'button',
          props: {
            label: 'Open home again',
            action: {
              type: 'navigateTo',
              pageId: 'home',
            },
          },
        },
      ],
    },
  ],
}

function renderRuntime(config: RuntimeConfig = navigationConfig) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeStateSnapshot />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('Runtime button navigation', () => {
  it('navigates to another page when a navigateTo button is clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ home: true }))
      .mockResolvedValueOnce(createJsonResponse({ details: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual(['home', 'details'])
  })

  it('keeps the current page and does not duplicate history when navigateTo targets the visible page', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createJsonResponse({ home: true }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(readRuntimeState().navigation.history).toEqual(['home'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('goes back to the previous valid page when a goBack button is clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ home: true }))
      .mockResolvedValueOnce(createJsonResponse({ details: true }))
      .mockResolvedValueOnce(createJsonResponse({ home: 'again' }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Back home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual(['home'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keeps navigation deterministic under successive button activations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ home: true }))
      .mockResolvedValueOnce(createJsonResponse({ details: true }))
      .mockResolvedValueOnce(createJsonResponse({ home: 'again' }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntime()

    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    fireEvent.click(screen.getByRole('button', { name: 'Open home again' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    await waitFor(() => expect(readRuntimeState().pageEntry.status).toBe('success'))

    expect(readRuntimeState().navigation.history).toEqual(['home', 'details', 'home'])
  })
})
