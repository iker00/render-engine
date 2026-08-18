import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { QueryStateFeedbackVisibleState } from '../../config/runtime-config'
import { QueryStateFeedbackAccordionPropertyField } from '../../dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-property-field'
import {
  addQueryStateFeedbackStateRow,
  buildInitialQueryStateFeedbackFallbackCache,
  removeQueryStateFeedbackStateRow,
  setQueryStateFeedbackStateRuleMode,
} from '../../dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-state'
import { QueryStateFeedbackAccordionWidgetContext } from '../../dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-widget-context'

// Harness plays the role T3 gives `LayoutCanvasPropertiesPanel`: it owns `value` (re-rendering the
// widget with whatever `onChange` committed, exactly like the real panel does after a successful
// `onCommitNodeUpdate`) plus `expandedStates`/`fallbackCacheByState` behind the context. Same
// pattern as `ControlledLayoutSpanWidget` in `layout-canvas-property-field-layout-span.test.tsx`,
// adapted to a widget that still reads/writes the config value through `value`/`onChange` (the
// context here only carries ephemeral UI state).
interface HarnessProps {
  initialValue: unknown
  initialExpanded?: QueryStateFeedbackVisibleState[]
  initialFallbackCache?: Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>
  onChangeSpy: (value: unknown) => void
  onSetExpandedSpy?: (state: QueryStateFeedbackVisibleState, expanded: boolean) => void
  onFallbackCacheCommitSpy?: (state: QueryStateFeedbackVisibleState, fallback: unknown[]) => void
}

function ControlledQueryStateFeedbackAccordion({
  initialValue,
  initialExpanded = [],
  initialFallbackCache = {},
  onChangeSpy,
  onSetExpandedSpy,
  onFallbackCacheCommitSpy,
}: HarnessProps) {
  const [value, setValue] = useState(initialValue)
  const [expandedStates, setExpandedStates] = useState<Set<QueryStateFeedbackVisibleState>>(new Set(initialExpanded))
  const [fallbackCacheByState, setFallbackCacheByState] =
    useState<Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>>(initialFallbackCache)

  function handleChange(nextValue: unknown) {
    onChangeSpy(nextValue)
    setValue(nextValue)
  }

  function onSetExpanded(state: QueryStateFeedbackVisibleState, expanded: boolean) {
    onSetExpandedSpy?.(state, expanded)
    setExpandedStates((prev) => {
      const next = new Set(prev)
      if (expanded) {
        next.add(state)
      } else {
        next.delete(state)
      }
      return next
    })
  }

  function onFallbackCacheCommit(state: QueryStateFeedbackVisibleState, fallback: unknown[]) {
    onFallbackCacheCommitSpy?.(state, fallback)
    setFallbackCacheByState((prev) => ({ ...prev, [state]: fallback }))
  }

  return (
    <QueryStateFeedbackAccordionWidgetContext.Provider
      value={{ fallbackCacheByState, onFallbackCacheCommit, expandedStates, onSetExpanded }}
    >
      <QueryStateFeedbackAccordionPropertyField label="Feedback por estado" value={value} onChange={handleChange} />
    </QueryStateFeedbackAccordionWidgetContext.Provider>
  )
}

function getAddSelect() {
  return screen.getByTestId('query-state-feedback-accordion-add')
}

function getRow(state: QueryStateFeedbackVisibleState) {
  return screen.getByTestId(`query-state-feedback-accordion-row-${state}`)
}

const ALL_STATES: QueryStateFeedbackVisibleState[] = ['idle', 'loading', 'error', 'empty', 'success']

describe('QueryStateFeedbackAccordionPropertyField empty value', () => {
  it('renders zero rows and an enabled "Añadir estado" select with all 5 states plus the placeholder, for undefined value', () => {
    render(<ControlledQueryStateFeedbackAccordion initialValue={undefined} onChangeSpy={vi.fn()} />)

    expect(screen.queryAllByTestId(/^query-state-feedback-accordion-row-/)).toHaveLength(0)
    const select = getAddSelect()
    expect(select).toBeEnabled()
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(6)
    expect(options[0]).toHaveValue('')
    expect(options.slice(1).map((option) => option.getAttribute('value'))).toEqual(ALL_STATES)
  })

  it('renders zero rows for an empty object value', () => {
    render(<ControlledQueryStateFeedbackAccordion initialValue={{}} onChangeSpy={vi.fn()} />)

    expect(screen.queryAllByTestId(/^query-state-feedback-accordion-row-/)).toHaveLength(0)
    expect(getAddSelect()).toBeEnabled()
  })
})

