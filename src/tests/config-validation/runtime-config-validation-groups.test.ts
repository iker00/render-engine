import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createConfigWithGroups(groups: Record<string, unknown>, layout: Array<Record<string, unknown>> = []) {
  return {
    ...createConfigWithLayout(layout),
    groups,
  }
}

function createGroupNode(
  groupId: string,
  params: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {},
) {
  return {
    type: 'group',
    props: { groupId, params },
    ...overrides,
  }
}

describe('validateGroupsConfig — slot count per group definition', () => {
  it('rejects a group template declaring more than one slot at any depth', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({
        card: {
          params: [],
          template: [{ type: 'slot' }, { type: 'container', children: [{ type: 'slot' }] }],
        },
      }),
    )

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('groups.card')
    }
  })

  it('accepts a group template declaring exactly one slot', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({
        card: {
          params: [],
          template: [{ type: 'container', children: [{ type: 'slot' }] }],
        },
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('accepts a group template declaring no slot at all', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({
        card: {
          params: [],
          template: [{ type: 'heading', props: { text: 'Static', level: 2 } }],
        },
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('rejects a group template with a nested group node', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({
        card: {
          params: [],
          template: [{ type: 'group', props: { groupId: 'other', params: {} } }],
        },
      }),
    )

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('groups.card.template')
    }
  })
})

describe('validateGroupsConfig — group instance cross-validation', () => {
  it('rejects a group instance referencing an unknown groupId', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({ card: { params: [], template: [] } }, [createGroupNode('missing')]),
    )

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].props.groupId')
      expect(result.error.message).toContain('unknown group id')
    }
  })

  it('rejects a group instance omitting a param declared by the group', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({ card: { params: ['title'], template: [] } }, [createGroupNode('card', {})]),
    )

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].props.params')
    }
  })

  it('rejects a group instance with a param not declared by the group', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({ card: { params: ['title'], template: [] } }, [
        createGroupNode('card', { title: 'Hi', extra: 'nope' }),
      ]),
    )

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].props.params')
    }
  })

  it('rejects children on a group instance whose template does not declare a slot', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups(
        { card: { params: [], template: [{ type: 'heading', props: { text: 'Static', level: 2 } }] } },
        [createGroupNode('card', {}, { children: [{ type: 'paragraph', props: { text: 'Hi' } }] })],
      ),
    )

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children')
    }
  })

  it('accepts children on a group instance whose template declares a slot', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({ card: { params: [], template: [{ type: 'slot' }] } }, [
        createGroupNode('card', {}, { children: [{ type: 'paragraph', props: { text: 'Hi' } }] }),
      ]),
    )

    expect(result.status).toBe('ready')
  })

  it('accepts a group instance with matching params and no children on a slot-less group', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups(
        { card: { params: ['title'], template: [{ type: 'heading', props: { text: 'Static', level: 2 } }] } },
        [createGroupNode('card', { title: 'Hi' })],
      ),
    )

    expect(result.status).toBe('ready')
  })
})

describe('validateGroupsConfig — recursive detection of group instances', () => {
  it('detects a group instance nested inside container.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({}, [{ type: 'container', children: [createGroupNode('missing')] }]),
    )

    expect(result.status).toBe('error')
  })

  it('detects a group instance nested inside repeater.props.template', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({}, [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [createGroupNode('missing')],
          },
        },
      ]),
    )

    expect(result.status).toBe('error')
  })

  it('detects a group instance nested inside modal.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({}, [{ type: 'modal', id: 'my-modal', children: [createGroupNode('missing')] }]),
    )

    expect(result.status).toBe('error')
  })

  it('detects a group instance nested inside tabs.props.items[i].children', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({}, [
        {
          type: 'tabs',
          props: {
            items: [{ label: 'Tab 1', children: [createGroupNode('missing')] }],
          },
        },
      ]),
    )

    expect(result.status).toBe('error')
  })

  it('detects a group instance nested inside steps.props.items[i].children', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({}, [
        {
          type: 'steps',
          props: {
            items: [{ label: 'Step 1', children: [createGroupNode('missing')] }],
          },
        },
      ]),
    )

    expect(result.status).toBe('error')
  })

  it('detects a group instance nested inside accordion.children', () => {
    const result = validateRuntimeConfig(
      createConfigWithGroups({}, [
        { type: 'accordion', props: { label: 'Section' }, children: [createGroupNode('missing')] },
      ]),
    )

    expect(result.status).toBe('error')
  })
})
