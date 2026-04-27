import { render, screen } from '@testing-library/react'
import { App } from '../app/App'

describe('App shell', () => {
  it('renders the bootstrap shell copy and capability cards', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /frontend bootstrap ready for the first runtime features/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/single-package frontend with pnpm-managed dependencies/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/run a local shell without backend dependencies/i)).toBeInTheDocument()
    expect(
      screen.getByText(/resolve config from data-config or the local development fixture/i),
    ).toBeInTheDocument()
  })
})
