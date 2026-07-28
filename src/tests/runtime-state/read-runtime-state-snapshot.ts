import { screen } from '@testing-library/react'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

export function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}
