import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { ShellConfig } from '../../config/runtime-config-types'
import {
  patchRootKey,
  type CommitCanvasMutationResult,
} from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { ShellConfigPanel } from '../../dev-runtime/shell-config-panel/shell-config-panel'
import {
  getMenuItemJsonSchema,
  getSidebarItemJsonSchema,
  getShellSidebarJsonSchema,
} from '../../dev-runtime/shell-config-panel/shell-config-panel-schema'
import { AppShellHeader, AppShellSidebar } from '../../runtime/runtime-shell'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

// Only the "header and sidebar DnD tree isolation" describe below (0125-T7, closing acceptance
// criterion 7) cares which `DndContext` instances get mounted; every other test in this file
// exercises `ShellConfigPanel` end to end without touching drag at all, so this pass-through mock
// is harmless for them — `useDraggable`/`useDroppable` keep their real implementation, same
// convention as shell-menu-list-editor.test.tsx/shell-sidebar-list-editor.test.tsx.
type CapturedHandlers = { onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void }
const capturedDndContextIds = new Set<string>()
const capturedHandlersByTreeId = new Map<string, CapturedHandlers>()

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: { id?: string; children: React.ReactNode; onDragEnd?: CapturedHandlers['onDragEnd'] }) => {
      if (props.id) {
        capturedDndContextIds.add(props.id)
        capturedHandlersByTreeId.set(props.id, { onDragEnd: props.onDragEnd })
      }
      return props.children
    },
  }
})

// T2 (0129): the header "actions" describe block below renders `link`/`button` action nodes
// through the same `LayoutCanvasPropertiesPanel` the `Layout` domain uses, which now mounts the
// real `IconPickerPropertyField` for those node types (their generated `props` schema always
// declares `icon` — see `resolveIconPropsSchema`). Without this mock, selecting an action walks
// the real ~3900-icon `lucide-react` namespace, which is slow and — per this file's own observed
// failure — trips an unrelated rendering bug in the installed `lucide-react` version under jsdom.
// `OTHER_MODULE_ICON_NAMES` covers every other icon name imported anywhere in `ShellConfigPanel`'s
// own render tree (its list editors among them) — ESM named imports resolve those bindings at
// module-load time regardless of which of them actually renders in a given test.
vi.mock('lucide-react', async () => {
  const { createLucideReactMock, OTHER_MODULE_ICON_NAMES } = await import('./lucide-react-mock')
  return createLucideReactMock(OTHER_MODULE_ICON_NAMES)
})

function buildBaseConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: { loadUsers: { method: 'GET', endpoint: '/users' } },
    initialPage: 'home',
    pages: [
      { id: 'home', layout: [] },
      { id: 'about', layout: [] },
    ],
    tokens: { authToken: { value: 'xyz' } },
    ...overrides,
  } as RuntimeConfig
}

interface HarnessProps {
  initialConfig?: RuntimeConfig
}

// Stands in for the real dev-runtime.tsx pipeline (`commitShellMutation`), built directly on
// `patchRootKey` + `validateRuntimeConfig` — the same two calls `commitShellMutation` makes — so
// this test file can assert the full contract (config update, raw-text patch scoped to `shell`,
// rejection surfacing) without mounting the entire `DevRuntimeReady` tree. `AppShellHeader`/
// `AppShellSidebar` are mounted alongside the panel, fed by the same `config.shell.header`/
// `config.shell.sidebar` the panel edits, standing in for "the header/sidebar mounted in
// production" from the acceptance criteria.
function ShellConfigPanelHarness({ initialConfig }: HarnessProps) {
  const base = initialConfig ?? buildBaseConfig()
  const [config, setConfig] = useState<RuntimeConfig>(base)
  const [rawText, setRawText] = useState(() => JSON.stringify(base, null, 2))

  function commitShellMutation(
    mutate: (shell: ShellConfig | undefined) => ShellConfig | undefined,
  ): CommitCanvasMutationResult {
    const mutatedShell = mutate(config.shell)
    const nextText = patchRootKey(rawText, 'shell', mutatedShell)
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
    <RuntimeStateProvider config={config}>
      <ShellConfigPanel shell={config.shell} onCommitShellMutation={commitShellMutation} />
      <AppShellHeader header={config.shell?.header} />
      <AppShellSidebar sidebar={config.shell?.sidebar} />
      <pre data-testid="raw-text">{rawText}</pre>
    </RuntimeStateProvider>
  )
}

function renderHarness(initialConfig?: RuntimeConfig) {
  capturedDndContextIds.clear()
  capturedHandlersByTreeId.clear()
  return render(<ShellConfigPanelHarness initialConfig={initialConfig} />)
}

function rawConfig(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('raw-text').textContent ?? '{}')
}

