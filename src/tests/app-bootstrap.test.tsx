import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App'
import type { RuntimeConfig } from '../app/bootstrap/read-runtime-config'

const devConfig: RuntimeConfig = {
  api: {},
  pages: [
    {
      id: 'dev-home',
      title: 'Dev Home',
      description: 'Local development configuration.',
    },
  ],
  initialPage: 'dev-home',
}

describe('App bootstrap', () => {
  it('renders the shell using the repository development config in development mode', () => {
    render(<App devConfigOverride={devConfig} isDevelopment rootElement={document.createElement('div')} />)

    expect(screen.getByText(/src\/dev\/config\.json/i)).toBeInTheDocument()
    expect(screen.getByText(/initial page:/i)).toHaveTextContent('Initial page: dev-home')
    expect(screen.getByText(/dev home: local development configuration/i)).toBeInTheDocument()
  })

  it('renders the shell from data-config when the container provides one', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify({
      api: {},
      pages: [
        {
          id: 'html-home',
          title: 'HTML Home',
          description: 'Provided by the HTML container.',
        },
      ],
      initialPage: 'html-home',
    })

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByText(/^data-config$/i)).toBeInTheDocument()
    expect(screen.getByText(/initial page:/i)).toHaveTextContent('Initial page: html-home')
    expect(screen.getByText(/html home: provided by the html container/i)).toBeInTheDocument()
  })

  it('shows a readable error when the runtime config is missing or invalid', () => {
    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={document.createElement('div')} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(
      screen.getByText(/no runtime config was provided in data-config for this environment/i),
    ).toBeInTheDocument()
  })
})
