import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfigError, RuntimeResponsiveBreakpoint, RuntimeResponsiveLayoutValue } from '../../config/runtime-config'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { LayoutSpanPropertyField } from '../../dev-runtime/layout-canvas/property-fields/layout-span-property-field'
import {
  LayoutSpanWidgetContext,
  type LayoutSpanRowRejection,
} from '../../dev-runtime/layout-canvas/property-fields/layout-span-widget-context'

const BREAKPOINTS_IN_ORDER = ['base', 'sm', 'md', 'lg', 'xl', '2xl'] as const

function sampleError(): RuntimeConfigError {
  return { code: 'invalid-layout', displayMode: 'always', message: 'span fuera de rango' }
}

interface ControlledLayoutSpanWidgetProps {
  parentColumns: RuntimeResponsiveLayoutValue
  initialSpanValue: RuntimeResponsiveLayoutValue | undefined
  onCommitSpy?: (nextSpan: RuntimeResponsiveLayoutValue | undefined) => void
  commitResultFor?: (nextSpan: RuntimeResponsiveLayoutValue | undefined) => CommitCanvasMutationResult | void
}

// LayoutSpanPropertyField reads everything from LayoutSpanWidgetContext (T2) instead of props —
// this harness plays the role LayoutCanvasPropertiesPanel plays in production: it owns
// `spanValue` and re-renders the widget with whatever `commitSpan` produced, exactly like the
// real panel does after a successful `onCommitNodeUpdate`. Same shape as
// `ControlledChoiceItemsField` in `layout-canvas-property-field-choice-items.test.tsx`, adapted
// to a context-driven widget instead of a controlled-prop one.
//
// T6 (0133): `rowRejections`/`onRowCommitResult` moved out of the widget itself into
// `LayoutSpanWidgetContext` — this harness now owns that state too (`rowRejections` below),
// mirroring exactly what `LayoutCanvasPropertiesPanel` does in production, so the widget's own
// commit-rejection-feedback tests below still exercise real behavior through the context contract
// rather than internal widget state.
function ControlledLayoutSpanWidget({ parentColumns, initialSpanValue, onCommitSpy, commitResultFor }: ControlledLayoutSpanWidgetProps) {
  const [spanValue, setSpanValue] = useState(initialSpanValue)
  const [rowRejections, setRowRejections] = useState<Partial<Record<RuntimeResponsiveBreakpoint, LayoutSpanRowRejection>>>({})

  function commitSpan(nextSpan: RuntimeResponsiveLayoutValue | undefined): CommitCanvasMutationResult | void {
    onCommitSpy?.(nextSpan)
    const result = commitResultFor?.(nextSpan)
    if (!result || result.status === 'applied') {
      setSpanValue(nextSpan)
    }
    return result
  }

  function onRowCommitResult(breakpoint: RuntimeResponsiveBreakpoint, attemptedValue: number, result: CommitCanvasMutationResult | void) {
    if (result && result.status === 'rejected') {
      setRowRejections((prev) => ({ ...prev, [breakpoint]: { value: attemptedValue, error: result.error } }))
      return
    }
    setRowRejections((prev) => {
      if (!(breakpoint in prev)) return prev
      const next = { ...prev }
      delete next[breakpoint]
      return next
    })
  }

  return (
    <LayoutSpanWidgetContext.Provider value={{ parentColumns, spanValue, commitSpan, rowRejections, onRowCommitResult }}>
      <LayoutSpanPropertyField />
    </LayoutSpanWidgetContext.Provider>
  )
}

function getRow(breakpoint: string) {
  return screen.getByTestId(`layout-span-widget-row-${breakpoint}`)
}

describe('LayoutSpanPropertyField row rendering (integer parentColumns)', () => {
  it('renders six rows in base/sm/md/lg/xl/2xl order, each with inherited value 1, no "Quitar" anywhere', () => {
    render(<ControlledLayoutSpanWidget parentColumns={6} initialSpanValue={undefined} />)

    const widget = screen.getByTestId('layout-span-widget')
    const rowTestIds = within(widget)
      .getAllByTestId(/^layout-span-widget-row-/)
      .map((row) => row.getAttribute('data-testid'))
    expect(rowTestIds).toEqual(BREAKPOINTS_IN_ORDER.map((breakpoint) => `layout-span-widget-row-${breakpoint}`))

    for (const breakpoint of BREAKPOINTS_IN_ORDER) {
      const row = getRow(breakpoint)
      expect(within(row).getByLabelText(breakpoint)).toHaveValue(1)
      expect(row).toHaveAttribute('data-explicit', 'false')
      expect(within(row).queryByRole('button', { name: `Quitar ${breakpoint}` })).not.toBeInTheDocument()
    }
  })
})

