import { describe, expect, it } from 'vitest'
import {
  findNodePath,
  insertNodeAt,
  isSameOrDescendantPath,
  movePathTo,
  removeNodeAt,
  replaceNodeAt,
} from '../../dev-runtime/layout-tree-mutations'
import type { LayoutNode } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

function heading(text: string): LayoutNode {
  return { type: 'heading', props: { text, level: 2 } }
}

function inputNode(fieldId: string): LayoutNode {
  return { type: 'input', props: { fieldId, label: fieldId } }
}

function container(children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', children }
}

function form(id: string, children: LayoutNode[] = []): LayoutNode {
  return { type: 'form', id, children }
}

function repeater(template: LayoutNode[] = []): LayoutNode {
  return {
    type: 'repeater',
    props: { items: { source: 'queries.list', key: 'id' }, template },
  }
}

function tabsNode(items: { label: string; children?: LayoutNode[] }[]): LayoutNode {
  return { type: 'tabs', props: { items } }
}

function stepsNode(items: { label: string; children?: LayoutNode[] }[]): LayoutNode {
  return { type: 'steps', props: { items } }
}

function tableManual(rows: unknown[][], headers: string[] = ['A', 'B']): LayoutNode {
  return { type: 'table', props: { headers, rows } } as LayoutNode
}

function tableDynamic(cells: unknown[], source = 'queries.list'): LayoutNode {
  return { type: 'table', props: { headers: ['A'], rows: { source, cells } } } as LayoutNode
}

