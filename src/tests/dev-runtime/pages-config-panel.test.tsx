import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config-types'
import {
  patchRawConfigTextWithPages,
  patchRootKey,
  type CommitCanvasMutationResult,
} from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { PagesConfigPanel } from '../../dev-runtime/pages-config-panel/pages-config-panel'

function buildBaseConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      { id: 'home', layout: [] },
      { id: 'about', layout: [] },
    ],
    ...overrides,
  } as RuntimeConfig
}

interface HarnessProps {
  initialConfig?: RuntimeConfig
  // Lets a test seed a raw text that diverges from `JSON.stringify(initialConfig)` — e.g. a page
  // `preloads` entry in its raw crude shape (`{ [operationName]: requestParams }`), which isn't
  // assignable to the normalized `RuntimePageConfig.preloads` type `initialConfig` uses.
  initialRawText?: string
}

// Reproduces the real dev-runtime.tsx commit pipeline (`patchRawConfigTextWithPages`/
// `patchRootKey` + `validateRuntimeConfig`), same pattern as shell-config-panel.test.tsx/
// translations-config-panel.test.tsx, with two local commit functions — one scoped to `pages`,
// one scoped to `initialPage` — instead of mounting the real `DevRuntimeReady` tree.
// `commitPagesMutation` uses `patchRawConfigTextWithPages`, not a bare `patchRootKey`, so it
// preserves the raw shape of every untouched page's `preloads`/`layout` the same way
// `dev-runtime.tsx`'s real `commitPagesMutation` does.
function PagesConfigPanelHarness({ initialConfig, initialRawText }: HarnessProps) {
  const base = initialConfig ?? buildBaseConfig()
  const [config, setConfig] = useState<RuntimeConfig>(base)
  const [rawText, setRawText] = useState(() => initialRawText ?? JSON.stringify(base, null, 2))

  function applyPatchedText(nextText: string): CommitCanvasMutationResult {
    const parsed: unknown = JSON.parse(nextText)
    const validation = validateRuntimeConfig(parsed)
    if (validation.status === 'error') {
      return { status: 'rejected', error: validation.error }
    }
    setConfig(validation.config)
    setRawText(nextText)
    return { status: 'applied' }
  }

  function commitPagesMutation(mutate: (pages: RuntimePageConfig[]) => RuntimePageConfig[]): CommitCanvasMutationResult {
    return applyPatchedText(patchRawConfigTextWithPages(rawText, mutate(config.pages)))
  }

  function commitInitialPageMutation(mutate: (initialPage: string) => string): CommitCanvasMutationResult {
    return applyPatchedText(patchRootKey(rawText, 'initialPage', mutate(config.initialPage)))
  }

  return (
    <>
      <PagesConfigPanel
        config={config}
        onCommitPagesMutation={commitPagesMutation}
        onCommitInitialPageMutation={commitInitialPageMutation}
      />
      <pre data-testid="raw-text">{rawText}</pre>
    </>
  )
}

function renderHarness(initialConfig?: RuntimeConfig, initialRawText?: string) {
  return render(<PagesConfigPanelHarness initialConfig={initialConfig} initialRawText={initialRawText} />)
}

function rawConfig(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('raw-text').textContent ?? '{}')
}

const noopCommitPagesMutation = (): CommitCanvasMutationResult => ({ status: 'applied' })
const noopCommitInitialPageMutation = (): CommitCanvasMutationResult => ({ status: 'applied' })

