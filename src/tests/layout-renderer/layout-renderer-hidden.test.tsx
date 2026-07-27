import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
} from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimeStateSnapshot, readRuntimeStateSnapshot } from '../runtime-state/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePage(activePage: RuntimePageConfig, api: RuntimeConfig['api'] = {}) {
  const config: RuntimeConfig = {
    api,
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
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
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateContext.Provider>,
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: baseState.navigation.currentPageId,
      params: baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

describe('hidden layout node', () => {
  it('does not produce any DOM element in the render', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'secret', value: 'abc' } },
            { type: 'input', props: { fieldId: 'name', label: 'Name' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    // The form should render, but hidden should not add any visible element
    const form = document.querySelector('[data-layout-node="form"]')
    expect(form).toBeInTheDocument()
    // Input renders, hidden does not
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    // No element with data-layout-node="hidden" should exist
    expect(form!.querySelector('[data-layout-node="hidden"]')).toBeNull()
  })

  it('stores string value in forms.{formId}.{fieldId}.value at form mount', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'secret', value: 'my-secret' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.secret.value).toBe('my-secret')
    })
  })

  it('stores number value in forms.{formId}.{fieldId}.value', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'count', value: 42 } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.count.value).toBe(42)
    })
  })

  it('stores boolean value in forms.{formId}.{fieldId}.value', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'active', value: true } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.active.value).toBe(true)
    })
  })

  it('resolves dynamic reference value against query state', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'userId', value: 'queries.q.data.someField' } },
          ],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { someField: 'resolved-value' },
        error: null,
        requestSignature: null,
      },
    })

    const { dispatchAndSyncState } = renderRuntimePageWithState(page, state)

    // The form-level initialization should dispatch with the resolved value
    expect(dispatchAndSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'forms/initialize',
        payload: expect.objectContaining({
          formId: 'f',
          fields: expect.objectContaining({
            userId: { defaultValue: 'resolved-value' },
          }),
        }),
      }),
    )
  })

  it('initializes at form mount without user interaction (not lazy)', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'token', value: 'init-token' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    // Should be initialized immediately without any interaction
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.token).toBeDefined()
      expect(state.forms.f.token.value).toBe('init-token')
    })
  })

  it('does not block the submit (no validation participation)', async () => {
    const submitMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', submitMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submit',
          },
          children: [
            { type: 'hidden', props: { fieldId: 'secret', value: 'abc' } },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, { submit: { method: 'POST', endpoint: '/api/submit' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })
  })

  it('includes hidden value in submit payload when referenced from submitAction.body', async () => {
    const submitMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', submitMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submit',
            body: {
              secret: 'forms.f.secret',
            },
          },
          children: [
            { type: 'hidden', props: { fieldId: 'secret', value: 'hidden-val' } },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, { submit: { method: 'POST', endpoint: '/api/submit' } })

    // Wait for hidden field to be initialized
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.secret).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })

    const fetchCall = submitMock.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.secret).toBe('hidden-val')
  })

  it('resolves item.* value inside repeater within form', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.q.data.items',
                  key: 'id',
                },
                template: [
                  { type: 'hidden', props: { fieldId: 'itemId', value: 'item.id' } },
                  { type: 'input', props: { fieldId: 'name', label: 'Name' } },
                ],
              },
            },
          ],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: {
          items: [
            { id: 'alpha' },
            { id: 'beta' },
          ],
        },
        error: null,
        requestSignature: null,
      },
    })

    const { dispatchAndSyncState } = renderRuntimePageWithState(page, state)

    // The HiddenNode component self-initializes with the resolved item.* value
    // The first iteration resolves item.id to 'alpha'
    const initCalls = dispatchAndSyncState.mock.calls.filter(
      (call) => call[0].type === 'forms/initialize',
    )

    const hiddenFieldInit = initCalls.find(
      (call) => call[0].payload.fields.itemId !== undefined,
    )
    expect(hiddenFieldInit).toBeDefined()
    expect(hiddenFieldInit![0].payload.fields.itemId.defaultValue).toBe('alpha')
  })

  it('stays initialized and included in payload when inside a container with visibility hidden', async () => {
    const submitMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', submitMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submit',
            body: {
              secret: 'forms.f.secret',
            },
          },
          children: [
            {
              type: 'container',
              visibility: {
                reference: 'forms.f.neverTrue',
                operator: 'isTruthy',
              },
              children: [
                { type: 'hidden', props: { fieldId: 'secret', value: 'from-hidden-container' } },
              ],
            },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, { submit: { method: 'POST', endpoint: '/api/submit' } })

    // Wait for hidden field to be initialized (should happen regardless of container visibility)
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.secret).toBeDefined()
      expect(state.forms.f.secret.value).toBe('from-hidden-container')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })

    // Hidden field should NOT be omitted from payload despite parent container being invisible
    const fetchCall = submitMock.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.secret).toBe('from-hidden-container')
  })

  it('does not appear in the DOM although the form is visible', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'secret', value: 'abc' } },
            { type: 'paragraph', props: { text: 'Visible paragraph' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Visible paragraph')).toBeInTheDocument()
    const form = document.querySelector('[data-layout-node="form"]')
    // No hidden elements produced
    expect(form!.querySelector('[data-layout-node="hidden"]')).toBeNull()
    expect(form!.querySelector('input[type="hidden"]')).toBeNull()
  })

  it('resolves dynamic reference value that points to preload query', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'preloadVal', value: 'queries.preloadQ.data.token' } },
          ],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      preloadQ: {
        status: 'success',
        data: { token: 'preload-token-123' },
        error: null,
        requestSignature: null,
      },
    })

    const { dispatchAndSyncState } = renderRuntimePageWithState(page, state)

    // The form-level initialization should dispatch with the resolved query value
    expect(dispatchAndSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'forms/initialize',
        payload: expect.objectContaining({
          formId: 'f',
          fields: expect.objectContaining({
            preloadVal: { defaultValue: 'preload-token-123' },
          }),
        }),
      }),
    )
  })

  it('stores independent values for two hidden fields in the same form', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'hidden', props: { fieldId: 'fieldA', value: 'valueA' } },
            { type: 'hidden', props: { fieldId: 'fieldB', value: 'valueB' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      expect(state.forms.f.fieldA.value).toBe('valueA')
      expect(state.forms.f.fieldB.value).toBe('valueB')
    })
  })
})
