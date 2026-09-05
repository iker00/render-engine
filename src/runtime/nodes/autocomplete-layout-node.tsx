import { useState } from 'react'
import type { AutocompleteLayoutNode, RuntimeApiRequestParams, SelectLayoutNodeItems } from '../../config/runtime-config'
import { useOptionalFormContext } from '../use-optional-form-context'
import { resolveAutocompleteFieldDefinition } from './resolve-form-field-definition'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import {
  filterAutocompleteSuggestions,
  resolveAutocompleteCollectionItems,
  type ResolvedSelectCollectionItem,
} from '../runtime-collection-sources'
import { deriveScopedStateKey, EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { useAutocompleteSearchTrigger } from '../runtime-search-trigger'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState, selectQueryRequestSignature } from '../runtime-state/runtime-state-selectors'
import { FieldTooltip } from './field-tooltip'

const DYNAMIC_QUERY_SOURCE_PATTERN = /^queries\.([^.]+)\.data(\..*)?$/

// Only `source: queries.{queryName}.data` / `queries.{queryName}.data.*` have a real backend
// operation behind them (`queryName`). `item.*` is data already resolved from the enclosing
// repeater iteration — it is filtered client-side exactly like the static shape, so it never
// resolves to a `queryName` here (design.md, decisión 1).
function resolveAutocompleteQueryName(items: SelectLayoutNodeItems): string | null {
  if (Array.isArray(items) || 'values' in items) {
    return null
  }

  return DYNAMIC_QUERY_SOURCE_PATTERN.exec(items.source)?.[1] ?? null
}

