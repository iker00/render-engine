import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
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

const countryItems = [
  { label: 'Spain', value: 'ES' },
  { label: 'France', value: 'FR' },
]

function selectSuggestion(input: HTMLElement, searchText: string, optionName: string) {
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: searchText } })
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}

describe('Form submit — autocomplete field end-to-end', () => {
  it('single autocomplete with a value selected includes forms.{formId}.{fieldId} with the selected value', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: { country: 'forms.myForm.country' },
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
                  type: 'autocomplete',
                  props: { fieldId: 'country', label: 'Country', items: countryItems },
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

    selectSuggestion(screen.getByRole('combobox'), 'sp', 'Spain')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ country: 'ES' })
  })

  it('multiple autocomplete with several chips includes the array of values in the payload', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        saveOp: {
          method: 'POST',
          endpoint: '/api/save',
          body: { countries: 'forms.myForm.countries' },
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
                  type: 'autocomplete',
                  props: { fieldId: 'countries', label: 'Countries', items: countryItems, multiple: true },
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

    const input = screen.getByRole('combobox')
    selectSuggestion(input, 'sp', 'Spain')
    selectSuggestion(input, 'fr', 'France')

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ countries: ['ES', 'FR'] })
  })

  it('an autocomplete hidden by visibility at submit time, with a selection already made, omits the referenced key', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'searchForm',
          submitAction: { type: 'executeOperation', operationName: 'searchOp' },
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'searchType',
                label: 'Tipo de búsqueda',
                optionLayout: 'inline',
                items: [
                  { label: 'Nombre', value: 'nombre' },
                  { label: 'País', value: 'pais' },
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
              props: { fieldId: 'nameField', label: 'Nombre', defaultValue: 'Ada' },
            },
            {
              type: 'autocomplete',
              visibility: {
                reference: 'forms.searchForm.searchType',
                operator: 'equals',
                value: 'pais',
              },
              props: { fieldId: 'country', label: 'Country', items: countryItems },
            },
            { type: 'button', props: { label: 'Buscar' } },
          ],
        },
      ],
    }

    const config: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'POST',
          endpoint: '/api/search',
          body: {
            nombre: 'forms.searchForm.nameField',
            country: 'forms.searchForm.country',
          },
        },
      },
      initialPage: 'home',
      pages: [page],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Switch to "pais" mode to reveal the autocomplete, select a value, then switch back to
    // "nombre" mode so the autocomplete becomes hidden again with its selection still stored.
    fireEvent.click(screen.getByRole('radio', { name: 'País' }))
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeInTheDocument())

    selectSuggestion(screen.getByRole('combobox'), 'sp', 'Spain')

    fireEvent.click(screen.getByRole('radio', { name: 'Nombre' }))
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ nombre: 'Ada' })
    expect(body).not.toHaveProperty('country')
  })

  it('an autocomplete hidden by queryStateFeedback behaves the same as hidden by visibility', async () => {
    const fetchMock = makeSuccessFetch()
    globalThis.fetch = fetchMock

    const config: RuntimeConfig = {
      api: {
        searchOp: {
          method: 'POST',
          endpoint: '/api/search',
          body: {
            term: 'forms.searchForm.term',
            country: 'forms.searchForm.country',
          },
        },
        visibilityQuery: { method: 'GET', endpoint: '/api/visibility' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'searchForm',
              submitAction: { type: 'executeOperation', operationName: 'searchOp' },
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'term', label: 'Término', defaultValue: 'hello' },
                },
                {
                  type: 'autocomplete',
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
                  props: { fieldId: 'country', label: 'Country', items: countryItems },
                },
                { type: 'button', props: { label: 'Search' } },
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

    // visibilityQuery is idle → autocomplete is hidden by queryStateFeedback from the start,
    // so no selection can be made through it; submit must omit the referenced key regardless.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())

    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(init!.body as string) as Record<string, unknown>

    expect(body).toEqual({ term: 'hello' })
    expect(body).not.toHaveProperty('country')
  })
})
