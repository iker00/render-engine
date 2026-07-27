import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  LayoutNode,
  RuntimeConfig,
  RuntimePageConfig,
  RuntimeResponsiveLayoutValue,
} from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
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

// T1 (feature 0105): the Editor's LayoutRenderer injects drop-zone gaps into every children
// collection it iterates. These tests confirm that, for a `container` in grid mode
// (`props.columns` set), the real children keep the exact visual order and Tailwind span
// classes they have in Visual mode/production — the drop-zone gaps must never behave as extra
// grid items that shift columns.
describe('container columns grid (modo Editor)', () => {
  function buildConfig(nodes: LayoutNode[]): RuntimeConfig {
    return {
      api: {},
      initialPage: 'home',
      pages: [{ id: 'home', layout: nodes }],
    }
  }

  function renderVisual(nodes: LayoutNode[]) {
    return render(
      <RuntimeStateProvider config={buildConfig(nodes)}>
        <LayoutRenderer nodes={nodes} />
      </RuntimeStateProvider>,
    )
  }

  function renderEditor(nodes: LayoutNode[], active = true) {
    return render(
      <RuntimeStateProvider config={buildConfig(nodes)}>
        <LayoutEditModeProvider
          value={
            active
              ? { active: true, selectedPath: null, hoveredPath: null, onSelectNode: vi.fn(), onHoverNode: vi.fn() }
              : { active: false }
          }
        >
          <LayoutRenderer nodes={nodes} />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )
  }

  // Direct children of the container's <section>, excluding drop-zone gaps and the T2 grid
  // drop-zones overlay (feature 0106), in DOM order.
  function getRealChildTexts(container: HTMLElement) {
    const section = container.querySelector('[data-layout-node="container"]') as HTMLElement
    return Array.from(section.children)
      .filter((el) => !el.hasAttribute('data-drop-zone') && !el.hasAttribute('data-canvas-grid-drop-zones'))
      .map((el) => el.textContent)
  }

  const heterogeneousChildren: LayoutNode[] = [
    { type: 'heading', props: { text: 'Grid Heading One', level: 2 } },
    { type: 'paragraph', props: { text: 'Grid Paragraph' } },
    { type: 'divider' },
    { type: 'paragraph', props: { text: 'Spanning Paragraph' }, layout: { span: 2 } },
    { type: 'heading', props: { text: 'Grid Heading Two', level: 3 } },
  ]

  function buildGridContainer(columns: RuntimeResponsiveLayoutValue): LayoutNode {
    return { type: 'container', props: { columns }, children: heterogeneousChildren }
  }

  it('keeps the same real-child order and span classes between Editor mode and Visual mode for a fixed columns:3 container', () => {
    const nodes: LayoutNode[] = [buildGridContainer(3)]

    const { container: visualContainer } = renderVisual(nodes)
    const { container: editorContainer } = renderEditor(nodes)

    const visualTexts = getRealChildTexts(visualContainer)
    const editorTexts = getRealChildTexts(editorContainer)

    expect(visualTexts).toEqual([
      'Grid Heading One',
      'Grid Paragraph',
      '',
      'Spanning Paragraph',
      'Grid Heading Two',
    ])
    expect(editorTexts).toEqual(visualTexts)

    const visualSpanHolders = visualContainer.querySelectorAll('.col-span-2')
    const editorSpanHolders = editorContainer.querySelectorAll('.col-span-2')

    expect(visualSpanHolders).toHaveLength(1)
    expect(editorSpanHolders).toHaveLength(1)
    expect(visualSpanHolders[0].textContent).toBe('Spanning Paragraph')
    expect(editorSpanHolders[0].textContent).toBe('Spanning Paragraph')
  })

  it('preserves the same real-child visual order for a responsive columns map (base/md) in Editor mode', () => {
    const nodes: LayoutNode[] = [buildGridContainer({ base: 1, md: 3 })]

    const { container: visualContainer } = renderVisual(nodes)
    const { container: editorContainer } = renderEditor(nodes)

    expect(getRealChildTexts(editorContainer)).toEqual(getRealChildTexts(visualContainer))
  })

  it('does not add any visual trace (no drop-zone, no structural change) when the provider is mounted but inactive ({ active: false })', () => {
    const nodes: LayoutNode[] = [buildGridContainer(3)]

    const { container: visualContainer } = renderVisual(nodes)
    const { container: inertContainer } = renderEditor(nodes, false)

    expect(inertContainer.querySelectorAll('[data-drop-zone]')).toHaveLength(0)
    expect(getRealChildTexts(inertContainer)).toEqual(getRealChildTexts(visualContainer))
  })

  it('preserves order for a single child already present in a grid container (edge case: 1 child)', () => {
    const singleChildNode: LayoutNode = {
      type: 'container',
      props: { columns: 2 },
      children: [{ type: 'paragraph', props: { text: 'Only child' } }],
    }
    const nodes: LayoutNode[] = [singleChildNode]

    const { container: visualContainer } = renderVisual(nodes)
    const { container: editorContainer } = renderEditor(nodes)

    expect(getRealChildTexts(editorContainer)).toEqual(getRealChildTexts(visualContainer))
    expect(getRealChildTexts(editorContainer)).toEqual(['Only child'])
  })

  // T2 (feature 0106): the grid-drop-zones overlay is absolutely positioned inside the
  // container's `<section>`, so the `<section>` needs `position: relative` in Editor mode
  // to become the overlay's containing block. Adding `relative` unconditionally would break
  // the byte-identical guarantee in Visual/production; the class must appear only when the
  // provider is active AND the container is in grid mode (has `props.columns`).
  it('adds the `relative` class to the container <section> in Editor mode when in grid mode', () => {
    const nodes: LayoutNode[] = [
      {
        type: 'container',
        props: { columns: 3 },
        children: [{ type: 'paragraph', props: { text: 'Grid Editor child' } }],
      },
    ]

    const { container } = renderEditor(nodes)
    const section = container.querySelector('[data-layout-node="container"]')

    expect(section).toHaveClass('relative')
  })

  it('does not add the `relative` class in Visual mode/production for the same grid container', () => {
    const nodes: LayoutNode[] = [
      {
        type: 'container',
        props: { columns: 3 },
        children: [{ type: 'paragraph', props: { text: 'Grid Visual child' } }],
      },
    ]

    const { container } = renderVisual(nodes)
    const section = container.querySelector('[data-layout-node="container"]')

    expect(section).not.toHaveClass('relative')
  })

  it('does not add the `relative` class when the provider is mounted but inactive ({ active: false })', () => {
    const nodes: LayoutNode[] = [
      {
        type: 'container',
        props: { columns: 3 },
        children: [{ type: 'paragraph', props: { text: 'Grid inactive child' } }],
      },
    ]

    const { container } = renderEditor(nodes, false)
    const section = container.querySelector('[data-layout-node="container"]')

    expect(section).not.toHaveClass('relative')
  })

  it('does not add the `relative` class in Editor mode when the container is not in grid mode', () => {
    const nodes: LayoutNode[] = [
      {
        type: 'container',
        props: { direction: 'row' },
        children: [{ type: 'paragraph', props: { text: 'Row child' } }],
      },
    ]

    const { container } = renderEditor(nodes)
    const section = container.querySelector('[data-layout-node="container"]')

    expect(section).not.toHaveClass('relative')
  })
})
