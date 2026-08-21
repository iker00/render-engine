import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { PropertyFieldRow } from '../layout-canvas/property-fields/property-field-row'
import { getPageDeleteBlockedReason, isDuplicatePageId, normalizePageId } from './pages-config-panel-rules'
import { PagesDeleteConfirmDialog } from './pages-delete-confirm-dialog'
import { scanOrphanNavigateToReferences, type OrphanNavigateToReferenceScan } from './scan-orphan-navigate-to-references'

export interface PagesConfigPanelProps {
  config: RuntimeConfig
  onCommitPagesMutation: (mutate: (pages: RuntimePageConfig[]) => RuntimePageConfig[]) => CommitCanvasMutationResult
  onCommitInitialPageMutation: (mutate: (initialPage: string) => string) => CommitCanvasMutationResult
}

interface CreateRejectionState {
  id: string
  title: string
  error: RuntimeConfigError
}

interface TitleRejectionState {
  value: string
  error: RuntimeConfigError
}

interface InitialPageRejectionState {
  pageId: string
  error: RuntimeConfigError
}

interface DeleteRejectionState {
  error: RuntimeConfigError
}

interface DeleteTargetState {
  pageId: string
  orphanScan: OrphanNavigateToReferenceScan
}

const INITIAL_PAGE_RADIO_GROUP_NAME = 'pages-config-panel-initial-page'

/**
 * Isolated form panel for `config.pages`/`config.initialPage` (T4, 0138): listing, creation,
 * `title` editing, initial-page designation and delete-with-confirmation. Every mutation goes
 * through `onCommitPagesMutation`/`onCommitInitialPageMutation` — the same "mutate, validate,
 * patch only the affected root key" pipeline `ShellConfigPanel`/`TranslationsConfigPanel` use.
 * Not wired into the floating toolbar or `DevEditorLayer` yet (T5).
 */
