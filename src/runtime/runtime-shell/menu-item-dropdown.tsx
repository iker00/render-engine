import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { MenuItemConfig } from '../../config/runtime-config-types'
import { IconNode } from '../nodes/icon-node'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import {
  getAppShellHeaderDropdownClassName,
  getAppShellHeaderDropdownItemClassName,
  getAppShellHeaderMenuItemClassName,
} from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { MenuItemLeaf } from './app-shell-header'

interface MenuItemDropdownProps {
  item: MenuItemConfig
  rootPath: string
  activePaths: ReadonlySet<string>
  active: boolean
}

// Design 0122 Decisión 6: a self-contained disclosure menu (no `@floating-ui`/`radix`),
// `position: absolute` anchored to a `relative` trigger wrapper. Accessibility pattern mirrors
// the project's existing `accordion`/`tabs` (local `open` state, `aria-expanded`) plus the
// dialog-style focus handling already established by `modal-layout-node.tsx`.
export function MenuItemDropdown({ item, rootPath, activePaths, active }: MenuItemDropdownProps) {
  const state = useRuntimeState()
  const handlers = useRuntimeStateActions()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const closeDropdown = useCallback((options?: { refocusTrigger?: boolean }) => {
    setOpen(false)
    if (options?.refocusTrigger) {
      triggerRef.current?.focus()
    }
  }, [])

  // Moves focus to the first visible menuitem whenever the dropdown opens (click on trigger).
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  // Click outside the trigger+panel wrapper closes the dropdown without stealing focus.
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

  const handleContainerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown({ refocusTrigger: true })
      return
    }

    if (!open) return

    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (menuItems.length === 0) return

    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      menuItems[currentIndex === -1 ? 0 : (currentIndex + 1) % menuItems.length].focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      menuItems[currentIndex === -1 ? menuItems.length - 1 : (currentIndex - 1 + menuItems.length) % menuItems.length].focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      menuItems[0].focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      menuItems[menuItems.length - 1].focus()
    }
  }

  const visibleChildren = (item.children ?? [])
    .map((child, childIndex) => ({ child, childIndex }))
    .filter(({ child }) => matchesVisibilityRule(child.visibility, state))

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleContainerKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={getAppShellHeaderMenuItemClassName({ active })}
        onClick={() => setOpen((previousOpen) => !previousOpen)}
      >
        <IconNode name={item.icon} className="size-4 shrink-0" />
        {resolveRuntimeTextReference(item.label, state, 'shell.header.menu.item.label')}
      </button>
      {open ? (
        <div ref={menuRef} role="menu" className={getAppShellHeaderDropdownClassName()}>
          {visibleChildren.map(({ child, childIndex }) => (
            <MenuItemLeaf
              key={childIndex}
              item={child}
              role="menuitem"
              state={state}
              handlers={handlers}
              onSelect={() => closeDropdown()}
              className={getAppShellHeaderDropdownItemClassName({
                active: activePaths.has(`${rootPath}.${childIndex}`),
              })}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
