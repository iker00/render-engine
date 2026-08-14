import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeTranslationsConfig } from '../../config/runtime-config-types'
import type { ResolvedEndpointOperation } from '../../dev-runtime/endpoints-config/resolve-endpoint-operation'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { TranslationsConfigPanel } from '../../dev-runtime/translations-panel/translations-config-panel'
import { isNumericTranslationKey } from '../../dev-runtime/translations-panel/translations-panel-helpers'
import type { TranslationsProvider } from '../../dev-runtime/translations-panel/translations-provider'

const noopCommitTranslationsMutation = (): CommitCanvasMutationResult => ({ status: 'applied' })

// A provider mock that never resolves unless a test overrides `searchTexts`/`getTranslationsBatch`
// — safe default for every test that doesn't exercise the search-and-add flow (0130-T4).
function createProviderMock(overrides: Partial<TranslationsProvider> = {}): TranslationsProvider {
  return {
    searchTexts: vi.fn(),
    getTranslationsBatch: vi.fn(),
    ...overrides,
  }
}

// 0131-T7: `searchResolution`/`refreshResolution` replace the old `tokens` prop + token dropdown.
// A single shared "ready" fixture keeps every existing token-value assertion (`token: 'abc'`)
// valid without touching call sites that don't specifically exercise availability.
const READY_RESOLUTION: ResolvedEndpointOperation = { status: 'ready', url: 'https://example.test/op', token: 'abc' }
const UNAVAILABLE_NOT_DECLARED: ResolvedEndpointOperation = { status: 'unavailable', reason: 'operation-not-declared' }
const UNAVAILABLE_TOKEN_NOT_RESOLVABLE: ResolvedEndpointOperation = {
  status: 'unavailable',
  reason: 'token-not-resolvable',
}

function renderPanel(
  translations: RuntimeTranslationsConfig | undefined,
  onCommitTranslationsMutation: (
    mutate: (prev: RuntimeTranslationsConfig | undefined) => RuntimeTranslationsConfig | undefined,
  ) => CommitCanvasMutationResult = noopCommitTranslationsMutation,
  provider: TranslationsProvider = createProviderMock(),
  searchResolution: ResolvedEndpointOperation = READY_RESOLUTION,
  refreshResolution: ResolvedEndpointOperation = READY_RESOLUTION,
) {
  return render(
    <TranslationsConfigPanel
      translations={translations}
      onCommitTranslationsMutation={onCommitTranslationsMutation}
      provider={provider}
      searchResolution={searchResolution}
      refreshResolution={refreshResolution}
    />,
  )
}

