import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider, useRuntimeStateActions } from '../../runtime/runtime-state/runtime-state-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

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

function renderMultiPageRuntime(config: RuntimeConfig) {
  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
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
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(activePage: RuntimePageConfig, overrides?: Partial<RuntimeState>): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const base = createRuntimeState(config)
  return { ...base, ...overrides } satisfies RuntimeState
}

describe('ModalNode', () => {
  describe('initial render', () => {
    it('does not render the panel when the modal is closed', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Modal title' } }],
          },
        ],
      }

      renderRuntimePage(page)

      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
      expect(screen.queryByText('Modal title')).not.toBeInTheDocument()
    })

    it('renders empty panel without errors when modal has no children', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'empty-modal' } },
          },
          {
            type: 'modal',
            id: 'empty-modal',
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
      expect(screen.getByTestId('modal-panel')).toBeEmptyDOMElement()
    })
  })

  describe('opening and closing', () => {
    it('opens the overlay and panel when openModal button is clicked', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Modal content' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument()
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
      expect(screen.getByText('Modal content')).toBeInTheDocument()
    })

    it('closes when a closeModal button inside the modal is clicked', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [
              {
                type: 'button',
                props: { label: 'Close', action: { type: 'closeModal', modalId: 'test-modal' } },
              },
            ],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    })

    it('closes when Escape key is pressed on the overlay', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'ESC test' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument()

      fireEvent.keyDown(screen.getByTestId('modal-overlay'), { key: 'Escape' })
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
    })

    it('closes when clicking the overlay background (outside the panel)', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Click overlay test' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      fireEvent.click(screen.getByTestId('modal-overlay'))
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    })

    it('does not close when clicking inside the panel', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Panel content' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('modal-panel'))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
    })

    it('closeModal on an already closed modal does not produce errors or open the modal', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Close anyway', action: { type: 'closeModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Should not open' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Close anyway' }))

      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    })

    it('external closeModal button (outside the modal) closes the modal', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'test-modal' } },
          },
          {
            type: 'button',
            props: { label: 'Close from outside', action: { type: 'closeModal', modalId: 'test-modal' } },
          },
          {
            type: 'modal',
            id: 'test-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Content' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Close from outside' }))
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    })
  })

  describe('sizes', () => {
    it('sm, md and lg produce visibly different panel width classes', () => {
      const pageWithSm: RuntimePageConfig = {
        id: 'home',
        layout: [
          { type: 'button', props: { label: 'Open sm', action: { type: 'openModal', modalId: 'sm-modal' } } },
          { type: 'modal', id: 'sm-modal', props: { size: 'sm' } },
        ],
      }
      const pageWithMd: RuntimePageConfig = {
        id: 'home',
        layout: [
          { type: 'button', props: { label: 'Open md', action: { type: 'openModal', modalId: 'md-modal' } } },
          { type: 'modal', id: 'md-modal', props: { size: 'md' } },
        ],
      }
      const pageWithLg: RuntimePageConfig = {
        id: 'home',
        layout: [
          { type: 'button', props: { label: 'Open lg', action: { type: 'openModal', modalId: 'lg-modal' } } },
          { type: 'modal', id: 'lg-modal', props: { size: 'lg' } },
        ],
      }

      const { unmount: unmountSm } = renderRuntimePage(pageWithSm)
      fireEvent.click(screen.getByRole('button', { name: 'Open sm' }))
      const smClass = screen.getByTestId('modal-panel').className
      unmountSm()

      const { unmount: unmountMd } = renderRuntimePage(pageWithMd)
      fireEvent.click(screen.getByRole('button', { name: 'Open md' }))
      const mdClass = screen.getByTestId('modal-panel').className
      unmountMd()

      const { unmount: unmountLg } = renderRuntimePage(pageWithLg)
      fireEvent.click(screen.getByRole('button', { name: 'Open lg' }))
      const lgClass = screen.getByTestId('modal-panel').className
      unmountLg()

      expect(smClass).not.toBe(mdClass)
      expect(mdClass).not.toBe(lgClass)
      expect(smClass).not.toBe(lgClass)
    })
  })

  describe('defaultOpen', () => {
    it('opens automatically on first page render when defaultOpen is true', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'modal',
            id: 'auto-modal',
            props: { defaultOpen: true },
            children: [{ type: 'heading', props: { level: 2, text: 'Auto opened' } }],
          },
        ],
      }

      renderRuntimePage(page)

      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
      expect(screen.getByText('Auto opened')).toBeInTheDocument()
    })

    it('does not re-open after user closes it within the same page entry', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'modal',
            id: 'auto-modal',
            props: { defaultOpen: true },
            children: [
              {
                type: 'button',
                props: { label: 'Close', action: { type: 'closeModal', modalId: 'auto-modal' } },
              },
            ],
          },
        ],
      }

      renderRuntimePage(page)
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    })

    it('re-opens on a new page entry after navigation', () => {
      const config: RuntimeConfig = {
        api: {},
        initialPage: 'home',
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Go to other', action: { type: 'navigateTo', pageId: 'other' } },
              },
              {
                type: 'modal',
                id: 'auto-modal',
                props: { defaultOpen: true },
                children: [{ type: 'heading', props: { level: 2, text: 'Auto opened' } }],
              },
            ],
          },
          {
            id: 'other',
            layout: [
              {
                type: 'button',
                props: { label: 'Go back', action: { type: 'navigateTo', pageId: 'home' } },
              },
            ],
          },
        ],
      }

      renderMultiPageRuntime(config)
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Go to other' }))
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
    })
  })

  describe('visibility and queryStateFeedback', () => {
    it('does not render when visibility evaluates to false', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'vis-modal' } },
          },
          {
            type: 'modal',
            id: 'vis-modal',
            visibility: {
              reference: 'queries.myQuery.data.show',
              operator: 'isTruthy',
            },
            children: [{ type: 'heading', props: { level: 2, text: 'Hidden modal' } }],
          },
        ],
      }

      const state = createRuntimePageState(page, {
        queries: {
          myQuery: {
            status: 'success',
            data: { show: false },
            error: null,
            requestSignature: null,
          },
        },
      })

      renderRuntimePageWithState(page, state)

      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
    })

    it('renders queryStateFeedback fallback and does not show modal panel', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'modal',
            id: 'feedback-modal',
            props: { defaultOpen: true },
            queryStateFeedback: {
              query: 'myQuery',
              states: {
                loading: {
                  mode: 'fallback',
                  fallback: [{ type: 'heading', props: { level: 2, text: 'Loading state' } }],
                },
              },
            },
            children: [{ type: 'heading', props: { level: 2, text: 'Modal content' } }],
          },
        ],
      }

      const state = createRuntimePageState(page, {
        queries: {
          myQuery: {
            status: 'loading',
            data: null,
            error: null,
            requestSignature: null,
          },
        },
      })

      renderRuntimePageWithState(page, state)

      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
      expect(screen.getByText('Loading state')).toBeInTheDocument()
    })
  })

  describe('ARIA attributes', () => {
    it('renders modal panel with role="dialog" and aria-modal="true" when open', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'aria-modal' } },
          },
          {
            type: 'modal',
            id: 'aria-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Content' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      const panel = screen.getByTestId('modal-panel')
      expect(panel).toHaveAttribute('role', 'dialog')
      expect(panel).toHaveAttribute('aria-modal', 'true')
    })

    it('renders panel with aria-label="Diálogo" when props.label is not set', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'no-label-modal' } },
          },
          {
            type: 'modal',
            id: 'no-label-modal',
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      const panel = screen.getByTestId('modal-panel')
      expect(panel).toHaveAttribute('aria-label', 'Diálogo')
    })

    it('renders panel with aria-label matching props.label when set', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'labeled-modal' } },
          },
          {
            type: 'modal',
            id: 'labeled-modal',
            props: { label: 'Confirmar eliminación' },
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      const panel = screen.getByTestId('modal-panel')
      expect(panel).toHaveAttribute('aria-label', 'Confirmar eliminación')
    })

    it('panel is locatable via getByRole("dialog") when open', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'role-modal' } },
          },
          {
            type: 'modal',
            id: 'role-modal',
            children: [{ type: 'heading', props: { level: 2, text: 'Dialog content' } }],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('modal inside repeater template applies aria-label to the opened instance', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.list.data', key: 'id' },
              template: [
                {
                  type: 'button',
                  props: { label: 'Open item modal', action: { type: 'openModal', modalId: 'item-modal' } },
                },
                {
                  type: 'modal',
                  id: 'item-modal',
                  props: { label: 'Item dialog' },
                  children: [{ type: 'heading', props: { level: 2, text: 'Item content' } }],
                },
              ],
            },
          },
        ],
      }

      const config: RuntimeConfig = {
        api: {},
        initialPage: page.id,
        pages: [page],
      }

      const state: RuntimeState = {
        ...createRuntimeState(config),
        queries: {
          list: {
            status: 'success',
            data: [{ id: 'a' }],
            error: null,
            requestSignature: null,
          },
        },
        modal: {
          activeModalId: 'item-modal',
          activeIterationKey: 'a',
        },
      }

      render(
        <RuntimeStateContext.Provider
          value={{
            config,
            initialState: state,
            state,
            dispatch: vi.fn(),
            dispatchAndSyncState: vi.fn(),
            getLatestState: () => state,
          }}
        >
          <RuntimePage />
        </RuntimeStateContext.Provider>,
      )

      const panel = screen.getByTestId('modal-panel')
      expect(panel).toHaveAttribute('aria-label', 'Item dialog')
    })
  })

  describe('focus management', () => {
    it('moves focus to the first focusable element inside the panel when opened', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'focus-modal' } },
          },
          {
            type: 'modal',
            id: 'focus-modal',
            children: [
              {
                type: 'button',
                props: { label: 'First focusable', action: { type: 'closeModal', modalId: 'focus-modal' } },
              },
            ],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First focusable' }))
    })

    it('restores focus to the previously focused element when the modal closes', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'focus-modal' } },
          },
          {
            type: 'modal',
            id: 'focus-modal',
            children: [
              {
                type: 'button',
                props: { label: 'Close', action: { type: 'closeModal', modalId: 'focus-modal' } },
              },
            ],
          },
        ],
      }

      renderRuntimePage(page)
      const openButton = screen.getByRole('button', { name: 'Open' })
      openButton.focus()

      fireEvent.click(openButton)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(document.activeElement).toBe(openButton)
    })

    it('keeps focus inside the panel when Tab is pressed on the last focusable element', () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open', action: { type: 'openModal', modalId: 'trap-modal' } },
          },
          {
            type: 'modal',
            id: 'trap-modal',
            children: [
              {
                type: 'button',
                props: { label: 'Only button', action: { type: 'closeModal', modalId: 'trap-modal' } },
              },
            ],
          },
        ],
      }

      renderRuntimePage(page)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }))

      const onlyButton = screen.getByRole('button', { name: 'Only button' })
      expect(document.activeElement).toBe(onlyButton)

      fireEvent.keyDown(screen.getByTestId('modal-overlay'), { key: 'Tab' })
      expect(document.activeElement).toBe(onlyButton)
    })
  })

  describe('navigation', () => {
    it('closes the modal when navigating to another page', () => {
      const config: RuntimeConfig = {
        api: {},
        initialPage: 'home',
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'button',
                props: { label: 'Open modal', action: { type: 'openModal', modalId: 'nav-modal' } },
              },
              {
                type: 'button',
                props: { label: 'Go to other', action: { type: 'navigateTo', pageId: 'other' } },
              },
              {
                type: 'modal',
                id: 'nav-modal',
                children: [{ type: 'heading', props: { level: 2, text: 'Will close' } }],
              },
            ],
          },
          {
            id: 'other',
            layout: [{ type: 'heading', props: { level: 1, text: 'Other page' } }],
          },
        ],
      }

      renderMultiPageRuntime(config)
      fireEvent.click(screen.getByRole('button', { name: 'Open modal' }))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Go to other' }))
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
      expect(screen.getByText('Other page')).toBeInTheDocument()
    })
  })

  describe('form inside modal', () => {
    it('renders and submits a form inside a modal without errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))

      const page: RuntimePageConfig = {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: { label: 'Open form modal', action: { type: 'openModal', modalId: 'form-modal' } },
          },
          {
            type: 'modal',
            id: 'form-modal',
            children: [
              {
                type: 'form',
                id: 'inner-form',
                submitAction: { operationName: 'submitForm' },
                children: [
                  { type: 'input', props: { fieldId: 'name', label: 'Name', inputType: 'text' } },
                ],
              },
            ],
          },
        ],
      }

      const config: RuntimeConfig = {
        api: {
          baseUrl: 'https://api.example.com',
          operations: {
            submitForm: { method: 'POST', path: '/submit' },
          },
        },
        initialPage: page.id,
        pages: [page],
      }

      render(
        <RuntimeStateProvider config={config}>
          <RuntimePage />
        </RuntimeStateProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open form modal' }))
      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

      const nameInput = screen.getByLabelText('Name')
      expect(nameInput).toBeInTheDocument()
      fireEvent.change(nameInput, { target: { value: 'Alice' } })
      fireEvent.submit(nameInput.closest('form')!)

      expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
    })
  })
})
