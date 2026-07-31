import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'
import { readRuntimeActiveLanguage } from '../../app/bootstrap/read-runtime-active-language'

const devConfig: RuntimeConfig = {
  api: {},
  pages: [
    {
      id: 'draft-page',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Draft Page',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'This page should stay hidden.',
          },
        },
      ],
    },
    {
      id: 'dev-home',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Dev Home',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'Local development configuration.',
          },
        },
        {
          type: 'list',
          props: {
            items: ['Shown from the selected page'],
          },
        },
      ],
    },
  ],
  initialPage: 'dev-home',
}

describe('App bootstrap', () => {
  it('renders only the page resolved by initialPage in development mode', () => {
    render(<App devConfigOverride={devConfig} isDevelopment rootElement={document.createElement('div')} />)

    expect(screen.getByRole('heading', { name: 'Dev Home', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Local development configuration.')).toBeInTheDocument()
    expect(screen.getByText('Shown from the selected page')).toBeInTheDocument()
    expect(screen.queryByText('Draft Page')).not.toBeInTheDocument()
    expect(screen.queryByText('This page should stay hidden.')).not.toBeInTheDocument()
  })

  it('renders the selected page from data-config when the container provides one', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify({
      api: {},
      pages: [
        {
          id: 'html-hidden',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'Hidden HTML Page',
                level: 1,
              },
            },
          ],
        },
        {
          id: 'html-home',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'HTML Home',
                level: 1,
              },
            },
            {
              type: 'paragraph',
              props: {
                text: 'Provided by the HTML container.',
              },
            },
          ],
        },
      ],
      initialPage: 'html-home',
    })

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByRole('heading', { name: 'HTML Home', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Provided by the HTML container.')).toBeInTheDocument()
    expect(screen.queryByText('Hidden HTML Page')).not.toBeInTheDocument()
  })

  it('shows a readable development error when initialPage does not match any page id', () => {
    render(
      <App
        devConfigOverride={{
          ...devConfig,
          initialPage: 'missing-page',
        }}
        isDevelopment
        rootElement={document.createElement('div')}
      />,
    )

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByText(/initialPage "missing-page" does not match any page id/i)).toBeInTheDocument()
    expect(screen.getByTestId('runtime-shell-content')).toHaveClass('justify-center')
    expect(screen.getByTestId('runtime-error-eyebrow')).toHaveClass(
      'uppercase',
      'tracking-[0.24em]',
      'text-app-accent',
    )
    expect(screen.getByTestId('runtime-error-message')).toHaveClass(
      'max-w-2xl',
      'text-sm',
      'leading-6',
      'text-app-text-muted',
      'sm:text-base',
      'sm:leading-7',
    )
  })

  it('shows a readable development error when layout is invalid', () => {
    render(
      <App
        devConfigOverride={{
          api: {},
          pages: [
            {
              id: 'broken-layout',
              layout: [
                {
                  type: 'container',
                  children: 'invalid-children',
                },
              ],
            },
          ],
          initialPage: 'broken-layout',
        } as unknown as RuntimeConfig}
        isDevelopment
        rootElement={document.createElement('div')}
      />,
    )

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByText(/page "broken-layout" has an invalid layout at "layout\[0\]\.children"/i)).toBeInTheDocument()
    // 0124-T2: the error block frame no longer renders as a card (no rounded-shell/bg-app-surface);
    // it keeps the content-area padding so the message isn't flush against the edge.
    const frame = screen.getByTestId('runtime-shell-frame')
    expect(frame).not.toHaveClass('rounded-shell')
    expect(frame).not.toHaveClass('bg-app-surface')
    expect(frame).toHaveClass('p-6', 'sm:p-8', 'lg:p-10')
  })

  it('shows a readable development error when a node type is not supported', () => {
    render(
      <App
        devConfigOverride={{
          api: {},
          pages: [
            {
              id: 'unsupported-node',
              layout: [
                {
                  type: 'hero-banner',
                },
              ],
            },
          ],
          initialPage: 'unsupported-node',
        } as unknown as RuntimeConfig}
        isDevelopment
        rootElement={document.createElement('div')}
      />,
    )

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(
      screen.getByText(/page "unsupported-node" uses unsupported layout node type "hero-banner" at "layout\[0\]"/i),
    ).toBeInTheDocument()
  })

  it('keeps production silent for invalid layout errors instead of showing generic fallback copy', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify({
      api: {},
      pages: [
        {
          id: 'broken-layout',
          layout: [
            {
              type: 'container',
              children: 'invalid-children',
            },
          ],
        },
      ],
      initialPage: 'broken-layout',
    })

    render(
      <App
        devConfigOverride={devConfig}
        isDevelopment={false}
        rootElement={rootElement}
      />,
    )

    expect(screen.queryByRole('heading', { name: /runtime configuration could not be loaded/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/invalid layout/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('runtime-page')).not.toBeInTheDocument()
  })

  it('keeps production silent for unsupported node errors instead of rendering invented content', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify({
      api: {},
      pages: [
        {
          id: 'unsupported-node',
          layout: [
            {
              type: 'hero-banner',
            },
          ],
        },
      ],
      initialPage: 'unsupported-node',
    })

    render(
      <App
        devConfigOverride={devConfig}
        isDevelopment={false}
        rootElement={rootElement}
      />,
    )

    expect(screen.queryByRole('heading', { name: /runtime configuration could not be loaded/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/hero-banner/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('runtime-page')).not.toBeInTheDocument()
  })

  it('shows a readable error when the runtime config is missing outside development', () => {
    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={document.createElement('div')} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(
      screen.getByText(/no runtime config was provided in data-config for this environment/i),
    ).toBeInTheDocument()
  })
})