describe('replaceNodeAt', () => {
  it('replaces a top-level node without mutating the original array', () => {
    const original = [heading('A'), heading('B')]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = replaceNodeAt(original, [{ field: 'children', index: 1 }], () => heading('B-updated'))

    expect(result).not.toBe(original)
    expect(original).toEqual(snapshot)
    expect((result[1] as { props: { text: string } }).props.text).toBe('B-updated')
    expect((result[0] as { props: { text: string } }).props.text).toBe('A')
  })

  it('replaces a nested node inside container > form > input without touching siblings', () => {
    const original = [
      container([
        form('f1', [inputNode('name'), inputNode('email')]),
      ]),
    ]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'children', index: 1 },
    ]

    const result = replaceNodeAt(original, path, () => inputNode('email-updated'))

    expect(original).toEqual(snapshot)
    const resultForm = (result[0] as { children: LayoutNode[] }).children[0] as {
      children: LayoutNode[]
    }
    expect((resultForm.children[0] as { props: { fieldId: string } }).props.fieldId).toBe('name')
    expect((resultForm.children[1] as { props: { fieldId: string } }).props.fieldId).toBe('email-updated')
  })

  it('throws when path does not resolve', () => {
    const original = [heading('A')]
    expect(() =>
      replaceNodeAt(original, [{ field: 'children', index: 5 }], (node) => node)
    ).toThrow()
  })

  it('replaces a node nested through an intermediate "template" step, leaving other template entries intact', () => {
    const original = [repeater([heading('First'), heading('Second')])]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'template', index: 1 },
    ]

    const result = replaceNodeAt(original, path, () => heading('Second-updated'))

    expect(original).toEqual(snapshot)
    const template = (result[0] as { props: { template: LayoutNode[] } }).props.template
    expect((template[0] as { props: { text: string } }).props.text).toBe('First')
    expect((template[1] as { props: { text: string } }).props.text).toBe('Second-updated')
  })

  it('replaces a node nested through an intermediate "tabItem" step, leaving other tab items intact', () => {
    const original = [
      tabsNode([
        { label: 'Tab 0', children: [heading('Tab0Child')] },
        { label: 'Tab 1', children: [heading('Tab1Child')] },
      ]),
    ]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 1, index: 0 },
    ]

    const result = replaceNodeAt(original, path, () => heading('Tab1Child-updated'))

    expect(original).toEqual(snapshot)
    const items = (result[0] as { props: { items: { children?: LayoutNode[] }[] } }).props.items
    expect((items[0].children![0] as { props: { text: string } }).props.text).toBe('Tab0Child')
    expect((items[1].children![0] as { props: { text: string } }).props.text).toBe('Tab1Child-updated')
  })

  it('replaces a node nested through an intermediate "stepItem" step, leaving other step items intact', () => {
    const original = [
      stepsNode([
        { label: 'Step 0', children: [heading('Step0Child')] },
        { label: 'Step 1', children: [heading('Step1Child')] },
      ]),
    ]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 1, index: 0 },
    ]

    const result = replaceNodeAt(original, path, () => heading('Step1Child-updated'))

    expect(original).toEqual(snapshot)
    const items = (result[0] as { props: { items: { children?: LayoutNode[] }[] } }).props.items
    expect((items[0].children![0] as { props: { text: string } }).props.text).toBe('Step0Child')
    expect((items[1].children![0] as { props: { text: string } }).props.text).toBe('Step1Child-updated')
  })

  it('throws when a "stepItem" step targets a node that is not a steps node', () => {
    const original = [container([heading('A')])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 0, index: 0 },
    ]
    expect(() => replaceNodeAt(original, path, (node) => node)).toThrow()
  })

  it('throws when a "template" step targets a node that is not a repeater', () => {
    const original = [container([heading('A')])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'template', index: 0 },
    ]
    expect(() => replaceNodeAt(original, path, (node) => node)).toThrow()
  })

  it('throws when a "tabItem" step targets a node that is not a tabs node', () => {
    const original = [container([heading('A')])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ]
    expect(() => replaceNodeAt(original, path, (node) => node)).toThrow()
  })

  it('replaces exactly the cell addressed by a path terminated in a "row" step, preserving the rest of the row and other rows', () => {
    const original = [
      tableManual([
        [heading('R0C0'), 'plain0'],
        [heading('R1C0'), 'plain1'],
      ]),
    ]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 1, index: 0 },
    ]

    const result = replaceNodeAt(original, path, () => heading('R1C0-updated'))

    expect(original).toEqual(snapshot)
    const rows = (result[0] as { props: { rows: unknown[][] } }).props.rows
    expect((rows[0][0] as { props: { text: string } }).props.text).toBe('R0C0')
    expect(rows[0][1]).toBe('plain0')
    expect((rows[1][0] as { props: { text: string } }).props.text).toBe('R1C0-updated')
    expect(rows[1][1]).toBe('plain1')
  })

  it('replaces exactly the cell addressed by a path terminated in a "cells" step, preserving props.rows.source', () => {
    const original = [tableDynamic(['plain', heading('DynCell')])]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'cells', index: 1 },
    ]

    const result = replaceNodeAt(original, path, () => heading('DynCell-updated'))

    expect(original).toEqual(snapshot)
    const tableProps = (result[0] as { props: { rows: { source: string; cells: unknown[] } } }).props
    expect(tableProps.rows.source).toBe('queries.list')
    expect(tableProps.rows.cells[0]).toBe('plain')
    expect((tableProps.rows.cells[1] as { props: { text: string } }).props.text).toBe('DynCell-updated')
  })

  it('replaces a node nested through an intermediate "row" step, reconstructing the whole chain up to the root', () => {
    const original = [tableManual([[container([heading('Inner')])]])]
    const snapshot = JSON.parse(JSON.stringify(original))

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 0 },
      { field: 'children', index: 0 },
    ]

    const result = replaceNodeAt(original, path, () => heading('Inner-updated'))

    expect(original).toEqual(snapshot)
    const cell = (result[0] as { props: { rows: LayoutNode[][] } }).props.rows[0][0] as { children: LayoutNode[] }
    expect((cell.children[0] as { props: { text: string } }).props.text).toBe('Inner-updated')
  })
})

