import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { FileManagerLayoutNode } from '../../../config/runtime-config'
import { evaluateFileManagerBatch } from '../../runtime-form-validations'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime-state/use-runtime-state'
import { normalizeFileName } from './normalize-file-name'
import { resolveFileManagerLabel } from './resolve-file-manager-label'
import {
  buildLegacyGetOperation,
  buildLegacyUploadOperation,
  buildLegacyDeleteOperation,
  buildLegacySlotName,
} from './legacy-operations'
import {
  fileManagerReducer,
  initialFileManagerState,
} from './file-manager-types'
import type { FileManagerLocalState } from './file-manager-types'

interface UseFileManagerOptions {
  fetchOverride?: typeof fetch
}

// Resolve a dot-notation path from a data value and return the array if found
function resolveDotPath(data: unknown, dotPath: string): unknown[] | null {
  const segments = dotPath.split('.')
  let current: unknown = data

  for (const segment of segments) {
    if (current == null || typeof current !== 'object' || Array.isArray(current)) {
      return null
    }
    current = (current as Record<string, unknown>)[segment]
  }

  return Array.isArray(current) ? current : null
}

// Replace a nested dot-path value in a plain object
function replaceNestedPath(data: unknown, dotPath: string, newValue: unknown): unknown {
  const segments = dotPath.split('.')

  if (segments.length === 1) {
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      return { ...(data as Record<string, unknown>), [segments[0]]: newValue }
    }
    return data
  }

  const [head, ...rest] = segments

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    return {
      ...obj,
      [head]: replaceNestedPath(obj[head], rest.join('.'), newValue),
    }
  }

  return data
}

export interface UseFileManagerResult {
  state: FileManagerLocalState
  fileList: Record<string, unknown>[]
  selectFiles: (files: File[]) => Promise<void>
  deleteFile: (file: Record<string, unknown>) => Promise<void>
}

