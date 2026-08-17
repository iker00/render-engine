import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig, RuntimeConfigValidationResult } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'
import { LayoutCanvasPropertiesPanel } from '../../dev-runtime/layout-canvas/layout-canvas-properties-panel'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { getNodeTypeJsonSchema } from '../../dev-runtime/layout-canvas/layout-canvas-node-schema'

// Mock @monaco-editor/react, matching the pattern already established in
// layout-canvas-properties-panel.test.tsx / dev-runtime.test.tsx — not exercised directly by
// this file (LayoutCanvasPropertiesPanel never renders Monaco), kept for consistency with the
// rest of the folder's setup.
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

// T4 (0128): `validateRuntimeConfig` wraps the real implementation by default (every existing
// test in this file, including `buildReadyProps` below, gets genuine validation behavior
// unchanged). Only the heading-level/tabs-orientation rejection tests further down override a
// single upcoming call with `mockReturnValueOnce` to force acceptance criterion 8 — see the doc
// comment on that describe block for why mocking (rather than a naturally invalid typed value,
// the `layout.span` widget's approach above) is the only way to reach that path for these two
// widgets.
vi.mock('../../config/runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/runtime-config')>()
  return { ...actual, validateRuntimeConfig: vi.fn(actual.validateRuntimeConfig) }
})

// The `icon` widget (T2, 0129) mounts the real `IconPickerPropertyField` for every node type whose
// generated `props` schema declares `icon`. Without this mock, rendering it walks the real
// ~3900-icon `lucide-react` namespace and blows the global Vitest timeout (same failure mode
// documented in T1). `OTHER_MODULE_ICON_NAMES` covers every other icon name imported anywhere in
// the `DevRuntimeReady` render tree this file mounts via `renderCanvas` (floating toolbar, shell
// config panel, container-columns/tabs-orientation widgets) — ESM named imports resolve those
// bindings at module-load time regardless of which of them actually renders in a given test.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

const somePath: LayoutNodePath = [{ field: 'children', index: 0 }]
const otherPath: LayoutNodePath = [{ field: 'children', index: 1 }]

function buttonNode(action?: Record<string, unknown>): LayoutNode {
  return { type: 'button', props: { label: 'Enviar', ...(action !== undefined ? { action } : {}) } } as LayoutNode
}

const rejectedResult: CommitCanvasMutationResult = {
  status: 'rejected',
  error: { code: 'invalid-layout', message: 'operationName no puede estar vacío', displayMode: 'always' },
}

describe('LayoutCanvasPropertiesPanel commit feedback (T9)', () => {
  it('keeps the user-chosen variant visible and shows an error banner when the commit is rejected', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejectedResult)
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'executeOperation' } })

    expect((screen.getByLabelText('action') as HTMLSelectElement).value).toBe('executeOperation')

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-props-error')
    expect(banner.textContent).toContain('invalid-layout')
    expect(banner.textContent).toContain('operationName no puede estar vacío')
  })

  it('clears the banner and shows the node-derived value once a follow-up commit on the same subsection succeeds', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn()
    onCommitNodeUpdate.mockReturnValueOnce(rejectedResult)
    onCommitNodeUpdate.mockReturnValueOnce({ status: 'applied' })
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'executeOperation' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('operationName', { exact: false }), { target: { value: 'saveUser' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // The displayed value is governed by `node` again (unchanged across this render, still
    // navigateTo) now that pendingRejections for `props` has been cleared.
    expect((screen.getByLabelText('action') as HTMLSelectElement).value).toBe('navigateTo')
  })

  it('discards a pending rejection when the selected node (path) changes, reverting to the value from props', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejectedResult)
    const { rerender } = render(
      <LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />,
    )

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'executeOperation' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<LayoutCanvasPropertiesPanel node={node} path={otherPath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect((screen.getByLabelText('action') as HTMLSelectElement).value).toBe('navigateTo')
  })

  it('shows no banner when onCommitNodeUpdate is a bare vi.fn() without a mockReturnValue (existing test-double pattern)', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'executeOperation' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a newly added executeOperations.operations entry visible when its commit is rejected', () => {
    const node = buttonNode({ type: 'executeOperations', operations: [{ operationName: 'first' }] })
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejectedResult)
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir operations' }))

    expect(screen.getAllByLabelText('operationName', { exact: false })).toHaveLength(2)
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-props-error')
  })

  // T4 (0133), FR7: same tab-switch-preserves-rejection guarantee as Visibilidad, but for a
  // rejection on Props — switching to Visibilidad and back to Props keeps both the attempted
  // value and the banner.
  it('keeps a Props rejection banner and value after switching to Visibilidad and back (FR7)', () => {
    const node = buttonNode({ type: 'navigateTo', pageId: 'home' })
    const onCommitNodeUpdate = vi.fn().mockReturnValue(rejectedResult)
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('action'), { target: { value: 'executeOperation' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Props' }))
    expect((screen.getByLabelText('action') as HTMLSelectElement).value).toBe('executeOperation')
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-props-error')
  })
})

// T4 (0127): end-to-end coverage of the `layout.span` widget through the real `DevRuntimeReady`
// commit pipeline (`commitCanvasMutation` -> `patchRawConfigTextWithLayout` ->
// `validateRuntimeConfig`), closing acceptance criteria 1-9 of the feature spec. The describes
// above exercise `LayoutCanvasPropertiesPanel` in isolation with a test-double
// `onCommitNodeUpdate`; this one mounts the real editor so a rejected commit is a genuine
// `validateRuntimeConfig` rejection (not a canned return value) and a successful one is visible
// in the Monaco buffer — same harness `layout-canvas-delete-node.test.tsx` and
// `layout-canvas-properties-panel.test.tsx`'s own `DevRuntimeReady` describe already use.
function buildReadyProps(rawConfig: unknown): { initialConfig: RuntimeConfig; initialConfigText: string } {
  const initialConfigText = JSON.stringify(rawConfig, null, 2)
  const validation = validateRuntimeConfig(rawConfig)
  if (validation.status !== 'ready') {
    throw new Error(`Fixture config failed to validate: ${validation.error.message}`)
  }
  return { initialConfig: validation.config, initialConfigText }
}

