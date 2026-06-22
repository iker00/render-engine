import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
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

/**
 * Config with two modes selected by a radioGroup (searchType).
 * Mode "nombre": shows nameField, hides dniField.
 * Mode "dni": shows dniField, hides nameField.
 * Default mode: "nombre".
 */
const twoModeConfig: RuntimeConfig = {
  api: {
    searchOp: {
      method: 'POST',
      endpoint: '/api/search',
      body: {
        nombre: 'forms.searchForm.nameField',
        dni: 'forms.searchForm.dniField',
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
          id: 'searchForm',
          submitAction: {
            type: 'executeOperation',
            operationName: 'searchOp',
          },
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'searchType',
                label: 'Tipo de búsqueda',
                optionLayout: 'inline',
                items: [
                  { label: 'Nombre', value: 'nombre' },
                  { label: 'DNI', value: 'dni' },
                ],
                defaultValue: 'nombre',
              },
            },
            {
              type: 'input',
              visibility: {
                reference: 'forms.searchForm.searchType',
                operator: 'equals',
                value: 'nombre',
              },
              props: {
                fieldId: 'nameField',
                label: 'Nombre',
                defaultValue: '',
              },
            },
            {
              type: 'input',
              visibility: {
                reference: 'forms.searchForm.searchType',
                operator: 'equals',
                value: 'dni',
              },
              props: {
                fieldId: 'dniField',
                label: 'DNI',
                defaultValue: '',
              },
            },
            {
              type: 'button',
              props: { label: 'Buscar' },
            },
          ],
        },
      ],
    },
  ],
}

