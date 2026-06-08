import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconNode } from '../../runtime/nodes/icon-node'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IconNode — render with valid icon names', () => {
  it('renders an <svg> with aria-hidden="true" when name is "Search"', () => {
    const { container } = render(<IconNode name="Search" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders an <svg> with aria-hidden="true" when name is "User"', () => {
    const { container } = render(<IconNode name="User" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders different <svg> elements for "Search" and "User" (dynamic resolution, not aliasing)', () => {
    const { container: c1 } = render(<IconNode name="Search" />)
    const { container: c2 } = render(<IconNode name="User" />)
    const svg1 = c1.querySelector('svg')
    const svg2 = c2.querySelector('svg')
    expect(svg1).toBeInTheDocument()
    expect(svg2).toBeInTheDocument()
    // The SVG path content differs between icons, confirming distinct resolution
    expect(svg1!.innerHTML).not.toBe(svg2!.innerHTML)
  })

  it('applies className to the rendered <svg>', () => {
    const { container } = render(<IconNode name="Search" className="size-4 text-blue-500" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('size-4')
    expect(svg).toHaveClass('text-blue-500')
  })
})

describe('IconNode — kebab-case names', () => {
  it('resolves kebab-case name to the same icon as PascalCase', () => {
    const { container: c1 } = render(<IconNode name="arrow-right" />)
    const { container: c2 } = render(<IconNode name="ArrowRight" />)
    expect(c1.querySelector('svg')).toBeInTheDocument()
    expect(c1.querySelector('svg')!.innerHTML).toBe(c2.querySelector('svg')!.innerHTML)
  })

  it('resolves lowercase single-word name to the same icon as PascalCase', () => {
    const { container: c1 } = render(<IconNode name="bell" />)
    const { container: c2 } = render(<IconNode name="Bell" />)
    expect(c1.querySelector('svg')).toBeInTheDocument()
    expect(c1.querySelector('svg')!.innerHTML).toBe(c2.querySelector('svg')!.innerHTML)
  })

  it('renders nothing silently for an unknown kebab-case name', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    const consoleWarnSpy = vi.spyOn(console, 'warn')
    const { container } = render(<IconNode name="non-existent-icon-xyz" />)
    expect(container.firstChild).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})

describe('IconNode — degradation silenciosa', () => {
  it('renders nothing when name is an unknown icon name', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    const consoleWarnSpy = vi.spyOn(console, 'warn')
    const { container } = render(<IconNode name="NonExistentIconXyz" />)
    expect(container.firstChild).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('renders nothing when name is an empty string', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    const consoleWarnSpy = vi.spyOn(console, 'warn')
    const { container } = render(<IconNode name="" />)
    expect(container.firstChild).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('renders nothing when name is undefined', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    const consoleWarnSpy = vi.spyOn(console, 'warn')
    const { container } = render(<IconNode name={undefined} />)
    expect(container.firstChild).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})
