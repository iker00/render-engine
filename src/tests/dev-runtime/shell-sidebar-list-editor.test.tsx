import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { invalidLayout } from '../../config/runtime-config-validation-errors'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { SidebarItemListEditor } from '../../dev-runtime/shell-config-panel/sidebar-item-list-editor'

// Same mocking pattern as shell-config-panel.test.tsx: a real pointer-drag is impractical in
// jsdom, so `DndContext` becomes a pass-through that records the `onDragEnd` handler it was
// given, keyed by its own `id` prop (one distinct id per level: "shell-sidebar-root",
// "shell-sidebar-root.0", "shell-sidebar-root.0.1", ...). Tests invoke the captured handler
// directly. `useDraggable`/`useDroppable` keep their real implementation.
const capturedOnDragEndByContextId = new Map<string, (event: { active: { id: string }; over: { id: string } | null }) => void>()

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: { id?: string; children: React.ReactNode; onDragEnd?: (event: unknown) => void }) => {
      if (props.id) {
        capturedOnDragEndByContextId.set(
          props.id,
          props.onDragEnd as (event: { active: { id: string }; over: { id: string } | null }) => void,
        )
      }
      return props.children
    },
  }
})

// Isolated from `ShellConfigPanel`: this harness only owns a plain `items` array and a commit
// function that applies the mutation directly, no `RuntimeConfig`/Monaco text/patchRootKey
// involved — that full pipeline is exercised by `shell-config-panel.test.tsx`'s own integration
// tests. A rejection is simulated by a test-only marker (`label === 'REJECT'`) rather than a real
// schema violation, since this file's job is the editor's own row-level rejection *display*
// contract (keep the attempted value, show the alert), not which inputs the real schema rejects.
function Harness({ initialItems = [] as SidebarItemConfig[] }: { initialItems?: SidebarItemConfig[] }) {
  const [items, setItems] = useState<SidebarItemConfig[]>(initialItems)

  function onCommitItems(nextItems: SidebarItemConfig[]): CommitCanvasMutationResult {
    const hasRejectMarker = JSON.stringify(nextItems).includes('"label":"REJECT"')
    if (hasRejectMarker) {
      const rejection = invalidLayout('Simulated rejection for test.') as { status: 'error'; error: RuntimeConfigError }
      return { status: 'rejected', error: rejection.error }
    }
    setItems(nextItems)
    return { status: 'applied' }
  }

  return (
    <div>
      <SidebarItemListEditor items={items} path="root" onCommitItems={onCommitItems} />
      <pre data-testid="items-json">{JSON.stringify(items)}</pre>
    </div>
  )
}

function renderHarness(initialItems?: SidebarItemConfig[]) {
  capturedOnDragEndByContextId.clear()
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
  }

  it('editing label updates the item', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'Dashboard' },
    })
    expect(currentItems()[0].label).toBe('Dashboard')
  })

  it('editing icon updates the item, and clearing it removes the field', () => {
    renderWithOneRootItem()
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Icono' }), {
      target: { value: 'home' },
    })
    expect(currentItems()[0].icon).toBe('home')

    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Icono' }), { target: { value: '' } })
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

describe('SidebarItemListEditor / switching to "Con hijos"', () => {
  it('replaces href with children: [new item] and renders the nested sublist immediately', () => {
    renderHarness([{ label: 'Products', href: '/products' }])

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

  it('reordering the root list via DnD persists the new order', () => {
    renderHarness(configWithThreeRootItems())

    const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar-root')
    expect(onDragEnd).toBeDefined()
    act(() => {
      onDragEnd?.({ active: { id: '0' }, over: { id: '2' } })
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

    const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar-root.0')
    expect(onDragEnd).toBeDefined()
    act(() => {
      onDragEnd?.({ active: { id: '0' }, over: { id: '1' } })
    })

    const items = currentItems()
    expect(items[0].children?.map((child) => child.label)).toEqual(['Hats', 'Shoes'])
    expect(items[1].label).toBe('Other root')
  })

  it('an out-of-range/foreign drop id is a no-op: no change, no crash', () => {
    renderHarness(configWithThreeRootItems())

    const onDragEnd = capturedOnDragEndByContextId.get('shell-sidebar-root')
    expect(() => act(() => onDragEnd?.({ active: { id: '0' }, over: { id: 'not-a-number' } }))).not.toThrow()

    expect(currentItems().map((item) => item.label)).toEqual(['First', 'Second', 'Third'])
  })

  it('the root list and a nested children list use independent DnD contexts (no cross-level drag observable)', () => {
    renderHarness([
      { label: 'Parent', children: [{ label: 'Shoes', href: '/shoes' }, { label: 'Hats', href: '/hats' }] },
      { label: 'About', href: '/about' },
    ])

    expect(capturedOnDragEndByContextId.get('shell-sidebar-root')).not.toBe(
      capturedOnDragEndByContextId.get('shell-sidebar-root.0'),
    )
  })

  it('two different parents each get their own independent DnD context', () => {
    renderHarness([
      { label: 'Parent A', children: [{ label: 'A1', href: '/a1' }, { label: 'A2', href: '/a2' }] },
      { label: 'Parent B', children: [{ label: 'B1', href: '/b1' }, { label: 'B2', href: '/b2' }] },
    ])

    expect(capturedOnDragEndByContextId.get('shell-sidebar-root.0')).not.toBe(
      capturedOnDragEndByContextId.get('shell-sidebar-root.1'),
    )
  })
})

describe('SidebarItemListEditor / rejected commit feedback', () => {
  it('a rejected commit keeps the attempted value on screen and shows role="alert", without reverting', () => {
    renderHarness([{ label: 'Home', href: '/home' }])

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
