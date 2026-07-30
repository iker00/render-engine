// Body row wrapping the sidebar and the page content once `shell.sidebar.items` is declared.
// Deliberately does not set `align-items`: the default `stretch` makes `AppShellSidebar` and the
// page content column match height with each other, which is how the sidebar reaches "the rest
// of the available height" without touching the shared `<main>`/`<section>`/frame chrome (design
// decisión 3, 0123-T4).
export function getAppShellBodyClassName() {
  return 'flex w-full'
}

export function getAppShellBodyContentClassName() {
  return 'min-w-0 flex-1'
}

export function getAppShellSidebarClassName({ collapsed }: { collapsed: boolean }) {
  const widthClass = collapsed ? 'w-16' : 'w-64'

  return `${widthClass} shrink-0 border-r border-app-border-soft bg-app-surface`
}

export function getAppShellSidebarItemClassName({ active, collapsed = false }: { active: boolean; collapsed?: boolean }) {
  const base = [
    'flex',
    'w-full',
    'items-center',
    collapsed ? 'justify-center' : 'gap-2',
    'rounded-control',
    collapsed ? 'px-2' : 'px-3',
    'py-2',
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

// Sidebar's own collapse/expand control, rendered in its header before the item list
// (0123-T6). Icon-only by design: the accessible name comes entirely from `aria-label`, which
// the caller alternates between "collapse" and "expand" wording as `collapsed` flips.
export function getAppShellSidebarToggleClassName() {
  return [
    'flex',
    'w-full',
    'items-center',
    'justify-center',
    'rounded-control',
    'px-3',
    'py-2',
    'text-app-text',
    'transition-colors',
    'hover:bg-app-surface-subtle',
    'hover:text-app-text-strong',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

// Fallback glyph shown in place of an icon (design decisión 8) — a single uppercase letter,
// sized to match the `size-4` icon slot it replaces so rail-mode rows and flyout rows keep a
// consistent leading column regardless of whether a given item declares `icon`.
export function getAppShellSidebarGlyphClassName() {
  return 'flex size-4 shrink-0 items-center justify-center text-xs font-semibold uppercase text-app-text'
}

// `SidebarRailFlyout`'s panel: same visual language as the header's `MenuItemDropdown` panel
// (`rounded-card`, `shadow-section`, `border-app-border-soft`) but anchored to the *right* of its
// trigger (`left-full`) instead of below it, since the rail sits at the left edge of the shell.
// `overflow-y-auto` + `max-h` bounds it for long child lists without growing past the viewport.
export function getAppShellSidebarRailFlyoutPanelClassName() {
  return 'absolute left-full top-0 z-20 ml-1 flex max-h-[70vh] w-56 flex-col gap-1 overflow-y-auto rounded-card border border-app-border-soft bg-app-surface p-1 shadow-section'
}

export function getAppShellSidebarTriggerClassName({ active, expanded }: { active: boolean; expanded: boolean }) {
  const base = [
    'flex',
    'w-full',
    'items-center',
    'gap-2',
    'rounded-control',
    'px-3',
    'py-2',
    'text-left',
    'text-sm',
    expanded ? 'font-semibold' : 'font-medium',
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

// Lookup map (see `getGridChildSpanClassName` in `runtime-node-styling-base.ts` for the
// project's established precedent) so every indentation step is a literal Tailwind class
// discoverable by static analysis, instead of an interpolated arbitrary value. `depth` is the
// nesting depth of the *container* being indented (1 for the first level of children, 2 for the
// next, and so on); it is uncapped in the tree itself but the visual indentation saturates past
// the deepest mapped level rather than growing forever.
const sidebarChildrenIndentClassMap: Record<number, string> = {
  1: 'pl-4',
  2: 'pl-8',
  3: 'pl-12',
  4: 'pl-16',
  5: 'pl-20',
  6: 'pl-24',
}

const maxMappedSidebarIndentDepth = Math.max(...Object.keys(sidebarChildrenIndentClassMap).map(Number))

export function getAppShellSidebarChildrenClassName(depth: number) {
  const indentClass = sidebarChildrenIndentClassMap[Math.min(depth, maxMappedSidebarIndentDepth)]

  return `flex flex-col gap-1 ${indentClass}`
}
