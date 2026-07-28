import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimePage } from '../../runtime/runtime-page'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()

  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

function FormVisibilityFixture() {
  const { initializeForm, setFormFieldValue } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm('visibilityControl', {
      mode: {
        defaultValue: 'show',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => setFormFieldValue('visibilityControl', 'mode', 'hide')}>
        Hide profile form
      </button>
      <button type="button" onClick={() => setFormFieldValue('visibilityControl', 'mode', 'show')}>
        Show profile form
      </button>
    </>
  )
}

function QueryDrivenFormLifecycleFixture() {
  const { initializeQuery, navigateToPage, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('selectedUser')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Countess',
            },
          })
        }
      >
        Seed Countess
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Architect',
            },
          })
        }
      >
        Seed Architect
      </button>
      <button type="button" onClick={() => navigateToPage('editor')}>
        Open editor
      </button>
      <button type="button" onClick={() => navigateToPage('home')}>
        Leave editor
      </button>
    </>
  )
}

describe('Runtime shared state store', () => {
  it('cleans declarative form state on unmount and reinitializes defaults on the next mount by default', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'textarea',
                  props: {
                    fieldId: 'bio',
                    label: 'Bio',
                    defaultValue: 'Builder',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go to details',
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
              type: 'button',
              props: {
                label: 'Go home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Bio')).toHaveValue('Builder')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Ada"')
  })

  it('preserves declarative form values across unmount and remount when persistOnUnmount is enabled', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              persistOnUnmount: true,
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go to details',
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
              type: 'button',
              props: {
                label: 'Go home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(screen.getByLabelText('Name')).toHaveValue('Grace')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Grace"')
  })

  it('invalidates default-persistence form state when the active page entry changes within the same page', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'params.userId',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Stay on Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByLabelText('Name')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Ada' } })
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Manual Ada')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Grace')
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry.params).toEqual({ userId: 'Grace' })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Stay on Grace' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Manual Grace')
    expect(readRuntimeStateSnapshot('runtime-state').navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'home', params: { userId: 'Ada' } },
      { entryId: 2, pageId: 'home', params: { userId: 'Grace' } },
    ])
  })

  it('keeps same-page form values across page-entry changes when persistOnUnmount is enabled', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              persistOnUnmount: true,
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'params.userId',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pinned value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(readRuntimeStateSnapshot('runtime-state').pageEntry.params).toEqual({ userId: 'Ada' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Pinned value')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Pinned value'))
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Pinned value')
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry.params).toEqual({ userId: 'Grace' })
  })

  it('reinitializes a reused form node when navigation activates a different page entry', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Home profile',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go to details',
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
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Details profile',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual home value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    expect(screen.getByLabelText('Name')).toHaveValue('Details profile')
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Details profile')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual details value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(screen.getByLabelText('Name')).toHaveValue('Home profile')
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Home profile')
  })

  it('keeps form state when the form is hidden and shown again within the same page', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              visibility: {
                reference: 'forms.visibilityControl.mode',
                operator: 'equals',
                value: 'show',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FormVisibilityFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hide profile form' }))

    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Grace"')

    fireEvent.click(screen.getByRole('button', { name: 'Show profile form' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Grace')
  })

  it('keeps query-driven defaults stable while mounted and rebuilds them from the latest query data after remount', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [],
        },
        {
          id: 'editor',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'nickname',
                    label: 'Nickname',
                    defaultValue: 'queries.selectedUser.data.profile.nickname',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <QueryDrivenFormLifecycleFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed Countess' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    await waitFor(() => expect(screen.getByLabelText('Nickname')).toHaveValue('Countess'))

    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Manual nickname' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seed Architect' }))

    expect(screen.getByLabelText('Nickname')).toHaveValue('Manual nickname')

    fireEvent.click(screen.getByRole('button', { name: 'Leave editor' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    await waitFor(() => expect(screen.getByLabelText('Nickname')).toHaveValue('Architect'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"nickname":{"value":"Architect"')
  })
})
