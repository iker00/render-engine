import { describe, expect, it } from 'vitest'
import { computeModalRepeaterOwnership } from '../../config/runtime-modal-repeater-ownership'
import type {
  ContainerLayoutNode,
  ModalLayoutNode,
  RepeaterLayoutNode,
  RuntimePageConfig,
} from '../../config/runtime-config-types'

function modal(id: string, overrides: Partial<ModalLayoutNode> = {}): ModalLayoutNode {
  return { type: 'modal', id, ...overrides }
}

function container(children: ContainerLayoutNode['children']): ContainerLayoutNode {
  return { type: 'container', children }
}

function repeater(template: RepeaterLayoutNode['props']['template']): RepeaterLayoutNode {
  return {
    type: 'repeater',
    props: {
      items: { source: 'queries.list.data', key: 'id' },
      template,
    },
  }
}

describe('computeModalRepeaterOwnership', () => {
  it('resolves null for a modal declared directly at page layout level', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [modal('m1')] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m1')).toBeNull()
  })

  it('resolves null for a modal inside container.children outside any repeater', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [container([modal('m2')])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m2')).toBeNull()
  })

  it('resolves a modal at the root of repeater.props.template to the repeater identity', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [repeater([modal('m3')])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m3')).toBe('home::layout[0]')
  })

  it('resolves a modal nested inside container.children inside repeater.props.template to the same repeater identity', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [repeater([container([modal('m4')])])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m4')).toBe('home::layout[0]')
  })

  it('resolves a modal inside a nested repeater to the innermost repeater identity, not the outer one', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [repeater([repeater([modal('m5')])])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m5')).toBe('home::layout[0].props.template[0]')
  })

  it('produces distinct repeater identities for two pages whose repeater shares the same structural nodePath', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [repeater([modal('m6a')])] },
      { id: 'details', layout: [repeater([modal('m6b')])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m6a')).toBe('home::layout[0]')
    expect(ownership.get('m6b')).toBe('details::layout[0]')
    expect(ownership.get('m6a')).not.toBe(ownership.get('m6b'))
  })

  it('resolves a modal inside a queryStateFeedback fallback of a node inside repeater.props.template to that repeater identity', () => {
    const nodeWithFallback: ContainerLayoutNode = {
      type: 'container',
      queryStateFeedback: {
        query: 'queries.data',
        states: {
          loading: { mode: 'fallback', fallback: [modal('m7')] },
        },
      },
    }

    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [repeater([nodeWithFallback])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m7')).toBe('home::layout[0]')
  })

  it('resolves every modal to null when the configuration has no repeaters', () => {
    const pages: RuntimePageConfig[] = [
      { id: 'home', layout: [modal('m8a'), container([modal('m8b')])] },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.get('m8a')).toBeNull()
    expect(ownership.get('m8b')).toBeNull()
  })

  it('produces a map whose size matches the total number of modals declared, without loss or duplication', () => {
    const pages: RuntimePageConfig[] = [
      {
        id: 'home',
        layout: [
          modal('m9-page'),
          container([modal('m9-container')]),
          repeater([modal('m9-repeater'), container([modal('m9-repeater-container')])]),
        ],
      },
      {
        id: 'details',
        layout: [repeater([modal('m9-details-repeater')])],
      },
    ]

    const ownership = computeModalRepeaterOwnership(pages)

    expect(ownership.size).toBe(5)
  })
})