// Header is the sub-view active by default (0125-T8); every test below that only exercises
// sidebar-specific controls needs to switch into the Sidebar sub-view first, since its `tabpanel`
// starts hidden (`className="hidden"`) and `getByRole` excludes elements outside the
// accessibility tree.
function openSidebarTab() {
  fireEvent.click(screen.getByRole('tab', { name: 'Sidebar' }))
}

describe('ShellConfigPanel / header toggle', () => {
  it('starts with the header toggle unchecked and no header rendered when shell is absent', () => {
    renderHarness()
    expect(screen.getByRole('switch', { name: 'Header activo' })).not.toBeChecked()
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })

  it('activating the toggle sets shell.header = {} and mounts the header', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('switch', { name: 'Header activo' }))

    expect(screen.getByRole('switch', { name: 'Header activo' })).toBeChecked()
    expect(rawConfig().shell).toEqual({ header: {} })
    // An empty header renders nothing visible, but the element itself only mounts once
    // `header` is defined and non-empty per AppShellHeader's own `isShellHeaderEmpty` guard —
    // confirmed instead via the panel's own sub-forms becoming available:
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument()
  })

  it('deactivating the toggle removes the shell key entirely', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' } } }))
    expect(screen.getByTestId('app-shell-header')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Header activo' }))

    expect(screen.getByRole('switch', { name: 'Header activo' })).not.toBeChecked()
    expect('shell' in rawConfig()).toBe(false)
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })

  it('does not touch api/pages/initialPage/tokens when toggling the header', () => {
    const base = buildBaseConfig()
    renderHarness(base)
    fireEvent.click(screen.getByRole('switch', { name: 'Header activo' }))

    const parsed = rawConfig()
    expect(parsed.api).toEqual(base.api)
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })
})

describe('ShellConfigPanel / sidebar toggle', () => {
  it('starts with the sidebar toggle unchecked when shell is absent', () => {
    renderHarness()
    openSidebarTab()
    expect(screen.getByRole('switch', { name: 'Sidebar activo' })).not.toBeChecked()
  })

  it('activating the sidebar toggle from no shell produces shell: { sidebar: { items: [] } }', () => {
    renderHarness()
    openSidebarTab()
    fireEvent.click(screen.getByRole('switch', { name: 'Sidebar activo' }))

    expect(screen.getByRole('switch', { name: 'Sidebar activo' })).toBeChecked()
    expect(rawConfig().shell).toEqual({ sidebar: { items: [] } })
  })

  it('activating the sidebar toggle with header already active preserves the existing header', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' } } }))
    openSidebarTab()
    fireEvent.click(screen.getByRole('switch', { name: 'Sidebar activo' }))

    expect(rawConfig().shell).toEqual({ header: { title: 'Hello' }, sidebar: { items: [] } })
  })

  it('deactivating the sidebar toggle with only sidebar active removes the shell key entirely', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [] } } }))
    openSidebarTab()
    fireEvent.click(screen.getByRole('switch', { name: 'Sidebar activo' }))

    expect(screen.getByRole('switch', { name: 'Sidebar activo' })).not.toBeChecked()
    expect('shell' in rawConfig()).toBe(false)
  })

  it('deactivating the sidebar toggle with header also active preserves shell.header and only drops sidebar', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' }, sidebar: { items: [] } } }))
    openSidebarTab()
    fireEvent.click(screen.getByRole('switch', { name: 'Sidebar activo' }))

    expect(rawConfig().shell).toEqual({ header: { title: 'Hello' } })
  })

  it('regression: deactivating the header toggle with a non-empty sidebar preserves shell.sidebar intact', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          header: { title: 'Hello' },
          sidebar: { items: [{ label: 'Home', href: '/home' }] },
        },
      }),
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Header activo' }))

    expect(screen.getByRole('switch', { name: 'Header activo' })).not.toBeChecked()
    expect(rawConfig().shell).toEqual({ sidebar: { items: [{ label: 'Home', href: '/home' }] } })
  })

  it('deactivating the header toggle with sidebar not active reproduces the pre-existing behavior (shell: undefined)', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' } } }))
    fireEvent.click(screen.getByRole('switch', { name: 'Header activo' }))

    expect('shell' in rawConfig()).toBe(false)
  })

  it('the sidebar toggle coexists with logo/title/menu/actions fields without side effects', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'My App' } })
    openSidebarTab()
    fireEvent.click(screen.getByRole('switch', { name: 'Sidebar activo' }))

    expect(rawConfig().shell).toEqual({ header: { title: 'My App' }, sidebar: { items: [] } })
    // The Header sub-view is hidden now (Sidebar is active) but never unmounted — the Title
    // field it edited before switching still holds its value. `hidden: true` is required here
    // because `getByRole` otherwise excludes elements outside the accessibility tree.
    expect(screen.getByRole('textbox', { name: 'Title', hidden: true })).toHaveValue('My App')
  })
})

