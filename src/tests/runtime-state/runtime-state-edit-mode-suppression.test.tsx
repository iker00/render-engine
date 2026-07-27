import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

const runtimeConfig: RuntimeConfig = {
  api: {
    op: {
      method: 'GET',
      endpoint: '/api/op',
    },
  },
  initialPage: 'page-a',
  pages: [
    { id: 'page-a', layout: [] },
    { id: 'page-b', layout: [] },
  ],
}

const noopEditModeContextValue = {
  active: true as const,
  selectedPath: null,
  hoveredPath: null,
  onSelectNode: () => {},
  onHoverNode: () => {},
}

// design.md feature 0103 Decisión 9: a provider mounted with `active: false` (Visual mode
// inside DevRuntime) must NOT suppress any declarative action — only `active: true` (Editor)
// does.
const visualEditModeContextValue = { active: false as const }

function RuntimeStateSnapshot({ testId = 'runtime-state' }: { testId?: string } = {}) {
  const state = useRuntimeState()
  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId = 'runtime-state') {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

function ActionsFixture({ fetchMock }: { fetchMock?: typeof fetch }) {
  const {
    executeQueryOperation,
    goBackPage,
    initializeForm,
    initializeQuery,
    navigateToPage,
    openModal,
    closeModal,
    resetForm,
    setFormFieldValue,
    setQuerySuccess,
  } = useRuntimeStateActions()
  const [lastExecuteResult, setLastExecuteResult] = useState<unknown>(null)

  useEffect(() => {
    initializeForm('f', {
      name: {
        defaultValue: 'Ada',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => navigateToPage('page-b')}>
        navigate to page-b
      </button>
      <button type="button" onClick={() => goBackPage()}>
        go back
      </button>
      <button type="button" onClick={() => openModal('m')}>
        open modal
      </button>
      <button type="button" onClick={() => closeModal('m')}>
        close modal
      </button>
      <button type="button" onClick={() => resetForm('f')}>
        reset form
      </button>
      <button
        type="button"
        onClick={async () => {
          const result = await executeQueryOperation('op', { fetch: fetchMock })
          setLastExecuteResult(result)
        }}
      >
        execute operation
      </button>
      <button type="button" onClick={() => setFormFieldValue('f', 'name', 'Grace')}>
        set form field value
      </button>
      <button type="button" onClick={() => initializeQuery('otherQuery')}>
        initialize other query
      </button>
      <button type="button" onClick={() => setQuerySuccess('otherQuery', { ok: true })}>
        set other query success
      </button>
      <pre data-testid="execute-result">{JSON.stringify(lastExecuteResult)}</pre>
    </>
  )
}

function ActionsKeysFixture() {
  const actions = useRuntimeStateActions()
  return <pre data-testid="actions-keys">{JSON.stringify(Object.keys(actions).sort())}</pre>
}

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Runtime state actions without LayoutEditModeProvider (baseline)', () => {
  it('navigateToPage changes the active page id in the runtime state', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ActionsFixture />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'navigate to page-b' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )
  })

  it('openModal marks the modal as active and closeModal clears it', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ActionsFixture />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open modal' }))
    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe('m')

    fireEvent.click(screen.getByRole('button', { name: 'close modal' }))
    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe(null)
  })

  it('resetForm clears field values on the target form', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ActionsFixture />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'set form field value' }))
    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Grace')

    fireEvent.click(screen.getByRole('button', { name: 'reset form' }))
    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Ada')
  })

  it('goBackPage calls window.history.back once navigation history has more than one entry', async () => {
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ActionsFixture />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'navigate to page-b' }))
    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'go back' }))

    expect(historyBackSpy).toHaveBeenCalledTimes(1)
  })

  it('executeQueryOperation dispatches loading + success and invokes fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true }))

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ActionsFixture fetchMock={fetchMock as unknown as typeof fetch} />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot().queries.op).toMatchObject({
        status: 'success',
        data: { ok: true },
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('Runtime state actions with LayoutEditModeProvider (suppression)', () => {
  it('navigateToPage is a no-op and does not change the active page id', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    const before = readRuntimeStateSnapshot().navigation.currentPageId
    fireEvent.click(screen.getByRole('button', { name: 'navigate to page-b' }))

    // Allow any hypothetical async navigation to settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe(before)
    expect(readRuntimeStateSnapshot().navigation.currentPageId).not.toBe('page-b')
  })

  it('openModal is a no-op and does not mark the modal as active', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open modal' }))
    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe(null)
  })

  it('closeModal is a no-op when there is an active modal from a non-suppressed path', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        {/* Outside the provider: openModal still works and seeds an active modal. */}
        <ActionsFixture />
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          {/* Inside the provider: closeModal is suppressed. */}
          <SuppressedCloseModalFixture />
        </LayoutEditModeProvider>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open modal' }))
    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe('m')

    fireEvent.click(screen.getByRole('button', { name: 'suppressed close modal' }))

    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe('m')
  })

  it('resetForm is a no-op and does not restore the form default value', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        {/* Outside the provider: setFormFieldValue and initializeForm work normally. */}
        <ActionsFixture />
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <SuppressedResetFormFixture />
        </LayoutEditModeProvider>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'set form field value' }))
    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Grace')

    fireEvent.click(screen.getByRole('button', { name: 'suppressed reset form' }))

    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Grace')
  })

  it('goBackPage does not call window.history.back', async () => {
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        {/* Bump entry index via a non-suppressed consumer. */}
        <ActionsFixture />
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <SuppressedGoBackFixture />
        </LayoutEditModeProvider>
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'navigate to page-b' }))
    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'suppressed go back' }))

    expect(historyBackSpy).not.toHaveBeenCalled()
  })

  it('executeQueryOperation resolves to { status: "skipped" } without dispatching or invoking fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true }))

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <ActionsFixture fetchMock={fetchMock as unknown as typeof fetch} />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'execute operation' }))

    await waitFor(() =>
      expect(screen.getByTestId('execute-result').textContent).toBe('{"status":"skipped"}'),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(readRuntimeStateSnapshot().queries.op).toBeUndefined()
  })

  it('non-suppressed actions (setFormFieldValue, initializeQuery, setQuerySuccess) still operate normally', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'set form field value' }))
    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Grace')

    fireEvent.click(screen.getByRole('button', { name: 'initialize other query' }))
    expect(readRuntimeStateSnapshot().queries.otherQuery).toMatchObject({ status: 'idle' })

    fireEvent.click(screen.getByRole('button', { name: 'set other query success' }))
    expect(readRuntimeStateSnapshot().queries.otherQuery).toMatchObject({
      status: 'success',
      data: { ok: true },
    })
  })

  it('useRuntimeStateActions() returns the same keys with and without the provider', () => {
    const { unmount } = render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ActionsKeysFixture />
      </RuntimeStateProvider>,
    )

    const baselineKeys = JSON.parse(screen.getByTestId('actions-keys').textContent ?? '[]') as string[]
    unmount()

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <ActionsKeysFixture />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    const providerKeys = JSON.parse(screen.getByTestId('actions-keys').textContent ?? '[]') as string[]
    expect(providerKeys).toEqual(baselineKeys)
  })
})

