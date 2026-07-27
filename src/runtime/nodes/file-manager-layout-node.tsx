import { useReducer } from 'react'
import type { FileManagerLayoutNode } from '../../config/runtime-config'
import type { FileManagerLabelKey } from '../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeConfig, useRuntimeState } from '../runtime-state/runtime-state-provider'
import { fileManagerReducer, initialFileManagerState } from './file-manager/file-manager-types'
import { useFileManager } from './file-manager/use-file-manager'
import { FileManagerDropZone } from './file-manager/file-manager-drop-zone'
import { FileManagerList } from './file-manager/file-manager-list'
import { FileManagerErrorList } from './file-manager/file-manager-error-list'
import { resolveFileManagerLabel } from './file-manager/resolve-file-manager-label'

interface FileManagerNodeProps {
  node: FileManagerLayoutNode
  iterationContext?: RuntimeIterationContext
}

// Default text for the labels that have no local placeholders. These are resolved once per
// render by the parent and handed down as `resolvedLabels`. Labels with local placeholders
// (dropzoneAcceptedFormats, dropzoneProgress, dropzoneSuccess, dropzoneMaxFilesReached,
// dropzoneAriaLabel, uploadFileError) are resolved by the consuming subcomponent instead.
const RESOLVED_LABEL_DEFAULTS: Partial<Record<FileManagerLabelKey, string>> = {
  dropzoneIdle: 'Arrastra los ficheros aquí o haz clic para seleccionar',
  dropzoneUploading: 'Subiendo ficheros...',
  listLoadError: 'Error al cargar los ficheros.',
  listEmpty: 'No hay ficheros subidos.',
  paginationPrevious: 'Anterior',
  paginationNext: 'Siguiente',
  rowViewLabel: 'Ver',
  rowViewAriaLabel: 'Ver fichero',
  rowViewUnavailableAriaLabel: 'Ver no disponible',
  rowDownloadLabel: 'Descargar',
  rowDownloadAriaLabel: 'Descargar fichero',
  rowDownloadUnavailableAriaLabel: 'Descargar no disponible',
  rowDeleteLabel: 'Eliminar',
  rowDeleteAriaLabel: 'Eliminar fichero',
}

export function FileManagerNode({ node, iterationContext }: FileManagerNodeProps) {
  const config = useRuntimeConfig()
  const runtimeState = useRuntimeState()
  const { state: hookState, fileList, selectFiles, deleteFile } = useFileManager(node)

  const props = node.props
  const fileIdField = props.fileIdField ?? 'id'
  const fileNameField = props.fileNameField ?? 'name'
  const multiple = props.multiple ?? true
  const pageSize = props.pagination?.pageSize ?? 10
  const acceptMimeTypes = props.validations?.accept?.value ?? []
  const acceptExtension = props.acceptExtension ?? []
  const maxFiles = props.validations?.maxFiles?.value

  // Local reducer used only for drag-phase visual transitions and page state.
  // The hook owns upload/delete state; local reducer owns drag visual and pagination.
  const [localState, localDispatch] = useReducer(fileManagerReducer, initialFileManagerState)

  const isLimitReached = maxFiles !== undefined && fileList.length >= maxFiles

  const isDeclarativeGet = typeof props.getOperation === 'string'
  const isLegacyGet = props.getOperation === undefined && props.fieldName !== undefined

  let getSlotName: string | null = null
  if (isDeclarativeGet) {
    getSlotName = props.getOperation as string
  } else if (isLegacyGet) {
    getSlotName = `__fileManager__:${props.fieldName!}:get`
  }

  const getOperationStatus = getSlotName ? (runtimeState.queries[getSlotName]?.status ?? null) : null

  const currentPage = localState.page
  const dndPhase = hookState.dndPhase

  const resolvedLabels: Partial<Record<FileManagerLabelKey, string>> = {}
  for (const key of Object.keys(RESOLVED_LABEL_DEFAULTS) as FileManagerLabelKey[]) {
    resolvedLabels[key] = resolveFileManagerLabel({
      labels: props.labels,
      key,
      defaultText: RESOLVED_LABEL_DEFAULTS[key]!,
      state: runtimeState,
      iterationContext,
    })
  }

  function handleDragEnter() {
    localDispatch({ type: 'drag-enter' })
  }

  function handleDragLeave() {
    localDispatch({ type: 'drag-leave' })
  }

  function handleNextPage() {
    localDispatch({ type: 'set-page', payload: { page: currentPage + 1 } })
  }

  function handlePreviousPage() {
    localDispatch({ type: 'set-page', payload: { page: currentPage - 1 } })
  }

  const showDropZone = props.uploadOperation !== false

  return (
    <div data-layout-node="fileManager" className="w-full">
      {showDropZone && (
        <FileManagerDropZone
          fieldName={props.fieldName}
          multiple={multiple}
          acceptMimeTypes={acceptMimeTypes}
          acceptExtension={acceptExtension}
          dndPhase={dndPhase}
          isDisabled={false}
          isLimitReached={isLimitReached}
          maxFilesLimit={maxFiles}
          completed={hookState.completed}
          total={hookState.total}
          resolvedLabels={resolvedLabels}
          rawLabels={props.labels}
          state={runtimeState}
          iterationContext={iterationContext}
          onSelectFiles={selectFiles}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        />
      )}

      <FileManagerErrorList errors={hookState.inlineErrors} />

      <FileManagerList
        fileList={fileList}
        fileIdField={fileIdField}
        fileNameField={fileNameField}
        viewOperation={props.viewOperation}
        downloadOperation={props.downloadOperation}
        deleteOperation={props.deleteOperation}
        fieldName={props.fieldName}
        deletingFileId={hookState.deletingFileId}
        pageSize={pageSize}
        currentPage={currentPage}
        getOperationStatus={getOperationStatus}
        config={config}
        state={runtimeState}
        resolvedLabels={resolvedLabels}
        onDelete={deleteFile}
        onNextPage={handleNextPage}
        onPreviousPage={handlePreviousPage}
      />
    </div>
  )
}