describe('PagesConfigPanel listing', () => {
  it('renders one row per page with id, title (or a placeholder) and the initial-page mark', () => {
    renderHarness(
      buildBaseConfig({
        pages: [
          { id: 'home', title: 'Inicio', layout: [] },
          { id: 'about', layout: [] },
        ],
      }),
    )

    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Título de home' })).toHaveValue('Inicio')
    expect(screen.getByRole('textbox', { name: 'Título de about' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Título de about' })).toHaveAttribute('placeholder', 'Sin título')

    expect(screen.getByTestId('pages-config-panel-initial-badge-home')).toBeInTheDocument()
    expect(screen.queryByTestId('pages-config-panel-initial-badge-about')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Marcar home como página inicial' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Marcar about como página inicial' })).not.toBeChecked()
  })
})

describe('PagesConfigPanel creation', () => {
  it('adds a new page with layout: [] and never marks it as initial', () => {
    renderHarness()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'contact' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Contacto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    expect(rawConfig().pages).toEqual([
      { id: 'home', layout: [] },
      { id: 'about', layout: [] },
      { id: 'contact', layout: [], title: 'Contacto' },
    ])
    expect((rawConfig() as { initialPage: string }).initialPage).toBe('home')
    expect(screen.getByRole('textbox', { name: 'Título de contact' })).toBeInTheDocument()
    expect(screen.queryByTestId('pages-config-panel-initial-badge-contact')).not.toBeInTheDocument()
  })

  it('clears the form after a successful creation', () => {
    renderHarness()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'contact' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    expect(screen.getByLabelText('Id')).toHaveValue('')
    expect(screen.getByLabelText('Título')).toHaveValue('')
  })

  it('disables "Crear" and shows a reason without committing when id is empty (including only spaces)', () => {
    const onCommitPagesMutation = vi.fn(noopCommitPagesMutation)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={onCommitPagesMutation}
        onCommitInitialPageMutation={noopCommitInitialPageMutation}
      />,
    )

    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()
    expect(screen.getByText(/no puede estar vacío/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(onCommitPagesMutation).not.toHaveBeenCalled()
  })

  it('disables "Crear" and shows a reason without committing when id normalizes to a duplicate, including one with surrounding spaces', () => {
    const onCommitPagesMutation = vi.fn(noopCommitPagesMutation)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={onCommitPagesMutation}
        onCommitInitialPageMutation={noopCommitInitialPageMutation}
      />,
    )

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: '  home  ' } })
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()
    expect(screen.getByText(/ya existe/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(onCommitPagesMutation).not.toHaveBeenCalled()
  })

  it('keeps the typed values and shows a role="alert" banner when the creation commit is rejected', () => {
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitPagesMutation = vi.fn(() => rejected)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={onCommitPagesMutation}
        onCommitInitialPageMutation={noopCommitInitialPageMutation}
      />,
    )

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'contact' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Contacto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    expect(onCommitPagesMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Id')).toHaveValue('contact')
    expect(screen.getByLabelText('Título')).toHaveValue('Contacto')
  })
})