interface AutocompleteNodeProps {
  node: AutocompleteLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function AutocompleteNode({ node, iterationContext }: AutocompleteNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue } = useRuntimeStateActions()
  const [searchText, setSearchText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  // Distinguishes "searchText is '' because the user has never touched the input yet" (show the
  // selected value's label) from "searchText is '' because the user just cleared it" (show an
  // actually empty input, and let blur clear the stored value instead of re-deriving its label).
  const [hasEditedSearchText, setHasEditedSearchText] = useState(false)
  // A selection/blur/Enter confirmation resets `searchText` back to '' programmatically — that
  // reset is not a real search, but it's still a `searchText` change, so without this the T4
  // trigger hook (gated only by `searchText.length < minChars`, which an empty string clears
  // whenever `minChars` is its 0 default) would fire a fresh "browse all" search right after a
  // selection. If that response doesn't happen to include the just-selected item, its label
  // lookup falls back to the raw value. Suppressed until the user actually types again.
  const [suppressNextSearchTrigger, setSuppressNextSearchTrigger] = useState(false)

  const isMultiple = node.props.multiple === true
  const queryName = resolveAutocompleteQueryName(node.props.items)
  // Defaults to 'search' — the reserved key documented for the multiple-mode dynamic shape — but
  // is overridable per-node so the operation's own endpoint can read whatever query/body param
  // name it actually expects, instead of forcing every backend to accept a literal "search" key.
  const searchParamName = node.props.searchParamName ?? 'search'
  const dynamicSearchRequestParams: RuntimeApiRequestParams | undefined =
    queryName !== null && isMultiple
      ? { query: { [searchParamName]: searchText }, body: { [searchParamName]: searchText } }
      : undefined

  const { lastFiredRequestSignature } = useAutocompleteSearchTrigger({
    queryName: suppressNextSearchTrigger ? null : queryName,
    searchText,
    minChars: node.props.minChars ?? 0,
    requestParams: dynamicSearchRequestParams,
    iterationContext,
  })

  if (!formContext) {
    return null
  }

  const formId = formContext.formId
  const fieldId = node.props.fieldId
  const scopeKey = deriveScopedStateKey(formId, formContext.scopeChain ?? EMPTY_INSTANCE_SCOPE)
  const fieldState = selectFormFieldState(state, scopeKey, fieldId)
  const fieldDefinition = resolveAutocompleteFieldDefinition(node, state, iterationContext)
  const label = resolveRuntimeTextReference(node.props.label, state, 'autocomplete.props.label', { iterationContext })
  const tooltip = node.props.tooltip !== undefined
    ? resolveRuntimeTextReference(node.props.tooltip, state, 'autocomplete.props.tooltip', { iterationContext })
    : ''
  const placeholderText = resolveRuntimeTextReference(node.props.placeholder ?? '', state, 'autocomplete.props.placeholder', {
    iterationContext,
  })
  const error = fieldState?.error ?? null
  const value = fieldState?.value ?? fieldDefinition.defaultValue
  const selectedValues = isMultiple && Array.isArray(value) ? (value as string[]) : []
  const fullCatalogItems = resolveAutocompleteCollectionItems(node.props.items, state, { iterationContext })
  const isDynamicSearchFresh = queryName !== null && selectQueryRequestSignature(state, queryName) === lastFiredRequestSignature
  const suggestions = (() => {
    if (!isOpen) {
      return []
    }

    const candidateItems = queryName !== null
      ? (isDynamicSearchFresh ? fullCatalogItems : [])
      : filterAutocompleteSuggestions(fullCatalogItems, searchText, node.props.minChars ?? 0)

    return isMultiple ? candidateItems.filter((item) => !selectedValues.includes(item.value)) : candidateItems
  })()

  const resolveLabelForValue = (itemValue: string) => {
    const matchingItem = fullCatalogItems.find((item) => item.value === itemValue)
    return matchingItem ? matchingItem.label : itemValue
  }

  const displayLabelForCurrentValue = (() => {
    if (isMultiple || hasEditedSearchText || value === '' || value === undefined || value === null) {
      return null
    }

    const matchingItem = fullCatalogItems.find((item) => item.value === value)
    return matchingItem ? matchingItem.label : String(value)
  })()

  const resetSearchTextAfterConfirmation = () => {
    setSearchText('')
    setHasEditedSearchText(false)
    setSuppressNextSearchTrigger(true)
  }

  const revalidateIfNeeded = (nextValue: string | string[]) => {
    if (!error) {
      return
    }

    setFormFieldError(
      formId,
      fieldId,
      getValidationErrorForEditedField({
        fieldDefinition,
        formId: scopeKey,
        state,
        nextValue,
        iterationContext,
      }),
      { scopeChain: formContext.scopeChain },
    )
  }

  const selectSuggestion = (item: ResolvedSelectCollectionItem) => {
    if (isMultiple) {
      const nextValues = selectedValues.includes(item.value) ? selectedValues : [...selectedValues, item.value]

      if (nextValues !== selectedValues) {
        setFormFieldValue(formId, fieldId, nextValues, { scopeChain: formContext.scopeChain })
      }

      resetSearchTextAfterConfirmation()
      setHighlightedIndex(null)
      revalidateIfNeeded(nextValues)
      return
    }

    setFormFieldValue(formId, fieldId, item.value, { scopeChain: formContext.scopeChain })
    resetSearchTextAfterConfirmation()
    setIsOpen(false)
    setHighlightedIndex(null)
    revalidateIfNeeded(item.value)
  }

  const allowFreeText = node.props.allowFreeText === true

  const handleBlur = () => {
    setIsOpen(false)
    setHighlightedIndex(null)

    if (isMultiple) {
      resetSearchTextAfterConfirmation()
      return
    }

    if (allowFreeText) {
      setHasEditedSearchText(false)
      return
    }

    // Only act if the user actually edited the text since the last confirmed value — otherwise a
    // bare focus+blur (or blurring right after `selectSuggestion` reset both to '') would wrongly
    // clear an already-selected value. `searchText === ''` alone can't tell these apart: it's also
    // what a fully-cleared-by-typing input looks like (bug: it must clear the value, not restore it).
    if (!hasEditedSearchText) {
      return
    }

    const matchingItem = fullCatalogItems.find((item) => item.value === searchText || item.label === searchText)

    if (matchingItem) {
      setFormFieldValue(formId, fieldId, matchingItem.value, { scopeChain: formContext.scopeChain })
      resetSearchTextAfterConfirmation()
      revalidateIfNeeded(matchingItem.value)
      return
    }

    setFormFieldValue(formId, fieldId, '', { scopeChain: formContext.scopeChain })
    resetSearchTextAfterConfirmation()
    revalidateIfNeeded('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((current) => {
        if (suggestions.length === 0) return current
        const next = current === null ? 0 : current + 1
        return Math.min(next, suggestions.length - 1)
      })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((current) => {
        if (suggestions.length === 0) return current
        const next = current === null ? 0 : current - 1
        return Math.max(next, 0)
      })
      return
    }

