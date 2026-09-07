import { describe, expect, it } from 'vitest'
import {
  buildCommitCandidateConfigForTarget,
  layoutCanvasTargetExists,
  patchRawConfigTextForTarget,
  resolveLayoutForTarget,
  type LayoutCanvasTarget,
} from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'

function heading(text: string): LayoutNode {
  return { type: 'heading', props: { text, level: 2 } }
}

function makeConfig(): RuntimeConfig {
  return {
    api: { doThing: { method: 'POST', endpoint: '/thing' } },
    pages: [
      { id: 'home', layout: [heading('Home')] },
      { id: 'about', layout: [heading('About')] },
    ],
    initialPage: 'home',
    groups: {
      card: { params: ['title'], template: [heading('Card template')] },
      banner: { params: [], template: [heading('Banner template')] },
    },
  } as RuntimeConfig
}

const pageTarget: LayoutCanvasTarget = { kind: 'page-layout', pageId: 'home' }
const missingPageTarget: LayoutCanvasTarget = { kind: 'page-layout', pageId: 'missing' }
const groupTarget: LayoutCanvasTarget = { kind: 'group-template', groupId: 'card' }
const missingGroupTarget: LayoutCanvasTarget = { kind: 'group-template', groupId: 'missing' }

describe('resolveLayoutForTarget', () => {
  it('returns the layout of the targeted page for a page-layout target', () => {
    expect(resolveLayoutForTarget(makeConfig(), pageTarget)).toEqual([heading('Home')])
  })

  it('returns the template of the targeted group for a group-template target', () => {
    expect(resolveLayoutForTarget(makeConfig(), groupTarget)).toEqual([heading('Card template')])
  })

  it('returns [] without throwing for a pageId that does not exist in the config', () => {
    expect(resolveLayoutForTarget(makeConfig(), missingPageTarget)).toEqual([])
  })

  it('returns [] without throwing for a groupId that does not exist in the config', () => {
    expect(resolveLayoutForTarget(makeConfig(), missingGroupTarget)).toEqual([])
  })

  it('returns [] without throwing for a group-template target when the config has no groups block at all', () => {
    const configWithoutGroups: RuntimeConfig = { api: {}, pages: [{ id: 'home', layout: [] }], initialPage: 'home' }
    expect(resolveLayoutForTarget(configWithoutGroups, groupTarget)).toEqual([])
  })
})

describe('layoutCanvasTargetExists', () => {
  it('is true for an existing page and false for a missing page', () => {
    expect(layoutCanvasTargetExists(makeConfig(), pageTarget)).toBe(true)
    expect(layoutCanvasTargetExists(makeConfig(), missingPageTarget)).toBe(false)
  })

  it('is true for an existing group and false for a missing group', () => {
    expect(layoutCanvasTargetExists(makeConfig(), groupTarget)).toBe(true)
    expect(layoutCanvasTargetExists(makeConfig(), missingGroupTarget)).toBe(false)
  })

  it('is false for a group-template target when the config has no groups block at all', () => {
    const configWithoutGroups: RuntimeConfig = { api: {}, pages: [{ id: 'home', layout: [] }], initialPage: 'home' }
    expect(layoutCanvasTargetExists(configWithoutGroups, groupTarget)).toBe(false)
  })
})

describe('buildCommitCandidateConfigForTarget', () => {
  it('replaces only the layout of the targeted page for a page-layout target, matching buildCommitCandidateConfig', () => {
    const original = makeConfig()
    const result = buildCommitCandidateConfigForTarget(original, pageTarget, () => [heading('Updated Home')])

    expect(result.pages.find((page) => page.id === 'home')?.layout).toEqual([heading('Updated Home')])
    expect(result.pages.find((page) => page.id === 'about')).toBe(original.pages.find((page) => page.id === 'about'))
    expect(result.groups).toBe(original.groups)
  })

  it('replaces only the template of the targeted group for a group-template target, without touching any other branch', () => {
    const original = makeConfig()
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = buildCommitCandidateConfigForTarget(original, groupTarget, () => [heading('Updated card')])

    expect(original).toEqual(snapshot)
    expect(result).not.toBe(original)
    expect(result.groups?.card).toEqual({ params: ['title'], template: [heading('Updated card')] })
    expect(result.groups?.banner).toBe(original.groups?.banner)
    expect(result.pages).toBe(original.pages)
    expect(result.api).toBe(original.api)
    expect(result.initialPage).toBe(original.initialPage)
  })

  it('returns the config unchanged (no-op) for a group-template target whose groupId does not exist', () => {
    const original = makeConfig()
    const result = buildCommitCandidateConfigForTarget(original, missingGroupTarget, () => [heading('Should not apply')])

    expect(result).toBe(original)
  })
})

describe('patchRawConfigTextForTarget', () => {
  const rawConfig = {
    api: { loadUsers: { method: 'GET', endpoint: '/users' } },
    pages: [
      { id: 'home', preloads: [{ loadUsers: {} }], layout: [heading('Old page')] },
      { id: 'about', layout: [heading('About')] },
    ],
    initialPage: 'home',
    groups: {
      card: { params: ['title'], template: [heading('Old card')] },
      banner: { params: [], template: [heading('Old banner')] },
    },
  }
  const rawText = JSON.stringify(rawConfig, null, 2)

  it('patches pages[pageId].layout for a page-layout target, exactly as patchRawConfigTextWithLayout does, leaving groups untouched', () => {
    const nextText = patchRawConfigTextForTarget(rawText, pageTarget, [heading('New page')])
    const parsed = JSON.parse(nextText)

    expect(parsed.pages[0].layout).toEqual([{ type: 'heading', props: { text: 'New page', level: 2 } }])
    expect(parsed.pages[0].preloads).toEqual([{ loadUsers: {} }])
    expect(parsed.groups).toEqual(rawConfig.groups)
  })

  it('patches groups.card.template for a group-template target, without touching any other branch of the document', () => {
    const nextText = patchRawConfigTextForTarget(rawText, groupTarget, [heading('New card')])
    const parsed = JSON.parse(nextText)

    expect(parsed.groups.card).toEqual({
      params: ['title'],
      template: [{ type: 'heading', props: { text: 'New card', level: 2 } }],
    })
    expect(parsed.groups.banner).toEqual(rawConfig.groups.banner)
    expect(parsed.pages).toEqual(rawConfig.pages)
    expect(parsed.api).toEqual(rawConfig.api)
    expect(parsed.initialPage).toBe(rawConfig.initialPage)
  })
})
