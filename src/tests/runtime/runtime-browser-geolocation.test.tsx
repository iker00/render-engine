import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBrowserGeolocation } from '../../runtime/use-browser-geolocation'

type SuccessCallback = (position: { coords: { latitude: number; longitude: number } }) => void
type ErrorCallback = (error: { code: number }) => void

function stubGeolocation(getCurrentPosition: ReturnType<typeof vi.fn>) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'geolocation')
})

describe('useBrowserGeolocation', () => {
  it('exposes the position from coords on success and returns to status "idle"', () => {
    const getCurrentPosition = vi.fn((success: SuccessCallback) => {
      success({ coords: { latitude: 40.4168, longitude: -3.7038 } })
    })
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserGeolocation())

    act(() => {
      result.current.request()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.position).toEqual({ lat: 40.4168, lng: -3.7038 })
  })

  it('leaves status "error" and position null on PERMISSION_DENIED', () => {
    const getCurrentPosition = vi.fn((_success: SuccessCallback, error: ErrorCallback) => {
      error({ code: 1 })
    })
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserGeolocation())

    act(() => {
      result.current.request()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.position).toBeNull()
  })

  it.each([
    ['POSITION_UNAVAILABLE', 2],
    ['TIMEOUT', 3],
  ])('leaves the same status "error" on %s, without distinguishing the cause', (_name, code) => {
    const getCurrentPosition = vi.fn((_success: SuccessCallback, error: ErrorCallback) => {
      error({ code })
    })
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserGeolocation())

    act(() => {
      result.current.request()
    })

    expect(result.current.status).toBe('error')
  })

  it('leaves status "error" without throwing when navigator.geolocation is absent', () => {
    const { result } = renderHook(() => useBrowserGeolocation())

    expect(() => {
      act(() => {
        result.current.request()
      })
    }).not.toThrow()

    expect(result.current.status).toBe('error')
  })

  it('reflects status "requesting" while the request is pending', () => {
    let capturedSuccess: SuccessCallback | undefined
    const getCurrentPosition = vi.fn((success: SuccessCallback) => {
      capturedSuccess = success
    })
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserGeolocation())

    act(() => {
      result.current.request()
    })

    expect(result.current.status).toBe('requesting')

    act(() => {
      capturedSuccess?.({ coords: { latitude: 1, longitude: 2 } })
    })

    expect(result.current.status).toBe('idle')
  })

  it('calls getCurrentPosition with a finite timeout in its options, so the caller never stays blocked indefinitely', () => {
    const getCurrentPosition = vi.fn((success: SuccessCallback) => {
      success({ coords: { latitude: 1, longitude: 2 } })
    })
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserGeolocation())

    act(() => {
      result.current.request()
    })

    const options = getCurrentPosition.mock.calls[0]?.[2] as { timeout?: number } | undefined
    expect(Number.isFinite(options?.timeout)).toBe(true)
  })

  it('can retry and succeed after a previous request errored', () => {
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((_success: SuccessCallback, error: ErrorCallback) => {
        error({ code: 1 })
      })
      .mockImplementationOnce((success: SuccessCallback) => {
        success({ coords: { latitude: 5, longitude: 6 } })
      })
    stubGeolocation(getCurrentPosition)

    const { result } = renderHook(() => useBrowserGeolocation())

    act(() => {
      result.current.request()
    })
    expect(result.current.status).toBe('error')

    act(() => {
      result.current.request()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.position).toEqual({ lat: 5, lng: 6 })
  })
})
