import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import type { LayoutEditModeContextValue } from '../../runtime/layout-edit-mode-context-value'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import type { LayoutNodePath } from '../../runtime/layout-node-path'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePage(
  activePage: RuntimePageConfig,
  api: RuntimeConfig['api'] = {},
  dataValues?: Record<string, unknown>,
) {
  const config: RuntimeConfig = {
    api,
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config} dataValues={dataValues}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: state,
          state,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => state,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: baseState.navigation.currentPageId,
      params: baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

const countryItems = [
  { label: 'Spain', value: 'ES' },
  { label: 'France', value: 'FR' },
  { label: 'Germany', value: 'DE' },
]

function buildPage(props: Record<string, unknown>): RuntimePageConfig {
  return {
    id: 'p',
    layout: [
      {
        type: 'form',
        id: 'f',
        children: [
          {
            type: 'autocomplete',
            props: { fieldId: 'country', label: 'Country', items: countryItems, ...props },
          },
        ],
      },
    ],
  }
}

describe('autocomplete layout node', () => {
  it('shows no suggestions below minChars and filters case-insensitively once minChars is met', () => {
    renderRuntimePage(buildPage({ minChars: 2 }))

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 's' } })

    expect(screen.queryByRole('option')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'sp' } })

    expect(screen.getByRole('option', { name: 'Spain' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'France' })).not.toBeInTheDocument()
  })

  it('selects a suggestion on click, fixing the value and closing the list', () => {
    renderRuntimePage(buildPage({}))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    const option = screen.getByRole('option', { name: 'Spain' })
    fireEvent.click(option)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input.value).toBe('Spain')
  })

  it('renders the suggestion list with a bordered panel and visual separation between options', () => {
    renderRuntimePage(buildPage({}))

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'a' } })

    const listbox = screen.getByRole('listbox')
    expect(listbox.className).toContain('border')
    expect(listbox.className).toMatch(/divide-y|border-b/)

    for (const option of screen.getAllByRole('option')) {
      expect(option.className.trim()).not.toBe('')
    }
  })

  it('clears the field on blur when the typed text does not match any option', () => {
    renderRuntimePage(buildPage({}))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.blur(input)

    expect(input.value).toBe('')
  })

  it('fixes the value on blur when the typed text matches a label exactly', () => {
    renderRuntimePage(buildPage({}))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Spain' } })
    fireEvent.blur(input)

    expect(input.value).toBe('Spain')
  })

  it('fixes the value on blur when the typed text matches a value exactly', () => {
    renderRuntimePage(buildPage({}))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ES' } })
    fireEvent.blur(input)

    expect(input.value).toBe('Spain')
  })

  describe('selecting a value and then clearing the input (single, allowFreeText:false)', () => {
    it('keeps the input empty instead of snapping back to the previously selected label while typing', () => {
      renderRuntimePage(buildPage({}))

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })
      fireEvent.click(screen.getByRole('option', { name: 'Spain' }))
      expect(input.value).toBe('Spain')

      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: '' } })

      expect(input.value).toBe('')
    })

    it('clears the stored value on blur, instead of restoring the previously selected value', () => {
      renderRuntimePage(buildPage({}))

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })
      fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.blur(input)

      expect(input.value).toBe('')
    })

    it('does not clear the value on a bare focus+blur with no edit in between', () => {
      renderRuntimePage(buildPage({}))

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })
      fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

      fireEvent.focus(input)
      fireEvent.blur(input)

      expect(input.value).toBe('Spain')
    })
  })

  describe('keyboard navigation', () => {
    it('moves the highlight within bounds without wrapping on ArrowDown/ArrowUp', () => {
      renderRuntimePage(buildPage({}))

      const input = screen.getByRole('combobox')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'a' } })

      expect(screen.getAllByRole('option')).toHaveLength(3)

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('-option-0'))

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('-option-2'))

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('-option-0'))
    })

    it('selects the highlighted option on Enter and prevents the default (form submit)', () => {
      renderRuntimePage(buildPage({}))

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const notCanceled = fireEvent.keyDown(input, { key: 'Enter' })

      expect(notCanceled).toBe(false)
      expect(input.value).toBe('Spain')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('closes the list on Escape without changing the value', () => {
      renderRuntimePage(buildPage({}))

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(input).not.toHaveAttribute('aria-activedescendant')
    })
  })

  describe('validation — required', () => {
    it('blocks submit with the default message when required and empty', async () => {
      const submitMock = vi.fn()
      vi.stubGlobal('fetch', submitMock)

      const page: RuntimePageConfig = {
        id: 'p',
        layout: [
          {
            type: 'form',
            id: 'f',
            submitAction: { type: 'executeOperation', operationName: 'submit' },
            children: [
              {
                type: 'autocomplete',
                props: {
                  fieldId: 'country',
                  label: 'Country',
                  items: countryItems,
                  validations: { required: { value: true } },
                },
              },
              { type: 'button', props: { label: 'Submit' } },
            ],
          },
        ],
      }

      renderRuntimePage(page)

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(screen.getByText('Required')).toBeInTheDocument()
      })

      expect(submitMock).not.toHaveBeenCalled()
    })
  })

  describe('ARIA semantics', () => {
    it('exposes combobox/listbox/option roles and toggles aria-describedby only when there is an error', async () => {
      const page: RuntimePageConfig = {
        id: 'p',
        layout: [
          {
            type: 'form',
            id: 'f',
            submitAction: { type: 'executeOperation', operationName: 'submit' },
            children: [
              {
                type: 'autocomplete',
                props: {
                  fieldId: 'country',
                  label: 'Country',
                  items: countryItems,
                  validations: { required: { value: true } },
                },
              },
              { type: 'button', props: { label: 'Submit' } },
            ],
          },
        ],
      }

      renderRuntimePage(page)

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).not.toHaveAttribute('aria-describedby')

      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })

      expect(input).toHaveAttribute('aria-expanded', 'true')
      expect(input).toHaveAttribute('aria-controls', 'f-country-listbox')
      expect(screen.getByRole('listbox')).toHaveAttribute('id', 'f-country-listbox')
      expect(screen.getByRole('option', { name: 'Spain' })).toBeInTheDocument()

      fireEvent.blur(input)
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-describedby', 'f-country-error')
      })
    })
  })

  it('applies layout.span grid class', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'container',
              props: { columns: 2 },
              children: [
                {
                  type: 'autocomplete',
                  props: { fieldId: 'country', label: 'Country', items: countryItems },
                  layout: { span: 2 },
                },
              ],
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    const input = screen.getByRole('combobox')
    const spanWrapper = input.closest('[data-layout-node="autocomplete"]')?.parentElement
    expect(spanWrapper).toHaveClass('col-span-2')
  })

  it('does not render when hidden by visibility', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: { fieldId: 'country', label: 'Country', items: countryItems },
              visibility: { reference: 'forms.f.showCountry', operator: 'isTruthy' },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows queryStateFeedback fallback when the corresponding query is in the matching state', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: { fieldId: 'country', label: 'Country', items: countryItems },
              queryStateFeedback: {
                query: 'q',
                states: {
                  loading: { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Loading options...' } }] },
                },
              },
            },
          ],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: { status: 'loading', data: null, error: null, requestSignature: null },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByText('Loading options...')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('resolves independent catalogs per iteration for item.* sourced items inside a repeater', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.q.data.items', key: 'id' },
                template: [
                  {
                    type: 'autocomplete',
                    props: {
                      fieldId: 'choice',
                      label: 'Choice',
                      items: { source: 'item.options', itemType: 'object', label: 'label', value: 'value' },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page, {}, {
      q: {
        items: [
          { id: 'a', options: [{ label: 'Alpha', value: 'A' }, { label: 'Beta', value: 'B' }] },
          { id: 'b', options: [{ label: 'Gamma', value: 'G' }, { label: 'Delta', value: 'D' }] },
        ],
      },
    })

    const inputs = screen.getAllByRole('combobox')
    expect(inputs).toHaveLength(2)

    fireEvent.focus(inputs[0])
    fireEvent.change(inputs[0], { target: { value: 'a' } })
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Gamma' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: 'Alpha' }))
    expect((inputs[0] as HTMLInputElement).value).toBe('Alpha')

    fireEvent.focus(inputs[1])
    fireEvent.change(inputs[1], { target: { value: 'g' } })
    expect(screen.getByRole('option', { name: 'Gamma' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: 'Gamma' }))
    expect((inputs[1] as HTMLInputElement).value).toBe('Gamma')
  })
})

