import { Download, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { RuntimeConfig } from '../../../config/runtime-config'
import type { FileManagerLabelKey } from '../../../config/runtime-config-types'
import {
  getFileManagerRowActionClassName,
  getFileManagerRowClassName,
  getFileManagerRowFileNameClassName,
} from '../../runtime-node-styling'
import type { RuntimeState } from '../../runtime-state/runtime-state-types'
import { buildFileLinkUrl } from './build-file-link-url'

interface FileManagerRowProps {
  file: Record<string, unknown>
  fileIdField: string
  fileNameField: string
  viewOperation: string | false | undefined
  downloadOperation: string | false | undefined
  deleteOperation: string | false | undefined
  fieldName: string | undefined
  deletingFileId: string | number | null
  config: RuntimeConfig
  state: RuntimeState
  resolvedLabels: Partial<Record<FileManagerLabelKey, string>>
  onDelete: (file: Record<string, unknown>) => void
}

export function FileManagerRow({
  file,
  fileIdField,
  fileNameField,
  viewOperation,
  downloadOperation,
  deleteOperation,
  fieldName,
  deletingFileId,
  config,
  state,
  resolvedLabels,
  onDelete,
}: FileManagerRowProps) {
  const fileId = file[fileIdField] as string | number
  const fileName = String(file[fileNameField] ?? '')
  const isDeleting = deletingFileId === fileId

  const viewOperationName = typeof viewOperation === 'string' ? viewOperation : undefined
  const downloadOperationName = typeof downloadOperation === 'string' ? downloadOperation : undefined

  const viewUrlResult =
    viewOperationName !== undefined || fieldName !== undefined
      ? buildFileLinkUrl({
          config,
          state,
          operationName: viewOperationName,
          fieldName: viewOperationName !== undefined ? undefined : fieldName,
          fileId,
          fileIdField,
        })
      : { status: 'error' as const }

  const downloadUrlResult =
    downloadOperationName !== undefined || fieldName !== undefined
      ? buildFileLinkUrl({
          config,
          state,
          operationName: downloadOperationName,
          fieldName: downloadOperationName !== undefined ? undefined : fieldName,
          fileId,
          fileIdField,
        })
      : { status: 'error' as const }

  const showView = viewOperation !== false
  const showDownload = downloadOperation !== false
  const showDelete = deleteOperation !== false

  return (
    <div data-file-manager-row className={getFileManagerRowClassName()}>
      <span className={getFileManagerRowFileNameClassName()}>{fileName}</span>
      <div className="flex items-center gap-2 ml-2 shrink-0">
        {showView && (
          viewUrlResult.status === 'ready' ? (
            <a
              href={viewUrlResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className={getFileManagerRowActionClassName('primary')}
              aria-label={resolvedLabels.rowViewAriaLabel}
            >
              <Eye size={14} />
              {resolvedLabels.rowViewLabel}
            </a>
          ) : (
            <span
              className={getFileManagerRowActionClassName('disabled')}
              aria-label={resolvedLabels.rowViewUnavailableAriaLabel}
            >
              <EyeOff size={14} />
              {resolvedLabels.rowViewLabel}
            </span>
          )
        )}

        {showDownload && (
          downloadUrlResult.status === 'ready' ? (
            <a
              href={downloadUrlResult.url}
              download
              className={getFileManagerRowActionClassName('primary')}
              aria-label={resolvedLabels.rowDownloadAriaLabel}
            >
              <Download size={14} />
              {resolvedLabels.rowDownloadLabel}
            </a>
          ) : (
            <span
              className={getFileManagerRowActionClassName('disabled')}
              aria-label={resolvedLabels.rowDownloadUnavailableAriaLabel}
            >
              <Download size={14} />
              {resolvedLabels.rowDownloadLabel}
            </span>
          )
        )}

        {showDelete && (
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onDelete(file)}
            aria-label={resolvedLabels.rowDeleteAriaLabel}
            className={getFileManagerRowActionClassName('danger')}
          >
            <Trash2 size={14} />
            {resolvedLabels.rowDeleteLabel}
          </button>
        )}
      </div>
    </div>
  )
}