// DevRuntimeReady (0103, T8) edits the real `<RuntimePage />` in place — switching to Editor mode
// from the floating toolbar activates the LayoutEditModeProvider/LayoutCanvasDndContext wiring on
// that same tree, exactly like `layout-canvas-delete-node.test.tsx`'s `renderCanvas`.
function renderCanvas(rawConfig: unknown): { root: HTMLElement } {
  const { initialConfig, initialConfigText } = buildReadyProps(rawConfig)
  const view = render(<DevRuntimeReady initialConfig={initialConfig} initialConfigText={initialConfigText} />)
  fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
  return { root: view.container }
}

// Selects a node by its serialized `data-node-path` (same precise-click pattern as
// `layout-canvas-delete-node.test.tsx`'s `selectRootContainer`), avoiding ambiguous text queries
// when sibling nodes render overlapping text.
function selectNodeByPath(root: HTMLElement, serializedPath: string) {
  const wrapper = root.querySelector(`[data-node-path="${serializedPath}"]`)
  expect(wrapper).not.toBeNull()
  fireEvent.click(wrapper as Element)
}

async function getMonacoJson(): Promise<Record<string, unknown>> {
  if (screen.queryByTestId('monaco-editor-mock') === null) {
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
  }
  await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())
  return JSON.parse((screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement).value) as Record<string, unknown>
}

// First child ("Child A") of the container at `children.1`, the node every test below selects to
// exercise the widget. Its own `layout.span` is seeded via `childASpan` when a test needs a
// pre-existing value (e.g. the integer -> map conversion case); omitted otherwise so the node
// starts with no `layout` key at all, matching the widget's "nothing declared" baseline.
function spanWidgetConfig(containerColumns: number | Record<string, number>, childASpan?: number | Record<string, number>) {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          { type: 'heading', props: { text: 'Root heading', level: 1 } },
          {
            type: 'container',
            props: { columns: containerColumns },
            children: [
              {
                type: 'heading',
                props: { text: 'Child A', level: 2 },
                ...(childASpan !== undefined ? { layout: { span: childASpan } } : {}),
              },
              { type: 'heading', props: { text: 'Child B', level: 3 } },
            ],
          },
        ],
      },
    ],
  }
}

const CHILD_A_PATH = 'children.1.children.0'
const CHILD_B_PATH = 'children.1.children.1'

// Reads the raw (pre-validation) `children[0]` of the root container from a parsed Monaco JSON
// buffer, matching `spanWidgetConfig`'s shape.
function readChildAFromMonacoJson(parsed: Record<string, unknown>): Record<string, unknown> {
  const pages = parsed.pages as Array<{ layout: Array<Record<string, unknown>> }>
  const container = pages[0].layout[1] as { children: Array<Record<string, unknown>> }
  return container.children[0]
}

