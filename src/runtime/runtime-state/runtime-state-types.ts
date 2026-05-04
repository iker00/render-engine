import type { Dispatch } from 'react'
import type { RuntimeConfig } from '../../config/runtime-config'

export interface RuntimeNavigationError {
  code: 'page-not-found'
  message: string
  pageId: string
}

export interface RuntimeNavigationState {
  currentPageId: string
  history: string[]
  lastError: RuntimeNavigationError | null
}

export interface RuntimeFormFieldState {
  value: unknown
  error: string | null
  touched: boolean
  dirty: boolean
  defaultValue?: unknown
}

export interface RuntimeFormFieldDefinition {
  defaultValue?: unknown
}

export type RuntimeFormState = Record<string, RuntimeFormFieldState>

export interface RuntimeQueryError {
  message: string
  code?: string
}

export interface RuntimeQueryState {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: unknown
  error: RuntimeQueryError | null
}

export type RuntimePageEntryStatus = 'idle' | 'loading' | 'success' | 'error'

export interface RuntimePageEntryState {
  entryId: number
  pageId: string
  preloadNames: string[]
  status: RuntimePageEntryStatus
}

export interface RuntimeState {
  navigation: RuntimeNavigationState
  forms: Record<string, RuntimeFormState>
  queries: Record<string, RuntimeQueryState>
  pageEntry: RuntimePageEntryState
}

export type RuntimeStateAction =
  | { type: 'runtime/reset'; payload: { state: RuntimeState } }
  | { type: 'navigation/navigate'; payload: { pageId: string } }
  | { type: 'navigation/go-back' }
  | { type: 'navigation/set-error'; payload: { error: RuntimeNavigationError } }
  | { type: 'page-entry/set-idle'; payload: { entryId: number; pageId: string; preloadNames: string[] } }
  | { type: 'page-entry/set-loading'; payload: { entryId: number; pageId: string; preloadNames: string[] } }
  | { type: 'page-entry/set-settled'; payload: { entryId: number; status: 'success' | 'error' } }
  | { type: 'forms/initialize'; payload: { formId: string; fields: Record<string, RuntimeFormFieldDefinition> } }
  | { type: 'forms/set-value'; payload: { formId: string; fieldId: string; value: unknown } }
  | {
      type: 'forms/set-error'
      payload: { formId: string; fieldId: string; error: string | null; defaultValue?: unknown }
    }
  | { type: 'forms/reset'; payload: { formId: string } }
  | { type: 'queries/initialize'; payload: { queryName: string } }
  | { type: 'queries/set-loading'; payload: { queryName: string } }
  | { type: 'queries/set-success'; payload: { queryName: string; data: unknown } }
  | { type: 'queries/set-error'; payload: { queryName: string; error: RuntimeQueryError } }
  | { type: 'queries/reset'; payload: { queryName: string } }

export interface RuntimeStateContextValue {
  config: RuntimeConfig
  initialState: RuntimeState
  state: RuntimeState
  dispatch: Dispatch<RuntimeStateAction>
}
