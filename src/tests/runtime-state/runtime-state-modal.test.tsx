import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import { selectActiveModal, isModalOpen } from '../../runtime/runtime-state/runtime-state-selectors'
import type { RuntimeIterationContext } from '../../runtime/runtime-references/runtime-reference-resolver'

const testConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }, { id: 'details', layout: [] }],
}

describe('modal reducer and selectors', () => {
  it('initial state has no active modal', () => {
    const state = createRuntimeState(testConfig)
    expect(selectActiveModal(state)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('modal/open sets the active modal', () => {
    const state = createRuntimeState(testConfig)
    const next = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    expect(selectActiveModal(next)).toEqual({ activeModalId: 'dialog', activeIterationKey: null })
  })

  it('modal/open with iterationKey sets both fields', () => {
    const state = createRuntimeState(testConfig)
    const next = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog', iterationKey: 'row-1' } })
    expect(selectActiveModal(next)).toEqual({ activeModalId: 'dialog', activeIterationKey: 'row-1' })
  })

  it('modal/open closes the previously active modal before opening the new one', () => {
    const state = createRuntimeState(testConfig)
    const withA = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'modal-a' } })
    const withB = runtimeStateReducer(withA, { type: 'modal/open', payload: { modalId: 'modal-b' } })
    expect(selectActiveModal(withB)).toEqual({ activeModalId: 'modal-b', activeIterationKey: null })
    expect(isModalOpen(withB, 'modal-a')).toBe(false)
    expect(isModalOpen(withB, 'modal-b')).toBe(true)
  })

  it('modal/close with the active modalId closes it', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    const closed = runtimeStateReducer(opened, { type: 'modal/close', payload: { modalId: 'dialog' } })
    expect(selectActiveModal(closed)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('modal/close with a different modalId does not mutate state', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    const unchanged = runtimeStateReducer(opened, { type: 'modal/close', payload: { modalId: 'other' } })
    expect(unchanged).toBe(opened)
    expect(selectActiveModal(unchanged)).toEqual({ activeModalId: 'dialog', activeIterationKey: null })
  })

  it('modal/close with matching modalId but different iterationKey does not mutate state', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog', iterationKey: 'row-1' } })
    const unchanged = runtimeStateReducer(opened, { type: 'modal/close', payload: { modalId: 'dialog', iterationKey: 'row-2' } })
    expect(unchanged).toBe(opened)
  })

  it('modal/close-all clears the modal state regardless of which modal is active', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog', iterationKey: 'row-1' } })
    const cleared = runtimeStateReducer(opened, { type: 'modal/close-all' })
    expect(selectActiveModal(cleared)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('navigation/navigate clears the active modal', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    const navigated = runtimeStateReducer(opened, { type: 'navigation/navigate', payload: { pageId: 'details' } })
    expect(selectActiveModal(navigated)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('navigation/sync-from-browser clears the active modal', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    const synced = runtimeStateReducer(opened, { type: 'navigation/sync-from-browser', payload: { pageId: 'details' } })
    expect(selectActiveModal(synced)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('page-entry/set-idle clears the active modal', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    const next = runtimeStateReducer(opened, {
      type: 'page-entry/set-idle',
      payload: { entryId: 1, pageId: 'home', params: {}, preloadNames: [] },
    })
    expect(selectActiveModal(next)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('page-entry/start-preload-batch clears the active modal', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    const next = runtimeStateReducer(opened, {
      type: 'page-entry/start-preload-batch',
      payload: { entryId: 1, pageId: 'home', params: {}, preloadNames: [] },
    })
    expect(selectActiveModal(next)).toEqual({ activeModalId: null, activeIterationKey: null })
  })

  it('isModalOpen returns true for the active modal and false for others', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'dialog' } })
    expect(isModalOpen(opened, 'dialog')).toBe(true)
    expect(isModalOpen(opened, 'other')).toBe(false)
  })

  it('isModalOpen distinguishes instances by iterationKey for the same modalId', () => {
    const state = createRuntimeState(testConfig)
    const opened = runtimeStateReducer(state, { type: 'modal/open', payload: { modalId: 'card', iterationKey: 'i1' } })
    expect(isModalOpen(opened, 'card', 'i1')).toBe(true)
    expect(isModalOpen(opened, 'card', 'i2')).toBe(false)
    expect(isModalOpen(opened, 'card')).toBe(false)
  })
})

describe('RuntimeIterationContext includes key', () => {
  it('allows creating a context with both item and key', () => {
    const ctx: RuntimeIterationContext = { item: { id: 1, name: 'Ada' }, key: 'row-1' }
    expect(ctx.key).toBe('row-1')
    expect(ctx.item).toEqual({ id: 1, name: 'Ada' })
  })
})
