import { useRef } from 'react'
import { Check, CloudAlert, CloudSync, CloudUpload } from 'lucide-react';

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

const phaseClassMap: Record<string, string> = {
  idle: 'border-gray-300 bg-gray-50 hover:bg-gray-100',
  'drag-over': 'border-blue-500 bg-blue-50',
  uploading: 'border-blue-400 bg-blue-50 cursor-not-allowed',
  success: 'border-green-500 bg-green-50',
  error: 'border-red-400 bg-red-50',
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className="w-full mt-2">
      <p className="text-sm text-blue-700 mb-1">
        {completed}/{total} — {percent}%
      </p>
      <div className="w-full bg-blue-200 rounded h-2">
        <div
          className="bg-blue-600 h-2 rounded transition-all"
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
  const phaseClass = phaseClassMap[dndPhase] ?? phaseClassMap.idle
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
            <CloudAlert className="text-gray-500" size={100} />
            <p className="text-sm text-gray-500">Límite alcanzado</p>
          </>
      ) : isUploading ? (
          <>
            <CloudSync className="text-blue-700" size={100} />
            <div className="w-full text-center">
                <p className="text-sm text-blue-700">Subiendo ficheros...</p>
                <ProgressBar completed={completed} total={total} />
            </div>
          </>
      ) : dndPhase === 'success' ? (
          <>
            <Check className="text-green-700" size={100} />
            <p className="text-sm text-green-700">¡Ficheros subidos correctamente!</p>
          </>
      ) : (
        <>
          <CloudUpload size={100} />
          <p className="text-sm text-gray-500">
            Arrastra los ficheros aquí o haz clic para seleccionar
          </p>
          {acceptExtension.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Formatos aceptados: {acceptExtension.join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
