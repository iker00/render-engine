import { describe, it, expect } from 'vitest'
import { shouldMountDevRuntime } from '../../app/bootstrap/should-mount-dev-runtime'

describe('shouldMountDevRuntime', () => {
  it('returns true when isDev is true and rootElement does not have the attribute', () => {
    const root = document.createElement('div')
    expect(shouldMountDevRuntime(root, true)).toBe(true)
  })

  it('returns true when isDev is true and rootElement has the attribute (DEV flag takes precedence)', () => {
    const root = document.createElement('div')
    root.setAttribute('data-enable-dev-mode', '')
    expect(shouldMountDevRuntime(root, true)).toBe(true)
  })

  it('returns true when isDev is false and rootElement has data-enable-dev-mode with empty value', () => {
    const root = document.createElement('div')
    root.setAttribute('data-enable-dev-mode', '')
    expect(shouldMountDevRuntime(root, false)).toBe(true)
  })

  it('returns true when isDev is false and rootElement has data-enable-dev-mode with arbitrary string value "true"', () => {
    const root = document.createElement('div')
    root.setAttribute('data-enable-dev-mode', 'true')
    expect(shouldMountDevRuntime(root, false)).toBe(true)
  })

  it('returns true when isDev is false and rootElement has data-enable-dev-mode with arbitrary string value "false"', () => {
    const root = document.createElement('div')
    root.setAttribute('data-enable-dev-mode', 'false')
    expect(shouldMountDevRuntime(root, false)).toBe(true)
  })

  it('returns true when isDev is false and rootElement has data-enable-dev-mode with arbitrary string value "1"', () => {
    const root = document.createElement('div')
    root.setAttribute('data-enable-dev-mode', '1')
    expect(shouldMountDevRuntime(root, false)).toBe(true)
  })

  it('returns true when isDev is false and rootElement has data-enable-dev-mode with arbitrary string value "yes"', () => {
    const root = document.createElement('div')
    root.setAttribute('data-enable-dev-mode', 'yes')
    expect(shouldMountDevRuntime(root, false)).toBe(true)
  })

  it('returns false when isDev is false and rootElement does not have the attribute', () => {
    const root = document.createElement('div')
    expect(shouldMountDevRuntime(root, false)).toBe(false)
  })

  it('returns false when rootElement is null and isDev is false', () => {
    expect(shouldMountDevRuntime(null, false)).toBe(false)
  })

  it('returns false when rootElement is null and isDev is true', () => {
    expect(shouldMountDevRuntime(null, true)).toBe(false)
  })
})
