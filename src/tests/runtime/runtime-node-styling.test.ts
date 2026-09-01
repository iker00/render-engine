import { describe, expect, it } from 'vitest'
import {
  getAccordionBodyAnimationClassName,
  getAccordionBodyClassName,
  getAccordionChevronClassName,
  getAccordionHeaderClassName,
  getAlertBodyClassName,
  getAlertClassName,
  getAlertIconClassName,
  getAlertTitleClassName,
  getAppShellClassName,
  getAppShellContentPaddingClassName,
  getAppShellHeaderClassName,
  getBadgeCircleDotClassName,
  getBadgeCircleLabelClassName,
  getBadgePillClassName,
  getSkeletonAnimateClassName,
  getSkeletonBaseClassName,
  getStatAccentRootClassName,
  getStatAccentIconClassName,
  getStatAccentLabelClassName,
  getStatAccentValueClassName,
  getStatPlainRootClassName,
  getStatPlainIconClassName,
  getStatPlainLabelClassName,
  getStatPlainValueClassName,
  getStatTintedRootClassName,
  getStatTintedIconClassName,
  getStatTintedLabelClassName,
  getStatTintedValueClassName,
  getTabsRootClassName,
  getTabsBarClassName,
  getTabsButtonClassName,
  getTabsPanelClassName,
  getAppShellContentClassName,
  getAppShellErrorBodyClassName,
  getAppShellErrorEyebrowClassName,
  getAppShellErrorTitleClassName,
  getAppShellFrameClassName,
  getButtonSwitchClassName,
  getButtonVariantClassName,
  getChoiceGroupClassName,
  getChoiceOptionClassName,
  getFieldControlClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
  getFormNodeClassName,
  getGridChildSpanClassName,
  getLinkNodeClassName,
  getPrimaryButtonNodeClassName,
  getRepeaterGridClassName,
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationControlsClassName,
  getRepeaterPaginationCurrentButtonClassName,
  getRuntimePageClassName,
  getContainerNodeStyling,
  getGridLayoutClassNames,
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
  getInputIconHolderClassName,
  getInputIconClassName,
  getInputWithIconClassName,
  getInputIconWrapperClassName,
  getFileManagerRowClassName,
  getFileManagerRowFileNameClassName,
  getFileManagerRowActionClassName,
  getFileManagerListErrorClassName,
  getFileManagerListEmptyClassName,
  getFileManagerListDividerClassName,
  getFileManagerErrorItemClassName,
  getFileManagerDropZoneClassName,
  getFileManagerDropZoneTextClassName,
  getFileManagerDropZoneProgressTrackClassName,
  getFileManagerDropZoneProgressFillClassName,
  getFileManagerDropZoneIconColorClassName,
  getModalOverlayClassName,
  getModalPanelClassName,
} from '../../runtime/runtime-node-styling'
import {
  getAppShellSidebarClassName,
  getAppShellSidebarStickyStyle,
} from '../../runtime/runtime-node-styling-app-shell-sidebar'