export function PagesConfigPanel({ config, onCommitPagesMutation, onCommitInitialPageMutation }: PagesConfigPanelProps) {
  const { pages, initialPage } = config

  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [createRejection, setCreateRejection] = useState<CreateRejectionState | null>(null)

  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({})
  const [titleRejections, setTitleRejections] = useState<Record<string, TitleRejectionState>>({})

  const [initialPageRejection, setInitialPageRejection] = useState<InitialPageRejectionState | null>(null)

  const [deleteRejections, setDeleteRejections] = useState<Record<string, DeleteRejectionState>>({})
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null)

  const normalizedNewId = normalizePageId(newId)
  const createDisabledReason =
    normalizedNewId === ''
      ? 'El id no puede estar vacío.'
      : isDuplicatePageId(normalizedNewId, pages)
        ? `El id "${normalizedNewId}" ya existe.`
        : null

  function handleCreate() {
    if (createDisabledReason !== null) return

    const result = onCommitPagesMutation((prev) => [
      ...prev,
      { id: normalizedNewId, layout: [], ...(newTitle.trim() !== '' ? { title: newTitle.trim() } : {}) },
    ])

    if (result.status === 'rejected') {
      setCreateRejection({ id: newId, title: newTitle, error: result.error })
      return
    }

    setCreateRejection(null)
    setNewId('')
    setNewTitle('')
  }

  function clearTitleRejection(pageId: string) {
    setTitleRejections((prev) => {
      if (!(pageId in prev)) return prev
      const next = { ...prev }
      delete next[pageId]
      return next
    })
  }

  function handleTitleChange(pageId: string, value: string) {
    setTitleDrafts((prev) => ({ ...prev, [pageId]: value }))
    clearTitleRejection(pageId)
  }

  function handleTitleBlur(page: RuntimePageConfig) {
    const draft = titleDrafts[page.id]
    if (draft === undefined) return

    const originalValue = page.title ?? ''
    if (draft === originalValue) {
      setTitleDrafts((prev) => {
        const next = { ...prev }
        delete next[page.id]
        return next
      })
      return
    }

    const result = onCommitPagesMutation((prev) =>
      prev.map((p) => (p.id === page.id ? { ...p, title: draft.trim() === '' ? undefined : draft } : p)),
    )

    if (result.status === 'rejected') {
      setTitleRejections((prev) => ({ ...prev, [page.id]: { value: draft, error: result.error } }))
      return
    }

    setTitleDrafts((prev) => {
      const next = { ...prev }
      delete next[page.id]
      return next
    })
    clearTitleRejection(page.id)
  }

  function handleSetInitialPage(pageId: string) {
    const result = onCommitInitialPageMutation(() => pageId)

    if (result.status === 'rejected') {
      setInitialPageRejection({ pageId, error: result.error })
      return
    }

    setInitialPageRejection(null)
  }

  function handleDeleteClick(page: RuntimePageConfig) {
    const orphanScan = scanOrphanNavigateToReferences(config, page.id)
    setDeleteTarget({ pageId: page.id, orphanScan })
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    const { pageId } = deleteTarget
    setDeleteTarget(null)

    const result = onCommitPagesMutation((prev) => prev.filter((p) => p.id !== pageId))
    if (result.status === 'rejected') {
      setDeleteRejections((prev) => ({ ...prev, [pageId]: { error: result.error } }))
      return
    }
    setDeleteRejections((prev) => {
      if (!(pageId in prev)) return prev
      const next = { ...prev }
      delete next[pageId]
      return next
    })
  }

  function handleCancelDelete() {
    setDeleteTarget(null)
  }

  return (
    <div data-testid="pages-config-panel" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <h2 className="text-base font-semibold text-gray-900">Páginas</h2>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th scope="col" className="border-b border-gray-200 px-2 py-1">
              Id
            </th>
            <th scope="col" className="border-b border-gray-200 px-2 py-1">
              Título
            </th>
            <th scope="col" className="border-b border-gray-200 px-2 py-1">
              Inicial
            </th>
            <th scope="col" className="border-b border-gray-200 px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => {
            const isInitial = page.id === initialPage
            const titleValue = titleDrafts[page.id] ?? page.title ?? ''
            const titleRejection = titleRejections[page.id]
            const deleteBlockedReason = getPageDeleteBlockedReason(page.id, pages, initialPage)
            const deleteRejection = deleteRejections[page.id]

            return (
              <tr key={page.id}>
                <td className="border-b border-gray-100 px-2 py-1">{page.id}</td>
                <td className="border-b border-gray-100 px-2 py-1">
                  <input
                    type="text"
                    aria-label={`Título de ${page.id}`}
                    value={titleValue}
                    placeholder="Sin título"
                    onChange={(event) => handleTitleChange(page.id, event.target.value)}
                    onBlur={() => handleTitleBlur(page)}
                    className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                  />
                  {titleRejection && (
                    <CommitRejectionBanner
                      dataTestId={`pages-config-panel-title-${page.id}-error`}
                      error={titleRejection.error}
                    />
                  )}
                </td>
                <td className="border-b border-gray-100 px-2 py-1">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={INITIAL_PAGE_RADIO_GROUP_NAME}
                      aria-label={`Marcar ${page.id} como página inicial`}
                      checked={isInitial}
                      onChange={() => handleSetInitialPage(page.id)}
                    />
                    {isInitial && <span data-testid={`pages-config-panel-initial-badge-${page.id}`}>Inicial</span>}
                  </label>
                  {initialPageRejection?.pageId === page.id && (
                    <CommitRejectionBanner
                      dataTestId={`pages-config-panel-initial-${page.id}-error`}
                      error={initialPageRejection.error}
                    />
                  )}
                </td>
                <td className="border-b border-gray-100 px-2 py-1">
                  <button
                    type="button"
                    aria-label={`Eliminar página ${page.id}`}
                    onClick={() => handleDeleteClick(page)}
                    disabled={deleteBlockedReason !== null}
                    title={deleteBlockedReason ?? undefined}
                    className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                  {deleteRejection && (
                    <CommitRejectionBanner
                      dataTestId={`pages-config-panel-delete-${page.id}-error`}
                      error={deleteRejection.error}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleCreate()
        }}
        className="flex flex-col gap-2"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="px-1 text-xs font-medium text-gray-700">Crear página</legend>
          <PropertyFieldRow htmlFor="pages-config-panel-new-id" label="Id">
            <input
              id="pages-config-panel-new-id"
              type="text"
              value={newId}
              onChange={(event) => {
                setNewId(event.target.value)
                setCreateRejection(null)
              }}
              className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
            />
          </PropertyFieldRow>
          <PropertyFieldRow htmlFor="pages-config-panel-new-title" label="Título">
            <input
              id="pages-config-panel-new-title"
              type="text"
              value={newTitle}
              onChange={(event) => {
                setNewTitle(event.target.value)
                setCreateRejection(null)
              }}
              className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
            />
          </PropertyFieldRow>
          {createDisabledReason !== null && <p className="text-xs text-gray-500">{createDisabledReason}</p>}
          {createRejection && (
            <CommitRejectionBanner dataTestId="pages-config-panel-create-error" error={createRejection.error} />
          )}
          <button
            type="submit"
            disabled={createDisabledReason !== null}
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Crear
          </button>
        </fieldset>
      </form>

      {deleteTarget && (
        <PagesDeleteConfirmDialog
          pageId={deleteTarget.pageId}
          orphanScan={deleteTarget.orphanScan}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}
