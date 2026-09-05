import { useEffect, useMemo } from 'react'
import type React from 'react'
import type { FileInputLayoutNode } from '../../config/runtime-config'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { useOptionalFormContext } from '../use-optional-form-context'
import { deriveScopedStateKey, EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { evaluateFileManagerBatch } from '../runtime-form-validations'
import {
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { FieldTooltip } from './field-tooltip'

interface FileInputNodeProps {
  node: FileInputLayoutNode
  iterationContext?: RuntimeIterationContext
}

// One object URL per image File, revoked when the File is swapped out or the component unmounts.
// A dedicated component (rather than a shared ref/state map on FileInputNode) keeps the URL's
// lifetime tied to a single `useMemo`/cleanup-effect pair scoped by File identity, with no ref
// access or setState call happening during another component's render.
function FilePreviewImage({ file }: { file: File }) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  return <img src={objectUrl} alt={file.name} className="h-16 w-16 shrink-0 rounded object-cover" />
}

export function FileInputNode({ node }: FileInputNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldValue, setFormFieldError } = useRuntimeStateActions()

  const { fieldId } = node.props
  const scopeKey = formContext ? deriveScopedStateKey(formContext.formId, formContext.scopeChain ?? EMPTY_INSTANCE_SCOPE) : undefined
  const fieldState = scopeKey !== undefined ? selectFormFieldState(state, scopeKey, fieldId) : undefined
  const currentFiles = Array.isArray(fieldState?.value) ? (fieldState.value as File[]) : []

  if (!formContext) {
    return null
  }

  const { formId, scopeChain } = formContext
  const { label, multiple, capture, validations } = node.props
  const tooltip = node.props.tooltip !== undefined
    ? resolveRuntimeTextReference(node.props.tooltip, state, 'fileInput.props.tooltip', {})
    : ''
  const isMultiple = multiple !== false // default is true

  const maxFilesValue = validations?.maxFiles?.value
  const isAtLimit = maxFilesValue !== undefined && currentFiles.length >= maxFilesValue
  const acceptString = validations?.accept?.value?.join(',') ?? undefined
  const error = fieldState?.error ?? null
  const hasError = error !== null

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? [])

    if (incoming.length === 0) {
      return
    }

    // For single mode, treat existing files as empty so the new selection replaces the value.
    const existingForEval = isMultiple ? currentFiles : []

    const result = evaluateFileManagerBatch(validations, existingForEval, incoming, state)

    const nextFiles: File[] = isMultiple
      ? [...currentFiles, ...result.acceptedFiles]
      : result.acceptedFiles.slice(0, 1)

    setFormFieldValue(formId, fieldId, nextFiles, { scopeChain })

    if (result.rejection !== undefined) {
      setFormFieldError(formId, fieldId, result.rejection.message, { scopeChain })
    } else {
      setFormFieldError(formId, fieldId, null, { scopeChain })
    }

    // Reset the native input so the same file can be re-selected if needed
    event.target.value = ''
  }

  function handleRemove(file: File) {
    const nextFiles = currentFiles.filter((f) => f !== file)
    setFormFieldValue(formId, fieldId, nextFiles, { scopeChain })
  }

  const inputId = `${formId}-${fieldId}`

  return (
    <div className={getFieldWrapperClassName()} data-layout-node="fileInput">
      <label htmlFor={inputId} className={getFieldLabelClassName()}>
        {label}<FieldTooltip text={tooltip} />
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
                <FilePreviewImage file={file} />
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
