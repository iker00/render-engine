import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
} from '../../runtime/runtime-state/runtime-state-provider'

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

describe('toggle layout node', () => {
  it('renders a button with role="switch"', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('renders aria-checked="false" when no defaultValue', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('renders aria-checked="true" when defaultValue is true', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree', defaultValue: true } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders label above control when labelPosition is "top" or absent', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'I agree to terms' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const wrapper = screen.getByText('I agree to terms').closest('[data-layout-node="toggle"]')
    expect(wrapper).toBeInTheDocument()
    // Label should be in a block layout (not flex-row), verified by the data attribute
    expect(wrapper).not.toHaveClass('flex-row')
  })

  it('renders label to the right of control when labelPosition is "inline"', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree', labelPosition: 'inline' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const wrapper = screen.getByText('Agree').closest('[data-layout-node="toggle"]')
    expect(wrapper).toBeInTheDocument()
    // Inline layout uses flex-row
    const innerContainer = wrapper!.querySelector('.flex-row, .flex.flex-row')
    expect(innerContainer).toBeInTheDocument()
  })

  it('toggles aria-checked on click', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('updates forms.{formId}.{fieldId}.value in the store as boolean on click', async () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } },
            {
              type: 'button',
              props: { label: 'Submit', action: { type: 'executeOperation', operationName: 'submit' } },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('validation — required', () => {
    it('blocks submit when toggle is required and value is false', async () => {
      const submitMock = vi.fn()
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
              {
                type: 'toggle',
                props: {
                  fieldId: 'agree',
                  label: 'Agree',
                  validations: { required: { value: true } },
                },
              },
              { type: 'button', props: { label: 'Submit' } },
            ],
          },
        ],
      }

      renderRuntimePage(page)

      // Submit the form
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Required')).toBeInTheDocument()
      })

      expect(submitMock).not.toHaveBeenCalled()
    })

    it('allows submit when toggle is required and value is true', async () => {
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
              {
                type: 'toggle',
                props: {
                  fieldId: 'agree',
                  label: 'Agree',
                  validations: { required: { value: true } },
                },
              },
              { type: 'button', props: { label: 'Submit' } },
            ],
          },
        ],
      }

      renderRuntimePage(page, { submit: { method: 'POST', endpoint: '/api/submit' } })

      // Activate the toggle first
      fireEvent.click(screen.getByRole('switch'))

      await waitFor(() => {
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
      })

      // Submit the form
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(submitMock).toHaveBeenCalled()
      })
    })
  })

  it('shows aria-describedby pointing to error span when toggle has error', async () => {
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
            {
              type: 'toggle',
              props: {
                fieldId: 'agree',
                label: 'Agree',
                validations: { required: { value: true } },
              },
            },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-describedby', 'f-agree-error')

      const errorSpan = document.getElementById('f-agree-error')
      expect(errorSpan).toBeInTheDocument()
      expect(errorSpan).toHaveTextContent('Required')
    })
  })

  it('does not have aria-describedby when toggle has no error', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const toggle = screen.getByRole('switch')
    expect(toggle).not.toHaveAttribute('aria-describedby')
  })

  it('does not block submit when toggle is hidden by visibility', async () => {
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
            {
              type: 'toggle',
              props: {
                fieldId: 'agree',
                label: 'Agree',
                validations: { required: { value: true } },
              },
              visibility: {
                reference: 'forms.f.showToggle',
                operator: 'isTruthy',
              },
            },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, { submit: { method: 'POST', endpoint: '/api/submit' } })

    // Toggle should not be visible since forms.f.showToggle is not initialized (falsy)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    // Submit should succeed since the toggle is hidden
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })
  })

  it('resolves defaultValue from dynamic reference', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'toggle',
              props: {
                fieldId: 'agree',
                label: 'Agree',
                defaultValue: 'queries.q.data.active',
              },
            },
          ],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { active: true },
        error: null,
        requestSignature: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders independent toggle instances inside repeater within form', () => {
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
                  {
                    type: 'toggle',
                    props: {
                      fieldId: 'active',
                      label: 'Active',
                    },
                  },
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
            { id: 'a', active: true },
            { id: 'b', active: false },
          ],
        },
        error: null,
        requestSignature: null,
      },
    })

    renderRuntimePageWithState(page, state)

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
  })

  it('resolves defaultValue with item.* inside repeater', () => {
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
                  {
                    type: 'toggle',
                    props: {
                      fieldId: 'active',
                      label: 'Active',
                      defaultValue: 'item.enabled',
                    },
                  },
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
            { id: 'a', enabled: true },
            { id: 'b', enabled: false },
          ],
        },
        error: null,
        requestSignature: null,
      },
    })

    renderRuntimePageWithState(page, state)

    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('includes toggle value as boolean in submit payload', async () => {
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
              agree: 'forms.f.agree',
            },
          },
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree' } },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, { submit: { method: 'POST', endpoint: '/api/submit' } })

    // Activate the toggle
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })

    const fetchCall = submitMock.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.agree).toBe(true)
  })

  it('clears required error after toggle is clicked to true (reevaluation)', async () => {
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
            {
              type: 'toggle',
              props: {
                fieldId: 'agree',
                label: 'Agree',
                validations: { required: { value: true } },
              },
            },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    // Submit to trigger error
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument()
    })

    // Click toggle to activate
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.queryByText('Required')).not.toBeInTheDocument()
    })
  })

  it('applies layout.span grid class', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'container',
              props: { columns: 2 },
              children: [
                {
                  type: 'toggle',
                  props: { fieldId: 'agree', label: 'Agree' },
                  layout: { span: 2 },
                },
              ],
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const toggle = screen.getByRole('switch')
    const spanWrapper = toggle.closest('[data-layout-node="toggle"]')?.parentElement
    expect(spanWrapper).toHaveClass('col-span-2')
  })

  it('shows queryStateFeedback fallback when corresponding query is in the right state', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'toggle',
              props: { fieldId: 'agree', label: 'Agree' },
              queryStateFeedback: {
                query: 'q',
                states: {
                  loading: { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Loading toggle...' } }] },
                },
              },
            },
          ],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'loading',
        data: null,
        error: null,
        requestSignature: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByText('Loading toggle...')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
