import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasPropertiesPanel } from '../../dev-runtime/layout-canvas/layout-canvas-properties-panel'
import { DevRuntimeReady } from '../../dev-runtime/dev-runtime'

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

describe('LayoutCanvasPropertiesPanel visibility section', () => {
  function containerWithVisibility(): LayoutNode {
    return {
      type: 'container',
      props: { direction: 'row' },
      visibility: { reference: 'queries.list.state', operator: 'equals', value: 'ready' },
    } as LayoutNode
  }

  it('changing a visibility field updates only node.visibility, leaving props untouched', () => {
    const node = containerWithVisibility()
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('reference', { exact: false }), { target: { value: 'queries.list.otherState' } })

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
})

describe('LayoutCanvasPropertiesPanel layout.span edge case', () => {
  it('preserves other breakpoints when editing a single breakpoint of a responsive layout.span', () => {
    const node: LayoutNode = {
      type: 'container',
      layout: { span: { sm: 6, lg: 4 } },
    } as LayoutNode
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    fireEvent.change(screen.getByLabelText('sm'), { target: { value: '8' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'container' }>

    expect(result.layout).toEqual({ span: { sm: 8, lg: 4 } })
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
})
