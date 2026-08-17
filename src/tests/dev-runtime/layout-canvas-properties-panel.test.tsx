import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { commitLayoutSpan } from '../../dev-runtime/layout-canvas/commit-layout-span'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { LayoutCanvasPropertiesPanel } from '../../dev-runtime/layout-canvas/layout-canvas-properties-panel'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'

// The `icon` widget (T2, 0129) mounts the real `IconPickerPropertyField` for every node type whose
// generated `props` schema declares `icon` (heading among them, used pervasively by this file's own
// fixtures). Without this mock every such render — including tests unrelated to icons — walks the
// real ~3900-icon `lucide-react` namespace and blows the global Vitest timeout (same failure mode
// documented in T1). `OTHER_MODULE_ICON_NAMES` covers every other icon name imported anywhere in
// the `DevRuntimeReady` render tree this file also mounts further down (floating toolbar, shell
// config panel, container-columns/tabs-orientation widgets) — ESM named imports resolve those
// bindings at module-load time regardless of which of them actually renders in a given test.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

// Mock @monaco-editor/react with a controllable textarea, matching the pattern
// already established in dev-runtime.test.tsx / layout-canvas-commit.test.tsx.
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange, onMount }) => {
    if (onMount) {
      onMount(
        { getValue: () => value as string },
        { languages: { json: { jsonDefaults: { setDiagnosticsOptions: vi.fn() } } } },
      )
    }
    return (
      <textarea
        data-testid="monaco-editor-mock"
        value={value as string}
        onChange={(e) => (onChange as (v: string) => void)?.(e.target.value)}
      />
    )
  }),
}))

const somePath: LayoutNodePath = [{ field: 'children', index: 0 }]

function headingNode(overrides: Partial<Extract<LayoutNode, { type: 'heading' }>['props']> = {}): LayoutNode {
  return { type: 'heading', props: { text: 'Hello', level: 2, ...overrides } }
}

function containerWithVisibilityFixture(): LayoutNode {
  return {
    type: 'container',
    props: { direction: 'row' },
    visibility: { reference: 'queries.list.state', operator: 'equals', value: 'ready' },
  } as LayoutNode
}

const otherPathFixture: LayoutNodePath = [{ field: 'children', index: 1 }]

describe('LayoutCanvasPropertiesPanel props section', () => {
  it('shows an editable field for props.text on a heading node, seeded with its current value', () => {
    const node = headingNode({ text: 'Hello' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('text', { exact: false })).toHaveValue('Hello')
  })

  it('does not render a field for a prop the node type does not declare (e.g. button-only "action" on a heading)', () => {
    const node = headingNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByLabelText('action')).not.toBeInTheDocument()
  })

  it('changing props.text invokes onCommitNodeUpdate with an updater that changes only that field', () => {
    const node = headingNode({ text: 'Hello', icon: 'star' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('text', { exact: false }), { target: { value: 'Updated' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    expect(updater(node)).toEqual(headingNode({ text: 'Updated', icon: 'star' }))
  })
})

// T3 (0133): the panel now owns its own header — breadcrumb, node-type title, and icon-only
// delete/close buttons — instead of `FloatingSelectionOverlay` rendering a separate "Selección"
// bar above the (previously standalone-mounted) breadcrumb. `onDeleteNode`/`onClose`/
// `onSelectAncestor`/`pageLayout` stay independently optional, same contract as the rest of the
// panel's optional callbacks.
describe('LayoutCanvasPropertiesPanel header', () => {
  it('shows the node type as the highlighted title, regardless of onDeleteNode/onClose', () => {
    const node = headingNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByText('heading')).toBeInTheDocument()
  })

  it('renders the delete button with an explicit accessible name only when onDeleteNode is passed, invoking it on click', () => {
    const node = headingNode()
    const onDeleteNode = vi.fn()
    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByTestId('layout-canvas-delete-node-button')).not.toBeInTheDocument()

    rerender(
      <LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} onDeleteNode={onDeleteNode} />,
    )
    const deleteButton = screen.getByTestId('layout-canvas-delete-node-button')
    expect(deleteButton).toHaveAccessibleName('Eliminar nodo')

    fireEvent.click(deleteButton)
    expect(onDeleteNode).toHaveBeenCalledTimes(1)
  })

  it('renders the close button with its own data-testid and accessible name only when onClose is passed, invoking it on click', () => {
    const node = headingNode()
    const onClose = vi.fn()
    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByTestId('dev-editor-selection-overlay-close')).not.toBeInTheDocument()

    rerender(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} onClose={onClose} />)
    const closeButton = screen.getByTestId('dev-editor-selection-overlay-close')
    expect(closeButton).toHaveAccessibleName('Cerrar panel de selección')

    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the breadcrumb only when pageLayout is passed, invoking onSelectAncestor with the ancestor path on click', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 } }
    const pageLayout: LayoutNode[] = [{ type: 'container', props: {}, children: [node] }]
    const nestedPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]
    const onSelectAncestor = vi.fn()

    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={nestedPath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByTestId('layout-canvas-breadcrumb')).not.toBeInTheDocument()

    rerender(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={nestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={() => {}}
        onSelectAncestor={onSelectAncestor}
      />,
    )
    expect(screen.getByTestId('layout-canvas-breadcrumb')).toBeInTheDocument()

    fireEvent.click(screen.getByText('container'))

    expect(onSelectAncestor).toHaveBeenCalledTimes(1)
    expect(onSelectAncestor).toHaveBeenCalledWith([{ field: 'children', index: 0 }])
  })
})

// T3 (0133), FR4/FR5, criterion 5: a read-only identity row under the header showing the node's
// `id` (or a placeholder when it has none), made of non-focusable elements only.
describe('LayoutCanvasPropertiesPanel identity row', () => {
  it('shows the node id when the node declares one', () => {
    const node: LayoutNode = { type: 'form', id: 'checkout', children: [] }
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('checkout')).toBeInTheDocument()
  })

  it('shows the "Sin id" placeholder when the node has no id, with no focusable field element in the row', () => {
    const node = headingNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const idRow = screen.getByTestId('layout-canvas-properties-panel-id-row')
    expect(within(idRow).getByText('Sin id')).toBeInTheDocument()
    expect(within(idRow).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(idRow).queryByRole('button')).not.toBeInTheDocument()
  })
})

