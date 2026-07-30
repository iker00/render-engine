import { describe, expect, it } from 'vitest'
import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { computeActiveSidebarItemIds } from '../../runtime/runtime-shell'

function navigateItem(label: string, pageId: string, overrides: Partial<SidebarItemConfig> = {}): SidebarItemConfig {
  return { label, action: { type: 'navigateTo', pageId }, ...overrides }
}

function goBackItem(label: string): SidebarItemConfig {
  return { label, action: { type: 'goBack' } }
}

function hrefItem(label: string, href: string): SidebarItemConfig {
  return { label, href }
}

describe('computeActiveSidebarItemIds', () => {
  it('returns an empty set when items is undefined', () => {
    const state = computeActiveSidebarItemIds(undefined, 'home')

    expect(state.activePaths.size).toBe(0)
  })

  it('returns an empty set when items is an empty array', () => {
    const state = computeActiveSidebarItemIds([], 'home')

    expect(state.activePaths.size).toBe(0)
  })

  it('returns an empty set when activePageId is null, even with non-empty items', () => {
    const items = [navigateItem('Home', 'home')]

    const state = computeActiveSidebarItemIds(items, null)

    expect(state.activePaths.size).toBe(0)
  })

  it('marks a root item active when its navigateTo.pageId matches activePageId', () => {
    const items = [navigateItem('Home', 'home')]

    const state = computeActiveSidebarItemIds(items, 'home')

    expect(state.activePaths).toEqual(new Set(['0']))
  })

  it('never marks an href-only item active, even if activePageId equals the href string', () => {
    const items = [hrefItem('External', '/external')]

    const state = computeActiveSidebarItemIds(items, '/external')

    expect(state.activePaths.size).toBe(0)
  })

  it('never marks a goBack item active, regardless of activePageId', () => {
    const items = [goBackItem('Back')]

    const state = computeActiveSidebarItemIds(items, 'back')

    expect(state.activePaths.size).toBe(0)
  })

  it('marks a second-level item and its parent active when the child matches', () => {
    const items: SidebarItemConfig[] = [
      {
        label: 'Admin',
        children: [navigateItem('Users', 'admin-users'), navigateItem('Roles', 'admin-roles')],
      },
    ]

    const state = computeActiveSidebarItemIds(items, 'admin-users')

    expect(state.activePaths).toEqual(new Set(['0', '0.children.0']))
  })

  it('marks all ancestors active for a fourth-level active item, with no depth limit', () => {
    const items: SidebarItemConfig[] = [
      {
        label: 'Level 1',
        children: [
          {
            label: 'Level 2',
            children: [
              {
                label: 'Level 3',
                children: [navigateItem('Level 4', 'deep-page')],
              },
            ],
          },
        ],
      },
    ]

    const state = computeActiveSidebarItemIds(items, 'deep-page')

    expect(state.activePaths).toEqual(
      new Set(['0', '0.children.0', '0.children.0.children.0', '0.children.0.children.0.children.0']),
    )
  })

  it('marks two items in different branches active when they share the same pageId, with their own ancestors', () => {
    const items: SidebarItemConfig[] = [
      navigateItem('Home', 'home'),
      {
        label: 'Admin',
        children: [navigateItem('Users', 'home'), navigateItem('Roles', 'admin-roles')],
      },
    ]

    const state = computeActiveSidebarItemIds(items, 'home')

    expect(state.activePaths).toEqual(new Set(['0', '1', '1.children.0']))
  })

  it('does not mark a parent or its children active when no descendant matches activePageId', () => {
    const items: SidebarItemConfig[] = [
      {
        label: 'Admin',
        children: [navigateItem('Users', 'admin-users'), navigateItem('Roles', 'admin-roles')],
      },
    ]

    const state = computeActiveSidebarItemIds(items, 'unrelated-page')

    expect(state.activePaths.size).toBe(0)
  })

  it('is pure: calling twice with the same inputs yields the same observable result', () => {
    const items: SidebarItemConfig[] = [
      navigateItem('Home', 'home'),
      { label: 'Admin', children: [navigateItem('Users', 'admin-users')] },
    ]

    const first = computeActiveSidebarItemIds(items, 'admin-users')
    const second = computeActiveSidebarItemIds(items, 'admin-users')

    expect(second.activePaths).toEqual(first.activePaths)
  })

  it('ignores visibility when computing active paths', () => {
    const items = [
      navigateItem('Home', 'home', { visibility: { reference: 'params.role', operator: 'equals', value: 'admin' } }),
    ]

    const state = computeActiveSidebarItemIds(items, 'home')

    expect(state.activePaths).toEqual(new Set(['0']))
  })
})
