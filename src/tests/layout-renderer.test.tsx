import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'

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
  it('renders multiple root nodes in the declared order', () => {
    renderRuntimePage(page)

    const pageRoot = screen.getByTestId('runtime-page')
    const renderedNodes = pageRoot.querySelectorAll('[data-layout-node]')

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Build forms from configuration.')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('Reusable layout nodes')).toBeInTheDocument()
    expect(screen.getByText('Static content')).toBeInTheDocument()
    expect(renderedNodes[0]).toHaveAttribute('data-layout-node', 'heading')
    expect(renderedNodes[1]).toHaveAttribute('data-layout-node', 'paragraph')
    expect(renderedNodes[2]).toHaveAttribute('data-layout-node', 'container')
  })

  it('does not add a synthetic container around root siblings', () => {
    renderRuntimePage(page)

    const pageRoot = screen.getByTestId('runtime-page')

    expect(pageRoot.children).toHaveLength(3)
    expect(pageRoot.children[0]).toHaveAttribute('data-layout-node', 'heading')
    expect(pageRoot.children[1]).toHaveAttribute('data-layout-node', 'paragraph')
    expect(pageRoot.children[2]).toHaveAttribute('data-layout-node', 'container')
  })

  it('renders an empty layout without inventing fallback content', () => {
    renderRuntimePage({
      id: 'empty',
      layout: [],
    })

    const pageRoot = screen.getByTestId('runtime-page')
    expect(pageRoot.childElementCount).toBe(0)
    expect(pageRoot).not.toHaveTextContent(/\S/)
  })

  it('renders an empty list without placeholder items', () => {
    renderRuntimePage({
      id: 'empty-list',
      layout: [
        {
          type: 'list',
          props: {
            items: [],
          },
        },
      ],
    })

    const list = screen.getByRole('list')
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('treats heading, paragraph and list as leaf nodes even when they receive children', () => {
    renderRuntimePage({
      id: 'leaf-nodes',
      layout: [
        {
          type: 'container',
          children: [
            {
              type: 'heading',
              props: {
                text: 'Leaf heading',
                level: 2,
              },
              children: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'Unexpected child',
                  },
                },
              ],
            },
            {
              type: 'paragraph',
              props: {
                text: 'Leaf paragraph',
              },
              children: [
                {
                  type: 'heading',
                  props: {
                    text: 'Hidden child',
                    level: 3,
                  },
                },
              ],
            },
            {
              type: 'list',
              props: {
                items: ['Visible item'],
              },
              children: [
                {
                  type: 'paragraph',
                  props: {
                    text: 'Another hidden child',
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Leaf heading', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Leaf paragraph')).toBeInTheDocument()
    expect(screen.getByText('Visible item')).toBeInTheDocument()
    expect(screen.queryByText('Unexpected child')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden child')).not.toBeInTheDocument()
    expect(screen.queryByText('Another hidden child')).not.toBeInTheDocument()
  })

  it('preserves container direction and gap semantics', () => {
    renderRuntimePage(page)

    const container = screen.getByText('Reusable layout nodes').closest('[data-layout-node="container"]')

    expect(container).toHaveClass('flex', 'w-full', 'flex-row', 'gap-3')
    expect(container).not.toHaveAttribute('style')
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

    expect(container).toHaveClass('flex', 'w-full', 'flex-col', 'gap-[var(--runtime-container-gap)]')
    expect(container).toHaveStyle('--runtime-container-gap: 18px')
  })

  it('renders heading, paragraph and list with stable Tailwind classes', () => {
    renderRuntimePage(page)

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toHaveClass(
      'm-0',
      'text-5xl',
      'font-semibold',
      'leading-tight',
      'tracking-[-0.03em]',
      'text-slate-50',
    )
    expect(screen.getByText('Build forms from configuration.')).toHaveClass('m-0', 'text-base', 'leading-7', 'text-slate-300')
    expect(screen.getByRole('list')).toHaveClass('m-0', 'grid', 'list-disc', 'gap-2', 'pl-5', 'text-slate-200')
  })
})
