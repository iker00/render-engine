import { describe, expect, it } from 'vitest'
import type { RuntimeConfig, RuntimeGroupsConfig } from '../../config/runtime-config-types'
import {
  applyGroupsMutation,
  commitGroupsMutation,
  type GroupsMutation,
} from '../../dev-runtime/groups-config-panel/groups-config-panel-mutations'

function buildGroups(): RuntimeGroupsConfig {
  return {
    card: { params: ['title'], template: [{ type: 'heading', props: { text: '{{group.title}}', level: 2 } }] },
    banner: { params: [], template: [] },
  }
}

function buildConfig(groups: RuntimeGroupsConfig = buildGroups()): RuntimeConfig {
  return {
    api: { loadUsers: { method: 'GET', url: '/users' } },
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
    tokens: { authToken: { value: 'secret' } },
    groups,
  } as RuntimeConfig
}

describe('applyGroupsMutation', () => {
  it('add-group inserts a new entry with empty params and template', () => {
    const groups = buildGroups()
    const mutation: GroupsMutation = { kind: 'add-group', groupId: 'panel' }

    const next = applyGroupsMutation(groups, mutation)

    expect(next.panel).toEqual({ params: [], template: [] })
    expect(next.card).toBe(groups.card)
    expect(next.banner).toBe(groups.banner)
  })

  it('rename-group moves the whole group object (params and template survive) under the new id', () => {
    const groups = buildGroups()
    const mutation: GroupsMutation = { kind: 'rename-group', from: 'card', to: 'product-card' }

    const next = applyGroupsMutation(groups, mutation)

    expect(next.card).toBeUndefined()
    expect(next['product-card']).toEqual(groups.card)
    expect(next.banner).toBe(groups.banner)
  })

  it('rename-group is a no-op when "from" does not exist', () => {
    const groups = buildGroups()
    const next = applyGroupsMutation(groups, { kind: 'rename-group', from: 'missing', to: 'renamed' })

    expect(next).toEqual(groups)
  })

  it('remove-group drops only the targeted entry', () => {
    const groups = buildGroups()
    const next = applyGroupsMutation(groups, { kind: 'remove-group', groupId: 'card' })

    expect(next.card).toBeUndefined()
    expect(next.banner).toBe(groups.banner)
    expect(Object.keys(next)).toEqual(['banner'])
  })

  it('add-param appends a new param name to the targeted group only', () => {
    const groups = buildGroups()
    const next = applyGroupsMutation(groups, { kind: 'add-param', groupId: 'card', paramName: 'subtitle' })

    expect(next.card.params).toEqual(['title', 'subtitle'])
    expect(next.card.template).toBe(groups.card.template)
    expect(next.banner).toBe(groups.banner)
  })

  it('add-param does not duplicate an already-declared param name', () => {
    const groups = buildGroups()
    const next = applyGroupsMutation(groups, { kind: 'add-param', groupId: 'card', paramName: 'title' })

    expect(next).toEqual(groups)
  })

  it('remove-param drops only the targeted param name, keeping the rest', () => {
    const groups: RuntimeGroupsConfig = {
      card: { params: ['title', 'subtitle'], template: [] },
    }
    const next = applyGroupsMutation(groups, { kind: 'remove-param', groupId: 'card', paramName: 'title' })

    expect(next.card.params).toEqual(['subtitle'])
  })

  it('add-param/remove-param on an unknown groupId is a no-op', () => {
    const groups = buildGroups()

    expect(applyGroupsMutation(groups, { kind: 'add-param', groupId: 'missing', paramName: 'x' })).toEqual(groups)
    expect(applyGroupsMutation(groups, { kind: 'remove-param', groupId: 'missing', paramName: 'x' })).toEqual(groups)
  })
})

describe('commitGroupsMutation', () => {
  it('produces the correct patch over config.groups and only over it (does not touch pages/api/tokens)', () => {
    const config = buildConfig()
    const mutation: GroupsMutation = { kind: 'add-group', groupId: 'panel' }

    const precheck = commitGroupsMutation(config, mutation)
    expect(precheck.status).toBe('applied')

    const nextGroups = applyGroupsMutation(config.groups ?? {}, mutation)
    const nextConfig: RuntimeConfig = { ...config, groups: nextGroups }

    expect(nextConfig.groups?.panel).toEqual({ params: [], template: [] })
    expect(nextConfig.pages).toBe(config.pages)
    expect(nextConfig.api).toBe(config.api)
    expect(nextConfig.tokens).toBe(config.tokens)
  })

  it('rejects a rename-group commit when the new id already exists', () => {
    const config = buildConfig()

    const result = commitGroupsMutation(config, { kind: 'rename-group', from: 'card', to: 'banner' })

    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.error.code).toBeTruthy()
      expect(result.error.message).toMatch(/banner/)
    }
  })

  it('applies a rename-group commit when the new id does not collide with an existing one', () => {
    const config = buildConfig()

    const result = commitGroupsMutation(config, { kind: 'rename-group', from: 'card', to: 'product-card' })

    expect(result.status).toBe('applied')
  })

  it('renaming a group onto its own current id is not treated as a collision', () => {
    const config = buildConfig()

    const result = commitGroupsMutation(config, { kind: 'rename-group', from: 'card', to: 'card' })

    expect(result.status).toBe('applied')
  })

  it('add-group/remove-group/add-param/remove-param never reject at this pure business-rule level', () => {
    const config = buildConfig()

    expect(commitGroupsMutation(config, { kind: 'add-group', groupId: 'panel' }).status).toBe('applied')
    expect(commitGroupsMutation(config, { kind: 'remove-group', groupId: 'card' }).status).toBe('applied')
    expect(commitGroupsMutation(config, { kind: 'add-param', groupId: 'card', paramName: 'subtitle' }).status).toBe(
      'applied',
    )
    expect(commitGroupsMutation(config, { kind: 'remove-param', groupId: 'card', paramName: 'title' }).status).toBe(
      'applied',
    )
  })
})
