import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { invalidLayout } from '../../config/runtime-config-validation-errors'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { useShellCollapseState } from '../../dev-runtime/shell-config-panel/shell-collapse-state'
import { isValidShellTreeDestination, moveShellSubtree, type ShellTreeDestination } from '../../dev-runtime/shell-config-panel/shell-tree-mutations'
import { SidebarItemListEditor } from '../../dev-runtime/shell-config-panel/sidebar-item-list-editor'

// Same mocking pattern as shell-menu-list-editor.test.tsx: a real pointer-drag is impractical in
// jsdom, so `DndContext` becomes a pass-through that records the `onDragEnd`/`onDragOver` handlers
// it was given, keyed by its own `id` prop. Since 0125-T7 replaces the previous "one
// `ShellTreeDndContext` per recursion level" wiring with a single tree-wide context (`id="shell-
// sidebar"`) mounted once at the root (`path === ''`), only one entry is ever captured — tests
// invoke the captured handlers directly. `useDraggable`/`useDroppable` keep their real
// implementation.
const capturedOnDragEndByContextId = new Map<string, (event: { active: { id: string }; over: { id: string } | null }) => void>()
const capturedOnDragOverByContextId = new Map<string, (event: { active: { id: string }; over: { id: string } | null }) => void>()

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: {
      id?: string
      children: React.ReactNode
      onDragEnd?: (event: unknown) => void
      onDragOver?: (event: unknown) => void
    }) => {
      if (props.id) {
        capturedOnDragEndByContextId.set(
          props.id,
          props.onDragEnd as (event: { active: { id: string }; over: { id: string } | null }) => void,
        )
        capturedOnDragOverByContextId.set(
          props.id,
          props.onDragOver as (event: { active: { id: string }; over: { id: string } | null }) => void,
        )
      }
      return props.children
    },
  }
})

// T3 (0129): `SidebarItemFieldsEditor` mounts the real `IconPickerPropertyField` for `icon`, which
// derives its catalog from the full `lucide-react` namespace — same rationale/mock as
// shell-config-panel.test.tsx/shell-menu-list-editor.test.tsx (slow + a rendering bug under jsdom
// against the real ~3900-icon package). `OTHER_MODULE_ICON_NAMES` covers every other icon import
// in this file's render tree (e.g. `ListTree`/`ChevronDown` in `SidebarItemListEditor` itself).
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

// Same domain-specific pass `ShellConfigPanel.handleMoveSidebarItem` applies after every move
// (design.md Decisión 5, shared with the header's own `menuItem` rule): `sidebarItem` also forbids
// `href`/`action` alongside `children` (`refineSidebarItemShape` in `runtime-config-zod.ts`), so
// nesting onto a leaf item needs this on top of `moveShellSubtree`'s generic `appendChildAtPath`.
function dropHrefActionWhereChildrenExist(item: SidebarItemConfig): SidebarItemConfig {
  if (item.children === undefined) return item
  const sanitizedChildren = item.children.map(dropHrefActionWhereChildrenExist)
  if (item.href === undefined && item.action === undefined) {
    return { ...item, children: sanitizedChildren }
  }
  const { href: _href, action: _action, ...rest } = item
  return { ...rest, children: sanitizedChildren }
}

function sanitizeSidebarTree(tree: SidebarItemConfig[]): SidebarItemConfig[] {
  return tree.map(dropHrefActionWhereChildrenExist)
}

