import type { ChangeEvent } from 'react'
import type { QueryStateFeedbackRule, QueryStateFeedbackVisibleState } from '../../../config/runtime-config'
import {
  addQueryStateFeedbackStateRow,
  getAvailableQueryStateFeedbackStatesToAdd,
  getPresentQueryStateFeedbackStates,
  removeQueryStateFeedbackStateRow,
  setQueryStateFeedbackStateRuleMode,
} from './query-state-feedback-accordion-state'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'
import { useQueryStateFeedbackAccordionWidgetContext } from './query-state-feedback-accordion-widget-context'

type QueryStateFeedbackStates = Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>>

const MODE_SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'show', label: 'Mostrar' },
  { value: 'hide', label: 'Ocultar' },
  { value: 'fallback', label: 'Fallback' },
]

interface QueryStateFeedbackAccordionPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
  // Forwarded by the dispatcher's `x-widget` hook on some call sites — ignored here, same as
  // `layout-span`/`choice-items`/`icon`/`color-swatch`.
  hideRootLegend?: boolean
}

function normalizeStatesValue(value: unknown): QueryStateFeedbackStates | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  return value as QueryStateFeedbackStates
}

/**
 * `query-state-feedback-accordion` widget (T2, 0135), built and tested in isolation from the real
 * properties panel. Like every other `WIDGET_REGISTRY` entry it reads/writes the config value
 * (`queryStateFeedback.states`) through `value`/`onChange` — the widget context here only carries
 * ephemeral UI state (expansion, fallback cache) that must survive a tab change, not the config
 * data itself. See `QueryStateFeedbackAccordionWidgetContextValue` for why.
 *
 * `fallback` content editing stays out of scope for the whole feature: entering `Fallback` mode
 * only shows a note pointing at Monaco, with no node insert/edit/delete control of any kind.
 */
export function QueryStateFeedbackAccordionPropertyField({
  label,
  value,
  onChange,
}: QueryStateFeedbackAccordionPropertyFieldProps) {
  const { fallbackCacheByState, onFallbackCacheCommit, expandedStates, onSetExpanded } =
    useQueryStateFeedbackAccordionWidgetContext()

  const statesValue = normalizeStatesValue(value)
  const presentStates = getPresentQueryStateFeedbackStates(statesValue)
  const availableStatesToAdd = getAvailableQueryStateFeedbackStatesToAdd(statesValue)

  function handleAddStateChange(event: ChangeEvent<HTMLSelectElement>) {
    const raw = event.target.value
    if (!raw) return
    const state = raw as QueryStateFeedbackVisibleState
    onChange(addQueryStateFeedbackStateRow(statesValue, state))
    onSetExpanded(state, true)
  }

  function handleRemoveState(state: QueryStateFeedbackVisibleState) {
    onChange(removeQueryStateFeedbackStateRow(statesValue, state))
  }

  function handleModeSelect(state: QueryStateFeedbackVisibleState, nextModeRaw: string | number) {
    const nextMode = nextModeRaw as QueryStateFeedbackRule['mode']
    const nextStates = setQueryStateFeedbackStateRuleMode(statesValue, state, nextMode, fallbackCacheByState[state])
    onChange(nextStates)

    if (nextMode !== 'fallback') return
    const nextRule = nextStates?.[state]
    if (nextRule?.mode === 'fallback') {
      onFallbackCacheCommit(state, nextRule.fallback as unknown[])
    }
  }

  return (
    <fieldset data-testid="query-state-feedback-accordion" className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>

      {presentStates.map((state) => {
        const rule = statesValue?.[state]
        const isExpanded = expandedStates.has(state)
        const activeMode = rule ? rule.mode : null

        return (
          <div key={state} data-testid={`query-state-feedback-accordion-row-${state}`} className="rounded-md border border-gray-200">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => onSetExpanded(state, !isExpanded)}
                className="flex-1 text-left text-sm font-medium text-gray-800"
              >
                {state}
              </button>
              <button
                type="button"
                aria-label={`Quitar estado ${state}`}
                onClick={() => handleRemoveState(state)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                Quitar
              </button>
            </div>
            {isExpanded && (
              <div className="flex flex-col gap-2 border-t border-gray-100 px-2 py-2">
                <SegmentedTogglePropertyField
                  label={`Modo de ${state}`}
                  segments={MODE_SEGMENTS}
                  activeValue={activeMode}
                  onSelect={(nextMode) => handleModeSelect(state, nextMode)}
                />
                {rule?.mode === 'fallback' && (
                  <p data-testid={`query-state-feedback-accordion-row-${state}-fallback-note`} className="text-xs text-gray-500">
                    El contenido de fallback todavía no se edita desde este panel. Usa el editor Monaco para modificarlo.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <select
        data-testid="query-state-feedback-accordion-add"
        aria-label="Añadir estado"
        value=""
        onChange={handleAddStateChange}
        disabled={availableStatesToAdd.length === 0}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Añadir estado…</option>
        {availableStatesToAdd.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </select>
    </fieldset>
  )
}
