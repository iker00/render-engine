import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NodePanelTab } from '../../dev-runtime/layout-canvas/node-panel-tabs'
import { NodePanelTabBar } from '../../dev-runtime/layout-canvas/node-panel-tab-bar'

const FOUR_TABS: NodePanelTab[] = [
  { key: 'props', label: 'Props' },
  { key: 'layout', label: 'Diseño' },
  { key: 'visibility', label: 'Visibilidad' },
  { key: 'queryStateFeedback', label: 'Queries' },
]

describe('NodePanelTabBar rendering', () => {
  it('renders a tablist with an accessible name and one tab per entry in order with its label', () => {
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="props" onSelectTab={vi.fn()} idPrefix="node-panel" />)

    const tablist = screen.getByRole('tablist', { name: 'Secciones del nodo' })
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Props', 'Diseño', 'Visibilidad', 'Queries'])
  })

  it('marks only the active tab as selected via aria-selected', () => {
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="visibility" onSelectTab={vi.fn()} idPrefix="node-panel" />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false'])
  })

  it('assigns id and aria-controls following the idPrefix-tab-key / idPrefix-panel-key pattern', () => {
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="props" onSelectTab={vi.fn()} idPrefix="node-panel" />)

    const propsTab = screen.getByRole('tab', { name: 'Props' })
    expect(propsTab).toHaveAttribute('id', 'node-panel-tab-props')
    expect(propsTab).toHaveAttribute('aria-controls', 'node-panel-panel-props')

    const layoutTab = screen.getByRole('tab', { name: 'Diseño' })
    expect(layoutTab).toHaveAttribute('id', 'node-panel-tab-layout')
    expect(layoutTab).toHaveAttribute('aria-controls', 'node-panel-panel-layout')
  })

  it('applies roving tabindex: only the active tab is a Tab stop', () => {
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="layout" onSelectTab={vi.fn()} idPrefix="node-panel" />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('tabIndex'))).toEqual(['-1', '0', '-1', '-1'])
  })

  it('applies a distinct underline/highlight class to the active tab only', () => {
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="visibility" onSelectTab={vi.fn()} idPrefix="node-panel" />)

    const tabs = screen.getAllByRole('tab')
    const activeClassName = tabs[2].className
    expect(activeClassName).toContain('border-b-2')
    expect(tabs[0].className).not.toBe(activeClassName)
    expect(tabs[1].className).not.toBe(activeClassName)
    expect(tabs[3].className).not.toBe(activeClassName)
  })

  it('renders correctly with a single tab, active', () => {
    render(
      <NodePanelTabBar
        tabs={[{ key: 'props', label: 'Props' }]}
        activeKey="props"
        onSelectTab={vi.fn()}
        idPrefix="node-panel"
      />,
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabIndex', '0')
  })
})

describe('NodePanelTabBar selection behavior', () => {
  it('calls onSelectTab with the key of a clicked, non-active tab', () => {
    const onSelectTab = vi.fn()
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="props" onSelectTab={onSelectTab} idPrefix="node-panel" />)

    fireEvent.click(screen.getByRole('tab', { name: 'Visibilidad' }))

    expect(onSelectTab).toHaveBeenCalledTimes(1)
    expect(onSelectTab).toHaveBeenCalledWith('visibility')
  })

  it('does not call onSelectTab when clicking the already-active tab', () => {
    const onSelectTab = vi.fn()
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="props" onSelectTab={onSelectTab} idPrefix="node-panel" />)

    fireEvent.click(screen.getByRole('tab', { name: 'Props' }))

    expect(onSelectTab).not.toHaveBeenCalled()
  })
})

describe('NodePanelTabBar keyboard navigation', () => {
  it('ArrowRight from an intermediate tab moves focus to the next tab and selects it', () => {
    const onSelectTab = vi.fn()
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="layout" onSelectTab={onSelectTab} idPrefix="node-panel" />)

    const tabs = screen.getAllByRole('tab')
    tabs[1].focus()
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tabs[2])
    expect(onSelectTab).toHaveBeenCalledTimes(1)
    expect(onSelectTab).toHaveBeenCalledWith('visibility')
  })

  it('ArrowLeft from an intermediate tab moves focus to the previous tab and selects it', () => {
    const onSelectTab = vi.fn()
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="visibility" onSelectTab={onSelectTab} idPrefix="node-panel" />)

    const tabs = screen.getAllByRole('tab')
    tabs[2].focus()
    fireEvent.keyDown(tabs[2], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(tabs[1])
    expect(onSelectTab).toHaveBeenCalledTimes(1)
    expect(onSelectTab).toHaveBeenCalledWith('layout')
  })

  it('ArrowRight from the last tab wraps focus and selection to the first tab', () => {
    const onSelectTab = vi.fn()
    render(
      <NodePanelTabBar tabs={FOUR_TABS} activeKey="queryStateFeedback" onSelectTab={onSelectTab} idPrefix="node-panel" />,
    )

    const tabs = screen.getAllByRole('tab')
    tabs[3].focus()
    fireEvent.keyDown(tabs[3], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tabs[0])
    expect(onSelectTab).toHaveBeenCalledTimes(1)
    expect(onSelectTab).toHaveBeenCalledWith('props')
  })

  it('ArrowLeft from the first tab wraps focus and selection to the last tab', () => {
    const onSelectTab = vi.fn()
    render(<NodePanelTabBar tabs={FOUR_TABS} activeKey="props" onSelectTab={onSelectTab} idPrefix="node-panel" />)

    const tabs = screen.getAllByRole('tab')
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(tabs[3])
    expect(onSelectTab).toHaveBeenCalledTimes(1)
    expect(onSelectTab).toHaveBeenCalledWith('queryStateFeedback')
  })
})
