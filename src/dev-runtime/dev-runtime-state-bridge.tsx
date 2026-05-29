import { forwardRef, useContext, useImperativeHandle } from 'react'
import { RuntimeStateContext } from '../runtime/runtime-state/runtime-state-context'
import type { RuntimeState, RuntimeStateAction } from '../runtime/runtime-state/runtime-state-types'

export interface DevRuntimeStateBridgeHandle {
  getLatestState: () => RuntimeState
  dispatchAndSyncState: (action: RuntimeStateAction) => void
}

export const DevRuntimeStateBridge = forwardRef<DevRuntimeStateBridgeHandle>((_, ref) => {
  const context = useContext(RuntimeStateContext)

  if (context === null) {
    throw new Error('DevRuntimeStateBridge must be mounted inside a RuntimeStateProvider.')
  }

  useImperativeHandle(ref, () => ({
    getLatestState: context.getLatestState,
    dispatchAndSyncState: context.dispatchAndSyncState,
  }))

  return null
})

DevRuntimeStateBridge.displayName = 'DevRuntimeStateBridge'