describe('insertNodeAt', () => {
  it('inserts at the root when parentPath is empty, shifting later siblings', () => {
    const original = [heading('A'), heading('C')]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = insertNodeAt(original, [], 1, heading('B'))

    expect(original).toEqual(snapshot)
    expect(result.map((n) => (n as { props: { text: string } }).props.text)).toEqual(['A', 'B', 'C'])
  })

  it('inserts inside a container children, creating the array when undefined', () => {
    const original = [{ type: 'container' } as LayoutNode]

    const result = insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'))

    const containerResult = result[0] as { children: LayoutNode[] }
    expect(containerResult.children).toHaveLength(1)
    expect((containerResult.children[0] as { props: { text: string } }).props.text).toBe('New')
  })

  it('inserts inside a repeater props.template', () => {
    const original = [repeater([heading('Existing')])]

    const result = insertNodeAt(original, [{ field: 'children', index: 0 }], 1, heading('New'))

    const repeaterResult = result[0] as { props: { template: LayoutNode[] } }
    expect(repeaterResult.props.template).toHaveLength(2)
    expect((repeaterResult.props.template[1] as { props: { text: string } }).props.text).toBe('New')
  })

  it('inserts inside items[tabItemIndex].children of a tabs node, creating the array when undefined, without affecting other items', () => {
    const original = [
      tabsNode([
        { label: 'Tab 0', children: [heading('Tab0Child')] },
        { label: 'Tab 1' },
      ]),
    ]

    const result = insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('Tab1Child'), {
      tabItemIndex: 1,
    })

    const tabsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
    expect(tabsResult.props.items[0].children).toHaveLength(1)
    expect((tabsResult.props.items[0].children![0] as { props: { text: string } }).props.text).toBe(
      'Tab0Child'
    )
    expect(tabsResult.props.items[1].children).toHaveLength(1)
    expect((tabsResult.props.items[1].children![0] as { props: { text: string } }).props.text).toBe(
      'Tab1Child'
    )
  })

  it('throws when parentPath resolves to a tabs node without options.tabItemIndex', () => {
    const original = [tabsNode([{ label: 'Tab 0' }])]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'))
    ).toThrow()
  })

  it('throws when parentPath resolves to a non-tabs node and options.tabItemIndex is provided', () => {
    const original = [container([])]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'), { tabItemIndex: 0 })
    ).toThrow()
  })

  it('throws when options.tabItemIndex points to a tab item that does not exist', () => {
    const original = [tabsNode([{ label: 'Tab 0' }])]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'), { tabItemIndex: 5 })
    ).toThrow()
  })

  it('inserts inside items[stepItemIndex].children of a steps node, creating the array when undefined, without affecting other items', () => {
    const original = [
      stepsNode([
        { label: 'Step 0', children: [heading('Step0Child')] },
        { label: 'Step 1' },
      ]),
    ]

    const result = insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('Step1Child'), {
      stepItemIndex: 1,
    })

    const stepsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
    expect(stepsResult.props.items[0].children).toHaveLength(1)
    expect((stepsResult.props.items[0].children![0] as { props: { text: string } }).props.text).toBe(
      'Step0Child'
    )
    expect(stepsResult.props.items[1].children).toHaveLength(1)
    expect((stepsResult.props.items[1].children![0] as { props: { text: string } }).props.text).toBe(
      'Step1Child'
    )
  })

  it('throws when parentPath resolves to a steps node without options.stepItemIndex', () => {
    const original = [stepsNode([{ label: 'Step 0' }])]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'))
    ).toThrow()
  })

  it('throws when parentPath resolves to a non-steps node and options.stepItemIndex is provided', () => {
    const original = [container([])]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'), { stepItemIndex: 0 })
    ).toThrow()
  })

  it('throws when options.stepItemIndex points to a step item that does not exist', () => {
    const original = [stepsNode([{ label: 'Step 0' }])]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'), { stepItemIndex: 5 })
    ).toThrow()
  })

  it('throws when parentPath resolves to a leaf node that does not accept children', () => {
    const original = [heading('Leaf')]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'))
    ).toThrow()
  })

  it('inserts into the children of a table cell-container when parentPath terminates in a "row" step', () => {
    const original = [tableManual([[container([heading('Existing')])]])]

    const parentPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 0 },
    ]

    const result = insertNodeAt(original, parentPath, 1, heading('New'))

    const cell = (result[0] as { props: { rows: LayoutNode[][] } }).props.rows[0][0] as { children: LayoutNode[] }
    expect(cell.children).toHaveLength(2)
    expect((cell.children[0] as { props: { text: string } }).props.text).toBe('Existing')
    expect((cell.children[1] as { props: { text: string } }).props.text).toBe('New')
  })

  it('throws the generic "does not accept children" error when parentPath resolves directly to a non-container table cell', () => {
    const original = [tableManual([[heading('Leaf')]])]

    const parentPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 0 },
    ]

    expect(() => insertNodeAt(original, parentPath, 0, heading('New'))).toThrow()
  })
})

