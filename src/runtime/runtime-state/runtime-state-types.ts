import type { Dispatch } from 'react'
import type { RuntimeConfig, RuntimeConfigValue, RuntimeTranslationsConfig } from '../../config/runtime-config'

export interface RuntimeNavigationError {
  code: 'page-not-found'
  message: string
  pageId: string
}

export type RuntimePageParams = Record<string, RuntimeConfigValue>

export interface RuntimeNavigationHistoryEntry {
  entryId: number
  pageId: string
  params: RuntimePageParams
}

export interface RuntimeNavigationState {
  currentPageId: string
  history: RuntimeNavigationHistoryEntry[]
  currentEntryIndex: number
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
  requestSignature: string | null
}

export type RuntimePageEntryStatus = 'idle' | 'loading' | 'success' | 'error'

export interface RuntimePageEntryState {
  entryId: number
  pageId: string
  params: RuntimePageParams
  preloadNames: string[]
  status: RuntimePageEntryStatus
}

export interface RuntimeModalState {
  activeModalId: string | null
  activeIterationKey: string | null
}

export interface RuntimeI18nState {
  translations: RuntimeTranslationsConfig
  activeLanguage: string
}

export type RuntimeTokenStatus = 'ready' | 'refreshing' | 'error'

export interface RuntimeTokenState {
  value: string
  status: RuntimeTokenStatus
  failedAttempts: number
}

export interface RuntimeState {
  navigation: RuntimeNavigationState
  forms: Record<string, RuntimeFormState>
  queries: Record<string, RuntimeQueryState>
  pageEntry: RuntimePageEntryState
  modal: RuntimeModalState
  i18n: RuntimeI18nState
  tokens: Record<string, RuntimeTokenState>
}

export type RuntimeStateAction =
  | { type: 'runtime/reset'; payload: { state: RuntimeState } }
  | { type: 'navigation/sync-from-browser'; payload: { pageId: string; params?: RuntimePageParams } }
  | { type: 'navigation/navigate'; payload: { pageId: string; params?: RuntimePageParams } }
  | { type: 'navigation/go-back' }
  | { type: 'navigation/set-error'; payload: { error: RuntimeNavigationError } }
  | { type: 'page-entry/set-idle'; payload: { entryId: number; pageId: string; params: RuntimePageParams; preloadNames: string[] } }
  | {
      type: 'page-entry/start-preload-batch'
      payload: {
        entryId: number
        pageId: string
        params: RuntimePageParams
        preloadNames: string[]
        resetQueries?: Array<{ queryName: string; requestSignature: string | null }>
      }
    }
  | { type: 'page-entry/set-loading'; payload: { entryId: number; pageId: string; params: RuntimePageParams; preloadNames: string[] } }
  | {
      type: 'page-entry/set-settled-entry'
      payload: {
        entryId: number
        pageId: string
        params: RuntimePageParams
        preloadNames: string[]
        status: 'success' | 'error'
      }
    }
  | { type: 'page-entry/set-settled'; payload: { entryId: number; status: 'success' | 'error' } }
  | { type: 'forms/initialize'; payload: { formId: string; fields: Record<string, RuntimeFormFieldDefinition> } }
  | { type: 'forms/set-value'; payload: { formId: string; fieldId: string; value: unknown } }
  | {
      type: 'forms/set-error'
      payload: { formId: string; fieldId: string; error: string | null; defaultValue?: unknown }
    }
  | { type: 'forms/reset'; payload: { formId: string } }
  | { type: 'forms/remove'; payload: { formId: string } }
  | { type: 'queries/initialize'; payload: { queryName: string } }
  | { type: 'queries/set-loading'; payload: { queryName: string; requestSignature?: string | null } }
  | { type: 'queries/set-success'; payload: { queryName: string; data: unknown; requestSignature?: string | null } }
  | { type: 'queries/set-error'; payload: { queryName: string; error: RuntimeQueryError; requestSignature?: string | null } }
  | { type: 'queries/reset'; payload: { queryName: string } }
  | { type: 'modal/open'; payload: { modalId: string; iterationKey?: string } }
  | { type: 'modal/close'; payload: { modalId: string; iterationKey?: string } }
  | { type: 'modal/close-all' }
  | { type: 'tokens/set-refreshing'; payload: { tokenId: string } }
  | { type: 'tokens/set-value'; payload: { tokenId: string; value: string } }
  | { type: 'tokens/set-error'; payload: { tokenId: string } }
  | { type: 'tokens/record-failed-attempt'; payload: { tokenId: string } }

export interface RuntimeStateContextValue {
  config: RuntimeConfig
  initialState: RuntimeState
  state: RuntimeState
  dispatch: Dispatch<RuntimeStateAction>
  dispatchAndSyncState: (action: RuntimeStateAction) => void
  getLatestState: () => RuntimeState
}
