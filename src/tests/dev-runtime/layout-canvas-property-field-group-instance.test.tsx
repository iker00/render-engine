import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeGroupInstanceNode, RuntimeGroupsConfig } from '../../config/runtime-config-types'
import { GroupInstancePropertyField } from '../../dev-runtime/layout-canvas/property-fields/group-instance-property-field'

function groupNode(groupId: string, params: Record<string, unknown> = {}): RuntimeGroupInstanceNode {
  return { type: 'group', props: { groupId, params } }
}

const GROUPS: RuntimeGroupsConfig = {
  card: { params: ['title', 'subtitle'], template: [{ type: 'heading', props: { text: 'x', level: 2 } }] },
  banner: { params: [], template: [{ type: 'container' }] },
}

describe('GroupInstancePropertyField: groupId selector disabled state', () => {
  it('disables the selector with an explicit title when config.groups is undefined', () => {
    render(<GroupInstancePropertyField label="Grupo" node={groupNode('')} groups={undefined} onChange={vi.fn()} />)

    const select = screen.getByRole('combobox', { name: 'Grupo' })
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('title', expect.stringContaining('grupo'))
  })

  it('disables the selector with an explicit title when config.groups is an empty object', () => {
    render(<GroupInstancePropertyField label="Grupo" node={groupNode('')} groups={{}} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Grupo' })).toBeDisabled()
  })

  it('enables the selector with the existing group ids as options when config.groups is non-empty', () => {
    render(<GroupInstancePropertyField label="Grupo" node={groupNode('')} groups={GROUPS} onChange={vi.fn()} />)

    const select = screen.getByRole('combobox', { name: 'Grupo' })
    expect(select).not.toBeDisabled()
    expect(screen.getByRole('option', { name: 'card' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'banner' })).toBeInTheDocument()
  })
})

describe('GroupInstancePropertyField: selecting a groupId seeds props.params', () => {
  it('pre-fills props.params with one empty text field per paramName declared by the chosen group', () => {
    const onChange = vi.fn()
    render(<GroupInstancePropertyField label="Grupo" node={groupNode('')} groups={GROUPS} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Grupo' }), { target: { value: 'card' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as RuntimeGroupInstanceNode
    expect(nextNode.props.groupId).toBe('card')
    expect(nextNode.props.params).toEqual({ title: '', subtitle: '' })
  })

  it('renders a text field per declared param, and editing it commits props.params.{paramName}', () => {
    const onChange = vi.fn()
    render(
      <GroupInstancePropertyField
        label="Grupo"
        node={groupNode('card', { title: '', subtitle: '' })}
        groups={GROUPS}
        onChange={onChange}
      />,
    )

    const titleField = screen.getByRole('textbox', { name: 'title' })
    expect(titleField).toBeInTheDocument()
    fireEvent.change(titleField, { target: { value: 'Hola' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextNode = onChange.mock.calls[0][0] as RuntimeGroupInstanceNode
    expect(nextNode.props.groupId).toBe('card')
    expect(nextNode.props.params).toEqual({ title: 'Hola', subtitle: '' })
  })
})

describe('GroupInstancePropertyField: changing groupId reconstructs props.params/children from scratch', () => {
  it('discards the previous params and children when switching to a different group', () => {
    const onChange = vi.fn()
    const node: RuntimeGroupInstanceNode = {
      ...groupNode('banner', {}),
      children: [{ type: 'heading', props: { text: 'Slot content', level: 2 } }],
    }
    render(<GroupInstancePropertyField label="Grupo" node={node} groups={GROUPS} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Grupo' }), { target: { value: 'card' } })

    const nextNode = onChange.mock.calls[0][0] as RuntimeGroupInstanceNode
    expect(nextNode.props.groupId).toBe('card')
    expect(nextNode.props.params).toEqual({ title: '', subtitle: '' })
    expect(nextNode.children).toBeUndefined()
  })

  it('drops stale params carried over from a previous group even when a param name happens to match', () => {
    const onChange = vi.fn()
    const groups: RuntimeGroupsConfig = {
      ...GROUPS,
      other: { params: ['title'], template: [] },
    }
    const node = groupNode('other', { title: 'Valor previo' })
    render(<GroupInstancePropertyField label="Grupo" node={node} groups={groups} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Grupo' }), { target: { value: 'card' } })

    const nextNode = onChange.mock.calls[0][0] as RuntimeGroupInstanceNode
    expect(nextNode.props.params).toEqual({ title: '', subtitle: '' })
  })
})

describe('GroupInstancePropertyField: props.params mismatch warning', () => {
  it('shows a role="alert" when props.params has a key not declared by the resolved group', () => {
    render(
      <GroupInstancePropertyField
        label="Grupo"
        node={groupNode('card', { title: 'x', subtitle: 'y', extra: 'z' })}
        groups={GROUPS}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a role="alert" when props.params is missing a param declared by the resolved group', () => {
    render(
      <GroupInstancePropertyField
        label="Grupo"
        node={groupNode('card', { title: 'x' })}
        groups={GROUPS}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('does not show an alert when props.params matches the resolved group exactly', () => {
    render(
      <GroupInstancePropertyField
        label="Grupo"
        node={groupNode('card', { title: 'x', subtitle: 'y' })}
        groups={GROUPS}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show an alert when no group is selected yet (groupId does not resolve)', () => {
    render(
      <GroupInstancePropertyField
        label="Grupo"
        node={groupNode('', { anything: 'x' })}
        groups={GROUPS}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
