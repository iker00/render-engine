import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevEditorFloatingToolbar } from '../../dev-runtime/floating-toolbar/dev-editor-floating-toolbar'
import type {
  SaveConfigErrorInfo,
  SaveState,
} from '../../dev-runtime/floating-toolbar/dev-editor-floating-toolbar'
import type { ResolvedEndpointOperation } from '../../dev-runtime/endpoints-config/resolve-endpoint-operation'

interface RenderOptions {
  mode?: 'visual' | 'editor'
  onModeChange?: (mode: 'visual' | 'editor') => void
  pages?: ReadonlyArray<{ id: string }>
  activePageId?: string
  onActivePageIdChange?: (pageId: string) => void
  activeDomain?: 'layout' | 'shell' | 'translations'
  onDomainSelected?: (domain: 'layout' | 'shell' | 'translations') => void
  onOpenMonaco?: () => void
  isMonacoOpen?: boolean
  onOpenPalette?: () => void
  isPaletteOpen?: boolean
  saveResolution?: ResolvedEndpointOperation
  saveState?: SaveState
  saveError?: SaveConfigErrorInfo | null
  onSave?: () => void
}

// T6 (0131): the "ready" resolution used as the default for every test that doesn't specifically
// exercise the "unavailable" branch, mirroring `resolveEndpointOperation`'s own `status: 'ready'`
// shape (url/token already resolved).
const READY_SAVE_RESOLUTION: ResolvedEndpointOperation = {
  status: 'ready',
  url: 'https://example.test/save',
  token: 'tok-1',
}

function renderToolbar(overrides: RenderOptions = {}) {
  const props = {
    mode: overrides.mode ?? ('visual' as const),
    onModeChange: overrides.onModeChange ?? vi.fn(),
    pages: overrides.pages ?? [{ id: 'home' }, { id: 'about' }],
    activePageId: overrides.activePageId ?? 'home',
    onActivePageIdChange: overrides.onActivePageIdChange ?? vi.fn(),
    activeDomain: overrides.activeDomain ?? ('layout' as const),
    onDomainSelected: overrides.onDomainSelected ?? vi.fn(),
    onOpenMonaco: overrides.onOpenMonaco ?? vi.fn(),
    isMonacoOpen: overrides.isMonacoOpen ?? false,
    onOpenPalette: overrides.onOpenPalette ?? vi.fn(),
    isPaletteOpen: overrides.isPaletteOpen ?? false,
    saveResolution: overrides.saveResolution ?? READY_SAVE_RESOLUTION,
    saveState: overrides.saveState ?? ('idle' as const),
    saveError: overrides.saveError ?? null,
    onSave: overrides.onSave ?? vi.fn(),
  }
  const utils = render(<DevEditorFloatingToolbar {...props} />)
  return { ...utils, props }
}

