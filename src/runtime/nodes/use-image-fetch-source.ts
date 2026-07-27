import { useEffect, useState } from 'react'
import type { ImageFetchConfig } from '../../config/runtime-config-types'
import { executeRuntimeBinaryFetch } from '../../queries/runtime-binary-fetch'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/use-runtime-state'

interface ImageFetchSourceState {
  status: 'pending' | 'success' | 'error'
  src: string | null
}

export function useImageFetchSource(
  fetchConfig: ImageFetchConfig,
  iterationContext?: RuntimeIterationContext,
): ImageFetchSourceState {
  const state = useRuntimeState()
  const [fetchState, setFetchState] = useState<ImageFetchSourceState>({
    status: 'pending',
    src: null,
  })

  useEffect(() => {
    let isMounted = true
    let objectUrl: string | null = null

    void executeRuntimeBinaryFetch({ fetchConfig, state, iterationContext }).then((result) => {
      if (!isMounted) {
        return
      }

      if (result.status === 'success') {
        objectUrl = URL.createObjectURL(result.blob)
        setFetchState({ status: 'success', src: objectUrl })
      } else {
        setFetchState({ status: 'error', src: null })
      }
    })

    return () => {
      isMounted = false

      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return fetchState
}
