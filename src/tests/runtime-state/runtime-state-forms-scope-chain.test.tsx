import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateSnapshot } from './helpers'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  vi.unstubAllGlobals()
})

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

function QuerySeed({ queryName, data }: { queryName: string; data: unknown }) {
  const { setQuerySuccess } = useRuntimeStateActions()

  return (
    <button type="button" onClick={() => setQuerySuccess(queryName, data)}>
      Seed {queryName}
    </button>
  )
}

function makeRowsConfig(): RuntimeConfig {
  return {
    api: {
      submitRow: {
        method: 'POST',
        endpoint: '/api/rows/submit',
        body: {
          name: 'forms.row-form.name',
        },
      },
    },
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'paragraph',
            props: {
              text: '{{forms.row-form.name}}',
            },
          },
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.rows.data', key: 'id' },
              template: [
                {
                  type: 'form',
                  id: 'row-form',
                  submitAction: {
                    type: 'executeOperation',
                    operationName: 'submitRow',
                  },
                  children: [
                    {
                      type: 'input',
                      props: {
                        fieldId: 'name',
                        label: 'Row name',
                        defaultValue: 'item.name',
                      },
                    },
                    {
                      type: 'button',
                      props: {
                        label: 'Reset row form',
                        action: { type: 'resetForm', formId: 'row-form' },
                      },
                    },
                    {
                      type: 'button',
                      props: { label: 'Submit row' },
                    },
                  ],
                },
              ],
            },
          },
          {
            type: 'button',
            props: {
              label: 'Reset row form from outside',
              action: { type: 'resetForm', formId: 'row-form' },
            },
          },
        ],
      },
    ],
  }
}