// FR2/FR1 (0136): the per-row "/ N" denominator is removed from the widget entirely — the
// mobile-first cascade of `parentColumns` is still resolved through `normalizeResponsiveLayoutValue`,
// but the only place it's now observable is the occupancy preview's legend, which reflects
// whichever row currently has focus.
describe('LayoutSpanPropertyField occupancy preview denominator (responsive parentColumns)', () => {
  it('resolves each row denominator from parentColumns via the mobile-first cascade of normalizeResponsiveLayoutValue, surfaced only through the preview legend', () => {
    render(<ControlledLayoutSpanWidget parentColumns={{ base: 2, md: 4, xl: 12 }} initialSpanValue={undefined} />)

    const preview = () => screen.getByTestId('layout-span-occupancy-preview')

    expect(within(preview()).getByText('Vista previa en base: ocupa 1 de 2.')).toBeInTheDocument()

    fireEvent.focus(within(getRow('sm')).getByLabelText('sm'))
    expect(within(preview()).getByText('Vista previa en sm: ocupa 1 de 2.')).toBeInTheDocument()

    fireEvent.focus(within(getRow('md')).getByLabelText('md'))
    expect(within(preview()).getByText('Vista previa en md: ocupa 1 de 4.')).toBeInTheDocument()

    fireEvent.focus(within(getRow('lg')).getByLabelText('lg'))
    expect(within(preview()).getByText('Vista previa en lg: ocupa 1 de 4.')).toBeInTheDocument()

    fireEvent.focus(within(getRow('xl')).getByLabelText('xl'))
    expect(within(preview()).getByText('Vista previa en xl: ocupa 1 de 12.')).toBeInTheDocument()

    fireEvent.focus(within(getRow('2xl')).getByLabelText('2xl'))
    expect(within(preview()).getByText('Vista previa en 2xl: ocupa 1 de 12.')).toBeInTheDocument()
  })
})

// T1 (0136), FR1/FR2/FR3: horizontal single-row layout, "×" overlay control replacing the text
// "Quitar" button, and removal of the box around the whole widget.
describe('LayoutSpanPropertyField horizontal layout and box removal (visual normalization)', () => {
  it('renders the six rows inside a single shared horizontal row container instead of stacked vertical rows', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    const widget = screen.getByTestId('layout-span-widget')
    const rows = BREAKPOINTS_IN_ORDER.map((breakpoint) => getRow(breakpoint))
    const rowContainer = rows[0].parentElement

    expect(rowContainer).not.toBeNull()
    expect(rowContainer).not.toBe(widget)
    for (const row of rows) {
      expect(row.parentElement).toBe(rowContainer)
    }
    expect(rowContainer?.className).toMatch(/\bflex\b/)
    expect(rowContainer?.className).not.toMatch(/\bflex-col\b/)
  })

  it('never renders a "/ N" denominator indicator anywhere in the widget, only in the occupancy preview legend', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    const widget = screen.getByTestId('layout-span-widget')
    expect(within(widget).queryByText(/\/\s*\d+/)).not.toBeInTheDocument()
  })

  it('positions "Quitar" as an absolute "×" overlay on the relatively-positioned input column, only for explicit rows', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    const explicitRow = getRow('base')
    expect(explicitRow.className).toMatch(/\brelative\b/)
    const removeButton = within(explicitRow).getByRole('button', { name: 'Quitar base' })
    expect(removeButton.className).toMatch(/\babsolute\b/)
    expect(removeButton).toHaveTextContent('×')

    const inheritedRow = getRow('sm')
    expect(within(inheritedRow).queryByRole('button', { name: 'Quitar sm' })).not.toBeInTheDocument()
  })

  it('drops the box styling (border/rounded/background) from the root fieldset, keeping "Columnas" as a plain-text legend', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={undefined} />)

    const widget = screen.getByTestId('layout-span-widget')
    expect(widget.tagName).toBe('FIELDSET')
    expect(widget.className).not.toMatch(/\bborder\b/)
    expect(widget.className).not.toMatch(/rounded/)
    expect(widget.className).not.toMatch(/\bbg-/)

    const legend = screen.getByText('Columnas')
    expect(legend.tagName).toBe('LEGEND')
    expect(legend.className).toBe('px-1 mb-2 text-xs font-medium text-gray-700')
  })
})

