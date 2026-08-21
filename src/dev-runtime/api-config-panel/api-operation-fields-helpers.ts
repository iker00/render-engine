import type { RuntimeConfigError } from '../../config/runtime-config'
import type { SegmentedToggleOption } from '../layout-canvas/property-fields/segmented-toggle-property-field'

export type ApiOperationField = 'method' | 'endpoint' | 'query' | 'headers' | 'body'

export type ApiPendingEntry = { value: unknown; error: RuntimeConfigError }
export type ApiPendingRejections = Partial<Record<string, ApiPendingEntry>>

// Composite key criterion (T6, same as `translations-config-panel.tsx`'s `${key}:${lang}` for
// cell-level rejection isolation): one entry per operation+field pair, so a rejection on one field
// of one operation never affects the banner of another field or another operation.
export function apiOperationFieldRejectionKey(operationKey: string, field: ApiOperationField): string {
  return `${operationKey}.${field}`
}

export const API_METHOD_OPTIONS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]
