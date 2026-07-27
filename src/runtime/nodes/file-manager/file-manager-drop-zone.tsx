import { useRef } from 'react'
import { Check, CloudAlert, CloudSync, CloudUpload } from 'lucide-react';
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
  completed: number
  total: number
  onSelectFiles: (files: File[]) => void
  onDragEnter: () => void
  onDragLeave: () => void
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className="w-full mt-2">
      <p className={`${getFileManagerDropZoneTextClassName('info')} mb-1`}>
        {completed}/{total} — {percent}%
      </p>
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
  completed,
  total,
  onSelectFiles,
  onDragEnter,
  onDragLeave,
}: FileManagerDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const phaseClass = getFileManagerDropZoneClassName(dndPhase)
  const isUploading = dndPhase === 'uploading'
  const canInteract = !isDisabled && !isLimitReached && !isUploading
  const ariaLabel = `Drop zone for ${fieldName ?? 'files'}`
  const acceptAttr = acceptMimeTypes.length > 0 ? acceptMimeTypes.join(',') : undefined

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
            <p className={getFileManagerDropZoneTextClassName('muted')}>Límite alcanzado</p>
          </>
      ) : isUploading ? (
          <>
            <CloudSync className={getFileManagerDropZoneIconColorClassName('info')} size={100} />
            <div className="w-full text-center">
                <p className={getFileManagerDropZoneTextClassName('info')}>Subiendo ficheros...</p>
                <ProgressBar completed={completed} total={total} />
            </div>
          </>
      ) : dndPhase === 'success' ? (
          <>
            <Check className={getFileManagerDropZoneIconColorClassName('success')} size={100} />
            <p className={getFileManagerDropZoneTextClassName('success')}>¡Ficheros subidos correctamente!</p>
          </>
      ) : (
        <>
          <CloudUpload size={100} />
          <p className={getFileManagerDropZoneTextClassName('muted')}>
            Arrastra los ficheros aquí o haz clic para seleccionar
          </p>
          {acceptExtension.length > 0 && (
            <p className={`text-xs ${getFileManagerDropZoneIconColorClassName('muted')} mt-1`}>
              Formatos aceptados: {acceptExtension.join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
