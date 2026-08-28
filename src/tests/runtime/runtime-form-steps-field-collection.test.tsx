import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { collectResolvedFormFieldDefinitions } from '../../runtime/nodes/runtime-form-field-collection'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateSnapshot } from '../runtime-state/helpers'
import { readRuntimeStateSnapshot } from '../runtime-state/read-runtime-state-snapshot'

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

/**
 * Form with a single `steps` node, two steps, each with one input.
 * Step 0: step0Field (defaultValue 'value0')
 * Step 1: step1Field (defaultValue 'value1')
 */
function makeTwoStepFormConfig(): RuntimeConfig {
  return {
    api: {
      saveOp: {
        method: 'POST',
        endpoint: '/api/save',
        body: {
          step0: 'forms.myForm.step0Field',
          step1: 'forms.myForm.step1Field',
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
            submitAction: {
              type: 'executeOperation',
              operationName: 'saveOp',
            },
            children: [
              {
                type: 'steps',
                props: {
                  items: [
                    {
                      label: 'Step 0',
                      children: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'step0Field',
                            label: 'Step0 Field',
                            defaultValue: 'value0',
                          },
                        },
                      ],
                    },
                    {
                      label: 'Step 1',
                      children: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'step1Field',
                            label: 'Step1 Field',
                            defaultValue: 'value1',
                          },
                        },
                      ],
                    },
                  ],
                },
              },
              {
                type: 'button',
                props: { label: 'Submit' },
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('collectResolvedFormFieldDefinitions — stepGroup tagging', () => {
  it('tags fields inside steps items with stepGroup, without crossing between two steps nodes, and leaves tabs/container/repeater fields untagged', () => {
    const state = createRuntimeState({
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: [] }],
    })

    const nodes: LayoutNode[] = [
      {
        type: 'steps',
        id: 'stepsA',
        props: {
          items: [
            {
              label: 'Step A0',
              children: [{ type: 'input', props: { fieldId: 'sA0Field', label: 'A0', defaultValue: '' } }],
            },
            {
              label: 'Step A1',
              children: [{ type: 'input', props: { fieldId: 'sA1Field', label: 'A1', defaultValue: '' } }],
            },
          ],
        },
      },
      {
        type: 'steps',
        id: 'stepsB',
        props: {
          items: [
            {
              label: 'Step B0',
              children: [{ type: 'input', props: { fieldId: 'sB0Field', label: 'B0', defaultValue: '' } }],
            },
          ],
        },
      },
      {
        type: 'tabs',
        props: {
          items: [
            {
              label: 'Tab 0',
              children: [{ type: 'input', props: { fieldId: 'tabField', label: 'Tab', defaultValue: '' } }],
            },
          ],
        },
      },
      {
        type: 'container',
        children: [{ type: 'input', props: { fieldId: 'containerField', label: 'Container', defaultValue: '' } }],
      },
      {
        type: 'repeater',
        props: {
          items: { source: 'queries.items.data', key: '$index' },
          template: [{ type: 'input', props: { fieldId: 'repeaterField', label: 'Repeater', defaultValue: '' } }],
        },
      },
    ]

    const fields = collectResolvedFormFieldDefinitions(nodes, state)
    const byId = Object.fromEntries(fields.map((field) => [field.fieldId, field]))

    expect(byId.sA0Field?.stepGroup).toEqual({ nodeId: 'stepsA', itemIndex: 0 })
    expect(byId.sA1Field?.stepGroup).toEqual({ nodeId: 'stepsA', itemIndex: 1 })
    expect(byId.sB0Field?.stepGroup).toEqual({ nodeId: 'stepsB', itemIndex: 0 })
    expect(byId.tabField?.stepGroup).toBeUndefined()
    expect(byId.containerField?.stepGroup).toBeUndefined()
    expect(byId.repeaterField?.stepGroup).toBeUndefined()
  })
})