export function useFileManager(
  node: FileManagerLayoutNode,
  options: UseFileManagerOptions = {},
): UseFileManagerResult {
  const { fetchOverride } = options
  const runtimeState = useRuntimeState()
  const { executeQueryOperation, executeInlineQueryOperation, readRuntimeState, setQuerySuccess } =
    useRuntimeStateActions()
  const [localState, dispatch] = useReducer(fileManagerReducer, initialFileManagerState)
  const mountedRef = useRef(true)

  const props = node.props
  const listPath = props.listPath ?? 'files'
  const fileIdField = props.fileIdField ?? 'id'
  const fileNameField = props.fileNameField ?? 'name'
  const fileField = props.fileField ?? 'file'
  const fieldName = props.fieldName

  // Determine mode: declarative vs legacy
  const isDeclarativeGet = typeof props.getOperation === 'string'
  const isLegacyGet = props.getOperation === undefined && fieldName !== undefined

  // Compute get slot name for reading state
  const getSlotName: string | null = isDeclarativeGet
    ? (props.getOperation as string)
    : isLegacyGet
      ? buildLegacySlotName(fieldName!, 'get')
      : null

  // Resolve the file list from queries
  const fileList = useMemo((): Record<string, unknown>[] => {
    if (!getSlotName) {
      return []
    }
    const queryData = runtimeState.queries[getSlotName]?.data
    if (!queryData) {
      return []
    }
    const resolved = resolveDotPath(queryData, listPath)
    return resolved ? (resolved as Record<string, unknown>[]) : []
  }, [getSlotName, listPath, runtimeState.queries])

  // Track mounted state — set on mount, cleared on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Initial get on mount
  useEffect(() => {
    if (isDeclarativeGet && props.getOperation) {
      void executeQueryOperation(props.getOperation as string, { fetch: fetchOverride })
    } else if (isLegacyGet && fieldName) {
      const slotName = buildLegacySlotName(fieldName, 'get')
      const operation = buildLegacyGetOperation(fieldName)
      void executeInlineQueryOperation(slotName, { operation }, fetchOverride)
    }
    // Only run on mount — deps intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Success flash cleanup timer
  useEffect(() => {
    if (localState.successFlashUntil === null) {
      return
    }

    const delay = localState.successFlashUntil - Date.now()
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        dispatch({ type: 'clear-success-flash' })
      }
    }, Math.max(0, delay))

    return () => {
      clearTimeout(timer)
    }
  }, [localState.successFlashUntil])

  const selectFiles = useCallback(
    async (files: File[]) => {
      // Step 1: build existing files for validation (by name from current query data)
      const currentState = readRuntimeState()
      let existingFilesForValidation: File[]

      if (getSlotName) {
        const queryData = currentState.queries[getSlotName]?.data
        const resolved = queryData ? resolveDotPath(queryData, listPath) : null
        existingFilesForValidation = (resolved ?? []).map((record) => {
          const name = String((record as Record<string, unknown>)[fileNameField] ?? '')
          return new File([], name, { type: '' })
        })
      } else {
        existingFilesForValidation = []
      }

      // Step 2: evaluate batch validation
      const { acceptedFiles, rejection } = evaluateFileManagerBatch(
        props.validations,
        existingFilesForValidation,
        files,
        currentState,
      )

      // Batch rejection: no uploads happen, show error
      if (rejection?.scope === 'batch') {
        dispatch({ type: 'upload-error', payload: { message: rejection.message } })
        return
      }

      // No accepted files (all per-file rejected, none to upload)
      if (acceptedFiles.length === 0) {
        if (rejection?.scope === 'per-file') {
          dispatch({ type: 'upload-error', payload: { message: rejection.message } })
        }
        return
      }

      // Step 3: start upload queue (uploading phase)
      dispatch({
        type: 'select-files',
        payload: { files: acceptedFiles, total: acceptedFiles.length },
      })

      // Record per-file rejection message to show alongside success
      const perFileRejectionMessage: string | null =
        rejection?.scope === 'per-file' ? rejection.message : null

      const isDeclarativeUpload = typeof props.uploadOperation === 'string'
      const isLegacyUpload = props.uploadOperation === undefined && fieldName !== undefined

      // Step 4: sequential uploads
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        const normalizedName = normalizeFileName(file.name, props.prefix)
        const normalizedFile = new File([file], normalizedName, { type: file.type })

        let uploadResult: { status: string; data?: unknown; error?: unknown }

        if (isDeclarativeUpload) {
          uploadResult = await executeQueryOperation(props.uploadOperation as string, {
            fetch: fetchOverride,
            requestParams: {
              files: [{ name: fileField, file: normalizedFile }],
            },
          })
        } else if (isLegacyUpload && fieldName) {
          const slotName = buildLegacySlotName(fieldName, 'upload')
          const operation = buildLegacyUploadOperation(fieldName, fileField)
          uploadResult = await executeInlineQueryOperation(
            slotName,
            {
              operation,
              requestParams: {
                files: [{ name: fileField, file: normalizedFile }],
                body: { upload_multiple_field_name: fieldName },
              },
            },
            fetchOverride,
          )
        } else {
          // uploadOperation is false — should not be reached for accepted files
          break
        }

        if (!mountedRef.current) {
          return
        }

        // Upload failed: stop queue, show error
        if (uploadResult.status === 'error') {
          dispatch({
            type: 'upload-error',
            payload: {
              message: resolveFileManagerLabel({
                labels: props.labels,
                key: 'uploadFileError',
                defaultText: `Error al subir "${normalizedName}".`,
                placeholders: { fileName: normalizedName },
                state: readRuntimeState(),
              }),
            },
          })
          return
        }

        // Verify response includes the list path
        const resolvedList = resolveDotPath(uploadResult.data, listPath)
        if (resolvedList === null) {
          dispatch({
            type: 'upload-error',
            payload: {
              message: resolveFileManagerLabel({
                labels: props.labels,
                key: 'uploadListPathMissing',
                defaultText: 'La respuesta de la subida no incluye la lista actualizada de ficheros.',
                state: readRuntimeState(),
              }),
            },
          })
          return
        }

        if (!mountedRef.current) {
          return
        }

        // Update the file list with the response from each upload
        if (getSlotName) {
          setQuerySuccess(getSlotName, uploadResult.data)
        }

        dispatch({ type: 'upload-progress' })
      }

      if (!mountedRef.current) {
        return
      }

      // Show success flash; if there was also a per-file rejection, add it as inline error after success
      dispatch({
        type: 'upload-complete',
        payload: { successFlashUntil: Date.now() + 4000 },
      })

      if (perFileRejectionMessage) {
        dispatch({ type: 'add-inline-error', payload: { message: perFileRejectionMessage } })
      }
    },
    [
      executeQueryOperation,
      executeInlineQueryOperation,
      fieldName,
      fileField,
      fileNameField,
      fetchOverride,
      getSlotName,
      listPath,
      props.uploadOperation,
      props.prefix,
      props.validations,
      props.labels,
      readRuntimeState,
      setQuerySuccess,
    ],
  )

  const deleteFile = useCallback(
    async (file: Record<string, unknown>) => {
      const fileId = file[fileIdField] as string | number
      dispatch({ type: 'delete-start', payload: { fileId } })

      const isDeclarativeDelete = typeof props.deleteOperation === 'string'
      const isLegacyDelete = props.deleteOperation === undefined && fieldName !== undefined

      let deleteResult: { status: string; data?: unknown; error?: unknown }

      if (isDeclarativeDelete) {
        deleteResult = await executeQueryOperation(props.deleteOperation as string, {
          fetch: fetchOverride,
          requestParams: {
            body: { [fileIdField]: fileId },
          },
        })
      } else if (isLegacyDelete && fieldName) {
        const slotName = buildLegacySlotName(fieldName, 'delete')
        const operation = buildLegacyDeleteOperation(fieldName)
        deleteResult = await executeInlineQueryOperation(
          slotName,
          {
            operation,
            requestParams: {
              body: {
                upload_multiple_field_name: fieldName,
                upload_multiple_file_id: fileId,
              },
            },
          },
          fetchOverride,
        )
      } else {
        dispatch({ type: 'delete-end' })
        return
      }

      if (!mountedRef.current) {
        return
      }

      dispatch({ type: 'delete-end' })

      if (deleteResult.status === 'error') {
        dispatch({
          type: 'upload-error',
          payload: {
            message: resolveFileManagerLabel({
              labels: props.labels,
              key: 'deleteError',
              defaultText: 'Error al eliminar el fichero.',
              state: readRuntimeState(),
            }),
          },
        })
        return
      }

      const resolvedList = resolveDotPath(deleteResult.data, listPath)
      if (resolvedList !== null && getSlotName) {
        setQuerySuccess(getSlotName, deleteResult.data)
      } else if (resolvedList === null && getSlotName) {
        const currentState = readRuntimeState()
        const currentQueryData = currentState.queries[getSlotName]?.data

        if (currentQueryData) {
          const currentList = resolveDotPath(currentQueryData, listPath)
          if (currentList) {
            const filteredList = currentList.filter(
              (item) => (item as Record<string, unknown>)[fileIdField] !== fileId,
            )
            const updatedData = replaceNestedPath(currentQueryData, listPath, filteredList)
            setQuerySuccess(getSlotName, updatedData)
          }
        }
      }
    },
    [
      executeQueryOperation,
      executeInlineQueryOperation,
      fieldName,
      fileIdField,
      fetchOverride,
      getSlotName,
      listPath,
      props.deleteOperation,
      props.labels,
      readRuntimeState,
      setQuerySuccess,
    ],
  )

  return {
    state: localState,
    fileList,
    selectFiles,
    deleteFile,
  }
}
