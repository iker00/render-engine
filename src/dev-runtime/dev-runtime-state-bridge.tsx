import { useContext, useImperativeHandle } from 'react'
import type { Ref } from 'react'
import { RuntimeStateContext } from '../runtime/runtime-state/runtime-state-context'
import type { RuntimeState, RuntimeStateAction } from '../runtime/runtime-state/runtime-state-types'

export interface DevRuntimeStateBridgeHandle {
  getLatestState: () => RuntimeState
  dispatchAndSyncState: (action: RuntimeStateAction) => void
}

interface DevRuntimeStateBridgeProps {
  ref?: Ref<DevRuntimeStateBridgeHandle>
}

export function DevRuntimeStateBridge({ ref }: DevRuntimeStateBridgeProps) {
  const context = useContext(RuntimeStateContext)

  if (context === null) {
    throw new Error('DevRuntimeStateBridge must be mounted inside a RuntimeStateProvider.')
  }

  useImperativeHandle(ref, () => ({
    getLatestState: context.getLatestState,
    dispatchAndSyncState: context.dispatchAndSyncState,
  }))

  return null
}