describe('autocomplete layout node — multiple selection (chips)', () => {
  it('adds a chip per selected suggestion without removing existing ones, in selection order', () => {
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    fireEvent.change(input, { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('option', { name: 'France' }))

    const removeButtons = screen.getAllByRole('button', { name: /Quitar/ })
    expect(removeButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Quitar Spain',
      'Quitar France',
    ])
  })

  it('excludes an already-selected item from the suggestions list, preventing duplicate selection', () => {
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    fireEvent.change(input, { target: { value: '' } })

    expect(screen.queryByRole('option', { name: 'Spain' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'France' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Germany' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Quitar/ })).toHaveLength(1)
  })

  it('shows a pointer cursor on the chip removal control', () => {
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    expect(screen.getByRole('button', { name: 'Quitar Spain' }).className).toContain('cursor-pointer')
  })

  it('removes only the clicked chip, keeping the rest and their order', () => {
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))
    fireEvent.change(input, { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('option', { name: 'France' }))
    fireEvent.change(input, { target: { value: 'ge' } })
    fireEvent.click(screen.getByRole('option', { name: 'Germany' }))

    fireEvent.click(screen.getByRole('button', { name: 'Quitar France' }))

    const remainingButtons = screen.getAllByRole('button', { name: /Quitar/ })
    expect(remainingButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Quitar Spain',
      'Quitar Germany',
    ])
  })

  it('keeps the suggestion list open and the input focused and empty after adding a chip', () => {
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox') as HTMLInputElement
    input.focus()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(input).toHaveFocus()
    expect(input.value).toBe('')
  })

  it('ignores props.placeholder in multiple mode', () => {
    renderRuntimePage(buildPage({ multiple: true, placeholder: 'Search countries' }))

    const input = screen.getByRole('combobox')
    expect(input).not.toHaveAttribute('placeholder', 'Search countries')
  })

  it('renders chips and the search text inside a single bordered field, not as a bare input next to them', () => {
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    const chip = screen.getByRole('button', { name: 'Quitar Spain' })
    const fieldContainer = chip.closest('div')
    expect(fieldContainer).toContainElement(input)
    expect(fieldContainer?.className).toContain('border')
    // The bordered look now lives on the container, not on the bare input, so chips and the
    // in-progress text read as one field.
    expect(input.className).not.toContain('border')
  })

  it('selecting a second suggestion does not remove the first chip (label click-forwarding regression)', () => {
    // HTML forwards a click anywhere inside a <label> with no explicit `htmlFor` to the label's
    // first labelable descendant. Once a chip exists, its "Quitar" button is that first
    // descendant (it renders before the search input) — clicking a dropdown option elsewhere in
    // the same label would forward a synthetic click to it too, silently removing the chip that
    // was just added. Only reproduces with 3+ options: selecting the 2nd requires re-filtering
    // (typing again), which is what triggers the option's `<li>` to shift screen position.
    renderRuntimePage(buildPage({ multiple: true }))

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))
    expect(screen.getByRole('button', { name: 'Quitar Spain' })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('option', { name: 'France' }))

    expect(screen.getByRole('button', { name: 'Quitar Spain' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar France' })).toBeInTheDocument()
  })
})

describe('autocomplete layout node — multiple selection validation', () => {
  function buildMultiplePage(validations: Record<string, unknown>): RuntimePageConfig {
    return {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: { type: 'executeOperation', operationName: 'submit' },
          children: [
            {
              type: 'autocomplete',
              props: {
                fieldId: 'country',
                label: 'Country',
                items: countryItems,
                multiple: true,
                validations,
              },
            },
            { type: 'button', props: { label: 'Submit' } },
          ],
        },
      ],
    }
  }

  it('blocks submit with [] when required and allows submit with at least one chip', async () => {
    const submitMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', submitMock)

    renderRuntimePage(buildMultiplePage({ required: { value: true } }), {
      submit: { method: 'POST', endpoint: '/api/submit' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument()
    })

    expect(submitMock).not.toHaveBeenCalled()

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })
  })

  it('validates minSelections and maxSelections with the same default messages as checkboxGroup', async () => {
    const submitMock = vi.fn()
    vi.stubGlobal('fetch', submitMock)

    renderRuntimePage(
      buildMultiplePage({ minSelections: { value: 2 }, maxSelections: { value: 2 } }),
    )

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()
    })

    expect(submitMock).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('option', { name: 'France' }))
    fireEvent.change(input, { target: { value: 'ge' } })
    fireEvent.click(screen.getByRole('option', { name: 'Germany' }))

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Select no more than 2 options.')).toBeInTheDocument()
    })

    expect(submitMock).not.toHaveBeenCalled()
  })
})

