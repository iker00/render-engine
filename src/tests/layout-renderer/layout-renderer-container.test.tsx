import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

const page: RuntimePageConfig = {
  id: 'home',
  layout: [
    {
      type: 'heading',
      props: {
        text: 'Welcome',
        level: 1,
      },
    },
    {
      type: 'paragraph',
      props: {
        text: 'Build forms from configuration.',
      },
    },
    {
      type: 'container',
      props: {
        direction: 'row',
        gap: 'sm',
      },
      children: [
        {
          type: 'list',
          props: {
            items: ['Reusable layout nodes', 'Static content'],
          },
        },
      ],
    },
  ],
}

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

describe('RuntimePage', () => {
  it('preserves container direction and gap semantics', () => {
    renderRuntimePage(page)

    const container = screen.getByText('Reusable layout nodes').closest('[data-layout-node="container"]')

    expect(container?.tagName).toBe('SECTION')
    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-row',
      'gap-3',
    )
    expect(container).not.toHaveAttribute('style')
  })

  it('uses md as the default visible gap for containers without an explicit gap', () => {
    renderRuntimePage({
      id: 'default-gap',
      layout: [
        {
          type: 'container',
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Default gap container',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Default gap container').closest('[data-layout-node="container"]')

    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-col',
      'flex-nowrap',
      'gap-5',
    )
    expect(container).not.toHaveAttribute('style')
  })

  it('renders columns as grid and lets columns win over direction', () => {
    renderRuntimePage({
      id: 'columns-layout',
      layout: [
        {
          type: 'container',
          props: {
            direction: 'row',
            columns: 3,
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Grid item',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Grid item').closest('[data-layout-node="container"]')

    expect(container).toHaveClass('grid', 'w-full', 'grid-cols-3', 'gap-5')
    expect(container).not.toHaveClass('flex', 'flex-row')
  })

  it('renders container variant default like the historical default and card as a closed surface', () => {
    renderRuntimePage({
      id: 'container-variants',
      layout: [
        {
          type: 'container',
          props: {
            variant: 'default',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Default variant body',
              },
            },
          ],
        },
        {
          type: 'container',
          props: {
            variant: 'card',
            columns: 2,
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Card variant body',
              },
            },
          ],
        },
      ],
    })

    const defaultContainer = screen.getByText('Default variant body').closest('[data-layout-node="container"]')
    const cardContainer = screen.getByText('Card variant body').closest('[data-layout-node="container"]')

    expect(defaultContainer).toHaveClass('flex', 'w-full', 'flex-col', 'flex-nowrap', 'gap-5')
    expect(defaultContainer).not.toHaveClass('rounded-section', 'border', 'shadow-section')

    expect(cardContainer).toHaveClass(
      'grid',
      'w-full',
      'grid-cols-2',
      'rounded-section',
      'border',
      'border-app-border-soft',
      'bg-white',
      'p-4',
      'shadow-section',
      'gap-5',
    )
    expect(cardContainer).not.toHaveClass('border-t', 'pt-5')
  })

  it('maps align justify and wrap to the rendered container classes', () => {
    renderRuntimePage({
      id: 'aligned-layout',
      layout: [
        {
          type: 'container',
          props: {
            direction: 'row',
            align: 'center',
            justify: 'between',
            wrap: 'wrap',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Aligned child',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Aligned child').closest('[data-layout-node="container"]')

    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-row',
      'items-center',
      'justify-between',
      'flex-wrap',
      'gap-5',
    )
  })

  it('keeps arbitrary container gap values through the scoped CSS variable fallback', () => {
    renderRuntimePage({
      id: 'arbitrary-gap',
      layout: [
        {
          type: 'container',
          props: {
            gap: '18px',
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Scoped gap fallback',
              },
            },
          ],
        },
      ],
    })

    const container = screen.getByText('Scoped gap fallback').closest('[data-layout-node="container"]')

    expect(container).toHaveClass(
      'flex',
      'w-full',
      'flex-col',
      'flex-nowrap',
      'gap-[var(--runtime-container-gap)]',
    )
    expect(container).toHaveStyle('--runtime-container-gap: 18px')
  })
})
