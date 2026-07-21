import { describe, expect, it } from 'vitest'
import {
  insertNodeAt,
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

  it('throws when parentPath resolves to a leaf node that does not accept children', () => {
    const original = [heading('Leaf')]

    expect(() =>
      insertNodeAt(original, [{ field: 'children', index: 0 }], 0, heading('New'))
    ).toThrow()
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
