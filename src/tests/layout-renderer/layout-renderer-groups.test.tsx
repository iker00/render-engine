import { useEffect } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'

function QuerySetter({ queryName, data }: { queryName: string; data: unknown }) {
  const { setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    setQuerySuccess(queryName, data)
  }, [queryName, data, setQuerySuccess])

  return null
}

function renderConfig(config: RuntimeConfig, queries: Array<{ queryName: string; data: unknown }> = []) {
  return render(
    <RuntimeStateProvider config={config}>
      {queries.map(({ queryName, data }) => (
        <QuerySetter key={queryName} queryName={queryName} data={data} />
      ))}
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('GroupLayoutNode — template expansion, group context and scope-chain (feature reusable-node-groups)', () => {
  it('two instances of a group with a text param render independently with their own resolved value (AC1)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        titleCard: {
          params: ['title'],
          template: [{ type: 'paragraph', props: { text: 'Title: {{group.title}}' } }],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            { type: 'group', props: { groupId: 'titleCard', params: { title: 'First' } } },
            { type: 'group', props: { groupId: 'titleCard', params: { title: 'Second' } } },
          ],
        },
      ],
    }

    renderConfig(config)

    expect(screen.getByText('Title: First')).toBeInTheDocument()
    expect(screen.getByText('Title: Second')).toBeInTheDocument()
  })

  it('two instances of a group with a slot render each instance content at its own instantiation point (AC2)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        panel: { params: [], template: [{ type: 'slot' }] },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'group',
              props: { groupId: 'panel', params: {} },
              children: [{ type: 'paragraph', props: { text: 'Content A' } }],
            },
            {
              type: 'group',
              props: { groupId: 'panel', params: {} },
              children: [{ type: 'paragraph', props: { text: 'Content B' } }],
            },
          ],
        },
      ],
    }

    renderConfig(config)

    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })

  it('a group inside repeater.props.template resolves both props.params and the slot children against the item of each iteration (AC3)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        itemCard: {
          params: ['foo'],
          template: [{ type: 'paragraph', props: { text: 'Param: {{group.foo}}' } }, { type: 'slot' }],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.rows.data.results', key: 'id' },
                template: [
                  {
                    type: 'group',
                    props: { groupId: 'itemCard', params: { foo: 'item.name' } },
                    children: [{ type: 'paragraph', props: { text: 'Slot: {{item.name}}' } }],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    renderConfig(config, [
      { queryName: 'rows', data: { results: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }] } },
    ])

    expect(screen.getByText('Param: Alice')).toBeInTheDocument()
    expect(screen.getByText('Slot: Alice')).toBeInTheDocument()
    expect(screen.getByText('Param: Bob')).toBeInTheDocument()
    expect(screen.getByText('Slot: Bob')).toBeInTheDocument()
  })

  it('an instance without children on a group that declares a slot renders the slot empty without breaking the tree', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        panel: { params: [], template: [{ type: 'slot' }] },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'container',
              children: [{ type: 'group', props: { groupId: 'panel', params: {} } }],
            },
          ],
        },
      ],
    }

    const { container } = renderConfig(config)

    const containerEl = container.querySelector('[data-layout-node="container"]')
    expect(containerEl).not.toBeNull()
    expect(containerEl?.textContent).toBe('')
  })

  it('two instances of the same groupId with a form of the same formId in their template do not share form state (AC integration with T05)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        formGroup: {
          params: ['label'],
          template: [
            {
              type: 'form',
              id: 'row-form',
              children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
            },
          ],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            { type: 'group', props: { groupId: 'formGroup', params: { label: 'One' } } },
            { type: 'group', props: { groupId: 'formGroup', params: { label: 'Two' } } },
          ],
        },
      ],
    }

    renderConfig(config)

    const inputs = screen.getAllByLabelText('Name')
    expect(inputs).toHaveLength(2)

    fireEvent.change(inputs[0], { target: { value: 'Hello' } })

    expect(inputs[0]).toHaveValue('Hello')
    expect(inputs[1]).toHaveValue('')
  })

  it('two instances of the same groupId with a modal of the same id in their template do not share open state (AC integration with T03)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        modalGroup: {
          params: ['label'],
          template: [
            {
              type: 'button',
              props: { label: 'Open {{group.label}}', action: { type: 'openModal', modalId: 'row-modal' } },
            },
            {
              type: 'modal',
              id: 'row-modal',
              children: [{ type: 'heading', props: { level: 2, text: 'Panel {{group.label}}' } }],
            },
          ],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            { type: 'group', props: { groupId: 'modalGroup', params: { label: 'One' } } },
            { type: 'group', props: { groupId: 'modalGroup', params: { label: 'Two' } } },
          ],
        },
      ],
    }

    renderConfig(config)

    fireEvent.click(screen.getByRole('button', { name: 'Open One' }))
    expect(screen.getAllByTestId('modal-panel')).toHaveLength(1)
    expect(within(screen.getByTestId('modal-panel')).getByText('Panel One')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Two' }))
    expect(screen.getAllByTestId('modal-panel')).toHaveLength(1)
    expect(within(screen.getByTestId('modal-panel')).getByText('Panel Two')).toBeInTheDocument()
  })

  it('two instances of the same groupId with accordions sharing the same internal groupId do not coordinate across instances (AC integration with T04)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        accGroup: {
          params: ['label'],
          template: [
            {
              type: 'accordion',
              props: { label: 'A', groupId: 'internal', defaultOpen: true },
              children: [{ type: 'paragraph', props: { text: 'A-{{group.label}}' } }],
            },
            {
              type: 'accordion',
              props: { label: 'B', groupId: 'internal' },
              children: [{ type: 'paragraph', props: { text: 'B-{{group.label}}' } }],
            },
          ],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            { type: 'group', props: { groupId: 'accGroup', params: { label: 'One' } } },
            { type: 'group', props: { groupId: 'accGroup', params: { label: 'Two' } } },
          ],
        },
      ],
    }

    const { container } = renderConfig(config)

    expect(screen.getByText('A-One')).toBeInTheDocument()
    expect(screen.getByText('A-Two')).toBeInTheDocument()
    expect(screen.queryByText('B-One')).not.toBeInTheDocument()
    expect(screen.queryByText('B-Two')).not.toBeInTheDocument()

    const bButtons = screen.getAllByRole('button', { name: 'B' })
    fireEvent.click(bButtons[0])

    expect(screen.getByText('B-One')).toBeInTheDocument()

    const closingBody = Array.from(container.querySelectorAll('[data-layout-node="accordion-body"]')).find((body) =>
      body.classList.contains('animate-accordion-close'),
    )
    if (closingBody) fireEvent.animationEnd(closingBody)

    expect(screen.queryByText('A-One')).not.toBeInTheDocument()
    expect(screen.getByText('A-Two')).toBeInTheDocument()
    expect(screen.queryByText('B-Two')).not.toBeInTheDocument()
  })

  it('the slot content never sees group.* even though the template does (context separation, AC on isolation)', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      groups: {
        isolationGroup: {
          params: ['title'],
          template: [{ type: 'paragraph', props: { text: 'Template: {{group.title}}' } }, { type: 'slot' }],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'group',
              props: { groupId: 'isolationGroup', params: { title: 'Hello' } },
              children: [{ type: 'paragraph', props: { text: 'Slot: {{group.title}}' } }],
            },
          ],
        },
      ],
    }

    renderConfig(config)

    expect(screen.getByText('Template: Hello')).toBeInTheDocument()
    expect(screen.getByText('Slot:')).toBeInTheDocument()
    expect(screen.queryByText('Slot: Hello')).not.toBeInTheDocument()
  })

  it('queries.*, t.* and forms.* (of a formId outside the template) resolve within the template exactly as if written inline', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      translations: { greeting: { es: 'Hola' } },
      groups: {
        refsGroup: {
          params: [],
          template: [
            {
              type: 'paragraph',
              props: { text: 'Q:{{queries.info.data.msg}} T:{{t.greeting}} F:{{forms.outerForm.name}}' },
            },
          ],
        },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'outerForm',
              children: [{ type: 'input', props: { fieldId: 'name', label: 'Outer name' } }],
            },
            { type: 'group', props: { groupId: 'refsGroup', params: {} } },
          ],
        },
      ],
    }

    renderConfig(config, [{ queryName: 'info', data: { msg: 'QueryMsg' } }])

    fireEvent.change(screen.getByLabelText('Outer name'), { target: { value: 'Outer' } })

    expect(screen.getByText('Q:QueryMsg T:Hola F:Outer')).toBeInTheDocument()
  })
})
