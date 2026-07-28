import {
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationCurrentButtonClassName,
} from './runtime-node-styling-repeater-pagination'

export function getTableContainerClassName() {
  return 'rounded-card border border-app-border-soft bg-white'
}

export function getTableScrollContainerClassName() {
  return 'overflow-x-auto'
}

export function getTableNodeClassName() {
  return 'min-w-full border-collapse text-left text-sm leading-6 text-app-text'
}

export function getTableHeaderCellClassName() {
  return 'border-b border-app-border-soft bg-app-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-app-text-strong'
}

export function getTableFilterControlsClassName() {
  return 'flex w-full flex-wrap items-end justify-start gap-3 border-b border-app-border-soft bg-white px-4 py-3'
}

export function getTableFilterFieldClassName() {
  return 'flex min-w-40 flex-col gap-1'
}

export function getTableFilterLabelClassName() {
  return 'sr-only'
}

export function getTableFilterInputClassName() {
  return [
    'w-full',
    'min-w-40',
    'rounded-control',
    'border',
    'border-app-border-soft',
    'bg-white',
    'px-3',
    'py-2',
    'text-sm',
    'leading-5',
    'text-app-text',
    'placeholder:text-app-text-muted',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:border-app-accent',
    'focus-visible:ring-app-accent',
  ].join(' ')
}

export function getTableFilterResetButtonClassName() {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'self-end',
    'rounded-control',
    'border',
    'border-app-border-strong',
    'bg-white',
    'px-3.5',
    'py-2',
    'text-sm',
    'font-medium',
    'leading-5',
    'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-app-surface-subtle',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getTableSortButtonClassName(isActive = false) {
  return [
    'inline-flex',
    'w-full',
    'items-center',
    'justify-between',
    'gap-2',
    'text-left',
    'text-xs',
    'font-semibold',
    'uppercase',
    'tracking-[0.16em]',
    isActive ? 'text-app-accent' : 'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:text-app-accent',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getTableBodyRowClassName() {
  return 'border-b border-app-border-soft last:border-b-0'
}

export function getTableCellClassName() {
  return 'px-4 py-3 align-top text-sm text-app-text'
}

export function getTablePaginationControlsClassName() {
  return 'flex w-full flex-wrap items-center justify-center gap-3 border-t border-app-border-soft px-4 py-3'
}

export function getTablePaginationButtonClassName() {
  return getRepeaterPaginationButtonClassName()
}

export function getTablePaginationCurrentButtonClassName() {
  return getRepeaterPaginationCurrentButtonClassName()
}