describe('DevEditorFloatingToolbar', () => {
  it('renders root with data-testid="dev-editor-toolbar" and uses fixed positioning', () => {
    renderToolbar()
    const root = screen.getByTestId('dev-editor-toolbar')
    expect(root).toBeInTheDocument()
    expect(root).toHaveClass('fixed')
  })

  describe('page selector', () => {
    it('renders one <option> per page and the select value is activePageId', () => {
      renderToolbar({
        pages: [{ id: 'home' }, { id: 'about' }, { id: 'contact' }],
        activePageId: 'about',
      })
      const select = screen.getByTestId('dev-editor-toolbar-page-select') as HTMLSelectElement
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
      expect(options).toEqual(['home', 'about', 'contact'])
      expect(select.value).toBe('about')
    })

    it('invokes onActivePageIdChange with the selected pageId when changed', () => {
      const onActivePageIdChange = vi.fn()
      renderToolbar({
        pages: [{ id: 'home' }, { id: 'about' }],
        activePageId: 'home',
        onActivePageIdChange,
      })
      const select = screen.getByTestId('dev-editor-toolbar-page-select')
      fireEvent.change(select, { target: { value: 'about' } })
      expect(onActivePageIdChange).toHaveBeenCalledTimes(1)
      expect(onActivePageIdChange).toHaveBeenCalledWith('about')
    })
  })

  describe('domain tabs', () => {
    it('renders the five domain tabs (layout, api, pages, tokens, shell)', () => {
      renderToolbar()
      expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-api')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-pages')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-tokens')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-shell')).toBeInTheDocument()
    })

    it('marks layout as pressed when activeDomain is "layout"', () => {
      renderToolbar({ activeDomain: 'layout' })
      const layoutBtn = screen.getByTestId('dev-editor-toolbar-domain-layout')
      expect(layoutBtn).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('dev-editor-toolbar-domain-shell')).toHaveAttribute('aria-pressed', 'false')
    })

    it('renders api/pages/tokens as disabled with aria-disabled and title="Próximamente"', () => {
      renderToolbar()
      for (const testId of [
        'dev-editor-toolbar-domain-api',
        'dev-editor-toolbar-domain-pages',
        'dev-editor-toolbar-domain-tokens',
      ]) {
        const btn = screen.getByTestId(testId)
        expect(btn).toBeDisabled()
        expect(btn).toHaveAttribute('aria-disabled', 'true')
        expect(btn).toHaveAttribute('title', 'Próximamente')
      }
    })

    it('clicking a disabled domain tab does not invoke any callback', () => {
      const onModeChange = vi.fn()
      const onActivePageIdChange = vi.fn()
      const onOpenMonaco = vi.fn()
      const onOpenPalette = vi.fn()
      const onDomainSelected = vi.fn()
      renderToolbar({ onModeChange, onActivePageIdChange, onOpenMonaco, onOpenPalette, onDomainSelected })
      for (const testId of [
        'dev-editor-toolbar-domain-api',
        'dev-editor-toolbar-domain-pages',
        'dev-editor-toolbar-domain-tokens',
      ]) {
        fireEvent.click(screen.getByTestId(testId))
      }
      expect(onModeChange).not.toHaveBeenCalled()
      expect(onActivePageIdChange).not.toHaveBeenCalled()
      expect(onOpenMonaco).not.toHaveBeenCalled()
      expect(onOpenPalette).not.toHaveBeenCalled()
      expect(onDomainSelected).not.toHaveBeenCalled()
    })

    it('the shell tab is functional: not disabled, no "Próximamente" title', () => {
      renderToolbar()
      const shellBtn = screen.getByTestId('dev-editor-toolbar-domain-shell')
      expect(shellBtn).not.toBeDisabled()
      expect(shellBtn).not.toHaveAttribute('aria-disabled')
      expect(shellBtn).not.toHaveAttribute('title', 'Próximamente')
    })

    it('marks shell as pressed (and layout as not pressed) when activeDomain is "shell"', () => {
      renderToolbar({ activeDomain: 'shell' })
      expect(screen.getByTestId('dev-editor-toolbar-domain-shell')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toHaveAttribute('aria-pressed', 'false')
    })

    it('clicking the shell tab invokes onDomainSelected("shell")', () => {
      const onDomainSelected = vi.fn()
      renderToolbar({ activeDomain: 'layout', onDomainSelected })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-shell'))
      expect(onDomainSelected).toHaveBeenCalledTimes(1)
      expect(onDomainSelected).toHaveBeenCalledWith('shell')
    })

    it('clicking the layout tab invokes onDomainSelected("layout")', () => {
      const onDomainSelected = vi.fn()
      renderToolbar({ activeDomain: 'shell', onDomainSelected })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-layout'))
      expect(onDomainSelected).toHaveBeenCalledTimes(1)
      expect(onDomainSelected).toHaveBeenCalledWith('layout')
    })

    // 0130-T2: "Traducciones" tab, same functional pattern as "Shell".
    it('the translations tab exists, is enabled and reads "Traducciones"', () => {
      renderToolbar()
      const translationsBtn = screen.getByTestId('dev-editor-toolbar-domain-translations')
      expect(translationsBtn).toBeInTheDocument()
      expect(translationsBtn).not.toBeDisabled()
      expect(translationsBtn).not.toHaveAttribute('aria-disabled')
      expect(translationsBtn).toHaveTextContent('Traducciones')
    })

    it('marks translations as pressed (and layout/shell as not pressed) when activeDomain is "translations"', () => {
      renderToolbar({ activeDomain: 'translations' })
      expect(screen.getByTestId('dev-editor-toolbar-domain-translations')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByTestId('dev-editor-toolbar-domain-shell')).toHaveAttribute('aria-pressed', 'false')
    })

    it('marks translations as not pressed when activeDomain is "layout"', () => {
      renderToolbar({ activeDomain: 'layout' })
      expect(screen.getByTestId('dev-editor-toolbar-domain-translations')).toHaveAttribute('aria-pressed', 'false')
    })

    it('clicking the translations tab invokes onDomainSelected("translations")', () => {
      const onDomainSelected = vi.fn()
      renderToolbar({ activeDomain: 'layout', onDomainSelected })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-domain-translations'))
      expect(onDomainSelected).toHaveBeenCalledTimes(1)
      expect(onDomainSelected).toHaveBeenCalledWith('translations')
    })

    it('regression: api/pages/tokens remain disabled with aria-disabled and "Próximamente" after adding the translations tab', () => {
      renderToolbar()
      for (const testId of [
        'dev-editor-toolbar-domain-api',
        'dev-editor-toolbar-domain-pages',
        'dev-editor-toolbar-domain-tokens',
      ]) {
        const btn = screen.getByTestId(testId)
        expect(btn).toBeDisabled()
        expect(btn).toHaveAttribute('aria-disabled', 'true')
        expect(btn).toHaveAttribute('title', 'Próximamente')
      }
    })
  })

  describe('palette toggle button', () => {
    it('invokes onOpenPalette when clicked', () => {
      const onOpenPalette = vi.fn()
      renderToolbar({ onOpenPalette })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-palette-toggle'))
      expect(onOpenPalette).toHaveBeenCalledTimes(1)
    })

    it('reflects isPaletteOpen in aria-pressed (false when closed)', () => {
      renderToolbar({ isPaletteOpen: false })
      const btn = screen.getByTestId('dev-editor-toolbar-palette-toggle')
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    })

    it('reflects isPaletteOpen in aria-pressed (true when open)', () => {
      renderToolbar({ isPaletteOpen: true })
      const btn = screen.getByTestId('dev-editor-toolbar-palette-toggle')
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('monaco toggle button', () => {
    it('invokes onOpenMonaco when clicked', () => {
      const onOpenMonaco = vi.fn()
      renderToolbar({ onOpenMonaco })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-monaco-toggle'))
      expect(onOpenMonaco).toHaveBeenCalledTimes(1)
    })

    it('reflects isMonacoOpen in aria-pressed (false when closed)', () => {
      renderToolbar({ isMonacoOpen: false })
      const btn = screen.getByTestId('dev-editor-toolbar-monaco-toggle')
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    })

    it('reflects isMonacoOpen in aria-pressed (true when open)', () => {
      renderToolbar({ isMonacoOpen: true })
      const btn = screen.getByTestId('dev-editor-toolbar-monaco-toggle')
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('visual/editor mode toggle', () => {
    it('with mode="visual", visual is pressed and editor is not', () => {
      renderToolbar({ mode: 'visual' })
      expect(screen.getByTestId('dev-editor-toolbar-mode-visual')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByTestId('dev-editor-toolbar-mode-editor')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    it('with mode="editor", editor is pressed and visual is not', () => {
      renderToolbar({ mode: 'editor' })
      expect(screen.getByTestId('dev-editor-toolbar-mode-editor')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByTestId('dev-editor-toolbar-mode-visual')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    it('clicking editor while mode="visual" invokes onModeChange("editor")', () => {
      const onModeChange = vi.fn()
      renderToolbar({ mode: 'visual', onModeChange })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-editor'))
      expect(onModeChange).toHaveBeenCalledTimes(1)
      expect(onModeChange).toHaveBeenCalledWith('editor')
    })

    it('clicking visual while mode="editor" invokes onModeChange("visual")', () => {
      const onModeChange = vi.fn()
      renderToolbar({ mode: 'editor', onModeChange })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-mode-visual'))
      expect(onModeChange).toHaveBeenCalledTimes(1)
      expect(onModeChange).toHaveBeenCalledWith('visual')
    })
  })

  it('renders a single root and it persists across mode changes', () => {
    const { rerender } = renderToolbar({ mode: 'visual' })
    expect(screen.getAllByTestId('dev-editor-toolbar')).toHaveLength(1)
    rerender(
      <DevEditorFloatingToolbar
        mode="editor"
        onModeChange={vi.fn()}
        pages={[{ id: 'home' }]}
        activePageId="home"
        onActivePageIdChange={vi.fn()}
        activeDomain="layout"
        onDomainSelected={vi.fn()}
        onOpenMonaco={vi.fn()}
        isMonacoOpen={false}
        onOpenPalette={vi.fn()}
        isPaletteOpen={false}
        saveResolution={READY_SAVE_RESOLUTION}
        saveState="idle"
        saveError={null}
        onSave={vi.fn()}
      />,
    )
    expect(screen.getAllByTestId('dev-editor-toolbar')).toHaveLength(1)
  })

  // T6 (0131): "Guardar" button — always in the DOM (FR4), enablement/messaging driven by
  // saveResolution (declared by resolveEndpointOperation, T1) and saveState/saveError (owned by
  // DevRuntimeReady, T5). This component receives both already computed — no local save state.
  describe('save button', () => {
    it('always renders the Guardar button regardless of state (FR4)', () => {
      renderToolbar()
      expect(screen.getByTestId('dev-editor-toolbar-save')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-save')).toHaveTextContent('Guardar')
    })

    it('is enabled and invokes onSave on click when the resolution is ready and saveState is idle', () => {
      const onSave = vi.fn()
      renderToolbar({ saveResolution: READY_SAVE_RESOLUTION, saveState: 'idle', onSave })
      const button = screen.getByTestId('dev-editor-toolbar-save')
      expect(button).not.toBeDisabled()

      fireEvent.click(button)
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('is disabled with aria-disabled and an explanatory title when the operation is not declared', () => {
      renderToolbar({ saveResolution: { status: 'unavailable', reason: 'operation-not-declared' } })
      const button = screen.getByTestId('dev-editor-toolbar-save')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveAttribute(
        'title',
        'La operación de guardado no está declarada en la configuración de endpoints',
      )
    })

    it('is disabled with aria-disabled and an explanatory title when the token cannot be resolved', () => {
      renderToolbar({ saveResolution: { status: 'unavailable', reason: 'token-not-resolvable' } })
      const button = screen.getByTestId('dev-editor-toolbar-save')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveAttribute('title', 'El token declarado para la operación de guardado no existe en tokens')
    })

    it('clicking the button while unavailable does not invoke onSave', () => {
      const onSave = vi.fn()
      renderToolbar({ saveResolution: { status: 'unavailable', reason: 'operation-not-declared' }, onSave })
      fireEvent.click(screen.getByTestId('dev-editor-toolbar-save'))
      expect(onSave).not.toHaveBeenCalled()
    })

    it('is disabled with a role="status" "Guardando..." indicator while saveState is loading, and a double click does not call onSave twice', () => {
      const onSave = vi.fn()
      renderToolbar({ saveState: 'loading', onSave })
      const button = screen.getByTestId('dev-editor-toolbar-save')
      expect(button).toBeDisabled()
      expect(screen.getByRole('status')).toHaveTextContent('Guardando...')

      fireEvent.click(button)
      fireEvent.click(button)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('shows saveError.message inside a role="alert" when saveState is error', () => {
      renderToolbar({
        saveState: 'error',
        saveError: { kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' },
      })
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo contactar con el proveedor externo.')
    })

    it('the button stays enabled during an error so the user can retry', () => {
      renderToolbar({
        saveState: 'error',
        saveError: { kind: 'auth', message: 'La autenticación falló.' },
      })
      expect(screen.getByTestId('dev-editor-toolbar-save')).not.toBeDisabled()
    })

    it('shows a confirmation message inside a role="status" when saveState is success', () => {
      renderToolbar({ saveState: 'success' })
      expect(screen.getByRole('status')).toHaveTextContent('Configuración guardada')
    })
  })
})
