import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimeStateSnapshot } from '../runtime-state/helpers'

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

/**
 * Form with a `steps` node of three items, each with one required input:
 * Step 1 → field1, Step 2 → field2, Step 3 → field3. Submit aggregates all three.
 */
function makeThreeStepFormConfig(): RuntimeConfig {
  return {
    api: {
      saveOp: {
        method: 'POST',
        endpoint: '/api/save',
        body: {
          field1: 'forms.myForm.field1',
          field2: 'forms.myForm.field2',
          field3: 'forms.myForm.field3',
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
            id: 'myForm',
            submitAction: { type: 'executeOperation', operationName: 'saveOp' },
            children: [
              {
                type: 'steps',
                props: {
                  items: [
                    {
                      label: 'Step 1',
                      children: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'field1',
                            label: 'Field 1',
                            defaultValue: '',
                            validations: { required: { value: true } },
                          },
                        },
                      ],
                    },
                    {
                      label: 'Step 2',
                      children: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'field2',
                            label: 'Field 2',
                            defaultValue: '',
                            validations: { required: { value: true } },
                          },
                        },
                      ],
                    },
                    {
                      label: 'Step 3',
                      children: [
                        {
                          type: 'input',
                          props: { fieldId: 'field3', label: 'Field 3', defaultValue: '' },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

function renderThreeStepForm(config: RuntimeConfig = makeThreeStepFormConfig()) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>,
  )
}

function fillAndAdvance(fieldLabel: string, value: string, nextButtonName = 'Next') {
  fireEvent.change(screen.getByRole('textbox', { name: fieldLabel }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: nextButtonName }))
}

// ── helpers for standalone (non-form) transversal tests, mirroring layout-renderer-tabs.test.tsx ──

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = { api: {}, initialPage: activePage.id, pages: [activePage] }
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
  const config: RuntimeConfig = { api: {}, initialPage: activePage.id, pages: [activePage] }
  const baseState = createRuntimeState(config)
  return { ...baseState, queries } satisfies RuntimeState
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = { api: {}, initialPage: activePage.id, pages: [activePage] }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{ config, initialState: state, state, dispatch, dispatchAndSyncState, getLatestState: () => state }}
    >
      <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
}

function buildQueryState(queryName: string, data: unknown): RuntimeState['queries'] {
  return { [queryName]: { status: 'success', data, requestedAt: 0, resolvedAt: 0, error: null } }
}

describe('StepsNode — mount and defaults', () => {
  it('mounts with the first step active and horizontal variant by default', () => {
    renderThreeStepForm()

    expect(screen.getByRole('textbox', { name: 'Field 1' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Field 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 Step 1' })).toHaveAttribute('aria-current', 'step')
  })
})

describe('StepsNode — Next gating', () => {
  it('blocks advancing and shows the error when the active step has an empty required field', () => {
    renderThreeStepForm()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // The error changes the field's accessible name (label now also contains "Required"),
    // so it's queried unqualified: it's the only textbox on screen at this point.
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Field 2' })).not.toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('advances to the next visible step once the active step fields are valid', () => {
    renderThreeStepForm()

    fillAndAdvance('Field 1', 'value1')

    expect(screen.queryByRole('textbox', { name: 'Field 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Field 2' })).toBeInTheDocument()
  })
})

describe('StepsNode — Back navigation', () => {
  it('goes back without validating and preserves values entered in every step', () => {
    renderThreeStepForm()

    fillAndAdvance('Field 1', 'value1')
    fillAndAdvance('Field 2', 'value2')

    expect(screen.getByRole('textbox', { name: 'Field 3' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('textbox', { name: 'Field 2' })).toHaveValue('value2')

    // Clear field2 (now invalid per its `required` rule) without ever re-validating it.
    fireEvent.change(screen.getByRole('textbox', { name: 'Field 2' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByRole('textbox', { name: 'Field 1' })).toHaveValue('value1')
  })
})

describe('StepsNode — indicator click navigation', () => {
  it('retreats to a visited step via the indicator; a step ahead never visited has no effect', () => {
    const config: RuntimeConfig = {
      api: { saveOp: { method: 'POST', endpoint: '/api/save', body: {} } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              submitAction: { type: 'executeOperation', operationName: 'saveOp' },
              children: [
                {
                  type: 'steps',
                  props: {
                    items: [
                      { label: 'Step 1', children: [{ type: 'paragraph', props: { text: 'Panel 1' } }] },
                      { label: 'Step 2', children: [{ type: 'paragraph', props: { text: 'Panel 2' } }] },
                      { label: 'Step 3', children: [{ type: 'paragraph', props: { text: 'Panel 3' } }] },
                      { label: 'Step 4', children: [{ type: 'paragraph', props: { text: 'Panel 4' } }] },
                    ],
                  },
                },
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

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Panel 3')).toBeInTheDocument()

    // Step 4 was never visited: clicking it must have no effect.
    fireEvent.click(screen.getByRole('button', { name: '4 Step 4' }))
    expect(screen.getByText('Panel 3')).toBeInTheDocument()
    expect(screen.queryByText('Panel 4')).not.toBeInTheDocument()

    // Step 1 was already visited: clicking it retreats there.
    fireEvent.click(screen.getByRole('button', { name: '1 Step 1' }))
    expect(screen.getByText('Panel 1')).toBeInTheDocument()
  })
})

describe('StepsNode — submit', () => {
  it('submits the aggregated payload from every visible step once all are valid', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    renderThreeStepForm()

    fillAndAdvance('Field 1', 'value1')
    fillAndAdvance('Field 2', 'value2')

    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body).toEqual({ field1: 'value1', field2: 'value2', field3: '' })
  })
})

describe('StepsNode — hidden step item', () => {
  it('a hidden step is absent from the indicator, unreachable, and excluded from the submit payload', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: { field1: 'forms.myForm.field1', field2: 'forms.myForm.field2' },
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
              submitAction: { type: 'executeOperation', operationName: 'saveOp' },
              children: [
                {
                  type: 'steps',
                  props: {
                    items: [
                      {
                        label: 'Step 1',
                        children: [
                          {
                            type: 'input',
                            props: { fieldId: 'field1', label: 'Field 1', defaultValue: 'value1' },
                          },
                        ],
                      },
                      {
                        label: 'Hidden Step',
                        visibility: { reference: 'forms.myForm.field1', operator: 'equals', value: 'NEVER' },
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'field2',
                              label: 'Field 2',
                              defaultValue: '',
                              validations: { required: { value: true } },
                            },
                          },
                        ],
                      },
                      {
                        label: 'Step 3',
                        children: [{ type: 'paragraph', props: { text: 'Last panel' } }],
                      },
                    ],
                  },
                },
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

    expect(screen.queryByRole('button', { name: /Hidden Step/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Last panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body).toHaveProperty('field1', 'value1')
    expect(body).not.toHaveProperty('field2')
  })
})

describe('StepsNode — single visible step', () => {
  it('renders only the submit button; no Back or Next', () => {
    const config: RuntimeConfig = {
      api: { saveOp: { method: 'POST', endpoint: '/api/save', body: {} } },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              submitAction: { type: 'executeOperation', operationName: 'saveOp' },
              children: [
                {
                  type: 'steps',
                  props: {
                    items: [{ label: 'Only Step', children: [{ type: 'paragraph', props: { text: 'Only panel' } }] }],
                  },
                },
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

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit')
  })
})

describe('StepsNode — active step auto-recalculation', () => {
  function StepsVisibilityFixture() {
    const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

    useEffect(() => {
      initializeQuery('q')
    }, [initializeQuery])

    return (
      <>
        <button type="button" onClick={() => setQuerySuccess('q', { show: true })}>
          show
        </button>
        <button type="button" onClick={() => setQuerySuccess('q', { show: false })}>
          hide
        </button>
        <RuntimePage />
      </>
    )
  }

  it('recalculates the active step to the first visible one when the active step becomes hidden', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              children: [
                {
                  type: 'steps',
                  props: {
                    items: [
                      { label: 'First', children: [{ type: 'paragraph', props: { text: 'First panel' } }] },
                      {
                        label: 'Second',
                        visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
                        children: [{ type: 'paragraph', props: { text: 'Second panel' } }],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <StepsVisibilityFixture />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Second panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'hide' }))

    expect(screen.queryByText('Second panel')).not.toBeInTheDocument()
    expect(screen.getByText('First panel')).toBeInTheDocument()
  })
})

describe('StepsNode — empty step panel', () => {
  it('shows an empty panel without error when a step declares no children', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              children: [
                {
                  type: 'steps',
                  props: {
                    items: [
                      { label: 'Step 1', children: [{ type: 'paragraph', props: { text: 'First panel' } }] },
                      { label: 'Empty Step', children: [] },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    const { container } = render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    const panel = container.querySelector('[data-layout-node="steps-panel"]')
    expect(panel).toBeInTheDocument()
    expect(panel).toBeEmptyDOMElement()
  })
})

describe('StepsNode — variant vertical', () => {
  it('lays out the indicator to the left with a right-side border fusion on the active step', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'steps',
          props: {
            variant: 'vertical',
            items: [
              { label: 'Tab A', children: [{ type: 'paragraph', props: { text: 'Content A' } }] },
              { label: 'Tab B', children: [{ type: 'paragraph', props: { text: 'Content B' } }] },
            ],
          },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const stepsNode = container.querySelector('[data-layout-node="steps"]')
    expect(stepsNode).toHaveClass('flex-row')

    // "Connected tab" technique (same criterion as getTabsButtonClassName in vertical
    // orientation): the active step fuses its right border with the panel — border-t/l/b are
    // present, border-r is intentionally absent, and a negative right margin overlaps the panel.
    const activeButton = screen.getByRole('button', { name: '1 Tab A' })
    expect(activeButton).toHaveClass('-mr-px')
    expect(activeButton).toHaveClass('border-t')
    expect(activeButton).toHaveClass('border-l')
    expect(activeButton).toHaveClass('border-b')
    expect(activeButton).not.toHaveClass('border-r')
  })
})

describe('StepsNode — variant progress', () => {
  it('shows "Paso X de Y" text with no individual step controls; only Back moves backward', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              children: [
                {
                  type: 'steps',
                  props: {
                    variant: 'progress',
                    items: [
                      { label: 'Step 1', children: [{ type: 'paragraph', props: { text: 'Panel 1' } }] },
                      { label: 'Step 2', children: [{ type: 'paragraph', props: { text: 'Panel 2' } }] },
                    ],
                  },
                },
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

    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Step 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Step 2' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Paso 2 de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument()
  })
})

describe('StepsNode — custom labels and interpolation', () => {
  function StepsLabelQueryFixture() {
    const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

    useEffect(() => {
      initializeQuery('labelQuery')
      setQuerySuccess('labelQuery', { name: 'Ada' })
    }, [initializeQuery, setQuerySuccess])

    return <RuntimePage />
  }

  it('uses custom backLabel/nextLabel/submitLabel with {{...}} interpolation support', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'myForm',
              children: [
                {
                  type: 'steps',
                  props: {
                    backLabel: 'Previous',
                    nextLabel: 'Continue, {{queries.labelQuery.data.name}}',
                    submitLabel: 'Finish',
                    items: [
                      { label: 'Step 1', children: [{ type: 'paragraph', props: { text: 'Panel 1' } }] },
                      { label: 'Step 2', children: [{ type: 'paragraph', props: { text: 'Panel 2' } }] },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <StepsLabelQueryFixture />
      </RuntimeStateProvider>,
    )

    const nextButton = screen.getByRole('button', { name: 'Continue, Ada' })
    fireEvent.click(nextButton)

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  })
})

describe('StepsNode — transversal features', () => {
  it('wraps the steps node in a col-span wrapper when layout.span is set inside a container with columns', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'steps',
              layout: { span: 6 },
              props: { items: [{ label: 'Step A', children: [] }] },
            },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-6')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="steps"]')).toBeInTheDocument()
  })

  it('hides the entire steps node (indicator and panel) when node-level visibility is false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'steps',
          visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' },
          props: {
            items: [{ label: 'Step A', children: [{ type: 'paragraph', props: { text: 'Hidden content' } }] }],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, buildQueryState('q', { show: false }))
    const { container } = renderRuntimePageWithState(page, state)

    expect(container.querySelector('[data-layout-node="steps"]')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('replaces the steps node with the loading fallback when queryStateFeedback triggers loading state', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'steps',
          queryStateFeedback: {
            query: 'someQuery',
            states: { loading: { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Loading...' } }] } },
          },
          props: {
            items: [{ label: 'Step A', children: [{ type: 'paragraph', props: { text: 'Real content' } }] }],
          },
        },
      ],
    }

    const state = createRuntimePageState(
      page,
      { someQuery: { status: 'loading', data: null, requestedAt: 0, resolvedAt: null, error: null } },
    )
    const { container } = renderRuntimePageWithState(page, state)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Real content')).not.toBeInTheDocument()
    expect(container.querySelector('[data-layout-node="steps"]')).not.toBeInTheDocument()
  })
})