describe('ShellConfigPanel / logo', () => {
  it('editing src/alt updates the config and the production header instantly', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.change(screen.getByRole('textbox', { name: 'src' }), { target: { value: '/logo.png' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'alt' }), { target: { value: 'Company logo' } })

    expect(rawConfig().shell).toEqual({ header: { logo: { src: '/logo.png', alt: 'Company logo' } } })
    const logo = within(screen.getByTestId('app-shell-header-left')).getByRole('img')
    expect(logo).toHaveAttribute('src', '/logo.png')
    expect(logo).toHaveAttribute('alt', 'Company logo')
  })
})

describe('ShellConfigPanel / title', () => {
  it('editing the title with a literal value updates the config and the header instantly', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'My App' } })

    expect(rawConfig().shell).toEqual({ header: { title: 'My App' } })
    expect(screen.getByTestId('app-shell-header-title')).toHaveTextContent('My App')
  })

  it('accepts a {{...}} reference as free text, same as a literal — no contextual picker', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '{{params.name}}' } })

    // Committed verbatim as free text, unresolved by the editor itself — resolution against live
    // state is the runtime's job (`resolveRuntimeTextReference`), not this form's.
    expect(rawConfig().shell).toEqual({ header: { title: '{{params.name}}' } })
  })
})

describe('ShellConfigPanel / menu — list editor mounted in the panel', () => {
  // Full matrix (add/action/children-mode/reordering) moved to
  // shell-menu-list-editor.test.tsx (0125-T4, isolated `ShellMenuListEditor` harness). This
  // describe only confirms `ShellMenuListEditor` is actually mounted with the real
  // `shell.header.menu` and wired to the full commit pipeline (`validateRuntimeConfig` +
  // `patchRootKey`) — same minimal-smoke role `sidebar items — recursive editor mounted in the
  // panel` plays for `SidebarItemListEditor` below.
  it('mounts with the real configured menu, rendering its fields', () => {
    renderHarness(buildBaseConfig({ shell: { header: { menu: [{ label: 'Home', href: '/home' }] } } }))

    // Every row starts collapsed by default; expand it to reach its fields.
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    expect(screen.getByRole('textbox', { name: 'Etiqueta' })).toHaveValue('Home')
  })

  it('adding a root item via the mounted editor reflects in raw-text through the real commit pipeline', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de menú' }))

    const menu = (rawConfig().shell as { header: { menu: unknown[] } }).header.menu
    expect(menu).toEqual([{ label: 'Nuevo elemento', href: '' }])
  })
})

