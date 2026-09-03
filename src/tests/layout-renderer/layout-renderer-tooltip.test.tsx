import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FieldTooltip } from '../../runtime/nodes/field-tooltip'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePage(activePage: RuntimePageConfig, api: RuntimeConfig['api'] = {}) {
  const config: RuntimeConfig = {
    api,
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('FieldTooltip component', () => {
  it('renders the help icon when text is a non-empty string', () => {
    render(<FieldTooltip text="This is help text" />)
    expect(screen.getByLabelText('Help')).toBeInTheDocument()
  })

  it('does not render anything when text is an empty string', () => {
    const { container } = render(<FieldTooltip text="" />)
    expect(container.innerHTML).toBe('')
  })

  it('does not render anything when text is undefined', () => {
    const { container } = render(<FieldTooltip text={undefined as unknown as string} />)
    expect(container.innerHTML).toBe('')
  })

  it('the icon is focusable by keyboard (has tabindex="0")', () => {
    render(<FieldTooltip text="Help content" />)
    const icon = screen.getByLabelText('Help')
    expect(icon).toHaveAttribute('tabindex', '0')
  })

  it('the icon has aria-label with value "Help"', () => {
    render(<FieldTooltip text="Help content" />)
    const icon = screen.getByLabelText('Help')
    expect(icon).toBeInTheDocument()
  })

  it('the tooltip has role="tooltip"', () => {
    render(<FieldTooltip text="Help content" />)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('aria-describedby associates the icon with the tooltip', () => {
    render(<FieldTooltip text="Help content" />)
    const icon = screen.getByLabelText('Help')
    const tooltip = screen.getByRole('tooltip')
    expect(icon).toHaveAttribute('aria-describedby', tooltip.id)
    expect(tooltip.id).toBeTruthy()
  })

  it('the tooltip text shows the content received in text', () => {
    render(<FieldTooltip text="Detailed help information" />)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Detailed help information')
  })
})

describe('tooltip integration in field nodes', () => {
  it('input with props.tooltip renders help icon next to the label', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name', tooltip: 'Enter your full name' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Enter your full name')
  })

  it('input without props.tooltip does not render help icon', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.queryByLabelText('Help')).not.toBeInTheDocument()
  })

  it('textarea with props.tooltip renders help icon next to the label', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'textarea', props: { fieldId: 'bio', label: 'Bio', tooltip: 'Tell us about yourself' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tell us about yourself')
  })

  it('select with props.tooltip renders help icon next to the label', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'select',
              props: {
                fieldId: 'role',
                label: 'Role',
                tooltip: 'Choose your role',
                items: [{ label: 'Admin', value: 'admin' }, { label: 'User', value: 'user' }],
              },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Choose your role')
  })

  it('radioGroup with props.tooltip renders help icon next to the legend', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'radioGroup',
              props: {
                fieldId: 'color',
                label: 'Color',
                tooltip: 'Pick a color',
                items: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }],
              },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Pick a color')
  })

  it('checkboxGroup with props.tooltip renders help icon next to the legend', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'checkboxGroup',
              props: {
                fieldId: 'tags',
                label: 'Tags',
                tooltip: 'Select applicable tags',
                items: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
              },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Select applicable tags')
  })

  it('toggle (labelPosition top) with props.tooltip renders help icon next to the label', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'agree', label: 'Agree', tooltip: 'You must agree' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('You must agree')
  })

  it('toggle (labelPosition inline) with props.tooltip renders help icon next to the inline label', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'toggle', props: { fieldId: 'notify', label: 'Notify me', tooltip: 'Enable notifications', labelPosition: 'inline' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Enable notifications')
  })

  it('fileInput with props.tooltip renders help icon next to the label', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'fileInput', props: { fieldId: 'doc', label: 'Document', tooltip: 'Upload your document' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Upload your document')
  })

  it('input with props.tooltip as empty string does not render help icon', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name', tooltip: '' } },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.queryByLabelText('Help')).not.toBeInTheDocument()
  })

  it('input with props.tooltip containing interpolated reference renders the resolved text', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name', tooltip: '{{t.helpText}}' } },
          ],
        },
      ],
    }

    const config: RuntimeConfig = {
      api: {},
      initialPage: page.id,
      pages: [page],
      translations: { helpText: { es: 'This is resolved help' } },
    }

    const state = createRuntimeState(config, { activeLanguage: 'es' })
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    render(
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
    )

    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('This is resolved help')
  })

  it('input with props.tooltip containing an unresolved reference falls back to key name in dev mode', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name', tooltip: '{{t.missing}}' } },
          ],
        },
      ],
    }

    const config: RuntimeConfig = {
      api: {},
      initialPage: page.id,
      pages: [page],
    }

    const state = createRuntimeState(config, { activeLanguage: 'es' })
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    render(
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
    )

    // In dev mode, unresolved translations fall back to the key name (same semantics as props.label)
    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('missing')
  })

  it('tooltip does not affect field validation or submit (input with tooltip + required rejects empty submit)', async () => {
    const submitMock = vi.fn()
    vi.stubGlobal('fetch', submitMock)

    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          submitAction: {
            type: 'executeOperation',
            operationName: 'submit',
          },
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'name',
                label: 'Name',
                tooltip: 'Enter your name',
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

  it('input with props.tooltip and props.icon: both coexist without interference', () => {
    const page: RuntimePageConfig = {
      id: 'p',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'search',
                label: 'Search',
                tooltip: 'Search for items',
                icon: 'search',
              },
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    // The help icon from tooltip should be present
    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Search for items')

    // The input field icon should also be present (rendered as an SVG inside the input wrapper)
    const inputElement = document.getElementById('f-search')
    expect(inputElement).toBeInTheDocument()
    expect(inputElement!.tagName).toBe('INPUT')
    // The input wrapper should contain the Lucide search icon SVG (separate from the tooltip help icon)
    const inputWrapper = inputElement!.closest('[data-layout-node="input"]')
    expect(inputWrapper).toBeInTheDocument()
    // There should be 2 SVGs total: one for the input icon (search), one for the tooltip icon (help circle)
    const svgs = inputWrapper!.querySelectorAll('svg')
    expect(svgs.length).toBe(2)
  })
})