describe('PagesConfigPanel title editing', () => {
  it('commits an edited title on blur and shows the new value', () => {
    renderHarness()

    const input = screen.getByRole('textbox', { name: 'Título de home' })
    fireEvent.change(input, { target: { value: 'Inicio' } })
    fireEvent.blur(input)

    expect((rawConfig().pages as RuntimePageConfig[])[0]).toEqual({ id: 'home', layout: [], title: 'Inicio' })
    expect(screen.getByRole('textbox', { name: 'Título de home' })).toHaveValue('Inicio')
  })

  it('clearing the title on blur commits and reverts to the placeholder', () => {
    renderHarness(
      buildBaseConfig({
        pages: [
          { id: 'home', title: 'Inicio', layout: [] },
          { id: 'about', layout: [] },
        ],
      }),
    )

    const input = screen.getByRole('textbox', { name: 'Título de home' })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    expect((rawConfig().pages as RuntimePageConfig[])[0]).toEqual({ id: 'home', layout: [] })
    expect(screen.getByRole('textbox', { name: 'Título de home' })).toHaveValue('')
  })

  it('does not commit when blurring without an actual value change', () => {
    const onCommitPagesMutation = vi.fn(noopCommitPagesMutation)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={onCommitPagesMutation}
        onCommitInitialPageMutation={noopCommitInitialPageMutation}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Título de home' })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    expect(onCommitPagesMutation).not.toHaveBeenCalled()
  })

  it('keeps the typed value in that row and shows a role="alert" banner when the title commit is rejected', () => {
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitPagesMutation = vi.fn(() => rejected)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={onCommitPagesMutation}
        onCommitInitialPageMutation={noopCommitInitialPageMutation}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Título de home' })
    fireEvent.change(input, { target: { value: 'Inicio' } })
    fireEvent.blur(input)

    expect(onCommitPagesMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Título de home' })).toHaveValue('Inicio')
  })
})

describe('PagesConfigPanel initial page designation', () => {
  it('selecting another page as initial updates the "inicial" mark on all rows after the commit', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('radio', { name: 'Marcar about como página inicial' }))

    expect((rawConfig() as { initialPage: string }).initialPage).toBe('about')
    expect(screen.getByTestId('pages-config-panel-initial-badge-about')).toBeInTheDocument()
    expect(screen.queryByTestId('pages-config-panel-initial-badge-home')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Marcar about como página inicial' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Marcar home como página inicial' })).not.toBeChecked()
  })

  it('shows a CommitRejectionBanner next to the control when the initial-page commit is rejected', () => {
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitInitialPageMutation = vi.fn(() => rejected)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={noopCommitPagesMutation}
        onCommitInitialPageMutation={onCommitInitialPageMutation}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Marcar about como página inicial' }))

    expect(onCommitInitialPageMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('PagesConfigPanel delete blocking', () => {
  it('disables "Eliminar" with an explicit reason for the only remaining page', () => {
    renderHarness(buildBaseConfig({ pages: [{ id: 'home', layout: [] }] }))

    const button = screen.getByRole('button', { name: 'Eliminar página home' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringMatching(/única página/i))
  })

  it('disables "Eliminar" with an explicit reason for the page marked as initial, when there is more than one page', () => {
    renderHarness()

    const button = screen.getByRole('button', { name: 'Eliminar página home' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringMatching(/página inicial/i))
    expect(screen.getByRole('button', { name: 'Eliminar página about' })).not.toBeDisabled()
  })
})

describe('PagesConfigPanel delete flow', () => {
  it('opens PagesDeleteConfirmDialog when clicking an enabled "Eliminar", confirming removes the page and cancelling keeps it', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar página about' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((rawConfig().pages as RuntimePageConfig[]).map((p) => p.id)).toEqual(['home', 'about'])

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar página about' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((rawConfig().pages as RuntimePageConfig[]).map((p) => p.id)).toEqual(['home'])
  })

  it('shows the orphan navigateTo warning in the confirm dialog when a reference targets the page to delete', () => {
    renderHarness(
      buildBaseConfig({
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Ir', action: { type: 'navigateTo', pageId: 'about' } },
              },
            ],
          },
          { id: 'about', layout: [] },
        ],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar página about' }))

    expect(screen.getByTestId('pages-delete-confirm-orphan-warning')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).getByText(/1 referencia/)).toBeInTheDocument()
  })

  it('does not show the orphan navigateTo warning when there is no reference to the page to delete', () => {
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar página about' }))

    expect(screen.queryByTestId('pages-delete-confirm-orphan-warning')).not.toBeInTheDocument()
  })

  it('shows a CommitRejectionBanner at row level when the delete commit is rejected', () => {
    const rejected: CommitCanvasMutationResult = {
      status: 'rejected',
      error: { code: 'invalid-layout', displayMode: 'development-only', message: 'Valor no válido' },
    }
    const onCommitPagesMutation = vi.fn(() => rejected)
    render(
      <PagesConfigPanel
        config={buildBaseConfig()}
        onCommitPagesMutation={onCommitPagesMutation}
        onCommitInitialPageMutation={noopCommitInitialPageMutation}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar página about' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(onCommitPagesMutation).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('PagesConfigPanel raw preloads preservation', () => {
  it('creating a page does not corrupt the raw crude shape of another page\'s preloads', () => {
    const rawText = JSON.stringify(
      {
        api: {},
        initialPage: 'home',
        pages: [
          { id: 'home', layout: [], preloads: [{ getTodos: {} }] },
          { id: 'about', layout: [] },
        ],
      },
      null,
      2,
    )
    const validation = validateRuntimeConfig(JSON.parse(rawText))
    if (validation.status !== 'ready') throw new Error('setup: base raw config should validate')

    renderHarness(validation.config, rawText)

    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'contact' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect((rawConfig().pages as Array<Record<string, unknown>>)[0]).toEqual({
      id: 'home',
      layout: [],
      preloads: [{ getTodos: {} }],
    })
    expect((rawConfig().pages as Array<{ id: string }>).map((p) => p.id)).toEqual(['home', 'about', 'contact'])
  })
})