describe('LayoutSpanPropertyField row rendering (explicit span map)', () => {
  it('shows explicit values with "Quitar" and inherited values without it, following the mobile-first cascade', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ sm: 3, lg: 5 }} />)

    const expected: Record<(typeof BREAKPOINTS_IN_ORDER)[number], { value: number; explicit: boolean }> = {
      base: { value: 1, explicit: false },
      sm: { value: 3, explicit: true },
      md: { value: 3, explicit: false },
      lg: { value: 5, explicit: true },
      xl: { value: 5, explicit: false },
      '2xl': { value: 5, explicit: false },
    }

    for (const breakpoint of BREAKPOINTS_IN_ORDER) {
      const row = getRow(breakpoint)
      const { value, explicit } = expected[breakpoint]
      expect(within(row).getByLabelText(breakpoint)).toHaveValue(value)
      expect(row).toHaveAttribute('data-explicit', String(explicit))
      if (explicit) {
        expect(within(row).getByRole('button', { name: `Quitar ${breakpoint}` })).toBeInTheDocument()
      } else {
        expect(within(row).queryByRole('button', { name: `Quitar ${breakpoint}` })).not.toBeInTheDocument()
      }
    }
  })
})

describe('LayoutSpanPropertyField editing', () => {
  it('editing a row without an explicit value merges { ...currentSpanMap, [breakpoint]: n } into commitSpan', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ sm: 3, lg: 5 }} onCommitSpy={onCommitSpy} />)

    fireEvent.change(within(getRow('base')).getByLabelText('base'), { target: { value: '2' } })

    expect(onCommitSpy).toHaveBeenCalledWith({ sm: 3, lg: 5, base: 2 })
  })

  it('editing a row with an explicit value replaces it in place, keeping the other declared breakpoints', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ sm: 3, lg: 5 }} onCommitSpy={onCommitSpy} />)

    fireEvent.change(within(getRow('sm')).getByLabelText('sm'), { target: { value: '7' } })

    expect(onCommitSpy).toHaveBeenCalledWith({ sm: 7, lg: 5 })
  })

  it('seeds base with the previous plain integer on the first edit of a non-base row', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={4} onCommitSpy={onCommitSpy} />)

    fireEvent.change(within(getRow('md')).getByLabelText('md'), { target: { value: '6' } })

    expect(onCommitSpy).toHaveBeenCalledWith({ base: 4, md: 6 })
  })

  it('editing base directly on a plain integer value replaces it without residue', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={4} onCommitSpy={onCommitSpy} />)

    fireEvent.change(within(getRow('base')).getByLabelText('base'), { target: { value: '5' } })

    expect(onCommitSpy).toHaveBeenCalledWith({ base: 5 })
  })

  it('shows no "Quitar" button on any row for a plain integer value before the first edit', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={4} />)

    for (const breakpoint of BREAKPOINTS_IN_ORDER) {
      expect(within(getRow(breakpoint)).queryByRole('button', { name: `Quitar ${breakpoint}` })).not.toBeInTheDocument()
    }
  })
})

describe('LayoutSpanPropertyField "Quitar"', () => {
  it('removes just the targeted key, keeping the rest of the map', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ sm: 3, lg: 5 }} onCommitSpy={onCommitSpy} />)

    fireEvent.click(within(getRow('sm')).getByRole('button', { name: 'Quitar sm' }))

    expect(onCommitSpy).toHaveBeenCalledWith({ lg: 5 })
  })

  it('removing the only explicit key commits undefined, and the re-rendered widget shows fully inherited rows with no "Quitar"', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={6} initialSpanValue={{ base: 3 }} onCommitSpy={onCommitSpy} />)

    fireEvent.click(within(getRow('base')).getByRole('button', { name: 'Quitar base' }))

    expect(onCommitSpy).toHaveBeenCalledWith(undefined)

    for (const breakpoint of BREAKPOINTS_IN_ORDER) {
      const row = getRow(breakpoint)
      expect(within(row).getByLabelText(breakpoint)).toHaveValue(1)
      expect(row).toHaveAttribute('data-explicit', 'false')
      expect(within(row).queryByRole('button', { name: `Quitar ${breakpoint}` })).not.toBeInTheDocument()
    }
  })
})

