import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ButtonColor, RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: baseState.navigation.currentPageId,
      params: baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: state,
        state,
        dispatch,
        dispatchAndSyncState,
        getLatestState: () => state,
      }}
    >
      <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
}

describe('ButtonNode style variants', () => {
  it('renders a danger solid button with semantic bg-danger-600', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Delete',
            color: 'danger',
            variant: 'solid',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button.className).toContain('bg-danger-600')
    expect(button.className).not.toMatch(/red-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a primary outline button with semantic border-primary-500 and text-primary-600', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Edit',
            color: 'primary',
            variant: 'outline',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Edit' })
    expect(button.className).toContain('border-primary-500')
    expect(button.className).toContain('text-primary-600')
    expect(button.className).not.toMatch(/blue-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a success ghost button with semantic text-success-600', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Confirm',
            color: 'success',
            variant: 'ghost',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Confirm' })
    expect(button.className).toContain('text-success-600')
    expect(button.className).not.toMatch(/green-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders an info link button with semantic text-info-600 and hover:underline', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'More info',
            color: 'info',
            variant: 'link',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'More info' })
    expect(button.className).toContain('text-info-600')
    expect(button.className).toContain('hover:underline')
    expect(button.className).not.toMatch(/cyan-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a button without color or variant with default primary solid (bg-primary-600)', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Default',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Default' })
    expect(button.className).toContain('bg-primary-600')
    expect(button.className).not.toMatch(/blue-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a button with fullWidth: true with w-full class', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Wide',
            fullWidth: true,
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Wide' })
    expect(button.className).toContain('w-full')
    expect(button.className).not.toContain('self-start')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a button without fullWidth (default false) with self-start class', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Narrow',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Narrow' })
    expect(button.className).toContain('self-start')
    expect(button.className).not.toContain('w-full')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders an implicit submit button inside a form with danger outline (border-red-500) and type=submit', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'form',
          id: 'myForm',
          children: [
            {
              type: 'input',
              props: { fieldId: 'name', label: 'Name' },
            },
            {
              type: 'button',
              props: {
                label: 'Submit form',
                color: 'danger',
                variant: 'outline',
              },
            },
          ],
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Submit form' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button.className).toContain('border-danger-500')
    expect(button.className).not.toMatch(/red-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders an implicit submit button inside a form with fullWidth and type=submit', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'form',
          id: 'myForm',
          children: [
            {
              type: 'input',
              props: { fieldId: 'name', label: 'Name' },
            },
            {
              type: 'button',
              props: {
                label: 'Submit form',
                fullWidth: true,
              },
            },
          ],
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Submit form' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button.className).toContain('w-full')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a non-submit button with fullWidth: false and type=button', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Action',
            fullWidth: false,
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Action' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('self-start')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })
})

describe('ButtonNode variant "switch" rendering', () => {
  it('renders role="switch" with aria-checked="true" when checked: true', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: { label: 'Enabled', variant: 'switch', checked: true, action: { type: 'goBack' } },
        },
      ],
    })

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders role="switch" with aria-checked="false" when checked: false', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: { label: 'Enabled', variant: 'switch', checked: false, action: { type: 'goBack' } },
        },
      ],
    })

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('resolves aria-checked independently per row when checked: "item.isPrimary" inside a repeater', () => {
    const page: RuntimePageConfig = {
      id: 'page',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.items.data', key: 'id' },
            template: [
              {
                type: 'button',
                props: {
                  label: 'Primary',
                  variant: 'switch',
                  checked: 'item.isPrimary',
                  action: { type: 'goBack' },
                },
              },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      items: {
        status: 'success',
        data: [
          { id: 'a', isPrimary: true },
          { id: 'b', isPrimary: false },
        ],
        error: null,
        requestSignature: null,
      },
    })

    renderRuntimePageWithState(page, state)

    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('renders aria-checked="false" when checked references a well-formed reference without available data', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Enabled',
            variant: 'switch',
            checked: 'queries.missingQuery.data.flag',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps a literal checked value stable across re-renders', () => {
    const page: RuntimePageConfig = {
      id: 'page',
      layout: [
        {
          type: 'button',
          props: { label: 'Enabled', variant: 'switch', checked: true, action: { type: 'goBack' } },
        },
      ],
    }
    const { rerender } = renderRuntimePage(page)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')

    const config: RuntimeConfig = { api: {}, initialPage: page.id, pages: [page] }
    rerender(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it.each<ButtonColor>(['neutral', 'primary', 'success', 'warning', 'danger', 'info'])(
    'tints the track with color %s only when checked: true, and uses a neutral track when checked: false',
    (color) => {
      const { unmount } = renderRuntimePage({
        id: 'page',
        layout: [
          {
            type: 'button',
            props: { label: 'On', variant: 'switch', color, checked: true, action: { type: 'goBack' } },
          },
        ],
      })

      const checkedSwitch = screen.getByRole('switch')
      const checkedTrackClass = checkedSwitch.className

      unmount()

      renderRuntimePage({
        id: 'page',
        layout: [
          {
            type: 'button',
            props: { label: 'Off', variant: 'switch', color, checked: false, action: { type: 'goBack' } },
          },
        ],
      })

      const uncheckedSwitch = screen.getByRole('switch')
      expect(uncheckedSwitch.className).toContain('bg-neutral-200')
      expect(uncheckedSwitch.className).not.toEqual(checkedTrackClass)
    },
  )

  it('hides the visible label but exposes aria-label when labelVisible: false', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Enable notifications',
            variant: 'switch',
            checked: true,
            labelVisible: false,
            action: { type: 'goBack' },
          },
        },
      ],
    })

    expect(screen.queryByText('Enable notifications')).not.toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Enable notifications')
  })

  it('renders the visible label without aria-label when labelVisible is absent', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: { label: 'Enable notifications', variant: 'switch', checked: true, action: { type: 'goBack' } },
        },
      ],
    })

    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-label')
  })

  it('renders the visible label without aria-label when labelVisible: true', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Enable notifications',
            variant: 'switch',
            checked: true,
            labelVisible: true,
            action: { type: 'goBack' },
          },
        },
      ],
    })

    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-label')
  })
})
