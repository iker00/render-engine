import { useId, type ChangeEvent } from 'react'
import type { RuntimeGroupInstanceNode, RuntimeGroupsConfig } from '../../../config/runtime-config-types'
import { PropertyFieldRow } from './property-field-row'
import { TextPropertyField } from './text-property-field'

export interface GroupInstancePropertyFieldProps {
  label: string
  node: RuntimeGroupInstanceNode
  // Root `groups` block (T15, feature reusable-node-groups): source of the selector's options
  // and of the chosen group's declared `params`. `undefined`/`{}` disables the selector (empty
  // or absent `config.groups`) — same "disabled with an explicit reason" pattern as `Tokens`'
  // refresh switch (`BooleanPropertyField`'s `disabled`/`disabledReason`).
  groups: RuntimeGroupsConfig | undefined
  onChange: (node: RuntimeGroupInstanceNode) => void
}

const NO_GROUPS_DISABLED_REASON = 'No hay ningún grupo declarado. Crea uno primero desde la pestaña "Grupos".'
const PARAMS_MISMATCH_MESSAGE =
  'Los parámetros de esta instancia no coinciden con los declarados por el grupo seleccionado.'

function buildFreshParams(paramNames: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(paramNames.map((paramName) => [paramName, '']))
}

/**
 * Dedicated widget for a `group` instance node's `props` (T15): the `groupId` selector plus a
 * free-text field per param the chosen group declares. Same full-node write scope as
 * `ContainerColumnsModePropertyField`/`TableRowsPropertyField` — the panel wires this widget's
 * `onChange` to `onCommitNodeUpdate(path, (currentNode) => nextNode)`, not the generic
 * per-subsection `props` patch the rest of `Props` uses, because switching `groupId` must also
 * reset `params`/`children` in the same commit (spec FR8).
 *
 * `props.params` stays a flat `Record<string, string>` here (free-text fields, no dedicated
 * picker per param — the panel's documented complexity ceiling), even though the runtime contract
 * allows `unknown` values for a param (interpolated/dynamic references authored via Monaco).
 */
export function GroupInstancePropertyField({ label, node, groups, onChange }: GroupInstancePropertyFieldProps) {
  const selectId = useId()
  const groupIds = groups ? Object.keys(groups) : []
  const hasGroups = groupIds.length > 0
  const selectedGroup = groups?.[node.props.groupId]
  const declaredParams = selectedGroup?.params ?? []

  function handleGroupIdChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextGroupId = event.target.value
    const nextGroup = groups?.[nextGroupId]
    // Reconstructs props.params/children from scratch on every groupId change (spec FR8) — the
    // previous group's values never carry over, even when a param name happens to match.
    onChange({ ...node, props: { groupId: nextGroupId, params: buildFreshParams(nextGroup?.params ?? []) }, children: undefined })
  }

  function handleParamChange(paramName: string, value: string) {
    onChange({ ...node, props: { ...node.props, params: { ...node.props.params, [paramName]: value } } })
  }

  const providedParams = Object.keys(node.props.params)
  const declaredParamsSet = new Set(declaredParams)
  const paramsMismatch =
    selectedGroup !== undefined &&
    (providedParams.some((paramName) => !declaredParamsSet.has(paramName)) ||
      declaredParams.some((paramName) => !providedParams.includes(paramName)))

  return (
    <div className="flex flex-col gap-2">
      <PropertyFieldRow htmlFor={selectId} label={label}>
        <select
          id={selectId}
          value={node.props.groupId}
          onChange={handleGroupIdChange}
          disabled={!hasGroups}
          title={hasGroups ? undefined : NO_GROUPS_DISABLED_REASON}
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">-- Selecciona un grupo --</option>
          {groupIds.map((groupId) => (
            <option key={groupId} value={groupId}>
              {groupId}
            </option>
          ))}
        </select>
      </PropertyFieldRow>
      {declaredParams.map((paramName) => (
        <TextPropertyField
          key={paramName}
          label={paramName}
          value={typeof node.props.params[paramName] === 'string' ? (node.props.params[paramName] as string) : ''}
          onChange={(value) => handleParamChange(paramName, value)}
        />
      ))}
      {paramsMismatch && (
        <p role="alert" className="text-xs text-red-600">
          {PARAMS_MISMATCH_MESSAGE}
        </p>
      )}
    </div>
  )
}
