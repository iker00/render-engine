import { describe, expect, it } from 'vitest'
import {
  getAppShellClassName,
  getAppShellContentClassName,
  getAppShellErrorBodyClassName,
  getAppShellErrorEyebrowClassName,
  getAppShellErrorTitleClassName,
  getAppShellFrameClassName,
  getChoiceGroupClassName,
  getChoiceOptionClassName,
  getFieldControlClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
  getFormNodeClassName,
  getGridChildSpanClassName,
  getPrimaryButtonNodeClassName,
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationControlsClassName,
  getRepeaterPaginationCurrentButtonClassName,
  getRuntimePageClassName,
  getContainerNodeStyling,
  getHeadingNodeClassName,
  getHeadingTag,
  getImageNodeClassName,
  getListItemClassName,
  getListNodeClassName,
  getParagraphNodeClassName,
  getSecondaryButtonNodeClassName,
  getTableBodyRowClassName,
  getTableCellClassName,
  getTableContainerClassName,
  getTableFilterControlsClassName,
  getTableFilterFieldClassName,
  getTableFilterInputClassName,
  getTableFilterLabelClassName,
  getTableFilterResetButtonClassName,
  getTableHeaderCellClassName,
  getTableNodeClassName,
  getTablePaginationButtonClassName,
  getTablePaginationControlsClassName,
  getTablePaginationCurrentButtonClassName,
  getTableScrollContainerClassName,
  getTableSortButtonClassName,
} from '../../runtime/runtime-node-styling'