describe('ShellConfigPanel / actions', () => {
  it('adds a default link action via the form control (no DnD)', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.click(screen.getByRole('button', { name: 'Añadir acción' }))

    const actions = (rawConfig().shell as { header: { actions: Array<Record<string, unknown>> } }).header.actions
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('link')
  })

  it('switching an action\'s type from link to button reconstructs the shape with the new type\'s defaults', () => {
    renderHarness(buildBaseConfig({ shell: { header: { actions: [{ type: 'link', props: { label: 'Enlace', href: '#' } }] } } }))

    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo' }), { target: { value: 'button' } })

    const actions = (rawConfig().shell as { header: { actions: Array<Record<string, unknown>> } }).header.actions
    expect(actions[0].type).toBe('button')
    expect(actions[0]).not.toHaveProperty('href')
  })

  it('reorders actions with Subir/Bajar form controls, disabled at the boundaries', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          header: {
            actions: [
              { type: 'link', props: { label: 'First', href: '/1' } },
              { type: 'link', props: { label: 'Second', href: '/2' } },
            ],
          },
        },
      }),
    )

    expect(screen.getByRole('button', { name: 'Subir acción 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar acción 2' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Bajar acción 1' }))

    const actions = (rawConfig().shell as { header: { actions: Array<{ props: { label: string } }> } }).header.actions
    expect(actions.map((action) => action.props.label)).toEqual(['Second', 'First'])
  })

  it('removes an action via the properties panel\'s own delete button', () => {
    renderHarness(
      buildBaseConfig({
        shell: { header: { actions: [{ type: 'link', props: { label: 'Only', href: '/only' } }] } },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }))

    const actions = (rawConfig().shell as { header: { actions: unknown[] } }).header.actions
    expect(actions).toEqual([])
  })

  it('renders the action in the header actions area', () => {
    renderHarness(
      buildBaseConfig({
        shell: { header: { actions: [{ type: 'link', props: { label: 'Sign in', href: '/login' } }] } },
      }),
    )

    expect(within(screen.getByTestId('app-shell-header-actions')).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  // T4 (0133), criterion 10: an action row is edited through the same tabbed
  // `LayoutCanvasPropertiesPanel` the canvas uses, minus Diseño — shell actions never live inside
  // a page's `layout` tree, so no `pageLayout` is ever passed for them (see
  // `shell-actions-list-editor.tsx`). Props and visibility both still commit through the real
  // Shell pipeline (`onCommitShellMutation`/`patchRootKey`).
  it('shows the action row tab bar without Diseño, and both Props and Visibilidad commit through the Shell pipeline', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          header: {
            actions: [
              {
                type: 'link',
                props: { label: 'Ir', href: '/somewhere' },
                visibility: { reference: 'queries.loadUsers.status', operator: 'equals', value: 'x' },
              },
            ],
          },
        },
      }),
    )

    // Scoped to the action row's own properties panel: `ShellConfigPanel` also renders its
    // unrelated Header/Sidebar sub-navigation as a separate `role="tablist"`.
    const panel = screen.getByTestId('layout-canvas-properties-panel')
    const tablist = within(panel).getByRole('tablist')
    const tabNames = within(tablist)
      .getAllByRole('tab')
      .map((tab) => tab.textContent)
    expect(tabNames).toEqual(['Props', 'Visibilidad', 'Queries'])

    fireEvent.change(screen.getByLabelText('href', { exact: false }), { target: { value: '/updated' } })
    const actionsAfterProps = (rawConfig().shell as { header: { actions: Array<{ props: { href: string } }> } }).header.actions
    expect(actionsAfterProps[0].props.href).toBe('/updated')

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: 'y' } })
    const actionsAfterVisibility = (
      rawConfig().shell as { header: { actions: Array<{ visibility: { value: string } }> } }
    ).header.actions
    expect(actionsAfterVisibility[0].visibility.value).toBe('y')
  })

  // T5 (0133), edge case: a `link` action row in the Shell header shows the "Contenido" selector
  // at the top of its own Props tabpanel, same as a `link` in the canvas — editable through the
  // real Shell pipeline (`onCommitShellMutation`/`patchRootKey`), even though this panel never
  // receives `pageLayout` (shell actions never live in a page's `layout` tree).
  it('shows the "Contenido" selector at the top of the Props tabpanel for a link header action, editable through the Shell pipeline', () => {
    renderHarness(
      buildBaseConfig({
        shell: { header: { actions: [{ type: 'link', props: { label: 'Ir', href: '/somewhere' } }] } },
      }),
    )

    const panel = screen.getByTestId('layout-canvas-properties-panel')
    expect(within(panel).getByRole('tab', { name: 'Props' })).toHaveAttribute('aria-selected', 'true')
    const tabpanel = within(panel).getByRole('tabpanel')
    const contentSelect = within(tabpanel).getByLabelText('Contenido') as HTMLSelectElement
    expect(contentSelect.value).toBe('text')

    const hrefField = within(tabpanel).getByLabelText('href', { exact: false })
    expect(contentSelect.compareDocumentPosition(hrefField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.change(contentSelect, { target: { value: 'children' } })
    const actionsAfterContentSwitch = (
      rawConfig().shell as { header: { actions: Array<{ children?: unknown[] }> } }
    ).header.actions
    expect(actionsAfterContentSwitch[0].children).toEqual([])
  })

  // T4 (0136), FR7: the root "Acciones" fieldset drops its box styling. T5 (0136), FR8: the
  // per-action box is also dropped, replaced by a plain-text "Acción N" header (no fieldset/legend
  // pair existed here to reuse, so it's a new `span` matching the convention's visual class).
  it('drops the box styling from both the root "Acciones" fieldset and the per-action row, showing an "Acción 1" header instead', () => {
    renderHarness(
      buildBaseConfig({
        shell: { header: { actions: [{ type: 'link', props: { label: 'Ir', href: '/somewhere' } }] } },
      }),
    )

    const fieldset = screen.getByRole('group', { name: 'Acciones' })
    expect(fieldset.tagName).toBe('FIELDSET')
    expect(fieldset.className).not.toMatch(/\bborder\b/)
    expect(fieldset.className).not.toMatch(/rounded/)
    expect(fieldset.className).not.toMatch(/\bbg-/)

    const legend = screen.getByText('Acciones')
    expect(legend.tagName).toBe('LEGEND')
    expect(legend.className).toBe('px-1 text-xs font-medium text-gray-700')

    const actionBox = fieldset.querySelector(':scope > div')!
    expect(actionBox.className).toBe('flex flex-col gap-2')
    expect(actionBox.className).not.toMatch(/\bborder\b/)
    expect(actionBox.className).not.toMatch(/rounded/)
    expect(actionBox.className).not.toMatch(/\bbg-/)

    const header = within(actionBox as HTMLElement).getByText('Acción 1')
    expect(header.tagName).toBe('SPAN')
    expect(header.className).toBe('text-xs font-medium text-gray-700')
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Acción 1 —/ })).not.toBeInTheDocument()
  })
})

