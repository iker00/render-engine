import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { App } from '../app/App'
import defaultDevConfigJson from '../dev/config.json'
import type { RuntimeConfig } from '../app/bootstrap/read-runtime-config'

const defaultDevConfig = defaultDevConfigJson as RuntimeConfig

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

  it('renders the runtime inside a centered light shell frame', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderDevelopmentApp(defaultDevConfig)

    expect(screen.getByTestId('runtime-app')).toHaveClass(
      'min-h-screen',
      'bg-app-background',
      'text-app-text',
    )

    expect(screen.getByTestId('runtime-shell-content')).toHaveClass(
      'mx-auto',
      'max-w-shell',
      'px-4',
      'py-8',
      'lg:px-8',
      'lg:py-12',
    )

    expect(screen.getByTestId('runtime-shell-frame')).toHaveClass(
      'rounded-shell',
      'border-app-border-strong',
      'bg-app-surface',
      'p-4',
      'lg:p-8',
    )

    expect(screen.getByTestId('runtime-page')).toHaveClass('grid', 'gap-5', 'lg:gap-6')
    expect(screen.getByText('Datos de la persona interesada').closest('[data-layout-node="container"]')).toHaveClass(
      'border-t',
      'border-app-border-soft',
      'pt-5',
    )
    expect(screen.getByText('Datos de la persona interesada').closest('[data-layout-node="container"]')).not.toHaveClass(
      '-mx-5',
      'sm:-mx-6',
    )
    expect(screen.getByRole('button', { name: 'Continuar' }).closest('[data-layout-node="container"]')).not.toHaveClass(
      'border-t',
      'border-app-border-soft',
      'py-6',
      '-mx-5',
      'sm:-mx-6',
    )
    expect(screen.getByRole('button', { name: 'Buscar posts' }).closest('[data-layout-node="container"]')).toHaveClass(
      'flex',
      'w-full',
      'flex-row',
      'flex-nowrap',
      'gap-3',
    )
    expect(screen.getByRole('button', { name: 'Buscar posts' }).closest('[data-layout-node="container"]')).not.toHaveClass(
      'border-t',
      'border-app-border-soft',
      '-mx-5',
      'sm:-mx-6',
    )

    consoleWarnSpy.mockRestore()
  })
})