describe('runtime node styling', () => {
  it('exposes stable shell and page slots for the light institutional baseline', () => {
    expect(getAppShellClassName()).toBe(
      'min-h-screen bg-app-background text-app-text',
    )
    expect(getAppShellContentClassName()).toBe(
      'mx-auto flex w-full max-w-shell px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12',
    )
    expect(getAppShellFrameClassName()).toBe(
      'w-full rounded-shell border border-app-border-strong bg-app-surface p-4 shadow-shell sm:p-6 lg:p-8',
    )
    expect(getRuntimePageClassName()).toBe('grid gap-5 lg:gap-6')
    expect(getAppShellErrorEyebrowClassName()).toBe(
      'text-xs font-semibold uppercase tracking-[0.24em] text-app-accent',
    )
    expect(getAppShellErrorTitleClassName()).toBe(
      'm-0 text-2xl font-semibold leading-tight tracking-[-0.02em] text-app-text-strong sm:text-3xl',
    )
    expect(getAppShellErrorBodyClassName()).toBe(
      'max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base sm:leading-7',
    )
  })

  it('returns stable Tailwind classes for container aliases without custom styles', () => {
    expect(getContainerNodeStyling({ direction: 'row', gap: 'sm' })).toEqual({
      className: 'flex w-full flex-row flex-nowrap gap-3',
    })
  })

  it('uses md as the default container gap when none is declared', () => {
    expect(getContainerNodeStyling({})).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-5',
    })
  })

  it('treats variant default like the historical container styling and adds a closed card preset', () => {
    expect(getContainerNodeStyling({ variant: 'default' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-5',
    })

    expect(getContainerNodeStyling({ variant: 'card' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap rounded-section border border-app-border-soft bg-white p-4 shadow-section sm:p-5 gap-5',
    })
  })

  it('maps the expanded container gap aliases without custom styles', () => {
    expect(getContainerNodeStyling({ gap: 'md' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-5',
    })
    expect(getContainerNodeStyling({ gap: 'lg' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-8',
    })
    expect(getContainerNodeStyling({ gap: 'xl' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-10',
    })
    expect(getContainerNodeStyling({ gap: '2xl' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-12',
    })
  })

  it('switches to grid mode when columns are declared and ignores direction for the layout mode', () => {
    expect(
      getContainerNodeStyling({
        direction: 'row',
        columns: 4,
        align: 'center',
        justify: 'between',
      }),
    ).toEqual({
      className: 'grid w-full grid-cols-4 items-center justify-between gap-5',
    })
  })

  it('maps responsive container columns with a safe mobile fallback', () => {
    expect(
      getContainerNodeStyling({
        columns: {
          base: 1,
          md: 2,
          lg: 4,
        },
      }),
    ).toEqual({
      className: 'grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5',
    })

    expect(
      getContainerNodeStyling({
        columns: {
          md: 2,
          lg: 4,
        },
      }),
    ).toEqual({
      className: 'grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5',
    })
  })

  it('maps align justify and wrap in linear mode with nowrap as the default', () => {
    expect(
      getContainerNodeStyling({
        direction: 'row',
        align: 'end',
        justify: 'evenly',
      }),
    ).toEqual({
      className: 'flex w-full flex-row items-end justify-evenly flex-nowrap gap-5',
    })

    expect(
      getContainerNodeStyling({
        wrap: 'wrap-reverse',
      }),
    ).toEqual({
      className: 'flex w-full flex-col flex-wrap-reverse gap-5',
    })
  })

  it('preserves arbitrary gap values with a CSS variable escape hatch', () => {
    expect(getContainerNodeStyling({ direction: 'column', gap: '18px' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-[var(--runtime-container-gap)]',
      style: {
        '--runtime-container-gap': '18px',
      },
    })
  })

  it('does not add border-t to form-section containers (separator is now an explicit divider node)', () => {
    expect(getContainerNodeStyling({ surface: 'form-section' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap gap-5',
    })
    expect(getContainerNodeStyling({ surface: 'form-section' })).not.toEqual(
      expect.objectContaining({ className: expect.stringContaining('border-t') }),
    )
    expect(getContainerNodeStyling({ surface: 'form-section' })).not.toEqual(
      expect.objectContaining({ className: expect.stringContaining('pt-5') }),
    )
  })

  it('keeps row containers inside forms plain and form-section with columns also has no border-t', () => {
    expect(getContainerNodeStyling({ direction: 'row' })).toEqual({
      className: 'flex w-full flex-row flex-nowrap gap-5',
    })
    expect(getContainerNodeStyling({ direction: 'row', columns: 2, surface: 'form-section' })).toEqual({
      className: 'grid w-full grid-cols-2 gap-5',
    })
  })

  it('lets card take visual precedence over form-section and coexist with grid columns', () => {
    expect(getContainerNodeStyling({ variant: 'card', surface: 'form-section' })).toEqual({
      className: 'flex w-full flex-col flex-nowrap rounded-section border border-app-border-soft bg-white p-4 shadow-section sm:p-5 gap-5',
    })

    expect(getContainerNodeStyling({ variant: 'card', columns: 2, surface: 'form-section' })).toEqual({
      className: 'grid w-full grid-cols-2 rounded-section border border-app-border-soft bg-white p-4 shadow-section sm:p-5 gap-5',
    })
  })

  it('maps grid span wrappers only inside grid parents and clamps to parent columns', () => {
    expect(getGridChildSpanClassName()).toBeNull()
    expect(getGridChildSpanClassName(2)).toBeNull()
    expect(getGridChildSpanClassName(2, 4)).toBe('col-span-2')
    expect(getGridChildSpanClassName(5, 3)).toBe('col-span-3')
  })

  it('maps responsive grid span wrappers and clamps each breakpoint independently', () => {
    expect(
      getGridChildSpanClassName(
        {
          base: 1,
          md: 2,
        },
        {
          base: 1,
          md: 2,
          lg: 4,
        },
      ),
    ).toBe('col-span-1 md:col-span-2')

    expect(
      getGridChildSpanClassName(
        {
          base: 2,
          lg: 4,
        },
        {
          base: 1,
          lg: 3,
        },
      ),
    ).toBe('col-span-1 lg:col-span-3')
  })

  it('recalculates responsive spans when parent columns change at omitted child breakpoints', () => {
    expect(
      getGridChildSpanClassName(
        {
          md: 2,
        },
        {
          base: 1,
          lg: 3,
        },
      ),
    ).toBe('col-span-1 lg:col-span-2')
  })

  it('clamps responsive spans when parent columns decrease at a larger breakpoint', () => {
    expect(
      getGridChildSpanClassName(
        {
          base: 4,
        },
        {
          base: 4,
          lg: 2,
        },
      ),
    ).toBe('col-span-4 lg:col-span-2')
  })

  it('keeps focus styling on controls without outline offset gaps', () => {
    expect(getFieldControlClassName(false)).toContain('focus-visible:ring-2')
    expect(getFieldControlClassName(false)).toContain('focus-visible:outline-none')
    expect(getFieldControlClassName(false)).not.toContain('focus-visible:outline-offset-2')
  })

  it('returns compact stable classes for forms controls buttons and choice groups', () => {
    expect(getFormNodeClassName()).toBe('grid w-full gap-5 sm:gap-6')
    expect(getFieldWrapperClassName()).toBe('grid gap-2')
    expect(getFieldLabelClassName()).toBe('text-sm font-semibold leading-5 text-app-text-strong')
    expect(getFieldControlClassName(false)).toBe(
      'w-full rounded-control border border-app-border-soft bg-white px-4 py-3 sm:px-3.5 sm:py-2.5 text-sm leading-6 sm:leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:border-app-accent focus-visible:ring-app-accent',
    )
    expect(getPrimaryButtonNodeClassName()).toBe(
      'inline-flex items-center justify-center self-start rounded-control border border-app-accent bg-app-accent px-4 py-3 sm:px-3.5 sm:py-2.5 text-sm font-semibold leading-5 text-white transition-colors hover:bg-app-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getSecondaryButtonNodeClassName()).toBe(
      'inline-flex items-center justify-center self-start rounded-control border border-app-border-strong bg-white px-4 py-3 sm:px-3.5 sm:py-2.5 text-sm font-semibold leading-5 text-app-text-strong transition-colors hover:bg-app-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getChoiceGroupClassName()).toBe('grid gap-2.5')
    expect(getChoiceOptionClassName()).toBe('flex items-start gap-2.5 text-sm leading-5 text-app-text')
  })

  it('returns compact stable classes for repeater pagination controls', () => {
    expect(getRepeaterPaginationControlsClassName()).toBe('flex w-full flex-wrap items-center justify-center gap-3 pt-2')
    expect(getRepeaterPaginationControlsClassName(4)).toBe(
      'col-span-4 flex w-full flex-wrap items-center justify-center gap-3 pt-2',
    )
    expect(getRepeaterPaginationControlsClassName({ base: 1, md: 2, lg: 4 })).toBe(
      'col-span-1 md:col-span-2 lg:col-span-4 flex w-full flex-wrap items-center justify-center gap-3 pt-2',
    )
    expect(getRepeaterPaginationButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-border-strong bg-white px-3.5 py-2 text-sm font-semibold leading-5 text-app-text-strong transition-colors hover:bg-app-surface-subtle disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getRepeaterPaginationCurrentButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-accent bg-app-accent px-3.5 py-2 text-sm font-semibold leading-5 text-white transition-colors hover:bg-app-accent-strong disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
  })

  it('returns compact stable classes for table controls', () => {
    expect(getTableContainerClassName()).toBe('rounded-card border border-app-border-soft bg-white')
    expect(getTableScrollContainerClassName()).toBe('overflow-x-auto')
    expect(getTableFilterControlsClassName()).toBe(
      'flex w-full flex-wrap items-end justify-start gap-3 border-b border-app-border-soft bg-white px-4 py-3',
    )
    expect(getTableFilterFieldClassName()).toBe('flex min-w-40 flex-col gap-1')
    expect(getTableFilterLabelClassName()).toBe('sr-only')
    expect(getTableFilterInputClassName()).toBe(
      'w-full min-w-40 rounded-control border border-app-border-soft bg-white px-3 py-2 text-sm leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:border-app-accent focus-visible:ring-app-accent',
    )
    expect(getTableFilterResetButtonClassName()).toBe(
      'inline-flex items-center justify-center self-end rounded-control border border-app-border-strong bg-white px-3.5 py-2 text-sm font-semibold leading-5 text-app-text-strong transition-colors hover:bg-app-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTableSortButtonClassName(false)).toBe(
      'inline-flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-app-text-strong transition-colors hover:text-app-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTableSortButtonClassName(true)).toBe(
      'inline-flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-app-accent transition-colors hover:text-app-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTablePaginationControlsClassName()).toBe('flex w-full flex-wrap items-center justify-center gap-3 border-t border-app-border-soft px-4 py-3')
    expect(getTablePaginationButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-border-strong bg-white px-3.5 py-2 text-sm font-semibold leading-5 text-app-text-strong transition-colors hover:bg-app-surface-subtle disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTablePaginationCurrentButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-accent bg-app-accent px-3.5 py-2 text-sm font-semibold leading-5 text-white transition-colors hover:bg-app-accent-strong disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
  })

  it('supports an inline choice-group variant with wrap and without option card styling', () => {
    expect(getChoiceGroupClassName('inline')).toBe('flex flex-wrap gap-x-4 gap-y-2.5')
    expect(getChoiceGroupClassName('vertical')).toBe('grid gap-2.5')
    expect(getChoiceOptionClassName('inline')).toBe('flex max-w-full items-start gap-2.5 text-sm leading-5 text-app-text')
    expect(getChoiceOptionClassName('inline')).not.toContain('border')
    expect(getChoiceOptionClassName('inline')).not.toContain('rounded')
    expect(getChoiceOptionClassName('inline')).not.toContain('basis-')
    expect(getChoiceOptionClassName('inline')).not.toContain('min-w-')
  })

  it('returns stable Tailwind classes for leaf nodes', () => {
    expect(getHeadingNodeClassName(2)).toBe(
      'm-0 text-2xl sm:text-3xl font-semibold leading-tight tracking-[-0.03em] text-app-text-strong',
    )
    expect(getParagraphNodeClassName()).toBe(
      'm-0 text-sm leading-6 text-app-text-muted sm:text-base sm:leading-7',
    )
    expect(getListNodeClassName()).toBe(
      'm-0 grid list-disc gap-3 pl-5 text-app-text marker:text-app-accent',
    )
    expect(getListItemClassName()).toBe('leading-7')
    expect(getImageNodeClassName()).toBe(
      'block max-w-full rounded-card border border-app-border-soft bg-app-surface-subtle object-cover',
    )
    expect(getTableContainerClassName()).toBe('rounded-card border border-app-border-soft bg-white')
    expect(getTableNodeClassName()).toBe('min-w-full border-collapse text-left text-sm leading-6 text-app-text')
    expect(getTableHeaderCellClassName()).toBe(
      'border-b border-app-border-soft bg-app-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-app-text-strong',
    )
    expect(getTableBodyRowClassName()).toBe('border-b border-app-border-soft last:border-b-0')
    expect(getTableCellClassName()).toBe('px-4 py-3 align-top text-sm text-app-text')
  })

  it('keeps heading tag resolution separate from styling', () => {
    expect(getHeadingTag(0)).toBe('h1')
    expect(getHeadingTag(3)).toBe('h3')
    expect(getHeadingTag(9)).toBe('h6')
  })
})
