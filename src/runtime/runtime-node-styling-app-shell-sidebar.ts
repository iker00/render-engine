import type { CSSProperties } from 'react'
import type { ShellScrollBehavior } from '../config/runtime-config-types'

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

// FR11 (0124-T4): the sidebar keeps its own scroll independent of `shell.scrollBehavior`. In
// `"fixed"` mode it stays bounded by the flex cascade set up by `AppShell`/`dev-runtime.tsx`
// (`min-h-0`/`flex-1` on ancestors, closed by 0124-T3) with just `overflow-y-auto`. In `"page"`
// mode (default) there is no such bounding ancestor, so the sidebar positions itself with
// `sticky` under the header (or `top: 0` when there is none) and clamps its own height to the
// viewport minus that offset via the `--shell-sidebar-sticky-top` CSS variable (see
// `getAppShellSidebarStickyStyle`) — the only property carried in `style`, per the exception in
// `conventions.md` (precedent: `getContainerNodeStyling`/`--runtime-container-gap`).
export function getAppShellSidebarClassName({
  collapsed,
  scrollBehavior = 'page',
}: {
  collapsed: boolean
  scrollBehavior?: ShellScrollBehavior
}) {
  const widthClass = collapsed ? 'w-16' : 'w-64'
  const baseClassName = `${widthClass} shrink-0 border-r border-app-border-soft bg-app-surface`

  if (scrollBehavior === 'fixed') {
    return `${baseClassName} overflow-y-auto`
  }

  return `${baseClassName} sticky top-[var(--shell-sidebar-sticky-top)] h-[calc(100vh_-_var(--shell-sidebar-sticky-top))] overflow-y-auto`
}

type AppShellSidebarStickyStyle = CSSProperties & {
  '--shell-sidebar-sticky-top': string
}

// Fed by `AppShell`/`dev-runtime.tsx`'s `ResizeObserver`-measured header height, in pixels.
export function getAppShellSidebarStickyStyle(stickyTopPx: number): AppShellSidebarStickyStyle {
  return {
    '--shell-sidebar-sticky-top': `${stickyTopPx}px`,
  } as AppShellSidebarStickyStyle
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
// trigger instead of below it, since the rail sits at the left edge of the shell.
// `overflow-y-auto` + `max-h` bounds it for long child lists without growing past the viewport.
//
// `position: fixed` (not `absolute`) is load-bearing, not stylistic: the sidebar `<nav>` carries
// its own `overflow-y-auto` since FR11 (0124-T4), and the CSS overflow spec forces an element's
// `overflow-x` to become a clipping axis too whenever `overflow-y` isn't `visible` — so an
// `absolute`-positioned panel escaping sideways past the rail's width would get clipped by its own
// scrolling ancestor. `fixed` elements are positioned against the viewport and are not clipped by
// an ancestor's `overflow` (only a `transform`/`filter`/`will-change` ancestor would re-anchor
// them, and none exists here), so this needs no portal. Coordinates are computed by the caller from
// the trigger's `getBoundingClientRect()` and fed through `getAppShellSidebarRailFlyoutPositionStyle`.
export function getAppShellSidebarRailFlyoutPanelClassName() {
  return 'fixed top-[var(--sidebar-rail-flyout-top)] left-[var(--sidebar-rail-flyout-left)] z-20 flex max-h-[70vh] w-56 flex-col gap-1 overflow-y-auto rounded-card border border-app-border-soft bg-app-surface p-1 shadow-section'
}

type AppShellSidebarRailFlyoutPositionStyle = CSSProperties & {
  '--sidebar-rail-flyout-top': string
  '--sidebar-rail-flyout-left': string
}

// Fed by `SidebarRailFlyout`'s own `getBoundingClientRect()` measurement of its trigger, taken when
// the flyout opens. Only property carried in `style`, per the same `conventions.md` exception as
// `getAppShellSidebarStickyStyle`.
export function getAppShellSidebarRailFlyoutPositionStyle(topPx: number, leftPx: number): AppShellSidebarRailFlyoutPositionStyle {
  return {
    '--sidebar-rail-flyout-top': `${topPx}px`,
    '--sidebar-rail-flyout-left': `${leftPx}px`,
  } as AppShellSidebarRailFlyoutPositionStyle
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
