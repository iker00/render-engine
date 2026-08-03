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
    expect(screen.getByRole('checkbox', { name: 'Header activo' })).not.toBeChecked()
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })

  it('activating the toggle sets shell.header = {} and mounts the header', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Header activo' }))

    expect(screen.getByRole('checkbox', { name: 'Header activo' })).toBeChecked()
    expect(rawConfig().shell).toEqual({ header: {} })
    // An empty header renders nothing visible, but the element itself only mounts once
    // `header` is defined and non-empty per AppShellHeader's own `isShellHeaderEmpty` guard —
    // confirmed instead via the panel's own sub-forms becoming available:
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument()
  })

  it('deactivating the toggle removes the shell key entirely', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' } } }))
    expect(screen.getByTestId('app-shell-header')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Header activo' }))

    expect(screen.getByRole('checkbox', { name: 'Header activo' })).not.toBeChecked()
    expect('shell' in rawConfig()).toBe(false)
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })

  it('does not touch api/pages/initialPage/tokens when toggling the header', () => {
    const base = buildBaseConfig()
    renderHarness(base)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Header activo' }))

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
    expect(screen.getByRole('checkbox', { name: 'Sidebar activo' })).not.toBeChecked()
  })

  it('activating the sidebar toggle from no shell produces shell: { sidebar: { items: [] } }', () => {
    renderHarness()
    openSidebarTab()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sidebar activo' }))

    expect(screen.getByRole('checkbox', { name: 'Sidebar activo' })).toBeChecked()
    expect(rawConfig().shell).toEqual({ sidebar: { items: [] } })
  })

  it('activating the sidebar toggle with header already active preserves the existing header', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' } } }))
    openSidebarTab()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sidebar activo' }))

    expect(rawConfig().shell).toEqual({ header: { title: 'Hello' }, sidebar: { items: [] } })
  })

  it('deactivating the sidebar toggle with only sidebar active removes the shell key entirely', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [] } } }))
    openSidebarTab()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sidebar activo' }))

    expect(screen.getByRole('checkbox', { name: 'Sidebar activo' })).not.toBeChecked()
    expect('shell' in rawConfig()).toBe(false)
  })

  it('deactivating the sidebar toggle with header also active preserves shell.header and only drops sidebar', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' }, sidebar: { items: [] } } }))
    openSidebarTab()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sidebar activo' }))

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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Header activo' }))

    expect(screen.getByRole('checkbox', { name: 'Header activo' })).not.toBeChecked()
    expect(rawConfig().shell).toEqual({ sidebar: { items: [{ label: 'Home', href: '/home' }] } })
  })

  it('deactivating the header toggle with sidebar not active reproduces the pre-existing behavior (shell: undefined)', () => {
    renderHarness(buildBaseConfig({ shell: { header: { title: 'Hello' } } }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Header activo' }))

    expect('shell' in rawConfig()).toBe(false)
  })

  it('the sidebar toggle coexists with logo/title/menu/actions fields without side effects', () => {
    renderHarness(buildBaseConfig({ shell: { header: {} } }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'My App' } })
    openSidebarTab()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sidebar activo' }))

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
    expect(screen.getByRole('textbox', { name: 'Elemento de menú 1 — Etiqueta' })).toHaveValue('Home')
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Acción 1 — Tipo' }), { target: { value: 'button' } })

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
})

describe('ShellConfigPanel / sidebar items — recursive editor mounted in the panel', () => {
  it('adding a root sidebar item with an action.navigateTo renders it live in the real sidebar', () => {
    renderHarness(buildBaseConfig({ shell: { sidebar: { items: [] } } }))
    openSidebarTab()

    fireEvent.click(screen.getByRole('button', { name: 'Añadir elemento de sidebar' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'About' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'action' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Acción' }), {
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'Home' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Href' }), {
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento de sidebar 1 — Modo' }), {
      target: { value: 'children' },
    })

    expect(screen.getByRole('textbox', { name: 'Elemento de sidebar 1.1 — Etiqueta' })).toBeInTheDocument()
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Etiqueta' }), {
      target: { value: 'About' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Elemento de sidebar 1 — Href' }), {
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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Header activo' }))
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
    expect(screen.getByRole('checkbox', { name: 'Header activo' })).toBeChecked()
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
    expect(screen.getByRole('checkbox', { name: 'Sidebar activo' })).toBeChecked()

    fireEvent.click(screen.getByRole('tab', { name: 'Header' }))

    // The expand from before the switch survived — proof neither sub-view was ever unmounted,
    // not just that the config value round-tripped.
    expect(screen.getByTestId('menu-item-collapse-toggle-0')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox', { name: 'Elemento de menú 1 — Etiqueta' })).toBeInTheDocument()
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

    expect(screen.getByRole('checkbox', { name: 'Modo rail por defecto' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Modo rail por defecto' }))

    expect(screen.getByRole('checkbox', { name: 'Modo rail por defecto' })).toBeChecked()
    expect(rawConfig().shell).toEqual({ sidebar: { items: [], defaultCollapsed: true } })
  })
})
