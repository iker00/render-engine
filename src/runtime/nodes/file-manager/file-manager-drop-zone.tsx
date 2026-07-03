import { useRef } from 'react'
import { Check, CloudAlert, CloudSync, CloudUpload } from 'lucide-react';
import type { FileManagerLabelKey, FileManagerLabels } from '../../../config/runtime-config-types'
import type { RuntimeIterationContext } from '../../runtime-references/runtime-reference-resolver'
import type { RuntimeState } from '../../runtime-state/runtime-state-types'
import { resolveFileManagerLabel } from './resolve-file-manager-label'
import {
  getFileManagerDropZoneClassName,
  getFileManagerDropZoneIconColorClassName,
  getFileManagerDropZoneProgressFillClassName,
  getFileManagerDropZoneProgressTrackClassName,
  getFileManagerDropZoneTextClassName,
} from '../../runtime-node-styling'

interface FileManagerDropZoneProps {
  fieldName: string | undefined
  multiple: boolean
  acceptMimeTypes: string[]
  acceptExtension: string[]
  dndPhase: 'idle' | 'drag-over' | 'uploading' | 'success' | 'error'
  isDisabled: boolean
  isLimitReached: boolean
  maxFilesLimit: number | undefined
  completed: number
  total: number
  resolvedLabels: Partial<Record<FileManagerLabelKey, string>>
  rawLabels: FileManagerLabels | undefined
  state: RuntimeState
  iterationContext?: RuntimeIterationContext
  onSelectFiles: (files: File[]) => void
  onDragEnter: () => void
  onDragLeave: () => void
}

function ProgressBar({ text, percent }: { text: string; percent: number }) {
  return (
    <div className="w-full mt-2">
      <p className={`${getFileManagerDropZoneTextClassName('info')} mb-1`}>{text}</p>
      <div className={getFileManagerDropZoneProgressTrackClassName()}>
        <div
          className={getFileManagerDropZoneProgressFillClassName()}
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export function FileManagerDropZone({
  fieldName,
  multiple,
  acceptMimeTypes,
  acceptExtension,
  dndPhase,
  isDisabled,
  isLimitReached,
  maxFilesLimit,
  completed,
  total,
  resolvedLabels,
  rawLabels,
  state,
  iterationContext,
  onSelectFiles,
  onDragEnter,
  onDragLeave,
}: FileManagerDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const phaseClass = getFileManagerDropZoneClassName(dndPhase)
  const isUploading = dndPhase === 'uploading'
  const canInteract = !isDisabled && !isLimitReached && !isUploading
  const ariaLabel = resolveFileManagerLabel({
    labels: rawLabels,
    key: 'dropzoneAriaLabel',
    defaultText: `Drop zone for ${fieldName ?? 'files'}`,
    placeholders: { fieldName: fieldName ?? 'files' },
    state,
    iterationContext,
  })
  const acceptAttr = acceptMimeTypes.length > 0 ? acceptMimeTypes.join(',') : undefined
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !canInteract) {
      return
    }

    onSelectFiles(Array.from(files))
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!canInteract) return
    onDragEnter()
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    onDragLeave()
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!canInteract) return
    onDragLeave()
    handleFiles(e.dataTransfer.files)
  }

  function handleClick() {
    if (!canInteract) return
    inputRef.current?.click()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      data-file-manager-zone="drop"
      data-dnd-phase={dndPhase}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${phaseClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={acceptAttr}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => e.stopPropagation()}
      />

      {isLimitReached ? (
          <>
            <CloudAlert className={getFileManagerDropZoneIconColorClassName('muted')} size={100} />
            <p className={getFileManagerDropZoneTextClassName('muted')}>
              {resolveFileManagerLabel({
                labels: rawLabels,
                key: 'dropzoneMaxFilesReached',
                defaultText: 'Límite alcanzado',
                placeholders: { max: String(maxFilesLimit ?? '') },
                state,
                iterationContext,
              })}
            </p>
          </>
      ) : isUploading ? (
          <>
            <CloudSync className={getFileManagerDropZoneIconColorClassName('info')} size={100} />
            <div className="w-full text-center">
                <p className={getFileManagerDropZoneTextClassName('info')}>{resolvedLabels.dropzoneUploading}</p>
                <ProgressBar
                  percent={percent}
                  text={resolveFileManagerLabel({
                    labels: rawLabels,
                    key: 'dropzoneProgress',
                    defaultText: `${completed}/${total} — ${percent}%`,
                    placeholders: {
                      completed: String(completed),
                      total: String(total),
                      percent: String(percent),
                    },
                    state,
                    iterationContext,
                  })}
                />
            </div>
          </>
      ) : dndPhase === 'success' ? (
          <>
            <Check className={getFileManagerDropZoneIconColorClassName('success')} size={100} />
            <p className={getFileManagerDropZoneTextClassName('success')}>
              {resolveFileManagerLabel({
                labels: rawLabels,
                key: 'dropzoneSuccess',
                defaultText: '¡Ficheros subidos correctamente!',
                placeholders: { count: String(total) },
                state,
                iterationContext,
              })}
            </p>
          </>
      ) : (
        <>
          <CloudUpload size={100} />
          <p className={getFileManagerDropZoneTextClassName('muted')}>
            {resolvedLabels.dropzoneIdle}
          </p>
          {acceptExtension.length > 0 && (
            <p className={`text-xs ${getFileManagerDropZoneIconColorClassName('muted')} mt-1`}>
              {resolveFileManagerLabel({
                labels: rawLabels,
                key: 'dropzoneAcceptedFormats',
                defaultText: `Formatos aceptados: ${acceptExtension.join(', ')}`,
                placeholders: { formats: acceptExtension.join(', ') },
                state,
                iterationContext,
              })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