describe('LayoutCanvasPropertiesPanel layout.span widget — end-to-end real pipeline (T4, 0127)', () => {
  it('shows no layout.span field nor the Layout legend for a node with no container ancestor with columns (acceptance 1)', () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, 'children.0')

    const panel = screen.getByTestId('layout-canvas-properties-panel')
    expect(within(panel).queryByTestId('layout-span-widget')).not.toBeInTheDocument()
    // Scoped to the properties panel: no Diseño tab exists at all for this node.
    expect(within(panel).queryByRole('tab', { name: 'Diseño' })).not.toBeInTheDocument()
  })

  it('renders the layout-span widget with all six rows for a node inside a container ancestor with columns (acceptance 2)', () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    const widget = screen.getByTestId('layout-span-widget')
    const rowTestIds = within(widget)
      .getAllByTestId(/^layout-span-widget-row-/)
      .map((row) => row.getAttribute('data-testid'))
    expect(rowTestIds).toEqual(
      ['base', 'sm', 'md', 'lg', 'xl', '2xl'].map((breakpoint) => `layout-span-widget-row-${breakpoint}`),
    )
  })

  it("resolves each row's denominator from the real mobile-first cascade of the container's responsive columns (acceptance 3)", () => {
    const { root } = renderCanvas(spanWidgetConfig({ base: 2, md: 4, xl: 12 }))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    expect(within(screen.getByTestId('layout-span-widget-row-base')).getByText('/ 2')).toBeInTheDocument()
    expect(within(screen.getByTestId('layout-span-widget-row-sm')).getByText('/ 2')).toBeInTheDocument()
    expect(within(screen.getByTestId('layout-span-widget-row-md')).getByText('/ 4')).toBeInTheDocument()
    expect(within(screen.getByTestId('layout-span-widget-row-lg')).getByText('/ 4')).toBeInTheDocument()
    expect(within(screen.getByTestId('layout-span-widget-row-xl')).getByText('/ 12')).toBeInTheDocument()
    expect(within(screen.getByTestId('layout-span-widget-row-2xl')).getByText('/ 12')).toBeInTheDocument()
  })

  it('shows an inherited muted value with no "Quitar" until edited, then "Quitar" removes the explicit key through the real commit pipeline (acceptance 4-6)', async () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    const initialBaseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(initialBaseRow).getByLabelText('base')).toHaveValue(1)
    expect(initialBaseRow).toHaveAttribute('data-explicit', 'false')
    expect(within(initialBaseRow).queryByRole('button', { name: 'Quitar base' })).not.toBeInTheDocument()

    fireEvent.change(within(initialBaseRow).getByLabelText('base'), { target: { value: '3' } })

    const editedBaseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(editedBaseRow).toHaveAttribute('data-explicit', 'true')
    expect(within(editedBaseRow).getByLabelText('base')).toHaveValue(3)
    expect(within(editedBaseRow).getByRole('button', { name: 'Quitar base' })).toBeInTheDocument()

    fireEvent.click(within(editedBaseRow).getByRole('button', { name: 'Quitar base' }))

    const clearedBaseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(clearedBaseRow).toHaveAttribute('data-explicit', 'false')
    expect(within(clearedBaseRow).getByLabelText('base')).toHaveValue(1)
    expect(within(clearedBaseRow).queryByRole('button', { name: 'Quitar base' })).not.toBeInTheDocument()

    const parsed = await getMonacoJson()
    const childA = readChildAFromMonacoJson(parsed)
    expect((childA.layout as Record<string, unknown> | undefined)?.span).toBeUndefined()
  })

  it('converts a plain integer span to a per-breakpoint map when editing a non-base row, preserved through validateRuntimeConfig (acceptance 7)', async () => {
    const { root } = renderCanvas(spanWidgetConfig(6, 3))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    const mdRow = screen.getByTestId('layout-span-widget-row-md')
    expect(within(mdRow).getByLabelText('md')).toHaveValue(3)
    expect(mdRow).toHaveAttribute('data-explicit', 'false')

    fireEvent.change(within(mdRow).getByLabelText('md'), { target: { value: '5' } })

    const editedMdRow = screen.getByTestId('layout-span-widget-row-md')
    expect(editedMdRow).toHaveAttribute('data-explicit', 'true')
    expect(within(editedMdRow).getByLabelText('md')).toHaveValue(5)

    const parsed = await getMonacoJson()
    const childA = readChildAFromMonacoJson(parsed)
    expect((childA.layout as Record<string, unknown>).span).toEqual({ base: 3, md: 5 })
  })

  it('rejects an out-of-range value for a breakpoint via validateRuntimeConfig: alert appears scoped to that row, the typed value is kept, and currentConfig does not change (acceptance 8)', async () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    const baseRow = screen.getByTestId('layout-span-widget-row-base')
    fireEvent.change(within(baseRow).getByLabelText('base'), { target: { value: '13' } })

    const rejectedBaseRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(rejectedBaseRow).getByLabelText('base')).toHaveValue(13)
    const alert = within(rejectedBaseRow).getByRole('alert')
    expect(alert).toHaveTextContent('invalid-layout')
    expect(alert.textContent).toContain('span')

    const parsed = await getMonacoJson()
    const childA = readChildAFromMonacoJson(parsed)
    expect(childA.layout).toBeUndefined()
  })

  it('clears the alert once the same row is edited again with a value inside range, and that follow-up commit is applied (acceptance 8, follow-up)', async () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    const baseRow = screen.getByTestId('layout-span-widget-row-base')
    fireEvent.change(within(baseRow).getByLabelText('base'), { target: { value: '0' } })
    expect(within(screen.getByTestId('layout-span-widget-row-base')).getByRole('alert')).toBeInTheDocument()

    fireEvent.change(within(screen.getByTestId('layout-span-widget-row-base')).getByLabelText('base'), {
      target: { value: '4' },
    })

    const clearedRow = screen.getByTestId('layout-span-widget-row-base')
    expect(within(clearedRow).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(clearedRow).getByLabelText('base')).toHaveValue(4)
    expect(clearedRow).toHaveAttribute('data-explicit', 'true')

    const parsed = await getMonacoJson()
    const childA = readChildAFromMonacoJson(parsed)
    expect((childA.layout as Record<string, unknown>).span).toEqual({ base: 4 })
  })

  it('discards a pending layout.span row alert when the selected node changes, the same guard the rest of the panel already applies (edge case)', () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    fireEvent.change(within(screen.getByTestId('layout-span-widget-row-base')).getByLabelText('base'), {
      target: { value: '13' },
    })
    expect(within(screen.getByTestId('layout-span-widget-row-base')).getByRole('alert')).toBeInTheDocument()

    // T4 (0133), FR3: switching node also resets the active tab to Props (the new node's first
    // tab), so Diseño has to be reselected to inspect the row's reset state.
    selectNodeByPath(root, CHILD_B_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const baseRowB = screen.getByTestId('layout-span-widget-row-base')
    expect(within(baseRowB).getByLabelText('base')).toHaveValue(1)
    expect(baseRowB).toHaveAttribute('data-explicit', 'false')
  })

  it('leaves the rest of the panel (props field) editable and synced to Monaco alongside the layout.span widget (acceptance 9)', async () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    selectNodeByPath(root, CHILD_A_PATH)

    // T4 (0133): Props stays the default active tab even though this node also exposes a Diseño
    // tab for its layout.span widget — the two are mutually exclusive tabpanels now (only one
    // mounts at a time), but neither breaks the other.
    expect(screen.getByRole('tab', { name: 'Diseño' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('text', { exact: false }), { target: { value: 'Edited child A' } })

    const parsed = await getMonacoJson()
    const childA = readChildAFromMonacoJson(parsed)
    expect((childA.props as Record<string, unknown>).text).toBe('Edited child A')
  })

  it('keeps mutual exclusion with the Monaco panel intact when the selected node renders the layout.span widget (acceptance 9)', async () => {
    const { root } = renderCanvas(spanWidgetConfig(6))
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    selectNodeByPath(root, CHILD_A_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Diseño' }))

    expect(screen.queryByTestId('monaco-editor-mock')).not.toBeInTheDocument()
    expect(screen.getByTestId('layout-span-widget')).toBeInTheDocument()
  })
})

// T4 (0128): fixture with a top-level `heading` and a top-level `tabs` node, no container
// ancestor involved — unlike the `layout.span` widget above, `heading-level`/`tabs-orientation`
// don't depend on ancestor columns, so the fixture stays flat. `headingLevel` is always passed
// explicitly (every acceptance criterion this file covers names a concrete level); `tabsOrientation`
// is omitted to exercise the "undeclared" default (acceptance 10).
function headingTabsWidgetConfig(headingLevel: number, tabsOrientation?: 'horizontal' | 'vertical') {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          { type: 'heading', props: { text: 'Título de la página', level: headingLevel } },
          {
            type: 'tabs',
            props: {
              items: [{ label: 'Uno' }, { label: 'Dos' }],
              ...(tabsOrientation !== undefined ? { orientation: tabsOrientation } : {}),
            },
          },
        ],
      },
    ],
  }
}

const HEADING_PATH = 'children.0'
const TABS_PATH = 'children.1'

// Reads `pages[0].layout[index]` from a parsed Monaco JSON buffer, matching
// `headingTabsWidgetConfig`'s flat (no-container) shape.
function readTopLevelNodeFromMonacoJson(parsed: Record<string, unknown>, index: number): Record<string, unknown> {
  const pages = parsed.pages as Array<{ layout: Array<Record<string, unknown>> }>
  return pages[0].layout[index]
}

// A generic, schema-shaped rejection used to force acceptance criterion 8 for both widgets below.
// Both `heading-level` and `tabs-orientation` only ever emit values from a closed set that the
// runtime-config schema already accepts in full (see the widgets' own `resolveActiveValue`
// comments: heading's 5 segments are a strict subset of the schema's unconstrained `level:
// number`, and tabs' 2 segments are the exact same set as the schema's `orientation` enum), so
// there is no value reachable through the widget's own UI that a genuine `validateRuntimeConfig`
// call would reject — unlike `layout.span`'s free-typed numeric input above. Forcing the mocked
// module's next `validateRuntimeConfig` call to fail is the only way to exercise the panel's
// rejection-banner wiring (`layout-canvas-properties-panel-props-error`) for these two widgets.
const forcedRejection: RuntimeConfigValidationResult = {
  status: 'error',
  error: { code: 'invalid-layout', message: 'Cambio no permitido', displayMode: 'always' },
}

