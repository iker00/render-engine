import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { App } from '../app/App'

describe('App shell', () => {
  it('renders the default development runtime page instead of the bootstrap shell copy', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    render(<App />)

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
  })

  it('renders the runtime inside a centered light shell frame', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    render(<App />)

    expect(screen.getByTestId('runtime-app')).toHaveClass(
      'min-h-screen',
      'bg-app-background',
      'text-app-text',
    )

    expect(screen.getByTestId('runtime-shell-content')).toHaveClass(
      'mx-auto',
      'max-w-shell',
      'px-4',
      'lg:px-8',
    )

    expect(screen.getByTestId('runtime-shell-frame')).toHaveClass(
      'rounded-shell',
      'border-app-border-strong',
      'bg-app-surface',
    )

    expect(screen.getByTestId('runtime-page')).toHaveClass('grid', 'gap-6', 'lg:gap-8')
    expect(screen.getByText('Datos de la persona interesada').closest('[data-layout-node="container"]')).toHaveClass(
      '-mx-5',
      'border-t',
      'border-app-border-soft',
      'px-5',
      'py-6',
    )

    consoleWarnSpy.mockRestore()
  })
})
