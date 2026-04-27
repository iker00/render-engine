import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimePageConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'

const page: RuntimePageConfig = {
  id: 'home',
  layout: {
    type: 'container',
    props: {
      direction: 'column',
      gap: 'md',
    },
    children: [
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
  },
}

describe('RuntimePage', () => {
  it('renders a valid layout tree with container, heading, paragraph and list', () => {
    render(<RuntimePage page={page} />)

    expect(screen.getByRole('heading', { name: 'Welcome', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Build forms from configuration.')).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('Reusable layout nodes')).toBeInTheDocument()
    expect(screen.getByText('Static content')).toBeInTheDocument()
  })

  it('renders an empty container without inventing fallback content', () => {
    render(
      <RuntimePage
        page={{
          id: 'empty',
          layout: {
            type: 'container',
          },
        }}
      />,
    )

    const pageRoot = screen.getByTestId('runtime-page')
    expect(pageRoot.firstElementChild).not.toBeNull()
    expect(pageRoot).not.toHaveTextContent(/\S/)
  })

  it('renders an empty list without placeholder items', () => {
    render(
      <RuntimePage
        page={{
          id: 'empty-list',
          layout: {
            type: 'list',
            props: {
              items: [],
            },
          },
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
          layout: {
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