describe('runtime node styling', () => {
  it('exposes stable shell and page slots for the light institutional baseline', () => {
    expect(getAppShellClassName()).toBe(
      'flex h-full w-full flex-col text-app-text',
    )
    expect(getAppShellContentClassName()).toBe(
      'flex w-full flex-1 min-w-0 min-h-0',
    )
    expect(getAppShellFrameClassName()).toBe(
      'flex w-full flex-1 min-w-0 min-h-0 flex-col',
    )
    expect(getAppShellContentPaddingClassName()).toBe('p-6 sm:p-8 lg:p-10')
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

  it('resolves the app shell header pinned/unpinned variant via a lookup map (0124-T3)', () => {
    expect(getAppShellHeaderClassName({ pinned: true })).toBe(
      'sticky top-0 z-10 w-full border-b border-app-border-soft bg-app-surface shadow-shell',
    )
    expect(getAppShellHeaderClassName({ pinned: false })).toBe(
      'w-full border-b border-app-border-soft bg-app-surface shadow-shell',
    )
  })

  it('resolves the app shell sidebar class name by scrollBehavior, sticky + internal scroll in "page" mode and bounded scroll only in "fixed" mode (0124-T4)', () => {
    expect(getAppShellSidebarClassName({ collapsed: false })).toBe(
      'w-64 shrink-0 border-r border-app-border-soft bg-app-surface sticky top-[var(--shell-sidebar-sticky-top)] h-[calc(100vh_-_var(--shell-sidebar-sticky-top))] overflow-y-auto',
    )
    expect(getAppShellSidebarClassName({ collapsed: false, scrollBehavior: 'page' })).toBe(
      'w-64 shrink-0 border-r border-app-border-soft bg-app-surface sticky top-[var(--shell-sidebar-sticky-top)] h-[calc(100vh_-_var(--shell-sidebar-sticky-top))] overflow-y-auto',
    )
    expect(getAppShellSidebarClassName({ collapsed: true, scrollBehavior: 'page' })).toBe(
      'w-16 shrink-0 border-r border-app-border-soft bg-app-surface sticky top-[var(--shell-sidebar-sticky-top)] h-[calc(100vh_-_var(--shell-sidebar-sticky-top))] overflow-y-auto',
    )
    expect(getAppShellSidebarClassName({ collapsed: false, scrollBehavior: 'fixed' })).toBe(
      'w-64 shrink-0 border-r border-app-border-soft bg-app-surface overflow-y-auto',
    )
  })

  it('builds the sidebar sticky-top CSS variable from a pixel height (0124-T4)', () => {
    expect(getAppShellSidebarStickyStyle(56)).toEqual({ '--shell-sidebar-sticky-top': '56px' })
    expect(getAppShellSidebarStickyStyle(0)).toEqual({ '--shell-sidebar-sticky-top': '0px' })
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

  describe('getGridLayoutClassNames', () => {
    it('returns grid, w-full and grid-cols-{n} for a fixed columns value between 1 and 12', () => {
      expect(getGridLayoutClassNames({ columns: 1 }).classNames).toEqual(
        expect.arrayContaining(['grid', 'w-full', 'grid-cols-1']),
      )
      expect(getGridLayoutClassNames({ columns: 12 }).classNames).toEqual(
        expect.arrayContaining(['grid', 'w-full', 'grid-cols-12']),
      )
    })

    it('returns per-breakpoint classes for a responsive columns map, with base as the mobile fallback when missing', () => {
      expect(
        getGridLayoutClassNames({
          columns: { base: 1, md: 2, lg: 4 },
        }).classNames,
      ).toEqual(['grid', 'w-full', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-5'])

      expect(
        getGridLayoutClassNames({
          columns: { md: 2, lg: 4 },
        }).classNames,
      ).toEqual(['grid', 'w-full', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-5'])
    })

    it('uses md as the effective gap default when none is declared', () => {
      expect(getGridLayoutClassNames({ columns: 2 })).toEqual({
        classNames: ['grid', 'w-full', 'grid-cols-2', 'gap-5'],
      })
    })

    it('returns the stable class for a supported gap alias without style', () => {
      expect(getGridLayoutClassNames({ columns: 2, gap: 'sm' })).toEqual({
        classNames: ['grid', 'w-full', 'grid-cols-2', 'gap-3'],
      })
      expect(getGridLayoutClassNames({ columns: 2, gap: 'lg' }).style).toBeUndefined()
    })

    it('returns the CSS variable class and style for an arbitrary gap value', () => {
      expect(getGridLayoutClassNames({ columns: 2, gap: '18px' })).toEqual({
        classNames: ['grid', 'w-full', 'grid-cols-2', 'gap-[var(--runtime-container-gap)]'],
        style: {
          '--runtime-container-gap': '18px',
        },
      })
    })

    it('adds items-*/justify-* classes when align/justify are declared, and neither when omitted', () => {
      expect(getGridLayoutClassNames({ columns: 2, align: 'center', justify: 'between' }).classNames).toEqual([
        'grid',
        'w-full',
        'grid-cols-2',
        'items-center',
        'justify-between',
        'gap-5',
      ])
      expect(getGridLayoutClassNames({ columns: 2 }).classNames).not.toEqual(
        expect.arrayContaining(['items-center', 'items-start', 'items-end', 'items-stretch']),
      )
      expect(getGridLayoutClassNames({ columns: 2 }).classNames.join(' ')).not.toContain('justify-')
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
    expect(getFieldLabelClassName()).toBe('text-sm font-medium leading-5 text-app-text-strong')
    expect(getFieldControlClassName(false)).toBe(
      'w-full rounded-control border border-app-border-soft bg-white px-3 py-2 text-sm leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:border-app-accent focus-visible:ring-app-accent',
    )
    expect(getPrimaryButtonNodeClassName()).toBe(
      'inline-flex items-center justify-center self-start rounded-control border border-app-accent bg-app-accent px-3.5 py-2 text-sm font-semibold leading-5 text-white transition-colors hover:bg-app-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getSecondaryButtonNodeClassName()).toBe(
      'inline-flex items-center justify-center self-start rounded-control border border-app-border-strong bg-white px-3.5 py-2 text-sm font-semibold leading-5 text-app-text-strong transition-colors hover:bg-app-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
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
      'inline-flex items-center justify-center rounded-control border border-app-border-strong bg-white px-3 py-1.5 text-sm font-semibold leading-5 text-app-text-strong transition-colors cursor-pointer hover:bg-app-surface-subtle disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getRepeaterPaginationCurrentButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-accent bg-app-accent px-3 py-1.5 text-sm font-semibold leading-5 text-white transition-colors cursor-pointer hover:bg-app-accent-strong disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
  })

  it('getRepeaterPaginationButtonClassName includes cursor-pointer and preserves disabled:cursor-not-allowed', () => {
    const cn = getRepeaterPaginationButtonClassName()
    expect(cn).toContain('cursor-pointer')
    expect(cn).toContain('disabled:cursor-not-allowed')
  })

  it('getRepeaterPaginationCurrentButtonClassName includes cursor-pointer (inherited from base)', () => {
    expect(getRepeaterPaginationCurrentButtonClassName()).toContain('cursor-pointer')
  })

  describe('getRepeaterGridClassName', () => {
    it('returns a single className string including grid-cols-{n} for a fixed columns value', () => {
      const result = getRepeaterGridClassName({ columns: 3 })

      expect(result.className).toContain('grid-cols-3')
      expect(result.className).toBe('grid w-full grid-cols-3 gap-5')
    })

    it('returns per-breakpoint classes for a responsive columns map, with base as the mobile fallback', () => {
      expect(getRepeaterGridClassName({ columns: { md: 2, lg: 4 } }).className).toBe(
        'grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5',
      )
    })

    it('uses md as the effective gap default when none is declared', () => {
      expect(getRepeaterGridClassName({ columns: 2 })).toEqual({
        className: 'grid w-full grid-cols-2 gap-5',
      })
    })

    it('returns the stable class for a supported gap alias without style', () => {
      expect(getRepeaterGridClassName({ columns: 2, gap: 'sm' })).toEqual({
        className: 'grid w-full grid-cols-2 gap-3',
      })
    })

    it('returns the CSS variable class and style for an arbitrary gap value', () => {
      expect(getRepeaterGridClassName({ columns: 2, gap: '18px' })).toEqual({
        className: 'grid w-full grid-cols-2 gap-[var(--runtime-container-gap)]',
        style: {
          '--runtime-container-gap': '18px',
        },
      })
    })

    it('adds items-*/justify-* classes when align/justify are declared', () => {
      expect(getRepeaterGridClassName({ columns: 2, align: 'center', justify: 'between' }).className).toBe(
        'grid w-full grid-cols-2 items-center justify-between gap-5',
      )
    })
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
      'inline-flex items-center justify-center self-end rounded-control border border-app-border-strong bg-white px-3.5 py-2 text-sm font-medium leading-5 text-app-text-strong transition-colors cursor-pointer hover:bg-app-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTableSortButtonClassName(false)).toBe(
      'inline-flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-app-text-strong transition-colors cursor-pointer hover:text-app-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTableSortButtonClassName(true)).toBe(
      'inline-flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-app-accent transition-colors cursor-pointer hover:text-app-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTablePaginationControlsClassName()).toBe('flex w-full flex-wrap items-center justify-center gap-3 border-t border-app-border-soft px-4 py-3')
    expect(getTablePaginationButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-border-strong bg-white px-3 py-1.5 text-sm font-semibold leading-5 text-app-text-strong transition-colors cursor-pointer hover:bg-app-surface-subtle disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
    expect(getTablePaginationCurrentButtonClassName()).toBe(
      'inline-flex items-center justify-center rounded-control border border-app-accent bg-app-accent px-3 py-1.5 text-sm font-semibold leading-5 text-white transition-colors cursor-pointer hover:bg-app-accent-strong disabled:cursor-not-allowed disabled:border-app-border-soft disabled:text-app-text-muted disabled:hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent',
    )
  })

  it('getTableSortButtonClassName includes cursor-pointer in both active states', () => {
    expect(getTableSortButtonClassName(false)).toContain('cursor-pointer')
    expect(getTableSortButtonClassName(true)).toContain('cursor-pointer')
  })

  it('getTableFilterResetButtonClassName includes cursor-pointer', () => {
    expect(getTableFilterResetButtonClassName()).toContain('cursor-pointer')
  })

  it('getTablePaginationButtonClassName includes cursor-pointer (delegation to repeater base)', () => {
    expect(getTablePaginationButtonClassName()).toContain('cursor-pointer')
  })

  it('getTablePaginationCurrentButtonClassName includes cursor-pointer (delegation to repeater base)', () => {
    expect(getTablePaginationCurrentButtonClassName()).toContain('cursor-pointer')
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
      'm-0 text-base sm:text-lg font-semibold leading-tight tracking-[-0.03em] text-app-text-strong',
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

  describe('getButtonVariantClassName', () => {
    it('renders a solid primary button with semantic primary tokens and self-start when fullWidth is false', () => {
      const className = getButtonVariantClassName('primary', 'solid', false)

      expect(className).toContain('bg-primary-600')
      expect(className).toContain('border-primary-600')
      expect(className).toContain('hover:bg-primary-700')
      expect(className).toContain('hover:border-primary-700')
      expect(className).toContain('text-white')
      expect(className).toContain('self-start')
      expect(className).not.toContain('w-full')
      expect(className).not.toMatch(/blue-/)
    })

    it('uses w-full instead of self-start when fullWidth is true', () => {
      const className = getButtonVariantClassName('primary', 'solid', true)

      expect(className).toContain('w-full')
      expect(className).not.toContain('self-start')
    })

    it('renders a solid danger button with semantic danger tokens and white text', () => {
      const className = getButtonVariantClassName('danger', 'solid', false)

      expect(className).toContain('bg-danger-600')
      expect(className).toContain('border-danger-600')
      expect(className).toContain('hover:bg-danger-700')
      expect(className).toContain('text-white')
      expect(className).not.toMatch(/red-/)
    })

    it('renders a solid warning button with semantic warning tokens and white text', () => {
      const className = getButtonVariantClassName('warning', 'solid', false)

      expect(className).toContain('bg-warning-500')
      expect(className).toContain('border-warning-500')
      expect(className).toContain('text-white')
      expect(className).not.toMatch(/yellow-/)
      expect(className).not.toMatch(/gray-/)
    })

    it('renders an outline primary button with transparent background and semantic border and text', () => {
      const className = getButtonVariantClassName('primary', 'outline', false)

      expect(className).toContain('bg-transparent')
      expect(className).toContain('border-primary-500')
      expect(className).toContain('text-primary-600')
      expect(className).toContain('hover:bg-primary-50')
      expect(className).not.toMatch(/blue-/)
    })

    it('renders a danger outline button with semantic border, text, and hover tokens', () => {
      const className = getButtonVariantClassName('danger', 'outline', false)

      expect(className).toContain('border-danger-500')
      expect(className).toContain('text-danger-600')
      expect(className).toContain('hover:bg-danger-50')
      expect(className).not.toMatch(/red-/)
    })

    it('renders a ghost success button with transparent background and border and semantic text', () => {
      const className = getButtonVariantClassName('success', 'ghost', false)

      expect(className).toContain('bg-transparent')
      expect(className).toContain('border-transparent')
      expect(className).toContain('text-success-600')
      expect(className).toContain('hover:bg-success-100')
      expect(className).not.toMatch(/green-/)
    })

    it('renders a ghost warning button with semantic warning tokens', () => {
      const className = getButtonVariantClassName('warning', 'ghost', false)

      expect(className).toContain('text-warning-600')
      expect(className).toContain('hover:bg-warning-100')
      expect(className).not.toMatch(/yellow-/)
    })

    it('renders a link info button with semantic info text and hover underline', () => {
      const className = getButtonVariantClassName('info', 'link', false)

      expect(className).toContain('text-info-600')
      expect(className).toContain('hover:underline')
      expect(className).not.toMatch(/cyan-/)
    })

    it('renders an outline neutral button with semantic neutral border and text', () => {
      const className = getButtonVariantClassName('neutral', 'outline', false)

      expect(className).toContain('text-neutral-600')
      expect(className).toContain('border-neutral-400')
      expect(className).not.toMatch(/gray-/)
    })

    it('renders a solid neutral button with semantic neutral tokens and no gray-* classes', () => {
      const className = getButtonVariantClassName('neutral', 'solid', false)

      expect(className).toContain('bg-neutral-500')
      expect(className).toContain('border-neutral-500')
      expect(className).not.toMatch(/gray-/)
    })

    it('renders a solid success button with semantic success tokens', () => {
      const className = getButtonVariantClassName('success', 'solid', false)

      expect(className).toContain('bg-success-600')
      expect(className).toContain('border-success-600')
      expect(className).toContain('text-white')
      expect(className).not.toMatch(/green-/)
    })

    it('renders a solid info button with semantic info tokens', () => {
      const className = getButtonVariantClassName('info', 'solid', false)

      expect(className).toContain('bg-info-500')
      expect(className).toContain('border-info-500')
      expect(className).not.toMatch(/cyan-/)
    })

    it('renders a link neutral button with semantic neutral text and no gray-* classes', () => {
      const className = getButtonVariantClassName('neutral', 'link', false)

      expect(className).toContain('text-neutral-600')
      expect(className).toContain('hover:underline')
      expect(className).not.toMatch(/gray-/)
    })

    it('uses font-semibold for solid variant and font-medium for outline ghost and link variants (D6)', () => {
      expect(getButtonVariantClassName('primary', 'solid', false)).toContain('font-semibold')
      expect(getButtonVariantClassName('primary', 'solid', false)).not.toContain('font-medium')

      expect(getButtonVariantClassName('primary', 'outline', false)).toContain('font-medium')
      expect(getButtonVariantClassName('primary', 'outline', false)).not.toContain('font-semibold')

      expect(getButtonVariantClassName('primary', 'ghost', false)).toContain('font-medium')
      expect(getButtonVariantClassName('primary', 'ghost', false)).not.toContain('font-semibold')

      expect(getButtonVariantClassName('primary', 'link', false)).toContain('font-medium')
      expect(getButtonVariantClassName('primary', 'link', false)).not.toContain('font-semibold')
    })

    it('uses uniform padding px-3.5 py-2 without responsive inversion (D7)', () => {
      const solidClass = getButtonVariantClassName('primary', 'solid', false)

      expect(solidClass).toContain('px-3.5')
      expect(solidClass).toContain('py-2')
      expect(solidClass).not.toContain('sm:px-3.5')
      expect(solidClass).not.toContain('sm:py-2.5')
      expect(solidClass).not.toContain('px-4')
      expect(solidClass).not.toContain('py-3')
    })

    it('getButtonVariantClassName includes cursor-pointer (regression control)', () => {
      expect(getButtonVariantClassName('primary', 'solid', false)).toContain('cursor-pointer')
    })
  })

  describe('getButtonSwitchClassName', () => {
    const allColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('produces a distinct track className per semantic color when checked is true', () => {
      const trackClassNames = allColors.map((color) => getButtonSwitchClassName(true, color).trackClassName)

      expect(new Set(trackClassNames).size).toBe(allColors.length)
    })

    it('produces the same neutral track className regardless of color when checked is false', () => {
      const trackClassNames = allColors.map((color) => getButtonSwitchClassName(false, color).trackClassName)

      trackClassNames.forEach((trackClassName) => {
        expect(trackClassName).toBe(trackClassNames[0])
      })
    })

    it('returns a non-empty knobClassName for both checked states', () => {
      allColors.forEach((color) => {
        expect(getButtonSwitchClassName(true, color).knobClassName.length).toBeGreaterThan(0)
        expect(getButtonSwitchClassName(false, color).knobClassName.length).toBeGreaterThan(0)
      })
    })
  })

  describe('T4 — typography scale, weights and padding', () => {
    it('getHeadingNodeClassName level 1 returns text-lg sm:text-xl and font-semibold (D5 D6)', () => {
      const cn = getHeadingNodeClassName(1)

      expect(cn).toContain('text-lg')
      expect(cn).toContain('sm:text-xl')
      expect(cn).toContain('font-semibold')
      expect(cn).not.toContain('text-3xl')
      expect(cn).not.toContain('text-4xl')
    })

    it('getHeadingNodeClassName level 2 returns text-base sm:text-lg and font-semibold (D5 D6)', () => {
      const cn = getHeadingNodeClassName(2)

      expect(cn).toContain('text-base')
      expect(cn).toContain('sm:text-lg')
      expect(cn).toContain('font-semibold')
      expect(cn).not.toContain('text-2xl')
    })

    it('getHeadingNodeClassName levels 3 and 4 return text-sm sm:text-base and font-medium (D5 D6)', () => {
      const cn3 = getHeadingNodeClassName(3)
      const cn4 = getHeadingNodeClassName(4)

      expect(cn3).toContain('text-sm')
      expect(cn3).toContain('sm:text-base')
      expect(cn3).toContain('font-medium')
      expect(cn3).not.toContain('font-semibold')

      expect(cn4).toContain('text-sm')
      expect(cn4).toContain('sm:text-base')
      expect(cn4).toContain('font-medium')
      expect(cn4).not.toContain('font-semibold')
    })

    it('getHeadingNodeClassName levels 5 and 6 return text-xs sm:text-sm and font-medium (D5 D6)', () => {
      const cn5 = getHeadingNodeClassName(5)
      const cn6 = getHeadingNodeClassName(6)

      expect(cn5).toContain('text-xs')
      expect(cn5).toContain('sm:text-sm')
      expect(cn5).toContain('font-medium')
      expect(cn5).not.toContain('font-semibold')

      expect(cn6).toContain('text-xs')
      expect(cn6).toContain('sm:text-sm')
      expect(cn6).toContain('font-medium')
      expect(cn6).not.toContain('font-semibold')
    })

    it('getFieldLabelClassName uses font-medium and not font-semibold (D6)', () => {
      const cn = getFieldLabelClassName()

      expect(cn).toContain('font-medium')
      expect(cn).not.toContain('font-semibold')
    })

    it('getFieldControlClassName uses px-3 py-2 without responsive inversion (D7)', () => {
      const cn = getFieldControlClassName(false)

      expect(cn).toContain('px-3')
      expect(cn).toContain('py-2')
      expect(cn).not.toContain('px-4')
      expect(cn).not.toContain('py-3')
      expect(cn).not.toContain('sm:px-3.5')
      expect(cn).not.toContain('sm:py-2.5')
    })

    it('getPrimaryButtonNodeClassName uses px-3.5 py-2 without responsive inversion (D7)', () => {
      const cn = getPrimaryButtonNodeClassName()

      expect(cn).toContain('px-3.5')
      expect(cn).toContain('py-2')
      expect(cn).not.toContain('px-4')
      expect(cn).not.toContain('py-3')
      expect(cn).not.toContain('sm:px-3.5')
      expect(cn).not.toContain('sm:py-2.5')
    })

    it('getSecondaryButtonNodeClassName uses px-3.5 py-2 without responsive inversion (D7)', () => {
      const cn = getSecondaryButtonNodeClassName()

      expect(cn).toContain('px-3.5')
      expect(cn).toContain('py-2')
      expect(cn).not.toContain('px-4')
      expect(cn).not.toContain('py-3')
      expect(cn).not.toContain('sm:px-3.5')
      expect(cn).not.toContain('sm:py-2.5')
    })

    it('getRepeaterPaginationButtonClassName uses px-3 py-1.5 (D7)', () => {
      const cn = getRepeaterPaginationButtonClassName()

      expect(cn).toContain('px-3')
      expect(cn).toContain('py-1.5')
      expect(cn).not.toContain('px-3.5')
      expect(cn).not.toContain('py-2')
    })

    it('getTableFilterResetButtonClassName uses font-medium (D6)', () => {
      const cn = getTableFilterResetButtonClassName()

      expect(cn).toContain('font-medium')
      expect(cn).not.toContain('font-semibold')
    })

    it('getTableFilterInputClassName uses px-3 py-2 uniform (D7)', () => {
      const cn = getTableFilterInputClassName()

      expect(cn).toContain('px-3')
      expect(cn).toContain('py-2')
      expect(cn).not.toContain('sm:px-3.5')
      expect(cn).not.toContain('sm:py-2.5')
    })
  })

  describe('T5 — accordion styling functions (D9 D10 D6 D8)', () => {
    it('getAccordionHeaderClassName uses primary tokens, transition-colors and font-medium (D6 D8 D10)', () => {
      const cn = getAccordionHeaderClassName()

      expect(cn).toContain('bg-primary-50')
      expect(cn).toContain('hover:bg-primary-100')
      expect(cn).toContain('focus-visible:ring-primary-600')
      expect(cn).toContain('transition-colors')
      expect(cn).toContain('font-medium')
      expect(cn).not.toContain('bg-app-accent/10')
      expect(cn).not.toContain('hover:bg-app-accent/20')
      expect(cn).not.toContain('focus-visible:ring-app-accent')
    })

    it('getAccordionChevronClassName(true) includes rotate-180 and text-primary-600', () => {
      const cn = getAccordionChevronClassName(true)

      expect(cn).toContain('rotate-180')
      expect(cn).toContain('text-primary-600')
    })

    it('getAccordionChevronClassName(false) includes text-primary-600 but not rotate-180', () => {
      const cn = getAccordionChevronClassName(false)

      expect(cn).toContain('text-primary-600')
      expect(cn).not.toContain('rotate-180')
    })

    it('getAccordionBodyClassName includes the container classes', () => {
      const cn = getAccordionBodyClassName()

      expect(cn).toContain('flex')
      expect(cn).toContain('flex-col')
      expect(cn).toContain('gap-5')
      expect(cn).toContain('px-4')
      expect(cn).toContain('py-2')
    })

    it('getAccordionBodyAnimationClassName(true) returns animate-accordion-open', () => {
      expect(getAccordionBodyAnimationClassName(true)).toBe('animate-accordion-open')
    })

    it('getAccordionBodyAnimationClassName(false) returns animate-accordion-close', () => {
      expect(getAccordionBodyAnimationClassName(false)).toBe('animate-accordion-close')
    })

    it('getAccordionHeaderClassName includes cursor-pointer', () => {
      expect(getAccordionHeaderClassName()).toContain('cursor-pointer')
    })
  })

  describe('T6 — tabs styling functions (D9 D10 D6 D7 D8)', () => {
    it('getTabsRootClassName horizontal returns flex flex-col', () => {
      const cn = getTabsRootClassName('horizontal')

      expect(cn).toContain('flex')
      expect(cn).toContain('flex-col')
      expect(cn).not.toContain('flex-row')
    })

    it('getTabsRootClassName vertical returns flex flex-row', () => {
      const cn = getTabsRootClassName('vertical')

      expect(cn).toContain('flex')
      expect(cn).toContain('flex-row')
      expect(cn).not.toContain('flex-col')
    })

    it('getTabsBarClassName vertical includes w-48 and shrink-0', () => {
      const cn = getTabsBarClassName('vertical')

      expect(cn).toContain('w-48')
      expect(cn).toContain('shrink-0')
      expect(cn).toContain('flex-col')
      expect(cn).not.toContain('overflow-x-auto')
    })

    it('getTabsBarClassName horizontal includes overflow-x-auto and flex-row', () => {
      const cn = getTabsBarClassName('horizontal')

      expect(cn).toContain('overflow-x-auto')
      expect(cn).toContain('flex-row')
      expect(cn).not.toContain('w-48')
    })

    it('getTabsButtonClassName active horizontal includes text-primary-700, font-semibold, px-3 py-1.5, shrink-0, whitespace-nowrap, transition-colors and border-app-border-soft (D6 D7 D8 D10)', () => {
      const cn = getTabsButtonClassName(true, 'horizontal')

      expect(cn).toContain('text-primary-700')
      expect(cn).toContain('font-semibold')
      expect(cn).toContain('transition-colors')
      expect(cn).toContain('px-3')
      expect(cn).toContain('py-1.5')
      expect(cn).toContain('shrink-0')
      expect(cn).toContain('whitespace-nowrap')
      expect(cn).toContain('border-app-border-soft')
      expect(cn).not.toContain('border-primary-600')
      expect(cn).not.toMatch(/blue-/)
      expect(cn).not.toContain('font-medium')
    })

    it('getTabsButtonClassName inactive vertical includes app-text-muted, font-medium, text-left, whitespace-normal, break-words and transition-colors (D6 D8 D10)', () => {
      const cn = getTabsButtonClassName(false, 'vertical')

      expect(cn).toContain('text-app-text-muted')
      expect(cn).toContain('hover:text-app-text-strong')
      expect(cn).toContain('font-medium')
      expect(cn).toContain('transition-colors')
      expect(cn).toContain('text-left')
      expect(cn).toContain('whitespace-normal')
      expect(cn).toContain('break-words')
      expect(cn).not.toMatch(/gray-/)
      expect(cn).not.toContain('font-semibold')
    })

    it('getTabsButtonClassName inactive horizontal includes shrink-0 and whitespace-nowrap but not text-left', () => {
      const cn = getTabsButtonClassName(false, 'horizontal')

      expect(cn).toContain('shrink-0')
      expect(cn).toContain('whitespace-nowrap')
      expect(cn).not.toContain('text-left')
      expect(cn).not.toContain('whitespace-normal')
    })

    it('getTabsButtonClassName active vertical includes text-left, whitespace-normal, break-words', () => {
      const cn = getTabsButtonClassName(true, 'vertical')

      expect(cn).toContain('text-left')
      expect(cn).toContain('whitespace-normal')
      expect(cn).toContain('break-words')
      expect(cn).not.toContain('shrink-0')
    })

    it('getTabsPanelClassName includes flex-1 border border-app-border-soft p-4 flex flex-col gap-5 and no bg-', () => {
      const cn = getTabsPanelClassName()

      expect(cn).toContain('flex-1')
      expect(cn).toContain('border')
      expect(cn).toContain('border-app-border-soft')
      expect(cn).toContain('p-4')
      expect(cn).toContain('flex')
      expect(cn).toContain('flex-col')
      expect(cn).toContain('gap-5')
      expect(cn).not.toContain('bg-')
    })

    it('getTabsButtonClassName active horizontal applies border to top left and right sides and not to bottom (connected tab technique)', () => {
      const cn = getTabsButtonClassName(true, 'horizontal')

      expect(cn).toContain('border-t')
      expect(cn).toContain('border-l')
      expect(cn).toContain('border-r')
      expect(cn).not.toMatch(/border-b/)
    })

    it('getTabsButtonClassName active vertical applies border to top left and bottom sides and not to right (connected tab technique)', () => {
      const cn = getTabsButtonClassName(true, 'vertical')

      expect(cn).toContain('border-t')
      expect(cn).toContain('border-l')
      expect(cn).toContain('border-b')
      expect(cn).not.toMatch(/border-r/)
      expect(cn).toContain('border-app-border-soft')
      expect(cn).not.toContain('border-primary-600')
    })

    it('getTabsButtonClassName active horizontal and vertical overlap the panel border by 1px with relative z-10 and bg-app-background', () => {
      const cnH = getTabsButtonClassName(true, 'horizontal')
      const cnV = getTabsButtonClassName(true, 'vertical')

      expect(cnH).toContain('-mb-px')
      expect(cnH).toContain('relative')
      expect(cnH).toContain('z-10')
      expect(cnH).toContain('bg-app-background')
      expect(cnH).not.toContain('-mr-px')

      expect(cnV).toContain('-mr-px')
      expect(cnV).toContain('relative')
      expect(cnV).toContain('z-10')
      expect(cnV).toContain('bg-app-background')
      expect(cnV).not.toContain('-mb-px')
    })

    it('getTabsButtonClassName inactive horizontal and vertical do not contain border-app-border-soft or border-primary-600', () => {
      const cnH = getTabsButtonClassName(false, 'horizontal')
      const cnV = getTabsButtonClassName(false, 'vertical')

      expect(cnH).not.toContain('border-app-border-soft')
      expect(cnH).not.toContain('border-primary-600')
      expect(cnV).not.toContain('border-app-border-soft')
      expect(cnV).not.toContain('border-primary-600')
    })

    it('getTabsButtonClassName includes cursor-pointer in all variants and orientations', () => {
      expect(getTabsButtonClassName(true, 'horizontal')).toContain('cursor-pointer')
      expect(getTabsButtonClassName(false, 'horizontal')).toContain('cursor-pointer')
      expect(getTabsButtonClassName(true, 'vertical')).toContain('cursor-pointer')
      expect(getTabsButtonClassName(false, 'vertical')).toContain('cursor-pointer')
    })
  })

  describe('T7 — link node styling function (D9 D10 D6 D8)', () => {
    it('getLinkNodeClassName includes text-primary-600, hover:text-primary-800, underline, transition-colors and font-medium', () => {
      const cn = getLinkNodeClassName()

      expect(cn).toContain('text-primary-600')
      expect(cn).toContain('hover:text-primary-800')
      expect(cn).toContain('underline')
      expect(cn).toContain('transition-colors')
      expect(cn).toContain('font-medium')
    })

    it('getLinkNodeClassName does not include text-blue-600 or hover:text-blue-800', () => {
      const cn = getLinkNodeClassName()

      expect(cn).not.toContain('text-blue-600')
      expect(cn).not.toContain('hover:text-blue-800')
      expect(cn).not.toMatch(/blue-/)
    })

    it('getLinkNodeClassName includes inline-flex and items-center', () => {
      const cn = getLinkNodeClassName()

      expect(cn).toContain('inline-flex')
      expect(cn).toContain('items-center')
    })
  })

  describe('T8 — stat styling functions (D9 D10 D6)', () => {
    const allColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('getStatAccentRootClassName returns border-l-4 pl-4 py-2 for all colors', () => {
      allColors.forEach((color) => {
        const cn = getStatAccentRootClassName(color)
        expect(cn).toContain('border-l-4')
        expect(cn).toContain('pl-4')
        expect(cn).toContain('py-2')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getStatAccentRootClassName neutral uses border-neutral-400', () => {
      expect(getStatAccentRootClassName('neutral')).toContain('border-neutral-400')
    })

    it('getStatAccentRootClassName primary uses border-primary-500', () => {
      expect(getStatAccentRootClassName('primary')).toContain('border-primary-500')
    })

    it('getStatAccentRootClassName success uses border-success-500', () => {
      expect(getStatAccentRootClassName('success')).toContain('border-success-500')
    })

    it('getStatAccentRootClassName warning uses border-warning-500', () => {
      expect(getStatAccentRootClassName('warning')).toContain('border-warning-500')
    })

    it('getStatAccentRootClassName danger uses border-danger-500', () => {
      expect(getStatAccentRootClassName('danger')).toContain('border-danger-500')
    })

    it('getStatAccentRootClassName info uses border-info-500', () => {
      expect(getStatAccentRootClassName('info')).toContain('border-info-500')
    })

    it('getStatAccentIconClassName returns size-8 shrink-0 for all colors', () => {
      allColors.forEach((color) => {
        const cn = getStatAccentIconClassName(color)
        expect(cn).toContain('size-8')
        expect(cn).toContain('shrink-0')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getStatAccentIconClassName neutral uses text-neutral-400', () => {
      expect(getStatAccentIconClassName('neutral')).toContain('text-neutral-400')
    })

    it('getStatAccentIconClassName primary uses text-primary-500', () => {
      expect(getStatAccentIconClassName('primary')).toContain('text-primary-500')
    })

    it('getStatAccentIconClassName success uses text-success-500', () => {
      expect(getStatAccentIconClassName('success')).toContain('text-success-500')
    })

    it('getStatAccentIconClassName warning uses text-warning-500', () => {
      expect(getStatAccentIconClassName('warning')).toContain('text-warning-500')
    })

    it('getStatAccentIconClassName danger uses text-danger-500', () => {
      expect(getStatAccentIconClassName('danger')).toContain('text-danger-500')
    })

    it('getStatAccentIconClassName info uses text-info-500', () => {
      expect(getStatAccentIconClassName('info')).toContain('text-info-500')
    })

    it('getStatAccentLabelClassName returns text-sm font-medium text-app-text-muted', () => {
      const cn = getStatAccentLabelClassName()
      expect(cn).toContain('text-sm')
      expect(cn).toContain('font-medium')
      expect(cn).toContain('text-app-text-muted')
      expect(cn).not.toMatch(/gray-/)
    })

    it('getStatAccentValueClassName returns text-2xl font-semibold text-app-text-strong', () => {
      const cn = getStatAccentValueClassName()
      expect(cn).toContain('text-2xl')
      expect(cn).toContain('font-semibold')
      expect(cn).toContain('text-app-text-strong')
      expect(cn).not.toContain('font-bold')
      expect(cn).not.toMatch(/gray-/)
    })

    it('getStatTintedRootClassName returns rounded-lg p-4 for all colors', () => {
      allColors.forEach((color) => {
        const cn = getStatTintedRootClassName(color)
        expect(cn).toContain('rounded-lg')
        expect(cn).toContain('p-4')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getStatTintedRootClassName neutral uses bg-neutral-100', () => {
      expect(getStatTintedRootClassName('neutral')).toContain('bg-neutral-100')
    })

    it('getStatTintedRootClassName primary uses bg-primary-100', () => {
      expect(getStatTintedRootClassName('primary')).toContain('bg-primary-100')
    })

    it('getStatTintedRootClassName success uses bg-success-100', () => {
      expect(getStatTintedRootClassName('success')).toContain('bg-success-100')
    })

    it('getStatTintedRootClassName warning uses bg-warning-100', () => {
      expect(getStatTintedRootClassName('warning')).toContain('bg-warning-100')
    })

    it('getStatTintedRootClassName danger uses bg-danger-100', () => {
      expect(getStatTintedRootClassName('danger')).toContain('bg-danger-100')
    })

    it('getStatTintedRootClassName info uses bg-info-100', () => {
      expect(getStatTintedRootClassName('info')).toContain('bg-info-100')
    })

    it('getStatTintedIconClassName returns size-8 shrink-0 for all colors', () => {
      allColors.forEach((color) => {
        const cn = getStatTintedIconClassName(color)
        expect(cn).toContain('size-8')
        expect(cn).toContain('shrink-0')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getStatTintedIconClassName neutral uses text-neutral-600', () => {
      expect(getStatTintedIconClassName('neutral')).toContain('text-neutral-600')
    })

    it('getStatTintedIconClassName success uses text-success-600', () => {
      expect(getStatTintedIconClassName('success')).toContain('text-success-600')
    })

    it('getStatTintedLabelClassName returns text-sm font-medium with semantic color per color', () => {
      allColors.forEach((color) => {
        const cn = getStatTintedLabelClassName(color)
        expect(cn).toContain('text-sm')
        expect(cn).toContain('font-medium')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getStatTintedLabelClassName success uses text-success-700', () => {
      expect(getStatTintedLabelClassName('success')).toContain('text-success-700')
    })

    it('getStatTintedLabelClassName neutral uses text-neutral-700', () => {
      expect(getStatTintedLabelClassName('neutral')).toContain('text-neutral-700')
    })

    it('getStatTintedValueClassName returns text-2xl font-semibold with semantic color per color (D6)', () => {
      allColors.forEach((color) => {
        const cn = getStatTintedValueClassName(color)
        expect(cn).toContain('text-2xl')
        expect(cn).toContain('font-semibold')
        expect(cn).not.toContain('font-bold')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getStatTintedValueClassName success uses text-success-800', () => {
      expect(getStatTintedValueClassName('success')).toContain('text-success-800')
    })

    it('getStatTintedValueClassName neutral uses text-neutral-800', () => {
      expect(getStatTintedValueClassName('neutral')).toContain('text-neutral-800')
    })

    describe('stat plain styling functions', () => {
      const semanticColorFamilies = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

      it('getStatPlainRootClassName does not include any border-l- class', () => {
        const cn = getStatPlainRootClassName()
        expect(cn).not.toMatch(/\bborder-l-/)
      })

      it('getStatPlainRootClassName does not include any semantic bg-*-100 class', () => {
        const cn = getStatPlainRootClassName()
        for (const family of semanticColorFamilies) {
          expect(cn).not.toContain(`bg-${family}-100`)
        }
      })

      it('getStatPlainRootClassName includes py-2 as neutral padding', () => {
        expect(getStatPlainRootClassName()).toContain('py-2')
      })

      it('getStatPlainLabelClassName uses the same neutral muted text token as getStatAccentLabelClassName', () => {
        expect(getStatPlainLabelClassName()).toContain('text-app-text-muted')
      })

      it('getStatPlainValueClassName uses the same strong text token as getStatAccentValueClassName', () => {
        expect(getStatPlainValueClassName()).toContain('text-app-text-strong')
      })

      it('getStatPlainIconClassName does not include any class from the semantic color palette', () => {
        const cn = getStatPlainIconClassName()
        for (const family of semanticColorFamilies) {
          expect(cn).not.toMatch(new RegExp(`\\btext-${family}-\\d`))
        }
      })

      it('getStatPlainIconClassName includes size-8 and shrink-0 like accent/tinted', () => {
        const cn = getStatPlainIconClassName()
        expect(cn).toContain('size-8')
        expect(cn).toContain('shrink-0')
      })

      it('getStatPlainRootClassName returns a stable string across multiple calls', () => {
        expect(getStatPlainRootClassName()).toEqual(getStatPlainRootClassName())
      })

      it('getStatPlainIconClassName returns a stable string across multiple calls', () => {
        expect(getStatPlainIconClassName()).toEqual(getStatPlainIconClassName())
      })
    })
  })

  describe('T9 — badge styling functions (D9 D10)', () => {
    const allColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('getBadgePillClassName returns inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium for all colors', () => {
      allColors.forEach((color) => {
        const cn = getBadgePillClassName(color)
        expect(cn).toContain('inline-flex')
        expect(cn).toContain('items-center')
        expect(cn).toContain('rounded-full')
        expect(cn).toContain('px-2.5')
        expect(cn).toContain('py-0.5')
        expect(cn).toContain('text-xs')
        expect(cn).toContain('font-medium')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getBadgePillClassName neutral uses bg-neutral-100 and text-neutral-700', () => {
      const cn = getBadgePillClassName('neutral')
      expect(cn).toContain('bg-neutral-100')
      expect(cn).toContain('text-neutral-700')
    })

    it('getBadgePillClassName primary uses bg-primary-100 and text-primary-700', () => {
      const cn = getBadgePillClassName('primary')
      expect(cn).toContain('bg-primary-100')
      expect(cn).toContain('text-primary-700')
    })

    it('getBadgePillClassName success uses bg-success-100 and text-success-700', () => {
      const cn = getBadgePillClassName('success')
      expect(cn).toContain('bg-success-100')
      expect(cn).toContain('text-success-700')
    })

    it('getBadgePillClassName warning uses bg-warning-100 and text-warning-700', () => {
      const cn = getBadgePillClassName('warning')
      expect(cn).toContain('bg-warning-100')
      expect(cn).toContain('text-warning-700')
    })

    it('getBadgePillClassName danger uses bg-danger-100 and text-danger-700', () => {
      const cn = getBadgePillClassName('danger')
      expect(cn).toContain('bg-danger-100')
      expect(cn).toContain('text-danger-700')
    })

    it('getBadgePillClassName info uses bg-info-100 and text-info-700', () => {
      const cn = getBadgePillClassName('info')
      expect(cn).toContain('bg-info-100')
      expect(cn).toContain('text-info-700')
    })

    it('getBadgeCircleDotClassName returns inline-block h-2 w-2 rounded-full for all colors', () => {
      allColors.forEach((color) => {
        const cn = getBadgeCircleDotClassName(color)
        expect(cn).toContain('inline-block')
        expect(cn).toContain('h-2')
        expect(cn).toContain('w-2')
        expect(cn).toContain('rounded-full')
        expect(cn).not.toMatch(/blue-|red-|green-|yellow-|cyan-|gray-/)
      })
    })

    it('getBadgeCircleDotClassName neutral uses bg-neutral-500 (not bg-gray-400)', () => {
      const cn = getBadgeCircleDotClassName('neutral')
      expect(cn).toContain('bg-neutral-500')
      expect(cn).not.toContain('bg-gray-400')
    })

    it('getBadgeCircleDotClassName primary uses bg-primary-500', () => {
      expect(getBadgeCircleDotClassName('primary')).toContain('bg-primary-500')
    })

    it('getBadgeCircleDotClassName success uses bg-success-500', () => {
      expect(getBadgeCircleDotClassName('success')).toContain('bg-success-500')
    })

    it('getBadgeCircleDotClassName warning uses bg-warning-500 (step 500, not 400)', () => {
      const cn = getBadgeCircleDotClassName('warning')
      expect(cn).toContain('bg-warning-500')
      expect(cn).not.toContain('bg-yellow-400')
    })

    it('getBadgeCircleDotClassName danger uses bg-danger-500', () => {
      expect(getBadgeCircleDotClassName('danger')).toContain('bg-danger-500')
    })

    it('getBadgeCircleDotClassName info uses bg-info-500', () => {
      expect(getBadgeCircleDotClassName('info')).toContain('bg-info-500')
    })

    it('getBadgeCircleLabelClassName returns text-sm', () => {
      expect(getBadgeCircleLabelClassName()).toBe('text-sm')
    })
  })

  // T10 — Alert styling functions (D9 D10)
  describe('getAlertClassName', () => {
    const colors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('getAlertClassName returns flex items-start gap-3 rounded-md p-4 for all colors', () => {
      for (const color of colors) {
        const cn = getAlertClassName(color)
        expect(cn).toContain('flex')
        expect(cn).toContain('items-start')
        expect(cn).toContain('gap-3')
        expect(cn).toContain('rounded-md')
        expect(cn).toContain('p-4')
      }
    })

    it('getAlertClassName neutral uses bg-neutral-100', () => {
      expect(getAlertClassName('neutral')).toContain('bg-neutral-100')
    })

    it('getAlertClassName primary uses bg-primary-100', () => {
      expect(getAlertClassName('primary')).toContain('bg-primary-100')
    })

    it('getAlertClassName success uses bg-success-100', () => {
      expect(getAlertClassName('success')).toContain('bg-success-100')
    })

    it('getAlertClassName warning uses bg-warning-100', () => {
      expect(getAlertClassName('warning')).toContain('bg-warning-100')
    })

    it('getAlertClassName danger uses bg-danger-100', () => {
      expect(getAlertClassName('danger')).toContain('bg-danger-100')
    })

    it('getAlertClassName info uses bg-info-100', () => {
      expect(getAlertClassName('info')).toContain('bg-info-100')
    })

    it('getAlertClassName does not include any raw Tailwind color class', () => {
      for (const color of colors) {
        const cn = getAlertClassName(color)
        expect(cn).not.toMatch(/bg-(gray|blue|green|yellow|red|cyan)-/)
      }
    })
  })

  describe('getAlertTitleClassName', () => {
    const colors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('getAlertTitleClassName includes font-medium for all colors', () => {
      for (const color of colors) {
        expect(getAlertTitleClassName(color)).toContain('font-medium')
      }
    })

    it('getAlertTitleClassName neutral uses text-neutral-700', () => {
      expect(getAlertTitleClassName('neutral')).toContain('text-neutral-700')
    })

    it('getAlertTitleClassName primary uses text-primary-700', () => {
      expect(getAlertTitleClassName('primary')).toContain('text-primary-700')
    })

    it('getAlertTitleClassName success uses text-success-700', () => {
      expect(getAlertTitleClassName('success')).toContain('text-success-700')
    })

    it('getAlertTitleClassName warning uses text-warning-700', () => {
      expect(getAlertTitleClassName('warning')).toContain('text-warning-700')
    })

    it('getAlertTitleClassName danger uses text-danger-700', () => {
      expect(getAlertTitleClassName('danger')).toContain('text-danger-700')
    })

    it('getAlertTitleClassName info uses text-info-700', () => {
      expect(getAlertTitleClassName('info')).toContain('text-info-700')
    })

    it('getAlertTitleClassName does not include any raw Tailwind color class', () => {
      for (const color of colors) {
        const cn = getAlertTitleClassName(color)
        expect(cn).not.toMatch(/text-(gray|blue|green|yellow|red|cyan)-/)
      }
    })
  })

  describe('getAlertIconClassName', () => {
    const colors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('getAlertIconClassName includes size-5 shrink-0 for all colors', () => {
      for (const color of colors) {
        const cn = getAlertIconClassName(color)
        expect(cn).toContain('size-5')
        expect(cn).toContain('shrink-0')
      }
    })

    it('getAlertIconClassName danger uses text-danger-700', () => {
      expect(getAlertIconClassName('danger')).toContain('text-danger-700')
    })

    it('getAlertIconClassName info uses text-info-700', () => {
      expect(getAlertIconClassName('info')).toContain('text-info-700')
    })

    it('getAlertIconClassName does not include any raw Tailwind color class', () => {
      for (const color of colors) {
        const cn = getAlertIconClassName(color)
        expect(cn).not.toMatch(/text-(gray|blue|green|yellow|red|cyan)-/)
      }
    })
  })

  describe('getAlertBodyClassName', () => {
    const colors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

    it('getAlertBodyClassName includes text-sm for all colors', () => {
      for (const color of colors) {
        expect(getAlertBodyClassName(color)).toContain('text-sm')
      }
    })

    it('getAlertBodyClassName success uses text-success-700', () => {
      expect(getAlertBodyClassName('success')).toContain('text-success-700')
    })

    it('getAlertBodyClassName info uses text-info-700', () => {
      expect(getAlertBodyClassName('info')).toContain('text-info-700')
    })

    it('getAlertBodyClassName does not include any raw Tailwind color class', () => {
      for (const color of colors) {
        const cn = getAlertBodyClassName(color)
        expect(cn).not.toMatch(/text-(gray|blue|green|yellow|red|cyan)-/)
      }
    })
  })

  describe('T11 — skeleton styling functions (D9 D10)', () => {
    it('getSkeletonBaseClassName returns exactly bg-neutral-200', () => {
      expect(getSkeletonBaseClassName()).toBe('bg-neutral-200')
    })

    it('getSkeletonBaseClassName does not include gray-200', () => {
      expect(getSkeletonBaseClassName()).not.toContain('gray-200')
    })

    it('getSkeletonAnimateClassName(true) returns animate-pulse', () => {
      expect(getSkeletonAnimateClassName(true)).toBe('animate-pulse')
    })

    it('getSkeletonAnimateClassName(false) returns empty string', () => {
      expect(getSkeletonAnimateClassName(false)).toBe('')
    })
  })

  describe('T12 — input icon holder and icon styling functions (D9 D10 D7)', () => {
    it('getInputIconHolderClassName includes bg-neutral-50, border-r, border-app-border-soft and shrink-0', () => {
      const cn = getInputIconHolderClassName()

      expect(cn).toContain('bg-neutral-50')
      expect(cn).toContain('border-r')
      expect(cn).toContain('border-app-border-soft')
      expect(cn).toContain('shrink-0')
      expect(cn).not.toContain('bg-gray-50')
    })

    it('getInputIconHolderClassName includes flex items-center justify-center px-3', () => {
      const cn = getInputIconHolderClassName()

      expect(cn).toContain('flex')
      expect(cn).toContain('items-center')
      expect(cn).toContain('justify-center')
      expect(cn).toContain('px-3')
    })

    it('getInputIconClassName includes text-app-text-muted and size-4 and pointer-events-none', () => {
      const cn = getInputIconClassName()

      expect(cn).toContain('text-app-text-muted')
      expect(cn).toContain('size-4')
      expect(cn).toContain('pointer-events-none')
      expect(cn).not.toContain('text-gray-400')
    })

    it('getInputWithIconClassName includes uniform padding px-3 py-2 without responsive inversion (D7)', () => {
      const cn = getInputWithIconClassName()

      expect(cn).toContain('px-3')
      expect(cn).toContain('py-2')
      expect(cn).not.toContain('px-4')
      expect(cn).not.toContain('py-3')
      expect(cn).not.toContain('sm:px-3.5')
      expect(cn).not.toContain('sm:py-2.5')
    })

    it('getInputWithIconClassName includes flex-1 min-w-0 bg-white text-sm and text-app-text', () => {
      const cn = getInputWithIconClassName()

      expect(cn).toContain('flex-1')
      expect(cn).toContain('min-w-0')
      expect(cn).toContain('bg-white')
      expect(cn).toContain('text-sm')
      expect(cn).toContain('text-app-text')
    })

    it('getInputIconWrapperClassName false uses border-app-border-soft focus-within colors', () => {
      const cn = getInputIconWrapperClassName(false)

      expect(cn).toContain('border-app-border-soft')
      expect(cn).toContain('focus-within:border-app-accent')
      expect(cn).toContain('focus-within:ring-app-accent')
      expect(cn).not.toContain('border-app-danger')
    })

    it('getInputIconWrapperClassName true uses border-app-danger focus-within colors', () => {
      const cn = getInputIconWrapperClassName(true)

      expect(cn).toContain('border-app-danger')
      expect(cn).toContain('focus-within:border-app-danger')
      expect(cn).toContain('focus-within:ring-app-danger')
      expect(cn).not.toContain('border-app-border-soft')
      expect(cn).not.toContain('focus-within:border-app-accent')
    })

    it('getInputIconWrapperClassName includes flex items-stretch rounded-control and focus-within:ring-2', () => {
      const cn = getInputIconWrapperClassName(false)

      expect(cn).toContain('flex')
      expect(cn).toContain('items-stretch')
      expect(cn).toContain('rounded-control')
      expect(cn).toContain('border')
      expect(cn).toContain('overflow-hidden')
      expect(cn).toContain('focus-within:ring-2')
    })
  })

  describe('T13 — file-manager styling functions (D9 D10 D8)', () => {
    describe('getFileManagerRowClassName', () => {
      it('includes border-b and border-app-border-soft and not border-gray-200', () => {
        const cn = getFileManagerRowClassName()
        expect(cn).toContain('border-b')
        expect(cn).toContain('border-app-border-soft')
        expect(cn).not.toContain('border-gray-200')
      })

      it('includes flex items-center justify-between py-2', () => {
        const cn = getFileManagerRowClassName()
        expect(cn).toContain('flex')
        expect(cn).toContain('items-center')
        expect(cn).toContain('justify-between')
        expect(cn).toContain('py-2')
      })
    })

    describe('getFileManagerRowFileNameClassName', () => {
      it('includes text-sm text-app-text and not text-gray-700', () => {
        const cn = getFileManagerRowFileNameClassName()
        expect(cn).toContain('text-sm')
        expect(cn).toContain('text-app-text')
        expect(cn).not.toContain('text-gray-700')
      })
    })

    describe('getFileManagerRowActionClassName', () => {
      it('primary variant includes text-primary-600 hover:text-primary-800 and transition-colors', () => {
        const cn = getFileManagerRowActionClassName('primary')
        expect(cn).toContain('text-primary-600')
        expect(cn).toContain('hover:text-primary-800')
        expect(cn).toContain('transition-colors')
        expect(cn).not.toMatch(/blue-/)
      })

      it('danger variant includes text-danger-600 hover:text-danger-700 and transition-colors', () => {
        const cn = getFileManagerRowActionClassName('danger')
        expect(cn).toContain('text-danger-600')
        expect(cn).toContain('hover:text-danger-700')
        expect(cn).toContain('transition-colors')
        expect(cn).not.toMatch(/red-/)
      })

      it('disabled variant includes text-neutral-300 and not text-gray-300', () => {
        const cn = getFileManagerRowActionClassName('disabled')
        expect(cn).toContain('text-neutral-300')
        expect(cn).not.toContain('text-gray-300')
      })

      it('no variant includes any raw color class (blue- red- gray-)', () => {
        const variants = ['primary', 'danger', 'disabled'] as const
        for (const v of variants) {
          const cn = getFileManagerRowActionClassName(v)
          expect(cn).not.toMatch(/\b(blue|red|green|yellow|cyan|gray)-/)
        }
      })

      it('primary variant includes cursor-pointer', () => {
        expect(getFileManagerRowActionClassName('primary')).toContain('cursor-pointer')
      })

      it('danger variant still includes cursor-pointer (regression control)', () => {
        expect(getFileManagerRowActionClassName('danger')).toContain('cursor-pointer')
      })

      it('disabled variant does not include cursor-pointer', () => {
        expect(getFileManagerRowActionClassName('disabled')).not.toContain('cursor-pointer')
      })
    })

    describe('getFileManagerListErrorClassName', () => {
      it('includes text-sm text-danger-600 and not text-red-600', () => {
        const cn = getFileManagerListErrorClassName()
        expect(cn).toContain('text-sm')
        expect(cn).toContain('text-danger-600')
        expect(cn).not.toContain('text-red-600')
      })
    })

    describe('getFileManagerListEmptyClassName', () => {
      it('includes text-sm text-app-text-muted and not text-gray-500', () => {
        const cn = getFileManagerListEmptyClassName()
        expect(cn).toContain('text-sm')
        expect(cn).toContain('text-app-text-muted')
        expect(cn).not.toContain('text-gray-500')
      })
    })

    describe('getFileManagerListDividerClassName', () => {
      it('includes divide-y divide-app-border-soft and not divide-gray-200', () => {
        const cn = getFileManagerListDividerClassName()
        expect(cn).toContain('divide-y')
        expect(cn).toContain('divide-app-border-soft')
        expect(cn).not.toContain('divide-gray-200')
      })
    })

    describe('getFileManagerErrorItemClassName', () => {
      it('includes text-sm text-danger-600 and not text-red-600', () => {
        const cn = getFileManagerErrorItemClassName()
        expect(cn).toContain('text-sm')
        expect(cn).toContain('text-danger-600')
        expect(cn).not.toContain('text-red-600')
      })
    })

    describe('getFileManagerDropZoneClassName', () => {
      it('idle uses border-neutral-300 bg-neutral-50 hover:bg-neutral-100 and not gray-*', () => {
        const cn = getFileManagerDropZoneClassName('idle')
        expect(cn).toContain('border-neutral-300')
        expect(cn).toContain('bg-neutral-50')
        expect(cn).toContain('hover:bg-neutral-100')
        expect(cn).not.toMatch(/gray-/)
      })

      it('drag-over uses border-primary-500 bg-primary-50 and not blue-500', () => {
        const cn = getFileManagerDropZoneClassName('drag-over')
        expect(cn).toContain('border-primary-500')
        expect(cn).toContain('bg-primary-50')
        expect(cn).not.toContain('blue-500')
      })

      it('uploading uses border-info-400 bg-info-50 cursor-not-allowed and not blue-400', () => {
        const cn = getFileManagerDropZoneClassName('uploading')
        expect(cn).toContain('border-info-400')
        expect(cn).toContain('bg-info-50')
        expect(cn).toContain('cursor-not-allowed')
        expect(cn).not.toContain('blue-400')
      })

      it('success uses border-success-500 bg-success-50 and not green-500', () => {
        const cn = getFileManagerDropZoneClassName('success')
        expect(cn).toContain('border-success-500')
        expect(cn).toContain('bg-success-50')
        expect(cn).not.toContain('green-500')
      })

      it('error uses border-danger-400 bg-danger-50 and not red-400', () => {
        const cn = getFileManagerDropZoneClassName('error')
        expect(cn).toContain('border-danger-400')
        expect(cn).toContain('bg-danger-50')
        expect(cn).not.toContain('red-400')
      })

      it('no phase includes raw gray- blue- red- green- cyan- yellow- classes', () => {
        const phases = ['idle', 'drag-over', 'uploading', 'success', 'error'] as const
        for (const phase of phases) {
          const cn = getFileManagerDropZoneClassName(phase)
          expect(cn).not.toMatch(/\b(blue|red|green|yellow|cyan|gray)-/)
        }
      })

      it('idle includes cursor-pointer', () => {
        expect(getFileManagerDropZoneClassName('idle')).toContain('cursor-pointer')
      })

      it('drag-over includes cursor-pointer', () => {
        expect(getFileManagerDropZoneClassName('drag-over')).toContain('cursor-pointer')
      })

      it('success includes cursor-pointer', () => {
        expect(getFileManagerDropZoneClassName('success')).toContain('cursor-pointer')
      })

      it('error includes cursor-pointer', () => {
        expect(getFileManagerDropZoneClassName('error')).toContain('cursor-pointer')
      })

      it('uploading does not include cursor-pointer and still includes cursor-not-allowed', () => {
        const cn = getFileManagerDropZoneClassName('uploading')
        expect(cn).not.toContain('cursor-pointer')
        expect(cn).toContain('cursor-not-allowed')
      })
    })

    describe('getFileManagerDropZoneTextClassName', () => {
      it('muted intent uses text-app-text-muted and not text-gray-500', () => {
        const cn = getFileManagerDropZoneTextClassName('muted')
        expect(cn).toContain('text-app-text-muted')
        expect(cn).not.toContain('text-gray-500')
        expect(cn).not.toContain('text-gray-400')
      })

      it('info intent uses text-info-700 and not text-blue-700', () => {
        const cn = getFileManagerDropZoneTextClassName('info')
        expect(cn).toContain('text-info-700')
        expect(cn).not.toContain('text-blue-700')
      })

      it('success intent uses text-success-700 and not text-green-700', () => {
        const cn = getFileManagerDropZoneTextClassName('success')
        expect(cn).toContain('text-success-700')
        expect(cn).not.toContain('text-green-700')
      })
    })

    describe('getFileManagerDropZoneProgressTrackClassName', () => {
      it('includes w-full bg-info-200 rounded h-2 and not bg-blue-200', () => {
        const cn = getFileManagerDropZoneProgressTrackClassName()
        expect(cn).toContain('w-full')
        expect(cn).toContain('bg-info-200')
        expect(cn).toContain('rounded')
        expect(cn).toContain('h-2')
        expect(cn).not.toContain('bg-blue-200')
      })
    })

    describe('getFileManagerDropZoneProgressFillClassName', () => {
      it('includes bg-info-600 h-2 rounded transition-all and not bg-blue-600', () => {
        const cn = getFileManagerDropZoneProgressFillClassName()
        expect(cn).toContain('bg-info-600')
        expect(cn).toContain('h-2')
        expect(cn).toContain('rounded')
        expect(cn).toContain('transition-all')
        expect(cn).not.toContain('bg-blue-600')
      })
    })

    describe('getFileManagerDropZoneIconColorClassName', () => {
      it('muted intent uses text-app-text-muted and not text-gray-400 or text-gray-500', () => {
        const cn = getFileManagerDropZoneIconColorClassName('muted')
        expect(cn).toContain('text-app-text-muted')
        expect(cn).not.toContain('text-gray-400')
        expect(cn).not.toContain('text-gray-500')
      })

      it('info intent uses text-info-700 and not text-blue-700', () => {
        const cn = getFileManagerDropZoneIconColorClassName('info')
        expect(cn).toContain('text-info-700')
        expect(cn).not.toContain('text-blue-700')
      })

      it('success intent uses text-success-700 and not text-green-700', () => {
        const cn = getFileManagerDropZoneIconColorClassName('success')
        expect(cn).toContain('text-success-700')
        expect(cn).not.toContain('text-green-700')
      })
    })
  })

  describe('getModalOverlayClassName and getModalPanelClassName', () => {
    it('getModalOverlayClassName includes cursor-pointer', () => {
      expect(getModalOverlayClassName()).toContain('cursor-pointer')
    })

    it('getModalPanelClassName md does not include cursor-pointer and includes cursor-auto', () => {
      const cn = getModalPanelClassName('md')
      expect(cn).not.toContain('cursor-pointer')
      expect(cn).toContain('cursor-auto')
    })

    it('getModalPanelClassName sm does not include cursor-pointer and includes cursor-auto', () => {
      const cn = getModalPanelClassName('sm')
      expect(cn).not.toContain('cursor-pointer')
      expect(cn).toContain('cursor-auto')
    })

    it('getModalPanelClassName sm includes max-w-md and not max-w-sm', () => {
      const cn = getModalPanelClassName('sm')
      expect(cn).toContain('max-w-md')
      expect(cn).not.toContain('max-w-sm')
    })

    it('getModalPanelClassName md includes max-w-2xl and not max-w-md', () => {
      const cn = getModalPanelClassName('md')
      expect(cn).toContain('max-w-2xl')
      expect(cn).not.toContain('max-w-md')
    })

    it('getModalPanelClassName lg includes max-w-4xl and not max-w-lg', () => {
      const cn = getModalPanelClassName('lg')
      expect(cn).toContain('max-w-4xl')
      expect(cn).not.toContain('max-w-lg')
    })

    it('getModalPanelClassName without argument matches the md default exactly', () => {
      expect(getModalPanelClassName()).toBe(getModalPanelClassName('md'))
    })

    it('preserves fixed classes unrelated to width across all three sizes', () => {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const cn = getModalPanelClassName(size)
        expect(cn).toContain('w-full')
        expect(cn).toContain('p-6')
      }
    })
  })
})
