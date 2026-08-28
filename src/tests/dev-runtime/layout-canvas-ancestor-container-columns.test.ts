import { describe, expect, it } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { resolveAncestorContainerColumns } from '../../dev-runtime/layout-canvas/resolve-ancestor-container-columns'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

// Fixture builders mirror the convention established in layout-canvas-drop-validity.test.ts:
// small helpers returning `LayoutNode`, `as LayoutNode` casts only where required (node types
// without an inferable discriminant, e.g. `repeater`/`tabs`).

function container(children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', children }
}

function containerWithColumns(columns: number | Record<string, number>, children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', props: { columns }, children } as LayoutNode
}

function formNode(children: LayoutNode[] = []): LayoutNode {
  return { type: 'form', id: 'formA', children } as LayoutNode
}

function inputNode(fieldId = 'name'): LayoutNode {
  return { type: 'input', props: { fieldId, label: fieldId } }
}

function repeaterNode(template: LayoutNode[]): LayoutNode {
  return { type: 'repeater', props: { items: { source: 'queries.x.data', key: 'id' }, template } } as LayoutNode
}

function repeaterNodeWithColumns(columns: number | Record<string, number>, template: LayoutNode[] = []): LayoutNode {
  return {
    type: 'repeater',
    props: { items: { source: 'queries.x.data', key: 'id' }, columns, template },
  } as LayoutNode
}

function tabsNode(items: { label: string; children?: LayoutNode[] }[]): LayoutNode {
  return { type: 'tabs', props: { items } } as LayoutNode
}

describe('resolveAncestorContainerColumns', () => {
  it('returns null when path is empty (root, no ancestors)', () => {
    const pageLayout: LayoutNode[] = [containerWithColumns(2)]
    const path: LayoutNodePath = []

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBeNull()
  })

  it('returns null when no ancestor in the chain is a container with columns declared', () => {
    const pageLayout: LayoutNode[] = [formNode([inputNode('email')])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBeNull()
  })

  it('returns the integer columns of the nearest container ancestor', () => {
    const pageLayout: LayoutNode[] = [containerWithColumns(3, [inputNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(3)
  })

  it('returns the responsive columns map of the nearest container ancestor', () => {
    const responsiveColumns = { base: 2, md: 4 }
    const pageLayout: LayoutNode[] = [containerWithColumns(responsiveColumns, [inputNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toEqual(responsiveColumns)
  })

  it('returns the columns of the nearest container ancestor, not the outermost one, when nested', () => {
    const pageLayout: LayoutNode[] = [
      containerWithColumns(2, [containerWithColumns(6, [inputNode()])]),
    ]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(6)
  })

  it('skips a container ancestor without columns and returns the one further up that declares it', () => {
    const pageLayout: LayoutNode[] = [
      containerWithColumns(4, [container([inputNode()])]),
    ]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(4)
  })

  it('does not count the node pointed to by path as an ancestor of itself', () => {
    const pageLayout: LayoutNode[] = [containerWithColumns(5)]
    const path: LayoutNodePath = [{ field: 'children', index: 0 }]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBeNull()
  })

  // T6 (2026-08-24-13-02-repeater-grid-mode): a `repeater` ancestor with `props.columns` counts as
  // a grid ancestor, the same as `container` — this covers the integer-columns case.
  it('returns the integer columns of a repeater ancestor when it declares props.columns', () => {
    const pageLayout: LayoutNode[] = [repeaterNodeWithColumns(3, [inputNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'template', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(3)
  })

  // Same as above, responsive columns map case.
  it('returns the responsive columns map of a repeater ancestor when it declares props.columns', () => {
    const responsiveColumns = { base: 1, md: 3 }
    const pageLayout: LayoutNode[] = [repeaterNodeWithColumns(responsiveColumns, [inputNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'template', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toEqual(responsiveColumns)
  })

  // When both a `container` and a `repeater` ancestor declare columns, the nearest one to the
  // queried node wins — same criterion already covered for two nested `container` ancestors above.
  it('returns the columns of the nearest ancestor, a repeater, over an outer container that also declares columns', () => {
    const pageLayout: LayoutNode[] = [
      containerWithColumns(2, [repeaterNodeWithColumns(5, [inputNode()])]),
    ]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'template', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(5)
  })

  it('resolves the container through a repeater template prefix', () => {
    const pageLayout: LayoutNode[] = [
      containerWithColumns(3, [repeaterNode([inputNode()])]),
    ]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'template', index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(3)
  })

  it('resolves the container through a tabs tabItem prefix', () => {
    const pageLayout: LayoutNode[] = [
      containerWithColumns(2, [tabsNode([{ label: 'Tab 1', children: [inputNode()] }])]),
    ]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ]

    expect(resolveAncestorContainerColumns(pageLayout, path)).toBe(2)
  })

  it('does not mutate pageLayout or path', () => {
    const pageLayout: LayoutNode[] = [containerWithColumns(3, [inputNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]
    const pageLayoutSnapshot = JSON.parse(JSON.stringify(pageLayout))
    const pathSnapshot = JSON.parse(JSON.stringify(path))

    resolveAncestorContainerColumns(pageLayout, path)

    expect(pageLayout).toEqual(pageLayoutSnapshot)
    expect(path).toEqual(pathSnapshot)
  })
})
