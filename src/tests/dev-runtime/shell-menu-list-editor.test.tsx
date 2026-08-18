import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { MenuItemChildConfig, MenuItemConfig } from '../../config/runtime-config-types'
import { invalidLayout } from '../../config/runtime-config-validation-errors'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { useShellCollapseState } from '../../dev-runtime/shell-config-panel/shell-collapse-state'
import { ShellMenuListEditor } from '../../dev-runtime/shell-config-panel/shell-menu-list-editor'
import { isValidShellTreeDestination, moveShellSubtree, type ShellTreeDestination } from '../../dev-runtime/shell-config-panel/shell-tree-mutations'

// Same mocking pattern as shell-sidebar-list-editor.test.tsx/shell-config-panel-dnd.test.tsx: a
// real pointer-drag is impractical in jsdom, so `DndContext` becomes a pass-through that records
// the `onDragEnd`/`onDragOver` handlers it was given, keyed by its own `id` prop. Since 0125-T5
// the whole menu tree shares a single `DndContext` (`id="shell-menu"`), so only one entry is ever
// captured — tests invoke the captured handlers directly. `useDraggable`/`useDroppable` keep their
// real implementation.
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

// T3 (0129): `MenuItemFieldsEditor` mounts the real `IconPickerPropertyField` for `icon`, which
// derives its catalog from the full `lucide-react` namespace — same rationale/mock as
// shell-config-panel.test.tsx (slow + a rendering bug under jsdom against the real ~3900-icon
// package). `OTHER_MODULE_ICON_NAMES` covers every other icon import in this file's render tree
// (e.g. `ListTree`/`ChevronDown` in `ShellMenuListEditor` itself).
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

// Isolated from `ShellConfigPanel`: this harness only owns a plain `menu` array, a real
// `useShellCollapseState()` instance (the same one `ShellConfigPanel` wires in) and a commit
// function that applies the mutation directly — no `RuntimeConfig`/Monaco text/patchRootKey/
// `AppShellHeader` involved, that full pipeline and production rendering is exercised by
// `shell-config-panel.test.tsx`'s own smoke describe. A rejection is simulated by a test-only
// marker (`label === 'REJECT'`), same convention `shell-sidebar-list-editor.test.tsx` already uses
// for `SidebarItemListEditor`.
// `onMoveItem`/`isValidDestination` mirror exactly the wiring `ShellConfigPanel.handleMoveMenuItem`/
// `isValidMenuDestination` build in production (0125-T5): `moveShellSubtree`/
// `isValidShellTreeDestination` called directly against the harness's own `menu` state, with
// `MENU_TREE_MAX_DEPTH = 1` and `collapse.applyPathRemap` only on a non-rejected commit.
const MENU_TREE_MAX_DEPTH = 1

// Same domain-specific pass `ShellConfigPanel.handleMoveMenuItem` applies after every move
// (design.md Decisión 5): `moveShellSubtree`'s generic `appendChildAtPath` doesn't know that
// `menuItem` forbids `href`/`action` alongside `children`, so nesting onto a leaf item needs this
// on top, stripping whichever field the schema's `refineMenuItemShape` would otherwise reject.
function dropHrefActionWhereChildrenExist(item: MenuItemConfig): MenuItemConfig {
  if (item.children === undefined) return item
  const sanitizedChildren = item.children.map(
    (child) => dropHrefActionWhereChildrenExist(child as MenuItemConfig) as MenuItemChildConfig,
  )
  if (item.href === undefined && item.action === undefined) {
    return { ...item, children: sanitizedChildren }
  }
  const { href: _href, action: _action, ...rest } = item
  return { ...rest, children: sanitizedChildren }
}

function sanitizeMenuTree(tree: MenuItemConfig[]): MenuItemConfig[] {
  return tree.map(dropHrefActionWhereChildrenExist)
}

