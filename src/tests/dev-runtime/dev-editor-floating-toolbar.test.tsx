import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevEditorFloatingToolbar } from '../../dev-runtime/floating-toolbar/dev-editor-floating-toolbar'

interface RenderOptions {
  mode?: 'visual' | 'editor'
  onModeChange?: (mode: 'visual' | 'editor') => void
  pages?: ReadonlyArray<{ id: string }>
  activePageId?: string
  onActivePageIdChange?: (pageId: string) => void
  activeDomain?: 'layout'
  onOpenMonaco?: () => void
  isMonacoOpen?: boolean
  onOpenPalette?: () => void
  isPaletteOpen?: boolean
}

function renderToolbar(overrides: RenderOptions = {}) {
  const props = {
    mode: overrides.mode ?? ('visual' as const),
    onModeChange: overrides.onModeChange ?? vi.fn(),
    pages: overrides.pages ?? [{ id: 'home' }, { id: 'about' }],
    activePageId: overrides.activePageId ?? 'home',
    onActivePageIdChange: overrides.onActivePageIdChange ?? vi.fn(),
    activeDomain: overrides.activeDomain ?? ('layout' as const),
    onOpenMonaco: overrides.onOpenMonaco ?? vi.fn(),
    isMonacoOpen: overrides.isMonacoOpen ?? false,
    onOpenPalette: overrides.onOpenPalette ?? vi.fn(),
    isPaletteOpen: overrides.isPaletteOpen ?? false,
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
    it('renders the four domain tabs (layout, api, pages, tokens)', () => {
      renderToolbar()
      expect(screen.getByTestId('dev-editor-toolbar-domain-layout')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-api')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-pages')).toBeInTheDocument()
      expect(screen.getByTestId('dev-editor-toolbar-domain-tokens')).toBeInTheDocument()
    })

    it('marks layout as pressed when activeDomain is "layout"', () => {
      renderToolbar({ activeDomain: 'layout' })
      const layoutBtn = screen.getByTestId('dev-editor-toolbar-domain-layout')
      expect(layoutBtn).toHaveAttribute('aria-pressed', 'true')
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
      renderToolbar({ onModeChange, onActivePageIdChange, onOpenMonaco, onOpenPalette })
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
        onOpenMonaco={vi.fn()}
        isMonacoOpen={false}
        onOpenPalette={vi.fn()}
        isPaletteOpen={false}
      />,
    )
    expect(screen.getAllByTestId('dev-editor-toolbar')).toHaveLength(1)
  })
})