describe('removeNodeAt', () => {
  it('removes a container and its whole subtree from the result', () => {
    const original = [
      heading('Before'),
      container([heading('Child1'), heading('Child2')]),
      heading('After'),
    ]

    const result = removeNodeAt(original, [{ field: 'children', index: 1 }])

    expect(result).toHaveLength(2)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('Child1')
    expect(serialized).not.toContain('Child2')
    expect((result[0] as { props: { text: string } }).props.text).toBe('Before')
    expect((result[1] as { props: { text: string } }).props.text).toBe('After')
  })

  it('removes a node nested inside a repeater template, leaving sibling template entries intact', () => {
    const original = [repeater([heading('Keep'), heading('Remove')])]

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'template', index: 1 },
    ]

    const result = removeNodeAt(original, path)

    const template = (result[0] as { props: { template: LayoutNode[] } }).props.template
    expect(template).toHaveLength(1)
    expect((template[0] as { props: { text: string } }).props.text).toBe('Keep')
  })

  it('removes only the descendant addressed by a "children" step nested inside a table cell-container, leaving the cell in place', () => {
    const original = [tableManual([[container([heading('Keep'), heading('Remove')])]])]

    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'row', rowIndex: 0, index: 0 },
      { field: 'children', index: 1 },
    ]

    const result = removeNodeAt(original, path)

    const cell = (result[0] as { props: { rows: LayoutNode[][] } }).props.rows[0][0] as { children: LayoutNode[] }
    expect(cell.children).toHaveLength(1)
    expect((cell.children[0] as { props: { text: string } }).props.text).toBe('Keep')
  })
})

