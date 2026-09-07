import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeConfig, RuntimeGroupsConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type {
  CommitCanvasMutationResult,
  CommitResult,
  LayoutCanvasTarget,
  LayoutTreeMutation,
} from '../layout-canvas/layout-canvas-commit'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'
import { DevEditorGroupsCanvas } from '../floating-toolbar/dev-editor-groups-canvas'
import { GroupDeleteConfirmDialog } from './group-delete-confirm-dialog'
import {
  applyGroupsMutation,
  commitGroupsMutation,
  isDuplicateGroupId,
  normalizeGroupId,
} from './groups-config-panel-mutations'

export interface GroupsConfigPanelProps {
  config: RuntimeConfig
  onCommitGroupsMutation: (
    mutate: (groups: RuntimeGroupsConfig) => RuntimeGroupsConfig,
  ) => CommitCanvasMutationResult
  onCommitLayoutMutation: (target: LayoutCanvasTarget, patch: LayoutTreeMutation) => CommitResult
}

interface IdRejectionState {
  value: string
  error: RuntimeConfigError
}

interface AddRejectionState {
  id: string
  error: RuntimeConfigError
}

interface ParamRejectionState {
  paramName: string
  error: RuntimeConfigError
}

interface DeleteRejectionState {
  error: RuntimeConfigError
}

/**
 * "Grupos" tab of the visual editor (T14, feature reusable-node-groups): full CRUD for the
 * `groups` block — listing, creation, id renaming, param add/remove and delete-with-confirmation
 * — plus, once a `groupId` is selected, an editable preview of its `template` retargeted via
 * `onCommitLayoutMutation`'s `{ kind: 'group-template', groupId }` target (T13,
 * `DevEditorGroupsCanvas`). Structural mutations over `groups` itself go through
 * `applyGroupsMutation`/`commitGroupsMutation` (pure, `groups-config-panel-mutations.ts`) before
 * being handed to `onCommitGroupsMutation` — the same "clave raíz única" commit pattern
 * Api/Tokens/Traducciones/Páginas already use.
 */
