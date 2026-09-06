import { describe, expect, it } from 'vitest'
import { runtimeConfigRootSchema } from '../../config/runtime-config-root-zod'
import { groupInstanceNodeSchema, slotNodeSchema, supportedNodeTypes } from '../../config/runtime-config-zod'
import { createConfigWithApi, createConfigWithLayout } from './helpers'

function createConfigWithGroups(groups: unknown) {
  return {
    ...createConfigWithApi({}),
    groups,
  }
}

describe('runtimeConfigRootSchema — root groups block shape', () => {
  it('accepts a config without a groups block (regression)', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithApi({}))
    expect(result.success).toBe(true)
  })

  it('accepts groups: {}', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithGroups({}))
    expect(result.success).toBe(true)
  })

  it('accepts a group with params and an empty template', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createConfigWithGroups({ card: { params: ['title'], template: [] } }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects groups when it is not a plain object (array)', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithGroups([]))
    expect(result.success).toBe(false)
  })

  it('rejects groups when it is not a plain object (string)', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithGroups('oops'))
    expect(result.success).toBe(false)
  })

  it('rejects a groupId that is an empty string', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithGroups({ '': { params: [], template: [] } }))
    expect(result.success).toBe(false)
  })

  it('rejects a param that is an empty string with a canonical path', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithGroups({ card: { params: [''], template: [] } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['groups', 'card', 'params', 0])
    }
  })

  it('rejects a param that is not a string with a canonical path', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithGroups({ card: { params: [42], template: [] } }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['groups', 'card', 'params', 0])
    }
  })

  it('rejects duplicated params within the same group with a canonical path', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createConfigWithGroups({ card: { params: ['title', 'title'], template: [] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['groups', 'card', 'params', 1])
    }
  })

  it('rejects template when it is not an array with a canonical path', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createConfigWithGroups({ card: { params: [], template: 'not-an-array' } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['groups', 'card', 'template'])
    }
  })
})

describe('groupInstanceNodeSchema — group node shape', () => {
  it("has 'group' present in supportedNodeTypes", () => {
    expect(supportedNodeTypes).toContain('group')
  })

  it('accepts a minimal group node with groupId and params (structural shape only)', () => {
    const result = groupInstanceNodeSchema.safeParse({
      type: 'group',
      props: { groupId: 'x', params: { title: 'y' } },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a group node embedded in the root layout (regression at config level)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createConfigWithLayout([{ type: 'group', props: { groupId: 'x', params: { title: 'y' } } }]),
    )
    expect(result.success).toBe(true)
  })
})

describe('slotNodeSchema — slot node shape', () => {
  it("has 'slot' present in supportedNodeTypes", () => {
    expect(supportedNodeTypes).toContain('slot')
  })

  it('accepts a minimal slot node in isolation (context restriction is out of scope here)', () => {
    const result = slotNodeSchema.safeParse({ type: 'slot' })
    expect(result.success).toBe(true)
  })

  it('accepts a slot node embedded in the root layout (regression at config level)', () => {
    const result = runtimeConfigRootSchema.safeParse(createConfigWithLayout([{ type: 'slot' }]))
    expect(result.success).toBe(true)
  })
})