describe('ShellConfigPanel / sidebar items — recursive editor mounted in the panel', () => {
  it('adding a root sidebar item with an action.navigateTo renders it live in the real sidebar', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [] } } }))
    openSidebarTab()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de sidebar' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'About' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'action' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Acción' }), {
      target: { value: 'navigateTo' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'about' } })

    const items = (rawConfig().shell as { sidebar: { items: unknown[] } }).sidebar.items
    expect(items).toEqual([{ label: 'About', action: { type: 'navigateTo', pageId: 'about' } }])
    expect(within(screen.getByTestId('app-shell-sidebar')).getByRole('button', { name: 'About' })).toBeInTheDocument()
  })

  it('editing a root item with an href renders as a real link in the sidebar', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [] } } }))
    openSidebarTab()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de sidebar' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'Home' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Href' }), {
      target: { value: '/home' },
    })

    expect(within(screen.getByTestId('app-shell-sidebar')).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/home',
    )
  })

  it('switching a root item to "Con hijos" renders the nested sublist for editing without affecting shell.header', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' }, sidebar: { items: [{ label: 'Products', href: '/products' }] } } }))
    openSidebarTab()
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('combobox', { name: 'Modo' }), {
      target: { value: 'children' },
    })

    // Scoped to the child's own row (`0.0`): the root row (still expanded) also carries a bare
    // "Etiqueta" field (T5, 0136).
    expect(within(screen.getByTestId('shell-tree-row-0.0')).getByRole('textbox', { name: 'Etiqueta' })).toBeInTheDocument()
    const shell = rawConfig().shell as { header: { title: string }; sidebar: { items: Array<{ children: unknown[] }> } }
    expect(shell.header).toEqual({ title: 'Hello' })
    expect(shell.sidebar.items[0].children).toEqual([{ label: 'Nuevo elemento', href: '' }])
  })

  it('a sidebar item commit only patches shell.sidebar.items, leaving shell.header/layout/api/initialPage/tokens untouched', () => {
    const base = buildBaseConfig({
      pages: [
        { id: 'home', layout: [{ type: 'heading', props: { text: 'Hi', level: 1 } }] },
        { id: 'about', layout: [] },
      ],
      shell: { header: { title: 'Hello' }, sidebar: { items: [] } },
    } as Partial<RuntimeConfig>)
    renderHarness(base)
    openSidebarTab()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de sidebar' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'About' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Href' }), {
      target: { value: '/about' },
    })

    const parsed = rawConfig()
    expect((parsed.shell as { header: unknown }).header).toEqual({ title: 'Hello' })
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.api).toEqual(base.api)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })

  it('an unknown pageId in a sidebar item action is rejected, keeping the attempted value with role="alert"', () => {
    renderHarness(
      buildBaseConfig({
        shell: { sidebar: { items: [{ label: 'About', action: { type: 'navigateTo', pageId: 'home' } }] } },
      }),
    )
    openSidebarTab()
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'ghost' } })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('invalid-layout')
    expect(screen.getByRole('textbox', { name: 'pageId' })).toHaveValue('ghost')
    const items = (rawConfig().shell as { sidebar: { items: Array<{ action: { pageId: string } }> } }).sidebar.items
    expect(items[0].action.pageId).toBe('home')
  })
})

describe('ShellConfigPanel / icon field (T3, 0129)', () => {
  it('choosing an icon cell for a menuItem runs through the real commit pipeline and persists in the config', () => {
    renderHarness(buildBaseConfig({ shell: { header: { menu: [{ label: 'Home', href: '/home', icon: 'Home' }] } } }))
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    // The grid is hidden until the search input is focused (T5, 0129).
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Bell').closest('[role="gridcell"]')!)

    const menu = (rawConfig().shell as { header: { menu: Array<{ label: string; icon?: string }> } }).header.menu
    expect(menu).toEqual([{ label: 'Home', href: '/home', icon: 'Bell' }])
  })

  it('choosing an icon cell for a sidebarItem runs through the real commit pipeline and persists in the config', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [{ label: 'Home', href: '/home', icon: 'LayoutDashboard' }] } } }))
    openSidebarTab()
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Settings').closest('[role="gridcell"]')!)

    const items = (rawConfig().shell as { sidebar: { items: Array<{ label: string; icon?: string }> } }).sidebar.items
    expect(items).toEqual([{ label: 'Home', href: '/home', icon: 'Settings' }])
  })

  it('an unrecognized preexisting icon on a menuItem shows the widget with no cell highlighted, and the rest of the panel stays operative', () => {
    renderHarness(buildBaseConfig({ shell: { header: { menu: [{ label: 'Home', href: '/home', icon: 'NombreQueNoExiste' }] } } }))
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    const grid = screen.getByRole('grid', { name: 'Icono' })
    expect(within(grid).getAllByRole('gridcell').some((cell) => cell.getAttribute('aria-selected') === 'true')).toBe(false)
    // Two independent renders of the raw string are expected: the row toggle's own icon-name span
    // (pre-existing, unrelated to the widget) and the widget's "Valor actual" note — both prove
    // the unrecognized value stays visible rather than being silently dropped.
    expect(screen.getAllByText('NombreQueNoExiste').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), {
      target: { value: 'Homepage' },
    })
    const menu = (rawConfig().shell as { header: { menu: Array<{ label: string; icon?: string }> } }).header.menu
    expect(menu).toEqual([{ label: 'Homepage', href: '/home', icon: 'NombreQueNoExiste' }])
  })

  it('an icon commit for a menuItem only touches shell, leaving layout/api/initialPage/tokens untouched', () => {
    const base = buildBaseConfig({
      pages: [
        { id: 'home', layout: [{ type: 'heading', props: { text: 'Hi', level: 1 } }] },
        { id: 'about', layout: [] },
      ],
      shell: { header: { menu: [{ label: 'Home', href: '/home', icon: 'Home' }] } },
    } as Partial<RuntimeConfig>)
    renderHarness(base)
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    fireEvent.focus(screen.getByRole('textbox', { name: 'Buscar icono' }))

    fireEvent.click(screen.getByText('Bell').closest('[role="gridcell"]')!)

    const parsed = rawConfig()
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.api).toEqual(base.api)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })
})

