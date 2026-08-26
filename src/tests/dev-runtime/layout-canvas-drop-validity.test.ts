import { describe, expect, it } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { isValidDropTarget } from '../../dev-runtime/layout-canvas/layout-drop-validity'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

// Fixture builders mirror the convention already established in
// layout-canvas-commit.test.tsx: small helpers returning `LayoutNode`, `as LayoutNode` casts
// only where required (node types without an inferable discriminant, e.g. `form`).

function heading(text = 'Heading'): LayoutNode {
  return { type: 'heading', props: { text, level: 2 } }
}

function inputNode(fieldId: string): LayoutNode {
  return { type: 'input', props: { fieldId, label: fieldId } }
}

function buttonWithoutAction(label = 'Submit'): LayoutNode {
  return { type: 'button', props: { label } }
}

function container(children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', children }
}

function form(id: string, children: LayoutNode[] = []): LayoutNode {
  return { type: 'form', id, children } as LayoutNode
}

function repeater(template: LayoutNode[]): LayoutNode {
  return { type: 'repeater', props: { items: { source: 'queries.x.data', key: 'id' }, template } } as LayoutNode
}

function modal(id: string, children: LayoutNode[] = []): LayoutNode {
  return { type: 'modal', id, children } as LayoutNode
}

function link(children: LayoutNode[] = []): LayoutNode {
  return { type: 'link', props: { href: '#' }, children } as LayoutNode
}

function tabs(items: { label: string; children?: LayoutNode[] }[]): LayoutNode {
  return { type: 'tabs', props: { items } } as LayoutNode
}

function badge(label = 'Badge'): LayoutNode {
  return { type: 'badge', props: { label } }
}

function listNode(): LayoutNode {
  return { type: 'list', props: { items: ['a', 'b'] } }
}

function alertNode(): LayoutNode {
  return { type: 'alert', props: { message: 'x' } }
}

function statNode(): LayoutNode {
  return { type: 'stat', props: { label: 'L', value: 'V' } }
}

function skeletonNode(): LayoutNode {
  return { type: 'skeleton' }
}

function tableNode(): LayoutNode {
  return { type: 'table', props: { headers: ['a'], rows: [['1']] } }
}

// A single, reused page layout tree exercising every path shape needed below:
// [0] formA: input + a nested container wrapping a form-only button
// [1] formB: another, unrelated form (cross-form move target)
// [2] containerNoForm: a plain container with no form ancestor
// [3] repeaterNode: a repeater (never accepts a direct drop)
// [4] modalNode: a modal with a heading child (closed child catalogue)
// [5] linkNode: a link with a badge child (closed child catalogue)
// [6] tabsNoForm: a tabs node with 2 items, no form ancestor anywhere
// [7] formWithTabs: a form containing a nested tabs node (form ancestor via nesting)
// [8] emptyForm: a form with no children yet (freshly-inserted placeholder)
// [9] palette: extra real nodes to drag from, one per type under test
// [10] cycleOuter: a container wrapping cycleInner, isolated for cycle tests
const PAGE_LAYOUT: LayoutNode[] = [
  form('formA', [inputNode('inputA'), container([buttonWithoutAction()])]),
  form('formB', [inputNode('inputB')]),
  container([heading('Plain heading')]),
  repeater([heading('Template item')]),
  modal('modal1', [heading('Modal title')]),
  link([badge('Link badge')]),
  tabs([
    { label: 'Tab1', children: [] },
    { label: 'Tab2', children: [] },
  ]),
  form('formWithTabs', [
    tabs([
      { label: 'T1', children: [] },
      { label: 'T2', children: [] },
    ]),
  ]),
  form('emptyForm', []),
  container([listNode(), modal('modal2', []), badge('Palette badge'), alertNode(), statNode(), skeletonNode(), tableNode()]),
  container([container([])]),
]

const FORM_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
const INPUT_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }, { field: 'children', index: 0 }]
const CONTAINER_IN_FORM_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }, { field: 'children', index: 1 }]
const BUTTON_IN_FORM_A_PATH: LayoutNodePath = [
  { field: 'children', index: 0 },
  { field: 'children', index: 1 },
  { field: 'children', index: 0 },
]

const FORM_B_PATH: LayoutNodePath = [{ field: 'children', index: 1 }]

const CONTAINER_NO_FORM_PATH: LayoutNodePath = [{ field: 'children', index: 2 }]
const HEADING_IN_CONTAINER_NO_FORM_PATH: LayoutNodePath = [
  { field: 'children', index: 2 },
  { field: 'children', index: 0 },
]

const REPEATER_PATH: LayoutNodePath = [{ field: 'children', index: 3 }]

const MODAL_PATH: LayoutNodePath = [{ field: 'children', index: 4 }]

const LINK_PATH: LayoutNodePath = [{ field: 'children', index: 5 }]