export function GroupsConfigPanel({ config, onCommitGroupsMutation, onCommitLayoutMutation }: GroupsConfigPanelProps) {
  const groups = config.groups ?? {}
  const groupEntries = Object.entries(groups)

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const [idDrafts, setIdDrafts] = useState<Record<string, string>>({})
  const [idRejections, setIdRejections] = useState<Record<string, IdRejectionState>>({})

  const [newId, setNewId] = useState('')
  const [addRejection, setAddRejection] = useState<AddRejectionState | null>(null)

  const [paramDrafts, setParamDrafts] = useState<Record<string, string>>({})
  const [paramRejections, setParamRejections] = useState<Record<string, ParamRejectionState>>({})

  const [deleteRejections, setDeleteRejections] = useState<Record<string, DeleteRejectionState>>({})
  const [deleteTargetGroupId, setDeleteTargetGroupId] = useState<string | null>(null)

  const normalizedNewId = normalizeGroupId(newId)
  const addDisabledReason =
    normalizedNewId === ''
      ? 'El id no puede estar vacío.'
      : isDuplicateGroupId(normalizedNewId, groups)
        ? `El id "${normalizedNewId}" ya existe.`
        : null

  function handleAddGroup() {
    if (addDisabledReason !== null) return

    const result = onCommitGroupsMutation((prev) =>
      applyGroupsMutation(prev, { kind: 'add-group', groupId: normalizedNewId }),
    )

    if (result.status === 'rejected') {
      setAddRejection({ id: newId, error: result.error })
      return
    }

    setAddRejection(null)
    setNewId('')
  }

  function clearIdRejection(groupId: string) {
    setIdRejections((prev) => {
      if (!(groupId in prev)) return prev
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  function handleIdChange(groupId: string, value: string) {
    setIdDrafts((prev) => ({ ...prev, [groupId]: value }))
    clearIdRejection(groupId)
  }

  function handleIdBlur(groupId: string) {
    const draft = idDrafts[groupId]
    if (draft === undefined) return

    const normalized = normalizeGroupId(draft)

    function clearDraft() {
      setIdDrafts((prev) => {
        const next = { ...prev }
        delete next[groupId]
        return next
      })
    }

    if (normalized === groupId) {
      clearDraft()
      return
    }

    const mutation = { kind: 'rename-group' as const, from: groupId, to: normalized }
    const precheck = commitGroupsMutation(config, mutation)

    if (precheck.status === 'rejected') {
      setIdRejections((prev) => ({ ...prev, [groupId]: { value: draft, error: precheck.error } }))
      return
    }

    const result = onCommitGroupsMutation((prev) => applyGroupsMutation(prev, mutation))

    if (result.status === 'rejected') {
      setIdRejections((prev) => ({ ...prev, [groupId]: { value: draft, error: result.error } }))
      return
    }

    clearDraft()
    clearIdRejection(groupId)
    setSelectedGroupId((current) => (current === groupId ? normalized : current))
  }

  function handleParamDraftChange(groupId: string, value: string) {
    setParamDrafts((prev) => ({ ...prev, [groupId]: value }))
  }

  function clearParamRejection(groupId: string) {
    setParamRejections((prev) => {
      if (!(groupId in prev)) return prev
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  function handleAddParam(groupId: string) {
    const paramName = (paramDrafts[groupId] ?? '').trim()
    if (paramName === '' || groups[groupId]?.params.includes(paramName)) return

    const result = onCommitGroupsMutation((prev) =>
      applyGroupsMutation(prev, { kind: 'add-param', groupId, paramName }),
    )

    if (result.status === 'rejected') {
      setParamRejections((prev) => ({ ...prev, [groupId]: { paramName, error: result.error } }))
      return
    }

    setParamDrafts((prev) => ({ ...prev, [groupId]: '' }))
    clearParamRejection(groupId)
  }

  function handleRemoveParam(groupId: string, paramName: string) {
    const result = onCommitGroupsMutation((prev) =>
      applyGroupsMutation(prev, { kind: 'remove-param', groupId, paramName }),
    )

    if (result.status === 'rejected') {
      setParamRejections((prev) => ({ ...prev, [groupId]: { paramName, error: result.error } }))
      return
    }

    clearParamRejection(groupId)
  }

  function handleDeleteClick(groupId: string) {
    setDeleteTargetGroupId(groupId)
  }

  function handleConfirmDelete() {
    if (deleteTargetGroupId === null) return
    const groupId = deleteTargetGroupId
    setDeleteTargetGroupId(null)

    const result = onCommitGroupsMutation((prev) => applyGroupsMutation(prev, { kind: 'remove-group', groupId }))

    if (result.status === 'rejected') {
      setDeleteRejections((prev) => ({ ...prev, [groupId]: { error: result.error } }))
      return
    }

    setDeleteRejections((prev) => {
      if (!(groupId in prev)) return prev
      const next = { ...prev }
      delete next[groupId]
      return next
    })
    setSelectedGroupId((current) => (current === groupId ? null : current))
  }

  function handleCancelDelete() {
    setDeleteTargetGroupId(null)
  }

  const selectedGroup = selectedGroupId !== null ? groups[selectedGroupId] : undefined

  return (
    <div data-testid="groups-config-panel" className="flex h-full">
      <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 p-3">
        <h2 className="text-base font-semibold text-gray-900">Grupos</h2>

        {groupEntries.length === 0 ? (
          <p className="text-xs text-gray-500">Sin grupos declarados.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groupEntries.map(([groupId, group]) => {
              const idDraft = idDrafts[groupId] ?? groupId
              const idRejection = idRejections[groupId]
              const paramDraft = paramDrafts[groupId] ?? ''
              const paramRejection = paramRejections[groupId]
              const deleteRejection = deleteRejections[groupId]
              const isSelected = selectedGroupId === groupId
              const isDuplicateParam = paramDraft.trim() !== '' && group.params.includes(paramDraft.trim())
              const addParamDisabled = paramDraft.trim() === '' || isDuplicateParam

              return (
                <li
                  key={groupId}
                  data-testid={`groups-config-panel-group-${groupId}`}
                  className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`Seleccionar grupo ${groupId}`}
                      onClick={() => setSelectedGroupId(groupId)}
                      className="truncate text-left text-xs font-semibold text-gray-800"
                    >
                      {groupId}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(groupId)}
                      aria-label={`Eliminar grupo ${groupId}`}
                      className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Eliminar grupo
                    </button>
                  </div>

                  <input
                    type="text"
                    aria-label={`Id de ${groupId}`}
                    value={idDraft}
                    onChange={(event) => handleIdChange(groupId, event.target.value)}
                    onBlur={() => handleIdBlur(groupId)}
                    className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                  />
                  {idRejection && (
                    <CommitRejectionBanner dataTestId={`groups-config-panel-id-${groupId}-error`} error={idRejection.error} />
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-gray-600">Parámetros</span>
                    {group.params.length === 0 ? (
                      <p className="text-[11px] text-gray-500">Sin parámetros.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1">
                        {group.params.map((paramName) => (
                          <li
                            key={paramName}
                            className="flex items-center gap-1 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-800"
                          >
                            {paramName}
                            <button
                              type="button"
                              aria-label={`Eliminar parámetro ${paramName} de ${groupId}`}
                              onClick={() => handleRemoveParam(groupId, paramName)}
                              className="text-gray-500 hover:text-gray-800"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        handleAddParam(groupId)
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        aria-label={`Nuevo parámetro de ${groupId}`}
                        value={paramDraft}
                        onChange={(event) => handleParamDraftChange(groupId, event.target.value)}
                        className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={addParamDisabled}
                        aria-label={`Añadir parámetro a ${groupId}`}
                        className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Añadir parámetro
                      </button>
                    </form>
                    {paramRejection && (
                      <CommitRejectionBanner
                        dataTestId={`groups-config-panel-param-${groupId}-error`}
                        error={paramRejection.error}
                      />
                    )}
                  </div>

                  {deleteRejection && (
                    <CommitRejectionBanner
                      dataTestId={`groups-config-panel-delete-${groupId}-error`}
                      error={deleteRejection.error}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-700">Añadir grupo</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleAddGroup()
            }}
            className="flex flex-col gap-2"
          >
            <TextPropertyField
              label="Id"
              value={newId}
              onChange={(value) => {
                setNewId(value)
                setAddRejection(null)
              }}
            />
            {addDisabledReason !== null && <p className="text-xs text-gray-500">{addDisabledReason}</p>}
            {addRejection && <CommitRejectionBanner dataTestId="groups-config-panel-add-error" error={addRejection.error} />}
            <button
              type="submit"
              disabled={addDisabledReason !== null}
              className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Añadir grupo
            </button>
          </form>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {selectedGroupId !== null && selectedGroup ? (
          <DevEditorGroupsCanvas
            groupId={selectedGroupId}
            group={selectedGroup}
            onCommitLayoutMutation={onCommitLayoutMutation}
          />
        ) : (
          <p data-testid="groups-config-panel-canvas-empty" className="p-3 text-xs text-gray-500">
            Selecciona un grupo para editar su plantilla.
          </p>
        )}
      </div>

      {deleteTargetGroupId !== null && (
        <GroupDeleteConfirmDialog
          groupId={deleteTargetGroupId}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}