describe('LayoutCanvasPropertiesPanel heading-level / tabs-orientation widgets — end-to-end real pipeline (T4, 0128)', () => {
  it('shows the "Nivel" widget with the matching segment active for a level within 1..5, and no generic numeric input (acceptance 5)', () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(3))
    selectNodeByPath(root, HEADING_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Nivel' })
    expect(within(radiogroup).getByRole('radio', { name: 'H3', checked: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('level', { exact: false })).not.toBeInTheDocument()
  })

  it('shows the "Nivel" widget with no segment active for level 6 (acceptance 6)', () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(6))
    selectNodeByPath(root, HEADING_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Nivel' })
    expect(within(radiogroup).queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('clicking "H3" on a heading with level 1 commits props.level = 3 through the real pipeline, preserving props.text (acceptance 7)', async () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(1))
    selectNodeByPath(root, HEADING_PATH)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H3' }))

    expect(
      within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H3', checked: true }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const heading = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect((heading.props as Record<string, unknown>).level).toBe(3)
    expect((heading.props as Record<string, unknown>).text).toBe('Título de la página')
  })

  it('shows the "Orientación" widget with "Horizontal" active when orientation is undeclared (acceptance 10)', () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(2))
    selectNodeByPath(root, TABS_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Orientación' })
    expect(within(radiogroup).getByRole('radio', { name: 'Horizontal', checked: true })).toBeInTheDocument()
  })

  it('shows the "Orientación" widget with "Vertical" active for props.orientation = "vertical" (acceptance 11)', () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(2, 'vertical'))
    selectNodeByPath(root, TABS_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Orientación' })
    expect(within(radiogroup).getByRole('radio', { name: 'Vertical', checked: true })).toBeInTheDocument()
  })

  it('clicking "Vertical" on a tabs node with orientation "horizontal" commits props.orientation = "vertical" through the real pipeline, preserving props.items (acceptance 12)', async () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(2, 'horizontal'))
    selectNodeByPath(root, TABS_PATH)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Orientación' })).getByRole('radio', { name: 'Vertical' }))

    expect(
      within(screen.getByRole('radiogroup', { name: 'Orientación' })).getByRole('radio', {
        name: 'Vertical',
        checked: true,
      }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const tabs = readTopLevelNodeFromMonacoJson(parsed, 1)
    expect((tabs.props as Record<string, unknown>).orientation).toBe('vertical')
    expect((tabs.props as Record<string, unknown>).items).toEqual([{ label: 'Uno' }, { label: 'Dos' }])
  })

  it('rejects a heading level change forced by a mocked validateRuntimeConfig failure: alert appears below the widget, the chosen segment stays visible, and the Monaco buffer is untouched (acceptance 8)', async () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(1))
    selectNodeByPath(root, HEADING_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H3' }))

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-props-error')
    expect(banner.textContent).toContain('invalid-layout')
    expect(banner.textContent).toContain('Cambio no permitido')
    expect(
      within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H3', checked: true }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const heading = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect((heading.props as Record<string, unknown>).level).toBe(1)
  })

  it('clears the alert once a follow-up commit succeeds, applying the new level (acceptance 8, follow-up)', async () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(1))
    selectNodeByPath(root, HEADING_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H3' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H4' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H4', checked: true }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const heading = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect((heading.props as Record<string, unknown>).level).toBe(4)
  })

  it('discards a pending rejection on the "Nivel" widget when the selected node changes, the same guard the rest of the panel already applies (edge case)', () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(2))
    selectNodeByPath(root, HEADING_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: 'H5' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    selectNodeByPath(root, TABS_PATH)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('radiogroup', { name: 'Orientación' })).getByRole('radio', {
        name: 'Horizontal',
        checked: true,
      }),
    ).toBeInTheDocument()
  })

  it('leaves the rest of the panel (props.text) editable and synced to Monaco alongside the "Nivel" widget (acceptance 9)', async () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(2))
    selectNodeByPath(root, HEADING_PATH)

    fireEvent.change(screen.getByLabelText('text', { exact: false }), { target: { value: 'Nuevo título' } })

    const parsed = await getMonacoJson()
    const heading = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect((heading.props as Record<string, unknown>).text).toBe('Nuevo título')
  })

  it('keeps mutual exclusion with the Monaco panel intact when the selected node renders the "Orientación" widget (acceptance 9)', async () => {
    const { root } = renderCanvas(headingTabsWidgetConfig(2))
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    selectNodeByPath(root, TABS_PATH)

    expect(screen.queryByTestId('monaco-editor-mock')).not.toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Orientación' })).toBeInTheDocument()
  })
})

// T5 (0128): fixture with a single top-level `container`, matching `headingTabsWidgetConfig`'s
// flat shape above — the "Modo" widget doesn't depend on ancestor columns either. `columns` is
// passed explicitly whenever a test needs "Columnas" pre-selected; omitted otherwise to exercise
// the "Grid" (absent `columns`) baseline. `direction`, when passed, is the prop the "regression:
// rest of Props stays editable" test edits and the reconstruction tests check survives untouched.
function containerModeWidgetConfig(columns?: number | Record<string, number>, direction?: string) {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'container',
            props: {
              ...(direction !== undefined ? { direction } : {}),
              ...(columns !== undefined ? { columns } : {}),
            },
            children: [{ type: 'heading', props: { text: 'Child', level: 2 } }],
          },
        ],
      },
    ],
  }
}

const CONTAINER_PATH = 'children.0'

