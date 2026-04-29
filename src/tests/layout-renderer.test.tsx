import { fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../config/runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import {
  RuntimeStateProvider,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'

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

function RuntimeStateSeed({ children }: { children: ReactNode }) {
  const { initializeForm, initializeQuery, setFormFieldValue, setQueryError, setQuerySuccess } =
    useRuntimeStateActions()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
    setFormFieldValue('userSearch', 'name', 'Grace')
    initializeQuery('searchUsers')
    setQuerySuccess('searchUsers', {
      user: {
        profile: {
          name: 'Ada',
          active: true,
        },
      },
      results: [
        {
          id: 'user-1',
          name: 'Ada',
        },
        {
          id: 'user-2',
          name: 'Grace',
        },
      ],
      stats: {
        total: 2,
      },
    })
    setQueryError('searchUsers', {
      code: 'network',
      message: 'Could not load users.',
    })
    setIsReady(true)
  }, [initializeForm, initializeQuery, setFormFieldValue, setQueryError, setQuerySuccess])

  return isReady ? <>{children}</> : null
}

function renderRuntimePageWithSeed(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimeStateSeed>
        <RuntimePage />
      </RuntimeStateSeed>
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

  it('renders button nodes as accessible button elements with stable base classes', () => {
    renderRuntimePage({
      id: 'button-page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Open details',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Open details' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Open details' })).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'rounded-md',
      'bg-slate-200',
      'px-4',
      'py-2',
      'text-sm',
      'font-medium',
      'text-slate-950',
    )
  })

  it('treats button as a leaf node even when it receives children', () => {
    renderRuntimePage({
      id: 'button-leaf',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Back',
            action: {
              type: 'goBack',
            },
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
      ],
    })

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByText('Unexpected child')).not.toBeInTheDocument()
  })

  it('lets a rendered button navigate declaratively to another page', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'heading',
              props: {
                text: 'Details page',
                level: 1,
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByRole('heading', { name: 'Details page', level: 1 })).toBeInTheDocument()
  })

  it('renders current forms and queries references inside heading and paragraph text', () => {
    renderRuntimePageWithSeed({
      id: 'dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.status',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Grace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('renders nested query data values inside heading and paragraph text when they resolve to text-compatible scalars', () => {
    renderRuntimePageWithSeed({
      id: 'nested-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'queries.searchUsers.data.results.1.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.stats.total',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.user.profile.active',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Grace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('keeps static and partially interpolated text literal', () => {
    renderRuntimePageWithSeed({
      id: 'literal-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Welcome back',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'User: forms.userSearch.name',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Welcome back', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('User: forms.userSearch.name')).toBeInTheDocument()
  })

  it('degrades missing, unsupported and invalid references to an empty string in visible text nodes', () => {
    renderRuntimePageWithSeed({
      id: 'empty-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.email',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'navigation.currentPageId',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.foo',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
    expect(screen.getAllByText('', { selector: '[data-layout-node="paragraph"]' })).toHaveLength(2)
  })

  it('degrades unresolved or non-text nested query references to an empty string in visible text nodes', () => {
    renderRuntimePageWithSeed({
      id: 'nested-empty-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'queries.searchUsers.data.results.3.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.results',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.user',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
    expect(screen.getAllByText('', { selector: '[data-layout-node="paragraph"]' })).toHaveLength(2)
  })

  it('renders escaped references as visible literal text without the escape character', () => {
    renderRuntimePageWithSeed({
      id: 'escaped-literal',
      layout: [
        {
          type: 'heading',
          props: {
            text: '\\forms.userSearch.name',
            level: 3,
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'forms.userSearch.name', level: 3 })).toBeInTheDocument()
  })

  it('renders escaped nested query references as visible literal text without the escape character', () => {
    renderRuntimePageWithSeed({
      id: 'escaped-nested-literal',
      layout: [
        {
          type: 'heading',
          props: {
            text: '\\queries.searchUsers.data.results.0.name',
            level: 3,
          },
        },
      ],
    })

    expect(
      screen.getByRole('heading', { name: 'queries.searchUsers.data.results.0.name', level: 3 }),
    ).toBeInTheDocument()
  })

  it('reports unresolved visible references in development with the source path and surface name', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithSeed({
      id: 'diagnostics',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.email',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.results.3.name',
          },
        },
      ],
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "forms.userSearch.email" for heading.props.text (missing).',
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[runtime-references] Could not resolve "queries.searchUsers.data.results.3.name" for paragraph.props.text (missing).',
    )

    consoleWarnSpy.mockRestore()
  })
})