describe('QueryStateFeedbackAccordionPropertyField single present row', () => {
  it('renders the single expanded row with "Mostrar" active, and offers the other 4 states to add', () => {
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={{ success: { mode: 'show' } }}
        initialExpanded={['success']}
        onChangeSpy={vi.fn()}
      />,
    )

    const row = getRow('success')
    expect(within(row).getByRole('button', { name: 'success' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(row).getByRole('radio', { name: 'Mostrar' })).toHaveAttribute('aria-checked', 'true')

    const select = getAddSelect()
    const options = within(select).getAllByRole('option')
    expect(options.slice(1).map((option) => option.getAttribute('value'))).toEqual(['idle', 'loading', 'error', 'empty'])
  })
})

describe('QueryStateFeedbackAccordionPropertyField "Añadir estado"', () => {
  it('choosing a real option commits addQueryStateFeedbackStateRow exactly and expands the new row', () => {
    const onChangeSpy = vi.fn()
    const onSetExpandedSpy = vi.fn()
    const initialValue = { success: { mode: 'show' } }
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={initialValue}
        onChangeSpy={onChangeSpy}
        onSetExpandedSpy={onSetExpandedSpy}
      />,
    )

    fireEvent.change(getAddSelect(), { target: { value: 'error' } })

    expect(onChangeSpy).toHaveBeenCalledWith(addQueryStateFeedbackStateRow(initialValue, 'error'))
    expect(onSetExpandedSpy).toHaveBeenCalledWith('error', true)
  })

  it('is disabled with zero available states, staying mounted with only the placeholder', () => {
    const fullValue = Object.fromEntries(ALL_STATES.map((state) => [state, { mode: 'show' }]))
    render(<ControlledQueryStateFeedbackAccordion initialValue={fullValue} onChangeSpy={vi.fn()} />)

    const select = getAddSelect()
    expect(select).toBeDisabled()
    expect(within(select).getAllByRole('option')).toHaveLength(1)
  })
})

describe('QueryStateFeedbackAccordionPropertyField "Quitar estado"', () => {
  it('commits removeQueryStateFeedbackStateRow exactly', () => {
    const onChangeSpy = vi.fn()
    const initialValue = { success: { mode: 'show' }, error: { mode: 'hide' } }
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={initialValue}
        initialExpanded={['success', 'error']}
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.click(within(getRow('error')).getByRole('button', { name: 'Quitar estado error' }))

    expect(onChangeSpy).toHaveBeenCalledWith(removeQueryStateFeedbackStateRow(initialValue, 'error'))
  })

  it('removing the only present row commits onChange(undefined)', () => {
    const onChangeSpy = vi.fn()
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={{ success: { mode: 'show' } }}
        initialExpanded={['success']}
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.click(within(getRow('success')).getByRole('button', { name: 'Quitar estado success' }))

    expect(onChangeSpy).toHaveBeenCalledWith(undefined)
  })
})

describe('QueryStateFeedbackAccordionPropertyField row header expand/collapse', () => {
  it('pressing the header of an expanded row calls onSetExpanded(state, false) without onChange, unmounting the body; pressing again re-expands it', () => {
    const onChangeSpy = vi.fn()
    const onSetExpandedSpy = vi.fn()
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={{ success: { mode: 'show' } }}
        initialExpanded={['success']}
        onChangeSpy={onChangeSpy}
        onSetExpandedSpy={onSetExpandedSpy}
      />,
    )

    const header = within(getRow('success')).getByRole('button', { name: 'success' })
    fireEvent.click(header)

    expect(onSetExpandedSpy).toHaveBeenCalledWith('success', false)
    expect(onChangeSpy).not.toHaveBeenCalled()
    expect(within(getRow('success')).queryByRole('radiogroup')).not.toBeInTheDocument()

    fireEvent.click(within(getRow('success')).getByRole('button', { name: 'success' }))

    expect(onSetExpandedSpy).toHaveBeenCalledWith('success', true)
    expect(within(getRow('success')).getByRole('radiogroup')).toBeInTheDocument()
  })
})

describe('QueryStateFeedbackAccordionPropertyField mode selection', () => {
  it('choosing a different segment commits setQueryStateFeedbackStateRuleMode exactly, using the current fallbackCacheByState', () => {
    const onChangeSpy = vi.fn()
    const initialValue = { success: { mode: 'show' } }
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={initialValue}
        initialExpanded={['success']}
        onChangeSpy={onChangeSpy}
      />,
    )

    fireEvent.click(within(getRow('success')).getByRole('radio', { name: 'Ocultar' }))

    expect(onChangeSpy).toHaveBeenCalledWith(setQueryStateFeedbackStateRuleMode(initialValue, 'success', 'hide', undefined))
  })

  it('switching to Fallback with no previous fallback or cache entry commits { mode: "fallback", fallback: [] }, calls onFallbackCacheCommit, and shows the not-yet-editable note with no node-editing controls', () => {
    const onChangeSpy = vi.fn()
    const onFallbackCacheCommitSpy = vi.fn()
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={{ error: { mode: 'show' } }}
        initialExpanded={['error']}
        onChangeSpy={onChangeSpy}
        onFallbackCacheCommitSpy={onFallbackCacheCommitSpy}
      />,
    )

    fireEvent.click(within(getRow('error')).getByRole('radio', { name: 'Fallback' }))

    expect(onChangeSpy).toHaveBeenCalledWith({ error: { mode: 'fallback', fallback: [] } })
    expect(onFallbackCacheCommitSpy).toHaveBeenCalledWith('error', [])

    const note = within(getRow('error')).getByTestId('query-state-feedback-accordion-row-error-fallback-note')
    expect(note).toBeInTheDocument()
    expect(within(getRow('error')).queryAllByRole('button', { name: /nodo|node/i })).toHaveLength(0)
  })
})

