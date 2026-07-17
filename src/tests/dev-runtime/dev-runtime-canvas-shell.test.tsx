import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { LayoutCanvas } from '../../dev-runtime/layout-canvas/layout-canvas'

function buildTwoPageConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      { id: 'home', layout: [{ type: 'heading', props: { text: 'Home Heading', level: 1 } }] },
      { id: 'about', layout: [{ type: 'heading', props: { text: 'About Heading', level: 1 } }] },
    ],
  }
}

describe('LayoutCanvas page selector', () => {
  it('shows a selector with the id of every page in config.pages', () => {
    render(
      <LayoutCanvas config={buildTwoPageConfig()} activePageId="home" onActivePageIdChange={() => {}} />,
    )

    const select = screen.getByTestId('layout-canvas-page-select') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((option) => option.value)

    expect(optionValues).toEqual(['home', 'about'])
  })

  it('invokes onActivePageIdChange with the selected page id when the selector changes', () => {
    const onActivePageIdChange = vi.fn()
    render(
      <LayoutCanvas
        config={buildTwoPageConfig()}
        activePageId="home"
        onActivePageIdChange={onActivePageIdChange}
      />,
    )

    fireEvent.change(screen.getByTestId('layout-canvas-page-select'), { target: { value: 'about' } })

    expect(onActivePageIdChange).toHaveBeenCalledWith('about')
  })
})

describe('LayoutCanvas rendering the active page', () => {
  it('renders the layout of activePageId only, not another page', () => {
    const { rerender } = render(
      <LayoutCanvas config={buildTwoPageConfig()} activePageId="home" onActivePageIdChange={() => {}} />,
    )

    expect(screen.getByText('Home Heading')).toBeInTheDocument()
    expect(screen.queryByText('About Heading')).not.toBeInTheDocument()

    rerender(
      <LayoutCanvas config={buildTwoPageConfig()} activePageId="about" onActivePageIdChange={() => {}} />,
    )

    expect(screen.getByText('About Heading')).toBeInTheDocument()
    expect(screen.queryByText('Home Heading')).not.toBeInTheDocument()
  })
})

describe('LayoutCanvas selection', () => {
  it('applies the selection class to a clicked node', () => {
    const { container } = render(
      <LayoutCanvas config={buildTwoPageConfig()} activePageId="home" onActivePageIdChange={() => {}} />,
    )

    fireEvent.click(screen.getByText('Home Heading'))

    const wrapper = container.querySelector('[data-node-path="children.0"]')
    expect(wrapper?.className).toContain('outline-blue-500')
  })

  it('clears the selection when activePageId changes', () => {
    const config = buildTwoPageConfig()
    const { container, rerender } = render(
      <LayoutCanvas config={config} activePageId="home" onActivePageIdChange={() => {}} />,
    )

    fireEvent.click(screen.getByText('Home Heading'))
    expect(container.querySelector('[data-node-path="children.0"]')?.className).toContain('outline-blue-500')

    rerender(<LayoutCanvas config={config} activePageId="about" onActivePageIdChange={() => {}} />)

    expect(container.querySelectorAll('.outline-blue-500')).toHaveLength(0)
  })

  it('preserves the selection when config changes but the selected node still resolves at the same path', () => {
    const config = buildTwoPageConfig()
    const { container, rerender } = render(
      <LayoutCanvas config={config} activePageId="home" onActivePageIdChange={() => {}} />,
    )

    fireEvent.click(screen.getByText('Home Heading'))
    expect(container.querySelector('[data-node-path="children.0"]')?.className).toContain('outline-blue-500')

    // New config reference, but the "home" page still has a node at children.0 —
    // only unrelated content (the "about" page heading text) changed.
    const nextConfig: RuntimeConfig = {
      ...config,
      pages: config.pages.map((page) =>
        page.id === 'about'
          ? { ...page, layout: [{ type: 'heading', props: { text: 'About Heading Updated', level: 1 } }] }
          : page,
      ),
    }

    rerender(<LayoutCanvas config={nextConfig} activePageId="home" onActivePageIdChange={() => {}} />)

    expect(container.querySelector('[data-node-path="children.0"]')?.className).toContain('outline-blue-500')
  })

  it('clears the selection without throwing when config changes so the selected node no longer exists', () => {
    const config = buildTwoPageConfig()
    const { container, rerender } = render(
      <LayoutCanvas config={config} activePageId="home" onActivePageIdChange={() => {}} />,
    )

    fireEvent.click(screen.getByText('Home Heading'))
    expect(container.querySelector('[data-node-path="children.0"]')?.className).toContain('outline-blue-500')

    const nextConfig: RuntimeConfig = {
      ...config,
      pages: config.pages.map((page) => (page.id === 'home' ? { ...page, layout: [] } : page)),
    }

    expect(() => {
      rerender(<LayoutCanvas config={nextConfig} activePageId="home" onActivePageIdChange={() => {}} />)
    }).not.toThrow()

    expect(container.querySelectorAll('.outline-blue-500')).toHaveLength(0)
  })
})