describe('Form submit — hidden fields omitted from wire format', () => {
  it('in default mode (nombre), fetch receives only the nombre key and omits dni key', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={twoModeConfig}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ nombre: 'Ada' })
    expect(body).not.toHaveProperty('dni')
  })

  it('in default mode (nombre) without touching anything, fetch is called and body omits the hidden dni key', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={twoModeConfig}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).not.toHaveProperty('dni')
    expect(body).toHaveProperty('nombre')
  })

  it('after switching to dni mode, body contains dni and omits nombre', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={twoModeConfig}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'DNI' }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'DNI' })).toBeInTheDocument())

    fireEvent.change(screen.getByRole('textbox', { name: 'DNI' }), { target: { value: '12345678Z' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ dni: '12345678Z' })
    expect(body).not.toHaveProperty('nombre')
  })

  it('a visible field with empty string value travels with "" (not omitted)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            name: 'forms.myForm.name',
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
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: '',
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

    expect(body).toEqual({ name: '' })
  })

  it('a field hidden by queryStateFeedback is also omitted from the body', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'POST',
          endpoint: '/api/search',
          body: {
            term: 'forms.searchForm.term',
            extra: 'forms.searchForm.extraField',
          },
        },
        visibilityQuery: {
          method: 'GET',
          endpoint: '/api/visibility',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'searchForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'searchOp',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'term',
                    label: 'Término',
                    defaultValue: 'hello',
                  },
                },
                {
                  type: 'input',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      idle: { mode: 'hide' },
                      loading: { mode: 'hide' },
                      success: { mode: 'show' },
                      error: { mode: 'hide' },
                      empty: { mode: 'hide' },
                    },
                  },
                  props: {
                    fieldId: 'extraField',
                    label: 'Extra',
                    defaultValue: '',
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Search' },
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

    // visibilityQuery is idle → extraField is hidden by queryStateFeedback
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ term: 'hello' })
    expect(body).not.toHaveProperty('extra')
  })

  it('a key referencing params.X when X is missing still fails with request-build-failed (no silent omission)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'POST',
          endpoint: '/api/search',
          body: {
            missingParam: 'params.nonExistent',
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
                operationName: 'searchOp',
              },
              children: [
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

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('runtime-state').textContent ?? '') as {
        queries: { searchOp?: { status?: string } }
      })
        .toMatchObject({ queries: { searchOp: { status: 'error' } } }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a key referencing a field of another form (missing) still fails with request-build-failed', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'POST',
          endpoint: '/api/search',
          body: {
            otherField: 'forms.otherForm.someField',
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
                operationName: 'searchOp',
              },
              children: [
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

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('runtime-state').textContent ?? '') as {
        queries: { searchOp?: { status?: string } }
      })
        .toMatchObject({ queries: { searchOp: { status: 'error' } } }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a reference in endpoint to a hidden field of the form itself still fails with request-build-failed', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        getOp: {
          method: 'GET',
          endpoint: '/api/items/{{forms.searchForm.dniField}}',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'searchForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'getOp',
              },
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'searchType',
                    label: 'Tipo',
                    optionLayout: 'inline',
                    items: [
                      { label: 'Nombre', value: 'nombre' },
                      { label: 'DNI', value: 'dni' },
                    ],
                    defaultValue: 'nombre',
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.searchForm.searchType',
                    operator: 'equals',
                    value: 'dni',
                  },
                  props: {
                    fieldId: 'dniField',
                    label: 'DNI',
                    defaultValue: '',
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

    // dniField is hidden in default mode (nombre), but referenced in endpoint
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('runtime-state').textContent ?? '') as {
        queries: { getOp?: { status?: string } }
      })
        .toMatchObject({ queries: { getOp: { status: 'error' } } }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('nested body: body.A.B hidden, body.A.C visible → fetch receives { A: { C: value } }', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            A: {
              B: 'forms.searchForm.dniField',
              C: 'forms.searchForm.nameField',
            },
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
              id: 'searchForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveOp',
              },
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'searchType',
                    label: 'Tipo',
                    optionLayout: 'inline',
                    items: [
                      { label: 'Nombre', value: 'nombre' },
                      { label: 'DNI', value: 'dni' },
                    ],
                    defaultValue: 'nombre',
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.searchForm.searchType',
                    operator: 'equals',
                    value: 'nombre',
                  },
                  props: {
                    fieldId: 'nameField',
                    label: 'Nombre',
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.searchForm.searchType',
                    operator: 'equals',
                    value: 'dni',
                  },
                  props: {
                    fieldId: 'dniField',
                    label: 'DNI',
                    defaultValue: '',
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Save' },
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

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ A: { C: 'Ada' } })
  })

  it('nested body: all keys under A hidden → fetch receives { A: {} } (no pruning)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: {
            A: {
              B: 'forms.searchForm.dniField',
            },
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
              id: 'searchForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveOp',
              },
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'searchType',
                    label: 'Tipo',
                    optionLayout: 'inline',
                    items: [
                      { label: 'Nombre', value: 'nombre' },
                      { label: 'DNI', value: 'dni' },
                    ],
                    defaultValue: 'nombre',
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.searchForm.searchType',
                    operator: 'equals',
                    value: 'dni',
                  },
                  props: {
                    fieldId: 'dniField',
                    label: 'DNI',
                    defaultValue: '',
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Save' },
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

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ A: {} })
  })

  it('executeOperations branch: each operation receives hiddenFormFields and omits hidden keys', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        op1: {
          method: 'POST',
          endpoint: '/api/op1',
          body: {
            nombre: 'forms.searchForm.nameField',
            dni: 'forms.searchForm.dniField',
          },
        },
        op2: {
          method: 'POST',
          endpoint: '/api/op2',
          body: {
            nombre: 'forms.searchForm.nameField',
            dni: 'forms.searchForm.dniField',
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
              id: 'searchForm',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1' },
                  { operationName: 'op2' },
                ],
              },
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'searchType',
                    label: 'Tipo',
                    optionLayout: 'inline',
                    items: [
                      { label: 'Nombre', value: 'nombre' },
                      { label: 'DNI', value: 'dni' },
                    ],
                    defaultValue: 'nombre',
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.searchForm.searchType',
                    operator: 'equals',
                    value: 'nombre',
                  },
                  props: {
                    fieldId: 'nameField',
                    label: 'Nombre',
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.searchForm.searchType',
                    operator: 'equals',
                    value: 'dni',
                  },
                  props: {
                    fieldId: 'dniField',
                    label: 'DNI',
                    defaultValue: '',
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    for (const call of fetchMock.mock.calls) {
      const [, init] = call
      const body = JSON.parse(init!.body as string) as Record<string, unknown>
      expect(body).toEqual({ nombre: 'Ada' })
      expect(body).not.toHaveProperty('dni')
    }
  })
})
