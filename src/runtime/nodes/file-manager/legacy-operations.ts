import type { RuntimeApiOperation } from '../../../config/runtime-config'

const LEGACY_ENDPOINT = '/subirFicheros.aspx'

export function buildLegacyGetOperation(fieldName: string): RuntimeApiOperation {
  return {
    method: 'GET',
    endpoint: LEGACY_ENDPOINT,
    query: {
      upload_multiple_field_name: fieldName,
    },
  }
}

export function buildLegacyUploadOperation(_fieldName: string, _fileField: string): RuntimeApiOperation {
  return {
    method: 'POST',
    endpoint: LEGACY_ENDPOINT,
  }
}

export function buildLegacyDeleteOperation(_fieldName: string): RuntimeApiOperation {
  return {
    method: 'POST',
    endpoint: LEGACY_ENDPOINT,
  }
}

export function buildLegacyViewDownloadOperation(_fieldName: string): RuntimeApiOperation {
  return {
    method: 'GET',
    endpoint: LEGACY_ENDPOINT,
  }
}

export function buildLegacySlotName(fieldName: string, op: 'get' | 'upload' | 'delete'): string {
  return `__fileManager__:${fieldName}:${op}`
}
