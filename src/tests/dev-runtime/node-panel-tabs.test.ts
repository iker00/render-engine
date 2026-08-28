import { describe, expect, it } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { resolveNodePanelTabs } from '../../dev-runtime/layout-canvas/node-panel-tabs'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

// Fixture builders mirror the convention established in
// layout-canvas-ancestor-container-columns.test.ts: small helpers returning `LayoutNode`, with
// `as LayoutNode` casts where the node type isn't inferable from a bare literal.

function containerWithColumns(columns: number | Record<string, number>, children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', props: { columns }, children } as LayoutNode
}

function container(children: LayoutNode[] = []): LayoutNode {
  return { type: 'container', children }
}

function statNode(): LayoutNode {
  return { type: 'stat' } as LayoutNode
}

function hiddenNode(): LayoutNode {
  return { type: 'hidden' } as LayoutNode
}

function formNode(): LayoutNode {
  return { type: 'form', id: 'f1' } as LayoutNode
}

describe('resolveNodePanelTabs', () => {
  it('returns all four tabs in fixed order with literal labels when the schema declares props/visibility/queryStateFeedback and a container ancestor with columns resolves', () => {
    const pageLayout: LayoutNode[] = [containerWithColumns(3, [statNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveNodePanelTabs(statNode(), { pageLayout, path })).toEqual([
      { key: 'props', label: 'Props' },
      { key: 'layout', label: 'Diseño' },
      { key: 'visibility', label: 'Visibilidad' },
      { key: 'queryStateFeedback', label: 'Queries' },
    ])
  })

  it('omits Diseño (keeping relative order of the rest) when pageLayout has no container ancestor with columns', () => {
    const pageLayout: LayoutNode[] = [container([statNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    expect(resolveNodePanelTabs(statNode(), { pageLayout, path })).toEqual([
      { key: 'props', label: 'Props' },
      { key: 'visibility', label: 'Visibilidad' },
      { key: 'queryStateFeedback', label: 'Queries' },
    ])
  })

  it('never includes Diseño when context has no pageLayout (Shell case)', () => {
    expect(resolveNodePanelTabs(statNode(), { path: [] })).toEqual([
      { key: 'props', label: 'Props' },
      { key: 'visibility', label: 'Visibilidad' },
      { key: 'queryStateFeedback', label: 'Queries' },
    ])
  })

  it('returns exactly the Props tab for a hidden node, whose schema declares neither layout, visibility nor queryStateFeedback', () => {
    expect(resolveNodePanelTabs(hiddenNode(), { path: [] })).toEqual([{ key: 'props', label: 'Props' }])
  })

  // T5 (0133): `formNodeSchema` declares no `props` key of its own, only `submitAction` — the
  // "Props" tab still needs to exist for `form` so the panel's "Acción de envío" block (which now
  // renders at the top of that tabpanel, see `layout-canvas-properties-panel.tsx`) has somewhere
  // to mount.
  it('includes Props for a form node even though its schema declares no props key, because it declares submitAction', () => {
    expect(resolveNodePanelTabs(formNode(), { path: [] })).toEqual([
      { key: 'props', label: 'Props' },
      { key: 'visibility', label: 'Visibilidad' },
      { key: 'queryStateFeedback', label: 'Queries' },
    ])
  })

  it('does not mutate node, pageLayout or path', () => {
    const node = statNode()
    const pageLayout: LayoutNode[] = [containerWithColumns(3, [statNode()])]
    const path: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]
    const nodeSnapshot = JSON.parse(JSON.stringify(node))
    const pageLayoutSnapshot = JSON.parse(JSON.stringify(pageLayout))
    const pathSnapshot = JSON.parse(JSON.stringify(path))

    resolveNodePanelTabs(node, { pageLayout, path })

    expect(node).toEqual(nodeSnapshot)
    expect(pageLayout).toEqual(pageLayoutSnapshot)
    expect(path).toEqual(pathSnapshot)
  })
})
