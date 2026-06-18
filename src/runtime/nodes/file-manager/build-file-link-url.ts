import type { RuntimeConfig } from '../../../config/runtime-config'
import { buildRuntimeApiRequest, buildInlineRuntimeApiRequest } from '../../../queries/runtime-api-executor'
import type { RuntimeState } from '../../runtime-state/runtime-state-types'
import { buildLegacyViewDownloadOperation } from './legacy-operations'

export type FileLinkUrlResult =
  | { status: 'ready'; url: string }
  | { status: 'error' }

/**
 * Builds the URL for a View or Download link for a file row.
 * In declarative mode: uses the named operation from config.api with fileIdField as query param.
 * In legacy mode (no operationName): uses the legacy /subirFicheros.aspx GET operation.
 */
export function buildFileLinkUrl({
  config,
  state,
  operationName,
  fieldName,
  fileId,
  fileIdField,
}: {
  config: RuntimeConfig
  state: RuntimeState
  operationName: string | undefined
  fieldName: string | undefined
  fileId: string | number
  fileIdField: string
}): FileLinkUrlResult {
  if (operationName) {
    const result = buildRuntimeApiRequest({
      config,
      operationName,
      state,
      requestParams: {
        query: { [fileIdField]: fileId },
      },
    })

    if (result.status === 'ready') {
      return { status: 'ready', url: result.request.url }
    }

    return { status: 'error' }
  }

  if (fieldName) {
    const legacyOp = buildLegacyViewDownloadOperation(fieldName)
    const result = buildInlineRuntimeApiRequest({
      operation: legacyOp,
      operationName: `__fileManager__:${fieldName}:view`,
      state,
      requestParams: {
        query: { [fileIdField]: fileId },
      },
    })

    if (result.status === 'ready') {
      return { status: 'ready', url: result.request.url }
    }

    return { status: 'error' }
  }

  return { status: 'error' }
}
