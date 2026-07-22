import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  // Regression (T4): `visibility` is a union at the subsection's own top-level `schema` (single
  // condition | group), still resolved by the panel's own `resolveUnionBranch` call before ever
  // reaching the dispatcher — the group branch must keep rendering as an editable form (with its
  // own nested `conditions` array of condition objects), not fall back to the disabled raw-JSON
  // escape hatch, now that the helper lives in the dispatcher module.
  it('renders the group branch (operator + conditions) of visibility, not the single-condition branch, when the current value is a group', () => {
    const node: LayoutNode = {
      type: 'container',
      props: { direction: 'row' },
      visibility: {
        operator: 'and',
        conditions: [{ reference: 'queries.list.state', operator: 'equals', value: 'ready' }],
      },
    } as LayoutNode
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const conditionsGroup = screen.getByRole('group', { name: 'conditions' })
    const firstConditionGroup = within(conditionsGroup).getByRole('group', { name: 'conditions #1' })
    const referenceField = within(firstConditionGroup).getByLabelText('reference', { exact: false })
    expect(referenceField).toHaveValue('queries.list.state')

    fireEvent.change(referenceField, { target: { value: 'queries.list.otherState' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'container' }>
    expect(result.visibility).toEqual({
      operator: 'and',
      conditions: [{ reference: 'queries.list.otherState', operator: 'equals', value: 'ready' }],
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

  // Regression (T4): `layout.span` is a union nested one level inside `layout.properties.span`
  // (integer | responsive per-breakpoint map). Resolution of that branch used to be a
  // panel-specific `resolveLayoutSubsectionSchema` helper; it is now the dispatcher's own
  // `ObjectPropertyField` recursion (T4) resolving it against `layout.span`'s current value.
  // The plain-integer variant must keep rendering as a single numeric field, not the responsive
  // per-breakpoint object form nor the disabled raw-JSON escape hatch.
  it('edits an integer layout.span as a single numeric field, replacing the whole value', () => {
    const node: LayoutNode = {
      type: 'container',
      layout: { span: 6 },
    } as LayoutNode
    const onCommitNodeUpdate = vi.fn()
    render(<LayoutCanvasPropertiesPanel node={node} path={somePath} onCommitNodeUpdate={onCommitNodeUpdate} />)

    const spanField = screen.getByLabelText('span', { exact: false }) as HTMLInputElement
    expect(spanField).toHaveAttribute('type', 'number')
    expect(spanField.value).toBe('6')

    fireEvent.change(spanField, { target: { value: '9' } })

    expect(onCommitNodeUpdate).toHaveBeenCalledTimes(1)
    const [, updater] = onCommitNodeUpdate.mock.calls[0]
    const result = updater(node) as Extract<LayoutNode, { type: 'container' }>

    expect(result.layout).toEqual({ span: 9 })
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
    const whenReferenceField = within(entryGroup).getByLabelText('reference', { exact: false })
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
    const whenReferenceField = within(entryGroup).getByLabelText('reference', { exact: false })
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