const listDevConfig: RuntimeConfig = {
  api: {},
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.searchUsers.data',
              key: 'id',
            },
            template: [
              {
                type: 'paragraph',
                props: {
                  text: 'item.name',
                },
              },
            ],
          },
        },
      ],
    },
  ],
  initialPage: 'home',
}

describe('App bootstrap — data-values pre-seeding', () => {
  it('renders pre-seeded query data from data-values attribute in the first render without any fetch', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify(listDevConfig)
    rootElement.dataset.values = JSON.stringify({ searchUsers: [{ id: '1', name: 'Juan' }] })

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByText('Juan')).toBeInTheDocument()
  })

  it('starts normally without data-values attribute and without error', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify(devConfig)

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.queryByTestId('runtime-error-message')).not.toBeInTheDocument()
    expect(screen.getByText('Dev Home')).toBeInTheDocument()
  })

  it('shows bootstrap error when data-values contains invalid JSON (data-config valid)', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify(devConfig)
    rootElement.dataset.values = '{invalid-json'

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-eyebrow')).toHaveTextContent('Runtime config error')
    expect(screen.getByTestId('runtime-error-message')).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-message').textContent).toMatch(/data-values/)
  })

  it('shows bootstrap error when data-values root is an array', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify(devConfig)
    rootElement.dataset.values = '[1,2,3]'

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-message')).toBeInTheDocument()
  })

  it('shows data-config error message when both data-config and data-values are invalid (precedence)', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = '{invalid-config'
    rootElement.dataset.values = '{invalid-values'

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-message').textContent).toMatch(/data-config/)
  })

  it('shows data-values error when data-config is valid via dev-config and data-values is invalid JSON', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.values = '{invalid-values'

    render(<App devConfigOverride={devConfig} isDevelopment rootElement={rootElement} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-message').textContent).toMatch(/data-values/)
  })

  it('shows data-config error when data-config is invalid and data-values is valid', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = '{invalid-config'
    rootElement.dataset.values = JSON.stringify({ x: 1 })

    render(<App devConfigOverride={devConfig} isDevelopment={false} rootElement={rootElement} />)

    expect(screen.getByRole('heading', { name: /runtime configuration could not be loaded/i })).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-message').textContent).toMatch(/data-config/)
  })

  it('pre-seeds from devDataValuesOverride in development when data-values attribute is absent', () => {
    const rootElement = document.createElement('div')

    render(
      <App
        devConfigOverride={listDevConfig}
        isDevelopment
        rootElement={rootElement}
        devDataValuesOverride={{ searchUsers: [{ id: '1', name: 'Juan' }] }}
      />,
    )

    expect(screen.getByText('Juan')).toBeInTheDocument()
  })

  it('uses data-values attribute over devDataValuesOverride when both are present', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify(listDevConfig)
    rootElement.dataset.values = JSON.stringify({ searchUsers: [{ id: '2', name: 'Grace' }] })

    render(
      <App
        devConfigOverride={listDevConfig}
        isDevelopment
        rootElement={rootElement}
        devDataValuesOverride={{ searchUsers: [{ id: '1', name: 'Juan' }] }}
      />,
    )

    expect(screen.getByText('Grace')).toBeInTheDocument()
    expect(screen.queryByText('Juan')).not.toBeInTheDocument()
  })
})

describe('App bootstrap — data-lang active language reading', () => {
  it('reads "en" from data-lang attribute when present', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.lang = 'en'

    expect(readRuntimeActiveLanguage({ rootElement })).toBe('en')
  })

  it('defaults to "es" when data-lang attribute is absent', () => {
    const rootElement = document.createElement('div')

    expect(readRuntimeActiveLanguage({ rootElement })).toBe('es')
  })

  it('defaults to "es" when data-lang is an empty string', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.lang = ''

    expect(readRuntimeActiveLanguage({ rootElement })).toBe('es')
  })

  it('propagates an arbitrary lang slug without modification', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.lang = 'fr'

    expect(readRuntimeActiveLanguage({ rootElement })).toBe('fr')
  })

  it('defaults to "es" when rootElement is null', () => {
    expect(readRuntimeActiveLanguage({ rootElement: null })).toBe('es')
  })

  it('renders the app without error when data-lang is set to a known lang', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.lang = 'en'

    render(<App devConfigOverride={devConfig} isDevelopment rootElement={rootElement} />)

    expect(screen.queryByTestId('runtime-error-message')).not.toBeInTheDocument()
    expect(screen.getByText('Dev Home')).toBeInTheDocument()
  })

  it('renders the app without error when data-lang is set to an unknown lang', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.lang = 'fr'

    render(<App devConfigOverride={devConfig} isDevelopment rootElement={rootElement} />)

    expect(screen.queryByTestId('runtime-error-message')).not.toBeInTheDocument()
    expect(screen.getByText('Dev Home')).toBeInTheDocument()
  })
})