function Harness({ initialMenu = [] as MenuItemConfig[] }: { initialMenu?: MenuItemConfig[] }) {
  const [menu, setMenu] = useState<MenuItemConfig[]>(initialMenu)
  const collapse = useShellCollapseState()

  function onCommitMenu(nextMenu: MenuItemConfig[]): CommitCanvasMutationResult {
    const hasRejectMarker = JSON.stringify(nextMenu).includes('"label":"REJECT"')
    if (hasRejectMarker) {
      const rejection = invalidLayout('Simulated rejection for test.') as { status: 'error'; error: RuntimeConfigError }
      return { status: 'rejected', error: rejection.error }
    }
    setMenu(nextMenu)
    return { status: 'applied' }
  }

  function onMoveItem(sourcePath: string, destination: ShellTreeDestination) {
    const { tree, pathRemap } = moveShellSubtree<MenuItemChildConfig>(menu, sourcePath, destination)
    const result = onCommitMenu(sanitizeMenuTree(tree))
    if (result.status !== 'rejected') collapse.applyPathRemap(pathRemap)
  }

  function isValidDestination(sourcePath: string, destination: ShellTreeDestination): boolean {
    return isValidShellTreeDestination<MenuItemChildConfig>(menu, sourcePath, destination, MENU_TREE_MAX_DEPTH)
  }

  return (
    <div>
      <ShellMenuListEditor
        menu={menu}
        onCommitMenu={onCommitMenu}
        collapse={collapse}
        onMoveItem={onMoveItem}
        isValidDestination={isValidDestination}
      />
      <pre data-testid="menu-json">{JSON.stringify(menu)}</pre>
    </div>
  )
}

function renderHarness(initialMenu?: MenuItemConfig[]) {
  capturedOnDragEndByContextId.clear()
  capturedOnDragOverByContextId.clear()
  return render(<Harness initialMenu={initialMenu} />)
}

function currentMenu(): MenuItemConfig[] {
  return JSON.parse(screen.getByTestId('menu-json').textContent ?? '[]')
}

describe('ShellMenuListEditor / menu — add root item with href', () => {
  it('adding a root item with label + href produces a valid config', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de menú' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'Home' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Href' }), {
      target: { value: '/home' },
    })

    expect(currentMenu()).toEqual([{ label: 'Home', href: '/home' }])
  })
})

describe('ShellMenuListEditor / menu — action variant selector', () => {
  it('choosing "Acción" then "Navegar a página" reveals pageId and commits a navigateTo action', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de menú' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'About' },
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'action' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Acción' }), {
      target: { value: 'navigateTo' },
    })
    expect(screen.getByRole('textbox', { name: 'pageId' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'about' } })

    expect(currentMenu()).toEqual([{ label: 'About', action: { type: 'navigateTo', pageId: 'about' } }])
  })
})

describe('ShellMenuListEditor / menu — children mode', () => {
  function renderWithOneRootItem() {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de menú' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'Products' },
    })
  }

  it('switching to "Con desplegable" replaces href/action with a children list (mutually exclusive per schema)', () => {
    renderWithOneRootItem()

    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'children' },
    })

    const menu = currentMenu() as Array<Record<string, unknown>>
    expect(menu[0]).not.toHaveProperty('href')
    expect(menu[0]).not.toHaveProperty('action')
    expect(menu[0].children).toEqual([{ label: 'Nuevo elemento', href: '' }])
  })

  it('renders the "children" sublist and lets the user edit its own label', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'children' },
    })

    // Both the root row (already expanded) and the freshly created child row (auto-expanded by
    // `onEnterChildrenMode`) are visible at once, each with its own bare "Etiqueta" field (T5,
    // 0136) — scoped to the child's own row (`0.0`) to target its field unambiguously.
    fireEvent.change(within(screen.getByTestId('shell-tree-row-0.0')).getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'Shoes' },
    })

    const menu = currentMenu() as Array<{ children: Array<{ label: string }> }>
    expect(menu[0].children[0].label).toBe('Shoes')
  })

  it('disables "Quitar" on the last remaining child (schema requires at least one)', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'children' },
    })

    expect(screen.getByRole('button', { name: 'Quitar elemento de desplegable 1' })).toBeDisabled()
  })

  it('a menuItemChild row never offers "Con desplegable" as a mode option', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'children' },
    })

    const childModeSelect = within(screen.getByTestId('shell-tree-row-0.0')).getByRole('combobox', {
      name: 'Modo',
    }) as HTMLSelectElement
    const options = Array.from(childModeSelect.options).map((option) => option.value)
    expect(options).not.toContain('children')
  })
})