describe('ShellConfigPanel / visibility widget (T4, 0132)', () => {
  it('changing a menuItem visibility to "Grupo (y/o)" from the widget runs through the real commit pipeline', () => {
    const base = buildBaseConfig({
      shell: {
        header: { menu: [{ label: 'Home', href: '/home', visibility: { reference: 'params.userId', operator: 'equals', value: 'y' } }] },
      },
    })
    renderHarness(base)
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    const shape = screen.getByRole('radiogroup', { name: 'Forma' })
    fireEvent.click(within(shape).getByRole('radio', { name: 'Grupo (y/o)' }))

    const parsed = rawConfig()
    const menu = (parsed.shell as { header: { menu: Array<Record<string, unknown>> } }).header.menu
    expect(menu).toEqual([
      {
        label: 'Home',
        href: '/home',
        visibility: { operator: 'and', conditions: [{ reference: 'params.userId', operator: 'equals', value: 'y' }] },
      },
    ])
    // Commit scope: only `shell` is touched.
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.api).toEqual(base.api)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })

  it('changing the operator of a nested (depth >= 2) sidebarItem visibility runs through the real commit pipeline and touches only that node', () => {
    const base = buildBaseConfig({
      shell: {
        sidebar: {
          items: [
            {
              label: 'Parent',
              children: [
                {
                  label: 'Child',
                  href: '/child',
                  visibility: { reference: 'params.role', operator: 'equals', value: 'admin' },
                },
                { label: 'Sibling', href: '/sibling' },
              ],
            },
          ],
        },
      },
    })
    renderHarness(base)
    openSidebarTab()
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0.0'))

    fireEvent.change(screen.getByRole('combobox', { name: 'Operador' }), {
      target: { value: 'isTruthy' },
    })

    const parsed = rawConfig()
    const items = (parsed.shell as { sidebar: { items: Array<{ children: Array<Record<string, unknown>> }> } }).sidebar.items
    expect(items[0].children[0].visibility).toEqual({ reference: 'params.role', operator: 'isTruthy' })
    expect(items[0].children[1]).toEqual({ label: 'Sibling', href: '/sibling' })
    // Commit scope: only `shell` is touched.
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.api).toEqual(base.api)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })

  it('the cached schemas replace visibility with the condition-group sentinel, including the $defs-based recursive branch (acceptance criterion 14)', () => {
    const sentinel = { 'x-widget': 'condition-group' }
    expect((getMenuItemJsonSchema().properties as Record<string, unknown>).visibility).toEqual(sentinel)
    expect((getSidebarItemJsonSchema().properties as Record<string, unknown>).visibility).toEqual(sentinel)

    // `sidebarItem` recurses through `$defs` once nested inside another schema
    // (`shell.sidebar.items`) — unlike its own standalone schema, which self-references its root
    // instead. This exercises the transform's `$defs` branch structurally, without depending on
    // the exact `$defs` key name.
    const shellSidebarSchema = getShellSidebarJsonSchema()
    const defs = shellSidebarSchema.$defs as Record<string, { properties?: Record<string, unknown> }> | undefined
    expect(defs).toBeDefined()
    const defsWithVisibilitySentinel = Object.values(defs ?? {}).filter(
      (def) => JSON.stringify(def.properties?.visibility) === JSON.stringify(sentinel),
    )
    expect(defsWithVisibilitySentinel.length).toBeGreaterThan(0)
  })
})