describe('TranslationsConfigPanel', () => {
  it('renders the root container and a "Traducciones" heading', () => {
    renderPanel(undefined)
    expect(screen.getByTestId('translations-config-panel')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Traducciones' })).toBeInTheDocument()
  })

  describe('empty state', () => {
    it('shows an explicit empty message and no table rows when translations is undefined', () => {
      renderPanel(undefined)
      expect(screen.getByText('Sin traducciones definidas')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.queryAllByRole('row')).toHaveLength(0)
    })

    it('shows the same empty message and no table rows when translations is {}', () => {
      renderPanel({})
      expect(screen.getByText('Sin traducciones definidas')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('with content', () => {
    it('renders one row per key with es/eu columns and the right cell values as editable inputs (0130-T3: cells are text inputs, not plain text)', () => {
      renderPanel({ hola: { es: 'Hola', eu: 'Kaixo' } })

      expect(screen.queryByText('Sin traducciones definidas')).not.toBeInTheDocument()
      const table = screen.getByRole('table')
      const rows = within(table).getAllByRole('row')
      // header row + one data row
      expect(rows).toHaveLength(2)

      expect(screen.getByRole('textbox', { name: 'Traducción de hola en es' })).toHaveValue('Hola')
      expect(screen.getByRole('textbox', { name: 'Traducción de hola en eu' })).toHaveValue('Kaixo')
      expect(screen.getByText('hola')).toBeInTheDocument()
    })

    it('unions languages across keys into columns, leaving a representable empty cell for a missing language', () => {
      renderPanel({ a: { es: 'A' }, b: { eu: 'B' } })

      const table = screen.getByRole('table')
      const headerRow = within(table).getAllByRole('row')[0]
      const columnHeaders = within(headerRow).getAllByRole('columnheader')
      // "Clave" + es + eu
      expect(columnHeaders).toHaveLength(3)

      const rows = within(table).getAllByRole('row')
      // header + a + b
      expect(rows).toHaveLength(3)

      const rowB = rows.find((row) => within(row).queryByText('b') !== null)
      expect(rowB).toBeDefined()
      expect(within(rowB as HTMLElement).queryByText('A')).not.toBeInTheDocument()
    })
  })

  it('does not invoke onCommitTranslationsMutation on initial render', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)
    expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
  })
})

// 0130-T3: manual editor controls (add/edit/delete/new-language/token dropdown) on top of T2's
// read-only skeleton.
describe('TranslationsConfigPanel manual add', () => {
  it('adds a new key with one language filled in via a mutator that produces { hola: { es: "Hola" } } from undefined', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ existing: { es: 'Existing' } }, onCommitTranslationsMutation)

    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'hola' } })
    fireEvent.change(screen.getByLabelText('es'), { target: { value: 'Hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate(undefined)).toEqual({ hola: { es: 'Hola' } })
  })

  it('rejects an empty key without committing and shows an inline alert', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ existing: { es: 'Existing' } }, onCommitTranslationsMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('rejects a duplicate key without committing and shows an inline alert', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('TranslationsConfigPanel cell editing', () => {
  it('commits an edited cell on blur with a mutator producing the updated entry', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    const input = screen.getByRole('textbox', { name: 'Traducción de hola en es' })
    fireEvent.change(input, { target: { value: 'Hola!' } })
    fireEvent.blur(input)

    expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ hola: { es: 'Hola' } })).toEqual({ hola: { es: 'Hola!' } })
  })

  it('fills a previously empty cell and commits it on blur', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' }, otra: { eu: 'Beste' } }, onCommitTranslationsMutation)

    const input = screen.getByRole('textbox', { name: 'Traducción de hola en eu' })
    fireEvent.change(input, { target: { value: 'Kaixo' } })
    fireEvent.blur(input)

    expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ hola: { es: 'Hola' }, otra: { eu: 'Beste' } })).toEqual({
      hola: { es: 'Hola', eu: 'Kaixo' },
      otra: { eu: 'Beste' },
    })
  })

  it('clearing an existing cell removes that language key from the entry', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    const input = screen.getByRole('textbox', { name: 'Traducción de hola en es' })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ hola: { es: 'Hola' } })).toEqual({ hola: {} })
  })

  it('does not commit when blurring without an actual value change', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    const input = screen.getByRole('textbox', { name: 'Traducción de hola en es' })
    fireEvent.change(input, { target: { value: 'Hola' } })
    fireEvent.blur(input)

    expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
  })
})

describe('TranslationsConfigPanel entry delete', () => {
  it('deletes an entry, leaving the other keys intact', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' }, adios: { es: 'Adiós' } }, onCommitTranslationsMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar entrada hola' }))

    expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ hola: { es: 'Hola' }, adios: { es: 'Adiós' } })).toEqual({ adios: { es: 'Adiós' } })
  })

  it('deleting the last entry leaves an empty object, not undefined', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar entrada hola' }))

    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ hola: { es: 'Hola' } })).toEqual({})
  })
})