// Isolated from `ShellConfigPanel`: this harness only owns a plain `items` array, a real
// `useShellCollapseState()` instance (the same one `ShellConfigPanel` wires in) and a commit
// function that applies the mutation directly, no `RuntimeConfig`/Monaco text/patchRootKey
// involved — that full pipeline is exercised by `shell-config-panel.test.tsx`'s own integration
// tests. A rejection is simulated by a test-only marker (`label === 'REJECT'`) rather than a real
// schema violation, since this file's job is the editor's own row-level rejection *display*
// contract (keep the attempted value, show the alert), not which inputs the real schema rejects.
// `onMoveItem`/`isValidDestination` mirror exactly the wiring `ShellConfigPanel.handleMoveSidebarItem`/
// `isValidSidebarDestination` build in production (0125-T7): `moveShellSubtree`/
// `isValidShellTreeDestination` called directly against the harness's own `items` state, with
// `maxDepth: null` (no depth limit) and `collapse.applyPathRemap` only on a non-rejected commit.
function Harness({ initialItems = [] as SidebarItemConfig[] }: { initialItems?: SidebarItemConfig[] }) {
  const [items, setItems] = useState<SidebarItemConfig[]>(initialItems)
  const collapse = useShellCollapseState()

  function onCommitItems(nextItems: SidebarItemConfig[]): CommitCanvasMutationResult {
    const hasRejectMarker = JSON.stringify(nextItems).includes('"label":"REJECT"')
    if (hasRejectMarker) {
      const rejection = invalidLayout('Simulated rejection for test.') as { status: 'error'; error: RuntimeConfigError }
      return { status: 'rejected', error: rejection.error }
    }
    setItems(nextItems)
    return { status: 'applied' }
  }

  function onMoveItem(sourcePath: string, destination: ShellTreeDestination): void {
    const { tree, pathRemap } = moveShellSubtree<SidebarItemConfig>(items, sourcePath, destination)
    const result = onCommitItems(sanitizeSidebarTree(tree))
    if (result.status !== 'rejected') collapse.applyPathRemap(pathRemap)
  }

  function isValidDestination(sourcePath: string, destination: ShellTreeDestination): boolean {
    return isValidShellTreeDestination<SidebarItemConfig>(items, sourcePath, destination, null)
  }

  return (
    <div>
      <SidebarItemListEditor
        items={items}
        path=""
        onCommitItems={onCommitItems}
        collapse={collapse}
        onMoveItem={onMoveItem}
        isValidDestination={isValidDestination}
      />
      <pre data-testid="items-json">{JSON.stringify(items)}</pre>
    </div>
  )
}

function renderHarness(initialItems?: SidebarItemConfig[]) {
  capturedOnDragEndByContextId.clear()
  capturedOnDragOverByContextId.clear()
  return render(<Harness initialItems={initialItems} />)
}

function currentItems(): SidebarItemConfig[] {
  return JSON.parse(screen.getByTestId('items-json').textContent ?? '[]')
}

describe('SidebarItemListEditor / root list add', () => {
  it('adding a root item produces a valid sidebarItem seeded with an empty href', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de sidebar' }))

    expect(currentItems()).toEqual([{ label: 'Nuevo elemento', href: '' }])
  })
})

describe('SidebarItemListEditor / editing a root item', () => {
  function renderWithOneRootItem() {
    renderHarness([{ label: 'Home', href: '/home' }])
    // Every row starts collapsed by default; a directly-rendered pre-existing item (unlike one
    // just created via "Añadir elemento de sidebar") needs an explicit expand to access its fields.
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))
  }

  it('editing label updates the item', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'Dashboard' },
    })
    expect(currentItems()[0].label).toBe('Dashboard')
  })

  it('choosing an icon cell updates the item, and clearing it removes the field', () => {
    renderWithOneRootItem()
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))
    fireEvent.click(screen.getByText('LayoutDashboard').closest('[role="gridcell"]')!)
    expect(currentItems()[0].icon).toBe('LayoutDashboard')

    fireEvent.click(screen.getByRole('button', { name: /Quitar icono/i }))
    expect(currentItems()[0].icon).toBeUndefined()
  })

  it('switching mode to "Acción" then "Navegar a página" commits a navigateTo action', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'action' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Acción' }), {
      target: { value: 'navigateTo' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'about' } })

    expect(currentItems()[0]).toEqual({ label: 'Home', action: { type: 'navigateTo', pageId: 'about' } })
  })

  it('switching mode to "Sin acción" clears href, leaving only label/icon/visibility', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'none' },
    })

    expect(currentItems()[0]).toEqual({ label: 'Home' })
  })

  it('switching mode from "action" back to "href" reseeds an empty href', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'action' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'href' },
    })

    expect(currentItems()[0]).toEqual({ label: 'Home', href: '' })
  })

  it('editing visibility sets a simple condition on the item', () => {
    renderWithOneRootItem()
    // The visibility widget defaults to the "single condition" branch (reference/operator), and
    // — same as the generic `ObjectPropertyField` used for `src`/`alt`/`pageId` elsewhere in this
    // panel (see shell-config-panel.test.tsx) — labels each sub-field with its raw property key,
    // not prefixed by the row's own label.
    fireEvent.change(screen.getByRole('textbox', { name: 'reference' }), {
      target: { value: 'params.role' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'operator' }), {
      target: { value: 'isTruthy' },
    })

    expect(currentItems()[0].visibility).toEqual({ reference: 'params.role', operator: 'isTruthy' })
  })
})

