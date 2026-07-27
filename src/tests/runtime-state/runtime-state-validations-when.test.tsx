import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateSnapshot } from './helpers'
import { useEffect } from 'react'
import { useRuntimeStateActions } from '../../runtime/runtime-state/runtime-state-provider'

function QuerySeedFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('flagQuery')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('flagQuery', {
            active: true,
          })
        }
      >
        Seed flag active
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('flagQuery', {
            active: false,
          })
        }
      >
        Seed flag inactive
      </button>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('Runtime validation when condition', () => {
  it('applies required rule when condition matches and skips it when condition does not match', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'toggle',
                    label: 'Toggle',
                    defaultValue: '',
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: '',
                    validations: {
                      required: {
                        value: true,
                        when: {
                          reference: 'forms.condForm.toggle',
                          operator: 'equals',
                          value: 'yes',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    // Toggle is empty (not 'yes'), so required should be skipped -> submit passes
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Required')).not.toBeInTheDocument()

    fetchMock.mockClear()

    // Set toggle to 'yes', now required applies
    fireEvent.change(screen.getByRole('textbox', { name: /Toggle/ }), { target: { value: 'yes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('applies minLength when isTruthy condition is met and skips it when falsy', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'check',
                    label: 'Check',
                    defaultValue: '',
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'code',
                    label: 'Code',
                    defaultValue: 'ab',
                    validations: {
                      minLength: {
                        value: 5,
                        when: {
                          reference: 'forms.condForm.check',
                          operator: 'isTruthy',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    // check is empty (falsy), minLength should be skipped -> submit passes even with short value
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Must be at least 5 characters.')).not.toBeInTheDocument()

    fetchMock.mockClear()

    // Set check to a truthy value, now minLength applies
    fireEvent.change(screen.getByRole('textbox', { name: /Check/ }), { target: { value: 'on' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at least 5 characters.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('applies pattern when equals condition is met and skips it when mode is not strict', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'mode',
                    label: 'Mode',
                    defaultValue: 'relaxed',
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'value',
                    label: 'Value',
                    defaultValue: 'abc',
                    validations: {
                      pattern: {
                        value: '^\\d+$',
                        when: {
                          reference: 'forms.condForm.mode',
                          operator: 'equals',
                          value: 'strict',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    // mode is 'relaxed', not 'strict' -> pattern skipped
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Invalid format.')).not.toBeInTheDocument()

    fetchMock.mockClear()

    // Set mode to 'strict', now pattern applies and 'abc' fails
    fireEvent.change(screen.getByRole('textbox', { name: /Mode/ }), { target: { value: 'strict' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid format.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes validation when all rules have when conditions that do not match', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'flag',
                    label: 'Flag',
                    defaultValue: '',
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'data',
                    label: 'Data',
                    defaultValue: '',
                    validations: {
                      required: {
                        value: true,
                        when: {
                          reference: 'forms.condForm.flag',
                          operator: 'equals',
                          value: 'active',
                        },
                      },
                      minLength: {
                        value: 10,
                        when: {
                          reference: 'forms.condForm.flag',
                          operator: 'equals',
                          value: 'active',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    // flag is empty, not 'active' -> all rules skipped -> submit passes with empty data
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('evaluates rule without when always and rule with when only when condition matches', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'level',
                    label: 'Level',
                    defaultValue: 'basic',
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'code',
                    label: 'Code',
                    defaultValue: '',
                    validations: {
                      required: { value: true },
                      pattern: {
                        value: '^\\d+$',
                        when: {
                          reference: 'forms.condForm.level',
                          operator: 'equals',
                          value: 'advanced',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    // code is empty -> required always applies -> fails
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()

    // Fill code with non-numeric, level is 'basic' -> required passes, pattern skipped
    fireEvent.change(screen.getByRole('textbox', { name: /Code/ }), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Invalid format.')).not.toBeInTheDocument()

    fetchMock.mockClear()

    // Now set level to 'advanced', pattern should apply
    fireEvent.change(screen.getByRole('textbox', { name: /Level/ }), { target: { value: 'advanced' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid format.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('always evaluates a rule without when (retrocompatibility)', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: '',
                    validations: {
                      required: { value: true },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
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

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument()
    })
  })

  it('respects when condition during reevaluation when the referenced field changes', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'trigger',
                    label: 'Trigger',
                    defaultValue: 'yes',
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'code',
                    label: 'Code',
                    defaultValue: 'ab',
                    validations: {
                      minLength: {
                        value: 5,
                        when: {
                          reference: 'forms.condForm.trigger',
                          operator: 'equals',
                          value: 'yes',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
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

    // trigger is 'yes', code is 'ab' (too short) -> submit should fail
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at least 5 characters.')).toBeInTheDocument()
    })

    // Change trigger to something else -> when condition no longer matches
    fireEvent.change(screen.getByRole('textbox', { name: /Trigger/ }), { target: { value: 'no' } })

    // Wait for the store to update and the component to re-render with the new state
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Trigger/ })).toHaveValue('no')
    })

    // Now edit code to a different short value to trigger reevaluation (field had error)
    fireEvent.change(screen.getByRole('textbox', { name: /Code/ }), { target: { value: 'ac' } })

    await waitFor(() => {
      expect(screen.queryByText('Must be at least 5 characters.')).not.toBeInTheDocument()
    })
  })

  it('evaluates when condition referencing queries state', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'code',
                    label: 'Code',
                    defaultValue: 'abc',
                    validations: {
                      pattern: {
                        value: '^\\d+$',
                        when: {
                          reference: 'queries.flagQuery.data.active',
                          operator: 'isTruthy',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <QuerySeedFixture />
      </RuntimeStateProvider>,
    )

    // Query not seeded yet (reference absent) -> isTruthy resolves to false -> pattern skipped
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Invalid format.')).not.toBeInTheDocument()

    fetchMock.mockClear()

    // Seed query with active: true
    fireEvent.click(screen.getByRole('button', { name: 'Seed flag active' }))

    // Now isTruthy matches -> pattern applies -> 'abc' fails
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid format.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('follows visibility semantics for absent reference: isFalsy true, isTruthy false, others no match', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'condForm',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'nameA',
                    label: 'Name A',
                    defaultValue: '',
                    validations: {
                      required: {
                        value: true,
                        when: {
                          reference: 'forms.condForm.nonExistent',
                          operator: 'isFalsy',
                        },
                      },
                    },
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'nameB',
                    label: 'Name B',
                    defaultValue: '',
                    validations: {
                      required: {
                        value: true,
                        when: {
                          reference: 'forms.condForm.nonExistent',
                          operator: 'isTruthy',
                        },
                      },
                    },
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'nameC',
                    label: 'Name C',
                    defaultValue: '',
                    validations: {
                      required: {
                        value: true,
                        when: {
                          reference: 'forms.condForm.nonExistent',
                          operator: 'equals',
                          value: 'something',
                        },
                      },
                    },
                  },
                },
                { type: 'button', props: { label: 'Submit' } },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      // nameA: isFalsy + absent -> condition matches -> required applies -> error
      expect(screen.getByRole('textbox', { name: /Name A/ })).toBeInTheDocument()
    })

    // nameA should have error (isFalsy -> true for absent -> required applies)
    expect(screen.getAllByText('Required')).toHaveLength(1)

    // nameB: isTruthy + absent -> condition does not match -> required skipped -> no error
    // nameC: equals + absent -> condition does not match -> required skipped -> no error
    // Only nameA should show the error, so fetch should not be called because nameA is blocking
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