describe('LayoutCanvasPropertiesPanel container columns mode widget — end-to-end real pipeline (T5, 0128)', () => {
  it('shows "Grid" active for a container without props.columns in the real config (acceptance 1)', () => {
    const { root } = renderCanvas(containerModeWidgetConfig())
    selectNodeByPath(root, CONTAINER_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Modo' })
    expect(within(radiogroup).getByRole('radio', { name: /Grid/, checked: true })).toBeInTheDocument()
  })

  it('shows "Columnas" active for a container with a fixed integer props.columns in the real config (acceptance 2)', () => {
    const { root } = renderCanvas(containerModeWidgetConfig(4))
    selectNodeByPath(root, CONTAINER_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Modo' })
    expect(within(radiogroup).getByRole('radio', { name: /Columnas/, checked: true })).toBeInTheDocument()
  })

  it('shows "Columnas" active for a container with a responsive columns map in the real config (acceptance 2)', () => {
    const { root } = renderCanvas(containerModeWidgetConfig({ base: 2, md: 4 }))
    selectNodeByPath(root, CONTAINER_PATH)

    const radiogroup = screen.getByRole('radiogroup', { name: 'Modo' })
    expect(within(radiogroup).getByRole('radio', { name: /Columnas/, checked: true })).toBeInTheDocument()
  })

  it('clicking "Columnas" commits props.columns = 2 through the real pipeline, preserving direction, and shows columns in Props (acceptance 3)', async () => {
    const { root } = renderCanvas(containerModeWidgetConfig(undefined, 'row'))
    selectNodeByPath(root, CONTAINER_PATH)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/ }))

    expect(
      within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/, checked: true }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('columns', { exact: false })).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const container = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect((container.props as Record<string, unknown>).columns).toBe(2)
    expect((container.props as Record<string, unknown>).direction).toBe('row')
  })

  it('clicking "Grid" commits props without columns through the real pipeline, preserving direction, and hides columns from Props (acceptance 4)', async () => {
    const { root } = renderCanvas(containerModeWidgetConfig(4, 'row'))
    selectNodeByPath(root, CONTAINER_PATH)

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Grid/ }))

    expect(
      within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Grid/, checked: true }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('columns', { exact: false })).not.toBeInTheDocument()

    const parsed = await getMonacoJson()
    const container = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect(container.props as Record<string, unknown>).not.toHaveProperty('columns')
    expect((container.props as Record<string, unknown>).direction).toBe('row')
  })

  it('rejects a mode change forced by a mocked validateRuntimeConfig failure: alert appears below the widget, the chosen segment stays visible, and the Monaco buffer is untouched (acceptance 8)', async () => {
    const { root } = renderCanvas(containerModeWidgetConfig())
    selectNodeByPath(root, CONTAINER_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/ }))

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-containerColumnsMode-error')
    expect(banner.textContent).toContain('invalid-layout')
    expect(banner.textContent).toContain('Cambio no permitido')
    expect(
      within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/, checked: true }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const container = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect(container.props as Record<string, unknown>).not.toHaveProperty('columns')
  })

  it('clears the alert once a follow-up commit succeeds, applying the new mode (acceptance 8, follow-up)', async () => {
    const { root } = renderCanvas(containerModeWidgetConfig(4))
    selectNodeByPath(root, CONTAINER_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Grid/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Follow-up: picking "Columnas" again is a genuine change relative to the widget's currently
    // displayed (rejected-attempt) state of "Grid", so it fires a fresh, unmocked commit that
    // succeeds through the real pipeline and clears the banner.
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/ }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/, checked: true }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const container = readTopLevelNodeFromMonacoJson(parsed, 0)
    // The follow-up "Columnas" commit reconstructs from the widget's displayed (rejected-attempt)
    // node — which had already dropped `columns` — so it seeds the default `2`, not the original
    // `4`. Same "no memory across mode switches" behavior the widget's own unit tests cover.
    expect((container.props as Record<string, unknown>).columns).toBe(2)
  })

  it('discards a pending rejection on the "Modo" widget when the selected node changes, the same guard the rest of the panel already applies (edge case)', () => {
    const { root } = renderCanvas({
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            { type: 'heading', props: { text: 'Título', level: 1 } },
            { type: 'container', props: {}, children: [{ type: 'heading', props: { text: 'Child', level: 2 } }] },
          ],
        },
      ],
    })
    selectNodeByPath(root, 'children.1')

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    selectNodeByPath(root, 'children.0')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('leaves the rest of the panel (props.direction) editable and synced to Monaco alongside the "Modo" widget (acceptance 9)', async () => {
    const { root } = renderCanvas(containerModeWidgetConfig(undefined, 'row'))
    selectNodeByPath(root, CONTAINER_PATH)

    fireEvent.change(screen.getByLabelText('direction', { exact: false }), { target: { value: 'column' } })

    const parsed = await getMonacoJson()
    const container = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect((container.props as Record<string, unknown>).direction).toBe('column')
  })

  it('keeps mutual exclusion with the Monaco panel intact when the selected node renders the "Modo" widget (acceptance 9)', async () => {
    const { root } = renderCanvas(containerModeWidgetConfig())
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    selectNodeByPath(root, CONTAINER_PATH)

    expect(screen.queryByTestId('monaco-editor-mock')).not.toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Modo' })).toBeInTheDocument()
  })

  // T5 (0133), regression: the "Modo" widget's rejection now renders inside the `Props` tabpanel
  // (rather than straddling the tab bar) — switching to another tab and back must not lose it,
  // same FR7 tab-switch guarantee the generic subsections already have (T4).
  it('keeps the "Modo" rejection banner and chosen value after switching to Visibilidad and back to Props (regression, T5)', () => {
    const { root } = renderCanvas(containerModeWidgetConfig())
    selectNodeByPath(root, CONTAINER_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.queryByRole('radiogroup', { name: 'Modo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Props' }))
    expect(
      within(screen.getByRole('radiogroup', { name: 'Modo' })).getByRole('radio', { name: /Columnas/, checked: true }),
    ).toBeInTheDocument()
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-containerColumnsMode-error')
  })
})

// T5 (0133): the form "Acción de envío" block moved from standalone (straddling the tab bar) to
// the top of the `Props` tabpanel. `formNodeSchema` declares no `props` key of its own, so its
// `Props` tab exists purely to host this block (`resolveNodePanelTabs`'s `submitAction` fallback);
// the operation `save` must exist in `api` for `executeOperation` to validate.
function formSubmitActionWidgetConfig() {
  return {
    api: { save: { method: 'POST', endpoint: '/save' } },
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          { type: 'heading', props: { text: 'Título', level: 1 } },
          {
            type: 'form',
            id: 'f1',
            submitAction: { type: 'executeOperation', operationName: 'save' },
            children: [],
          },
        ],
      },
    ],
  }
}

const FORM_HEADING_PATH = 'children.0'
const FORM_PATH = 'children.1'

function readFormFromMonacoJson(parsed: Record<string, unknown>): Record<string, unknown> {
  const pages = parsed.pages as Array<{ layout: Array<Record<string, unknown>> }>
  return pages[0].layout[1]
}

