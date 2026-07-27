export function getFileManagerRowClassName(): string {
  return 'flex items-center justify-between py-2 border-b border-app-border-soft last:border-0'
}

export function getFileManagerRowFileNameClassName(): string {
  return 'text-sm text-app-text flex-1 truncate'
}

export function getFileManagerRowActionClassName(variant: 'primary' | 'danger' | 'disabled'): string {
  if (variant === 'primary') {
    return 'flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 cursor-pointer transition-colors'
  }
  if (variant === 'danger') {
    return 'flex items-center gap-1 text-sm text-danger-600 hover:text-danger-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors'
  }
  return 'flex items-center gap-1 text-sm text-neutral-300'
}

export function getFileManagerListErrorClassName(): string {
  return 'text-sm text-danger-600'
}

export function getFileManagerListEmptyClassName(): string {
  return 'text-sm text-app-text-muted'
}

export function getFileManagerListDividerClassName(): string {
  return 'divide-y divide-app-border-soft'
}

export function getFileManagerErrorItemClassName(): string {
  return 'text-sm text-danger-600'
}

const fileManagerDropZonePhaseClassMap: Record<string, string> = {
  idle: 'border-neutral-300 bg-neutral-50 cursor-pointer hover:bg-neutral-100',
  'drag-over': 'border-primary-500 bg-primary-50 cursor-pointer',
  uploading: 'border-info-400 bg-info-50 cursor-not-allowed',
  success: 'border-success-500 bg-success-50 cursor-pointer',
  error: 'border-danger-400 bg-danger-50 cursor-pointer',
}

export function getFileManagerDropZoneClassName(phase: 'idle' | 'drag-over' | 'uploading' | 'success' | 'error'): string {
  return fileManagerDropZonePhaseClassMap[phase] ?? fileManagerDropZonePhaseClassMap.idle
}

const fileManagerDropZoneTextClassMap: Record<'muted' | 'info' | 'success', string> = {
  muted: 'text-sm text-app-text-muted',
  info: 'text-sm text-info-700',
  success: 'text-sm text-success-700',
}

export function getFileManagerDropZoneTextClassName(intent: 'muted' | 'info' | 'success'): string {
  return fileManagerDropZoneTextClassMap[intent]
}

export function getFileManagerDropZoneProgressTrackClassName(): string {
  return 'w-full bg-info-200 rounded h-2'
}

export function getFileManagerDropZoneProgressFillClassName(): string {
  return 'bg-info-600 h-2 rounded transition-all'
}

const fileManagerDropZoneIconColorClassMap: Record<'muted' | 'info' | 'success', string> = {
  muted: 'text-app-text-muted',
  info: 'text-info-700',
  success: 'text-success-700',
}

export function getFileManagerDropZoneIconColorClassName(intent: 'muted' | 'info' | 'success'): string {
  return fileManagerDropZoneIconColorClassMap[intent]
}
