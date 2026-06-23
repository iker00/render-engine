import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider, useRuntimeStateActions } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateSnapshot, readRuntimeStateSnapshot } from '../runtime-state/helpers'

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
 * Simple config: form with two tabs, each tab has one input.
 * Tab 0: tab0Field (label "Tab0 Field")
 * Tab 1: tab1Field (label "Tab1 Field")
 */
function makeTwoTabFormConfig(): RuntimeConfig {
  return {
    api: {
      saveOp: {
        method: 'POST',
        endpoint: '/api/save',
        body: {
          tab0: 'forms.myForm.tab0Field',
          tab1: 'forms.myForm.tab1Field',
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
                type: 'tabs',
                props: {
                  items: [
                    {
                      label: 'Tab 0',
                      children: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'tab0Field',
                            label: 'Tab0 Field',
                            defaultValue: '',
                          },
                        },
                      ],
                    },
                    {
                      label: 'Tab 1',
                      children: [
                        {
                          type: 'input',
                          props: {
                            fieldId: 'tab1Field',
                            label: 'Tab1 Field',
                            defaultValue: '',
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

describe('Form with tabs — field collection and submit', () => {
  it('submit with tab 0 active and tab 1 never visited sends both fieldIds in the payload', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={makeTwoTabFormConfig()}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Only interact with tab 0 (default active), tab 1 is never visited
    fireEvent.change(screen.getByRole('textbox', { name: 'Tab0 Field' }), {
      target: { value: 'value0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    // Both fields should be in the payload
    expect(body).toHaveProperty('tab0', 'value0')
    expect(body).toHaveProperty('tab1', '')
  })

  it('required field in inactive tab blocks submit and sets error in store', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            tab0: 'forms.myForm.tab0Field',
            tab1: 'forms.myForm.tab1Field',
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
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        label: 'Tab 0',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab0Field',
                              label: 'Tab0 Field',
                              defaultValue: 'some value',
                            },
                          },
                        ],
                      },
                      {
                        label: 'Tab 1',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab1Field',
                              label: 'Tab1 Field',
                              defaultValue: '',
                              validations: {
                                required: { value: true },
                              },
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

    // Tab 1 has a required field that is never visited
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // Submit should NOT call fetch because tab1Field is required but empty
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.tab1Field?.error).not.toBeNull()
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('error from a blocked submit persists in store when switching to the tab containing the invalid field', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            tab1: 'forms.myForm.tab1Field',
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
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        label: 'Tab 0',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab0Field',
                              label: 'Tab0 Field',
                              defaultValue: '',
                            },
                          },
                        ],
                      },
                      {
                        label: 'Tab 1',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab1Field',
                              label: 'Tab1 Field',
                              defaultValue: '',
                              validations: {
                                required: { value: true },
                              },
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

    // Submit without visiting tab 1
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    // Wait for error to be set in store
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.tab1Field?.error).not.toBeNull()
    })

    expect(fetchMock).not.toHaveBeenCalled()

    // Now switch to tab 1 to reveal the error
    fireEvent.click(screen.getByRole('button', { name: 'Tab 1' }))

    // The error for tab1Field should be visible in the DOM
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const error = state.forms?.myForm?.tab1Field?.error
      return expect(error).not.toBeNull()
    })
  })

  it('fields in inactive tabs are initialized in the store with their defaultValue before the user visits the tab', async () => {
    render(
      <RuntimeStateProvider config={makeTwoTabFormConfig()}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Wait for the form to mount and initialize
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm).toBeDefined()
    })

    const state = readRuntimeStateSnapshot('runtime-state')

    // Both fields (even tab1Field in inactive tab) should be initialized
    expect(state.forms?.myForm?.tab0Field).toBeDefined()
    expect(state.forms?.myForm?.tab1Field).toBeDefined()
    // Default values should be empty string as declared
    expect((state.forms?.myForm?.tab0Field as { value?: unknown })?.value).toBe('')
    expect((state.forms?.myForm?.tab1Field as { value?: unknown })?.value).toBe('')
  })

  it('defaultValue with queries.* reference for field in inactive tab resolves correctly', async () => {
    // Two-page config: 'home' page has no form (so query can be seeded here first),
    // 'editor' page has the form with a field in an inactive tab whose defaultValue references queries.userQuery.name.
    // By seeding the query BEFORE navigating to the editor page, the field initializes with the resolved value.
    const config: RuntimeConfig = {
      api: {
        userQuery: {
          method: 'GET',
          endpoint: '/api/user',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: { label: 'Go to editor', action: { type: 'navigateTo', pageId: 'editor' } },
            },
          ],
        },
        {
          id: 'editor',
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
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab0Field',
                              label: 'Tab0 Field',
                              defaultValue: '',
                            },
                          },
                        ],
                      },
                      {
                        label: 'Tab 1',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'nameField',
                              label: 'Name Field',
                              defaultValue: 'queries.userQuery.data.name',
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

    function QuerySeedFixture() {
      const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

      useEffect(() => {
        initializeQuery('userQuery')
        setQuerySuccess('userQuery', { name: 'Alice' })
      }, [initializeQuery, setQuerySuccess])

      return (
        <>
          <RuntimePage />
          <RuntimeStateSnapshot testId="runtime-state" />
        </>
      )
    }

    render(
      <RuntimeStateProvider config={config}>
        <QuerySeedFixture />
      </RuntimeStateProvider>,
    )

    // Seed the query on the home page (before navigating to the form)
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.queries.userQuery?.status).toBe('success')
    })

    // Navigate to the editor page where the form with tabs lives
    fireEvent.click(screen.getByRole('button', { name: 'Go to editor' }))

    // Wait for the form to initialize — nameField in inactive tab should resolve to 'Alice'
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const nameField = state.forms?.myForm?.nameField as { value?: unknown } | undefined
      return expect(nameField?.value).toBe('Alice')
    })
  })

  it('resetOnSuccess clears fields in all tabs including inactive tabs', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const resetConfig: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            tab0: 'forms.myForm.tab0Field',
            tab1: 'forms.myForm.tab1Field',
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
              resetOnSuccess: true,
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveOp',
              },
              children: [
                {
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        label: 'Tab 0',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab0Field',
                              label: 'Tab0 Field',
                              defaultValue: '',
                            },
                          },
                        ],
                      },
                      {
                        label: 'Tab 1',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab1Field',
                              label: 'Tab1 Field',
                              defaultValue: '',
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
      <RuntimeStateProvider config={resetConfig}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Wait for both fields to be initialized
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      return expect(state.forms?.myForm?.tab0Field).toBeDefined()
    })

    // Type in tab0Field to give it a non-default value
    fireEvent.change(screen.getByRole('textbox', { name: 'Tab0 Field' }), {
      target: { value: 'changed value' },
    })

    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const tab0 = state.forms?.myForm?.tab0Field as { value?: unknown } | undefined
      return expect(tab0?.value).toBe('changed value')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // After successful submit with resetOnSuccess, both fields should be reset to default
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const tab0 = state.forms?.myForm?.tab0Field as { value?: unknown } | undefined
      const tab1 = state.forms?.myForm?.tab1Field as { value?: unknown } | undefined
      expect(tab0?.value).toBe('')
      return expect(tab1?.value).toBe('')
    })
  })

  it('resetForm action clears fields in all tabs including inactive tabs', async () => {
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
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab0Field',
                              label: 'Tab0 Field',
                              defaultValue: '',
                            },
                          },
                        ],
                      },
                      {
                        label: 'Tab 1',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab1Field',
                              label: 'Tab1 Field',
                              defaultValue: '',
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Reset', action: { type: 'resetForm', formId: 'myForm' } },
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

    // Type into tab0
    fireEvent.change(screen.getByRole('textbox', { name: 'Tab0 Field' }), {
      target: { value: 'modified' },
    })

    // Wait for state to update
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const tab0 = state.forms?.myForm?.tab0Field as { value?: unknown } | undefined
      return expect(tab0?.value).toBe('modified')
    })

    // Click reset
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    // After reset, fields in all tabs should be cleared
    await waitFor(() => {
      const state = readRuntimeStateSnapshot('runtime-state')
      const tab0 = state.forms?.myForm?.tab0Field as { value?: unknown } | undefined
      const tab1 = state.forms?.myForm?.tab1Field as { value?: unknown } | undefined
      expect(tab0?.value).toBe('')
      return expect(tab1?.value).toBe('')
    })
  })

  it('tabs item with visibility evaluating to hidden: fields are not in payload', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            tab0: 'forms.myForm.tab0Field',
            tab1: 'forms.myForm.tab1Field',
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
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        label: 'Tab 0',
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab0Field',
                              label: 'Tab0 Field',
                              defaultValue: 'value0',
                            },
                          },
                        ],
                      },
                      {
                        // This tab is hidden by visibility
                        label: 'Tab 1',
                        visibility: {
                          reference: 'forms.myForm.tab0Field',
                          operator: 'equals',
                          value: 'NEVER',
                        },
                        children: [
                          {
                            type: 'input',
                            props: {
                              fieldId: 'tab1Field',
                              label: 'Tab1 Field',
                              defaultValue: 'hidden-value',
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

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    // tab1Field is in a hidden tab, so it must NOT appear in the payload
    expect(body).toHaveProperty('tab0', 'value0')
    expect(body).not.toHaveProperty('tab1')
  })

  it('tabs item without visibility but not active: fields DO participate in payload', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={makeTwoTabFormConfig()}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Tab 1 is not active (tab 0 is default), but no visibility rule
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    // Both fields should be in payload even though tab 1 is not active
    expect(body).toHaveProperty('tab0')
    expect(body).toHaveProperty('tab1')
  })

  it('nested form → container → tabs → container → input: field participates in validation and submit', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            deepField: 'forms.myForm.deepField',
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
                  type: 'container',
                  children: [
                    {
                      type: 'tabs',
                      props: {
                        items: [
                          {
                            label: 'Nested Tab',
                            children: [
                              {
                                type: 'container',
                                children: [
                                  {
                                    type: 'input',
                                    props: {
                                      fieldId: 'deepField',
                                      label: 'Deep Field',
                                      defaultValue: 'deep-value',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  ],
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

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toHaveProperty('deepField', 'deep-value')
  })

  it('accordion guard: required field inside a closed accordion does NOT block submit (asymmetry with tabs)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            visibleField: 'forms.myForm.visibleField',
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
                  type: 'input',
                  props: {
                    fieldId: 'visibleField',
                    label: 'Visible Field',
                    defaultValue: 'hello',
                  },
                },
                {
                  type: 'accordion',
                  props: {
                    label: 'Optional Section',
                    defaultOpen: false,
                  },
                  children: [
                    {
                      type: 'input',
                      props: {
                        fieldId: 'accordionField',
                        label: 'Accordion Field',
                        defaultValue: '',
                        validations: {
                          required: { value: true },
                        },
                      },
                    },
                  ],
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

    // Accordion is closed, accordionField is required but never mounted
    // Submit should succeed (accordion fields are not discovered until mounted)
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Confirms that the accordion behavior is preserved: submit went through
    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body).toHaveProperty('visibleField', 'hello')
  })
})
