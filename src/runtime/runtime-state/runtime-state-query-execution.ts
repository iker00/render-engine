import type { Dispatch } from 'react'
import type { RuntimeApiBodyValue, RuntimeApiOperation, RuntimeApiRequestParams, RuntimeConfig } from '../../config/runtime-config'
import {
  buildInlineRuntimeApiRequest,
  buildRuntimeApiRequest,
  executeBuiltRuntimeApiRequest,
  hasEncodableFileInputSources,
  resolveFileInputSourcesOverrides,
} from '../../queries/runtime-api-executor'
import type {
  RuntimeApiEmptySubmitValues,
  RuntimeApiFileInputSources,
  RuntimeApiHiddenFormFields,
} from '../../queries/runtime-api-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import type { RuntimeQueryError, RuntimeState, RuntimeStateAction } from './runtime-state-types'

// Shared by `RuntimeStateProvider` (its own preload-refresh pass) and `useRuntimeStateActions`
// (`executeQueryOperation`/`executeInlineQueryOperation`) — kept in its own module so neither
// file needs to import the other just for these two helpers.

export async function executeInlineQueryOperationWithSnapshot({
  operation,
  dispatch,
  slotName,
  snapshotState,
  requestParams,
  iterationContext,
  fetchImplementation,
}: {
  operation: RuntimeApiOperation
  dispatch: Dispatch<RuntimeStateAction>
  slotName: string
  snapshotState: RuntimeState
  requestParams?: RuntimeApiRequestParams
  iterationContext?: RuntimeIterationContext
  fetchImplementation?: typeof fetch
}) {
  const requestResult = buildInlineRuntimeApiRequest({
    operation,
    operationName: slotName,
    state: snapshotState,
    requestParams,
    iterationContext,
  })

  if (requestResult.status === 'error') {
    dispatch({
      type: 'queries/set-error',
      payload: {
        queryName: slotName,
        error: requestResult.error satisfies RuntimeQueryError,
        requestSignature: null,
      },
    })

    return requestResult
  }

  dispatch({
    type: 'queries/set-loading',
    payload: {
      queryName: slotName,
      requestSignature: requestResult.request.requestSignature,
    },
  })

  const result = await executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })

  if (result.status === 'success') {
    dispatch({
      type: 'queries/set-success',
      payload: {
        queryName: slotName,
        data: result.data,
        requestSignature: requestResult.request.requestSignature,
      },
    })

    return result
  }

  dispatch({
    type: 'queries/set-error',
    payload: {
      queryName: slotName,
      error: result.error satisfies RuntimeQueryError,
      requestSignature: requestResult.request.requestSignature,
    },
  })

  return result
}

export async function executeQueryOperationWithSnapshot({
  config,
  dispatch,
  operationName,
  snapshotState,
  requestParams,
  iterationContext,
  hiddenFormFields,
  emptySubmitValues,
  fileInputSources,
  fetchImplementation,
  skipLoadingDispatch = false,
}: {
  config: RuntimeConfig
  dispatch: Dispatch<RuntimeStateAction>
  operationName: string
  snapshotState: RuntimeState
  requestParams?: RuntimeApiRequestParams
  iterationContext?: RuntimeIterationContext
  hiddenFormFields?: RuntimeApiHiddenFormFields
  emptySubmitValues?: RuntimeApiEmptySubmitValues
  fileInputSources?: RuntimeApiFileInputSources
  fetchImplementation?: typeof fetch
  skipLoadingDispatch?: boolean
}) {
  // Only await the encoding preflight when there are files to encode: awaiting
  // an async function always defers to a microtask even if it resolves
  // immediately, which would otherwise push the `queries/set-loading` dispatch
  // below one tick later than today for every operation, not just uploads.
  let fileValueOverrides: ReadonlyMap<string, RuntimeApiBodyValue[]> | undefined

  if (hasEncodableFileInputSources(fileInputSources)) {
    const overridesResult = await resolveFileInputSourcesOverrides(fileInputSources)

    if (overridesResult.status === 'error') {
      dispatch({
        type: 'queries/set-error',
        payload: {
          queryName: operationName,
          error: overridesResult.error satisfies RuntimeQueryError,
          requestSignature: null,
        },
      })

      return overridesResult
    }

    fileValueOverrides = overridesResult.fileValueOverrides
  }

  const requestResult = buildRuntimeApiRequest({
    config,
    operationName,
    state: snapshotState,
    requestParams,
    iterationContext,
    hiddenFormFields,
    emptySubmitValues,
    fileValueOverrides,
  })

  if (requestResult.status === 'error') {
    dispatch({
      type: 'queries/set-error',
      payload: {
        queryName: operationName,
        error: requestResult.error satisfies RuntimeQueryError,
        requestSignature: null,
      },
    })

    return requestResult
  }

  if (!skipLoadingDispatch) {
    dispatch({
      type: 'queries/set-loading',
      payload: {
        queryName: operationName,
        requestSignature: requestResult.request.requestSignature,
      },
    })
  }

  const result = await executeBuiltRuntimeApiRequest({
    request: requestResult.request,
    fetch: fetchImplementation,
  })

  if (result.status === 'success') {
    dispatch({
      type: 'queries/set-success',
      payload: {
        queryName: operationName,
        data: result.data,
        requestSignature: requestResult.request.requestSignature,
      },
    })

    return result
  }

  dispatch({
    type: 'queries/set-error',
    payload: {
      queryName: operationName,
      error: result.error satisfies RuntimeQueryError,
      requestSignature: requestResult.request.requestSignature,
    },
  })

  return result
}
