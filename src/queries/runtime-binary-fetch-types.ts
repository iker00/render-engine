import type { ImageFetchConfig } from '../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime/runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'

export interface ExecuteRuntimeBinaryFetchOptions {
  fetchConfig: ImageFetchConfig
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
  fetch?: typeof fetch
}

export interface RuntimeBinaryFetchError {
  code: 'request-build-failed' | 'token-refresh-failed' | 'network-error' | 'http-error' | 'invalid-binary-response'
  message: string
}

export type RuntimeBinaryFetchResult =
  | { status: 'success'; blob: Blob }
  | { status: 'error'; error: RuntimeBinaryFetchError }
