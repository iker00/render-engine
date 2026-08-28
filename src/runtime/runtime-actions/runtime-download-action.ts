import type { DownloadOperationRuntimeUiAction } from '../../config/runtime-config-types'
import type { RuntimeReferenceSurface } from '../runtime-references/runtime-reference-diagnostics'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../runtime-state/runtime-state-types'
import type { RuntimeUiActionHandlers } from './runtime-ui-action-executor'

const CONTENT_DISPOSITION_FILENAME_PATTERN = /filename\s*=\s*(?:"([^"]*)"|([^;]*))/i
const FALLBACK_DOWNLOAD_FILENAME = 'download'

/**
 * Resolves the filename used to trigger a browser download, following the
 * priority fixed by the spec: `Content-Disposition` header first, then
 * `action.filename` resolved as a dynamic reference, then a generic fallback.
 * Pure function: no DOM or `fetch` access.
 */
export function resolveDownloadFilename(options: {
  contentDisposition: string | null
  actionFilename: string | undefined
  state: RuntimeState
  surface: RuntimeReferenceSurface
  iterationContext?: RuntimeIterationContext
}): string {
  const filenameFromHeader = extractContentDispositionFilename(options.contentDisposition)

  if (filenameFromHeader !== null) {
    return filenameFromHeader
  }

  if (options.actionFilename !== undefined) {
    const resolvedFilename = resolveRuntimeTextReference(options.actionFilename, options.state, options.surface, {
      iterationContext: options.iterationContext,
    })

    if (resolvedFilename.trim() !== '') {
      return resolvedFilename
    }
  }

  return FALLBACK_DOWNLOAD_FILENAME
}

function extractContentDispositionFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null
  }

  const match = CONTENT_DISPOSITION_FILENAME_PATTERN.exec(contentDisposition)

  if (!match) {
    return null
  }

  const rawValue = (match[1] ?? match[2] ?? '').trim()

  return rawValue === '' ? null : rawValue
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

/**
 * Runs a `downloadOperation` action: executes the operation via the injected
 * handler, resolves the resulting filename and triggers the actual browser
 * download. Does not orchestrate `onSuccess`/`onError`; the caller (a button
 * or link node) is responsible for feeding the returned status into
 * `runActionOutcomeWithLifecycle`.
 */
export async function runDownloadAction(
  action: DownloadOperationRuntimeUiAction,
  handlers: RuntimeUiActionHandlers,
  state: RuntimeState,
  surface: RuntimeReferenceSurface,
  iterationContext?: RuntimeIterationContext,
): Promise<{ status: 'success' } | { status: 'error' }> {
  const result = await handlers.executeDownloadOperation(action.operationName, {
    requestParams: {
      query: action.query,
      body: action.body,
      headers: action.headers,
    },
    iterationContext,
  })

  if (result.status !== 'success') {
    return { status: 'error' }
  }

  const filename = resolveDownloadFilename({
    contentDisposition: result.contentDisposition,
    actionFilename: action.filename,
    state,
    surface,
    iterationContext,
  })

  triggerBrowserDownload(result.blob, filename)

  return { status: 'success' }
}