const TABS_NO_FORM_PATH: LayoutNodePath = [{ field: 'children', index: 6 }]

const TABS_IN_FORM_PATH: LayoutNodePath = [
  { field: 'children', index: 7 },
  { field: 'children', index: 0 },
]

const EMPTY_FORM_PATH: LayoutNodePath = [{ field: 'children', index: 8 }]

const PALETTE_LIST_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 0 }]
const PALETTE_MODAL_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 1 }]
const PALETTE_BADGE_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 2 }]
const PALETTE_ALERT_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 3 }]
const PALETTE_STAT_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 4 }]
const PALETTE_SKELETON_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 5 }]
const PALETTE_TABLE_PATH: LayoutNodePath = [{ field: 'children', index: 9 }, { field: 'children', index: 6 }]

const CYCLE_OUTER_PATH: LayoutNodePath = [{ field: 'children', index: 10 }]
const CYCLE_INNER_PATH: LayoutNodePath = [{ field: 'children', index: 10 }, { field: 'children', index: 0 }]

describe('isValidDropTarget: form-only leaf nodes require a form ancestor', () => {
  it('rejects an input dragged from a form to a sibling container without a form ancestor', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, CONTAINER_NO_FORM_PATH, 0)).toBe(false)
  })

  it('accepts an input dragged from one form to a different form on the same page', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, FORM_B_PATH, 1)).toBe(true)
  })
})

describe('isValidDropTarget: a button without action requires a form ancestor', () => {
  it('rejects a button without action dragged to the root layout, outside any form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, BUTTON_IN_FORM_A_PATH, [], 0)).toBe(false)
  })

  it('accepts a button without action dragged into a form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, BUTTON_IN_FORM_A_PATH, FORM_A_PATH, 2)).toBe(true)
  })
})

describe('isValidDropTarget: repeater never accepts a direct drop', () => {
  it('rejects any node dragged into a repeater', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, REPEATER_PATH, 0)).toBe(false)
  })
})

describe('isValidDropTarget: closed catalogue of form descendants', () => {
  const dragIntoFormA = (draggedPath: LayoutNodePath) => isValidDropTarget(PAGE_LAYOUT, draggedPath, FORM_A_PATH, 2)

  it('rejects list, link and modal dragged directly into a form', () => {
    expect(dragIntoFormA(PALETTE_LIST_PATH)).toBe(false)
    expect(dragIntoFormA(LINK_PATH)).toBe(false)
    expect(dragIntoFormA(PALETTE_MODAL_PATH)).toBe(false)
  })

  it('accepts badge, alert, stat and skeleton dragged directly into a form', () => {
    expect(dragIntoFormA(PALETTE_BADGE_PATH)).toBe(true)
    expect(dragIntoFormA(PALETTE_ALERT_PATH)).toBe(true)
    expect(dragIntoFormA(PALETTE_STAT_PATH)).toBe(true)
    expect(dragIntoFormA(PALETTE_SKELETON_PATH)).toBe(true)
  })

  it('rejects the same disallowed types dragged into a container nested inside a form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_LIST_PATH, CONTAINER_IN_FORM_A_PATH, 0)).toBe(false)
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_MODAL_PATH, CONTAINER_IN_FORM_A_PATH, 0)).toBe(false)
  })

  it('accepts badge, alert, stat and skeleton dragged into a container nested inside a form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_BADGE_PATH, CONTAINER_IN_FORM_A_PATH, 0)).toBe(true)
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_ALERT_PATH, CONTAINER_IN_FORM_A_PATH, 0)).toBe(true)
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_STAT_PATH, CONTAINER_IN_FORM_A_PATH, 0)).toBe(true)
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_SKELETON_PATH, CONTAINER_IN_FORM_A_PATH, 0)).toBe(true)
  })
})

describe('isValidDropTarget: cycle avoidance', () => {
  it('rejects a container dragged into one of its own children', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, CYCLE_OUTER_PATH, CYCLE_INNER_PATH, 0)).toBe(false)
  })

  it('rejects a container dragged onto itself as the target', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, CYCLE_OUTER_PATH, CYCLE_OUTER_PATH, 0)).toBe(false)
  })
})

describe('isValidDropTarget: unrestricted nodes into a plain container', () => {
  it('accepts a heading dragged into any container regardless of form ancestry', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, CYCLE_OUTER_PATH, 0)).toBe(true)
  })

  it('accepts an input dragged into the empty placeholder of a freshly-inserted form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, EMPTY_FORM_PATH, 0)).toBe(true)
  })
})

describe('isValidDropTarget: closed catalogue of modal children', () => {
  it('accepts a heading dragged into a modal', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, MODAL_PATH, 1)).toBe(true)
  })

  it('rejects an input dragged into the same modal, regardless of any form ancestor elsewhere', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, MODAL_PATH, 1)).toBe(false)
  })
})