describe('ShellConfigPanel / navigateTo.params widget (T4, 0141)', () => {
  it('shows the key-value editor for a menuItem action.navigateTo.params and commits an edit through the real pipeline', () => {
    const base = buildBaseConfig({
      shell: {
        header: {
          menu: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home', params: { id: 'x' } } }],
        },
      },
    })
    renderHarness(base)
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    const paramsGroup = screen.getByRole('group', { name: 'params' })
    const idField = within(paramsGroup).getByLabelText('params valor #1') as HTMLInputElement
    expect(idField.value).toBe('x')

    fireEvent.change(idField, { target: { value: 'y' } })

    const parsed = rawConfig()
    const menu = (parsed.shell as { header: { menu: Array<{ action: { params: Record<string, unknown> } }> } }).header.menu
    expect(menu[0].action.params).toEqual({ id: 'y' })
    // Commit scope: only `shell` is touched.
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.api).toEqual(base.api)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })

  it('degrades a non-string param row of a sidebarItem to read-only without blocking the rest of the row', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          sidebar: {
            items: [{ label: 'About', action: { type: 'navigateTo', pageId: 'home', params: { id: 'x', active: true } } }],
          },
        },
      }),
    )
    openSidebarTab()
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))

    const paramsGroup = screen.getByRole('group', { name: 'params' })
    const idField = within(paramsGroup).getByLabelText('params valor #1') as HTMLInputElement
    expect(idField.tagName).toBe('INPUT')
    expect(idField.value).toBe('x')

    const activeField = within(paramsGroup).getByLabelText('params valor #2')
    expect(activeField.tagName).toBe('TEXTAREA')
    expect(activeField).toBeDisabled()
  })

  it('regression: menuItem/sidebarItem visibility still mounts the condition-group widget alongside the params widget', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          header: {
            menu: [
              {
                label: 'Home',
                action: { type: 'navigateTo', pageId: 'home', params: { id: 'x' } },
                visibility: { reference: 'params.userId', operator: 'equals', value: 'y' },
              },
            ],
          },
        },
      }),
    )
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))

    expect(screen.getByRole('group', { name: 'params' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Forma' })).toBeInTheDocument()
  })
})

describe('ShellConfigPanel / rejected commit feedback', () => {
  // `menuItem.label` has no non-empty constraint in the actual schema (0122-T1: `label:
  // z.string()`), so a blank label alone never gets rejected. `action.navigateTo.pageId`
  // referencing an unknown page does get rejected — by `validateShellConfig`'s cross-reference
  // check (0122-T2) — making it a real, currently-enforced example of the same "keep the user's
  // value, show the alert, don't revert in silence" contract.
  function renderWithNavigateToItem() {
    renderHarness(
      buildBaseConfig({
        shell: { header: { menu: [{ label: 'About', action: { type: 'navigateTo', pageId: 'home' } }] } },
      }),
    )
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
  }

  it('an unknown pageId kept after a rejected commit shows role="alert" with the error code/message, without reverting', () => {
    renderWithNavigateToItem()

    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'ghost' } })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('invalid-layout')
    expect(screen.getByRole('textbox', { name: 'pageId' })).toHaveValue('ghost')
    // The config itself was never mutated by the rejected commit — still the last valid state.
    const menu = (rawConfig().shell as { header: { menu: Array<{ action: { pageId: string } }> } }).header.menu
    expect(menu[0].action.pageId).toBe('home')
  })

  it('clears the alert once a subsequent commit for the same row succeeds', () => {
    renderWithNavigateToItem()

    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'ghost' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'about' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const menu = (rawConfig().shell as { header: { menu: Array<{ action: { pageId: string } }> } }).header.menu
    expect(menu[0].action.pageId).toBe('about')
  })
})

describe('ShellConfigPanel / header and sidebar DnD tree isolation (closes acceptance criterion 7 — 0125-T7)', () => {
  it('mounts the header menu tree and the sidebar items tree as two separate DndContext instances', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          header: { menu: [{ label: 'Home', href: '/home' }] },
          sidebar: { items: [{ label: 'About', href: '/about' }] },
        },
      }),
    )

    expect(capturedDndContextIds.size).toBe(2)
    expect(capturedDndContextIds.has('shell-menu')).toBe(true)
    expect(capturedDndContextIds.has('shell-sidebar')).toBe(true)
    expect(capturedHandlersByTreeId.get('shell-menu')).not.toBe(capturedHandlersByTreeId.get('shell-sidebar'))

    // A drag that ends inside one tree's own `DndContext` can never resolve against the other
    // tree's data: there is no `over.id` shared between the two `DndContext` instances at all, so
    // invoking one tree's own captured `onDragEnd` never mutates the other tree's config.
    act(() => {
      capturedHandlersByTreeId.get('shell-sidebar')?.onDragEnd?.({ active: { id: '0' }, over: { id: 'gap::1' } })
    })
    act(() => {
      capturedHandlersByTreeId.get('shell-menu')?.onDragEnd?.({ active: { id: '0' }, over: { id: 'gap::1' } })
    })

    const shell = rawConfig().shell as {
      header: { menu: Array<{ label: string }> }
      sidebar: { items: Array<{ label: string }> }
    }
    expect(shell.header.menu.map((item) => item.label)).toEqual(['Home'])
    expect(shell.sidebar.items.map((item) => item.label)).toEqual(['About'])
  })
})