describe('ShellMenuListEditor / menu — reordering by drag', () => {
  function configWithThreeMenuItems(): MenuItemConfig[] {
    return [
      { label: 'First', href: '/1' },
      { label: 'Second', href: '/2' },
      { label: 'Third', href: '/3' },
    ]
  }

  // 0125-T5 replaces the previous per-level `DndContext` (`"shell-menu-root"`/
  // `"shell-menu-children-<parentIndex>"`, `nest` always rejected) with a single tree-wide
  // context (`id="shell-menu"`) covering root and every `children` sublist together. The
  // captured `onDragEnd` handler and its {active, over} event shape are unchanged.
  it('reordering the root menu via DnD persists the new order in the config', () => {
    renderHarness(configWithThreeMenuItems())

    const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
    expect(onDragEnd).toBeDefined()
    act(() => {
      onDragEnd?.({ active: { id: '0' }, over: { id: 'gap::3' } })
    })

    expect(currentMenu().map((item) => item.label)).toEqual(['Second', 'Third', 'First'])
  })

  it("reordering a parent's children via DnD persists the new order within that children array", () => {
    renderHarness([
      {
        label: 'Products',
        children: [
          { label: 'Shoes', href: '/shoes' },
          { label: 'Hats', href: '/hats' },
        ],
      },
    ])

    const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
    expect(onDragEnd).toBeDefined()
    act(() => {
      onDragEnd?.({ active: { id: '0.0' }, over: { id: 'gap:0:2' } })
    })

    const menu = currentMenu() as Array<{ children: Array<{ label: string }> }>
    expect(menu[0].children.map((child) => child.label)).toEqual(['Hats', 'Shoes'])
  })

  it('an out-of-range/foreign drop id on a list is a no-op: no change, no crash', () => {
    renderHarness(configWithThreeMenuItems())

    const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
    expect(() => act(() => onDragEnd?.({ active: { id: '0' }, over: { id: 'not-a-number' } }))).not.toThrow()

    expect(currentMenu().map((item) => item.label)).toEqual(['First', 'Second', 'Third'])
  })

  it('root menu and every children sublist share the same DnD context for the whole menu tree', () => {
    renderHarness([
      { label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }, { label: 'Hats', href: '/hats' }] },
      { label: 'About', href: '/about' },
    ])

    // A single `DndContext` is mounted (id="shell-menu"): only one entry was ever captured, and
    // it is the same handler whether the drag starts on a root row or on a row inside `children`.
    expect(capturedOnDragEndByContextId.size).toBe(1)
    expect(capturedOnDragEndByContextId.get('shell-menu')).toBeDefined()
  })

  it('dragging the only item of a single-element list onto its only gap is a no-op: no change, no error', () => {
    renderHarness([{ label: 'Solo', href: '/solo' }])

    const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
    expect(() => act(() => onDragEnd?.({ active: { id: '0' }, over: { id: 'gap::0' } }))).not.toThrow()

    expect(currentMenu()).toEqual([{ label: 'Solo', href: '/solo' }])
  })

  describe('nesting and cross-level moves (0125-T5)', () => {
    it('nesting a root item onto the body of another depth-0 root item converts it into a depth-1 child (acceptance criterion 4)', () => {
      renderHarness(configWithThreeMenuItems())

      const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
      act(() => {
        onDragEnd?.({ active: { id: '0' }, over: { id: 'nest:1' } })
      })

      expect(currentMenu()).toEqual([
        { label: 'Second', children: [{ label: 'First', href: '/1' }] },
        { label: 'Third', href: '/3' },
      ])
    })

    it('nesting a leaf item onto another leaf item replaces the target\'s href/action with children: [node] (Decisión 5)', () => {
      renderHarness(configWithThreeMenuItems())

      const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
      act(() => {
        onDragEnd?.({ active: { id: '0' }, over: { id: 'nest:1' } })
      })

      const menu = currentMenu() as Array<Record<string, unknown>>
      expect(menu[0]).not.toHaveProperty('href')
      expect(menu[0]).not.toHaveProperty('action')
    })

    it('nesting onto a target that already has children appends the dragged item at the end', () => {
      renderHarness([
        { label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }] },
        { label: 'Home', href: '/home' },
      ])

      const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
      act(() => {
        onDragEnd?.({ active: { id: '1' }, over: { id: 'nest:0' } })
      })

      expect(currentMenu()).toEqual([
        { label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }, { label: 'Home', href: '/home' }] },
      ])
    })

    it('nesting an item already at depth 1 into another item\'s children is blocked: no change on drop (acceptance criterion 5)', () => {
      renderHarness([
        { label: 'A', children: [{ label: 'A1', href: '/a1' }] },
        { label: 'B', children: [{ label: 'B1', href: '/b1' }] },
      ])

      const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
      act(() => {
        onDragEnd?.({ active: { id: '0.0' }, over: { id: 'nest:1.0' } })
      })

      expect(currentMenu()).toEqual([
        { label: 'A', children: [{ label: 'A1', href: '/a1' }] },
        { label: 'B', children: [{ label: 'B1', href: '/b1' }] },
      ])
    })

    it('dragging over that same blocked depth-1-into-depth-1 nest target marks its drop zone with the invalid indicator', () => {
      renderHarness([
        { label: 'A', children: [{ label: 'A1', href: '/a1' }] },
        { label: 'B', children: [{ label: 'B1', href: '/b1' }] },
      ])

      const onDragOver = capturedOnDragOverByContextId.get('shell-menu')
      act(() => {
        onDragOver?.({ active: { id: '0.0' }, over: { id: 'nest:1.0' } })
      })

      const zone = document.querySelector('[data-drop-zone="nest:1.0"]')!
      expect(zone.classList.contains('outline-red-500')).toBe(true)
    })

    it('moving a child out of its parent into the root list gap removes it from `children` and adds it as a root item (acceptance criterion 6)', () => {
      renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }, { label: 'Hats', href: '/hats' }] }])

      const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
      act(() => {
        onDragEnd?.({ active: { id: '0.0' }, over: { id: 'gap::1' } })
      })

      const menu = currentMenu() as Array<Record<string, unknown>>
      expect(menu.map((item) => item.label)).toEqual(['Products', 'Shoes'])
      expect((menu[0].children as Array<{ label: string }>).map((child) => child.label)).toEqual(['Hats'])
      expect(menu[1]).not.toHaveProperty('children')
    })

    it('preserves each descendant\'s own collapse state (mixed expanded/collapsed) after moving their parent', () => {
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
      fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0.1'))
      expect(screen.getByTestId('menu-item-collapse-toggle-0.0')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('menu-item-collapse-toggle-0.1')).toHaveAttribute('aria-expanded', 'true')

      const onDragEnd = capturedOnDragEndByContextId.get('shell-menu')
      act(() => {
        // Moves 'Products' (with its two children) from root index 0 to root index 2 (after 'About').
        onDragEnd?.({ active: { id: '0' }, over: { id: 'gap::2' } })
      })

      expect(currentMenu().map((item) => item.label)).toEqual(['About', 'Products'])
      expect(screen.getByTestId('menu-item-collapse-toggle-1.0')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('menu-item-collapse-toggle-1.1')).toHaveAttribute('aria-expanded', 'true')
    })
  })
})

