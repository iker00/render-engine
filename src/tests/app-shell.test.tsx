import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { App } from '../app/App'

describe('App shell', () => {
  it('renders the default development runtime page instead of the bootstrap shell copy', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Bootstrap Home', level: 1 })).toBeInTheDocument()
    expect(
      screen.getByText('Static runtime contract validated before rendering.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ir a detalles' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar posts' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: /frontend bootstrap ready for the first runtime features/i,
      }),
    ).not.toBeInTheDocument()

    consoleWarnSpy.mockRestore()
  })
})
