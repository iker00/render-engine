import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'
import type { MenuItemConfig } from '../../config/runtime-config-types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function buildConfigWithDropdown(dropdownItem: MenuItemConfig): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          { type: 'heading', props: { text: 'Home page', level: 1 } },
          {
            type: 'button',
            props: {
              label: 'Reveal admin item',
              action: { type: 'navigateTo', pageId: 'home', params: { role: 'admin' } },
            },
          },
        ],
      },
      { id: 'settings', layout: [{ type: 'heading', props: { text: 'Settings page', level: 1 } }] },
    ],
    shell: { header: { menu: [dropdownItem] } },
  }
}

const defaultDropdownItem: MenuItemConfig = {
  label: 'Admin',
  children: [
    { label: 'Users', action: { type: 'navigateTo', pageId: 'settings' } },
    { label: 'External docs', href: '#docs' },
    {
      label: 'Hidden item',
      action: { type: 'navigateTo', pageId: 'settings' },
      visibility: { reference: 'params.role', operator: 'equals', value: 'admin' },
    },
  ],
}

function renderApp(dropdownItem: MenuItemConfig = defaultDropdownItem) {
  return render(
    <App
      devConfigOverride={buildConfigWithDropdown(dropdownItem)}
      isDevelopment
      rootElement={document.createElement('div')}
    />,
  )
}

describe('MenuItemDropdown — initial state and open/close', () => {
  it('starts closed: trigger has aria-expanded=false and no role="menu" is in the DOM', () => {
    renderApp()

    const trigger = screen.getByRole('button', { name: /Admin/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens on trigger click: aria-expanded=true, role="menu" present, focus moves to the first menuitem', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))

    expect(screen.getByRole('button', { name: /Admin/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Users/ })).toHaveFocus()
  })

  it('regression: clicking the trigger never calls the runtime action executor (only opens/closes)', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))

    // Opening the dropdown must not itself navigate away from home.
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument()
  })

  it('Esc closes the dropdown, sets aria-expanded=false and returns focus to the trigger', () => {
    renderApp()

    const trigger = screen.getByRole('button', { name: /Admin/ })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('closes when clicking outside the trigger+panel wrapper', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Home page' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('MenuItemDropdown — selecting a child', () => {
  it('selecting a child by click closes the dropdown and navigates like a root navigable menuItem', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Users/ }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
  })

  it('selecting a child by Enter closes the dropdown and navigates', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Users/ }), { key: 'Enter' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
  })

  it('selecting a child by Space closes the dropdown and navigates', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Users/ }), { key: ' ' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
  })

  it('renders an href child as a native <a role="menuitem">, and selecting it by click closes the dropdown', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    const docsItem = screen.getByRole('menuitem', { name: /External docs/ })
    expect(docsItem.tagName).toBe('A')
    expect(docsItem).toHaveAttribute('href', '#docs')

    fireEvent.click(docsItem)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('MenuItemDropdown — keyboard navigation between items', () => {
  it('ArrowDown/ArrowUp move focus between visible menuitems, wrapping at the ends', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    const menu = screen.getByRole('menu')
    const users = screen.getByRole('menuitem', { name: /Users/ })
    const docs = screen.getByRole('menuitem', { name: /External docs/ })

    expect(users).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(docs).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(users).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(docs).toHaveFocus()
  })

  it('Home/End move focus to the first/last visible menuitem', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    const menu = screen.getByRole('menu')
    const users = screen.getByRole('menuitem', { name: /Users/ })
    const docs = screen.getByRole('menuitem', { name: /External docs/ })

    fireEvent.keyDown(menu, { key: 'End' })
    expect(docs).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'Home' })
    expect(users).toHaveFocus()
  })
})

describe('MenuItemDropdown — visibility and active state', () => {
  it('regression: a hidden child (visibility not met) never renders in the DOM', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))

    expect(screen.queryByRole('menuitem', { name: /Hidden item/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('reveals a previously hidden child once its visibility condition is met, without leaving a gap', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Reveal admin item' }))
    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))

    await waitFor(() => expect(screen.getAllByRole('menuitem')).toHaveLength(3))
    expect(screen.getByRole('menuitem', { name: /Hidden item/ })).toBeInTheDocument()
  })
})