describe('LayoutSpanPropertyField commit rejection feedback', () => {
  it('keeps the typed value and shows a role="alert" with the error code/message on a rejected commit, scoped to that row', () => {
    const error = sampleError()
    render(
      <ControlledLayoutSpanWidget
        parentColumns={12}
        initialSpanValue={{ sm: 3 }}
        commitResultFor={(nextSpan) =>
          isPlainObject(nextSpan) && nextSpan.sm === 99 ? { status: 'rejected', error } : undefined
        }
      />,
    )

    fireEvent.change(within(getRow('sm')).getByLabelText('sm'), { target: { value: '99' } })

    expect(within(getRow('sm')).getByLabelText('sm')).toHaveValue(99)
    const alert = within(getRow('sm')).getByRole('alert')
    expect(alert).toHaveTextContent(error.code)
    expect(alert).toHaveTextContent(error.message)

    expect(within(getRow('base')).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(getRow('lg')).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a later successful commit on the same row clears its alert', () => {
    const error = sampleError()
    let shouldReject = true
    render(
      <ControlledLayoutSpanWidget
        parentColumns={12}
        initialSpanValue={{ sm: 3 }}
        commitResultFor={() => (shouldReject ? { status: 'rejected', error } : undefined)}
      />,
    )

    fireEvent.change(within(getRow('sm')).getByLabelText('sm'), { target: { value: '99' } })
    expect(within(getRow('sm')).getByRole('alert')).toBeInTheDocument()

    shouldReject = false
    fireEvent.change(within(getRow('sm')).getByLabelText('sm'), { target: { value: '4' } })

    expect(within(getRow('sm')).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(getRow('sm')).getByLabelText('sm')).toHaveValue(4)
  })

  it("a rejected commit in one row and a successful commit in a different row leave the first row's alert intact", () => {
    const error = sampleError()
    render(
      <ControlledLayoutSpanWidget
        parentColumns={12}
        initialSpanValue={{ sm: 3, lg: 5 }}
        commitResultFor={(nextSpan) =>
          isPlainObject(nextSpan) && nextSpan.sm === 99 ? { status: 'rejected', error } : undefined
        }
      />,
    )

    fireEvent.change(within(getRow('sm')).getByLabelText('sm'), { target: { value: '99' } })
    expect(within(getRow('sm')).getByRole('alert')).toBeInTheDocument()

    fireEvent.change(within(getRow('lg')).getByLabelText('lg'), { target: { value: '8' } })

    expect(within(getRow('sm')).getByRole('alert')).toBeInTheDocument()
    expect(within(getRow('lg')).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('LayoutSpanPropertyField occupancy preview (T5, focus-driven)', () => {
  function getPreview() {
    return screen.getByTestId('layout-span-occupancy-preview')
  }

  it('shows the preview for base by default on mount, for a node with three explicit keys', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    expect(within(getPreview()).getByText('Vista previa en base: ocupa 2 de 12.')).toBeInTheDocument()
  })

  it('giving focus to the md row input switches the preview to md', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    fireEvent.focus(within(getRow('md')).getByLabelText('md'))

    expect(within(getPreview()).getByText('Vista previa en md: ocupa 4 de 12.')).toBeInTheDocument()
  })

  it('losing focus of the md row without another row capturing it returns the preview to base', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    const mdInput = within(getRow('md')).getByLabelText('md')
    fireEvent.focus(mdInput)
    fireEvent.blur(mdInput)

    expect(within(getPreview()).getByText('Vista previa en base: ocupa 2 de 12.')).toBeInTheDocument()
  })

  it('moving focus directly from the md row to the lg row leaves the preview on lg', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} />)

    const mdInput = within(getRow('md')).getByLabelText('md')
    const lgInput = within(getRow('lg')).getByLabelText('lg')
    fireEvent.focus(mdInput)
    // Native DOM focus movement blurs the outgoing element before focusing the incoming one —
    // reproduced here explicitly since fireEvent.focus/blur dispatch discrete events rather than
    // calling the real .focus() imperative API (see the widget's Restricciones note).
    fireEvent.blur(mdInput)
    fireEvent.focus(lgInput)

    expect(within(getPreview()).getByText('Vista previa en lg: ocupa 4 de 12.')).toBeInTheDocument()
  })

  it('shows the preview for base with the uniform inherited value when layout.span is a plain integer', () => {
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={4} />)

    expect(within(getPreview()).getByText('Vista previa en base: ocupa 4 de 12.')).toBeInTheDocument()
  })

  it('changing which row is focused never triggers an extra commit — the preview is purely visual state', () => {
    const onCommitSpy = vi.fn()
    render(<ControlledLayoutSpanWidget parentColumns={12} initialSpanValue={{ base: 2, md: 4, xl: 8 }} onCommitSpy={onCommitSpy} />)

    const mdInput = within(getRow('md')).getByLabelText('md')
    const lgInput = within(getRow('lg')).getByLabelText('lg')
    fireEvent.focus(mdInput)
    fireEvent.blur(mdInput)
    fireEvent.focus(lgInput)
    fireEvent.blur(lgInput)

    expect(onCommitSpy).not.toHaveBeenCalled()
  })
})

describe('LayoutSpanPropertyField context requirement', () => {
  it('throws when mounted outside LayoutSpanWidgetContext.Provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<LayoutSpanPropertyField />)).toThrow(
      'useLayoutSpanWidgetContext must be used within LayoutSpanWidgetContext.Provider',
    )

    consoleErrorSpy.mockRestore()
  })
})

function isPlainObject(value: unknown): value is Record<string, number> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