// T4 (0133): the tab bar (T1's `resolveNodePanelTabs` + T2's `NodePanelTabBar`) integrated into
// the panel, replacing the previous vertical stack of subsections.
describe('LayoutCanvasPropertiesPanel tabs (T4, 0133)', () => {
  function containerWithColumns(columns: number, children: LayoutNode[] = []): LayoutNode {
    return { type: 'container', props: { columns }, children } as LayoutNode
  }

  function statNode(): LayoutNode {
    return { type: 'stat', props: { label: 'Total', value: '10' } } as LayoutNode
  }

  const nestedPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]

  // Criterion 1: all four tabs, Props active by default, only its tabpanel content in the DOM.
  it('renders Props/Diseño/Visibilidad/Queries for a stat node inside a container with columns, Props active with only its content mounted', () => {
    const node = statNode()
    const pageLayout: LayoutNode[] = [containerWithColumns(4, [node])]
    render(<LayoutCanvasPropertiesPanel node={node} path={nestedPath} pageLayout={pageLayout} onCommitNodeUpdate={() => {}} />)

    const tablist = screen.getByRole('tablist')
    const tabNames = within(tablist)
      .getAllByRole('tab')
      .map((tab) => tab.textContent)
    expect(tabNames).toEqual(['Props', 'Diseño', 'Visibilidad', 'Queries'])

    const propsTab = screen.getByRole('tab', { name: 'Props' })
    expect(propsTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Diseño' })).toHaveAttribute('aria-selected', 'false')

    // Only the active tab's content is in the DOM — not merely hidden.
    expect(screen.getByLabelText('label', { exact: false })).toBeInTheDocument()
    expect(screen.queryByLabelText('Visibilidad — Referencia')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-span-widget')).not.toBeInTheDocument()
  })

  // Criterion 2: same node type, no container ancestor with columns — Diseño is absent, the
  // other three remain.
  it('omits the Diseño tab (leaving the other three) for the same node type with no container ancestor with columns', () => {
    const node = statNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const tablist = screen.getByRole('tablist')
    const tabNames = within(tablist)
      .getAllByRole('tab')
      .map((tab) => tab.textContent)
    expect(tabNames).toEqual(['Props', 'Visibilidad', 'Queries'])
  })

  // Criterion 3: `hidden` has no `layout`/`visibility`/`queryStateFeedback` in its schema — only
  // Props exists, active.
  it('renders only the Props tab, active, for a hidden node', () => {
    const node: LayoutNode = { type: 'hidden', props: { fieldId: 'f1', value: 'x' } } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const tablist = screen.getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toHaveTextContent('Props')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  // Criterion 4 / FR3: switching the selected node resets the active tab to the new node's first
  // available tab, even if a non-default tab was active for the previous node.
  it('resets the active tab to the new node\'s first available tab when the selected node changes', () => {
    const node = containerWithVisibilityFixture()
    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.getByRole('tab', { name: 'Visibilidad' })).toHaveAttribute('aria-selected', 'true')

    const otherNode: LayoutNode = { type: 'heading', props: { text: 'Otro', level: 2 } }
    rerender(<LayoutCanvasPropertiesPanel node={otherNode} path={otherPathFixture} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByRole('tab', { name: 'Props' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('text', { exact: false })).toBeInTheDocument()
  })

  // FR9: ARIA tablist/tab/tabpanel wiring, plus left/right arrow keys moving the active tab.
  it('wires role=tablist/tab/tabpanel with aria-selected/aria-labelledby, and ArrowRight/ArrowLeft move the active tab', () => {
    const node = statNode()
    const pageLayout: LayoutNode[] = [containerWithColumns(4, [node])]
    render(<LayoutCanvasPropertiesPanel node={node} path={nestedPath} pageLayout={pageLayout} onCommitNodeUpdate={() => {}} />)

    const propsTab = screen.getByRole('tab', { name: 'Props' })
    const tabpanel = screen.getByRole('tabpanel')
    expect(tabpanel).toHaveAttribute('aria-labelledby', propsTab.id)
    expect(propsTab).toHaveAttribute('aria-controls', tabpanel.id)

    propsTab.focus()
    fireEvent.keyDown(propsTab, { key: 'ArrowRight' })

    const designTab = screen.getByRole('tab', { name: 'Diseño' })
    expect(designTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', designTab.id)
  })

  // FR6: the tab's own content doesn't repeat the tab label as a visible heading — the dispatcher's
  // root `legend` is `sr-only` for Props/Diseño/Queries, and forwarded to the Visibilidad widget.
  it('hides the repeated subsection legend (sr-only) for every tab, without changing nested accessible names', () => {
    const node = containerWithVisibilityFixture()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const propsLegend = screen.getByText('Props', { selector: 'legend' })
    expect(propsLegend).toHaveClass('sr-only')

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    const visibilityLegend = screen.getByText('Visibilidad', { selector: 'legend' })
    expect(visibilityLegend).toHaveClass('sr-only')
    // Nested accessible names derived from `label` are unchanged.
    expect(screen.getByRole('radiogroup', { name: 'Visibilidad — Forma' })).toBeInTheDocument()
  })

  // Edge case: deleting the selected node while a non-Props tab is active closes the panel
  // without errors.
  it('deletes the node cleanly while a non-Props tab is active', () => {
    const node = containerWithVisibilityFixture()
    const onDeleteNode = vi.fn()
    const { rerender } = render(
      <LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} onDeleteNode={onDeleteNode} />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    fireEvent.click(screen.getByTestId('layout-canvas-delete-node-button'))
    expect(onDeleteNode).toHaveBeenCalledTimes(1)

    // Simulates the parent unmounting the panel after the delete, as `FloatingSelectionOverlay`
    // does when the selection clears — must not throw.
    rerender(<></>)
  })
})

describe('LayoutCanvasPropertiesPanel visibility section', () => {
  function containerWithVisibility(): LayoutNode {
    return {
      type: 'container',
      props: { direction: 'row' },
      visibility: { reference: 'queries.list.state', operator: 'equals', value: 'ready' },
    } as LayoutNode
  }

  // T3 (0132): `visibility` now mounts `ConditionGroupPropertyField` (via the `x-widget:
  // 'condition-group'` sentinel `injectConditionGroupWidgetSentinel` injects onto the node schema,
  // T1/T3) instead of the previous generic object/union rendering — the widget consumes the whole
  // subsection, so there is no separate generic field labelled plainly "reference" any more.
  it('changing a visibility field through the widget updates only node.visibility, leaving props untouched', () => {
    const node = containerWithVisibility()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    // Regression: no generic TextPropertyField labelled plainly "reference" renders on its own —
    // the widget's own row exposes it as "Visibilidad — Referencia" instead.
    expect(screen.queryByLabelText('reference', { exact: true })).not.toBeInTheDocument()

    const referenceField = screen.getByLabelText('Visibilidad — Referencia')
    fireEvent.change(referenceField, { target: { value: 'queries.list.otherState' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'container' }>

    expect(result.props).toEqual((node as Extract<LayoutNode, { type: 'container' }>).props)
    expect(result.visibility).toEqual({
      reference: 'queries.list.otherState',
      operator: 'equals',
      value: 'ready',
    })
  })

  // Regression (T4/T3): `visibility` is a union at the subsection's own top-level `schema` (single
  // condition | group). The panel's own `resolveUnionBranch` call still runs before the
  // dispatcher, but now that `visibility`'s schema is the `x-widget` sentinel (no `oneOf` any
  // more), it passes through unchanged — group-vs-condition detection moves entirely into the
  // widget itself (T2), keyed off the runtime shape of `value`. Two conditions here (not one) so
  // the "two rows" behavior is actually exercised.
  it('renders the group branch of visibility in group mode with two rows, not the single-condition branch, when the current value is a group', () => {
    const node: LayoutNode = {
      type: 'container',
      props: { direction: 'row' },
      visibility: {
        operator: 'and',
        conditions: [
          { reference: 'queries.list.state', operator: 'equals', value: 'ready' },
          { reference: 'queries.list.other', operator: 'notEquals', value: 'pending' },
        ],
      },
    } as LayoutNode
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    const shapeSelector = screen.getByRole('radiogroup', { name: 'Visibilidad — Forma' })
    expect(within(shapeSelector).getByRole('radio', { name: 'Grupo (y/o)' })).toHaveAttribute('aria-checked', 'true')

    const firstRow = screen.getByRole('group', { name: 'Visibilidad — Condición 1' })
    const secondRow = screen.getByRole('group', { name: 'Visibilidad — Condición 2' })
    expect(within(firstRow).getByLabelText('Visibilidad — Condición 1 — Referencia')).toHaveValue('queries.list.state')
    expect(within(secondRow).getByLabelText('Visibilidad — Condición 2 — Referencia')).toHaveValue('queries.list.other')

    fireEvent.change(within(firstRow).getByLabelText('Visibilidad — Condición 1 — Referencia'), {
      target: { value: 'queries.list.otherState' },
    })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'container' }>
    expect(result.visibility).toEqual({
      operator: 'and',
      conditions: [
        { reference: 'queries.list.otherState', operator: 'equals', value: 'ready' },
        { reference: 'queries.list.other', operator: 'notEquals', value: 'pending' },
      ],
    })
  })

  // Regression (spec, casos límite): a node with no `visibility` declared at all still renders the
  // subsection, with the widget starting in its minimal default state (simple condition, empty
  // reference) — the widget must not require pre-existing data to mount.
  it('renders the widget in its default minimal state when the node has no visibility declared', () => {
    const node: LayoutNode = { type: 'container', props: { direction: 'row' } } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    const shapeSelector = screen.getByRole('radiogroup', { name: 'Visibilidad — Forma' })
    expect(within(shapeSelector).getByRole('radio', { name: 'Condición simple' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Visibilidad — Referencia')).toHaveValue('')
  })
})

describe('LayoutCanvasPropertiesPanel condition-group widget for executeOperations.operations[].when in Props (T3, 0132)', () => {
  function buttonNode(action: Record<string, unknown>): LayoutNode {
    return { type: 'button', props: { label: 'Enviar', action } } as LayoutNode
  }

  it('renders the widget for operations[0].when inside the Props subsection, leaving operationName editable with the generic control', () => {
    const node = buttonNode({
      type: 'executeOperations',
      operations: [{ operationName: 'save', when: { reference: 'forms.f1.urgent', operator: 'equals', value: 'yes' } }],
    })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const operationsGroup = screen.getByRole('group', { name: 'operations' })
    const entryGroup = within(operationsGroup).getByRole('group', { name: 'operations #1' })

    // operationName keeps using the generic text control, unaffected by the widget swap.
    expect(within(entryGroup).getByLabelText('operationName', { exact: false })).toHaveValue('save')

    const whenReferenceField = within(entryGroup).getByLabelText('when — Referencia')
    expect(whenReferenceField).toHaveValue('forms.f1.urgent')

    fireEvent.change(whenReferenceField, { target: { value: 'forms.f1.otherField' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'button' }>
    expect(result.props.action).toEqual({
      type: 'executeOperations',
      operations: [{ operationName: 'save', when: { reference: 'forms.f1.otherField', operator: 'equals', value: 'yes' } }],
    })
  })
})

// T2 (0127): `layout.span` is no longer editable through the generic dispatcher. The whole
// `Layout` subsection only exists when the selected node sits inside a `container` ancestor with
// `columns` declared (resolved via `resolveAncestorContainerColumns`, T1) and the caller passes
// `pageLayout`. When it applies, `properties.span` is swapped for the `x-widget: 'layout-span'`
// sentinel and rendered by `LayoutSpanPropertyField` (registered in `WIDGET_REGISTRY['layout-span']`)
// instead of the generic numeric/responsive-map field. T3 (0127) replaced the wiring-only stub
// with the real six-row widget; the two tests below that used to inspect the stub's raw
// `data-parent-columns`/`data-span-value` attributes now assert the equivalent behavior on the
// real rendered rows — see `layout-canvas-property-field-layout-span.test.tsx` for the widget's
// own dedicated coverage.
describe('LayoutCanvasPropertiesPanel layout subsection visibility', () => {
  function containerWithColumns(columns: number | Record<string, number>, children: LayoutNode[] = []): LayoutNode {
    return { type: 'container', props: { columns }, children } as LayoutNode
  }

  function plainContainer(children: LayoutNode[] = []): LayoutNode {
    return { type: 'container', children } as LayoutNode
  }

  const nestedPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]

  it('renders the layout-span widget (not the generic numeric span input) when the node sits inside a container ancestor with columns, given pageLayout', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 }, layout: { span: 2 } } as LayoutNode
    const pageLayout: LayoutNode[] = [containerWithColumns(4, [node])]

    render(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={nestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    expect(screen.getByTestId('layout-span-widget')).toBeInTheDocument()
    expect(screen.queryByLabelText('span', { exact: false })).not.toBeInTheDocument()
  })

  it('does not render the Layout subsection at all when pageLayout is not passed', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 }, layout: { span: 2 } } as LayoutNode

    render(<LayoutCanvasPropertiesPanel node={node} path={nestedPath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByTestId('layout-span-widget')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('span', { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Diseño' })).not.toBeInTheDocument()
  })

  it('does not render the Layout subsection at all when pageLayout has no container ancestor with columns declared', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 }, layout: { span: 2 } } as LayoutNode
    const pageLayout: LayoutNode[] = [plainContainer([node])]

    render(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={nestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={() => {}}
      />,
    )

    expect(screen.queryByTestId('layout-span-widget')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('span', { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Diseño' })).not.toBeInTheDocument()
  })

  it('gives the widget the columns of the nearest container ancestor, not the outermost one, when nested', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 } } as LayoutNode
    const pageLayout: LayoutNode[] = [containerWithColumns(2, [containerWithColumns(6, [node])])]
    const deepPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
      { field: 'children', index: 0 },
    ]

    render(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={deepPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    // T3 (0127): the real widget resolves the denominator ("/ N") of every row from
    // `parentColumns` via `normalizeResponsiveLayoutValue` — an integer `6` cascades to `/ 6` on
    // every breakpoint, so checking the `base` row's denominator is equivalent to (and more
    // behavior-focused than) the removed stub's raw `data-parent-columns` attribute.
    const baseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(baseRow).getByText('/ 6')).toBeInTheDocument()
  })

  it('exposes spanValue equal to node.layout?.span in the current render via the widget', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 }, layout: { span: { base: 2 } } } as LayoutNode
    const pageLayout: LayoutNode[] = [containerWithColumns(4, [node])]

    render(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={nestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    // T3 (0127): with `spanValue = { base: 2 }`, the `base` row is explicit at `2` (and shows
    // "Quitar"); the rest cascade from it as inherited `2`s. Checking the `base` row's own value
    // and explicitness is the real-widget equivalent of the removed stub's raw
    // `data-span-value` attribute.
    const baseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(baseRow).getByLabelText('base')).toHaveValue(2)
    expect(baseRow).toHaveAttribute('data-explicit', 'true')
  })
})

// T6 (0133), FR7: the panel now hosts the `layout-span` widget's per-row commit-rejection state
// (`layoutSpanRowRejections` in `LayoutCanvasPropertiesPanel`) instead of the widget keeping it in
// local `useState` — a rejected row and its typed value must survive switching to another tab and
// back, and still clear when the selected node changes (same guard as `pendingRejections`).
describe('LayoutCanvasPropertiesPanel layout.span row rejection persistence across tabs (T6, 0133)', () => {
  function containerWithColumns(columns: number, children: LayoutNode[] = []): LayoutNode {
    return { type: 'container', props: { columns }, children } as LayoutNode
  }

  const nestedPath: LayoutNodePath = [
    { field: 'children', index: 0 },
    { field: 'children', index: 0 },
  ]

  const rejectedSpanResult: CommitCanvasMutationResult = {
    status: 'rejected',
    error: { code: 'invalid-layout', message: 'span fuera de rango', displayMode: 'always' },
  }

  it('keeps the row alert and typed value on the base row after switching to Props and back to Diseño', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 } } as LayoutNode
    const pageLayout: LayoutNode[] = [containerWithColumns(6, [node])]
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejectedSpanResult)

    render(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={nestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={onCommitNodeUpdate}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    fireEvent.change(within(screen.getByTestId('layout-span-widget-row-base')).getByLabelText('base'), {
      target: { value: '9' },
    })
    expect(within(screen.getByTestId('layout-span-widget-row-base')).getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Props' }))
    expect(screen.queryByTestId('layout-span-widget')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))
    const baseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(baseRow).getByLabelText('base')).toHaveValue(9)
    expect(within(baseRow).getByRole('alert')).toBeInTheDocument()
  })

  it('clears the row alert when the selected node changes, the same guard pendingRejections already uses', () => {
    const node: LayoutNode = { type: 'heading', props: { text: 'Hi', level: 2 } } as LayoutNode
    const otherNode: LayoutNode = { type: 'heading', props: { text: 'Other', level: 2 } } as LayoutNode
    const pageLayout: LayoutNode[] = [containerWithColumns(6, [node, otherNode])]
    const otherNestedPath: LayoutNodePath = [
      { field: 'children', index: 0 },
      { field: 'children', index: 1 },
    ]
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejectedSpanResult)

    const { rerender } = render(
      <LayoutCanvasPropertiesPanel
        node={node}
        path={nestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={onCommitNodeUpdate}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))
    fireEvent.change(within(screen.getByTestId('layout-span-widget-row-base')).getByLabelText('base'), {
      target: { value: '9' },
    })
    expect(within(screen.getByTestId('layout-span-widget-row-base')).getByRole('alert')).toBeInTheDocument()

    rerender(
      <LayoutCanvasPropertiesPanel
        node={otherNode}
        path={otherNestedPath}
        pageLayout={pageLayout}
        onCommitNodeUpdate={onCommitNodeUpdate}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    const baseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(baseRow).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(baseRow).getByLabelText('base')).toHaveValue(1)
  })
})

// T2 (0127): `commitSpan`, exposed via `LayoutSpanWidgetContext`, is built by `commitLayoutSpan` —
// exported so its commit contract can be tested directly without mounting the widget stub (T3
// gives the widget its real rows/edition; this task only wires the context and the commit path).
describe('commitLayoutSpan (T2, 0127)', () => {
  it('calls onCommitNodeUpdate with the given path and an updater that sets layout.span to nextSpan while preserving other layout keys', () => {
    const onCommitNodeUpdate = vi.fn()

    commitLayoutSpan(onCommitNodeUpdate, somePath, { base: 4 })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)

    const node: LayoutNode = {
      type: 'container',
      layout: { span: { base: 2 }, extraKey: 'keep-me' },
    } as unknown as LayoutNode
    const result = updater(node) as Extract<LayoutNode, { type: 'container' }>
    expect(result.layout).toEqual({ span: { base: 4 }, extraKey: 'keep-me' })
  })

  it('propagates the rejected CommitCanvasMutationResult returned by onCommitNodeUpdate as-is', () => {
    const rejected = { status: 'rejected' as const, error: { code: 'invalid-layout', message: 'nope', displayMode: 'always' as const } }
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejected)

    const result = commitLayoutSpan(onCommitNodeUpdate, somePath, 4)

    expect(result).toBe(rejected)
  })

  it('returns undefined when onCommitNodeUpdate returns nothing (plain vi.fn() double)', () => {
    const onCommitNodeUpdate = vi.fn()

    const result = commitLayoutSpan(onCommitNodeUpdate, somePath, 4)

    expect(result).toBeUndefined()
  })
})

