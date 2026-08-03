import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  isShellPathCollapsed,
  toggleShellCollapse,
  remapShellCollapseState,
  useShellCollapseState,
  type ShellCollapseState,
} from '../../dev-runtime/shell-config-panel/shell-collapse-state'

describe('isShellPathCollapsed', () => {
  it('returns true for an empty map (collapsed by default)', () => {
    const state: ShellCollapseState = new Map()
    expect(isShellPathCollapsed(state, '0')).toBe(true)
  })

  it('returns true for a path with no entry', () => {
    const state: ShellCollapseState = new Map([['1', false]])
    expect(isShellPathCollapsed(state, '0')).toBe(true)
  })

  it('returns true when the entry exists and is explicitly true', () => {
    const state: ShellCollapseState = new Map([['0', true]])
    expect(isShellPathCollapsed(state, '0')).toBe(true)
  })

  it('returns false only when the entry exists and is explicitly false', () => {
    const state: ShellCollapseState = new Map([['0', false]])
    expect(isShellPathCollapsed(state, '0')).toBe(false)
  })
})

describe('toggleShellCollapse', () => {
  it('inverts from collapsed (no entry) to expanded', () => {
    const state: ShellCollapseState = new Map()
    const next = toggleShellCollapse(state, '0')
    expect(isShellPathCollapsed(next, '0')).toBe(false)
  })

  it('inverts from expanded (explicit false) to collapsed', () => {
    const state: ShellCollapseState = new Map([['0', false]])
    const next = toggleShellCollapse(state, '0')
    expect(isShellPathCollapsed(next, '0')).toBe(true)
  })

  it('does not mutate the map received', () => {
    const state: ShellCollapseState = new Map([['0', false]])
    const next = toggleShellCollapse(state, '0')
    expect(next).not.toBe(state)
    expect(state.get('0')).toBe(false)
  })

  it('two consecutive calls on different paths do not interfere', () => {
    const first = toggleShellCollapse(new Map(), '0')
    const second = toggleShellCollapse(first, '1')
    expect(isShellPathCollapsed(second, '0')).toBe(false)
    expect(isShellPathCollapsed(second, '1')).toBe(false)
  })
})

describe('remapShellCollapseState', () => {
  it('rewrites a key present in pathRemap, preserving its collapse boolean', () => {
    const state: ShellCollapseState = new Map([['0', true]])
    const pathRemap = new Map([['0', '1']])
    const next = remapShellCollapseState(state, pathRemap)
    expect(next.get('1')).toBe(true)
    expect(next.has('0')).toBe(false)
  })

  it('leaves a key absent from pathRemap unchanged', () => {
    const state: ShellCollapseState = new Map([['0', true]])
    const pathRemap = new Map([['1', '2']])
    const next = remapShellCollapseState(state, pathRemap)
    expect(next.get('0')).toBe(true)
  })

  it('rewrites several keys at once (moved subtree with descendants in different collapse states)', () => {
    const state: ShellCollapseState = new Map([
      ['0', true],
      ['0.0', false],
      ['0.1', true],
    ])
    const pathRemap = new Map([
      ['0', '1'],
      ['0.0', '1.0'],
      ['0.1', '1.1'],
    ])
    const next = remapShellCollapseState(state, pathRemap)
    expect(next.size).toBe(3)
    expect(next.get('1')).toBe(true)
    expect(next.get('1.0')).toBe(false)
    expect(next.get('1.1')).toBe(true)
    expect(next.has('0')).toBe(false)
    expect(next.has('0.0')).toBe(false)
    expect(next.has('0.1')).toBe(false)
  })

  it('does not mutate the state received', () => {
    const state: ShellCollapseState = new Map([['0', true]])
    const pathRemap = new Map([['0', '1']])
    const next = remapShellCollapseState(state, pathRemap)
    expect(next).not.toBe(state)
    expect(state.has('0')).toBe(true)
  })
})

describe('useShellCollapseState', () => {
  it('starts with isCollapsed true for any path (collapsed by default)', () => {
    const { result } = renderHook(() => useShellCollapseState())
    expect(result.current.isCollapsed('0')).toBe(true)
    expect(result.current.isCollapsed('0.1')).toBe(true)
  })

  it('toggleCollapse makes isCollapsed false after a re-render, and a second call reverts it', () => {
    const { result } = renderHook(() => useShellCollapseState())

    act(() => {
      result.current.toggleCollapse('0')
    })
    expect(result.current.isCollapsed('0')).toBe(false)

    act(() => {
      result.current.toggleCollapse('0')
    })
    expect(result.current.isCollapsed('0')).toBe(true)
  })

  it('applyPathRemap rewrites collapsed keys and leaves unaffected paths intact', () => {
    const { result } = renderHook(() => useShellCollapseState())

    act(() => {
      result.current.toggleCollapse('0.0')
    })
    act(() => {
      result.current.toggleCollapse('1')
    })

    act(() => {
      result.current.applyPathRemap(new Map([['0.0', '2.0']]))
    })

    // The expanded entry at '0.0' moved to '2.0' along with its explicit boolean.
    expect(result.current.isCollapsed('2.0')).toBe(false)
    // '0.0' itself no longer has an entry, so it reads as collapsed again (the default).
    expect(result.current.isCollapsed('0.0')).toBe(true)
    // '1' was untouched by the remap, so its own toggle survives unchanged.
    expect(result.current.isCollapsed('1')).toBe(false)
  })
})
