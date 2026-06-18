import { Download, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { RuntimeConfig } from '../../../config/runtime-config'
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
    <div data-file-manager-row className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
      <span className="text-sm text-gray-700 flex-1 truncate">{fileName}</span>
      <div className="flex items-center gap-2 ml-2 shrink-0">
        {showView && (
          viewUrlResult.status === 'ready' ? (
            <a
              href={viewUrlResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              aria-label="Ver fichero"
            >
              <Eye size={14} />
              Ver
            </a>
          ) : (
            <span className="flex items-center gap-1 text-sm text-gray-300" aria-label="Ver no disponible">
              <EyeOff size={14} />
              Ver
            </span>
          )
        )}

        {showDownload && (
          downloadUrlResult.status === 'ready' ? (
            <a
              href={downloadUrlResult.url}
              download
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              aria-label="Descargar fichero"
            >
              <Download size={14} />
              Descargar
            </a>
          ) : (
            <span className="flex items-center gap-1 text-sm text-gray-300" aria-label="Descargar no disponible">
              <Download size={14} />
              Descargar
            </span>
          )
        )}

        {showDelete && (
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onDelete(file)}
            aria-label="Eliminar fichero"
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
