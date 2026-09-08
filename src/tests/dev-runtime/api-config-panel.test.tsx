import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiConfigPanel } from '../../dev-runtime/api-config-panel/api-config-panel'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import type { RuntimeApiConfig, RuntimePreloadConfig } from '../../config/runtime-config-types'
import type { RuntimeConfigError } from '../../config/runtime-config'

const noopCommit = (): CommitCanvasMutationResult => ({ status: 'applied' })

type PreloadsOverrides = Partial<{
  globalPreloads: RuntimePreloadConfig[] | undefined
  activePageId: string
  pagePreloads: RuntimePreloadConfig[] | undefined
  onCommitGlobalPreloadsMutation: (
    mutate: (preloads: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
  onCommitPagePreloadsMutation: (
    mutate: (preloads: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
}>

function renderPanel(
  api: RuntimeApiConfig,
  onCommitApiMutation = vi.fn(noopCommit),
  preloadsOverrides: PreloadsOverrides = {},
) {
  const onCommitGlobalPreloadsMutation = preloadsOverrides.onCommitGlobalPreloadsMutation ?? vi.fn(noopCommit)
  const onCommitPagePreloadsMutation = preloadsOverrides.onCommitPagePreloadsMutation ?? vi.fn(noopCommit)
  const utils = render(
    <ApiConfigPanel
      api={api}
      onCommitApiMutation={onCommitApiMutation}
      globalPreloads={preloadsOverrides.globalPreloads}
      activePageId={preloadsOverrides.activePageId ?? 'home'}
      pagePreloads={preloadsOverrides.pagePreloads}
      onCommitGlobalPreloadsMutation={onCommitGlobalPreloadsMutation}
      onCommitPagePreloadsMutation={onCommitPagePreloadsMutation}
    />,
  )
  return { ...utils, onCommitApiMutation, onCommitGlobalPreloadsMutation, onCommitPagePreloadsMutation }
}

function makeRejectionError(message: string): RuntimeConfigError {
  return { code: 'invalid-layout', displayMode: 'development-only', message }
}

function operationRow(name: string) {
  return within(screen.getByTestId(`api-config-panel-operation-${name}`))
}

describe('ApiConfigPanel', () => {
  it('renders the root container with data-testid="api-config-panel"', () => {
    renderPanel({})
    expect(screen.getByTestId('api-config-panel')).toBeInTheDocument()
  })

  it('renders a tablist with two tabs, "Operaciones" active by default', () => {
    renderPanel({})
    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeInTheDocument()

    const operationsTab = screen.getByRole('tab', { name: 'Operaciones' })
    const preloadsTab = screen.getByRole('tab', { name: 'Preloads' })
    expect(operationsTab).toHaveAttribute('aria-selected', 'true')
    expect(preloadsTab).toHaveAttribute('aria-selected', 'false')
  })

  it('shows an empty-state message in the "Operaciones" tabpanel when api is {}, alongside the add form (T5 regression)', () => {
    renderPanel({})
    expect(screen.getByTestId('api-config-panel-operations-panel')).toHaveTextContent(/sin operaciones/i)
    expect(screen.getByText('Añadir operación')).toBeInTheDocument()
    expect(screen.getByLabelText('Clave')).toBeInTheDocument()
    expect(screen.getByLabelText('Endpoint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeInTheDocument()
  })

  it('keeps the "Preloads" tabpanel present in the DOM but hidden while "Operaciones" is active', () => {
    renderPanel({})
    const preloadsPanel = screen.getByTestId('api-config-panel-preloads-panel')
    expect(preloadsPanel).toBeInTheDocument()
    expect(preloadsPanel).toHaveClass('hidden')
  })

  it('switches to the "Preloads" tabpanel when its tab is clicked, showing its two sections and hiding "Operaciones"', () => {
    renderPanel({ search: { method: 'GET', endpoint: '/x' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Preloads' }))

    expect(screen.getByRole('tab', { name: 'Preloads' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Operaciones' })).toHaveAttribute('aria-selected', 'false')

    const preloadsPanel = screen.getByTestId('api-config-panel-preloads-panel')
    expect(preloadsPanel).not.toHaveClass('hidden')
    expect(preloadsPanel).toHaveTextContent('Precargas globales')
    expect(preloadsPanel).toHaveTextContent('Precargas de la página activa')

    const operationsPanel = screen.getByTestId('api-config-panel-operations-panel')
    expect(operationsPanel).toHaveClass('hidden')
  })

  it('does not invoke onCommitApiMutation on initial render nor when switching sub-views', () => {
    const onCommitApiMutation = vi.fn(noopCommit)
    renderPanel({ search: { method: 'GET', endpoint: '/x' } }, onCommitApiMutation)

    fireEvent.click(screen.getByRole('tab', { name: 'Preloads' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Operaciones' }))

    expect(onCommitApiMutation).not.toHaveBeenCalled()
  })

  describe('adding an operation', () => {
    it('commits { [key]: { method: "GET", endpoint } } with default method GET over an empty api', () => {
      const onCommitApiMutation = vi.fn(noopCommit)
      renderPanel({}, onCommitApiMutation)

      fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'search' } })
      fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: '/api/search' } })
      fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

      expect(onCommitApiMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitApiMutation.mock.calls[0][0]
      expect(mutate({})).toEqual({ search: { method: 'GET', endpoint: '/api/search' } })
    })

    it('rejects a duplicate key locally without invoking onCommitApiMutation, showing a role="alert" with the key', () => {
      const onCommitApiMutation = vi.fn(noopCommit)
      renderPanel({ existing: { method: 'GET', endpoint: '/x' } }, onCommitApiMutation)

      fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'existing' } })
      fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

      expect(onCommitApiMutation).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/existing/)
    })

    it('rejects an empty (whitespace-only) key locally without invoking onCommitApiMutation', () => {
      const onCommitApiMutation = vi.fn(noopCommit)
      renderPanel({}, onCommitApiMutation)

      fireEvent.change(screen.getByLabelText('Clave'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

      expect(onCommitApiMutation).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('invokes onCommitApiMutation with an empty endpoint and shows CommitRejectionBanner when the real commit is rejected', () => {
      const rejectionError = makeRejectionError('endpoint no puede estar vacío')
      const onCommitApiMutation = vi.fn((): CommitCanvasMutationResult => ({ status: 'rejected', error: rejectionError }))
      renderPanel({}, onCommitApiMutation)

      fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'search' } })
      fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))

      expect(onCommitApiMutation).toHaveBeenCalledTimes(1)
      const banner = screen.getByTestId('api-config-panel-add-error')
      expect(banner).toHaveTextContent(rejectionError.message)
    })
  })

  describe('deleting an operation', () => {
    it('commits api without the deleted key', () => {
      const onCommitApiMutation = vi.fn(noopCommit)
      renderPanel({ search: { method: 'GET', endpoint: '/x' }, other: { method: 'GET', endpoint: '/y' } }, onCommitApiMutation)

      fireEvent.click(screen.getByRole('button', { name: 'Borrar operación search' }))

      expect(onCommitApiMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitApiMutation.mock.calls[0][0]
      expect(
        mutate({ search: { method: 'GET', endpoint: '/x' }, other: { method: 'GET', endpoint: '/y' } }),
      ).toEqual({ other: { method: 'GET', endpoint: '/y' } })
    })
  })

  describe('method field and body visibility', () => {
    it('changing method from GET to POST commits only that field, preserving endpoint/query/headers, and reveals body', () => {
      const initialApi: RuntimeApiConfig = {
        search: { method: 'GET', endpoint: '/x', query: { a: '1' }, headers: { h: '1' } },
      }
      const onCommitApiMutation = vi.fn(noopCommit)
      const { rerender } = renderPanel(initialApi, onCommitApiMutation)

      const rowBefore = operationRow('search')
      expect(rowBefore.queryByRole('group', { name: 'Body' })).not.toBeInTheDocument()
      expect(rowBefore.queryByLabelText('Body')).not.toBeInTheDocument()

      fireEvent.click(rowBefore.getByRole('radio', { name: 'POST' }))

      expect(onCommitApiMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitApiMutation.mock.calls[0][0]
      const mutatedApi = mutate(initialApi)
      expect(mutatedApi).toEqual({
        search: { method: 'POST', endpoint: '/x', query: { a: '1' }, headers: { h: '1' } },
      })

      rerender(<ApiConfigPanel api={mutatedApi} onCommitApiMutation={onCommitApiMutation} />)
      const rowAfter = operationRow('search')
      expect(rowAfter.getByRole('group', { name: 'Body' })).toBeInTheDocument()
    })

    it('changing method from POST to GET hides body without discarding it; a later field commit still carries the previous body intact', () => {
      const initialApi: RuntimeApiConfig = {
        search: { method: 'POST', endpoint: '/x', body: { b: '1' } },
      }
      const onCommitApiMutation = vi.fn(noopCommit)
      const { rerender } = renderPanel(initialApi, onCommitApiMutation)

      const rowBefore = operationRow('search')
      expect(rowBefore.getByRole('group', { name: 'Body' })).toBeInTheDocument()

      fireEvent.click(rowBefore.getByRole('radio', { name: 'GET' }))

      expect(onCommitApiMutation).toHaveBeenCalledTimes(1)
      const firstMutate = onCommitApiMutation.mock.calls[0][0]
      const afterMethodChange = firstMutate(initialApi)
      expect(afterMethodChange).toEqual({ search: { method: 'GET', endpoint: '/x', body: { b: '1' } } })

      rerender(<ApiConfigPanel api={afterMethodChange} onCommitApiMutation={onCommitApiMutation} />)
      const rowAfter = operationRow('search')
      expect(rowAfter.queryByRole('group', { name: 'Body' })).not.toBeInTheDocument()
      expect(rowAfter.queryByLabelText('Body')).not.toBeInTheDocument()

      fireEvent.change(rowAfter.getByLabelText('Endpoint'), { target: { value: '/y' } })

      expect(onCommitApiMutation).toHaveBeenCalledTimes(2)
      const secondMutate = onCommitApiMutation.mock.calls[1][0]
      const afterEndpointChange = secondMutate(afterMethodChange)
      expect(afterEndpointChange).toEqual({ search: { method: 'GET', endpoint: '/y', body: { b: '1' } } })
    })
  })

  describe('editing query/headers/body rows', () => {
    it('commits the full updated map for each field, preserving the rest of the operation', () => {
      const initialApi: RuntimeApiConfig = {
        search: {
          method: 'POST',
          endpoint: '/x',
          query: { q: 'old' },
          headers: { h: 'old' },
          body: { b: 'old' },
        },
      }
      const onCommitApiMutation = vi.fn(noopCommit)
      renderPanel(initialApi, onCommitApiMutation)
      const row = operationRow('search')

      fireEvent.change(row.getByLabelText('Query valor #1'), { target: { value: 'new-q' } })
      fireEvent.change(row.getByLabelText('Headers valor #1'), { target: { value: 'new-h' } })
      fireEvent.change(row.getByLabelText('Body valor #1'), { target: { value: 'new-b' } })

      expect(onCommitApiMutation).toHaveBeenCalledTimes(3)

      const mutateQuery = onCommitApiMutation.mock.calls[0][0]
      expect(mutateQuery(initialApi)).toEqual({
        search: { method: 'POST', endpoint: '/x', query: { q: 'new-q' }, headers: { h: 'old' }, body: { b: 'old' } },
      })

      const mutateHeaders = onCommitApiMutation.mock.calls[1][0]
      expect(mutateHeaders(initialApi)).toEqual({
        search: { method: 'POST', endpoint: '/x', query: { q: 'old' }, headers: { h: 'new-h' }, body: { b: 'old' } },
      })

      const mutateBody = onCommitApiMutation.mock.calls[2][0]
      expect(mutateBody(initialApi)).toEqual({
        search: { method: 'POST', endpoint: '/x', query: { q: 'old' }, headers: { h: 'old' }, body: { b: 'new-b' } },
      })
    })
  })

  describe('body as a non-object value', () => {
    it('shows body via a read-only RawJsonPropertyField when it is a string, without throwing or offering row editing', () => {
      const onCommitApiMutation = vi.fn(noopCommit)
      renderPanel({ search: { method: 'POST', endpoint: '/x', body: 'texto' as never } }, onCommitApiMutation)
      const row = operationRow('search')

      expect(row.queryByRole('group', { name: 'Body' })).not.toBeInTheDocument()
      const bodyField = row.getByLabelText('Body')
      expect(bodyField).toBeInTheDocument()
      expect(bodyField.tagName).toBe('TEXTAREA')

      fireEvent.change(bodyField, { target: { value: 'otro texto' } })
      expect(onCommitApiMutation).not.toHaveBeenCalled()
    })
  })

  describe('per-field rejection isolation', () => {
    it('keeps a rejected commit banner scoped to its own field and operation, preserving the typed value', () => {
      const initialApi: RuntimeApiConfig = {
        search: { method: 'POST', endpoint: '/x', query: { q: 'old' }, headers: {}, body: {} },
        other: { method: 'GET', endpoint: '/y' },
      }
      const rejectionError = makeRejectionError('rechazado')
      const onCommitApiMutation = vi.fn((): CommitCanvasMutationResult => ({ status: 'rejected', error: rejectionError }))
      renderPanel(initialApi, onCommitApiMutation)

      const searchRow = operationRow('search')
      const otherRow = operationRow('other')

      fireEvent.change(searchRow.getByLabelText('Endpoint'), { target: { value: '/new-endpoint' } })

      const searchEndpointError = screen.getByTestId('api-config-panel-operation-search-endpoint-error')
      expect(searchEndpointError).toHaveTextContent(rejectionError.message)
      expect(searchRow.getByLabelText('Endpoint')).toHaveValue('/new-endpoint')
      expect(screen.queryByTestId('api-config-panel-operation-search-query-error')).not.toBeInTheDocument()
      expect(screen.queryByTestId('api-config-panel-operation-other-endpoint-error')).not.toBeInTheDocument()

      fireEvent.change(searchRow.getByLabelText('Query valor #1'), { target: { value: 'new-q' } })

      expect(screen.getByTestId('api-config-panel-operation-search-endpoint-error')).toBeInTheDocument()
      expect(screen.getByTestId('api-config-panel-operation-search-query-error')).toHaveTextContent(rejectionError.message)

      fireEvent.change(otherRow.getByLabelText('Endpoint'), { target: { value: '/other-endpoint' } })

      expect(screen.getByTestId('api-config-panel-operation-search-endpoint-error')).toBeInTheDocument()
      expect(screen.getByTestId('api-config-panel-operation-search-query-error')).toBeInTheDocument()
      expect(screen.getByTestId('api-config-panel-operation-other-endpoint-error')).toHaveTextContent(rejectionError.message)
    })
  })

  describe('Preloads sub-view (T7)', () => {
    const apiWithOperations: RuntimeApiConfig = {
      loadUsers: { method: 'GET', endpoint: '/users' },
      createUser: { method: 'POST', endpoint: '/users' },
    }

    function openPreloadsTab() {
      fireEvent.click(screen.getByRole('tab', { name: 'Preloads' }))
    }

    function globalSection() {
      return within(screen.getByTestId('api-config-panel-preloads-global'))
    }

    function pageSection() {
      return within(screen.getByTestId('api-config-panel-preloads-page'))
    }

    it('shows an empty state with an add option in both sections when globalPreloads/pagePreloads are undefined', () => {
      renderPanel(apiWithOperations)
      openPreloadsTab()

      expect(globalSection().getByText(/sin precargas/i)).toBeInTheDocument()
      expect(globalSection().getByLabelText('Operación')).toBeInTheDocument()
      expect(pageSection().getByText(/sin precargas/i)).toBeInTheDocument()
      expect(pageSection().getByLabelText('Operación')).toBeInTheDocument()
    })

    it('adds a global entry via onCommitGlobalPreloadsMutation, preserving existing entries', () => {
      const existing: RuntimePreloadConfig[] = [{ operationName: 'loadUsers', requestParams: {} }]
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { globalPreloads: existing, onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      fireEvent.change(globalSection().getByLabelText('Operación'), { target: { value: 'createUser' } })
      fireEvent.click(globalSection().getByRole('button', { name: 'Añadir precarga' }))

      expect(onCommitGlobalPreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitGlobalPreloadsMutation.mock.calls[0][0]
      expect(mutate(existing)).toEqual([...existing, { operationName: 'createUser', requestParams: {} }])
    })

    it('adds a page entry via onCommitPagePreloadsMutation, not onCommitGlobalPreloadsMutation', () => {
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      const onCommitPagePreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { onCommitGlobalPreloadsMutation, onCommitPagePreloadsMutation })
      openPreloadsTab()

      fireEvent.change(pageSection().getByLabelText('Operación'), { target: { value: 'loadUsers' } })
      fireEvent.click(pageSection().getByRole('button', { name: 'Añadir precarga' }))

      expect(onCommitPagePreloadsMutation).toHaveBeenCalledTimes(1)
      expect(onCommitGlobalPreloadsMutation).not.toHaveBeenCalled()
      const mutate = onCommitPagePreloadsMutation.mock.calls[0][0]
      expect(mutate(undefined)).toEqual([{ operationName: 'loadUsers', requestParams: {} }])
    })

    it('deletes a global entry via onCommitGlobalPreloadsMutation with the array without it', () => {
      const existing: RuntimePreloadConfig[] = [
        { operationName: 'loadUsers', requestParams: {} },
        { operationName: 'createUser', requestParams: {} },
      ]
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { globalPreloads: existing, onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      fireEvent.click(globalSection().getByRole('button', { name: 'Borrar precarga 1' }))

      expect(onCommitGlobalPreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitGlobalPreloadsMutation.mock.calls[0][0]
      expect(mutate(existing)).toEqual([{ operationName: 'createUser', requestParams: {} }])
    })

    it('deletes a page entry via onCommitPagePreloadsMutation with the array without it', () => {
      const existing: RuntimePreloadConfig[] = [{ operationName: 'loadUsers', requestParams: {} }]
      const onCommitPagePreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { pagePreloads: existing, onCommitPagePreloadsMutation })
      openPreloadsTab()

      fireEvent.click(pageSection().getByRole('button', { name: 'Borrar precarga 1' }))

      expect(onCommitPagePreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitPagePreloadsMutation.mock.calls[0][0]
      expect(mutate(existing)).toEqual([])
    })

    it('hides requestParams.body for an entry referencing a GET operation, and reveals it after switching to a POST operation', () => {
      const existing: RuntimePreloadConfig[] = [{ operationName: 'loadUsers', requestParams: {} }]
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      const { rerender } = renderPanel(apiWithOperations, undefined, {
        globalPreloads: existing,
        onCommitGlobalPreloadsMutation,
      })
      openPreloadsTab()

      expect(globalSection().queryByRole('group', { name: 'Body' })).not.toBeInTheDocument()

      fireEvent.change(globalSection().getByLabelText('Operación #1'), { target: { value: 'createUser' } })

      expect(onCommitGlobalPreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitGlobalPreloadsMutation.mock.calls[0][0]
      const mutatedPreloads = mutate(existing)
      expect(mutatedPreloads).toEqual([{ operationName: 'createUser', requestParams: {} }])

      rerender(
        <ApiConfigPanel
          api={apiWithOperations}
          onCommitApiMutation={vi.fn(noopCommit)}
          globalPreloads={mutatedPreloads}
          activePageId="home"
          pagePreloads={undefined}
          onCommitGlobalPreloadsMutation={onCommitGlobalPreloadsMutation}
          onCommitPagePreloadsMutation={vi.fn(noopCommit)}
        />,
      )

      expect(globalSection().getByRole('group', { name: 'Body' })).toBeInTheDocument()
    })

    it('shows no selected option for an entry whose operationName is not in the catalog, keeps requestParams editable, and does not hide body', () => {
      const existing: RuntimePreloadConfig[] = [
        { operationName: 'deletedOp', requestParams: { query: { q: 'old' } } },
      ]
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { globalPreloads: existing, onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      const select = globalSection().getByLabelText('Operación #1')
      expect(within(select).queryByRole('option', { name: 'deletedOp' })).not.toBeInTheDocument()
      expect(globalSection().getByRole('group', { name: 'Body' })).toBeInTheDocument()

      fireEvent.change(globalSection().getByLabelText('Query valor #1'), { target: { value: 'new-q' } })

      expect(onCommitGlobalPreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitGlobalPreloadsMutation.mock.calls[0][0]
      expect(mutate(existing)).toEqual([{ operationName: 'deletedOp', requestParams: { query: { q: 'new-q' } } }])
    })

    it('editing query/headers/body of an existing entry commits requestParams updated, preserving operationName', () => {
      const existing: RuntimePreloadConfig[] = [
        {
          operationName: 'createUser',
          requestParams: { query: { q: 'old' }, headers: { h: 'old' }, body: { b: 'old' } },
        },
      ]
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { globalPreloads: existing, onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      fireEvent.change(globalSection().getByLabelText('Query valor #1'), { target: { value: 'new-q' } })
      fireEvent.change(globalSection().getByLabelText('Headers valor #1'), { target: { value: 'new-h' } })
      fireEvent.change(globalSection().getByLabelText('Body valor #1'), { target: { value: 'new-b' } })

      expect(onCommitGlobalPreloadsMutation).toHaveBeenCalledTimes(3)

      const mutateQuery = onCommitGlobalPreloadsMutation.mock.calls[0][0]
      expect(mutateQuery(existing)).toEqual([
        {
          operationName: 'createUser',
          requestParams: { query: { q: 'new-q' }, headers: { h: 'old' }, body: { b: 'old' } },
        },
      ])

      const mutateHeaders = onCommitGlobalPreloadsMutation.mock.calls[1][0]
      expect(mutateHeaders(existing)).toEqual([
        {
          operationName: 'createUser',
          requestParams: { query: { q: 'old' }, headers: { h: 'new-h' }, body: { b: 'old' } },
        },
      ])

      const mutateBody = onCommitGlobalPreloadsMutation.mock.calls[2][0]
      expect(mutateBody(existing)).toEqual([
        {
          operationName: 'createUser',
          requestParams: { query: { q: 'old' }, headers: { h: 'old' }, body: { b: 'new-b' } },
        },
      ])
    })

    it('shows the blocking checkbox unchecked by default and toggling it on commits blocking: true, preserving the rest of the entry', () => {
      const existing: RuntimePreloadConfig[] = [{ operationName: 'loadUsers', requestParams: { query: { q: '1' } } }]
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { globalPreloads: existing, onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      const checkbox = globalSection().getByRole('checkbox', { name: 'Bloqueante precarga 1' })
      expect(checkbox).not.toBeChecked()

      fireEvent.click(checkbox)

      expect(onCommitGlobalPreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitGlobalPreloadsMutation.mock.calls[0][0]
      expect(mutate(existing)).toEqual([
        { operationName: 'loadUsers', requestParams: { query: { q: '1' } }, blocking: true },
      ])
    })

    it('shows the blocking checkbox checked when the entry already has blocking: true, and toggling it off commits the entry without the blocking key', () => {
      const existing: RuntimePreloadConfig[] = [{ operationName: 'loadUsers', requestParams: {}, blocking: true }]
      const onCommitPagePreloadsMutation = vi.fn(noopCommit)
      renderPanel(apiWithOperations, undefined, { pagePreloads: existing, onCommitPagePreloadsMutation })
      openPreloadsTab()

      const checkbox = pageSection().getByRole('checkbox', { name: 'Bloqueante precarga 1' })
      expect(checkbox).toBeChecked()

      fireEvent.click(checkbox)

      expect(onCommitPagePreloadsMutation).toHaveBeenCalledTimes(1)
      const mutate = onCommitPagePreloadsMutation.mock.calls[0][0]
      expect(mutate(existing)).toEqual([{ operationName: 'loadUsers', requestParams: {} }])
    })

    it('shows CommitRejectionBanner scoped to the blocking field when its commit is rejected, keeping the attempted value displayed like other fields', () => {
      const rejectionError = makeRejectionError('bloqueante rechazado')
      const onCommitGlobalPreloadsMutation = vi.fn(
        (): CommitCanvasMutationResult => ({ status: 'rejected', error: rejectionError }),
      )
      const existing: RuntimePreloadConfig[] = [{ operationName: 'loadUsers', requestParams: {} }]
      renderPanel(apiWithOperations, undefined, { globalPreloads: existing, onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      fireEvent.click(globalSection().getByRole('checkbox', { name: 'Bloqueante precarga 1' }))

      const banner = globalSection().getByTestId('preload-entry-0-blocking-error')
      expect(banner).toHaveTextContent(rejectionError.message)
      expect(globalSection().getByRole('checkbox', { name: 'Bloqueante precarga 1' })).toBeChecked()
    })

    it('discards a half-filled add draft in the page section when the active page changes, without affecting the global section', () => {
      const onCommitGlobalPreloadsMutation = vi.fn(noopCommit)
      const onCommitPagePreloadsMutation = vi.fn(noopCommit)
      const { rerender } = renderPanel(apiWithOperations, undefined, {
        activePageId: 'home',
        onCommitGlobalPreloadsMutation,
        onCommitPagePreloadsMutation,
      })
      openPreloadsTab()

      fireEvent.change(pageSection().getByLabelText('Operación'), { target: { value: 'createUser' } })
      expect(pageSection().getByLabelText('Operación')).toHaveValue('createUser')

      rerender(
        <ApiConfigPanel
          api={apiWithOperations}
          onCommitApiMutation={vi.fn(noopCommit)}
          globalPreloads={undefined}
          activePageId="about"
          pagePreloads={undefined}
          onCommitGlobalPreloadsMutation={onCommitGlobalPreloadsMutation}
          onCommitPagePreloadsMutation={onCommitPagePreloadsMutation}
        />,
      )

      expect(pageSection().getByLabelText('Operación')).toHaveValue('loadUsers')
    })

    it('shows CommitRejectionBanner with the real error when a commit is rejected, in either section, without applying the change', () => {
      const rejectionError = makeRejectionError('rechazado')
      const onCommitGlobalPreloadsMutation = vi.fn(
        (): CommitCanvasMutationResult => ({ status: 'rejected', error: rejectionError }),
      )
      renderPanel(apiWithOperations, undefined, { onCommitGlobalPreloadsMutation })
      openPreloadsTab()

      fireEvent.click(globalSection().getByRole('button', { name: 'Añadir precarga' }))

      const banner = globalSection().getByRole('alert')
      expect(banner).toHaveTextContent(rejectionError.message)
      expect(globalSection().queryByText(/sin precargas/i)).toBeInTheDocument()
    })
  })
})