describe('ShellConfigPanel / commit scope', () => {
  it('a Shell commit never touches layout/api/initialPage/tokens in the raw text', () => {
    const base = buildBaseConfig({
      pages: [
        { id: 'home', layout: [{ type: 'heading', props: { text: 'Hi', level: 1 } }] },
        { id: 'about', layout: [] },
      ],
    } as Partial<RuntimeConfig>)
    renderHarness(base)

    fireEvent.click(screen.getByRole('switch', { name: 'Header activo' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Hello' } })

    const parsed = rawConfig()
    expect(parsed.pages).toEqual(base.pages)
    expect(parsed.api).toEqual(base.api)
    expect(parsed.initialPage).toBe(base.initialPage)
    expect(parsed.tokens).toEqual(base.tokens)
  })
})

describe('ShellConfigPanel / Header-Sidebar sub-navigation (0125-T8, closes acceptance criteria 8-9)', () => {
  it('mounts with the Header sub-view active and the Sidebar sub-view mounted but hidden', () => {
    renderHarness(buildBaseConfig({ shell: { header: {}, sidebar: { items: [] } } }))

    expect(screen.getByRole('tab', { name: 'Header' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Sidebar' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('shell-config-panel-tabpanel-header')).not.toHaveClass('hidden')
    // Mounted (`getByTestId` finds it — not `queryByTestId` returning null) but hidden: the
    // "always mounted" contract of acceptance criterion 8, not conditional rendering.
    const sidebarPanel = screen.getByTestId('shell-config-panel-tabpanel-sidebar')
    expect(sidebarPanel).toBeInTheDocument()
    expect(sidebarPanel).toHaveClass('hidden')
    // Same assertion as the "header toggle" describe above (starts checked when `header` is
    // configured), now reached without switching tabs since Header is the default sub-view.
    expect(screen.getByRole('switch', { name: 'Header activo' })).toBeChecked()
  })

  it('clicking the Sidebar tab activates it and hides Header, without unmounting either sub-view', () => {
    renderHarness(
      buildBaseConfig({
        shell: {
          header: { menu: [{ label: 'Home', href: '/home' }] },
          sidebar: { items: [{ label: 'About', href: '/about' }] },
        },
      }),
    )

    // Expand the header menu item first — purely local, uncommitted UI state (0125-T4) that
    // only survives a tab switch if `ShellMenuListEditor` is never unmounted.
    fireEvent.click(screen.getByTestId('menu-item-collapse-toggle-0'))
    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Sidebar' }))

    expect(screen.getByRole('tab', { name: 'Header' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Sidebar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('shell-config-panel-tabpanel-header')).toHaveClass('hidden')
    expect(screen.getByTestId('shell-config-panel-tabpanel-sidebar')).not.toHaveClass('hidden')
    // Same assertion as the "sidebar toggle" describe above, now reached through the tab instead
    // of being visible by default.
    expect(screen.getByRole('switch', { name: 'Sidebar activo' })).toBeChecked()

    fireEvent.click(screen.getByRole('tab', { name: 'Header' }))

    // The expand from before the switch survived — proof neither sub-view was ever unmounted,
    // not just that the config value round-tripped.
    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox', { name: 'Etiqueta' })).toBeInTheDocument()
  })

  it('keeps a pending rejected-commit alert in the DOM while its sub-view is hidden, visible again on return', () => {
    renderHarness(
      buildBaseConfig({
        shell: { sidebar: { items: [{ label: 'About', action: { type: 'navigateTo', pageId: 'home' } }] } },
      }),
    )
    openSidebarTab()
    fireEvent.click(screen.getByTestId('sidebar-item-collapse-toggle-0'))
    fireEvent.change(screen.getByRole('textbox', { name: 'pageId' }), { target: { value: 'ghost' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Header' }))

    // The tabpanel itself is hidden (`className="hidden"`) — the CSS `display: none` it maps to
    // is what actually removes its contents from the accessibility tree in a real browser; jsdom
    // never applies Tailwind's stylesheet, so this assertion (rather than `queryByRole`) is what
    // this test environment can actually verify: still mounted, not conditionally rendered away —
    // acceptance criterion 9.
    expect(screen.getByTestId('shell-config-panel-tabpanel-sidebar')).toHaveClass('hidden')
    expect(screen.getByTestId('shell-sidebar--0-error')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Sidebar' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'pageId' })).toHaveValue('ghost')
  })

  it('edits shell.sidebar.defaultCollapsed from a "Modo rail por defecto" boolean field inside the Sidebar sub-view', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [] } } }))
    openSidebarTab()

    expect(screen.getByRole('switch', { name: 'Modo rail por defecto' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('switch', { name: 'Modo rail por defecto' }))

    expect(screen.getByRole('switch', { name: 'Modo rail por defecto' })).toBeChecked()
    expect(rawConfig().shell).toEqual({ sidebar: { items: [], defaultCollapsed: true } })
  })
})