describe('autocomplete layout node — allowFreeText (single selection)', () => {
  function buildFreeTextPage(): RuntimePageConfig {
    return {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: { fieldId: 'country', label: 'Country', items: countryItems, allowFreeText: true },
            },
            { type: 'paragraph', props: { text: 'Value: {{forms.f.country}}' } },
          ],
        },
      ],
    }
  }

  it('updates the effective field value live as the user types, without blur or selection', () => {
    renderRuntimePage(buildFreeTextPage())

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Random text' } })

    expect(screen.getByText('Value: Random text')).toBeInTheDocument()
  })

  it('keeps the typed text as the value on blur even when it matches no catalog option', () => {
    renderRuntimePage(buildFreeTextPage())

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.blur(input)

    expect(input.value).toBe('xyz')
    expect(screen.getByText('Value: xyz')).toBeInTheDocument()
  })

  it('replaces the typed text with the selected suggestion value', () => {
    renderRuntimePage(buildFreeTextPage())

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    expect(input.value).toBe('Spain')
    expect(screen.getByText('Value: ES')).toBeInTheDocument()
  })
})

describe('autocomplete layout node — allowFreeText (multiple selection)', () => {
  function buildFreeTextMultiplePage(): RuntimePageConfig {
    return {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: {
                fieldId: 'country',
                label: 'Country',
                items: countryItems,
                multiple: true,
                allowFreeText: true,
              },
            },
          ],
        },
      ],
    }
  }

  it('does not write the in-progress text to the field value until confirmed with Enter', () => {
    renderRuntimePage(buildFreeTextMultiplePage())

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Custom tag' } })

    expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument()
  })

  it('adds a chip with the typed text on Enter when no suggestion is highlighted', () => {
    renderRuntimePage(buildFreeTextMultiplePage())

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Custom tag' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name: 'Quitar Custom tag' })).toBeInTheDocument()
    expect(input.value).toBe('')
  })

  it('selects the highlighted suggestion on Enter instead of confirming the typed text', () => {
    renderRuntimePage(buildFreeTextMultiplePage())

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name: 'Quitar Spain' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Quitar sp$/ })).not.toBeInTheDocument()
  })

  it('adds a chip with the catalog label when the typed text matches a value exactly', () => {
    renderRuntimePage(buildFreeTextMultiplePage())

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ES' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name: 'Quitar Spain' })).toBeInTheDocument()
  })
})

