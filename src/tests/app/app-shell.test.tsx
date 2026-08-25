import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { App } from '../../app/App'
import defaultDevConfigJson from '../../dev/config.json'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'

const defaultDevConfig = defaultDevConfigJson as RuntimeConfig

// `defaultDevConfig` declares a root `preloads` block (`fetchPosts`), which fires a real network
// request on every mount unless `fetch` is stubbed. Without this, the request can settle after the
// test (or the whole Vitest jsdom environment) tears down, crashing with "window is not defined"
// from inside React's dispatch path. `minimalDevConfig` below has no `preloads`, so this stub is a
// no-op for it — kept file-wide since new tests here default to `defaultDevConfig`.
afterEach(() => {
  vi.unstubAllGlobals()
})

const minimalDevConfig: RuntimeConfig = {
  api: {},
  pages: [
    {
      id: 'bootstrap-home',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Solicitud general',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'Utiliza este formulario para presentar una solicitud general y dirigirla al área competente sin salir del runtime declarativo.',
          },
        },
        {
          type: 'form',
          id: 'generalRequestForm',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'summary',
                label: 'Expone / Solicita',
              },
            },
            {
              type: 'button',
              props: {
                label: 'Continuar',
              },
            },
          ],
        },
        {
          type: 'button',
          props: {
            label: 'Buscar posts',
            action: {
              type: 'navigateTo',
              pageId: 'search-posts',
            },
          },
        },
      ],
    },
    {
      id: 'search-posts',
      layout: [],
    },
  ],
  initialPage: 'bootstrap-home',
}

function renderDevelopmentApp(devConfigOverride: RuntimeConfig) {
  return render(
    <App
      devConfigOverride={devConfigOverride}
      isDevelopment
      rootElement={document.createElement('div')}
    />,
  )
}

describe('App shell', () => {
  it('renders the default development runtime page instead of the bootstrap shell copy', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderDevelopmentApp(minimalDevConfig)

    expect(screen.getByRole('heading', { name: 'Solicitud general', level: 1 })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Utiliza este formulario para presentar una solicitud general y dirigirla al área competente sin salir del runtime declarativo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar posts' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Expone / Solicita' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: /frontend bootstrap ready for the first runtime features/i,
      }),
    ).not.toBeInTheDocument()

    consoleWarnSpy.mockRestore()
  }, 10000)

  it('renders the runtime at full width/height of the mount container, without card or global background', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })))

    renderDevelopmentApp(defaultDevConfig)

    const runtimeApp = screen.getByTestId('runtime-app')
    expect(runtimeApp).toHaveClass('flex', 'h-full', 'w-full', 'flex-col', 'text-app-text')
    expect(runtimeApp).not.toHaveClass('min-h-screen')
    expect(runtimeApp).not.toHaveClass('bg-app-background')

    const shellContent = screen.getByTestId('runtime-shell-content')
    expect(shellContent).toHaveClass('flex', 'w-full', 'flex-1', 'min-w-0', 'min-h-0')
    expect(shellContent).not.toHaveClass('mx-auto')
    expect(shellContent).not.toHaveClass('max-w-shell')
    expect(shellContent).not.toHaveClass('px-4')
    expect(shellContent).not.toHaveClass('py-8')

    const shellFrame = screen.getByTestId('runtime-shell-frame')
    expect(shellFrame).toHaveClass('flex', 'w-full', 'flex-1', 'min-w-0', 'min-h-0', 'flex-col')
    expect(shellFrame).not.toHaveClass('rounded-shell')
    expect(shellFrame).not.toHaveClass('border')
    expect(shellFrame).not.toHaveClass('border-app-border-strong')
    expect(shellFrame).not.toHaveClass('bg-app-surface')
    expect(shellFrame).not.toHaveClass('shadow-shell')
    expect(shellFrame).not.toHaveClass('p-4')

    expect(screen.getByTestId('runtime-page')).toHaveClass('grid', 'gap-5', 'lg:gap-6')

    consoleWarnSpy.mockRestore()
  })

  it('pads the page content wrapper with the content-area padding when there is no sidebar', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderDevelopmentApp(minimalDevConfig)

    expect(screen.getByTestId('runtime-page-content')).toHaveClass('p-6', 'sm:p-8', 'lg:p-10')

    consoleWarnSpy.mockRestore()
  })

  it('renders without shell.scrollBehavior identically to the T2 close (page mode, no overflow confinement)', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderDevelopmentApp(minimalDevConfig)

    expect(screen.getByTestId('runtime-app')).not.toHaveClass('overflow-hidden')
    const pageContent = screen.getByTestId('runtime-page-content')
    expect(pageContent).not.toHaveClass('overflow-y-auto')
    expect(pageContent).not.toHaveClass('flex-1')
    expect(pageContent).not.toHaveClass('min-h-0')

    consoleWarnSpy.mockRestore()
  })

  it('renders the config-error block with the same reset and the content-area padding applied to the frame', () => {
    render(
      <App
        devConfigOverride={{ ...minimalDevConfig, initialPage: 'missing-page' }}
        isDevelopment
        rootElement={document.createElement('div')}
      />,
    )

    const runtimeApp = screen.getByTestId('runtime-app')
    expect(runtimeApp).toHaveClass('flex', 'h-full', 'w-full', 'flex-col', 'text-app-text')
    expect(runtimeApp).not.toHaveClass('min-h-screen')
    expect(runtimeApp).not.toHaveClass('bg-app-background')

    const shellContent = screen.getByTestId('runtime-shell-content')
    expect(shellContent).not.toHaveClass('max-w-shell')
    expect(shellContent).not.toHaveClass('mx-auto')
    expect(shellContent).not.toHaveClass('px-4')

    const shellFrame = screen.getByTestId('runtime-shell-frame')
    expect(shellFrame).not.toHaveClass('rounded-shell')
    expect(shellFrame).not.toHaveClass('bg-app-surface')
    expect(shellFrame).toHaveClass('p-6', 'sm:p-8', 'lg:p-10')

    expect(screen.getByTestId('runtime-error-message')).toBeInTheDocument()
  })
})
