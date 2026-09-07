import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { RuntimeConfig, RuntimeGroupsConfig } from '../../config/runtime-config-types'
import {
  patchRootKey,
  type CommitCanvasMutationResult,
  type CommitResult,
  type LayoutCanvasTarget,
  type LayoutTreeMutation,
} from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { GroupsConfigPanel } from '../../dev-runtime/groups-config-panel/groups-config-panel'

// Isolated component test (same level as tokens-config-panel.test.tsx/pages-config-panel.test.tsx):
// `DevEditorGroupsCanvas` renders a real `LayoutRenderer`, which needs a `RuntimeStateProvider`
// ancestor this file deliberately doesn't mount — canvas retargeting/mock-context behavior is
// covered end to end by dev-editor-groups-canvas.test.tsx instead. This stub only lets
// GroupsConfigPanel's own selection wiring (which groupId it asks the canvas to render) be
// observed without duplicating that other file's coverage.
vi.mock('../../dev-runtime/floating-toolbar/dev-editor-groups-canvas', () => ({
  DevEditorGroupsCanvas: ({ groupId }: { groupId: string }) => (
    <div data-testid="dev-editor-groups-canvas-stub">{groupId}</div>
  ),
}))

function buildBaseConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
    groups: {
      card: { params: ['title'], template: [] },
      banner: { params: [], template: [] },
    },
    ...overrides,
  } as RuntimeConfig
}

interface HarnessProps {
  initialConfig?: RuntimeConfig
}

const noopCommitLayoutMutation = (): CommitResult => ({ status: 'applied' })

// Reproduces the real dev-runtime.tsx commit pipeline for the `groups` root key
// (`patchRootKey` + `validateRuntimeConfig`), same pattern as
// pages-config-panel.test.tsx/tokens-config-panel.test.tsx's local harness.
function GroupsConfigPanelHarness({ initialConfig }: HarnessProps) {
  const base = initialConfig ?? buildBaseConfig()
  const [config, setConfig] = useState<RuntimeConfig>(base)
  const [rawText, setRawText] = useState(() => JSON.stringify(base, null, 2))

  function commitGroupsMutation(
    mutate: (groups: RuntimeGroupsConfig) => RuntimeGroupsConfig,
  ): CommitCanvasMutationResult {
    const nextText = patchRootKey(rawText, 'groups', mutate(config.groups ?? {}))
    const parsed: unknown = JSON.parse(nextText)
    const validation = validateRuntimeConfig(parsed)
    if (validation.status === 'error') {
      return { status: 'rejected', error: validation.error }
    }
    setConfig(validation.config)
    setRawText(nextText)
    return { status: 'applied' }
  }

  return (
    <>
      <GroupsConfigPanel
        config={config}
        onCommitGroupsMutation={commitGroupsMutation}
        onCommitLayoutMutation={noopCommitLayoutMutation}
      />
      <pre data-testid="raw-text">{rawText}</pre>
    </>
  )
}

function renderHarness(initialConfig?: RuntimeConfig) {
  return render(<GroupsConfigPanelHarness initialConfig={initialConfig} />)
}

function rawConfig(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('raw-text').textContent ?? '{}')
}

const noopCommitGroupsMutation = (): CommitCanvasMutationResult => ({ status: 'applied' })

function renderPanel(
  config: RuntimeConfig,
  onCommitGroupsMutation: (mutate: (groups: RuntimeGroupsConfig) => RuntimeGroupsConfig) => CommitCanvasMutationResult = noopCommitGroupsMutation,
  onCommitLayoutMutation: (target: LayoutCanvasTarget, patch: LayoutTreeMutation) => CommitResult = noopCommitLayoutMutation,
) {
  return render(
    <GroupsConfigPanel
      config={config}
      onCommitGroupsMutation={onCommitGroupsMutation}
      onCommitLayoutMutation={onCommitLayoutMutation}
    />,
  )
}

describe('GroupsConfigPanel empty state', () => {
  it('shows a message when config.groups is undefined', () => {
    renderPanel(buildBaseConfig({ groups: undefined }))
    expect(screen.getByText(/Sin grupos declarados/i)).toBeInTheDocument()
  })

  it('shows a message when config.groups is {}', () => {
    renderPanel(buildBaseConfig({ groups: {} }))
    expect(screen.getByText(/Sin grupos declarados/i)).toBeInTheDocument()
  })
})

describe('GroupsConfigPanel listing', () => {
  it('lists every declared groupId with its params', () => {
    renderHarness()

    expect(screen.getByTestId('groups-config-panel-group-card')).toBeInTheDocument()
    expect(screen.getByTestId('groups-config-panel-group-banner')).toBeInTheDocument()
    expect(within(screen.getByTestId('groups-config-panel-group-card')).getByText('title')).toBeInTheDocument()
  })
})