describe('movePathTo', () => {
  it('reorders two siblings forward within the same parent array', () => {
    // toIndex=2 addresses "C" in the original array; the sibling-shift adjustment
    // (source index 0 < toIndex 2, same parent) inserts A immediately before it.
    const original = [heading('A'), heading('B'), heading('C')]

    const result = movePathTo(original, [{ field: 'children', index: 0 }], [], 2)

    expect(result.map((n) => (n as { props: { text: string } }).props.text)).toEqual(['B', 'A', 'C'])
  })

  it('reorders two siblings backward within the same parent array', () => {
    const original = [heading('A'), heading('B'), heading('C')]

    const result = movePathTo(original, [{ field: 'children', index: 2 }], [], 0)

    expect(result.map((n) => (n as { props: { text: string } }).props.text)).toEqual(['C', 'A', 'B'])
  })

  it('does not duplicate or lose unaffected siblings when reordering', () => {
    const original = [heading('A'), heading('B'), heading('C'), heading('D')]

    const result = movePathTo(original, [{ field: 'children', index: 1 }], [], 3)

    expect(result).toHaveLength(4)
    expect(result.map((n) => (n as { props: { text: string } }).props.text).sort()).toEqual([
      'A',
      'B',
      'C',
      'D',
    ])
  })

  it('renests a node from one form to a different form on the same page', () => {
    const original = [
      form('source-form', [inputNode('moved-field')]),
      form('target-form', [inputNode('existing-field')]),
    ]

    const result = movePathTo(
      original,
      [{ field: 'children', index: 0 }, { field: 'children', index: 0 }],
      [{ field: 'children', index: 1 }],
      1
    )

    const sourceForm = result[0] as { children: LayoutNode[] }
    const targetForm = result[1] as { children: LayoutNode[] }

    expect(sourceForm.children).toHaveLength(0)
    expect(targetForm.children).toHaveLength(2)
    expect((targetForm.children[0] as { props: { fieldId: string } }).props.fieldId).toBe(
      'existing-field'
    )
    expect((targetForm.children[1] as { props: { fieldId: string } }).props.fieldId).toBe('moved-field')
  })

  it('moves a node out of a tabs item children into a sibling container', () => {
    const original = [
      tabsNode([{ label: 'Tab 0', children: [heading('MoveMe')] }]),
      container([heading('Existing')]),
    ]

    const fromPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'tabItem', itemIndex: 0, index: 0 },
    ]
    const toParentPath: LayoutNodePath = [{ field: 'children', index: 1 }]

    const result = movePathTo(original, fromPath, toParentPath, 1)

    const tabsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
    const containerResult = result[1] as { children: LayoutNode[] }

    expect(tabsResult.props.items[0].children).toHaveLength(0)
    expect(containerResult.children).toHaveLength(2)
    expect((containerResult.children[0] as { props: { text: string } }).props.text).toBe('Existing')
    expect((containerResult.children[1] as { props: { text: string } }).props.text).toBe('MoveMe')
  })

  it('moves a node out of a steps item children into a sibling container', () => {
    const original = [
      stepsNode([{ label: 'Step 0', children: [heading('MoveMe')] }]),
      container([heading('Existing')]),
    ]

    const fromPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 0, index: 0 },
    ]
    const toParentPath: LayoutNodePath = [{ field: 'children', index: 1 }]

    const result = movePathTo(original, fromPath, toParentPath, 1)

    const stepsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
    const containerResult = result[1] as { children: LayoutNode[] }

    expect(stepsResult.props.items[0].children).toHaveLength(0)
    expect(containerResult.children).toHaveLength(2)
    expect((containerResult.children[0] as { props: { text: string } }).props.text).toBe('Existing')
    expect((containerResult.children[1] as { props: { text: string } }).props.text).toBe('MoveMe')
  })

  it('renests a leading root node into the active panel of a steps node that already has one child', () => {
    const original = [
      heading('X'),
      stepsNode([
        { label: 'Step 0', children: [heading('Y')] },
        { label: 'Step 1', children: [heading('Z')] },
      ]),
    ]

    const result = movePathTo(original, [{ field: 'children', index: 0 }], [{ field: 'children', index: 1 }], 1, {
      toStepItemIndex: 0,
    })

    expect(result).toHaveLength(1)
    const stepsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
    expect(
      stepsResult.props.items[0].children!.map((n) => (n as { props: { text: string } }).props.text)
    ).toEqual(['Y', 'X'])
    expect(
      stepsResult.props.items[1].children!.map((n) => (n as { props: { text: string } }).props.text)
    ).toEqual(['Z'])
  })

  it('moves a node between two panels of the same steps node', () => {
    const original = [
      stepsNode([
        { label: 'Step 0', children: [heading('MoveMe')] },
        { label: 'Step 1', children: [heading('Existing')] },
      ]),
    ]

    const fromPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'stepItem', itemIndex: 0, index: 0 },
    ]
    const toParentPath: LayoutNodePath = [{ field: 'children', index: 0 }]

    const result = movePathTo(original, fromPath, toParentPath, 1, { toStepItemIndex: 1 })

    const stepsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
    expect(stepsResult.props.items[0].children).toHaveLength(0)
    expect(
      stepsResult.props.items[1].children!.map((n) => (n as { props: { text: string } }).props.text)
    ).toEqual(['Existing', 'MoveMe'])
  })

  it('throws when toParentPath points to a descendant of fromPath (moving a container into its own child)', () => {
    const original = [container([container([heading('Inner')])])]

    const fromPath: LayoutNodePath = [{ field: 'children', index: 0 }]
    const toParentPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(() => movePathTo(original, fromPath, toParentPath, 0)).toThrow()
  })

  it('throws when fromPath equals toParentPath (moving a node inside itself)', () => {
    const original = [container([heading('Inner')])]
    const path: LayoutNodePath = [{ field: 'children', index: 0 }]

    expect(() => movePathTo(original, path, path, 0)).toThrow()
  })

  it('throws when fromPath does not resolve to an existing node', () => {
    const original = [heading('A')]

    expect(() => movePathTo(original, [{ field: 'children', index: 9 }], [], 0)).toThrow()
  })

  describe('renesting a root sibling into a target that comes after it (RF3 regression)', () => {
    // Regression for the bug where `movePathTo` computed `toParentPath` against the
    // pre-removal tree and never compensated for the index shift `removeNodeAt` causes on
    // siblings positioned after the removed node — corrupting the destination path whenever
    // the drop target already contained content and sat after the dragged node in the array.

    it('renests a leading root node into a container that already has one child', () => {
      const original = [heading('X'), container([heading('Y')])]

      const result = movePathTo(original, [{ field: 'children', index: 0 }], [{ field: 'children', index: 1 }], 1)

      expect(result).toHaveLength(1)
      const containerResult = result[0] as { children: LayoutNode[] }
      expect(containerResult.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Y',
        'X',
      ])
    })

    it('renests a leading root node to the front of a container that already has two children', () => {
      const original = [heading('X'), container([heading('Y'), heading('Z')])]

      const result = movePathTo(original, [{ field: 'children', index: 0 }], [{ field: 'children', index: 1 }], 0)

      expect(result).toHaveLength(1)
      const containerResult = result[0] as { children: LayoutNode[] }
      expect(containerResult.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'X',
        'Y',
        'Z',
      ])
    })

    it('does not shift toParentPath when the removed node sits after the target in the array', () => {
      const original = [container([heading('Y'), heading('Z')]), heading('X')]

      const result = movePathTo(original, [{ field: 'children', index: 1 }], [{ field: 'children', index: 0 }], 1)

      expect(result).toHaveLength(1)
      const containerResult = result[0] as { children: LayoutNode[] }
      expect(containerResult.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Y',
        'X',
        'Z',
      ])
    })

    it('renests a leading root node into the active tab of a tabs node that already has one child', () => {
      const original = [
        heading('X'),
        tabsNode([
          { label: 'Tab 0', children: [heading('Y')] },
          { label: 'Tab 1', children: [heading('Z')] },
        ]),
      ]

      const result = movePathTo(original, [{ field: 'children', index: 0 }], [{ field: 'children', index: 1 }], 1, {
        toTabItemIndex: 0,
      })

      expect(result).toHaveLength(1)
      const tabsResult = result[0] as { props: { items: { children?: LayoutNode[] }[] } }
      expect(
        tabsResult.props.items[0].children!.map((n) => (n as { props: { text: string } }).props.text)
      ).toEqual(['Y', 'X'])
      expect(
        tabsResult.props.items[1].children!.map((n) => (n as { props: { text: string } }).props.text)
      ).toEqual(['Z'])
    })

    it('renests a leading root node into a form that already has one child', () => {
      const original = [heading('X'), form('f1', [inputNode('existing')])]

      const result = movePathTo(original, [{ field: 'children', index: 0 }], [{ field: 'children', index: 1 }], 1)

      expect(result).toHaveLength(1)
      const formResult = result[0] as { children: LayoutNode[] }
      expect(formResult.children[0]).toMatchObject({ type: 'input', props: { fieldId: 'existing' } })
      expect(formResult.children[1]).toMatchObject({ type: 'heading' })
    })

    it('renests a leading root node into an accordion that already has one child', () => {
      const accordion = (children: LayoutNode[]): LayoutNode =>
        ({ type: 'accordion', props: { label: 'Section' }, children } as LayoutNode)
      const original = [heading('X'), accordion([heading('Y')])]

      const result = movePathTo(original, [{ field: 'children', index: 0 }], [{ field: 'children', index: 1 }], 1)

      expect(result).toHaveLength(1)
      const accordionResult = result[0] as { children: LayoutNode[] }
      expect(accordionResult.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Y',
        'X',
      ])
    })

    it('leaves toParentPath and toIndex unchanged when fromPath and toParentPath are disjoint subtrees', () => {
      const original = [container([heading('Moved')]), container([heading('Existing')])]

      const result = movePathTo(
        original,
        [{ field: 'children', index: 0 }, { field: 'children', index: 0 }],
        [{ field: 'children', index: 1 }],
        1
      )

      const sourceResult = result[0] as { children: LayoutNode[] }
      const targetResult = result[1] as { children: LayoutNode[] }
      expect(sourceResult.children).toHaveLength(0)
      expect(targetResult.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Existing',
        'Moved',
      ])
    })
  })

  describe('table cell-container nesting ("row"/"cells" steps)', () => {
    it('renests a node within the children of the same table cell-container, and findNodePath re-resolves its new path with the row prefix intact', () => {
      const cellA = heading('A')
      const original = [tableManual([[container([cellA, heading('B')])]])]

      const fromPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 0 },
        { field: 'children', index: 0 },
      ]
      const toParentPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 0 },
      ]

      const result = movePathTo(original, fromPath, toParentPath, 2)

      const cell = (result[0] as { props: { rows: LayoutNode[][] } }).props.rows[0][0] as { children: LayoutNode[] }
      expect(cell.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual(['B', 'A'])

      const newPath = findNodePath(result, cellA)
      expect(newPath).toEqual([
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 0 },
        { field: 'children', index: 1 },
      ])
    })

    it('decrements a toParentPath "row" step index when it targets a later cell in the same row a whole-cell removal shifted', () => {
      const original = [
        tableManual([[heading('Keep0'), heading('Moved'), container([heading('Inner')])]]),
      ]

      const fromPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 1 },
      ]
      const toParentPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 2 },
      ]

      const result = movePathTo(original, fromPath, toParentPath, 0)

      const row = (result[0] as { props: { rows: LayoutNode[][] } }).props.rows[0]
      expect(row).toHaveLength(2)
      expect((row[0] as { props: { text: string } }).props.text).toBe('Keep0')
      const targetCell = row[1] as { children: LayoutNode[] }
      expect(targetCell.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Moved',
        'Inner',
      ])
    })

    it('does not decrement a toParentPath "row" step targeting a different row, even when its index numerically follows the removed cell', () => {
      const original = [
        tableManual([
          [heading('Keep0'), heading('Moved')],
          [heading('X'), heading('NotAContainer'), container([heading('Inner')])],
        ]),
      ]

      const fromPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 0, index: 1 },
      ]
      const toParentPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'row', rowIndex: 1, index: 2 },
      ]

      const result = movePathTo(original, fromPath, toParentPath, 0)

      const row1 = (result[0] as { props: { rows: LayoutNode[][] } }).props.rows[1]
      expect(row1).toHaveLength(3)
      const targetCell = row1[2] as { children: LayoutNode[] }
      expect(targetCell.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Moved',
        'Inner',
      ])
    })

    it('decrements a toParentPath "cells" step index after removing an earlier cell from the same dynamic cells collection', () => {
      const original = [tableDynamic([heading('Moved'), container([heading('Inner')])])]

      const fromPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'cells', index: 0 },
      ]
      const toParentPath: LayoutNodePath = [
        { field: 'children', index: 0 },
        { field: 'cells', index: 1 },
      ]

      const result = movePathTo(original, fromPath, toParentPath, 0)

      const cells = (result[0] as { props: { rows: { cells: LayoutNode[] } } }).props.rows.cells
      expect(cells).toHaveLength(1)
      const targetCell = cells[0] as { children: LayoutNode[] }
      expect(targetCell.children.map((n) => (n as { props: { text: string } }).props.text)).toEqual([
        'Moved',
        'Inner',
      ])
    })
  })
})

