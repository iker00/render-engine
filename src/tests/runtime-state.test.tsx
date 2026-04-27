import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'

const runtimeConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
    {
      id: 'details',
      layout: [],
    },
  ],
}

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()

  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function ResetOnMount() {
  const { resetRuntimeState } = useRuntimeStateActions()

  useEffect(() => {
    resetRuntimeState()
  }, [resetRuntimeState])

  return <RuntimeStateSnapshot testId="state-after-reset" />
}

function NavigationControls() {
  const { navigateToPage } = useRuntimeStateActions()

  return (
    <>
      <button type="button" onClick={() => navigateToPage('details')}>
        Navigate to details
      </button>
      <button type="button" onClick={() => navigateToPage('missing-page')}>
        Navigate to missing page
      </button>
    </>
  )
}

function FormsFixture() {
  const { initializeForm, navigateToPage, resetForm, setFormFieldError, setFormFieldValue } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
    initializeForm('newsletter', {
      email: {
        defaultValue: 'news@example.com',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => setFormFieldValue('userSearch', 'name', 'Grace')}>
        Update user name
      </button>
      <button type="button" onClick={() => setFormFieldError('userSearch', 'name', 'Required')}>
        Set user name error
      </button>
      <button type="button" onClick={() => resetForm('userSearch')}>
        Reset user search form
      </button>
      <button type="button" onClick={() => navigateToPage('details')}>
        Go to details page
      </button>
    </>
  )
}

function QueriesFixture() {
  const { initializeQuery, navigateToPage, setQueryError, setQueryLoading, setQuerySuccess } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('searchUsers')
  }, [initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', ['Ada', 'Grace'])}>
        Store query success
      </button>
      <button type="button" onClick={() => setQueryLoading('searchUsers')}>
        Reload query
      </button>
      <button
        type="button"
        onClick={() =>
          setQueryError('searchUsers', {
            code: 'network',
            message: 'Could not load users.',
          })
        }
      >
        Store query error
      </button>
      <button type="button" onClick={() => navigateToPage('details')}>
        Go to details page from query fixture
      </button>
    </>
  )
}

function RuntimeInstanceFixture({ name, initialPage }: { name: string; initialPage: 'home' | 'details' }) {
  const { initializeForm, initializeQuery, navigateToPage, setFormFieldValue, setQuerySuccess } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: initialPage,
      },
    })
    initializeQuery('searchUsers')
  }, [initializeForm, initializeQuery, initialPage])

  return (
    <>
      <button type="button" onClick={() => navigateToPage(initialPage === 'home' ? 'details' : 'home')}>
        {name} navigate
      </button>
      <button type="button" onClick={() => setFormFieldValue('userSearch', 'name', `${name}-value`)}>
        {name} set form value
      </button>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', [`${name}-query`])}>
        {name} set query success
      </button>
      <RuntimeStateSnapshot testId={`${name}-state`} />
      <RuntimePage />
    </>
  )
}

describe('Runtime shared state store', () => {
  it('creates isolated state per provider instance', () => {
    const firstConfig = {
      ...runtimeConfig,
      initialPage: 'home',
    }
    const secondConfig = {
      ...runtimeConfig,
      initialPage: 'details',
    }

    render(
      <>
        <RuntimeStateProvider config={firstConfig}>
          <RuntimeStateSnapshot testId="first-state" />
        </RuntimeStateProvider>
        <RuntimeStateProvider config={secondConfig}>
          <RuntimeStateSnapshot testId="second-state" />
        </RuntimeStateProvider>
      </>,
    )

    expect(screen.getByTestId('first-state')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"history":["home"]')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"history":["details"]')
  })

  it('initializes navigation, forms and queries in the base state', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"navigation":{"currentPageId":"home","history":["home"],"lastError":null}',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"forms":{}')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"queries":{}')
  })

  it('seeds navigation from initialPage with the minimal history shape', () => {
    render(
      <RuntimeStateProvider
        config={{
          ...runtimeConfig,
          initialPage: 'details',
        }}
      >
        <RuntimeStateSnapshot testId="navigation-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('navigation-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('navigation-state')).toHaveTextContent('"history":["details"]')
    expect(screen.getByTestId('navigation-state')).toHaveTextContent('"lastError":null')
  })

  it('resets the full runtime state back to the initial instance snapshot', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ResetOnMount />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"history":["home"]')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"forms":{}')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"queries":{}')
  })

  it('renders the visible page from navigation.currentPageId and changes it without touching the URL', () => {
    const initialPathname = window.location.pathname

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(window.location.pathname).toBe(initialPathname)
  })

  it('keeps the previous page and stores a recoverable navigation error when the target page does not exist', () => {

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to missing page' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"lastError":{"code":"page-not-found","message":"The runtime page \\"missing-page\\" does not exist.","pageId":"missing-page"}',
    )
  })

  it('stores forms by formId and fieldId with default values in the shared state', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"forms":{"userSearch":{"name":{')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"value":"Ada","error":null,"touched":false,"dirty":false,"defaultValue":"Ada"',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"newsletter":{"email":{"value":"news@example.com","error":null,"touched":false,"dirty":false,"defaultValue":"news@example.com"}}',
    )
  })

  it('updates a form field value consistently and keeps the base field shape', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set user name error' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"forms":{"userSearch":{"name":{"value":"Grace","error":"Required","touched":true,"dirty":true,"defaultValue":"Ada"}}',
    )
  })

  it('resets one form to its initial effective state without affecting other forms', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set user name error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset user search form' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"userSearch":{"name":{"value":"Ada","error":null,"touched":false,"dirty":false,"defaultValue":"Ada"}}',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"newsletter":{"email":{"value":"news@example.com","error":null,"touched":false,"dirty":false,"defaultValue":"news@example.com"}}',
    )
  })

  it('keeps form state across page changes inside the same runtime instance', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"userSearch":{"name":{"value":"Grace","error":null,"touched":true,"dirty":true,"defaultValue":"Ada"}}',
    )
  })

  it('stores queries by shared name with the base status, data and error shape', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"idle","data":null,"error":null}}',
    )
  })

  it('keeps the last successful query data while the same query reloads', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reload query' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"loading","data":["Ada","Grace"],"error":null}}',
    )
  })

  it('stores recoverable query errors with a stable UI-oriented shape without breaking the runtime', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query error' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"error","data":null,"error":{"code":"network","message":"Could not load users."}}}',
    )
  })

  it('keeps query state across page changes inside the same runtime instance', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page from query fixture' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"success","data":["Ada","Grace"],"error":null}}',
    )
  })

  it('keeps navigation, forms and queries isolated across multiple runtime instances', () => {
    render(
      <>
        <RuntimeStateProvider config={runtimeConfig}>
          <RuntimeInstanceFixture name="first" initialPage="home" />
        </RuntimeStateProvider>
        <RuntimeStateProvider
          config={{
            ...runtimeConfig,
            initialPage: 'details',
          }}
        >
          <RuntimeInstanceFixture name="second" initialPage="details" />
        </RuntimeStateProvider>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'first navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'first set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'first set query success' }))

    expect(screen.getByTestId('first-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"value":"first-value"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"data":["first-query"]')

    expect(screen.getByTestId('second-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"value":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })

  it('creates a clean shared state when the runtime unmounts and mounts again', () => {
    const { unmount } = render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single" initialPage="home" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'single navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set query success' }))

    expect(screen.getByTestId('single-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('single-state')).toHaveTextContent('"value":"single-value"')
    expect(screen.getByTestId('single-state')).toHaveTextContent('"data":["single-query"]')

    unmount()

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single-remount" initialPage="home" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"value":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })
})
