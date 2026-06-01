import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'

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
    expect(screen.getByTestId('runtime-shell-frame')).toHaveClass(
      'rounded-shell',
      'bg-app-surface',
    )
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
