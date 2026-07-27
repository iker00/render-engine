import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeCurrentPage, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  document.title = ''
})

beforeEach(() => {
  document.title = 'Mi App'
})

const configWithTitles: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
    {
      id: 'inicio',
      title: 'Inicio',
      layout: [],
    },
    {
      id: 'alta',
      title: 'Alta de usuario',
      layout: [],
    },
    {
      id: 'empty-title',
      title: '',
      layout: [],
    },
  ],
}

function NavigationControls() {
  const { navigateToPage } = useRuntimeStateActions()

  return (
    <>
      <button type="button" onClick={() => navigateToPage('home')}>
        Navigate to home
      </button>
      <button type="button" onClick={() => navigateToPage('inicio')}>
        Navigate to inicio
      </button>
      <button type="button" onClick={() => navigateToPage('alta')}>
        Navigate to alta
      </button>
      <button type="button" onClick={() => navigateToPage('empty-title')}>
        Navigate to empty-title
      </button>
    </>
  )
}

describe('Runtime document title effect', () => {
  it('leaves document.title unchanged when the initial page has no title', async () => {
    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(document.title).toBe('Mi App'))
  })

  it('sets document.title on mount when the initial page declares a title', async () => {
    const config: RuntimeConfig = {
      ...configWithTitles,
      initialPage: 'inicio',
    }

    render(
      <RuntimeStateProvider config={config}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(document.title).toBe('Inicio | Mi App'))
  })

  it('updates document.title when navigating from one titled page to another', async () => {
    const config: RuntimeConfig = {
      ...configWithTitles,
      initialPage: 'inicio',
    }

    render(
      <RuntimeStateProvider config={config}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(document.title).toBe('Inicio | Mi App'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))

    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))
  })

  it('restores document.title to the initial value when navigating to a page without title', async () => {
    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))
    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    await waitFor(() => expect(document.title).toBe('Mi App'))
  })

  it('restores document.title to the initial value when navigating to a page with empty title', async () => {
    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))
    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to empty-title' }))
    await waitFor(() => expect(document.title).toBe('Mi App'))
  })

  it('captures the initial title once and uses it after the document title has been overwritten', async () => {
    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    // Navigate to a titled page — document.title is now overwritten
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))
    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))

    // Navigate back to a page without title — should restore to original "Mi App", not "Alta de usuario | Mi App"
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    await waitFor(() => expect(document.title).toBe('Mi App'))
  })

  it('ignores external modifications to document.title when composing the format on next navigation', async () => {
    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    // Externally overwrite document.title after mount
    document.title = 'Externally Modified'

    // Navigate to a titled page — should still use original "Mi App" as the initial title
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to inicio' }))
    await waitFor(() => expect(document.title).toBe('Inicio | Mi App'))
  })

  it('produces the correct format when document.title is empty on mount', async () => {
    document.title = ''

    const config: RuntimeConfig = {
      ...configWithTitles,
      initialPage: 'alta',
    }

    render(
      <RuntimeStateProvider config={config}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    // jsdom strips trailing whitespace from document.title, so the trailing space after | is trimmed
    await waitFor(() => expect(document.title).toBe('Alta de usuario |'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    await waitFor(() => expect(document.title).toBe(''))
  })

  it('maintains correct document.title across multiple transitions between pages with and without title', async () => {
    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
      </RuntimeStateProvider>,
    )

    // home (no title) → alta (title) → inicio (title) → home (no title)
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))
    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to inicio' }))
    await waitFor(() => expect(document.title).toBe('Inicio | Mi App'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    await waitFor(() => expect(document.title).toBe('Mi App'))

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))
    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))
  })

  it('does not trigger additional renders in children when the document title effect runs', async () => {
    let renderCount = 0

    // Uses context so it re-renders on navigation state changes — allows detecting extra renders from the title effect.
    // Counted via React's own <Profiler onRender> (called by React once per commit, outside the
    // render phase) instead of mutating a ref/outer variable inside the component body, which the
    // React Compiler rejects as a render side effect.
    function RenderCounterWithContext() {
      useRuntimeCurrentPage()

      return <span data-testid="render-counter" />
    }

    render(
      <RuntimeStateProvider config={configWithTitles}>
        <NavigationControls />
        <Profiler id="render-counter" onRender={() => { renderCount += 1 }}>
          <RenderCounterWithContext />
        </Profiler>
      </RuntimeStateProvider>,
    )

    const countAfterMount = renderCount

    // First navigation: home (no title) → inicio (titled)
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to inicio' }))
    await waitFor(() => expect(document.title).toBe('Inicio | Mi App'))
    const rendersForFirstNavigation = renderCount - countAfterMount

    // Reset counter baseline
    const countAfterFirst = renderCount

    // Second navigation: inicio → alta (both titled, same kind of transition)
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to alta' }))
    await waitFor(() => expect(document.title).toBe('Alta de usuario | Mi App'))
    const rendersForSecondNavigation = renderCount - countAfterFirst

    // Both navigations should cause the same number of renders.
    // If the title effect introduced extra state updates, the count would differ.
    expect(rendersForSecondNavigation).toBe(rendersForFirstNavigation)
  })
})
