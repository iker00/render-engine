import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePageWithTranslations(
  activePage: RuntimePageConfig,
  translations: RuntimeConfig['translations'],
  activeLanguage?: string,
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
    translations,
  }

  return render(
    <RuntimeStateProvider config={config} activeLanguage={activeLanguage}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('Layout renderer — translations', () => {
  it('renders button.props.label with the Spanish translation when activeLanguage is "es"', () => {
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: {
              label: 't.confirmBtn',
              action: { type: 'goBack' },
            },
          },
        ],
      },
      { confirmBtn: { es: 'Confirmar', en: 'Confirm' } },
      'es',
    )

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('renders button.props.label with the English translation when activeLanguage is "en"', () => {
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: {
              label: 't.confirmBtn',
              action: { type: 'goBack' },
            },
          },
        ],
      },
      { confirmBtn: { es: 'Confirmar', en: 'Confirm' } },
      'en',
    )

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('renders heading with interpolated translation', () => {
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 'Hola, {{t.greeting}}',
              level: 1,
            },
          },
        ],
      },
      { greeting: { es: 'mundo', en: 'world' } },
      'es',
    )

    expect(screen.getByRole('heading', { name: 'Hola, mundo', level: 1 })).toBeInTheDocument()
  })

  it('falls back to "es" translation when activeLanguage is "fr" and the key only has "es" and "en"', () => {
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: {
              label: 't.confirmBtn',
              action: { type: 'goBack' },
            },
          },
        ],
      },
      { confirmBtn: { es: 'Confirmar', en: 'Confirm' } },
      'fr',
    )

    // Fallback to "es" per the spec (criterion 5)
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('uses "es" by default when no activeLanguage is provided', () => {
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 't.confirmBtn',
              level: 2,
            },
          },
        ],
      },
      { confirmBtn: { es: 'Confirmar', en: 'Confirm' } },
      undefined,
    )

    // No activeLanguage → defaults to "es"
    expect(screen.getByRole('heading', { name: 'Confirmar', level: 2 })).toBeInTheDocument()
  })

  it('shows the key name in dev when the translation key does not exist in any language', () => {
    // Vitest runs with DEV=true by default
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 't.missingKey',
              level: 2,
            },
          },
        ],
      },
      {},
      'es',
    )

    expect(screen.getByRole('heading', { name: 'missingKey', level: 2 })).toBeInTheDocument()
  })

  it('shows empty string in prod when the translation key does not exist in any language', () => {
    vi.stubEnv('DEV', false)

    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'heading',
            props: {
              text: 't.missingKey',
              level: 2,
            },
          },
        ],
      },
      {},
      'es',
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
  })

  it('renders image.props.alt from a translation key', () => {
    renderRuntimePageWithTranslations(
      {
        id: 'home',
        layout: [
          {
            type: 'image',
            props: {
              src: '/img/icon.svg',
              alt: 't.searchIcon',
            },
          },
        ],
      },
      { searchIcon: { es: 'Buscar' } },
      'es',
    )

    expect(screen.getByRole('img', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('degrades t.group.key (two-segment path) to empty string and does not throw', () => {
    expect(() => {
      renderRuntimePageWithTranslations(
        {
          id: 'home',
          layout: [
            {
              type: 'heading',
              props: {
                text: 't.group.key',
                level: 2,
              },
            },
          ],
        },
        { group: { es: 'Group' } },
        'es',
      )
    }).not.toThrow()

    // Invalid shape: two segments are not supported; degrades to empty
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
  })

  it('does not throw when visibility.reference contains a t.* path and renders without error', () => {
    // t.* in visibility.reference is out of scope per the spec; the visibility
    // evaluator calls resolveRuntimeReference which now resolves the translation to a string.
    // The important contract here is: no throw and no crash; the visibility outcome simply
    // follows whatever the resolved value is (truthy string → shown, empty → hidden).
    const activePage: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'heading',
          props: { text: 'Visible heading', level: 1 },
          visibility: {
            reference: 't.flag',
            operator: 'isTruthy',
          },
        },
      ],
    }

    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
      translations: { flag: { es: 'yes' } },
    }

    const state = createRuntimeState(config, { activeLanguage: 'es' })
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    // Must not throw
    expect(() => {
      render(
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
    }).not.toThrow()

    // The render completes without crashing; visibility outcome is not specified (out of scope).
    // Assert only that the page renders the runtime-page container.
    expect(screen.getByTestId('runtime-page')).toBeInTheDocument()
  })
})
