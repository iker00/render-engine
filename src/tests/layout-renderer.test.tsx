import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimePageConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'

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

describe('RuntimePage', () => {
  it('renders multiple root nodes in the declared order', () => {
    render(<RuntimePage page={page} />)

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
    render(<RuntimePage page={page} />)

    const pageRoot = screen.getByTestId('runtime-page')

    expect(pageRoot.children).toHaveLength(3)
    expect(pageRoot.children[0]).toHaveAttribute('data-layout-node', 'heading')
    expect(pageRoot.children[1]).toHaveAttribute('data-layout-node', 'paragraph')
    expect(pageRoot.children[2]).toHaveAttribute('data-layout-node', 'container')
  })

  it('renders an empty layout without inventing fallback content', () => {
    render(
      <RuntimePage
        page={{
          id: 'empty',
          layout: [],
        }}
      />,
    )

    const pageRoot = screen.getByTestId('runtime-page')
    expect(pageRoot.childElementCount).toBe(0)
    expect(pageRoot).not.toHaveTextContent(/\S/)
  })

  it('renders an empty list without placeholder items', () => {
    render(
      <RuntimePage
        page={{
          id: 'empty-list',
          layout: [
            {
              type: 'list',
              props: {
                items: [],
              },
            },
          ],
        }}
      />,
    )

    const list = screen.getByRole('list')
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('treats heading, paragraph and list as leaf nodes even when they receive children', () => {
    render(
      <RuntimePage
        page={{
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
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Leaf heading', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Leaf paragraph')).toBeInTheDocument()
    expect(screen.getByText('Visible item')).toBeInTheDocument()
    expect(screen.queryByText('Unexpected child')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden child')).not.toBeInTheDocument()
    expect(screen.queryByText('Another hidden child')).not.toBeInTheDocument()
  })
})