describe('Form with steps — field collection, lazy initialization and submit', () => {
  it('on mount, only the active step field initializes like an equivalent tabs field; the inactive step field stays lazy until submit runs', async () => {
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
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        label: 'Tab 0',
                        children: [
                          { type: 'input', props: { fieldId: 'tabField', label: 'Tab Field', defaultValue: '' } },
                        ],
                      },
                    ],
                  },
                },
                {
                  type: 'steps',
                  props: {
                    items: [
                      {
                        label: 'Step 0',
                        children: [
                          { type: 'input', props: { fieldId: 'step0Field', label: 'Step0 Field', defaultValue: '' } },
                        ],
                      },
                      {
                        label: 'Step 1',
                        children: [
                          { type: 'input', props: { fieldId: 'step1Field', label: 'Step1 Field', defaultValue: '' } },
                        ],
                      },
                    ],
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
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
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // The tabs field is expected to initialize eagerly; wait on it as the mount signal.
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.tabField).toBeDefined()
    })

    // StepsNode (T4) lazily initializes the active step's own fields on mount — step 0 is
    // active here — the same way FormNode eagerly initializes the tabs field above.
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.step0Field).toBeDefined()
    })

    // step 1 (inactive, never visited) stays uninitialized until submit runs.
    expect(readRuntimeStateSnapshot('runtime-state').forms?.myForm?.step1Field).toBeUndefined()

    // Submitting without ever visiting step 1 still discovers and initializes its field,
    // proving it was recognized by field collection all along — just excluded from the
    // per-step lazy initialization until the whole-form submit validates every visible step.
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.step1Field).toBeDefined()
    })
  })

  it('submit initializes and validates a required field in a step never activated by any UI, writing its error to the store', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: { step0: 'forms.myForm.step0Field' },
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
                        label: 'Step 0',
                        children: [
                          { type: 'input', props: { fieldId: 'step0Field', label: 'Step0 Field', defaultValue: 'ok' } },
                        ],
                      },
                      {
                        label: 'Step 1',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'step1Field',
                              label: 'Step1 Field',
                              defaultValue: '',
                              validations: { required: { value: true } },
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Submit' },
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
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // step1Field is never "activated" by any UI (StepsNode does not exist yet at this point of the sequence).
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const field = state.forms?.myForm?.step1Field
      expect(field).toBeDefined()
      return expect(field?.error).not.toBeNull()
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('successful submit payload includes fields from all visible step items, not just one', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={makeTwoStepFormConfig()}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toHaveProperty('step0', 'value0')
    expect(body).toHaveProperty('step1', 'value1')
  })

  it('a step item with visibility evaluating to hidden: its fields are not initialized, not validated and not in the payload', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            step0: 'forms.myForm.step0Field',
            step1: 'forms.myForm.step1Field',
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
                        label: 'Step 0',
                        children: [
                          { type: 'input', props: { fieldId: 'step0Field', label: 'Step0 Field', defaultValue: 'value0' } },
                        ],
                      },
                      {
                        // This step is hidden by visibility.
                        label: 'Step 1',
                        visibility: {
                          reference: 'forms.myForm.step0Field',
                          operator: 'equals',
                          value: 'NEVER',
                        },
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'step1Field',
                              label: 'Step1 Field',
                              defaultValue: 'hidden-value',
                              validations: { required: { value: true } },
                            },
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

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Step 1 is hidden, so step 0 is both first and last visible step: StepsNode (T4) renders
    // its own submit button (no separate `button` node is needed in this fixture anymore).
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Hidden step's field never got initialized: required validation never ran against it.
    expect(readRuntimeStateSnapshot('runtime-state').forms?.myForm?.step1Field).toBeUndefined()

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toHaveProperty('step0', 'value0')
    expect(body).not.toHaveProperty('step1')
  })

  it('a hidden field outside steps in the same form still initializes eagerly on mount, alongside the active step field, while the inactive step field stays lazy', async () => {
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
                { type: 'hidden', props: { fieldId: 'outsideHiddenField', value: 'literal-value' } },
                {
                  type: 'steps',
                  props: {
                    items: [
                      {
                        label: 'Step 0',
                        children: [
                          { type: 'input', props: { fieldId: 'step0Field', label: 'Step0 Field', defaultValue: '' } },
                        ],
                      },
                      {
                        label: 'Step 1',
                        children: [
                          { type: 'input', props: { fieldId: 'step1Field', label: 'Step1 Field', defaultValue: '' } },
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

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.outsideHiddenField).toBeDefined()
    })

    // StepsNode (T4) also lazily initializes the active step's own field (step 0) on mount.
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.step0Field).toBeDefined()
    })

    // The inactive step (step 1, never visited) stays uninitialized.
    expect(readRuntimeStateSnapshot('runtime-state').forms?.myForm?.step1Field).toBeUndefined()
  })
})