describe('Runtime state actions with LayoutEditModeProvider ({ active: false }, Visual mode)', () => {
  it('navigateToPage still changes the active page id (Visual must navigate for real)', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={visualEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'navigate to page-b' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )
  })

  it('openModal and closeModal still operate normally', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={visualEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open modal' }))
    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe('m')

    fireEvent.click(screen.getByRole('button', { name: 'close modal' }))
    expect(readRuntimeStateSnapshot().modal.activeModalId).toBe(null)
  })

  it('resetForm still restores field values to their default', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={visualEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'set form field value' }))
    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Grace')

    fireEvent.click(screen.getByRole('button', { name: 'reset form' }))
    expect(readRuntimeStateSnapshot().forms.f?.name?.value).toBe('Ada')
  })

  it('goBackPage still calls window.history.back', async () => {
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={visualEditModeContextValue}>
          <ActionsFixture />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'navigate to page-b' }))
    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'go back' }))

    expect(historyBackSpy).toHaveBeenCalledTimes(1)
  })

  it('executeQueryOperation still invokes fetch and dispatches success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true }))

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <LayoutEditModeProvider value={visualEditModeContextValue}>
          <ActionsFixture fetchMock={fetchMock as unknown as typeof fetch} />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot().queries.op).toMatchObject({
        status: 'success',
        data: { ok: true },
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a rendered button with navigateTo action still navigates for real', async () => {
    const buttonNavigationConfig: RuntimeConfig = {
      api: {},
      initialPage: 'page-a',
      pages: [
        {
          id: 'page-a',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open page-b',
                action: { type: 'navigateTo', pageId: 'page-b' },
              },
            },
          ],
        },
        { id: 'page-b', layout: [] },
      ],
    }

    render(
      <RuntimeStateProvider config={buttonNavigationConfig}>
        <LayoutEditModeProvider value={visualEditModeContextValue}>
          <RuntimePage />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open page-b' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )
  })
})