describe('autocomplete layout node — edit mode', () => {
  function buildEditModePage(): LayoutNode[] {
    return [
      {
        type: 'form',
        id: 'f',
        children: [
          { type: 'autocomplete', props: { fieldId: 'country', label: 'Country', items: countryItems } },
        ],
      },
    ]
  }

  function EditModeHarness() {
    const selectedPath: LayoutNodePath | null = null
    const editModeValue: LayoutEditModeContextValue = {
      active: true,
      selectedPath,
      hoveredPath: null,
      onSelectNode: () => {},
      onHoverNode: () => {},
    }

    return (
      <RuntimeStateProvider
        config={{ api: {}, initialPage: 'home', pages: [{ id: 'home', layout: [] }] }}
      >
        <LayoutEditModeProvider value={editModeValue}>
          <LayoutRenderer nodes={buildEditModePage()} />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>
    )
  }

  it('marks the control inert through the fieldset[disabled] ancestor in edit mode', () => {
    render(<EditModeHarness />)

    // toBeDisabled follows the fieldset[disabled] cascade real browsers use to block
    // typing, focusing, and firing change/input events on the control. The JSDOM+React
    // test harness does not simulate that browser gate for synthetic events, so the
    // observable here is the disabled state itself (same convention as select/input in
    // layout-node-renderer-edit-mode.test.tsx).
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input).toBeDisabled()
    expect(input.matches(':disabled')).toBe(true)
  })
})