describe('QueryStateFeedbackAccordionPropertyField fallback preservation through the context (FR6)', () => {
  it('restores the exact same fallback array reference from fallbackCacheByState after a Hide → Fallback round trip, even once value no longer carries it', () => {
    const FALLBACK_NODES = [{ type: 'paragraph', props: { text: 'Sin datos' } }]
    const initialValue = { success: { mode: 'fallback', fallback: FALLBACK_NODES } }
    const initialFallbackCache = buildInitialQueryStateFeedbackFallbackCache(initialValue)
    expect(initialFallbackCache.success).toBe(FALLBACK_NODES)

    const onChangeSpy = vi.fn()
    const onFallbackCacheCommitSpy = vi.fn()
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={initialValue}
        initialExpanded={['success']}
        initialFallbackCache={initialFallbackCache}
        onChangeSpy={onChangeSpy}
        onFallbackCacheCommitSpy={onFallbackCacheCommitSpy}
      />,
    )

    // 1) switch away to "Ocultar" — the harness re-renders with a `value` whose `success` row no
    // longer carries `fallback` at all, exactly like the real panel after a successful commit.
    fireEvent.click(within(getRow('success')).getByRole('radio', { name: 'Ocultar' }))
    expect(onChangeSpy).toHaveBeenLastCalledWith({ success: { mode: 'hide' } })

    // 2) switch back to "Fallback" — the array must come from fallbackCacheByState, not from the
    // now-fallback-less `value`.
    fireEvent.click(within(getRow('success')).getByRole('radio', { name: 'Fallback' }))

    const lastCall = onChangeSpy.mock.calls.at(-1)?.[0] as { success: { mode: string; fallback: unknown[] } }
    expect(lastCall).toEqual({ success: { mode: 'fallback', fallback: FALLBACK_NODES } })
    expect(lastCall.success.fallback).toBe(FALLBACK_NODES)

    expect(onFallbackCacheCommitSpy).toHaveBeenLastCalledWith('success', FALLBACK_NODES)
    expect(onFallbackCacheCommitSpy.mock.calls.at(-1)?.[1]).toBe(FALLBACK_NODES)
  })
})

describe('QueryStateFeedbackAccordionPropertyField unknown mode from manual Monaco edits', () => {
  it('does not throw on mount and leaves no segment active for a row with an out-of-catalog mode, without affecting the rest of the accordion', () => {
    const onChangeSpy = vi.fn()
    expect(() =>
      render(
        <ControlledQueryStateFeedbackAccordion
          initialValue={{ idle: { mode: 'unknown-mode' }, success: { mode: 'show' } }}
          initialExpanded={['idle', 'success']}
          onChangeSpy={onChangeSpy}
        />,
      ),
    ).not.toThrow()

    const idleRadios = within(getRow('idle')).getAllByRole('radio')
    for (const radio of idleRadios) {
      expect(radio).toHaveAttribute('aria-checked', 'false')
    }

    expect(within(getRow('success')).getByRole('radio', { name: 'Mostrar' })).toHaveAttribute('aria-checked', 'true')

    const select = getAddSelect()
    expect(select).toBeEnabled()
    fireEvent.change(select, { target: { value: 'loading' } })
    expect(onChangeSpy).toHaveBeenCalled()
  })
})

describe('QueryStateFeedbackAccordionPropertyField context requirement', () => {
  it('throws when mounted outside QueryStateFeedbackAccordionWidgetContext.Provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      render(<QueryStateFeedbackAccordionPropertyField label="Feedback por estado" value={undefined} onChange={vi.fn()} />),
    ).toThrow('useQueryStateFeedbackAccordionWidgetContext must be used within')

    consoleErrorSpy.mockRestore()
  })
})

describe('QueryStateFeedbackAccordionPropertyField accessibility regression', () => {
  it('the header button and the "Quitar" button of a row are siblings, neither nested inside the other', () => {
    render(
      <ControlledQueryStateFeedbackAccordion
        initialValue={{ success: { mode: 'show' } }}
        initialExpanded={['success']}
        onChangeSpy={vi.fn()}
      />,
    )

    const row = getRow('success')
    const header = within(row).getByRole('button', { name: 'success' })
    const removeButton = within(row).getByRole('button', { name: 'Quitar estado success' })

    expect(header.contains(removeButton)).toBe(false)
    expect(removeButton.contains(header)).toBe(false)
    expect(header.parentElement).toBe(removeButton.parentElement)
  })
})
