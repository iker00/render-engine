import type { RuntimeConfig } from '../../../config/runtime-config'
import { createCollectionPaginationModel } from '../../runtime-collection-pagination'
import {
  getRepeaterPaginationButtonClassName,
  getRepeaterPaginationControlsClassName,
} from '../../runtime-node-styling'
import type { RuntimeState } from '../../runtime-state/runtime-state-types'
import { FileManagerRow } from './file-manager-row'

interface FileManagerListProps {
  fileList: Record<string, unknown>[]
  fileIdField: string
  fileNameField: string
  viewOperation: string | false | undefined
  downloadOperation: string | false | undefined
  deleteOperation: string | false | undefined
  fieldName: string | undefined
  deletingFileId: string | number | null
  pageSize: number
  currentPage: number
  getOperationStatus: string | null
  config: RuntimeConfig
  state: RuntimeState
  onDelete: (file: Record<string, unknown>) => void
  onNextPage: () => void
  onPreviousPage: () => void
}

export function FileManagerList({
  fileList,
  fileIdField,
  fileNameField,
  viewOperation,
  downloadOperation,
  deleteOperation,
  fieldName,
  deletingFileId,
  pageSize,
  currentPage,
  getOperationStatus,
  config,
  state,
  onDelete,
  onNextPage,
  onPreviousPage,
}: FileManagerListProps) {
  const pagination = createCollectionPaginationModel(fileList, pageSize)
  const page = pagination.getPage(currentPage)

  if (getOperationStatus === 'error') {
    return (
      <div className="mt-4">
        <p className="text-sm text-red-600">Error al cargar los ficheros.</p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      {page.totalItems === 0 ? (
        <p className="text-sm text-gray-500">No hay ficheros subidos.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-200">
            {page.visibleItems.map((file) => (
              <FileManagerRow
                key={String(file[fileIdField])}
                file={file}
                fileIdField={fileIdField}
                fileNameField={fileNameField}
                viewOperation={viewOperation}
                downloadOperation={downloadOperation}
                deleteOperation={deleteOperation}
                fieldName={fieldName}
                deletingFileId={deletingFileId}
                config={config}
                state={state}
                onDelete={onDelete}
              />
            ))}
          </div>

          {page.totalPages > 1 && (
            <div className={getRepeaterPaginationControlsClassName()} data-layout-node="repeater-pagination">
              <button
                type="button"
                className={getRepeaterPaginationButtonClassName()}
                disabled={!page.canGoPrevious}
                onClick={onPreviousPage}
              >
                Anterior
              </button>
              <button
                type="button"
                className={getRepeaterPaginationButtonClassName()}
                disabled={!page.canGoNext}
                onClick={onNextPage}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