describe('TranslationsConfigPanel add language', () => {
  it('adds a new empty column without committing anything (D5: the column is local until the first cell edit)', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))

    expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Traducción de hola en fr' })).toHaveValue('')
    const table = screen.getByRole('table')
    const headerRow = within(table).getAllByRole('row')[0]
    expect(within(headerRow).getAllByRole('columnheader')).toHaveLength(3) // Clave + es + fr
  })

  it('filling the pending column cell and blurring commits it', () => {
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))

    const input = screen.getByRole('textbox', { name: 'Traducción de hola en fr' })
    fireEvent.change(input, { target: { value: 'Bonjour' } })
    fireEvent.blur(input)

    expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ hola: { es: 'Hola' } })).toEqual({ hola: { es: 'Hola', fr: 'Bonjour' } })
  })

  it('rejects a language code already present in the union, without extending the column list', () => {
    renderPanel({ hola: { es: 'Hola' } })

    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'es' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    const table = screen.getByRole('table')
    const headerRow = within(table).getAllByRole('row')[0]
    expect(within(headerRow).getAllByRole('columnheader')).toHaveLength(2) // Clave + es only
  })

  it('rejects a language code already added locally as pending, without duplicating the column', () => {
    renderPanel({ hola: { es: 'Hola' } })

    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))
    fireEvent.change(screen.getByLabelText('Código de idioma'), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir idioma' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox', { name: 'Traducción de hola en fr' })).toHaveLength(1)
  })
})