function SuppressedCloseModalFixture() {
  const { closeModal } = useRuntimeStateActions()
  return (
    <button type="button" onClick={() => closeModal('m')}>
      suppressed close modal
    </button>
  )
}

function SuppressedResetFormFixture() {
  const { resetForm } = useRuntimeStateActions()
  return (
    <button type="button" onClick={() => resetForm('f')}>
      suppressed reset form
    </button>
  )
}

function SuppressedGoBackFixture() {
  const { goBackPage } = useRuntimeStateActions()
  return (
    <button type="button" onClick={() => goBackPage()}>
      suppressed go back
    </button>
  )
}

describe('Integration: layout nodes rendered under LayoutEditModeProvider', () => {
  const buttonNavigationConfig: RuntimeConfig = {
    api: {},
    initialPage: 'page-a',
    pages: [
      {
        id: 'page-a',
        layout: [
          {
            type: 'button',
            props: {
              label: 'Open page-b',
              action: { type: 'navigateTo', pageId: 'page-b' },
            },
          },
        ],
      },
      { id: 'page-b', layout: [] },
    ],
  }

  it('a rendered button with navigateTo action does NOT change navigation when wrapped by LayoutEditModeProvider', async () => {
    render(
      <RuntimeStateProvider config={buttonNavigationConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <RuntimePage />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    const before = readRuntimeStateSnapshot().navigation.currentPageId
    fireEvent.click(screen.getByRole('button', { name: 'Open page-b' }))

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe(before)
    expect(readRuntimeStateSnapshot().navigation.currentPageId).not.toBe('page-b')
  })

  it('the same button changes navigation when NOT wrapped by LayoutEditModeProvider (regression baseline)', async () => {
    render(
      <RuntimeStateProvider config={buttonNavigationConfig}>
        <RuntimePage />
        <RuntimeStateSnapshot />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open page-b' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe('page-b'),
    )
  })

  const formSubmitConfig: RuntimeConfig = {
    api: {
      op: {
        method: 'POST',
        endpoint: '/api/op',
      },
    },
    initialPage: 'page-a',
    pages: [
      {
        id: 'page-a',
        layout: [
          {
            type: 'form',
            id: 'f',
            submitAction: { type: 'executeOperation', operationName: 'op' },
            onSuccess: [
              { type: 'navigateTo', pageId: 'page-b' },
            ],
            children: [
              {
                type: 'button',
                props: {
                  label: 'Submit form',
                },
              },
            ],
          },
        ],
      },
      { id: 'page-b', layout: [] },
    ],
  }

  it('a submitted form under LayoutEditModeProvider does NOT invoke fetch, store the query, or run onSuccess actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={formSubmitConfig}>
        <LayoutEditModeProvider value={noopEditModeContextValue}>
          <RuntimePage />
          <RuntimeStateSnapshot />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    const beforePage = readRuntimeStateSnapshot().navigation.currentPageId
    fireEvent.click(screen.getByRole('button', { name: 'Submit form' }))

    // Give any settlement microtasks a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(readRuntimeStateSnapshot().queries.op).toBeUndefined()
    expect(readRuntimeStateSnapshot().navigation.currentPageId).toBe(beforePage)
    expect(readRuntimeStateSnapshot().navigation.currentPageId).not.toBe('page-b')

    vi.unstubAllGlobals()
  })
})