describe('ShellMenuListEditor / icon field (T3, 0129)', () => {
  it('a root menuItem row shows the icon widget grid with the configured icon highlighted, not a text input', () => {
    renderHarness([{ label: 'Home', href: '/home', icon: 'Home' }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    // The grid is hidden until the search input is focused (T5, 0129).
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const grid = screen.getByRole('grid', { name: 'Icono' })
    const selected = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Home')
    expect(screen.queryByRole('textbox', { name: 'Icono' })).not.toBeInTheDocument()
  })

  it('a menuItemChild row (inside "Con desplegable") shows the icon widget with its own icon highlighted', () => {
    renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes', icon: 'ChevronRight' }] }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0.0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const grid = screen.getByRole('grid', { name: 'Icono' })
    const selected = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('ChevronRight')
  })

  it('choosing a different icon cell commits the menuItem with the new icon and every other field intact', () => {
    renderHarness([{ label: 'Home', href: '/home', icon: 'Home' }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    expect(currentMenu()).toEqual([{ label: 'Home', href: '/home', icon: 'Settings' }])
  })

  it('clicking "Quitar icono" clears icon, leaving the rest of the row unchanged', () => {
    renderHarness([{ label: 'Home', href: '/home', icon: 'Home' }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    fireEvent.click(screen.getByRole('button', { name: /Quitar icono/i }))

    expect(currentMenu()).toEqual([{ label: 'Home', href: '/home' }])
  })
})

describe('ShellMenuListEditor / visibility widget (T4, 0132)', () => {
  it('a root menuItem with a simple-condition visibility mounts the widget in "Condición simple" mode with its fields visible', () => {
    renderHarness([
      { label: 'Home', href: '/home', visibility: { reference: 'params.userId', operator: 'equals', value: 'admin' } },
    ])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    const shape = screen.getByRole('radiogroup', { name: 'Forma' })
    expect(within(shape).getByRole('radio', { name: 'Condición simple' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: 'Referencia' })).toHaveValue(
      'params.userId',
    )
    expect(screen.getByRole('combobox', { name: 'Operador' })).toHaveValue('equals')
    // Regression: the previous generic object editor exposed a raw `reference` textbox with no
    // row-specific prefix — the widget now consumes the whole `visibility` subsection instead.
    expect(screen.queryByRole('textbox', { name: 'reference' })).not.toBeInTheDocument()
  })

  it('a menuItemChild inside "Con desplegable" with an "or" group visibility mounts the widget with the group toggle and two rows', () => {
    renderHarness([
      {
        label: 'Products',
        children: [
          {
            label: 'Shoes',
            href: '/shoes',
            visibility: {
              operator: 'or',
              conditions: [
                { reference: 'a', operator: 'equals', value: 1 },
                { reference: 'b', operator: 'equals', value: 2 },
              ],
            },
          },
        ],
      },
    ])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0.0'))

    const shape = screen.getByRole('radiogroup', { name: 'Forma' })
    expect(within(shape).getByRole('radio', { name: 'Grupo (y/o)' })).toHaveAttribute('aria-checked', 'true')
    const groupOperator = screen.getByRole('radiogroup', { name: 'Operador del grupo' })
    expect(within(groupOperator).getByRole('radio', { name: 'or' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('group', { name: 'Condición 1' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Condición 2' })).toBeInTheDocument()
  })

  it('choosing "Grupo (y/o)" from the widget wraps the previous simple condition without touching other fields', () => {
    renderHarness([{ label: 'Home', href: '/home', visibility: { reference: 'x', operator: 'equals', value: 'y' } }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    const shape = screen.getByRole('radiogroup', { name: 'Forma' })
    fireEvent.click(within(shape).getByRole('radio', { name: 'Grupo (y/o)' }))

    expect(currentMenu()).toEqual([
      {
        label: 'Home',
        href: '/home',
        visibility: { operator: 'and', conditions: [{ reference: 'x', operator: 'equals', value: 'y' }] },
      },
    ])
  })
})

describe('ShellMenuListEditor / collapse control', () => {
  it('a newly mounted root item exposes its collapse control collapsed by default, with its fields hidden', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Etiqueta' })).not.toBeInTheDocument()
  })

  it('expanding a collapsed root item reveals its fields; its label/icon stay visible on the toggle button either way', () => {
    renderHarness([{ label: 'Home', href: '/home', icon: 'home' }])

    const toggle = screen.getByTestId('menu-item-collapse-toggle-0')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('Home')
    expect(toggle).toHaveTextContent('home')

    fireEvent.click(toggle)

    expect(screen.getByRole('textbox', { name: 'Etiqueta' })).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Home')
    expect(toggle).toHaveTextContent('home')
  })

  it('a collapsed parent item still renders its children list, each with its own independent collapse state', () => {
    renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }] }])

    // The parent stays collapsed (the default); expand its child independently.
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0.0'))

    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveTextContent('Products')
    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('textbox', { name: 'Etiqueta' })).toBeInTheDocument()
  })

  it('shows the branch indicator only for a root item in "Con desplegable" mode, both collapsed and expanded', () => {
    renderHarness([
      { label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }] },
      { label: 'Home', href: '/home' },
    ])

    expect(screen.getByTestId('menu-item-branch-indicator-0')).toBeInTheDocument()
    expect(screen.queryByTestId('menu-item-branch-indicator-1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    expect(screen.getByTestId('menu-item-branch-indicator-0')).toBeInTheDocument()
  })

  it('collapsing an item with a pending commit rejection keeps the role="alert" banner visible', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'REJECT' },
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('collapsing a parent does not disable its children list\'s "Añadir elemento de desplegable" button nor an expanded child\'s own controls', () => {
    renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }] }])

    // The parent stays collapsed (the default); expand its child independently.
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0.0'))

    expect(
      screen.getByRole('button', { name: 'Añadir elemento de desplegable para el elemento de menú 1' }),
    ).not.toBeDisabled()
    expect(screen.getByTestId('menu-item-collapse-toggle-0.0')).toHaveAttribute('aria-expanded', 'true')
  })

  it('uses the same gap-2 class between a parent row and its first child as between sibling rows', () => {
    renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }] }])

    const row = screen.getByTestId('shell-tree-row-0')
    const list = screen.getByTestId('shell-dnd-list-shell-menu-root')
    expect(row.className).toContain('gap-2')
    expect(list.className).toContain('gap-2')
  })

  it('expanding one root item does not affect the collapse state of another (independence by path)', () => {
    renderHarness([
      { label: 'First', href: '/1' },
      { label: 'Second', href: '/2' },
    ])

    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('menu-item-collapse-toggle-1')).toHaveAttribute('aria-expanded', 'false')
    // Scoped to the still-collapsed second row: its own bare "Etiqueta" field isn't rendered at
    // all (a global query would spuriously find the *first* row's "Etiqueta" field instead, since
    // both rows now use the same bare accessible name — T5, 0136).
    expect(within(screen.getByTestId('shell-tree-row-1')).queryByRole('textbox', { name: 'Etiqueta' })).not.toBeInTheDocument()
  })

  it('places the row name directly after the drag handle, both in the same row', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    const row = screen.getByTestId('shell-tree-row-0')
    const buttons = within(row).getAllByRole('button')

    expect(buttons[0]).toHaveAccessibleName('Reordenar elemento de menú 1')
    expect(buttons[1]).toBe(screen.getByTestId('menu-item-collapse-toggle-0'))
  })

  it('opens/closes the row by clicking its visible name, not a separate icon-only button', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

    // Scoped to the toggle itself (T3, 0129): once expanded, the icon widget's own catalog grid
    // also renders a cell labeled "Home" (a valid mocked icon name), so an unscoped `getByText`
    // becomes ambiguous.
    const toggle = screen.getByTestId('menu-item-collapse-toggle-0')
    fireEvent.click(within(toggle).getByText('Home'))
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(within(toggle).getByText('Home'))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('ShellMenuListEditor / root box removal (T4, 0136)', () => {
  it('drops the box styling (border/rounded/background) from the root fieldset, keeping "Menú" as a plain-text legend', () => {
    renderHarness()

    const fieldset = screen.getByRole('group', { name: 'Menú' })
    expect(fieldset.tagName).toBe('FIELDSET')
    expect(fieldset.className).not.toMatch(/\bborder\b/)
    expect(fieldset.className).not.toMatch(/rounded/)
    expect(fieldset.className).not.toMatch(/\bbg-/)

    const legend = screen.getByText('Menú')
    expect(legend.tagName).toBe('LEGEND')
    expect(legend.className).toBe('px-1 text-xs font-medium text-gray-700')
  })
})

describe('ShellMenuListEditor / row field label simplification (T5, 0136)', () => {
  it('shows a plain-text "Elemento de menú 1" header above a root item\'s fields, each field using its own bare accessible name', () => {
    renderHarness([{ label: 'Home', href: '/home' }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    const row = screen.getByTestId('shell-tree-row-0')
    const header = within(row).getByText('Elemento de menú 1')
    expect(header.tagName).toBe('SPAN')
    expect(header.className).toBe('text-xs font-medium text-gray-700')

    expect(within(row).getByRole('textbox', { name: 'Etiqueta' })).toBeInTheDocument()
    expect(within(row).getByRole('combobox', { name: 'Modo' })).toBeInTheDocument()
    expect(within(row).getByRole('textbox', { name: 'Href' })).toBeInTheDocument()
    expect(within(row).getByText('Visibilidad')).toBeInTheDocument()

    // No compound "Elemento de menú 1 — ..." label survives on any field (acceptance criteria 6/10/11).
    expect(within(row).queryByRole('textbox', { name: /Elemento de menú 1 —/ })).not.toBeInTheDocument()
    expect(within(row).queryByRole('combobox', { name: /Elemento de menú 1 —/ })).not.toBeInTheDocument()
    expect(within(row).queryByText(/Elemento de menú 1 — Visibilidad/)).not.toBeInTheDocument()
  })

  it('shows the "Acción" field with a bare accessible name (no compound label) once mode is "Acción"', () => {
    renderHarness([{ label: 'About', action: { type: 'navigateTo', pageId: 'home' } }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    expect(screen.getByRole('combobox', { name: 'Acción' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Elemento de menú 1 —/ })).not.toBeInTheDocument()
  })

  it('shows a plain-text "Elemento de desplegable 1" header above a menuItemChild row\'s own fields', () => {
    renderHarness([{ label: 'Products', children: [{ label: 'Shoes', href: '/shoes' }] }])
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0.0'))

    const childRow = screen.getByTestId('shell-tree-row-0.0')
    const header = within(childRow).getByText('Elemento de desplegable 1')
    expect(header.tagName).toBe('SPAN')
    expect(header.className).toBe('text-xs font-medium text-gray-700')

    expect(within(childRow).getByRole('textbox', { name: 'Etiqueta' })).toBeInTheDocument()
    expect(within(childRow).queryByRole('textbox', { name: /Elemento de desplegable 1 —/ })).not.toBeInTheDocument()
  })
})