describe('LayoutCanvasPropertiesPanel tabs node props.items (RF2, 0105)', () => {
  function tabsNode(items: Array<{ label: string; children?: LayoutNode[] }>): LayoutNode {
    return { type: 'tabs', props: { items } } as LayoutNode
  }

  it('renders the items array editor exposing only label and visibility, never a "children" field', () => {
    const node = tabsNode([{ label: 'Uno', children: [{ type: 'heading', props: { text: 'Hi', level: 2 } }] }])
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('label', { exact: false })).toHaveValue('Uno')
    expect(screen.queryByLabelText('children', { exact: false })).not.toBeInTheDocument()
  })

  it('clicking "Añadir" on props.items commits a new last item with the default non-empty label', () => {
    const node = tabsNode([{ label: 'Uno' }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir items' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = updater(node) as Extract<LayoutNode, { type: 'tabs' }>
    expect(result.props.items).toEqual([{ label: 'Uno' }, { label: 'Nueva pestaña' }])
  })

  it('with a single item, "Quitar" is unavailable and does not commit anything', () => {
    const node = tabsNode([{ label: 'Uno' }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const removeButton = screen.getByRole('button', { name: 'Quitar items #1' })
    expect(removeButton).toBeDisabled()

    fireEvent.click(removeButton)
    expect(onCommitNodeUpdate).not.toHaveBeenCalled()
  })

  it('with two items, "Quitar" on the first commits a single remaining item, keeping the second one', () => {
    const node = tabsNode([{ label: 'Uno' }, { label: 'Dos' }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar items #1' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'tabs' }>
    expect(result.props.items).toEqual([{ label: 'Dos' }])
  })
})

describe('LayoutCanvasPropertiesPanel regression: array without minItems on a non-tabs node', () => {
  function tableNode(headers: string[]): LayoutNode {
    return { type: 'table', props: { headers, rows: [] } } as LayoutNode
  }

  it('keeps "Quitar" available even down to a single remaining header (no minItems restriction)', () => {
    const node = tableNode(['Nombre'])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const removeButton = screen.getByRole('button', { name: 'Quitar headers #1' })
    expect(removeButton).not.toBeDisabled()

    fireEvent.click(removeButton)
    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'table' }>
    expect(result.props.headers).toEqual([])
  })

  it('"Añadir" still appends an empty-string default for a plain string array', () => {
    const node = tableNode(['Nombre'])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir headers' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'table' }>
    expect(result.props.headers).toEqual(['Nombre', ''])
  })
})

describe('LayoutCanvasPropertiesPanel choice-items widget for select/radioGroup/checkboxGroup (T5, 0108)', () => {
  function selectNode(items: unknown = [{ label: 'Uno', value: 'uno' }]): LayoutNode {
    return { type: 'select', props: { fieldId: 'choice', label: 'Elige', items } } as LayoutNode
  }

  function radioGroupNode(items: unknown = [{ label: 'Uno', value: 'uno' }]): LayoutNode {
    return { type: 'radioGroup', props: { fieldId: 'choice', label: 'Elige', items } } as LayoutNode
  }

  function checkboxGroupNode(items: unknown = [{ label: 'Uno', value: 'uno' }]): LayoutNode {
    return { type: 'checkboxGroup', props: { fieldId: 'choice', label: 'Elige', items } } as LayoutNode
  }

  it.each([
    ['select', selectNode],
    ['radioGroup', radioGroupNode],
    ['checkboxGroup', checkboxGroupNode],
  ])('renders the widget mode selector for props.items on a %s node, not the read-only raw-JSON escape hatch', (_type, buildNode) => {
    render(<LayoutCanvasPropertiesPanel node={buildNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const itemsGroup = screen.getByRole('group', { name: 'items' })
    const modeSelect = within(itemsGroup).getByRole('combobox') as HTMLSelectElement
    expect(Array.from(modeSelect.options).map((option) => option.value)).toEqual(['manualLiteral', 'manualScalar', 'dynamic'])
    // No disabled raw-JSON `<textarea>` fallback anywhere inside the items widget.
    expect(itemsGroup.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('editing a manual literal item commits props.items as a flat array of {label, value}', () => {
    const node = selectNode([{ label: 'Uno', value: 'uno' }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const itemsGroup = screen.getByRole('group', { name: 'items' })
    const itemGroup = within(itemsGroup).getByRole('group', { name: 'items #1' })
    fireEvent.change(within(itemGroup).getByLabelText('label', { exact: false }), { target: { value: 'Cambiado' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = updater(node) as Extract<LayoutNode, { type: 'select' }>
    expect(result.props.items).toEqual([{ label: 'Cambiado', value: 'uno' }])
  })

  it('switching the mode to manualScalar commits props.items as { values: [] }', () => {
    const node = selectNode([{ label: 'Uno', value: 'uno' }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const itemsGroup = screen.getByRole('group', { name: 'items' })
    const modeSelect = within(itemsGroup).getByRole('combobox') as HTMLSelectElement
    fireEvent.change(modeSelect, { target: { value: 'manualScalar' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'select' }>
    expect(result.props.items).toEqual({ values: [] })
  })

  it('switching the mode to dynamic seeds { source: "", itemType: "scalar" }; editing source and switching itemType to object adds label/value', () => {
    const node = selectNode([{ label: 'Uno', value: 'uno' }])
    const onCommitNodeUpdate = vi.fn()
    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const modeSelect = within(screen.getByRole('group', { name: 'items' })).getByRole('combobox') as HTMLSelectElement
    fireEvent.change(modeSelect, { target: { value: 'dynamic' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, seedUpdater] = onCommitNodeUpdate.mock.calls[0]
    const afterDynamic = seedUpdater(node) as Extract<LayoutNode, { type: 'select' }>
    expect(afterDynamic.props.items).toEqual({ source: '', itemType: 'scalar' })

    onCommitNodeUpdate.mockClear()
    rerender(<LayoutCanvasPropertiesPanel node={afterDynamic} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const sourceField = within(screen.getByRole('group', { name: 'items' })).getByLabelText('source', { exact: false })
    fireEvent.change(sourceField, { target: { value: 'queries.list.items' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, sourceUpdater] = onCommitNodeUpdate.mock.calls[0]
    const afterSource = sourceUpdater(afterDynamic) as Extract<LayoutNode, { type: 'select' }>
    expect(afterSource.props.items).toEqual({ source: 'queries.list.items', itemType: 'scalar' })

    onCommitNodeUpdate.mockClear()
    rerender(<LayoutCanvasPropertiesPanel node={afterSource} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const itemTypeSelect = within(screen.getByRole('group', { name: 'items' })).getByLabelText('itemType', { exact: false })
    fireEvent.change(itemTypeSelect, { target: { value: 'object' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, itemTypeUpdater] = onCommitNodeUpdate.mock.calls[0]
    const afterObject = itemTypeUpdater(afterSource) as Extract<LayoutNode, { type: 'select' }>
    expect(afterObject.props.items).toEqual({ source: 'queries.list.items', itemType: 'object', label: '', value: '' })
  })

  // Structural regression on `resolveChoiceLikePropsSchema`: the dynamic shape's own
  // `{ source, itemType: 'object', label, value }` variant is nested one level inside the
  // generated `oneOf` for the third `selectItemsSchema` union branch, which itself has no
  // top-level `type` for `resolveUnionBranch`'s generic by-shape matching to key off. Before the
  // `items` sub-schema is swapped for the `x-widget` sentinel, that generic resolution
  // mis-resolves a dynamic-object value to the *manual scalar* branch (the only branch whose
  // `type` is literally `'object'`) instead of the dynamic widget fields. Asserting the dynamic
  // fields render correctly for this exact value shape is a direct regression check that no
  // `oneOf`/`anyOf` is left for the generic dispatcher to (mis)resolve.
  it('renders the dynamic object-shape fields (not the manual-scalar "values" editor) when props.items is already a dynamic object value', () => {
    const node = radioGroupNode({ source: 'queries.list.items', itemType: 'object', label: 'name', value: 'id' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const itemsGroup = screen.getByRole('group', { name: 'items' })
    expect((within(itemsGroup).getByLabelText('source', { exact: false }) as HTMLInputElement).value).toBe('queries.list.items')
    expect((within(itemsGroup).getByLabelText('itemType', { exact: false }) as HTMLSelectElement).value).toBe('object')
    expect((within(itemsGroup).getByLabelText('label', { exact: false }) as HTMLInputElement).value).toBe('name')
    expect((within(itemsGroup).getByLabelText('value', { exact: false }) as HTMLInputElement).value).toBe('id')
    expect(within(itemsGroup).queryByLabelText('values', { exact: false })).not.toBeInTheDocument()
  })

  it('a different node type (e.g. input) is unaffected: its props render as before, with no choice-items widget', () => {
    const node: LayoutNode = { type: 'input', props: { fieldId: 'name', label: 'Nombre' } } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('label', { exact: false })).toHaveValue('Nombre')
    expect(screen.queryByRole('group', { name: 'items' })).not.toBeInTheDocument()
  })
})

describe('LayoutCanvasPropertiesPanel discriminated union action selector (T5)', () => {
  function buttonNode(action?: Record<string, unknown>): LayoutNode {
    return { type: 'button', props: { label: 'Enviar', ...(action !== undefined ? { action } : {}) } } as LayoutNode
  }

  it('shows the "Sin acción" plus the 7 real action variants for a button node', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByLabelText('action') as HTMLSelectElement
    const optionTexts = Array.from(select.options).map((option) => option.textContent)
    expect(optionTexts).toEqual([
      'Sin acción',
      'Navegar a página',
      'Volver atrás',
      'Ejecutar operación',
      'Ejecutar operaciones',
      'Reiniciar formulario',
      'Abrir modal',
      'Cerrar modal',
    ])
  })

  it('editing pageId on an existing navigateTo action commits props.action with the correct shape', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('pageId', { exact: false }), { target: { value: 'about' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'button' }>
    expect(result.props.action).toEqual({ type: 'navigateTo', pageId: 'about' })
  })

  it('switching the action variant from navigateTo to resetForm drops the previous variant fields (no residual pageId)', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'resetForm' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'button' }>
    expect(result.props.action).toEqual({ type: 'resetForm', formId: '' })
  })

  it('choosing "Sin acción" on an existing action leaves props.action out of the committed node', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const select = screen.getByLabelText('action') as HTMLSelectElement
    const noActionOption = screen.getByRole('option', { name: 'Sin acción' }) as HTMLOptionElement
    fireEvent.change(select, { target: { value: noActionOption.value } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'button' }>
    expect(result.props.action).toBeUndefined()
    // T8: the committed object must not carry the key at all (`{ action: undefined }` would still
    // pass the assertion above but leaves a literal `"action": undefined` in the serialized JSON).
    expect(result.props).not.toHaveProperty('action')
    expect(result.props).toEqual({ label: 'Enviar' })
  })

  it('shows exactly the 2 link action variants plus "Sin acción" for a link node', () => {
    const node: LayoutNode = { type: 'link', props: {} } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByLabelText('action') as HTMLSelectElement
    const optionTexts = Array.from(select.options).map((option) => option.textContent)
    expect(optionTexts).toEqual(['Sin acción', 'Navegar a página', 'Volver atrás'])
  })
})

// T8: `stripUndefined` sanitizes each subsection commit recursively. These cases exercise it
// directly against `props` (rather than re-deriving the "Sin acción" case above) with `undefined`
// planted at a nested depth the union selector itself never reaches, and confirm valid falsy
// values are never mistaken for `undefined`.
describe('LayoutCanvasPropertiesPanel undefined sanitization on commit (T8)', () => {
  it('editing a shallow props field strips undefined nested two levels deep inside props.action, without touching valid falsy siblings', () => {
    const node: LayoutNode = {
      type: 'button',
      props: {
        label: 'Enviar',
        fullWidth: false,
        icon: '',
        action: {
          type: 'executeOperation',
          operationName: '',
          body: { count: 0, note: null, extra: undefined },
          headers: undefined,
        },
      },
    } as unknown as LayoutNode
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('label', { exact: false }), { target: { value: 'Nuevo texto' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'button' }>

    expect(result.props).toEqual({
      label: 'Nuevo texto',
      fullWidth: false,
      icon: '',
      action: {
        type: 'executeOperation',
        operationName: '',
        body: { count: 0, note: null },
      },
    })
    expect(result.props.action).not.toHaveProperty('headers')
    expect((result.props.action as Record<string, unknown>).body).not.toHaveProperty('extra')
  })
})

describe('LayoutCanvasPropertiesPanel body override for KV editor (T7)', () => {
  function buttonNode(action: Record<string, unknown>): LayoutNode {
    return { type: 'button', props: { label: 'Enviar', action } } as LayoutNode
  }

  it('renders body as an editable KV field for an executeOperation action, and adding a key + writing its value commits the object', () => {
    const node = buttonNode({ type: 'executeOperation', operationName: 'save', body: {} })
    const onCommitNodeUpdate = vi.fn()
    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const bodyGroup = screen.getByRole('group', { name: 'body' })
    fireEvent.click(within(bodyGroup).getByRole('button', { name: 'Añadir body' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, addUpdater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const afterAdd = addUpdater(node) as Extract<LayoutNode, { type: 'button' }>
    expect(afterAdd.props.action).toEqual({ type: 'executeOperation', operationName: 'save', body: { '': '' } })

    onCommitNodeUpdate.mockClear()
    rerender(<LayoutCanvasPropertiesPanel node={afterAdd} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const bodyGroupAfterAdd = screen.getByRole('group', { name: 'body' })
    fireEvent.change(within(bodyGroupAfterAdd).getByLabelText('body clave #1'), { target: { value: 'nombre' } })
    fireEvent.change(within(bodyGroupAfterAdd).getByLabelText('body valor #1'), { target: { value: 'Ana' } })

    const [, keyUpdater] = onCommitNodeUpdate.mock.calls[0]
    const [, valueUpdater] = onCommitNodeUpdate.mock.calls[1]
    const afterKey = keyUpdater(afterAdd) as Extract<LayoutNode, { type: 'button' }>
    expect(afterKey.props.action).toEqual({ type: 'executeOperation', operationName: 'save', body: { nombre: '' } })
    const afterValue = valueUpdater(afterAdd) as Extract<LayoutNode, { type: 'button' }>
    expect(afterValue.props.action).toEqual({ type: 'executeOperation', operationName: 'save', body: { '': 'Ana' } })
  })

  it('a body key with an object or array value falls back to a disabled raw-JSON slot, without affecting the rest of that same body', () => {
    const node = buttonNode({
      type: 'executeOperation',
      operationName: 'save',
      body: { nombre: 'Ana', metadatos: { origen: 'web' } },
    })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const bodyGroup = screen.getByRole('group', { name: 'body' })
    expect((within(bodyGroup).getByLabelText('body valor #1') as HTMLInputElement).value).toBe('Ana')
    const nestedValueField = within(bodyGroup).getByLabelText('body valor #2')
    expect(nestedValueField.tagName).toBe('TEXTAREA')
    expect(nestedValueField).toBeDisabled()
  })

  it('the body exception applies per-entry inside executeOperations.operations, leaving other keys and other entries editable', () => {
    const node = buttonNode({
      type: 'executeOperations',
      operations: [
        { operationName: 'first', body: { nombre: 'Ana', metadatos: { origen: 'web' } } },
        { operationName: 'second', body: { foo: 'bar' } },
      ],
    })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const operationsGroup = screen.getByRole('group', { name: 'operations' })
    const firstEntryGroup = within(operationsGroup).getByRole('group', { name: 'operations #1' })
    const secondEntryGroup = within(operationsGroup).getByRole('group', { name: 'operations #2' })

    const firstBodyGroup = within(firstEntryGroup).getByRole('group', { name: 'body' })
    expect((within(firstBodyGroup).getByLabelText('body valor #1') as HTMLInputElement).value).toBe('Ana')
    const nestedValueField = within(firstBodyGroup).getByLabelText('body valor #2')
    expect(nestedValueField.tagName).toBe('TEXTAREA')
    expect(nestedValueField).toBeDisabled()

    // The second entry's own body is unaffected by the first entry's nested key.
    const secondBodyGroup = within(secondEntryGroup).getByRole('group', { name: 'body' })
    expect((within(secondBodyGroup).getByLabelText('body valor #1') as HTMLInputElement).value).toBe('bar')

    fireEvent.change(within(firstBodyGroup).getByLabelText('body valor #1'), { target: { value: 'Ana Actualizada' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'button' }>
    expect(result.props.action).toEqual({
      type: 'executeOperations',
      operations: [
        { operationName: 'first', body: { nombre: 'Ana Actualizada', metadatos: { origen: 'web' } } },
        { operationName: 'second', body: { foo: 'bar' } },
      ],
    })
  })
})

describe('LayoutCanvasPropertiesPanel form submitAction selector (T5)', () => {
  function formNode(overrides: Partial<Extract<LayoutNode, { type: 'form' }>> = {}): LayoutNode {
    return { type: 'form', id: 'f1', ...overrides } as LayoutNode
  }

  it('shows exactly the 2 submitAction variants plus "Sin acción" for a form node with no submitAction yet', () => {
    const node = formNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByLabelText('Acción de envío') as HTMLSelectElement
    const optionTexts = Array.from(select.options).map((option) => option.textContent)
    expect(optionTexts).toEqual(['Sin acción', 'Ejecutar operación', 'Ejecutar operaciones'])
  })

  it('selecting executeOperations seeds submitAction.operations with exactly one entry (minItems: 1)', () => {
    const node = formNode()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('Acción de envío'), { target: { value: 'executeOperations' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'form' }>
    expect(result.submitAction).toEqual({ type: 'executeOperations', operations: [{ operationName: '' }] })
  })

  it('"Quitar" is disabled on the single operations entry (at minItems), and editing its operationName commits in place', () => {
    const node = formNode({
      submitAction: { type: 'executeOperations', operations: [{ operationName: 'x' }] },
    } as Partial<Extract<LayoutNode, { type: 'form' }>>)
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const operationsGroup = screen.getByRole('group', { name: 'operations' })
    expect(within(operationsGroup).getByRole('button', { name: 'Quitar operations #1' })).toBeDisabled()

    fireEvent.change(within(operationsGroup).getByLabelText('operationName', { exact: false }), {
      target: { value: 'saveUser' },
    })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'form' }>
    expect(result.submitAction).toEqual({ type: 'executeOperations', operations: [{ operationName: 'saveUser' }] })
  })

  it('"Añadir" on operations appends a second entry with operationName empty and optional fields absent', () => {
    const node = formNode({
      submitAction: { type: 'executeOperations', operations: [{ operationName: 'first' }] },
    } as Partial<Extract<LayoutNode, { type: 'form' }>>)
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir operations' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'form' }>
    expect(result.submitAction).toEqual({
      type: 'executeOperations',
      operations: [{ operationName: 'first' }, { operationName: '' }],
    })
  })

  it('adding an onSuccess entry exposes a 7-variant selector for that entry, defaulting to navigateTo', () => {
    const node = formNode({
      submitAction: { type: 'executeOperation', operationName: 'save' },
    } as Partial<Extract<LayoutNode, { type: 'form' }>>)
    const onCommitNodeUpdate = vi.fn()
    const { rerender } = render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const onSuccessGroup = screen.getByRole('group', { name: 'onSuccess' })
    fireEvent.click(within(onSuccessGroup).getByRole('button', { name: 'Añadir onSuccess' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'form' }>
    expect(result.onSuccess).toEqual([{ type: 'navigateTo', pageId: '' }])

    rerender(<LayoutCanvasPropertiesPanel node={result} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)
    const entryGroup = screen.getByRole('group', { name: 'onSuccess #1' })
    const entrySelect = within(entryGroup).getByRole('combobox', { name: 'onSuccess #1' }) as HTMLSelectElement
    const optionTexts = Array.from(entrySelect.options).map((option) => option.textContent)
    expect(optionTexts).toEqual([
      'Navegar a página',
      'Volver atrás',
      'Ejecutar operación',
      'Ejecutar operaciones',
      'Reiniciar formulario',
      'Abrir modal',
      'Cerrar modal',
    ])
  })

  it('editing an existing "when" on an onSuccess entry commits a shape matching whenConditionSchema, preserving its other fields', () => {
    const node = formNode({
      submitAction: { type: 'executeOperation', operationName: 'save' },
      onSuccess: [{ type: 'goBack', when: { reference: 'forms.f1.urgent', operator: 'equals', value: 'yes' } }],
    } as Partial<Extract<LayoutNode, { type: 'form' }>>)
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const entryGroup = screen.getByRole('group', { name: 'onSuccess #1' })
    // T3 (0132): `when` now mounts `ConditionGroupPropertyField` (`x-widget: 'condition-group'`),
    // whose reference row is labelled `${label} — Referencia` — here label="when" (the technical
    // field name, same as every other nested dispatcher field).
    const whenReferenceField = within(entryGroup).getByLabelText('when — Referencia')
    fireEvent.change(whenReferenceField, { target: { value: 'forms.f1.otherField' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'form' }>
    expect(result.onSuccess).toEqual([
      { type: 'goBack', when: { reference: 'forms.f1.otherField', operator: 'equals', value: 'yes' } },
    ])
  })

  it('editing an existing "when" on an executeOperations.operations entry commits a shape matching whenConditionSchema, preserving its other fields', () => {
    const node = formNode({
      submitAction: {
        type: 'executeOperations',
        operations: [
          { operationName: 'save', when: { reference: 'forms.f1.urgent', operator: 'equals', value: 'yes' } },
        ],
      },
    } as Partial<Extract<LayoutNode, { type: 'form' }>>)
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const operationsGroup = screen.getByRole('group', { name: 'operations' })
    const entryGroup = within(operationsGroup).getByRole('group', { name: 'operations #1' })
    // T3 (0132): same `condition-group` widget swap as above, applied here to `submitAction`'s
    // `executeOperations.operations[].when`.
    const whenReferenceField = within(entryGroup).getByLabelText('when — Referencia')
    fireEvent.change(whenReferenceField, { target: { value: 'forms.f1.otherField' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'form' }>
    expect(result.submitAction).toEqual({
      type: 'executeOperations',
      operations: [
        { operationName: 'save', when: { reference: 'forms.f1.otherField', operator: 'equals', value: 'yes' } },
      ],
    })
  })
})

describe('LayoutCanvasPropertiesPanel link content mode widget (T3, 0126)', () => {
  function linkNode(overrides: Partial<Extract<LayoutNode, { type: 'link' }>['props']> = {}, children?: LayoutNode[]): LayoutNode {
    return {
      type: 'link',
      props: { ...overrides },
      ...(children !== undefined ? { children } : {}),
    } as LayoutNode
  }

  it('renders the "Contenido" selector for a link node, preselecting "Texto" when props.label is present', () => {
    const node = linkNode({ label: 'Ir a inicio' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByLabelText('Contenido') as HTMLSelectElement
    expect(select.value).toBe('text')
    const optionTexts = Array.from(select.options).map((option) => option.textContent)
    expect(optionTexts).toEqual(['Texto', 'Elementos anidados'])
  })

  it.each<LayoutNode['type']>(['container', 'form', 'button', 'heading'])(
    'does not render the "Contenido" selector for a %s node',
    (type) => {
      const node = { type, props: { label: 'x', text: 'x' }, id: 'f1' } as unknown as LayoutNode
      render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

      expect(screen.queryByLabelText('Contenido')).not.toBeInTheDocument()
    },
  )

  it('the "Contenido" selector renders alongside Props/Layout/Visibilidad/Estado de consulta', () => {
    const node = linkNode({ label: 'Ir' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('Contenido')).toBeInTheDocument()
    expect(screen.getByLabelText('label', { exact: false })).toBeInTheDocument()
  })

  it('switching to "Elementos anidados" invokes onCommitNodeUpdate with the correct path and a patch reconstructing the full node', () => {
    const node = linkNode({ label: 'Ir', href: '/somewhere' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'children' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, patchFn] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = patchFn(node) as Extract<LayoutNode, { type: 'link' }>
    expect(result.children).toEqual([])
    expect(result.props).not.toHaveProperty('label')
    expect(result.props.href).toBe('/somewhere')
  })

  it('switching to "Texto" from a link with children invokes onCommitNodeUpdate reconstructing the node with the default label', () => {
    const node = linkNode({ href: '/somewhere' }, [{ type: 'heading', props: { text: 'Hi', level: 2 } }])
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('Contenido'), { target: { value: 'text' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, patchFn] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = patchFn(node) as Extract<LayoutNode, { type: 'link' }>
    expect(result).not.toHaveProperty('children')
    expect(result.props.label).toBe('Enlace')
    expect(result.props.href).toBe('/somewhere')
  })
})

describe('LayoutCanvasPropertiesPanel heading level widget (T3, 0128)', () => {
  it('renders the segmented level widget for a heading node, not the generic numeric input', () => {
    const node = headingNode({ level: 2 })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByRole('radiogroup', { name: 'Nivel' })).toBeInTheDocument()
    expect(screen.queryByLabelText('level', { exact: false })).not.toBeInTheDocument()
  })

  it('with level 5, only the "H5" segment is active', () => {
    const node = headingNode({ level: 5 })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Nivel' })
    const activeSegments = within(radiogroup).getAllByRole('radio', { checked: true })
    expect(activeSegments).toHaveLength(1)
    expect(activeSegments[0]).toHaveAccessibleName('H5')
  })

  it('with level 6, no segment is active', () => {
    const node = headingNode({ level: 6 })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Nivel' })
    expect(within(radiogroup).queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('clicking "H4" with level 2 commits props.level = 4 without touching text or other keys', () => {
    const node = headingNode({ text: 'Hello', icon: 'star', level: 2 })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Nivel' })
    fireEvent.click(within(radiogroup).getByRole('radio', { name: 'H4' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    expect(updater(node)).toEqual(headingNode({ text: 'Hello', icon: 'star', level: 4 }))
  })

  // T2 (0129): `props.icon` no longer renders through the generic text control — it now mounts
  // the icon widget (`resolveIconPropsSchema`), covered in its own describe block below. This
  // regression narrows to `props.text`, the field that still goes through the generic dispatcher.
  it('regression: props.text remains editable with the generic control', () => {
    const node = headingNode({ text: 'Hello', level: 2 })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('text', { exact: false })).toHaveValue('Hello')
  })
})

describe('LayoutCanvasPropertiesPanel tabs orientation widget (T3, 0128)', () => {
  function tabsOrientationNode(overrides: Partial<Extract<LayoutNode, { type: 'tabs' }>['props']> = {}): LayoutNode {
    return { type: 'tabs', props: { items: [{ label: 'Uno' }], ...overrides } } as LayoutNode
  }

  it('renders the segmented orientation widget with "Vertical" active, not the generic select', () => {
    const node = tabsOrientationNode({ orientation: 'vertical' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Orientación' })
    expect(within(radiogroup).getByRole('radio', { name: 'Vertical', checked: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('orientation', { exact: false })).not.toBeInTheDocument()
  })

  it('with orientation undeclared, the "Horizontal" segment is active', () => {
    const node = tabsOrientationNode()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Orientación' })
    expect(within(radiogroup).getByRole('radio', { name: 'Horizontal', checked: true })).toBeInTheDocument()
  })

  it('clicking "Horizontal" with orientation "vertical" commits props.orientation = "horizontal" without touching items', () => {
    const node = tabsOrientationNode({ orientation: 'vertical' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Orientación' })
    fireEvent.click(within(radiogroup).getByRole('radio', { name: 'Horizontal' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = updater(node) as Extract<LayoutNode, { type: 'tabs' }>
    expect(result.props.orientation).toBe('horizontal')
    expect(result.props.items).toEqual([{ label: 'Uno' }])
  })

  it('regression: props.items and props.defaultTab remain editable with the existing controls', () => {
    const node = tabsOrientationNode({ orientation: 'vertical', defaultTab: 0 })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('label', { exact: false })).toHaveValue('Uno')
    expect(screen.getByLabelText('defaultTab', { exact: false })).toHaveValue(0)
  })
})

describe('LayoutCanvasPropertiesPanel heading-level / tabs-orientation widgets regression on other node types (T3, 0128)', () => {
  it.each<LayoutNode['type']>(['container', 'paragraph', 'button', 'list', 'form', 'input'])(
    'does not render the "Nivel" or "Orientación" widgets for a %s node',
    (type) => {
      const node = { type, props: { text: 'x', label: 'x', fieldId: 'f', items: [] }, id: 'f1' } as unknown as LayoutNode
      render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

      expect(screen.queryByRole('radiogroup', { name: 'Nivel' })).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Orientación' })).not.toBeInTheDocument()
    },
  )
})

// T1 (0134), FR1/FR2: the generic dispatcher's own `enum` branch (not a dedicated `x-widget`)
// renders a segmented radiogroup instead of a `<select>` for a bounded 2-5 option enum.
// `stat.props.variant` (3 options: accent/tinted/plain) is the concrete field this task singles
// out for coverage; `container.props.justify` (6 options) is the sibling regression proving the
// upper boundary stays a `<select>`.
describe('LayoutCanvasPropertiesPanel generic segmented enum widget (T1, 0134)', () => {
  function statNode(variant?: 'accent' | 'tinted' | 'plain'): LayoutNode {
    return { type: 'stat', props: { label: 'Total', value: '10', ...(variant !== undefined ? { variant } : {}) } } as LayoutNode
  }

  it('renders props.variant as a segmented radiogroup, in a label-left/control-right row, inside the Props tabpanel', () => {
    render(<LayoutCanvasPropertiesPanel node={statNode('tinted')} path={somePath} onCommitNodeUpdate={() => {}} />)

    const propsTabpanel = screen.getByRole('tabpanel')
    const radiogroup = within(propsTabpanel).getByRole('radiogroup', { name: 'variant' })
    expect(within(radiogroup).getByRole('radio', { name: 'tinted', checked: true })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'variant' })).not.toBeInTheDocument()

    // Same label-left/control-right row `EnumPropertyField` already used for this field.
    const row = radiogroup.parentElement!.parentElement!
    expect(within(row).getByText('variant')).toBeInTheDocument()
  })

  it('clicking a different segment invokes onCommitNodeUpdate with a patch preserving label/value', () => {
    const node = statNode('accent')
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'variant' })).getByRole('radio', { name: 'plain' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = updater(node) as Extract<LayoutNode, { type: 'stat' }>
    expect(result.props.variant).toBe('plain')
    expect(result.props.label).toBe('Total')
    expect(result.props.value).toBe('10')
  })

  it('regression: container.props.justify (6 options) still renders the plain <select>, unaffected by the 2-5 segmented rule', () => {
    const node: LayoutNode = { type: 'container', props: { justify: 'center' } } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByLabelText('justify', { exact: false }) as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(select.value).toBe('center')
    expect(screen.queryByRole('radiogroup', { name: 'justify' })).not.toBeInTheDocument()
  })
})

// T2 (0134), FR3/FR4: any `props.color` field declaring an `enum` renders as a fixed row of six
// color swatches (`ColorSwatchPropertyField`), taking priority over both the generic `<select>`
// (FR1's out-of-range fallback) and T1's segmented control — regardless of option count.
// `stat.props.color` and `badge.props.color` share the same six-name catalog as
// `stat.props.variant` (T1) but are singled out here to prove the name-convention exclusion.
describe('LayoutCanvasPropertiesPanel color swatch widget (T2, 0134)', () => {
  function statNode(color?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'): LayoutNode {
    return { type: 'stat', props: { label: 'Total', value: '10', ...(color !== undefined ? { color } : {}) } } as LayoutNode
  }

  function badgeNode(color?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'): LayoutNode {
    return { type: 'badge', props: { label: 'Nuevo', ...(color !== undefined ? { color } : {}) } } as LayoutNode
  }

  it.each([
    ['stat', statNode] as const,
    ['badge', badgeNode] as const,
  ])(
    'renders %s.props.color as a row of six swatches, not a <select> or the generic segmented control, with the current value active (acceptance 3)',
    (_type, buildNode) => {
      render(<LayoutCanvasPropertiesPanel node={buildNode('success')} path={somePath} onCommitNodeUpdate={() => {}} />)

      const radiogroup = screen.getByRole('radiogroup', { name: 'color' })
      expect(within(radiogroup).getAllByRole('radio')).toHaveLength(6)
      expect(within(radiogroup).getByRole('radio', { name: 'success' })).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByRole('combobox', { name: 'color' })).not.toBeInTheDocument()
    },
  )

  it('clicking a different swatch invokes onCommitNodeUpdate with a patch preserving label/value', () => {
    const node = statNode('primary')
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'color' })).getByRole('radio', { name: 'danger' }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = updater(node) as Extract<LayoutNode, { type: 'stat' }>
    expect(result.props.color).toBe('danger')
    expect(result.props.label).toBe('Total')
    expect(result.props.value).toBe('10')
  })

  it('regression: alert.props.type (same six-name catalog, field name "type") still renders a plain <select>', () => {
    const node: LayoutNode = { type: 'alert', props: { message: 'Aviso', type: 'success' } } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const select = screen.getByLabelText('type', { exact: false }) as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(select.value).toBe('success')
    expect(screen.queryByRole('radiogroup', { name: 'type' })).not.toBeInTheDocument()
  })

  it('a color value outside the catalog does not block the rest of the Props tab: swatches render with none active and label stays editable', () => {
    const node = { type: 'stat', props: { label: 'Total', value: '10', color: 'morado' } } as unknown as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'color' })
    within(radiogroup)
      .getAllByRole('radio')
      .forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByLabelText('label', { exact: false })).toHaveValue('Total')
  })
})

describe('LayoutCanvasPropertiesPanel container columns mode widget (T5, 0128)', () => {
  function containerNode(overrides: Partial<NonNullable<Extract<LayoutNode, { type: 'container' }>['props']>> = {}): LayoutNode {
    return { type: 'container', props: { ...overrides } } as LayoutNode
  }

  it('renders the "Modo" widget with "Grid" active when props.columns is absent', () => {
    render(<LayoutCanvasPropertiesPanel node={containerNode()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Modo' })
    expect(within(radiogroup).getByRole('radio', { name: /Grid/, checked: true })).toBeInTheDocument()
  })

  it('renders the "Modo" widget with "Columnas" active when props.columns is declared', () => {
    render(<LayoutCanvasPropertiesPanel node={containerNode({ columns: 4 })} path={somePath} onCommitNodeUpdate={() => {}} />)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Modo' })
    expect(within(radiogroup).getByRole('radio', { name: /Columnas/, checked: true })).toBeInTheDocument()
  })

  it.each<LayoutNode['type']>(['form', 'heading', 'tabs', 'link', 'button', 'paragraph', 'list', 'input'])(
    'does not render the "Modo" widget for a %s node',
    (type) => {
      const node = { type, props: { text: 'x', label: 'x', fieldId: 'f', items: [] }, id: 'f1' } as unknown as LayoutNode
      render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

      expect(screen.queryByRole('radiogroup', { name: 'Modo' })).not.toBeInTheDocument()
    },
  )

  it('the "Modo" widget renders above the Props subsection, in the same relative position as the link widget', () => {
    const node = containerNode({ direction: 'row' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    const modoGroup = screen.getByRole('radiogroup', { name: 'Modo' })
    const directionInput = screen.getByLabelText('direction', { exact: false })
    expect(modoGroup.compareDocumentPosition(directionInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('clicking "Columnas" invokes onCommitNodeUpdate with the correct path and a patch setting props.columns = 2, preserving direction', () => {
    const node = containerNode({ direction: 'row' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/ }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, patchFn] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    const result = patchFn(node) as Extract<LayoutNode, { type: 'container' }>
    expect(result.props?.columns).toBe(2)
    expect(result.props?.direction).toBe('row')
  })

  it('clicking "Grid" invokes onCommitNodeUpdate with a patch that removes props.columns, preserving direction', () => {
    const node = containerNode({ columns: 4, direction: 'row' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Grid/ }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, patchFn] = onCommitNodeUpdate.mock.calls[0]
    const result = patchFn(node) as Extract<LayoutNode, { type: 'container' }>
    expect(result.props).not.toHaveProperty('columns')
    expect(result.props?.direction).toBe('row')
  })

  it('when the mode is Columnas, props.columns still renders as an editable field in the Props subsection', () => {
    render(<LayoutCanvasPropertiesPanel node={containerNode({ columns: 3 })} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('columns', { exact: false })).toBeInTheDocument()
  })

  it('when the mode is Grid, props.columns does not render in the Props subsection', () => {
    render(<LayoutCanvasPropertiesPanel node={containerNode({ direction: 'row' })} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.queryByLabelText('columns', { exact: false })).not.toBeInTheDocument()
  })
})

// T5 (0133): the three special blocks (link "Contenido", container "Modo", form "Acción de envío")
// used to render between the identity row and the tab bar, visible with any tab active. They now
// live at the top of the `Props` tabpanel, only while `Props` is active — closes criterion 6.
describe('LayoutCanvasPropertiesPanel special Props blocks scoped to the tabpanel (T5, 0133)', () => {
  function linkFixture(): LayoutNode {
    return { type: 'link', props: { label: 'Ir', href: '/x' } } as LayoutNode
  }
  function containerFixture(): LayoutNode {
    return { type: 'container', props: {} } as LayoutNode
  }
  function formFixture(): LayoutNode {
    return {
      type: 'form',
      id: 'f1',
      submitAction: { type: 'executeOperation', operationName: 'save' },
    } as LayoutNode
  }

  it('renders the link "Contenido" selector inside the Props tabpanel, and it disappears under Visibilidad', () => {
    render(<LayoutCanvasPropertiesPanel node={linkFixture()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const tabpanel = screen.getByRole('tabpanel')
    expect(within(tabpanel).getByLabelText('Contenido')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.queryByLabelText('Contenido')).not.toBeInTheDocument()
  })

  it('renders the container "Modo" widget inside the Props tabpanel, and it disappears under Visibilidad', () => {
    render(<LayoutCanvasPropertiesPanel node={containerFixture()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const tabpanel = screen.getByRole('tabpanel')
    expect(within(tabpanel).getByRole('radiogroup', { name: 'Modo' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.queryByRole('radiogroup', { name: 'Modo' })).not.toBeInTheDocument()
  })

  // A `form` node's schema declares no `props` key of its own (only `submitAction`), so its
  // `Props` tab exists purely to host this special block — the dispatcher renders nothing else
  // underneath it. Regression coverage for `resolveNodePanelTabs`' `submitAction` fallback.
  it('renders a Props tab and the form "Acción de envío" selector inside its tabpanel, and it disappears under Visibilidad', () => {
    render(<LayoutCanvasPropertiesPanel node={formFixture()} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByRole('tab', { name: 'Props' })).toHaveAttribute('aria-selected', 'true')
    const tabpanel = screen.getByRole('tabpanel')
    expect(within(tabpanel).getByLabelText('Acción de envío')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.queryByLabelText('Acción de envío')).not.toBeInTheDocument()
  })

  it('positions the "Contenido" selector before the dispatcher-driven props fields inside the tabpanel', () => {
    render(<LayoutCanvasPropertiesPanel node={linkFixture()} path={somePath} onCommitNodeUpdate={() => {}} />)

    const contentSelect = screen.getByLabelText('Contenido')
    const labelField = screen.getByLabelText('label', { exact: false })
    expect(contentSelect.compareDocumentPosition(labelField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// T2 (0129): the six node types whose generated `props` schema declares `icon: z.string().optional()`
// (`runtime-config-zod.ts`) — `resolveIconPropsSchema` swaps that key for the `{ 'x-widget': 'icon' }`
// sentinel by field-name convention, independent of `node.type`. One builder per type below supplies
// the minimal valid `props` shape for that node.
const ICON_NODE_BUILDERS: Record<'button' | 'heading' | 'paragraph' | 'link' | 'stat' | 'input', (icon?: string) => LayoutNode> = {
  button: (icon) => ({ type: 'button', props: { label: 'Enviar', variant: 'solid', ...(icon !== undefined ? { icon } : {}) } }) as LayoutNode,
  heading: (icon) => headingNode(icon !== undefined ? { icon } : {}),
  paragraph: (icon) => ({ type: 'paragraph', props: { text: 'Hola', ...(icon !== undefined ? { icon } : {}) } }) as LayoutNode,
  link: (icon) => ({ type: 'link', props: { label: 'Ir', ...(icon !== undefined ? { icon } : {}) } }) as LayoutNode,
  stat: (icon) => ({ type: 'stat', props: { label: 'Total', value: '10', ...(icon !== undefined ? { icon } : {}) } }) as LayoutNode,
  input: (icon) => ({ type: 'input', props: { fieldId: 'f1', label: 'Campo', ...(icon !== undefined ? { icon } : {}) } }) as LayoutNode,
}

describe('LayoutCanvasPropertiesPanel icon widget (T2, 0129)', () => {
  describe.each(Object.keys(ICON_NODE_BUILDERS) as Array<keyof typeof ICON_NODE_BUILDERS>)('%s node', (type) => {
    it('renders the icon widget with the current value highlighted, not a generic text input', () => {
      const node = ICON_NODE_BUILDERS[type]('Home')
      render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)
      // The grid is hidden until the search input is focused (T5, 0129).
      fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

      const grid = screen.getByRole('grid', { name: 'icon' })
      const homeCell = within(grid).getByText('Home').closest('[role="gridcell"]')!
      expect(homeCell).toHaveAttribute('aria-selected', 'true')
      expect(screen.queryByRole('textbox', { name: 'icon' })).not.toBeInTheDocument()
    })
  })

  it('clicking a different cell on a button commits props.icon to the selected PascalCase name, preserving other props', () => {
    const node = ICON_NODE_BUILDERS.button('Home')
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [calledPath, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(calledPath).toBe(somePath)
    expect(updater(node)).toEqual(ICON_NODE_BUILDERS.button('Settings'))
  })

  it('clicking the clear button on a button with props.icon = "Home" commits props.icon = undefined, preserving other props', () => {
    const node = ICON_NODE_BUILDERS.button('Home')
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /Quitar icono/i }))

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    expect(updater(node)).toEqual(ICON_NODE_BUILDERS.button(undefined))
  })

  it('regression: a heading with both props.level and props.icon mounts both widgets independently, keeping props.text editable', () => {
    const node = headingNode({ text: 'Hello', level: 3, icon: 'Home' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    expect(screen.getByRole('radiogroup', { name: 'Nivel' })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'icon' })).toBeInTheDocument()
    expect(screen.getByLabelText('text', { exact: false })).toHaveValue('Hello')
  })

  it.each<LayoutNode['type']>(['container', 'divider', 'select', 'list'])(
    'regression: does not render the icon widget for a %s node (no props.icon in its schema)',
    (type) => {
      const node = { type, props: { text: 'x', label: 'x', fieldId: 'f', items: [] }, id: 'f1' } as unknown as LayoutNode
      render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

      expect(screen.queryByRole('grid', { name: 'icon' })).not.toBeInTheDocument()
    },
  )

  it('regression: a container with children still renders its own props editable, with no icon widget', () => {
    const node: LayoutNode = {
      type: 'container',
      props: { direction: 'row' },
      children: [{ type: 'heading', props: { text: 'Child', level: 2 } }],
    } as LayoutNode
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={() => {}} />)

    expect(screen.getByLabelText('direction', { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole('grid', { name: 'icon' })).not.toBeInTheDocument()
  })
})

function buildReadyProps(rawConfig: unknown): { initialConfig: RuntimeConfig; initialConfigText: string } {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

// The drawer/toggle and the isolated canvas preview are retired (0103, T8): editing happens
// directly on the real `<RuntimePage />` once Editor mode is active, and the Monaco panel is
// opened from the floating toolbar's dedicated control.
async function getMonacoValue(): Promise<string> {
  if (screen.queryByTestId('monaco-editor-mock') === null) {
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
  }
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  return (screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value
}

describe('LayoutCanvasPropertiesPanel integration with DevEditorLayer + commitCanvasMutation', () => {
  it('editing a text prop in the overlay panel updates editorBuffer immediately, visible in Monaco, with no extra button press', async () => {
    const config = {
      api: {},
      pages: [{ id: 'home', layout: [{ type: 'heading', props: { text: 'Original', level: 2 } }] }],
      initialPage: 'home',
    }
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
    fireEvent.click(screen.getByText('Original'))

    fireEvent.change(screen.getByLabelText('text', { exact: false }), { target: { value: 'Edited from panel' } })

    const editorText = await getMonacoValue()

    expect(JSON.parse(editorText).pages[0].layout[0].props.text).toBe('Edited from panel')
  })

  it('editing props.items via the choice-items widget on a select node propagates to editorBuffer/Monaco (T5, 0108)', async () => {
    const config = {
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'f1',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'choice',
                    label: 'Elige',
                    items: [{ label: 'Uno', value: 'uno' }],
                  },
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    }
    const { initialConfig, initialConfigText } = buildReadyProps(config)
    render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)

    fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
    fireEvent.click(screen.getByText('Elige'))

    const itemsGroup = screen.getByRole('group', { name: 'items' })
    const modeSelect = within(itemsGroup).getByRole('combobox') as HTMLSelectElement
    fireEvent.change(modeSelect, { target: { value: 'manualScalar' } })

    const editorText = await getMonacoValue()

    expect(JSON.parse(editorText).pages[0].layout[0].children[0].props.items).toEqual({ values: [] })
  })
})