describe('SidebarItemListEditor / icon field (T3, 0129)', () => {
  it('a root sidebarItem row shows the icon widget grid with the configured icon highlighted, not a text input', () => {
    renderHarness([{ label: 'Home', href: '/home', icon: 'LayoutDashboard' }])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))
    // The grid is hidden until the search input is focused (T5, 0129).
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const grid = screen.getByRole('grid', { name: 'Elemento de sidebar 1 — Icono' })
    const selected = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('LayoutDashboard')
    expect(screen.queryByRole('textbox', { name: /Elemento de sidebar 1 — Icono/i })).not.toBeInTheDocument()
  })

  it('a sidebarItem nested at depth >= 2 (children -> children) shows the icon widget with its own icon highlighted', () => {
    renderHarness([
      {
        label: 'Parent',
        children: [{ label: 'Child', children: [{ label: 'Grandchild', href: '/g', icon: 'Users' }] }],
      },
    ])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0.0.0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const grid = screen.getByRole('grid', { name: 'Elemento de sidebar 1.1.1 — Icono' })
    const selected = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Users')
  })

  it('choosing a different icon cell commits the sidebarItem with the new icon and every other field intact', () => {
    renderHarness([{ label: 'Home', href: '/home', icon: 'LayoutDashboard' }])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    expect(currentItems()).toEqual([{ label: 'Home', href: '/home', icon: 'Settings' }])
  })
})

describe('SidebarItemListEditor / switching to "Con hijos"', () => {
  it('replaces href with children: [new item] and renders the nested sublist immediately', () => {
    renderHarness([{ label: 'Products', href: '/products' }])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'children' },
    })

    expect(currentItems()[0]).not.toHaveProperty('href')
    expect(currentItems()[0].children).toEqual([{ label: 'Nuevo elemento', href: '' }])
    // The nested sublist is mounted incondicionalmente, no toggle needed.
    expect(screen.getByRole('textbox', { name: 'Elemento de sidebar 1.1 — Etiqueta' })).toBeInTheDocument()
  })
})

