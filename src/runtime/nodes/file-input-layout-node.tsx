import { useEffect, useRef } from 'react'
import type React from 'react'
import type { FileInputLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useOptionalFormContext } from '../form-context'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { evaluateFileManagerBatch } from '../runtime-form-validations'
import {
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'

interface FileInputNodeProps {
  node: FileInputLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function FileInputNode({ node }: FileInputNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldValue, setFormFieldError } = useRuntimeStateActions()

  // Map from File to its object URL (images only). Entries are revoked on removal or unmount.
  const objectUrlMapRef = useRef(new Map<File, string>())

  useEffect(() => {
    const urlMap = objectUrlMapRef.current
    return () => {
      for (const url of urlMap.values()) {
        URL.revokeObjectURL(url)
      }
      urlMap.clear()
    }
  }, [])

  if (!formContext) {
    return null
  }

  const { formId } = formContext
  const { fieldId, label, multiple, capture, validations } = node.props
  const isMultiple = multiple !== false // default is true

  const fieldState = selectFormFieldState(state, formId, fieldId)
  const currentFiles = Array.isArray(fieldState?.value) ? (fieldState.value as File[]) : []

  const maxFilesValue = validations?.maxFiles?.value
  const isAtLimit = maxFilesValue !== undefined && currentFiles.length >= maxFilesValue
  const acceptString = validations?.accept?.value?.join(',') ?? undefined
  const error = fieldState?.error ?? null
  const hasError = error !== null

  function getOrCreateObjectUrl(file: File): string {
    const existing = objectUrlMapRef.current.get(file)
    if (existing !== undefined) {
      return existing
    }
    const url = URL.createObjectURL(file)
    objectUrlMapRef.current.set(file, url)
    return url
  }

  function revokeAndRemoveUrl(file: File) {
    const url = objectUrlMapRef.current.get(file)
    if (url !== undefined) {
      URL.revokeObjectURL(url)
      objectUrlMapRef.current.delete(file)
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? [])

    if (incoming.length === 0) {
      return
    }

    // For single mode, treat existing files as empty so the new selection replaces the value.
    const existingForEval = isMultiple ? currentFiles : []

    const result = evaluateFileManagerBatch(validations, existingForEval, incoming)

    let nextFiles: File[]
    if (isMultiple) {
      nextFiles = [...currentFiles, ...result.acceptedFiles]
    } else {
      // Revoke URLs for any existing image files before replacing
      for (const f of currentFiles) {
        revokeAndRemoveUrl(f)
      }
      nextFiles = result.acceptedFiles.slice(0, 1)
    }

    setFormFieldValue(formId, fieldId, nextFiles)

    if (result.rejection !== undefined) {
      setFormFieldError(formId, fieldId, result.rejection.message)
    } else {
      setFormFieldError(formId, fieldId, null)
    }

    // Reset the native input so the same file can be re-selected if needed
    event.target.value = ''
  }

  function handleRemove(file: File) {
    revokeAndRemoveUrl(file)
    const nextFiles = currentFiles.filter((f) => f !== file)
    setFormFieldValue(formId, fieldId, nextFiles)
  }

  const inputId = `${formId}-${fieldId}`

  return (
    <div className={getFieldWrapperClassName()} data-layout-node="fileInput">
      <label htmlFor={inputId} className={getFieldLabelClassName()}>
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={acceptString}
        multiple={isMultiple || undefined}
        capture={capture}
        disabled={isAtLimit}
        className="block w-full text-sm text-app-text file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-app-border-strong file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-app-text-strong file:transition-colors hover:file:bg-app-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent disabled:cursor-not-allowed disabled:opacity-50"
        aria-describedby={hasError ? `${inputId}-error` : undefined}
        onChange={handleChange}
      />
      {isAtLimit && (
        <span className="text-sm text-app-text-muted">Límite de ficheros alcanzado</span>
      )}
      {currentFiles.length > 0 && (
        <ul className="mt-2 grid gap-2">
          {currentFiles.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-3">
              {file.type.startsWith('image/') ? (
                <img
                  src={getOrCreateObjectUrl(file)}
                  alt={file.name}
                  className="h-16 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex-1 truncate text-sm text-app-text">{file.name}</span>
              )}
              <button
                type="button"
                className="shrink-0 text-sm text-danger-600 hover:text-danger-700 cursor-pointer transition-colors"
                onClick={() => handleRemove(file)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasError && (
        <span
          id={`${inputId}-error`}
          className={getFieldErrorClassName()}
        >
          {error}
        </span>
      )}
    </div>
  )
}