function renderRows(rows: Array<{ id: string; name: string }>) {
  const config = makeRowsConfig()

  const result = render(
    <RuntimeStateProvider config={config}>
      <QuerySeed queryName="rows" data={rows} />
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </RuntimeStateProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Seed rows' }))

  return result
}

describe('Runtime forms domain keyed by scope chain (T05, feature reusable-node-groups)', () => {
  it('keeps the literal formId as the store key for a form outside every repeater/group (cero regresión)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                { type: 'input', props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' } },
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

    const snapshot = readRuntimeStateSnapshot('runtime-state')
    expect(Object.keys(snapshot.forms)).toEqual(['profile-form'])
    expect(snapshot.forms['profile-form']?.name?.value).toBe('Ada')
  })

  it('keeps value, error, touched, dirty and defaultValue independent per iteration for the same formId', async () => {
    renderRows([
      { id: 'row-1', name: 'Alice' },
      { id: 'row-2', name: 'Bob' },
    ])

    await waitFor(() => expect(screen.getAllByLabelText('Row name')).toHaveLength(2))

    const [firstInput, secondInput] = screen.getAllByLabelText('Row name')
    fireEvent.change(firstInput, { target: { value: 'Alice edited' } })

    expect(firstInput).toHaveValue('Alice edited')
    expect(secondInput).toHaveValue('Bob')

    const snapshot = readRuntimeStateSnapshot('runtime-state')
    const formKeys = Object.keys(snapshot.forms).sort()
    expect(formKeys).toEqual(['row-form::r:row-1', 'row-form::r:row-2'])
    expect(snapshot.forms['row-form::r:row-1']?.name).toMatchObject({
      value: 'Alice edited',
      touched: true,
      dirty: true,
    })
    expect(snapshot.forms['row-form::r:row-2']?.name).toMatchObject({
      value: 'Bob',
      touched: false,
      dirty: false,
    })
  })

  it('resolves forms.row-form.name from inside its own iteration and degrades to not-found outside the repeater', async () => {
    renderRows([
      { id: 'row-1', name: 'Alice' },
      { id: 'row-2', name: 'Bob' },
    ])

    await waitFor(() => expect(screen.getAllByLabelText('Row name')).toHaveLength(2))

    // The page-level paragraph sits outside the repeater's scope chain: forms.row-form.name
    // has no unscoped entry to read from, so the interpolated placeholder degrades to empty text
    // instead of accidentally reading one of the iterations' values.
    const paragraph = document.querySelector('[data-layout-node="paragraph"]')
    expect(paragraph).not.toBeNull()
    expect(paragraph).toHaveTextContent('')
  })

  it('resets only the targeted iteration form when resetForm is triggered from inside it', async () => {
    renderRows([
      { id: 'row-1', name: 'Alice' },
      { id: 'row-2', name: 'Bob' },
    ])

    await waitFor(() => expect(screen.getAllByLabelText('Row name')).toHaveLength(2))

    const [firstInput, secondInput] = screen.getAllByLabelText('Row name')
    fireEvent.change(firstInput, { target: { value: 'Alice edited' } })
    fireEvent.change(secondInput, { target: { value: 'Bob edited' } })

    const [firstResetButton] = screen.getAllByRole('button', { name: 'Reset row form' })
    fireEvent.click(firstResetButton)

    expect(firstInput).toHaveValue('Alice')
    expect(secondInput).toHaveValue('Bob edited')
  })

  it('does not affect any iteration form when resetForm is triggered from outside the repeater', async () => {
    renderRows([
      { id: 'row-1', name: 'Alice' },
      { id: 'row-2', name: 'Bob' },
    ])

    await waitFor(() => expect(screen.getAllByLabelText('Row name')).toHaveLength(2))

    const [firstInput, secondInput] = screen.getAllByLabelText('Row name')
    fireEvent.change(firstInput, { target: { value: 'Alice edited' } })
    fireEvent.change(secondInput, { target: { value: 'Bob edited' } })

    fireEvent.click(screen.getByRole('button', { name: 'Reset row form from outside' }))

    expect(firstInput).toHaveValue('Alice edited')
    expect(secondInput).toHaveValue('Bob edited')
  })

  it('assembles the submit payload only with the fields of the submitting iteration', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    globalThis.fetch = fetchMock

    renderRows([
      { id: 'row-1', name: 'Alice' },
      { id: 'row-2', name: 'Bob' },
    ])

    await waitFor(() => expect(screen.getAllByLabelText('Row name')).toHaveLength(2))

    const [firstInput, secondInput] = screen.getAllByLabelText('Row name')
    fireEvent.change(firstInput, { target: { value: 'Alice edited' } })
    fireEvent.change(secondInput, { target: { value: 'Bob edited' } })

    const [, secondSubmitButton] = screen.getAllByRole('button', { name: 'Submit row' })
    fireEvent.click(secondSubmitButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    const sentBody = JSON.parse(String(requestInit.body))
    expect(sentBody).toEqual({ name: 'Bob edited' })
  })

  it('preserves each iteration own state independently when persistOnUnmount is enabled with two simultaneous iterations', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.rows.data', key: 'id' },
                template: [
                  {
                    type: 'form',
                    id: 'row-form',
                    persistOnUnmount: true,
                    children: [
                      {
                        type: 'input',
                        props: { fieldId: 'name', label: 'Row name', defaultValue: 'item.name' },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <QuerySeed queryName="rows" data={[
          { id: 'row-1', name: 'Alice' },
          { id: 'row-2', name: 'Bob' },
        ]} />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed rows' }))
    await waitFor(() => expect(screen.getAllByLabelText('Row name')).toHaveLength(2))

    const [firstInput, secondInput] = screen.getAllByLabelText('Row name')
    fireEvent.change(firstInput, { target: { value: 'Alice edited' } })
    fireEvent.change(secondInput, { target: { value: 'Bob edited' } })

    const snapshot = readRuntimeStateSnapshot('runtime-state')
    expect(snapshot.forms['row-form::r:row-1']?.name?.value).toBe('Alice edited')
    expect(snapshot.forms['row-form::r:row-2']?.name?.value).toBe('Bob edited')
  })
})