// 0131-T7: the token dropdown is retired (FR10/FR11/D7). "Buscar y añadir" and "Refrescar todo"
// are now enabled/disabled independently from `searchResolution`/`refreshResolution`, each with
// its own explanatory text when unavailable.
describe('TranslationsConfigPanel action availability (0131-T7)', () => {
  it('never renders a token <select>, regardless of resolution status', () => {
    renderPanel({ hola: { es: 'Hola' } }, noopCommitTranslationsMutation, createProviderMock(), READY_RESOLUTION, READY_RESOLUTION)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    renderPanel(
      { hola: { es: 'Hola' } },
      noopCommitTranslationsMutation,
      createProviderMock(),
      UNAVAILABLE_NOT_DECLARED,
      UNAVAILABLE_NOT_DECLARED,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders both "Buscar" (0130-T4) and "Refrescar todo" (0130-T5)', () => {
    renderPanel({ hola: { es: 'Hola' } })
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refrescar todo' })).toBeInTheDocument()
  })

  it('enables "Buscar" when searchResolution is ready', () => {
    renderPanel({ hola: { es: 'Hola' } }, noopCommitTranslationsMutation, createProviderMock(), READY_RESOLUTION)
    expect(screen.getByRole('button', { name: 'Buscar' })).not.toBeDisabled()
  })

  it('disables "Buscar" and shows an explanatory message when searchResolution is unavailable/operation-not-declared', () => {
    renderPanel({ hola: { es: 'Hola' } }, noopCommitTranslationsMutation, createProviderMock(), UNAVAILABLE_NOT_DECLARED)
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    expect(screen.getByText(/operación .* no está declarada/i)).toBeInTheDocument()
  })

  it('disables "Buscar" and shows an explanatory message when searchResolution is unavailable/token-not-resolvable', () => {
    renderPanel(
      { hola: { es: 'Hola' } },
      noopCommitTranslationsMutation,
      createProviderMock(),
      UNAVAILABLE_TOKEN_NOT_RESOLVABLE,
    )
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    expect(screen.getByText(/no existe en tokens/i)).toBeInTheDocument()
  })

  it('enables "Refrescar todo" when refreshResolution is ready', () => {
    renderPanel(
      { '42': { es: 'Hola' } },
      noopCommitTranslationsMutation,
      createProviderMock(),
      READY_RESOLUTION,
      READY_RESOLUTION,
    )
    expect(screen.getByRole('button', { name: 'Refrescar todo' })).not.toBeDisabled()
  })

  it('disables "Refrescar todo" and shows an explanatory message when refreshResolution is unavailable/operation-not-declared', () => {
    renderPanel(
      { '42': { es: 'Hola' } },
      noopCommitTranslationsMutation,
      createProviderMock(),
      READY_RESOLUTION,
      UNAVAILABLE_NOT_DECLARED,
    )
    expect(screen.getByRole('button', { name: 'Refrescar todo' })).toBeDisabled()
    expect(screen.getByText(/operación .* no está declarada/i)).toBeInTheDocument()
  })

  it('disables "Refrescar todo" and shows an explanatory message when refreshResolution is unavailable/token-not-resolvable', () => {
    renderPanel(
      { '42': { es: 'Hola' } },
      noopCommitTranslationsMutation,
      createProviderMock(),
      READY_RESOLUTION,
      UNAVAILABLE_TOKEN_NOT_RESOLVABLE,
    )
    expect(screen.getByRole('button', { name: 'Refrescar todo' })).toBeDisabled()
    expect(screen.getByText(/no existe en tokens/i)).toBeInTheDocument()
  })

  it('enables each action independently: only one resolved does not enable the other', () => {
    renderPanel(
      { '42': { es: 'Hola' } },
      noopCommitTranslationsMutation,
      createProviderMock(),
      READY_RESOLUTION,
      UNAVAILABLE_NOT_DECLARED,
    )
    expect(screen.getByRole('button', { name: 'Buscar' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refrescar todo' })).toBeDisabled()
  })
})

// 0130-T4: "Buscar y añadir" against `TranslationsProvider.searchTexts`, plus batch commit via
// `onCommitTranslationsMutation`.
describe('TranslationsConfigPanel search and add', () => {
  it('calls provider.searchTexts with the typed text and searchResolution.token, and renders one row per result', async () => {
    const searchTexts = vi.fn().mockResolvedValue({
      status: 'ok',
      data: [
        { idTexto: 42, texto: 'Hola' },
        { idTexto: 43, texto: 'Adiós' },
      ],
    })
    const provider = createProviderMock({ searchTexts })
    renderPanel({}, noopCommitTranslationsMutation, provider)

    fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Hola')).toBeInTheDocument()
    expect(screen.getByText('Adiós')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('43')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Seleccionar resultado 42' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Seleccionar resultado 43' })).not.toBeChecked()
    expect(searchTexts).toHaveBeenCalledWith({ text: 'ho', token: 'abc' })
  })

  it('shows a loading indicator and disables "Buscar" while the search is pending, without blocking the rest of the panel', async () => {
    let resolveSearch!: (value: { status: 'ok'; data: [] }) => void
    const pending = new Promise<{ status: 'ok'; data: [] }>((resolve) => {
      resolveSearch = resolve
    })
    const searchTexts = vi.fn().mockReturnValue(pending)
    const provider = createProviderMock({ searchTexts })
    renderPanel({ hola: { es: 'Hola' } }, noopCommitTranslationsMutation, provider)

    fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    // The rest of the panel — manual editing of an existing row — stays usable during the search.
    expect(screen.getByRole('textbox', { name: 'Traducción de hola en es' })).not.toBeDisabled()

    resolveSearch({ status: 'ok', data: [] })
    await screen.findByText('Sin resultados')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows "Sin resultados" and no checkboxes when the provider returns an empty array, without raising an error', async () => {
    const searchTexts = vi.fn().mockResolvedValue({ status: 'ok', data: [] })
    const provider = createProviderMock({ searchTexts })
    renderPanel({}, noopCommitTranslationsMutation, provider)

    fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'zzz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('marks a result whose id already exists in translations as "ya existe" with a disabled, unselectable checkbox', async () => {
    const searchTexts = vi.fn().mockResolvedValue({ status: 'ok', data: [{ idTexto: 42, texto: 'Hola' }] })
    const provider = createProviderMock({ searchTexts })
    renderPanel({ '42': { es: 'Hola' } }, noopCommitTranslationsMutation, provider)

    fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    const checkbox = await screen.findByRole('checkbox', { name: 'Seleccionar resultado 42' })
    expect(checkbox).toBeDisabled()
    expect(screen.getByText(/ya existe/i)).toBeInTheDocument()

    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  describe('adding selected results', () => {
    it('adds a single selected result via one onCommitTranslationsMutation call, keyed by String(idTexto) with the provider default language', async () => {
      const searchTexts = vi.fn().mockResolvedValue({
        status: 'ok',
        data: [
          { idTexto: 42, texto: 'Hola' },
          { idTexto: 43, texto: 'Adiós' },
        ],
      })
      const provider = createProviderMock({ searchTexts })
      const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
      renderPanel({ '42': { es: 'Hola' } }, onCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByText('Adiós')

      fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar resultado 43' }))
      fireEvent.click(screen.getByRole('button', { name: 'Añadir seleccionados' }))

      expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitTranslationsMutation.mock.calls[0][0]
      expect(mutate({ '42': { es: 'Hola' } })).toEqual({ '42': { es: 'Hola' }, '43': { es: 'Adiós' } })
    })

    it('adds two results selected from the same search in a single commit', async () => {
      const searchTexts = vi.fn().mockResolvedValue({
        status: 'ok',
        data: [
          { idTexto: 43, texto: 'Adiós' },
          { idTexto: 44, texto: 'Gracias' },
        ],
      })
      const provider = createProviderMock({ searchTexts })
      const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
      renderPanel({}, onCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'a' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByText('Gracias')

      fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar resultado 43' }))
      fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar resultado 44' }))
      fireEvent.click(screen.getByRole('button', { name: 'Añadir seleccionados' }))

      expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitTranslationsMutation.mock.calls[0][0]
      expect(mutate(undefined)).toEqual({ '43': { es: 'Adiós' }, '44': { es: 'Gracias' } })
    })

    it('clears the result list and selections after a successful commit, keeping the search input text', async () => {
      const searchTexts = vi.fn().mockResolvedValue({ status: 'ok', data: [{ idTexto: 43, texto: 'Adiós' }] })
      const provider = createProviderMock({ searchTexts })
      renderPanel({}, noopCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByText('Adiós')

      fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar resultado 43' }))
      fireEvent.click(screen.getByRole('button', { name: 'Añadir seleccionados' }))

      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
      expect(screen.queryByText('Adiós')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Buscar texto')).toHaveValue('ho')
    })

    it('does not invoke onCommitTranslationsMutation when "Añadir seleccionados" is used without any selection', async () => {
      const searchTexts = vi.fn().mockResolvedValue({ status: 'ok', data: [{ idTexto: 43, texto: 'Adiós' }] })
      const provider = createProviderMock({ searchTexts })
      const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
      renderPanel({}, onCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByText('Adiós')

      fireEvent.click(screen.getByRole('button', { name: 'Añadir seleccionados' }))

      expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    })

    it('shows an alert and keeps the selection when the commit is rejected by onCommitTranslationsMutation', async () => {
      const searchTexts = vi.fn().mockResolvedValue({ status: 'ok', data: [{ idTexto: 43, texto: 'Adiós' }] })
      const provider = createProviderMock({ searchTexts })
      const rejected: CommitCanvasMutationResult = {
        status: 'rejected',
        error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
      }
      const onCommitTranslationsMutation = vi.fn(() => rejected)
      renderPanel({}, onCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByText('Adiós')

      fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar resultado 43' }))
      fireEvent.click(screen.getByRole('button', { name: 'Añadir seleccionados' }))

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Seleccionar resultado 43' })).toBeChecked()
      expect(screen.getByText('Adiós')).toBeInTheDocument()
    })
  })

  describe('provider errors', () => {
    it('shows an alert with the auth error message and does not touch translations', async () => {
      const searchTexts = vi.fn().mockResolvedValue({
        status: 'error',
        error: { kind: 'auth', message: 'La autenticación con el proveedor externo falló.' },
      })
      const provider = createProviderMock({ searchTexts })
      const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
      renderPanel({}, onCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('La autenticación con el proveedor externo falló.')
      expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    })

    it('shows an alert with the integration error message', async () => {
      const searchTexts = vi.fn().mockResolvedValue({
        status: 'error',
        error: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
      })
      const provider = createProviderMock({ searchTexts })
      renderPanel({}, noopCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('No se pudo contactar con el proveedor externo.')
    })

    it('clears the search error when the user types new search text', async () => {
      const searchTexts = vi.fn().mockResolvedValue({ status: 'error', error: { kind: 'auth', message: 'falló' } })
      const provider = createProviderMock({ searchTexts })
      renderPanel({}, noopCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByRole('alert')

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'hol' } })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('clears the search error after a later successful search', async () => {
      const searchTexts = vi
        .fn()
        .mockResolvedValueOnce({ status: 'error', error: { kind: 'integration', message: 'falló' } })
        .mockResolvedValueOnce({ status: 'ok', data: [] })
      const provider = createProviderMock({ searchTexts })
      renderPanel({}, noopCommitTranslationsMutation, provider)

      fireEvent.change(screen.getByLabelText('Buscar texto'), { target: { value: 'ho' } })
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByRole('alert')

      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
      await screen.findByText('Sin resultados')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

describe('TranslationsConfigPanel commit rejection feedback', () => {
  const rejected: CommitCanvasMutationResult = {
    status: 'rejected',
    error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
  }

  it('shows an alert with the code/message when adding an entry is rejected, and clears it after a later success', () => {
    const onCommitTranslationsMutation = vi.fn().mockReturnValueOnce(rejected).mockReturnValueOnce({ status: 'applied' })
    renderPanel({ existing: { es: 'Existing' } }, onCommitTranslationsMutation)

    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('invalid-layout')
    expect(alert.textContent).toContain('Valor no válido')

    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an alert when editing a cell is rejected, keeps the attempted value, and clears the alert after a later success on the same cell', () => {
    const onCommitTranslationsMutation = vi.fn().mockReturnValueOnce(rejected).mockReturnValueOnce({ status: 'applied' })
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    const input = screen.getByRole('textbox', { name: 'Traducción de hola en es' })
    fireEvent.change(input, { target: { value: 'Hola!' } })
    fireEvent.blur(input)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(input).toHaveValue('Hola!')

    fireEvent.change(input, { target: { value: 'Hola!!' } })
    fireEvent.blur(input)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an alert when deleting a row is rejected', () => {
    const onCommitTranslationsMutation = vi.fn(() => rejected)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Borrar entrada hola' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('keeps rejection alerts independent per row: a rejection on one row does not hide a rejection on another', () => {
    const onCommitTranslationsMutation = vi.fn(() => rejected)
    renderPanel({ hola: { es: 'Hola' }, adios: { es: 'Adiós' } }, onCommitTranslationsMutation)

    const holaInput = screen.getByRole('textbox', { name: 'Traducción de hola en es' })
    fireEvent.change(holaInput, { target: { value: 'Hola!' } })
    fireEvent.blur(holaInput)

    const adiosInput = screen.getByRole('textbox', { name: 'Traducción de adios en es' })
    fireEvent.change(adiosInput, { target: { value: 'Adiós!' } })
    fireEvent.blur(adiosInput)

    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })
})

// 0130-T5: "Refrescar todo" against `TranslationsProvider.getTranslationsBatch`. Collects numeric
// keys of `translations`, sends them as a single batch, and patches only the languages present in
// `PROVIDER_LANGUAGE_MAP` (1 → es, 2 → eu) via a single onCommitTranslationsMutation call.
describe('TranslationsConfigPanel refresh all', () => {
  it('does not call the provider or commit when there is no numeric key, and shows an informational (non-alert) notice', () => {
    const getTranslationsBatch = vi.fn()
    const provider = createProviderMock({ getTranslationsBatch })
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ hola: { es: 'Hola' } }, onCommitTranslationsMutation, provider)

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar todo' }))

    expect(getTranslationsBatch).not.toHaveBeenCalled()
    expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    expect(screen.getByText('Sin claves refrescables')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls getTranslationsBatch with the numeric keys as integers and refreshResolution.token, excluding manual keys, and commits a single patched object', async () => {
    const getTranslationsBatch = vi.fn().mockResolvedValue({
      status: 'ok',
      data: [
        {
          idTexto: 42,
          traducciones: [
            { idioma: 1, texto: 'Hola!' },
            { idioma: 2, texto: 'Kaixo' },
          ],
        },
      ],
    })
    const provider = createProviderMock({ getTranslationsBatch })
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel(
      { '42': { es: 'Hola', eu: '' }, '43': { es: 'Adiós' }, manual: { es: 'Manual' } },
      onCommitTranslationsMutation,
      provider,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar todo' }))

    await waitFor(() => expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1))
    expect(getTranslationsBatch).toHaveBeenCalledWith({ ids: [42, 43], token: 'abc' })
    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ '42': { es: 'Hola', eu: '' }, '43': { es: 'Adiós' }, manual: { es: 'Manual' } })).toEqual({
      '42': { es: 'Hola!', eu: 'Kaixo' },
      '43': { es: 'Adiós' },
      manual: { es: 'Manual' },
    })
  })

  it('ignores an unmapped idioma silently, keeping the rest of that entry untouched, and does not create an unknown language key', async () => {
    const getTranslationsBatch = vi.fn().mockResolvedValue({
      status: 'ok',
      data: [
        {
          idTexto: 42,
          traducciones: [
            { idioma: 1, texto: 'Hola!' },
            { idioma: 99, texto: 'foo' },
          ],
        },
      ],
    })
    const provider = createProviderMock({ getTranslationsBatch })
    const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
    renderPanel({ '42': { es: 'Hola', eu: '' } }, onCommitTranslationsMutation, provider)

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar todo' }))
    await waitFor(() => expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(1))

    const mutate = onCommitTranslationsMutation.mock.calls[0][0]
    expect(mutate({ '42': { es: 'Hola', eu: '' } })).toEqual({ '42': { es: 'Hola!', eu: '' } })
  })

  it.each(['auth', 'integration'] as const)(
    'shows an alert for a %s provider error, does not commit, and leaves translations intact',
    async (kind) => {
      const getTranslationsBatch = vi.fn().mockResolvedValue({ status: 'error', error: { kind, message: 'falló' } })
      const provider = createProviderMock({ getTranslationsBatch })
      const onCommitTranslationsMutation = vi.fn(noopCommitTranslationsMutation)
      renderPanel({ '42': { es: 'Hola' } }, onCommitTranslationsMutation, provider)

      fireEvent.click(screen.getByRole('button', { name: 'Refrescar todo' }))

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('falló')
      expect(onCommitTranslationsMutation).not.toHaveBeenCalled()
    },
  )

  it('shows the CommitRejectionBanner when the commit is rejected, and clears it after a later successful commit', async () => {
    const getTranslationsBatch = vi.fn().mockResolvedValue({
      status: 'ok',
      data: [{ idTexto: 42, traducciones: [{ idioma: 1, texto: 'Hola!' }] }],
    })
    const provider = createProviderMock({ getTranslationsBatch })
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitTranslationsMutation = vi
      .fn()
      .mockReturnValueOnce(rejected)
      .mockReturnValueOnce({ status: 'applied' })
    renderPanel({ '42': { es: 'Hola' } }, onCommitTranslationsMutation, provider)

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar todo' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar todo' }))
    await waitFor(() => expect(onCommitTranslationsMutation).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a loading indicator and disables the button while pending; a second click during that time does not trigger a second call', async () => {
    let resolveBatch!: (value: { status: 'ok'; data: never[] }) => void
    const pending = new Promise<{ status: 'ok'; data: never[] }>((resolve) => {
      resolveBatch = resolve
    })
    const getTranslationsBatch = vi.fn().mockReturnValue(pending)
    const provider = createProviderMock({ getTranslationsBatch })
    renderPanel({ '42': { es: 'Hola' } }, noopCommitTranslationsMutation, provider)

    const button = screen.getByRole('button', { name: 'Refrescar todo' })
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent.click(button)
    expect(getTranslationsBatch).toHaveBeenCalledTimes(1)

    resolveBatch({ status: 'ok', data: [] })
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})

describe('isNumericTranslationKey', () => {
  it.each(['0', '1', '42'])('returns true for "%s"', (key) => {
    expect(isNumericTranslationKey(key)).toBe(true)
  })

  it.each(['', 'abc', '12abc', ' 42', '-1', '1.5'])('returns false for "%s"', (key) => {
    expect(isNumericTranslationKey(key)).toBe(false)
  })
})
