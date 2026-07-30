import { describe, expect, it } from 'vitest'
import type { MenuItemConfig } from '../../config/runtime-config-types'
import { computeActiveMenuItemIds } from '../../runtime/runtime-shell'

function navigateItem(label: string, pageId: string, overrides: Partial<MenuItemConfig> = {}): MenuItemConfig {
  return { label, action: { type: 'navigateTo', pageId }, ...overrides }
}

function goBackItem(label: string): MenuItemConfig {
  return { label, action: { type: 'goBack' } }
}

function hrefItem(label: string, href: string): MenuItemConfig {
  return { label, href }
}

describe('computeActiveMenuItemIds', () => {
  it('returns an empty set when menu is undefined', () => {
    const state = computeActiveMenuItemIds(undefined, 'home')

    expect(state.activePaths.size).toBe(0)
  })

  it('returns an empty set when menu is an empty array', () => {
    const state = computeActiveMenuItemIds([], 'home')

    expect(state.activePaths.size).toBe(0)
  })

  it('returns an empty set when activePageId is null, even with a non-empty menu', () => {
    const menu = [navigateItem('Home', 'home')]

    const state = computeActiveMenuItemIds(menu, null)

    expect(state.activePaths.size).toBe(0)
  })

  it('marks a root menu item active when its navigateTo.pageId matches activePageId', () => {
    const menu = [navigateItem('Home', 'home')]

    const state = computeActiveMenuItemIds(menu, 'home')

    expect(state.activePaths).toEqual(new Set(['0']))
  })

  it('does not mark a root menu item active when its navigateTo.pageId differs from activePageId', () => {
    const menu = [navigateItem('Home', 'home')]

    const state = computeActiveMenuItemIds(menu, 'settings')

    expect(state.activePaths.size).toBe(0)
  })

  it('never marks a goBack menu item active, regardless of activePageId', () => {
    const menu = [goBackItem('Back')]

    const state = computeActiveMenuItemIds(menu, 'back')

    expect(state.activePaths.size).toBe(0)
  })

  it('never marks an href-only menu item active, even if activePageId equals the href string', () => {
    const menu = [hrefItem('External', '/external')]

    const state = computeActiveMenuItemIds(menu, '/external')

    expect(state.activePaths.size).toBe(0)
  })

  it('marks both the active child and its parent when a child navigateTo.pageId matches', () => {
    const menu: MenuItemConfig[] = [
      {
        label: 'Admin',
        children: [navigateItem('Users', 'admin-users'), navigateItem('Roles', 'admin-roles')],
      },
    ]

    const state = computeActiveMenuItemIds(menu, 'admin-users')

    expect(state.activePaths).toEqual(new Set(['0', '0.0']))
  })

  it('does not mark parent or children active when no child matches activePageId', () => {
    const menu: MenuItemConfig[] = [
      {
        label: 'Admin',
        children: [navigateItem('Users', 'admin-users'), navigateItem('Roles', 'admin-roles')],
      },
    ]

    const state = computeActiveMenuItemIds(menu, 'unrelated-page')

    expect(state.activePaths.size).toBe(0)
  })

  it('marks two distinct root menu items active when they share the same pageId', () => {
    const menu = [navigateItem('Home', 'home'), navigateItem('Home again', 'home')]

    const state = computeActiveMenuItemIds(menu, 'home')

    expect(state.activePaths).toEqual(new Set(['0', '1']))
  })

  it('marks a direct root match, a matching child and its parent simultaneously', () => {
    const menu: MenuItemConfig[] = [
      navigateItem('Home', 'home'),
      {
        label: 'Admin',
        children: [navigateItem('Users', 'home'), navigateItem('Roles', 'admin-roles')],
      },
    ]

    const state = computeActiveMenuItemIds(menu, 'home')

    expect(state.activePaths).toEqual(new Set(['0', '1', '1.0']))
  })

  it('is pure: calling twice with the same inputs yields the same observable result', () => {
    const menu: MenuItemConfig[] = [
      navigateItem('Home', 'home'),
      { label: 'Admin', children: [navigateItem('Users', 'admin-users')] },
    ]

    const first = computeActiveMenuItemIds(menu, 'admin-users')
    const second = computeActiveMenuItemIds(menu, 'admin-users')

    expect(second.activePaths).toEqual(first.activePaths)
  })

  it('ignores visibility when computing active paths', () => {
    const menu = [
      navigateItem('Home', 'home', { visibility: { reference: 'params.role', operator: 'equals', value: 'admin' } }),
    ]

    const state = computeActiveMenuItemIds(menu, 'home')

    expect(state.activePaths).toEqual(new Set(['0']))
  })
})