describe('SidebarItemListEditor / recursion to arbitrary depth', () => {
  it('supports a four-level-deep tree built entirely through repeated "Con hijos" switches', () => {
    renderHarness([{ label: 'Level 1', href: '/l1' }])
    // Level 1 is pre-existing (collapsed by default); every deeper level is created via the mode
    // switch below and auto-expands, so no further explicit expand clicks are needed after this.
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'children' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1.1 — Etiqueta' }), {
      target: { value: 'Level 2' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1.1 — Modo' }), {
      target: { value: 'children' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1.1.1 — Etiqueta' }), {
      target: { value: 'Level 3' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1.1.1 — Modo' }), {
      target: { value: 'children' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1.1.1.1 — Etiqueta' }), {
      target: { value: 'Level 4' },
    })

    expect(currentItems()).toEqual([
      {
        label: 'Level 1',
        children: [
          {
            label: 'Level 2',
            children: [
              {
                label: 'Level 3',
                children: [{ label: 'Level 4', href: '' }],
              },
            ],
          },
        ],
      },
    ])
  })
})

describe('SidebarItemListEditor / removing an item at a nested level', () => {
  function configWithTwoParentsEachWithTwoChildren(): SidebarItemConfig[] {
    return [
      {
        label: 'Parent A',
        children: [
          { label: 'A1', href: '/a1' },
          { label: 'A2', href: '/a2' },
        ],
      },
      {
        label: 'Parent B',
        children: [
          { label: 'B1', href: '/b1' },
          { label: 'B2', href: '/b2' },
        ],
      },
    ]
  }

  it('removing a child from one parent does not affect its sibling or the other parent\'s children', () => {
    renderHarness(configWithTwoParentsEachWithTwoChildren())

    fireEvent.click(screen.getByRole('button', { name: 'Quitar elemento de sidebar 1.1' }))

    const items = currentItems()
    expect(items[0].children?.map((child) => child.label)).toEqual(['A2'])
    expect(items[1].children?.map((child) => child.label)).toEqual(['B1', 'B2'])
  })

  it('disables "Quitar" on the last remaining child of a nested level (schema requires at least one)', () => {
    renderHarness([{ label: 'Parent', children: [{ label: 'Only child', href: '/only' }] }])

    expect(screen.getByRole('button', { name: 'Quitar elemento de sidebar 1.1' })).toBeDisabled()
  })

  it('never disables "Quitar" at the root level, even with a single item', () => {
    renderHarness([{ label: 'Only root item', href: '/only' }])

    expect(screen.getByRole('button', { name: 'Quitar elemento de sidebar 1' })).not.toBeDisabled()
  })
})

describe('SidebarItemListEditor / reordering by drag', () => {
  function configWithThreeRootItems(): SidebarItemConfig[] {
    return [
      { label: 'First', href: '/1' },
      { label: 'Second', href: '/2' },
      { label: 'Third', href: '/3' },
    ]
  }

  // 0125-T7 replaces the previous per-level `DndContext` (one per recursion level, `gap`
  // destinations only, `nest` always rejected) with a single tree-wide context (`id="shell-
  // sidebar"`) mounted once at the root (`path === ''`), covering every nested `children` list
  // together — mirroring `ShellMenuListEditor`'s own 0125-T5 redesign. A `gap` id encodes a
  // position in the *pre-drop* list (`0`..`items.length`), so dropping on the trailing gap of a
  // 3-item list moves the dragged item to the end.
  it('reordering the root list via DnD persists the new order', () => {
    renderHarness(configWithThreeRootItems())

    const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
    expect(onDragEnd).toBeDefined()
    act(() => {
      onDragEnd?.({ active: { id: '0' }, over: { id: 'gap::3' } })
    })

    expect(currentItems().map((item) => item.label)).toEqual(['Second', 'Third', 'First'])
  })

  it('reordering a parent\'s children via DnD persists that order without touching the root or other parents', () => {
    renderHarness([
      {
        label: 'Parent',
        children: [
          { label: 'Shoes', href: '/shoes' },
          { label: 'Hats', href: '/hats' },
        ],
      },
      { label: 'Other root', href: '/other' },
    ])

    const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
    expect(onDragEnd).toBeDefined()
    act(() => {
      onDragEnd?.({ active: { id: '0.0' }, over: { id: 'gap:0:2' } })
    })

    const items = currentItems()
    expect(items[0].children?.map((child) => child.label)).toEqual(['Hats', 'Shoes'])
    expect(items[1].label).toBe('Other root')
  })

  it('an out-of-range/foreign drop id is a no-op: no change, no crash', () => {
    renderHarness(configWithThreeRootItems())

    const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
    expect(() => act(() => onDragEnd?.({ active: { id: '0' }, over: { id: 'not-a-number' } }))).not.toThrow()

    expect(currentItems().map((item) => item.label)).toEqual(['First', 'Second', 'Third'])
  })

  it('root list and every nested children list share the same DnD context for the whole sidebar tree', () => {
    renderHarness([
      { label: 'Parent', children: [{ label: 'Shoes', href: '/shoes' }, { label: 'Hats', href: '/hats' }] },
      { label: 'About', href: '/about' },
    ])

    // A single `DndContext` is mounted (id="shell-sidebar"): only one entry was ever captured,
    // and it is the same handler whether the drag starts on a root row or on a row inside
    // `children`, at any depth.
    expect(capturedOnDragEndByContextId.size).toBe(1)
    expect(capturedOnDragEndByContextId.get('shell-sidebar')).toBeDefined()
  })

  describe('nesting and cross-level moves (0125-T7)', () => {
    it('nesting a root item onto the body of another root item converts it into a child (acceptance criterion 3)', () => {
      renderHarness(configWithThreeRootItems())

      const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
      act(() => {
        onDragEnd?.({ active: { id: '0' }, over: { id: 'nest:1' } })
      })

      expect(currentItems()).toEqual([
        { label: 'Second', children: [{ label: 'First', href: '/1' }] },
        { label: 'Third', href: '/3' },
      ])
    })

    it("nesting a leaf item onto another leaf item replaces the target's href/action with children: [node] (Decisión 5)", () => {
      renderHarness(configWithThreeRootItems())

      const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
      act(() => {
        onDragEnd?.({ active: { id: '0' }, over: { id: 'nest:1' } })
      })

      const items = currentItems() as Array<Record<string, unknown>>
      expect(items[0]).not.toHaveProperty('href')
      expect(items[0]).not.toHaveProperty('action')
    })

    it('nesting to a depth of at least 4 levels succeeds, confirming there is no depth limit (acceptance criterion 3)', () => {
      renderHarness([
        {
          label: 'L1',
          children: [{ label: 'L2', children: [{ label: 'L3', children: [{ label: 'L4', href: '/l4' }] }] }],
        },
        { label: 'Dragged', href: '/dragged' },
      ])

      const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
      act(() => {
        // Nests 'Dragged' (root index 1) onto 'L4' (path '0.0.0.0'), a leaf at depth 3 —
        // 'Dragged' becomes L4's child at depth 4.
        onDragEnd?.({ active: { id: '1' }, over: { id: 'nest:0.0.0.0' } })
      })

      const items = currentItems() as Array<{
        label: string
        children?: Array<{ label: string; children?: Array<{ label: string; children?: unknown[] }> }>
      }>
      expect(items).toHaveLength(1)
      const l3 = items[0].children?.[0]?.children?.[0] as { label: string; children?: Array<{ label: string; children?: unknown[] }> }
      const l4 = l3.children?.[0] as { label: string; children?: Array<{ label: string }> }
      expect(l4).toEqual({ label: 'L4', children: [{ label: 'Dragged', href: '/dragged' }] })
    })

    it('moving a child out of its parent into the root list gap removes it from `children` and adds it as a root item (acceptance criterion 6)', () => {
      renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }, { label: 'Hats', href: '/hats' }] }])

      const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
      act(() => {
        onDragEnd?.({ active: { id: '0.0' }, over: { id: 'gap::1' } })
      })

      const items = currentItems() as Array<Record<string, unknown>>
      expect(items.map((item) => item.label)).toEqual(['Products', 'Shoes'])
      expect((items[0].children as Array<{ label: string }>).map((child) => child.label)).toEqual(['Hats'])
      expect(items[1]).not.toHaveProperty('children')
    })

    it('nesting an item within its own descendant is blocked: dragging over marks the zone invalid, and dropping is a no-op', () => {
      renderHarness([{ label: 'Parent', children: [{ label: 'Child', href: '/child' }] }])

      const onDragOver = capturedOnDragOverByContextId.get('shell-sidebar')
      act(() => {
        onDragOver?.({ active: { id: '0' }, over: { id: 'nest:0.0' } })
      })
      const zone = document.querySelector('[data-drop-zone="nest:0.0"]')!
      expect(zone.classList.contains('outline-red-500')).toBe(true)

      const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
      act(() => {
        onDragEnd?.({ active: { id: '0' }, over: { id: 'nest:0.0' } })
      })

      expect(currentItems()).toEqual([{ label: 'Parent', children: [{ label: 'Child', href: '/child' }] }])
    })

    it('preserves each descendant\'s own collapse state (mixed expanded/collapsed) after moving their parent to a deeper level', () => {
      renderHarness([
        {
          label: 'Products',
          children: [
            { label: 'Shoes', href: '/shoes' },
            { label: 'Hats', href: '/hats' },
          ],
        },
        { label: 'About', href: '/about' },
      ])

      // Expand only the second child ('0.1'); leave the first ('0.0') collapsed (the default).
      fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0.1'))
      expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('sidebar-item-collapse-toggle-0.1')).toHaveAttribute('aria-expanded', 'true')

      const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar')
      act(() => {
        // Nests 'Products' (with its two children) onto 'About''s body, one level deeper.
        onDragEnd?.({ active: { id: '0' }, over: { id: 'nest:1' } })
      })

      expect(currentItems().map((item) => item.label)).toEqual(['About'])
      expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0.0')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0.1')).toHaveAttribute('aria-expanded', 'true')
    })
  })
})