describe('isValidDropTarget: closed catalogue of link children', () => {
  it('accepts a badge dragged into a link', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_BADGE_PATH, LINK_PATH, 1)).toBe(true)
  })

  it('rejects a table dragged into the same link', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, PALETTE_TABLE_PATH, LINK_PATH, 1)).toBe(false)
  })
})

describe('isValidDropTarget: tabs target disambiguation', () => {
  it('rejects a drop on a tabs node without options.targetTabItemIndex', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, TABS_NO_FORM_PATH, 0)).toBe(false)
  })

  it('rejects an out-of-range options.targetTabItemIndex', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, TABS_NO_FORM_PATH, 0, {
        targetTabItemIndex: 5,
      }),
    ).toBe(false)
  })

  it('accepts a heading dragged into a tabs node with a valid options.targetTabItemIndex', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, TABS_NO_FORM_PATH, 0, {
        targetTabItemIndex: 0,
      }),
    ).toBe(true)
  })

  it('rejects options.targetTabItemIndex passed for a non-tabs target', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, CONTAINER_NO_FORM_PATH, 0, {
        targetTabItemIndex: 0,
      }),
    ).toBe(false)
  })

  it('rejects a form-only leaf dragged into a tabs node with no form ancestor, even with a valid targetTabItemIndex', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, TABS_NO_FORM_PATH, 0, { targetTabItemIndex: 0 }),
    ).toBe(false)
  })

  it('accepts a form-only leaf dragged into a tabs node nested inside a form, with a valid targetTabItemIndex', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, TABS_IN_FORM_PATH, 0, { targetTabItemIndex: 0 }),
    ).toBe(true)
  })
})

describe('isValidDropTarget: malformed or unresolvable calls', () => {
  it('rejects a null draggedPath with no options.draggedNodeType', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, null, CONTAINER_NO_FORM_PATH, 0)).toBe(false)
  })

  it('rejects a draggedPath that does not resolve to an existing node', () => {
    const bogusPath: LayoutNodePath = [{ field: 'children', index: 999 }]
    expect(isValidDropTarget(PAGE_LAYOUT, bogusPath, CONTAINER_NO_FORM_PATH, 0)).toBe(false)
  })

  it('rejects a targetParentPath that does not resolve to an existing node', () => {
    const bogusPath: LayoutNodePath = [{ field: 'children', index: 999 }]
    expect(isValidDropTarget(PAGE_LAYOUT, HEADING_IN_CONTAINER_NO_FORM_PATH, bogusPath, 0)).toBe(false)
  })
})

describe('isValidDropTarget: palette-originated drag (draggedPath: null, no cycle check)', () => {
  it('rejects a synthetic form-only leaf dragged into a container without a form ancestor', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, null, CONTAINER_NO_FORM_PATH, 0, { draggedNodeType: 'input' }),
    ).toBe(false)
  })

  it('accepts a synthetic form-only leaf dragged into a form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, null, FORM_B_PATH, 1, { draggedNodeType: 'input' })).toBe(true)
  })

  it('ignores options.draggedNodeType when a real draggedPath is also provided', () => {
    // A real `input` (form-only) dragged into a formless container is rejected on its own
    // merits, the same as the non-palette case above — draggedNodeType would have to name a
    // type that resolves differently for this to prove priority, so this only re-confirms the
    // real path is what gets inspected, never the (here mismatched and ignored) declared type.
    expect(
      isValidDropTarget(PAGE_LAYOUT, INPUT_A_PATH, CONTAINER_NO_FORM_PATH, 0, { draggedNodeType: 'heading' }),
    ).toBe(false)
  })
})

describe('isValidDropTarget: palette-originated drag (T15, additional cases)', () => {
  it('rejects a synthetic button without action dragged to the root layout, outside any form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, null, [], 0, { draggedNodeType: 'button' })).toBe(false)
  })

  it('accepts a synthetic button without action dragged into a form', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, null, FORM_A_PATH, 2, { draggedNodeType: 'button' })).toBe(true)
  })

  it('accepts a synthetic heading dragged into a tabs node with a valid targetTabItemIndex — draggedNodeType and targetTabItemIndex compose within the same options object', () => {
    expect(
      isValidDropTarget(PAGE_LAYOUT, null, TABS_NO_FORM_PATH, 0, {
        draggedNodeType: 'heading',
        targetTabItemIndex: 0,
      }),
    ).toBe(true)
  })

  it('accepts a synthetic container dragged to the root layout ([]) — draggedPath: null with targetParentPath: [] does not trigger the step-9 cycle check', () => {
    expect(isValidDropTarget(PAGE_LAYOUT, null, [], 0, { draggedNodeType: 'container' })).toBe(true)
  })
})
