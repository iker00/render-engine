import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDevRuntimeKeyboard } from '../../dev-runtime/dev-runtime-keyboard'

describe('useDevRuntimeKeyboard', () => {
  it('invokes onToggle on Ctrl+Shift+J', () => {
    const onToggle = vi.fn()
    renderHook(() => useDevRuntimeKeyboard({ isOpen: false, onToggle, onClose: vi.fn() }))

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true, bubbles: true }))
    })

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('invokes onToggle on Cmd+Shift+J (metaKey)', () => {
    const onToggle = vi.fn()
    renderHook(() => useDevRuntimeKeyboard({ isOpen: false, onToggle, onClose: vi.fn() }))

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', metaKey: true, shiftKey: true, bubbles: true }))
    })

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('invokes onClose on Escape only when drawer is open', () => {
    const onClose = vi.fn()
    renderHook(() => useDevRuntimeKeyboard({ isOpen: true, onToggle: vi.fn(), onClose }))

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onClose on Escape when drawer is closed', () => {
    const onClose = vi.fn()
    renderHook(() => useDevRuntimeKeyboard({ isOpen: false, onToggle: vi.fn(), onClose }))

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes listeners on unmount', () => {
    const onToggle = vi.fn()
    const { unmount } = renderHook(() =>
      useDevRuntimeKeyboard({ isOpen: false, onToggle, onClose: vi.fn() }),
    )

    unmount()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', ctrlKey: true, shiftKey: true, bubbles: true }))
    })

    expect(onToggle).not.toHaveBeenCalled()
  })
})
