import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LazyNode } from '../../runtime/lazy-node'

type ControlledPromise = {
  promise: Promise<{ default: React.ComponentType }>
  resolve: (mod: { default: React.ComponentType }) => void
  reject: (err: Error) => void
}

function createControlledPromise(): ControlledPromise {
  let resolve!: (mod: { default: React.ComponentType }) => void
  let reject!: (err: Error) => void
  const promise = new Promise<{ default: React.ComponentType }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('LazyNode wrapper', () => {
  it('renders a synchronous child immediately without Suspense fallback', () => {
    render(
      <LazyNode>
        <span>ok</span>
      </LazyNode>,
    )
    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders null while a lazy component is still loading (promise pending)', () => {
    const controlled = createControlledPromise()
    const Lazy = React.lazy(() => controlled.promise)

    const { container } = render(
      <LazyNode>
        <Lazy />
      </LazyNode>,
    )

    // Suspense fallback is null — container should be empty
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders lazy child content after the promise resolves', async () => {
    const controlled = createControlledPromise()
    const Lazy = React.lazy(() => controlled.promise)

    render(
      <LazyNode>
        <Lazy />
      </LazyNode>,
    )

    expect(screen.queryByText('loaded content')).not.toBeInTheDocument()

    await act(async () => {
      controlled.resolve({ default: () => <span>loaded content</span> })
    })

    expect(screen.getByText('loaded content')).toBeInTheDocument()
  })

  it('renders error indicator when lazy component promise rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const controlled = createControlledPromise()
    const Lazy = React.lazy(() => controlled.promise)

    render(
      <LazyNode>
        <Lazy />
      </LazyNode>,
    )

    await act(async () => {
      controlled.reject(new Error('chunk load failed'))
    })

    consoleSpy.mockRestore()

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Error al cargar componente')
    expect(alert.className).toContain('text-app-danger')
  })

  it('error in one LazyNode sibling does not affect the other sibling', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const controlled = createControlledPromise()
    const FailingLazy = React.lazy(() => controlled.promise)

    render(
      <>
        <LazyNode>
          <FailingLazy />
        </LazyNode>
        <LazyNode>
          <span>healthy sibling</span>
        </LazyNode>
      </>,
    )

    await act(async () => {
      controlled.reject(new Error('chunk load failed'))
    })

    consoleSpy.mockRestore()

    // Error indicator only in the failed position
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Error al cargar componente')

    // Sibling remains visible
    expect(screen.getByText('healthy sibling')).toBeInTheDocument()
  })

  it('re-render after error does not throw from outside the boundary', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const controlled = createControlledPromise()
    const FailingLazy = React.lazy(() => controlled.promise)

    const { rerender } = render(
      <LazyNode>
        <FailingLazy />
      </LazyNode>,
    )

    await act(async () => {
      controlled.reject(new Error('chunk load failed'))
    })

    consoleSpy.mockRestore()

    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Re-render should not throw from outside the error boundary
    expect(() => {
      rerender(
        <LazyNode>
          <FailingLazy />
        </LazyNode>,
      )
    }).not.toThrow()

    // Error indicator remains
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