describe('GroupsConfigPanel creation', () => {
  it('adds a new groupId with empty params and template', () => {
    renderHarness()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'panel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir grupo' }))

    expect((rawConfig().groups as RuntimeGroupsConfig).panel).toEqual({ params: [], template: [] })
  })

  it('normalizes a leading/trailing-space id the same way pages-config-panel does', () => {
    renderHarness()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: '  panel  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir grupo' }))

    expect((rawConfig().groups as RuntimeGroupsConfig).panel).toBeDefined()
  })

  it('clears the form after a successful creation', () => {
    renderHarness()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'panel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir grupo' }))

    expect(screen.getByLabelText('Id')).toHaveValue('')
  })

  it('disables "Añadir grupo" and shows a reason without committing when id is empty', () => {
    const onCommitGroupsMutation = vi.fn(noopCommitGroupsMutation)
    renderPanel(buildBaseConfig(), onCommitGroupsMutation)

    expect(screen.getByRole('button', { name: 'Añadir grupo' })).toBeDisabled()
    expect(screen.getByText(/no puede estar vacío/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir grupo' }))
    expect(onCommitGroupsMutation).not.toHaveBeenCalled()
  })

  it('disables "Añadir grupo" and shows a reason without committing when id already exists', () => {
    const onCommitGroupsMutation = vi.fn(noopCommitGroupsMutation)
    renderPanel(buildBaseConfig(), onCommitGroupsMutation)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'card' } })
    expect(screen.getByRole('button', { name: 'Añadir grupo' })).toBeDisabled()
    expect(screen.getByText(/ya existe/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir grupo' }))
    expect(onCommitGroupsMutation).not.toHaveBeenCalled()
  })

  it('keeps the typed id and shows a role="alert" banner when the creation commit is rejected', () => {
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitGroupsMutation = vi.fn(() => rejected)
    renderPanel(buildBaseConfig(), onCommitGroupsMutation)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'panel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir grupo' }))

    expect(onCommitGroupsMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Id')).toHaveValue('panel')
  })
})

describe('GroupsConfigPanel rename', () => {
  it('renaming a group on blur preserves its params and template under the new id', () => {
    renderHarness()

    const input = screen.getByLabelText('Id de card')
    fireEvent.change(input, { target: { value: 'product-card' } })
    fireEvent.blur(input)

    const groups = rawConfig().groups as RuntimeGroupsConfig
    expect(groups.card).toBeUndefined()
    expect(groups['product-card']).toEqual({ params: ['title'], template: [] })
  })

  it('does not commit when blurring without an actual value change', () => {
    const onCommitGroupsMutation = vi.fn(noopCommitGroupsMutation)
    renderPanel(buildBaseConfig(), onCommitGroupsMutation)

    const input = screen.getByLabelText('Id de card')
    fireEvent.change(input, { target: { value: 'card' } })
    fireEvent.blur(input)

    expect(onCommitGroupsMutation).not.toHaveBeenCalled()
  })

  it('rejects the rename with a role="alert" banner when the new id already exists, without committing', () => {
    const onCommitGroupsMutation = vi.fn(noopCommitGroupsMutation)
    renderPanel(buildBaseConfig(), onCommitGroupsMutation)

    const input = screen.getByLabelText('Id de card')
    fireEvent.change(input, { target: { value: 'banner' } })
    fireEvent.blur(input)

    expect(onCommitGroupsMutation).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('GroupsConfigPanel params', () => {
  it('adds a new param name to the targeted group', () => {
    renderHarness()

    fireEvent.change(screen.getByLabelText('Nuevo parámetro de banner'), { target: { value: 'subtitle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir parámetro a banner' }))

    const groups = rawConfig().groups as RuntimeGroupsConfig
    expect(groups.banner.params).toEqual(['subtitle'])
  })

  it('disables adding an empty or duplicate param name', () => {
    renderHarness()

    expect(screen.getByRole('button', { name: 'Añadir parámetro a card' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Nuevo parámetro de card'), { target: { value: 'title' } })
    expect(screen.getByRole('button', { name: 'Añadir parámetro a card' })).toBeDisabled()
  })

  it('removes a param via its own remove control', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar parámetro title de card' }))

    const groups = rawConfig().groups as RuntimeGroupsConfig
    expect(groups.card.params).toEqual([])
  })
})

describe('GroupsConfigPanel delete flow', () => {
  it('opens a confirm dialog, cancelling keeps the group and confirming removes it', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo banner' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((rawConfig().groups as RuntimeGroupsConfig).banner).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo banner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((rawConfig().groups as RuntimeGroupsConfig).banner).toBeUndefined()
  })

  it('shows a role="alert" banner at row level when the delete commit is rejected', () => {
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitGroupsMutation = vi.fn(() => rejected)
    renderPanel(buildBaseConfig(), onCommitGroupsMutation)

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo banner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(onCommitGroupsMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('GroupsConfigPanel selection and canvas retargeting', () => {
  it('shows no canvas until a group is selected', () => {
    renderHarness()
    expect(screen.queryByTestId('dev-editor-groups-canvas-stub')).not.toBeInTheDocument()
  })

  it('selecting a group renders the canvas retargeted to it, and selecting another swaps it', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar grupo card' }))
    expect(screen.getByTestId('dev-editor-groups-canvas-stub')).toHaveTextContent('card')

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar grupo banner' }))
    expect(screen.getByTestId('dev-editor-groups-canvas-stub')).toHaveTextContent('banner')
  })

  it('deleting the currently selected group clears the canvas', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar grupo banner' }))
    expect(screen.getByTestId('dev-editor-groups-canvas-stub')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo banner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.queryByTestId('dev-editor-groups-canvas-stub')).not.toBeInTheDocument()
  })
})