describe('LayoutCanvasPropertiesPanel form submitAction widget — end-to-end real pipeline (T5, 0133)', () => {
  it('shows the "Acción de envío" selector inside the Props tabpanel, preselecting the current variant', () => {
    const { root } = renderCanvas(formSubmitActionWidgetConfig())
    selectNodeByPath(root, FORM_PATH)

    expect(screen.getByRole('tab', { name: 'Props' })).toHaveAttribute('aria-selected', 'true')
    const tabpanel = screen.getByRole('tabpanel')
    const select = within(tabpanel).getByLabelText('Acción de envío') as HTMLSelectElement
    expect(select.value).toBe('executeOperation')
  })

  it('rejects a submitAction change forced by a mocked validateRuntimeConfig failure: alert appears inside Props, the chosen variant stays visible, and the Monaco buffer is untouched (regression)', async () => {
    const { root } = renderCanvas(formSubmitActionWidgetConfig())
    selectNodeByPath(root, FORM_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Acción de envío'), { target: { value: 'executeOperations' } })

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-submitAction-error')
    expect((screen.getByLabelText('Acción de envío') as HTMLSelectElement).value).toBe('executeOperations')

    const parsed = await getMonacoJson()
    const form = readFormFromMonacoJson(parsed)
    expect(form.submitAction).toEqual({ type: 'executeOperation', operationName: 'save' })
  })

  it('keeps the "Acción de envío" rejection banner and chosen variant after switching to Visibilidad and back to Props (regression)', () => {
    const { root } = renderCanvas(formSubmitActionWidgetConfig())
    selectNodeByPath(root, FORM_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Acción de envío'), { target: { value: 'executeOperations' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect(screen.queryByLabelText('Acción de envío')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Props' }))
    expect((screen.getByLabelText('Acción de envío') as HTMLSelectElement).value).toBe('executeOperations')
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-submitAction-error')
  })

  it('discards a pending "Acción de envío" rejection when the selected node changes (edge case)', () => {
    const { root } = renderCanvas(formSubmitActionWidgetConfig())
    selectNodeByPath(root, FORM_PATH)

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Acción de envío'), { target: { value: 'executeOperations' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    selectNodeByPath(root, FORM_HEADING_PATH)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// T2 (0129): fixture with a top-level `heading` (no icon widget, used by the edge-case test below
// to switch selection away from the button) and a `button` — the representative node for
// end-to-end coverage of the `icon` widget, per the task's own scope. The button has no `action`,
// so it must sit inside a `form` node (`validate-form-nodes.ts`'s "button without action must be a
// form descendant" rule) — the same shape `buttonNode` fixtures elsewhere in this file avoid only
// because they always declare an `action`. `icon` is always passed explicitly (every test below
// names a concrete starting value, recognized or not).
function buttonIconWidgetConfig(icon?: string) {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          { type: 'heading', props: { text: 'Título', level: 1 } },
          {
            type: 'form',
            id: 'f1',
            children: [{ type: 'button', props: { label: 'Enviar', ...(icon !== undefined ? { icon } : {}) } }],
          },
        ],
      },
    ],
  }
}

const HEADING_SIBLING_PATH = 'children.0'
const BUTTON_PATH = 'children.1.children.0'

// Reads the button nested inside the form's `children[0]`, matching `buttonIconWidgetConfig`'s shape.
function readButtonFromMonacoJson(parsed: Record<string, unknown>): Record<string, unknown> {
  const pages = parsed.pages as Array<{ layout: Array<Record<string, unknown>> }>
  const form = pages[0].layout[1] as { children: Array<Record<string, unknown>> }
  return form.children[0]
}

describe('LayoutCanvasPropertiesPanel icon widget — end-to-end real pipeline (T2, 0129)', () => {
  it('shows the widget with the "Home" cell highlighted for a recognized props.icon (acceptance 1)', () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)
    // The grid is hidden until the search input is focused (T5, 0129).
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const grid = screen.getByRole('grid', { name: 'icon' })
    const homeCell = within(grid).getByText('Home').closest('[role="gridcell"]')!
    expect(homeCell).toHaveAttribute('aria-selected', 'true')
  })

  it('typing a substring in the search input filters the grid to matching names (acceptance 2)', () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    fireEvent.change(input, { target: { value: 'set' } })

    // Scoped to the grid: the recognized-value preview chip (T5) keeps showing "Home" next to the
    // input regardless of the search query, so the negative assertion below must not see it.
    const grid = screen.getByRole('grid', { name: 'icon' })
    expect(within(grid).queryByText('Home')).not.toBeInTheDocument()
    expect(within(grid).getByText('Settings')).toBeInTheDocument()
  })

  it('clicking a different cell commits props.icon through the real pipeline, preserving props.label (acceptance 3)', async () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    const parsed = await getMonacoJson()
    const button = readButtonFromMonacoJson(parsed)
    expect((button.props as Record<string, unknown>).icon).toBe('Settings')
    expect((button.props as Record<string, unknown>).label).toBe('Enviar')
  })

  it('shows no highlighted cell for an unrecognized props.icon, with the raw value visible and search still operative (acceptance 4)', () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('NombreQueNoExiste'))
    selectNodeByPath(root, BUTTON_PATH)
    const input = screen.getByRole('textbox', { name: 'Buscar icono' })
    fireEvent.focus(input)

    const grid = screen.getByRole('grid', { name: 'icon' })
    expect(
      within(grid)
        .getAllByRole('gridcell')
        .every((cell) => cell.getAttribute('aria-selected') === 'false'),
    ).toBe(true)
    expect(screen.getByText('NombreQueNoExiste')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'home' } })
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('clicking the clear button commits props.icon = undefined through the real pipeline, preserving props.label (acceptance 5)', async () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)

    fireEvent.click(screen.getByRole('button', { name: /Quitar icono/i }))

    const parsed = await getMonacoJson()
    const button = readButtonFromMonacoJson(parsed)
    expect(button.props as Record<string, unknown>).not.toHaveProperty('icon')
    expect((button.props as Record<string, unknown>).label).toBe('Enviar')
  })

  it('rejects an icon change forced by a mocked validateRuntimeConfig failure: alert appears below the widget, the attempted cell stays highlighted, and the Monaco buffer is untouched (acceptance 6)', async () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-props-error')
    expect(banner.textContent).toContain('invalid-layout')
    expect(banner.textContent).toContain('Cambio no permitido')

    // Selecting a cell closes the grid (T5): reopen it to inspect the attempted cell's highlight.
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))
    const grid = screen.getByRole('grid', { name: 'icon' })
    const settingsCell = within(grid).getByText('Settings').closest('[role="gridcell"]')!
    expect(settingsCell).toHaveAttribute('aria-selected', 'true')

    const parsed = await getMonacoJson()
    const button = readButtonFromMonacoJson(parsed)
    expect((button.props as Record<string, unknown>).icon).toBe('Home')
  })

  it('clears the alert once a follow-up commit succeeds, applying the new icon (acceptance 6, follow-up)', async () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Selecting a cell closes the grid (T5): reopen it before the follow-up selection.
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))
    fireEvent.click(screen.getByText('Bell').closest('[role="gridcell"]')!)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const parsed = await getMonacoJson()
    const button = readButtonFromMonacoJson(parsed)
    expect((button.props as Record<string, unknown>).icon).toBe('Bell')
  })

  it('discards a pending rejection on the icon widget when the selected node changes, the same guard the rest of the panel already applies (edge case)', () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    selectNodeByPath(root, HEADING_SIBLING_PATH)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('leaves the rest of the panel (props.label) editable and synced to Monaco alongside the icon widget (acceptance 9)', async () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    selectNodeByPath(root, BUTTON_PATH)

    fireEvent.change(screen.getByLabelText('label', { exact: false }), { target: { value: 'Nuevo label' } })

    const parsed = await getMonacoJson()
    const button = readButtonFromMonacoJson(parsed)
    expect((button.props as Record<string, unknown>).label).toBe('Nuevo label')
  })

  it('keeps mutual exclusion with the Monaco panel intact when the selected node renders the icon widget (acceptance 9)', async () => {
    const { root } = renderCanvas(buttonIconWidgetConfig('Home'))
    fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
    await waitFor(() => expect(screen.getByTestId('monaco-editor-mock')).toBeInTheDocument())

    selectNodeByPath(root, BUTTON_PATH)
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    expect(screen.queryByTestId('monaco-editor-mock')).not.toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'icon' })).toBeInTheDocument()
  })
})

