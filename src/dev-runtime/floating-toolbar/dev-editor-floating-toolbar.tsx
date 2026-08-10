import { LayoutTemplate, Plug, StickyNote, KeyRound, Languages, PanelTop, Braces, Plus, SquarePen } from 'lucide-react'

export type ToolbarMode = 'visual' | 'editor'
export type ToolbarDomain = 'layout' | 'shell' | 'translations'

interface DevEditorFloatingToolbarProps {
  mode: ToolbarMode
  onModeChange: (mode: ToolbarMode) => void
  pages: ReadonlyArray<{ id: string }>
  activePageId: string
  onActivePageIdChange: (pageId: string) => void
  activeDomain: ToolbarDomain
  onDomainSelected: (domain: ToolbarDomain) => void
  onOpenMonaco: () => void
  isMonacoOpen: boolean
  onOpenPalette: () => void
  isPaletteOpen: boolean
}

const CONTAINER_CLASSES = [
  'fixed',
  'bottom-4',
  'left-1/2',
  '-translate-x-1/2',
  'z-[9999]',
  'flex',
  'items-center',
  'gap-2',
  'rounded-lg',
  'border',
  'border-gray-200',
  'bg-white',
  'px-3',
  'py-2',
  'shadow-lg',
].join(' ')

const GROUP_CLASSES = 'flex items-center gap-1 rounded border border-gray-200 bg-gray-50 p-1'

const BUTTON_BASE =
  'flex gap-2 h-8 items-center justify-center rounded px-2 text-sm text-gray-800 hover:bg-gray-200'
const BUTTON_PRESSED = 'bg-gray-800 text-white hover:bg-gray-700'
const BUTTON_DISABLED = 'cursor-not-allowed text-gray-400 hover:bg-transparent'

function buttonClasses({ pressed, disabled }: { pressed?: boolean; disabled?: boolean }) {
  return [BUTTON_BASE, pressed ? BUTTON_PRESSED : '', disabled ? BUTTON_DISABLED : '']
    .filter(Boolean)
    .join(' ')
}

export function DevEditorFloatingToolbar({
  mode,
  onModeChange,
  pages,
  activePageId,
  onActivePageIdChange,
  activeDomain,
  onDomainSelected,
  onOpenMonaco,
  isMonacoOpen,
  onOpenPalette,
  isPaletteOpen,
}: DevEditorFloatingToolbarProps) {
  const isLayoutActive = activeDomain === 'layout'
  const isShellActive = activeDomain === 'shell'
  const isTranslationsActive = activeDomain === 'translations'

  return (
    <div
      data-testid="dev-editor-toolbar"
      className={CONTAINER_CLASSES}
      role="toolbar"
      aria-label="Dev editor toolbar"
    >
      <label className="sr-only" htmlFor="dev-editor-toolbar-page-select">
        Página activa
      </label>
      <select
        id="dev-editor-toolbar-page-select"
        data-testid="dev-editor-toolbar-page-select"
        className="h-8 rounded border border-gray-200 bg-white px-2 text-sm text-gray-800"
        value={activePageId}
        onChange={(event) => onActivePageIdChange(event.target.value)}
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {page.id}
          </option>
        ))}
      </select>

      <div className={GROUP_CLASSES} role="group" aria-label="Dominios">
        <button
          type="button"
          data-testid="dev-editor-toolbar-domain-layout"
          className={buttonClasses({ pressed: isLayoutActive })}
          aria-pressed={isLayoutActive}
          onClick={() => onDomainSelected('layout')}
        >
          <LayoutTemplate size={14} /> Layout
        </button>
        <button
          type="button"
          data-testid="dev-editor-toolbar-domain-api"
          className={buttonClasses({ disabled: true })}
          disabled
          aria-disabled="true"
          title="Próximamente"
        >
          <Plug size={14} /> Api
        </button>
        <button
          type="button"
          data-testid="dev-editor-toolbar-domain-pages"
          className={buttonClasses({ disabled: true })}
          disabled
          aria-disabled="true"
          title="Próximamente"
        >
          <StickyNote size={14} /> Páginas
        </button>
        <button
          type="button"
          data-testid="dev-editor-toolbar-domain-tokens"
          className={buttonClasses({ disabled: true })}
          disabled
          aria-disabled="true"
          title="Próximamente"
        >
          <KeyRound size={14} /> Tokens
        </button>
        <button
          type="button"
          data-testid="dev-editor-toolbar-domain-translations"
          className={buttonClasses({ pressed: isTranslationsActive })}
          aria-pressed={isTranslationsActive}
          onClick={() => onDomainSelected('translations')}
        >
          <Languages size={14} /> Traducciones
        </button>
        <button
          type="button"
          data-testid="dev-editor-toolbar-domain-shell"
          className={buttonClasses({ pressed: isShellActive })}
          aria-pressed={isShellActive}
          onClick={() => onDomainSelected('shell')}
        >
          <PanelTop size={14} /> Shell
        </button>
      </div>

      <button
        type="button"
        data-testid="dev-editor-toolbar-palette-toggle"
        className={buttonClasses({ pressed: isPaletteOpen })}
        aria-pressed={isPaletteOpen}
        onClick={onOpenPalette}
      >
        <Plus size="16" /> Añadir elemento
      </button>

      <button
        type="button"
        data-testid="dev-editor-toolbar-monaco-toggle"
        className={buttonClasses({ pressed: isMonacoOpen })}
        aria-pressed={isMonacoOpen}
        onClick={onOpenMonaco}
        aria-label="Abrir editor Monaco"
      >
        <Braces size="16" />
      </button>

      <div className={GROUP_CLASSES} role="group" aria-label="Modo de edición">
        <button
          type="button"
          data-testid="dev-editor-toolbar-mode-visual"
          className={buttonClasses({ pressed: mode === 'visual' })}
          aria-pressed={mode === 'visual'}
          onClick={() => onModeChange('visual')}
        >
          Visual
        </button>
        <button
          type="button"
          data-testid="dev-editor-toolbar-mode-editor"
          className={buttonClasses({ pressed: mode === 'editor' })}
          aria-pressed={mode === 'editor'}
          onClick={() => onModeChange('editor')}
        >
          <SquarePen /> Editor
        </button>
      </div>
    </div>
  )
}