describe('autocomplete layout node — dynamic query search (queries.*)', () => {
  function createJsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  // `useAutocompleteSearchTrigger` (T4) reads the just-resolved signature via `readRuntimeState()`
  // — synced synchronously on every dispatch (`runtime-state-provider.tsx`'s `latestStateRef`),
  // independent of React's own render/effect flush timing — so fake timers are enough throughout:
  // no real wall-clock gaps are needed for the freshness comparison to land deterministically.
  function createDeferredResponse() {
    let resolve!: (response: Response) => void
    const promise = new Promise<Response>((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  const dynamicApi: RuntimeConfig['api'] = {
    searchCountries: { method: 'GET', endpoint: '/api/countries' },
  }

  const dynamicItems = {
    source: 'queries.searchCountries.data.items',
    itemType: 'object' as const,
    label: 'label',
    value: 'value',
  }

  function buildDynamicPage(props: Record<string, unknown> = {}): RuntimePageConfig {
    return {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: { fieldId: 'country', label: 'Country', items: dynamicItems, ...props },
            },
          ],
        },
      ],
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire a query while searchText stays below minChars', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage({ minChars: 2 }), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'a' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('collapses several keystrokes within the debounce window into a single query execution', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage(), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    fireEvent.change(input, { target: { value: 'spa' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    fireEvent.change(input, { target: { value: 'spai' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends the in-progress search text via requestParams.query.search in multiple mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage({ multiple: true }), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('search=sp'), expect.anything())
  })

  it('sends the in-progress search text via a custom query param name when props.searchParamName is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage({ multiple: true, searchParamName: 'q' }), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=sp'), expect.anything())
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('search=sp'), expect.anything())
  })

  it('shows suggestions from queries.{queryName}.data once the debounced query resolves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage(), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.getByRole('option', { name: 'Spain' })).toBeInTheDocument()
  })

  it('keeps showing the selected label (not the raw value) after picking a suggestion from a dynamic search, without firing an extra query', async () => {
    // Single mode's operation config here has no `query`/`body` referencing `forms.f.country`
    // (unlike multiple mode's automatic `requestParams.query.search`), so the fetched URL is the
    // same on every call — this asserts by call order instead: the first call is the real "sp"
    // search; an unwanted extra fetch (triggered by `searchText` resetting to '' on selection)
    // would be a second call resolving to a catalog that no longer contains the selected item.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
      .mockResolvedValue(createJsonResponse({ items: [{ label: 'Other', value: 'OTHER' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage(), dynamicApi)

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('Spain')
  })

  it('keeps showing the selected chip label (not the raw value) after picking it from a dynamic search, without firing an extra query', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('search=sp')) {
        return Promise.resolve(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
      }
      return Promise.resolve(createJsonResponse({ items: [{ label: 'Other', value: 'OTHER' }] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage({ multiple: true }), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Quitar Spain' })).toBeInTheDocument()
  })

  it('excludes an already-selected item from a dynamic search result set', async () => {
    // A fresh Response per call — `mockResolvedValue` would reuse the same Response instance
    // (and its already-consumed body) across the two fetches this test triggers.
    const fetchMock = vi.fn(() =>
      Promise.resolve(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }, { label: 'France', value: 'FR' }] })),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage({ multiple: true }), dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 's' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))

    fireEvent.change(input, { target: { value: 's' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.queryByRole('option', { name: 'Spain' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'France' })).toBeInTheDocument()
  })

  it('keeps a chip selected from an earlier search present after a later search that does not include it', async () => {
    // Multiple mode: each confirmed chip lives in the field's array value, untouched by the
    // in-progress `searchText` used to drive the next search — unlike simple mode, where typing a
    // new search transiently echoes into `forms.{formId}.{fieldId}` itself (design.md, decisión 3).
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [{ label: 'France', value: 'FR' }] }))
    vi.stubGlobal('fetch', fetchMock)

    renderRuntimePage(buildDynamicPage({ multiple: true }), dynamicApi)

    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sp' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    fireEvent.click(screen.getByRole('option', { name: 'Spain' }))
    expect(screen.getByRole('button', { name: 'Quitar Spain' })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'fr' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.getByRole('option', { name: 'France' })).toBeInTheDocument()

    // The chip's stored value ('ES') is retained — the displayed label falls back to the raw
    // value once it's no longer part of the currently resolved catalog (`resolveLabelForValue`),
    // but the chip itself is never removed just because a later search didn't include it.
    expect(screen.getByRole('button', { name: 'Quitar ES' })).toBeInTheDocument()
  })

  it('a search backend that resolves with no results leaves the field without suggestions without blocking the rest of the form', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'autocomplete', props: { fieldId: 'country', label: 'Country', items: dynamicItems } },
            { type: 'input', props: { fieldId: 'note', label: 'Note' } },
            { type: 'paragraph', props: { text: 'Note: {{forms.f.note}}' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, dynamicApi)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zz' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.queryByRole('option')).not.toBeInTheDocument()

    const noteInput = screen.getByRole('textbox', { name: 'Note' })
    fireEvent.change(noteInput, { target: { value: 'hello' } })

    expect(screen.getByText('Note: hello')).toBeInTheDocument()
  })

  it('sets a dynamic-shape defaultValue at mount even though no search has resolved suggestions for it yet', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: { fieldId: 'country', label: 'Country', items: dynamicItems, defaultValue: 'ES' },
            },
            { type: 'paragraph', props: { text: 'Value: {{forms.f.country}}' } },
          ],
        },
      ],
    }

    renderRuntimePage(page, dynamicApi)

    expect(screen.getByText('Value: ES')).toBeInTheDocument()
  })

  describe('simple + allowFreeText:false — Enter without a highlighted suggestion', () => {
    const submitApi: RuntimeConfig['api'] = {
      ...dynamicApi,
      submitForm: { method: 'POST', endpoint: '/api/submit' },
    }

    function buildDynamicSimplePage(): RuntimePageConfig {
      return {
        id: 'p',
        layout: [
          {
            type: 'form',
            id: 'f',
            submitAction: { type: 'executeOperation', operationName: 'submitForm' },
            children: [
              { type: 'autocomplete', props: { fieldId: 'country', label: 'Country', items: dynamicItems } },
              { type: 'button', props: { label: 'Submit' } },
            ],
          },
        ],
      }
    }

    it('does not submit the form and clears the field when the typed text matches no suggestion', async () => {
      const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
      vi.stubGlobal('fetch', fetchMock)

      renderRuntimePage(buildDynamicSimplePage(), submitApi)

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(screen.getByRole('option', { name: 'Spain' })).toBeInTheDocument()

      fireEvent.change(input, { target: { value: 'zzz' } })
      const notCanceled = fireEvent.keyDown(input, { key: 'Enter' })

      expect(notCanceled).toBe(false)
      expect(input.value).toBe('')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('selects the matching suggestion and does not submit when the typed text matches a label or value exactly', async () => {
      const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ items: [{ label: 'Spain', value: 'ES' }] }))
      vi.stubGlobal('fetch', fetchMock)

      renderRuntimePage(buildDynamicSimplePage(), submitApi)

      const input = screen.getByRole('combobox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'sp' } })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(screen.getByRole('option', { name: 'Spain' })).toBeInTheDocument()

      fireEvent.change(input, { target: { value: 'Spain' } })
      const notCanceledByLabel = fireEvent.keyDown(input, { key: 'Enter' })

      expect(notCanceledByLabel).toBe(false)
      expect(input.value).toBe('Spain')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'ES' } })
      const notCanceledByValue = fireEvent.keyDown(input, { key: 'Enter' })

      expect(notCanceledByValue).toBe(false)
      expect(input.value).toBe('Spain')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('a stale instance that shares queryName with another instance stops showing suggestions until it searches again', async () => {
    const deferredA = createDeferredResponse()
    const deferredB = createDeferredResponse()
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('search=aa')) return deferredA.promise
      if (url.includes('search=bb')) return deferredB.promise
      if (url.includes('search=cc')) return Promise.resolve(createJsonResponse({ items: [{ label: 'Charlie', value: 'C' }] }))
      return Promise.resolve(createJsonResponse({ items: [] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'autocomplete',
              props: { fieldId: 'tagsA', label: 'Tags A', items: dynamicItems, multiple: true },
            },
            {
              type: 'autocomplete',
              props: { fieldId: 'tagsB', label: 'Tags B', items: dynamicItems, multiple: true },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page, dynamicApi)

    const inputs = screen.getAllByRole('combobox')
    fireEvent.focus(inputs[0])
    fireEvent.change(inputs[0], { target: { value: 'aa' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    fireEvent.focus(inputs[1])
    fireEvent.change(inputs[1], { target: { value: 'bb' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    // Resolve out of order: B was fired last but resolves first; A resolves last and wins the
    // shared `queries.searchCountries` slot (design.md, decisión 5). `readRuntimeState()` is
    // synced synchronously on dispatch, so resolving both within the same `act()` flush (no real
    // timers, no fixed wall-clock gaps) is enough for the write order to land deterministically.
    await act(async () => {
      deferredB.resolve(createJsonResponse({ items: [{ label: 'Bravo', value: 'B' }] }))
      await Promise.resolve()
      await Promise.resolve()
      deferredA.resolve(createJsonResponse({ items: [{ label: 'Alpha', value: 'A' }] }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Bravo' })).not.toBeInTheDocument()

    // Instance B searches again on its own and regains fresh suggestions.
    fireEvent.change(inputs[1], { target: { value: 'cc' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.getByRole('option', { name: 'Charlie' })).toBeInTheDocument()
  })
})