// T3 (0132): fixture with two top-level `button` nodes — one exercising `node.visibility`
// (Visibilidad subsection, the "Layout" surface of criterion 12) and the other exercising
// `props.action.operations[].when` for an `executeOperations` action (Props subsection, the
// "when de acción" surface) — for end-to-end coverage of the `condition-group` widget (T2/T3)
// through the real `DevRuntimeReady` commit pipeline. Both buttons live directly in `home`'s flat
// layout (no container ancestor), matching `headingTabsWidgetConfig`'s shape elsewhere in this
// file; each needs its own `action` (or, for the visibility button, a trivial one) so the
// "button without action must be a form descendant" cross-check in `validate-form-nodes.ts`
// doesn't reject the fixture itself.
function conditionGroupWidgetConfig() {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Ver detalle', action: { type: 'navigateTo', pageId: 'home' } },
            // `isFalsy` with no `value` key, referencing a query that isn't declared in `api`
            // (resolves to `undefined`, itself falsy): guarantees the condition evaluates `true`
            // so the node stays visible/selectable on the real canvas (`resolveLayoutNodeVisibility`
            // hides the node entirely when its own `visibility` evaluates `false` — even in Editor
            // mode), without needing a real query in the fixture.
            visibility: { reference: 'queries.list.status', operator: 'isFalsy' },
          },
          {
            type: 'button',
            props: {
              label: 'Enviar',
              action: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'save', when: { reference: 'forms.f1.urgent', operator: 'equals', value: 'yes' } },
                ],
              },
            },
          },
        ],
      },
    ],
  }
}

const VISIBILITY_BUTTON_PATH = 'children.0'
const WHEN_BUTTON_PATH = 'children.1'