describe('SidebarItemListEditor / rejected commit feedback', () => {
  it('a rejected commit keeps the attempted value on screen and shows role="alert", without reverting', () => {
    renderHarness([{ label: 'Home', href: '/home' }])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'REJECT' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('invalid-layout')
    expect(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' })).toHaveValue('REJECT')
    // The underlying committed state was never mutated by the rejected commit.
    expect(currentItems()[0].label).toBe('Home')
  })

  it('clears the alert once a subsequent commit for the same row succeeds', () => {
    renderHarness([{ label: 'Home', href: '/home' }])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'REJECT' },
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'Dashboard' },
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(currentItems()[0].label).toBe('Dashboard')
  })
})

describe('SidebarItemListEditor / collapse control', () => {
  // Three-level-deep fixture: a root item ('0'), its child ('0.0'), and that child's own second
  // grandchild ('0.0.1') — deep enough to prove there is no depth limit on collapse, unlike the
  // header's root-only branch indicator.
  function threeLevelDeepConfig(): SidebarItemConfig[] {
    return [
      {
        label: 'Root item',
        icon: 'home',
        children: [
          {
            label: 'Child item',
            children: [
              { label: 'Grandchild 0', href: '/g0' },
              { label: 'Grandchild 1', href: '/g1' },
            ],
          },
        ],
      },
    ]
  }

  it('a newly mounted item exposes its collapse control collapsed by default, with its fields hidden, at root/child/grandchild depth', () => {
    renderHarness(threeLevelDeepConfig())

    expect(screen.getByTestId('sidebar-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0.1')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Elemento de sidebar 1.1.2 — Etiqueta' })).not.toBeInTheDocument()
  })

  it('expanding the root item reveals its fields; its label/icon stay visible on the toggle button either way', () => {
    renderHarness(threeLevelDeepConfig())

    const toggle = screen.getByTestId('sidebar-item-collapse-toggle-0')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('Root item')
    expect(toggle).toHaveTextContent('home')

    fireEvent.click(toggle)

    expect(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' })).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Root item')
    expect(toggle).toHaveTextContent('home')
    // The child, at depth 1, still renders — collapsed by default, independent of its parent.
    expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0')).toHaveAttribute('aria-expanded', 'false')
  })

  it('expanding the grandchild item (depth 2) reveals only its own fields, proving there is no depth limit', () => {
    renderHarness(threeLevelDeepConfig())

    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0.0.1'))

    expect(screen.getByRole('textbox', { name: 'Elemento de sidebar 1.1.2 — Etiqueta' })).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0.1')).toHaveTextContent('Grandchild 1')
    // Its sibling grandchild, at the same depth, is unaffected (stays collapsed, the default).
    expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0.0')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Elemento de sidebar 1.1.1 — Etiqueta' })).not.toBeInTheDocument()
  })

  it('shows the branch indicator only for an item with children, at any depth, both collapsed and expanded', () => {
    renderHarness(threeLevelDeepConfig())

    expect(screen.getByTestId('sidebar-item-branch-indicator-0')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-item-branch-indicator-0.0')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-item-branch-indicator-0.0.0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-item-branch-indicator-0.0.1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0.0'))
    expect(screen.getByTestId('sidebar-item-branch-indicator-0.0')).toBeInTheDocument()
  })

  it('collapsing an item with a pending commit rejection keeps the role="alert" banner visible', () => {
    renderHarness([{ label: 'Home', href: '/home' }])
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'REJECT' },
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('collapsing a parent at any depth does not disable "add child" for its children list, nor an expanded child\'s own controls', () => {
    renderHarness(threeLevelDeepConfig())

    // '0.0' stays collapsed (the default); expand its own child ('0.0.0') independently.
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0.0.0'))

    expect(screen.getByRole('button', { name: 'Añadir elemento de sidebar en 1.1' })).not.toBeDisabled()
    expect(screen.getByTestId('sidebar-item-collapse-toggle-0.0.0')).toHaveAttribute('aria-expanded', 'true')
  })

  it('uses the same gap-2 class between a parent row and its first child as between sibling rows, at any depth', () => {
    renderHarness(threeLevelDeepConfig())

    const rootRow = screen.getByTestId('shell-tree-row-0')
    const rootList = screen.getByTestId('shell-dnd-list-shell-sidebar-')
    const grandchildList = screen.getByTestId('shell-dnd-list-shell-sidebar-0.0')
    expect(rootRow.className).toContain('gap-2')
    expect(rootList.className).toContain('gap-2')
    expect(grandchildList.className).toContain('gap-2')
  })

  it('expanding one root item does not affect the collapse state of another (independence by path)', () => {
    renderHarness([
      { label: 'First', href: '/1' },
      { label: 'Second', href: '/2' },
    ])

    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    expect(screen.getByTestId('sidebar-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('sidebar-item-collapse-toggle-1')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Elemento de sidebar 2 — Etiqueta' })).not.toBeInTheDocument()
  })

  it('the root path convention is "" (not "root"): a root item collapse toggle lives at path "0", not "root.0"', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    expect(screen.getByTestId('sidebar-item-collapse-toggle-0')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-item-collapse-toggle-root.0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-item-collapse-toggle-root')).not.toBeInTheDocument()
  })

  it('places the row name directly after the drag handle, both in the same row', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    const row = screen.getByTestId('shell-tree-row-0')
    const buttons = within(row).getAllByRole('button')

    expect(buttons[0]).toHaveAccessibleName('Reordenar elemento de sidebar 1')
    expect(buttons[1]).toBe(screen.getByTestId('sidebar-item-collapse-toggle-0'))
  })

  it('opens/closes the row by clicking its visible name, not a separate icon-only button', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    // Scoped to the toggle itself (T3, 0129): once expanded, the icon widget's own catalog grid
    // also renders a cell labeled "Home" (a valid mocked icon name), so an unscoped `getByText`
    // becomes ambiguous.
    const toggle = screen.getByTestId('sidebar-item-collapse-toggle-0')
    fireEvent.click(within(toggle).getByText('Home'))
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(within(toggle).getByText('Home'))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
