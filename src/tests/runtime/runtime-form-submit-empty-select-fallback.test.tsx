import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { DynamicSelectQueryFixture, RuntimeStateSnapshot } from '../runtime-state/helpers'

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
 * A single-select "role" field inside a "myForm" form whose submit posts
 * `forms.myForm.role` as `body.role`. Parametrized on the bits each test in
 * this file needs to vary: whether `emptySubmitValue` is declared, whether
 * `required` is declared, whether the select is hidden by visibility, and
 * whether `multiple` is set (for the 0121-T1 bootstrap regression check).
 */
function buildRoleFormConfig(
  options: {
    emptySubmitValue?: string | number
    required?: boolean
    hidden?: boolean
    multiple?: boolean
  } = {},
): RuntimeConfig {
  return {
    api: {
      submitOp: {
        method: 'POST',
        endpoint: '/api/submit',
        body: {
          role: 'forms.myForm.role',
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
              operationName: 'submitOp',
            },
            children: [
              {
                type: 'select',
                visibility: options.hidden
                  ? { reference: 'forms.myForm.neverField', operator: 'equals', value: 'never' }
                  : undefined,
                props: {
                  fieldId: 'role',
                  label: 'Role',
                  items: [
                    { label: 'Admin', value: 'admin' },
                    { label: 'User', value: 'user' },
                  ],
                  multiple: options.multiple,
                  emptySubmitValue: options.emptySubmitValue,
                  validations: options.required ? { required: { value: true } } : undefined,
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

describe('Form submit — select emptySubmitValue fallback', () => {
  it('AC1: an empty single select with emptySubmitValue configured sends the substitute value instead of ""', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: 'N/A' })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ role: 'N/A' })
  })

  it('AC4 (manual scalar items): substitutes even when emptySubmitValue matches no item value', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        submitOp: {
          method: 'POST',
          endpoint: '/api/submit',
          body: { role: 'forms.myForm.role' },
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
              submitAction: { type: 'executeOperation', operationName: 'submitOp' },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    emptySubmitValue: 'N/A',
                    items: { values: ['admin', 'user'] },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
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

    expect(body).toEqual({ role: 'N/A' })
  })

  it('AC2 (regression): an empty single select without emptySubmitValue still sends ""', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig()}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ role: '' })
  })

  it('AC3: a real selection is sent unchanged when emptySubmitValue is configured', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: 'N/A' })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ role: 'admin' })
  })

  it('AC3 (regression): a real selection is sent unchanged without emptySubmitValue configured', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig()}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ role: 'admin' })
  })

  it('AC5: required blocks submit locally even with emptySubmitValue configured (no network call)', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: 'N/A', required: true })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('AC6 (0121-T1 regression, verified end-to-end): a full config with multiple:true and emptySubmitValue is rejected at bootstrap', () => {
    const config = buildRoleFormConfig({ emptySubmitValue: 'N/A', multiple: true })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
  })

  it('AC7: another field whose dynamic defaultValue references the empty select still resolves to ""', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        submitOp: {
          method: 'POST',
          endpoint: '/api/submit',
          body: {
            role: 'forms.myForm.role',
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
              submitAction: { type: 'executeOperation', operationName: 'submitOp' },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    emptySubmitValue: 'N/A',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'User', value: 'user' },
                    ],
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'effectiveRole',
                    label: 'Effective Role',
                    defaultValue: 'forms.myForm.role',
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
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

    expect(screen.getByRole('textbox', { name: 'Effective Role' })).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // The dependent field kept resolving to "" throughout — it never saw the substitution value.
    expect(screen.getByRole('textbox', { name: 'Effective Role' })).toHaveValue('')
  })

  it('edge case: emptySubmitValue 0 is sent as the string "0"', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: 0 })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body.role).toBe('0')
    expect(typeof body.role).toBe('string')
  })

  it('edge case: emptySubmitValue explicitly set to "" behaves exactly like not declaring it', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: '' })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ role: '' })
  })

  it('edge case: a select hidden by visibility with emptySubmitValue configured omits the key entirely', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: 'N/A', hidden: true })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).not.toHaveProperty('role')
  })

  it('edge case: a real selection that disappears from a refreshed dynamic collection is substituted at submit', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            role: 'forms.profileForm.role',
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
              id: 'profileForm',
              submitAction: { type: 'executeOperation', operationName: 'submitProfile' },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    emptySubmitValue: 'N/A',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      itemType: 'object',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Submit dynamic profile' },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('editor')

    // The catalog refreshes and no longer contains "editor" — the effect resets the field to "".
    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))

    fireEvent.click(screen.getByRole('button', { name: 'Submit dynamic profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ role: 'N/A' })
  })

  it('surface coverage: substitutes emptySubmitValue in api.query', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        submitOp: {
          method: 'POST',
          endpoint: '/api/submit',
          query: {
            role: 'forms.myForm.role',
          },
          body: null,
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
              submitAction: { type: 'executeOperation', operationName: 'submitOp' },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    emptySubmitValue: 'N/A',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'User', value: 'user' },
                    ],
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
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

    const [url] = fetchMock.mock.calls[0]!
    const requestUrl = new URL(url as string, 'http://localhost')

    expect(requestUrl.searchParams.get('role')).toBe('N/A')
  })

  it('surface coverage: substitutes emptySubmitValue inside interpolated submitAction.headers', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        submitOp: {
          method: 'POST',
          endpoint: '/api/submit',
          body: null,
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
                operationName: 'submitOp',
                headers: {
                  'X-Role': 'Bearer {{forms.myForm.role}}',
                },
              },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    emptySubmitValue: 'N/A',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'User', value: 'user' },
                    ],
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
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
    expect((init?.headers as Record<string, string>)?.['X-Role']).toBe('Bearer N/A')
  })

  it('regression (NFR): the store and the <select> DOM keep showing "" after a submit whose payload carried the substitute', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={buildRoleFormConfig({ emptySubmitValue: 'N/A' })}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>
    expect(body).toEqual({ role: 'N/A' })

    // The visible DOM and the store snapshot must still reflect the untouched "" field value.
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":""')
  })
})
