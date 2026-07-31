import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import {
  getAppShellSidebarItemClassName,
  getAppShellSidebarRailFlyoutPanelClassName,
  getAppShellSidebarRailFlyoutPositionStyle,
} from '../runtime-node-styling-app-shell-sidebar'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { SidebarItemNode } from './app-shell-sidebar'
import { renderSidebarItemGlyphOrIcon } from './render-sidebar-item-glyph-or-icon'

interface SidebarRailFlyoutProps {
  item: SidebarItemConfig
  path: string
  activePaths: ReadonlySet<string>
  expandedPaths: ReadonlySet<string>
  onToggleExpand: (path: string) => void
}

// Matches the `ml-1` gap the panel used to get for free from being an `absolute` sibling.
const RAIL_FLYOUT_GAP_PX = 4

// Design 0123, decisiones 7-9: the rail-mode counterpart of `MenuItemDropdown` (`0122`) for a
// root-level `sidebarItem` branch trigger. Replicates the same interaction pattern — self-contained
// disclosure (no `@floating-ui`/`radix`), click-outside via a `mousedown` listener on the
// trigger+panel container, `Esc` closes and returns focus to the trigger, focus moves to the first
// visible item on open — but is not a literal reuse of `MenuItemDropdown`, which assumes the fixed
// `menuItem`/`menuItemChild` shape. Panel children reuse `SidebarItemNode` itself (same
// `expandedPaths`/`onToggleExpand` as the expanded sidebar), so a child with its own `children`
// (depth 3+) expands *inline inside this same panel* instead of opening a second, nested flyout.
//
// The panel itself is `position: fixed`, not `absolute` anchored to the `relative` trigger wrapper
// like `MenuItemDropdown`: the sidebar `<nav>` is a scroll container (FR11, 0124-T4), which would
// clip an `absolute` panel escaping sideways past the rail's width (see
// `getAppShellSidebarRailFlyoutPanelClassName`). Its coordinates are measured from the trigger via
// `getBoundingClientRect()` on open; since that measurement isn't kept in sync with the sidebar's
// own scroll position, the flyout closes on any scroll instead of drifting away from its trigger.
export function SidebarRailFlyout({ item, path, activePaths, expandedPaths, onToggleExpand }: SidebarRailFlyoutProps) {
  const state = useRuntimeState()
  const handlers = useRuntimeStateActions()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const active = activePaths.has(path)
  const label = resolveRuntimeTextReference(item.label, state, 'shell.sidebar.item.label')

  const closeFlyout = useCallback((options?: { refocusTrigger?: boolean }) => {
    setOpen(false)
    if (options?.refocusTrigger) {
      triggerRef.current?.focus()
    }
  }, [])

  // Measures the trigger synchronously before paint so the panel never flashes at a stale/zero
  // position — same rationale as `AppShell`'s header-height measurement (0124-T4).
  useLayoutEffect(() => {
    if (!open || triggerRef.current === null) {
      setPosition(null)
      return
    }
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({ top: rect.top, left: rect.right + RAIL_FLYOUT_GAP_PX })
  }, [open])

  // Moves focus to the first visible focusable row once the panel opens.
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
  }, [open])

  // Click outside the trigger+panel wrapper closes the flyout without stealing focus.
  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  // The panel's position is a one-time measurement, not tracked continuously: scrolling any
  // scrollable ancestor (most commonly the sidebar itself) would leave a `fixed` panel visually
  // detached from its trigger, so scrolling closes it instead. `capture: true` on `document` is
  // required because `scroll` does not bubble — the capture phase still reaches it regardless of
  // which element actually scrolled.
  useEffect(() => {
    if (!open) return

    function handleScroll() {
      setOpen(false)
    }

    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  const handleContainerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeFlyout({ refocusTrigger: true })
    }
  }

  const visibleChildren = (item.children ?? [])
    .map((child, childIndex) => ({ child, childIndex }))
    .filter(({ child }) => matchesVisibilityRule(child.visibility, state))

  return (
    <div ref={containerRef} onKeyDown={handleContainerKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={getAppShellSidebarItemClassName({ active, collapsed: true })}
        onClick={() => setOpen((previousOpen) => !previousOpen)}
      >
        {renderSidebarItemGlyphOrIcon(item, label, true)}
      </button>
      {open && position !== null ? (
        <div
          ref={panelRef}
          role="menu"
          className={getAppShellSidebarRailFlyoutPanelClassName()}
          style={getAppShellSidebarRailFlyoutPositionStyle(position.top, position.left)}
        >
          {visibleChildren.map(({ child, childIndex }) => (
            <SidebarItemNode
              key={childIndex}
              item={child}
              path={`${path}.children.${childIndex}`}
              depth={1}
              state={state}
              handlers={handlers}
              activePaths={activePaths}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              showGlyphFallback
              onLeafSelect={() => closeFlyout()}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
