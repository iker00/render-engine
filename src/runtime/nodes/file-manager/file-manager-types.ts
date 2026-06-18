export interface FileManagerLocalState {
  dndPhase: 'idle' | 'drag-over' | 'uploading' | 'success' | 'error'
  pending: File[]
  currentIndex: number | null
  completed: number
  total: number
  inlineErrors: string[]
  successFlashUntil: number | null
  page: number
  deletingFileId: string | number | null
}

export type FileManagerAction =
  | { type: 'drag-enter' }
  | { type: 'drag-leave' }
  | { type: 'select-files'; payload: { files: File[]; total: number } }
  | { type: 'upload-progress' }
  | { type: 'upload-error'; payload: { message: string } }
  | { type: 'add-inline-error'; payload: { message: string } }
  | { type: 'upload-complete'; payload: { successFlashUntil: number } }
  | { type: 'clear-success-flash' }
  | { type: 'set-page'; payload: { page: number } }
  | { type: 'delete-start'; payload: { fileId: string | number } }
  | { type: 'delete-end' }

export const initialFileManagerState: FileManagerLocalState = {
  dndPhase: 'idle',
  pending: [],
  currentIndex: null,
  completed: 0,
  total: 0,
  inlineErrors: [],
  successFlashUntil: null,
  page: 1,
  deletingFileId: null,
}

export function fileManagerReducer(
  state: FileManagerLocalState,
  action: FileManagerAction,
): FileManagerLocalState {
  switch (action.type) {
    case 'drag-enter':
      return { ...state, dndPhase: 'drag-over' }

    case 'drag-leave':
      return state.dndPhase === 'drag-over' ? { ...state, dndPhase: 'idle' } : state

    case 'select-files':
      return {
        ...state,
        dndPhase: 'uploading',
        pending: action.payload.files,
        currentIndex: 0,
        completed: 0,
        total: action.payload.total,
        inlineErrors: [],
      }

    case 'upload-progress':
      return {
        ...state,
        completed: state.completed + 1,
        currentIndex: state.currentIndex !== null ? state.currentIndex + 1 : null,
      }

    case 'upload-error':
      return {
        ...state,
        dndPhase: 'error',
        inlineErrors: [...state.inlineErrors, action.payload.message],
        pending: [],
        currentIndex: null,
      }

    case 'add-inline-error':
      return {
        ...state,
        inlineErrors: [...state.inlineErrors, action.payload.message],
      }

    case 'upload-complete':
      return {
        ...state,
        dndPhase: 'success',
        pending: [],
        currentIndex: null,
        successFlashUntil: action.payload.successFlashUntil,
      }

    case 'clear-success-flash':
      return {
        ...state,
        dndPhase: 'idle',
        successFlashUntil: null,
        completed: 0,
        total: 0,
      }

    case 'set-page':
      return { ...state, page: action.payload.page }

    case 'delete-start':
      return { ...state, deletingFileId: action.payload.fileId }

    case 'delete-end':
      return { ...state, deletingFileId: null }

    default:
      return state
  }
}
