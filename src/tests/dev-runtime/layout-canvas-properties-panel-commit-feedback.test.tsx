import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { LayoutCanvasPropertiesPanel } from '../../dev-runtime/layout-canvas/layout-canvas-properties-panel'
import type { CommitCanvasMutationResult } from '../../dev-runtime/layout-canvas/layout-canvas-commit'

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
})