describe('LayoutCanvasPropertiesPanel condition-group widget — end-to-end real pipeline (T3, 0132)', () => {
  // Criterion 12 (partial, Layout surface): switching the shape selector from "Condición simple"
  // to "Grupo (y/o)" on `node.visibility` runs the real pipeline and the resulting config wraps
  // the previous condition in a group, exactly like the widget's own unit coverage (T2) predicts.
  it('changing visibility from a simple condition to a group commits through the real pipeline (criterion 12, Layout)', async () => {
    const { root } = renderCanvas(conditionGroupWidgetConfig())
    selectNodeByPath(root, VISIBILITY_BUTTON_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    const shapeSelector = screen.getByRole('radiogroup', { name: 'Visibilidad — Forma' })
    expect(within(shapeSelector).getByRole('radio', { name: 'Condición simple', checked: true })).toBeInTheDocument()

    fireEvent.click(within(shapeSelector).getByRole('radio', { name: 'Grupo (y/o)' }))

    expect(
      within(screen.getByRole('radiogroup', { name: 'Visibilidad — Forma' })).getByRole('radio', {
        name: 'Grupo (y/o)',
        checked: true,
      }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const button = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect(button.visibility).toEqual({
      operator: 'and',
      conditions: [{ reference: 'queries.list.status', operator: 'isFalsy' }],
    })
  })

  // Criterion 12 (partial, "when" surface, shape change): same shape switch as above, applied to
  // `executeOperations.operations[0].when` inside the Props subsection instead of `visibility`.
  it('changing an executeOperations operation\'s "when" from a simple condition to a group commits through the real pipeline (criterion 12, when — forma)', async () => {
    const { root } = renderCanvas(conditionGroupWidgetConfig())
    selectNodeByPath(root, WHEN_BUTTON_PATH)

    const shapeSelector = screen.getByRole('radiogroup', { name: 'when — Forma' })
    fireEvent.click(within(shapeSelector).getByRole('radio', { name: 'Grupo (y/o)' }))

    expect(
      within(screen.getByRole('radiogroup', { name: 'when — Forma' })).getByRole('radio', {
        name: 'Grupo (y/o)',
        checked: true,
      }),
    ).toBeInTheDocument()

    const parsed = await getMonacoJson()
    const button = readTopLevelNodeFromMonacoJson(parsed, 1)
    const action = (button.props as Record<string, unknown>).action as Record<string, unknown>
    expect(action.operations).toEqual([
      {
        operationName: 'save',
        when: { operator: 'and', conditions: [{ reference: 'forms.f1.urgent', operator: 'equals', value: 'yes' }] },
      },
    ])
  })

  // Criterion 12 (partial, "when" surface, operator + value type change): changing the row's
  // operator, then choosing "Número" on the value type selector while `value` was still `''`
  // (spec's own example), also runs the real pipeline; `operationName` survives untouched.
  it('changing the operator and the value type of an executeOperations "when" condition commits through the real pipeline (criterion 12, when — operador y tipo de value)', async () => {
    const config = conditionGroupWidgetConfig()
    const whenButton = config.pages[0].layout[1] as { props: { action: Record<string, unknown> } }
    ;(whenButton.props.action.operations as Array<Record<string, unknown>>)[0].when = {
      reference: 'forms.f1.urgent',
      operator: 'equals',
      value: '',
    }
    const { root } = renderCanvas(config)
    selectNodeByPath(root, WHEN_BUTTON_PATH)

    fireEvent.change(screen.getByLabelText('when — Operador'), { target: { value: 'notEquals' } })
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'when — Valor — Tipo' })).getByRole('radio', { name: 'Número' }))

    const parsed = await getMonacoJson()
    const button = readTopLevelNodeFromMonacoJson(parsed, 1)
    const action = (button.props as Record<string, unknown>).action as Record<string, unknown>
    expect(action.operations).toEqual([
      { operationName: 'save', when: { reference: 'forms.f1.urgent', operator: 'notEquals', value: 0 } },
    ])
  })

  // Criterion 13: forcing a real-shaped rejection (same `forcedRejection` pattern the
  // heading-level/tabs-orientation/icon widgets above already use) on a visibility change keeps
  // the attempted value visible in the widget, shows the alert under the Visibilidad subsection,
  // and leaves the Monaco buffer untouched.
  it('rejects a visibility change forced by a mocked validateRuntimeConfig failure: alert appears under Visibilidad, the attempted condition stays visible, and the Monaco buffer is untouched (criterion 13)', async () => {
    const { root } = renderCanvas(conditionGroupWidgetConfig())
    selectNodeByPath(root, VISIBILITY_BUTTON_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Visibilidad — Operador'), { target: { value: 'greaterThan' } })

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-visibility-error')
    expect(banner.textContent).toContain('invalid-layout')
    expect(banner.textContent).toContain('Cambio no permitido')

    expect((screen.getByLabelText('Visibilidad — Operador') as HTMLSelectElement).value).toBe('greaterThan')
    expect(screen.getByLabelText('Visibilidad — Valor')).toHaveValue(0)

    const parsed = await getMonacoJson()
    const button = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect(button.visibility).toEqual({ reference: 'queries.list.status', operator: 'isFalsy' })
  })

  it('clears the visibility alert once a valid follow-up commit succeeds (criterion 13, follow-up)', async () => {
    const { root } = renderCanvas(conditionGroupWidgetConfig())
    selectNodeByPath(root, VISIBILITY_BUTTON_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Visibilidad — Operador'), { target: { value: 'greaterThan' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Visibilidad — Valor'), { target: { value: '5' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const parsed = await getMonacoJson()
    const button = readTopLevelNodeFromMonacoJson(parsed, 0)
    expect(button.visibility).toEqual({ reference: 'queries.list.status', operator: 'greaterThan', value: 5 })
  })

  // T4 (0133), FR7: switching tabs — not just staying on the rejected one — does not discard a
  // pending rejection; the attempted value and the banner both survive a round trip to another
  // tab and back, on the very same node.
  it('keeps the attempted visibility value and its alert after switching to Props and back (FR7)', () => {
    const { root } = renderCanvas(conditionGroupWidgetConfig())
    selectNodeByPath(root, VISIBILITY_BUTTON_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Visibilidad — Operador'), { target: { value: 'greaterThan' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Props' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    expect((screen.getByLabelText('Visibilidad — Operador') as HTMLSelectElement).value).toBe('greaterThan')
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', 'layout-canvas-properties-panel-visibility-error')
  })

  it('discards a pending visibility rejection when the selected node changes (criterion 13, follow-up)', () => {
    const { root } = renderCanvas(conditionGroupWidgetConfig())
    selectNodeByPath(root, VISIBILITY_BUTTON_PATH)
    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    vi.mocked(validateRuntimeConfig).mockReturnValueOnce(forcedRejection)
    fireEvent.change(screen.getByLabelText('Visibilidad — Operador'), { target: { value: 'greaterThan' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    selectNodeByPath(root, WHEN_BUTTON_PATH)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// Criterion 14 (regression, non-functional): the sentinel injection (T1/T3) happens once on the
// cold cache path of `getNodeTypeJsonSchema`, so both `node.visibility` and every `when` nested
// inside `props.action`'s `executeOperations` variant carry the sentinel, and the getter itself
// keeps returning the same cached reference across calls.
describe('LayoutCanvasPropertiesPanel condition-group widget schema sentinel (T3, 0132, criterion 14)', () => {
  it('injects the condition-group sentinel into node.visibility for a representative node type, and into props.action.oneOf[executeOperations].operations[].when for button', () => {
    const containerSchema = getNodeTypeJsonSchema('container')
    expect((containerSchema.properties as Record<string, unknown>).visibility).toEqual({ 'x-widget': 'condition-group' })

    const buttonSchema = getNodeTypeJsonSchema('button')
    expect((buttonSchema.properties as Record<string, unknown>).visibility).toEqual({ 'x-widget': 'condition-group' })

    const propsSchema = (buttonSchema.properties as Record<string, unknown>).props as Record<string, unknown>
    const actionSchema = (propsSchema.properties as Record<string, unknown>).action as Record<string, unknown>
    const actionVariants = actionSchema.oneOf as Array<Record<string, unknown>>
    const executeOperationsVariant = actionVariants.find((variant) => {
      const typeSchema = (variant.properties as Record<string, unknown>).type as Record<string, unknown>
      return typeSchema.const === 'executeOperations'
    })
    expect(executeOperationsVariant).toBeDefined()

    const operationsFieldSchema = (executeOperationsVariant!.properties as Record<string, unknown>).operations as Record<string, unknown>
    const operationItemSchema = operationsFieldSchema.items as Record<string, unknown>
    expect((operationItemSchema.properties as Record<string, unknown>).when).toEqual({ 'x-widget': 'condition-group' })

    // The transform runs once, on the cold cache path: a second call returns the exact same
    // object reference, not a freshly-transformed equal-but-distinct one.
    expect(getNodeTypeJsonSchema('button')).toBe(buttonSchema)
  })
})