    if (event.key === 'Enter') {
      if (highlightedIndex !== null && suggestions[highlightedIndex]) {
        event.preventDefault()
        selectSuggestion(suggestions[highlightedIndex])
        return
      }

      // Simple + dynamic shape + allowFreeText:false: `forms.{formId}.{fieldId}` is written on
      // every keystroke (see onChange below) so the search operation can reference it, but that
      // leaves unconfirmed free text in the store even though free text is disallowed. Enter
      // pressed here would otherwise trigger the native form submit before blur can clean it up
      // — always intercept it and resolve synchronously against the catalog already resolved for
      // this render (design.md, decisión 3, riesgo de submit con texto no confirmado).
      if (!isMultiple && !allowFreeText && queryName !== null && highlightedIndex === null) {
        event.preventDefault()
        const matchingItem = fullCatalogItems.find((item) => item.value === searchText || item.label === searchText)

        if (matchingItem) {
          selectSuggestion(matchingItem)
          return
        }

        setFormFieldValue(formId, fieldId, '', { scopeChain: formContext.scopeChain })
        resetSearchTextAfterConfirmation()
        revalidateIfNeeded('')
        return
      }

      if (isMultiple && allowFreeText && searchText.trim() !== '') {
        event.preventDefault()
        const matchingItem = fullCatalogItems.find((item) => item.value === searchText)
        selectSuggestion(matchingItem ? { label: matchingItem.label, value: searchText } : { label: searchText, value: searchText })
      }

      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(null)
    }
  }

  // In multiple mode, the bordered/padded "field control" look moves to the chips+input row
  // below so chips and the in-progress text read as one search field, not a bare input floating
  // next to separately-styled chips; the input itself becomes borderless/transparent inside it.
  const multipleFieldContainerClassName = [
    'flex flex-wrap items-center gap-1.5',
    'rounded-control border',
    error !== null ? 'border-app-danger' : 'border-app-border-soft',
    'bg-white px-2.5 py-1.5',
    'focus-within:ring-2',
    error !== null
      ? 'focus-within:border-app-danger focus-within:ring-app-danger'
      : 'focus-within:border-app-accent focus-within:ring-app-accent',
  ].join(' ')
  const multipleSearchInputClassName =
    'flex-1 min-w-[6rem] bg-transparent p-0.5 text-sm leading-5 text-app-text placeholder:text-app-text-muted focus:outline-none focus-visible:outline-none'

  const searchInput = (
    <input
      role="combobox"
      type="text"
      id={`${formId}-${fieldId}`}
      aria-expanded={isOpen}
      aria-controls={`${formId}-${fieldId}-listbox`}
      aria-activedescendant={highlightedIndex !== null ? `${formId}-${fieldId}-option-${highlightedIndex}` : undefined}
      aria-describedby={error !== null ? `${formId}-${fieldId}-error` : undefined}
      className={isMultiple ? multipleSearchInputClassName : getFieldControlClassName(error !== null)}
      placeholder={isMultiple ? undefined : placeholderText}
      value={isMultiple ? searchText : (searchText !== '' ? searchText : (displayLabelForCurrentValue ?? ''))}
      onChange={(event) => {
        const nextText = event.currentTarget.value
        setSearchText(nextText)
        setHasEditedSearchText(true)
        setSuppressNextSearchTrigger(false)
        setIsOpen(true)
        setHighlightedIndex(null)

        // In simple + dynamic shape, forms.{formId}.{fieldId} must reflect the in-progress text
        // even with allowFreeText:false so the search operation's own query/body can reference
        // it directly (design.md, decisión 3). blur/Enter still apply T6's cleanup below.
        if (!isMultiple && (allowFreeText || queryName !== null)) {
          setFormFieldValue(formId, fieldId, nextText, { scopeChain: formContext.scopeChain })
        }
      }}
      onFocus={() => setIsOpen(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )

  return (
    // Explicit `htmlFor`, not implicit label wrapping: in multiple mode, each chip's "Quitar"
    // button is a labelable element that renders *before* the search input in DOM order. Without
    // `htmlFor` pinning the label's associated control to the input, clicking anywhere else inside
    // this label (including a dropdown option) makes the browser forward an extra synthetic click
    // to the label's first labelable descendant — the most recent chip's remove button — silently
    // removing it. `htmlFor` makes the association unambiguous, so that forwarding never happens.
    <label className={getFieldWrapperClassName()} htmlFor={`${formId}-${fieldId}`} data-layout-node="autocomplete">
      <span className={getFieldLabelClassName()}>{label}<FieldTooltip text={tooltip} /></span>
      <div className="relative">
        {isMultiple ? (
          <div className={multipleFieldContainerClassName}>
            {selectedValues.map((itemValue) => (
              <span
                key={itemValue}
                className="inline-flex items-center gap-1 rounded-full bg-app-accent/10 px-2 py-1 text-sm text-app-text"
              >
                {resolveLabelForValue(itemValue)}
                <button
                  type="button"
                  className="cursor-pointer"
                  aria-label={`Quitar ${resolveLabelForValue(itemValue)}`}
                  onClick={() => setFormFieldValue(formId, fieldId, selectedValues.filter((entry) => entry !== itemValue), { scopeChain: formContext.scopeChain })}
                >
                  ×
                </button>
              </span>
            ))}
            {searchInput}
          </div>
        ) : (
          searchInput
        )}
        {isOpen && suggestions.length > 0 ? (
          <ul
            role="listbox"
            id={`${formId}-${fieldId}-listbox`}
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-control border border-app-border-soft bg-white py-1 shadow-lg divide-y divide-app-border-soft"
          >
            {suggestions.map((item, index) => (
              <li
                key={`${fieldId}-${index}-${item.value}`}
                id={`${formId}-${fieldId}-option-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`cursor-pointer px-3 py-2 text-sm leading-5 text-app-text ${
                  index === highlightedIndex ? 'bg-app-accent/10' : 'hover:bg-app-surface-subtle'
                }`}
                // Selection itself happens on `click`, not `mousedown`: `mousedown` only
                // prevents the input's default blur so the click gesture can complete on this
                // same option. In multiple mode the list stays open and a selection grows the
                // chip row, which can shift this option (or a newly-rendered "Quitar" button)
                // out from under the pointer between mousedown and the native click that
                // follows — mutating state here instead of on mousedown would let a real click
                // land on whatever now occupies that position (ghost click), which could
                // immediately remove the chip just added or steal focus from the input.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? <span id={`${formId}-${fieldId}-error`} className={getFieldErrorClassName()}>{error}</span> : null}
    </label>
  )
}