describe('isSameOrDescendantPath with "row"/"cells" steps', () => {
  it('treats two "row" steps with different rowIndex as unrelated, even when index matches', () => {
    const ancestorPath: LayoutNodePath = [{ field: 'row', rowIndex: 0, index: 0 }]
    const candidatePath: LayoutNodePath = [
      { field: 'row', rowIndex: 1, index: 0 },
      { field: 'children', index: 0 },
    ]
    expect(isSameOrDescendantPath(ancestorPath, candidatePath)).toBe(false)
  })

  it('treats two "row" steps with the same rowIndex and index as ancestor/descendant', () => {
    const ancestorPath: LayoutNodePath = [{ field: 'row', rowIndex: 0, index: 0 }]
    const candidatePath: LayoutNodePath = [
      { field: 'row', rowIndex: 0, index: 0 },
      { field: 'children', index: 0 },
    ]
    expect(isSameOrDescendantPath(ancestorPath, candidatePath)).toBe(true)
  })

  it('treats two "cells" steps with the same index as ancestor/descendant', () => {
    const ancestorPath: LayoutNodePath = [{ field: 'cells', index: 0 }]
    const candidatePath: LayoutNodePath = [
      { field: 'cells', index: 0 },
      { field: 'children', index: 0 },
    ]
    expect(isSameOrDescendantPath(ancestorPath, candidatePath)).toBe(true)
  })
})

describe('immutability across all four functions', () => {
  it('never mutates the input array reference or contents', () => {
    const original = [
      container([heading('A'), form('f1', [inputNode('name')])]),
      repeater([heading('Template')]),
    ]
    const snapshot = JSON.parse(JSON.stringify(original))

    replaceNodeAt(original, [{ field: 'children', index: 0 }], () => heading('Replaced'))
    expect(original).toEqual(snapshot)

    insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('Inserted'))
    expect(original).toEqual(snapshot)

    removeNodeAt(original, [{ field: 'children', index: 0 }])
    expect(original).toEqual(snapshot)

    movePathTo(original, [{ field: 'children', index: 1 }], [], 0)
    expect(original).toEqual(snapshot)
  })
})
