// `pinned` (0124-T3): whether the header stays fixed to the top of the viewport (`shell.scrollBehavior`
// `"page"`, the default) or is a regular flow element (`"fixed"`, where the frame itself confines
// scrolling and the header no longer needs to pin itself). Resolved via lookup map, not a JSX
// if/else branch, per `conventions.md`'s "Resolución de variantes visuales" (precedent:
// `divider-layout-node.tsx`).
const appShellHeaderVariantClassNameMap: Record<'pinned' | 'unpinned', string> = {
  pinned: 'sticky top-0 z-10 w-full border-b border-app-border-soft bg-app-surface shadow-shell',
  unpinned: 'w-full border-b border-app-border-soft bg-app-surface shadow-shell',
}

export function getAppShellHeaderClassName({ pinned }: { pinned: boolean }) {
  return appShellHeaderVariantClassNameMap[pinned ? 'pinned' : 'unpinned']
}

export function getAppShellHeaderInnerClassName() {
  return 'flex w-full flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8'
}

export function getAppShellHeaderLeftClassName() {
  return 'flex flex-wrap items-center gap-4'
}

export function getAppShellHeaderActionsClassName() {
  return 'flex flex-wrap items-center gap-2'
}

// `shell.header.title` renders as a single semantic element, chosen once for the whole
// runtime: a <span>, not an <h1>-<h6>. The header persists across every page and every page
// already owns its own heading outline starting at its own <h1> (see the `heading` node);
// promoting the shell title to a heading level would either collide with a page's <h1> or
// force an arbitrary level unrelated to that page's outline. A <span> keeps the title visible
// and part of the header's accessible content without interfering with heading navigation.
export function getAppShellHeaderTitleClassName() {
  return 'text-base font-semibold leading-tight tracking-[-0.01em] text-app-text-strong'
}

export function getAppShellHeaderMenuItemClassName({ active }: { active: boolean }) {
  const base = [
    'inline-flex',
    'items-center',
    'gap-1.5',
    'rounded-control',
    'px-2.5',
    'py-1.5',
    'text-sm',
    'font-medium',
    'transition-colors',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ]
  const stateClasses = active
    ? ['bg-app-surface-subtle', 'text-app-accent']
    : ['text-app-text', 'hover:bg-app-surface-subtle', 'hover:text-app-text-strong']

  return [...base, ...stateClasses].join(' ')
}

export function getAppShellHeaderDropdownClassName() {
  return 'absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-card border border-app-border-soft bg-app-surface p-1 shadow-section'
}

export function getAppShellHeaderDropdownItemClassName({ active }: { active: boolean }) {
  const base = [
    'flex',
    'w-full',
    'items-center',
    'gap-1.5',
    'rounded-control',
    'px-2.5',
    'py-1.5',
    'text-left',
    'text-sm',
    'font-medium',
    'transition-colors',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ]
  const stateClasses = active
    ? ['bg-app-surface-subtle', 'text-app-accent']
    : ['text-app-text', 'hover:bg-app-surface-subtle', 'hover:text-app-text-strong']

  return [...base, ...stateClasses].join(' ')
}
