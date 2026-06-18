const INVALID_CHARS = /[\\/:|*?"<>]/g

const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

/**
 * Normalizes a file name for safe upload:
 * 1. Splits base and extension by the last dot.
 * 2. Replaces Windows-invalid characters (\ / : * ? " < > |) with _.
 * 3. Trims trailing spaces and dots from the reassembled name.
 * 4. If the base (case-insensitive) matches a Windows reserved name, replaces it with archivo_1.
 * 5. Truncates base so that the full name is at most 255 characters.
 * 6. Prepends prefix_ if prefix is provided and non-empty.
 */
export function normalizeFileName(fileName: string, prefix?: string): string {
  // Step 1: split at last dot
  const lastDot = fileName.lastIndexOf('.')
  let base: string
  let ext: string

  if (lastDot === -1) {
    base = fileName
    ext = ''
  } else {
    base = fileName.slice(0, lastDot)
    ext = fileName.slice(lastDot + 1)
  }

  // Step 2: replace Windows-invalid characters in both parts
  base = base.replace(INVALID_CHARS, '_')
  ext = ext.replace(INVALID_CHARS, '_')

  // Step 3: reassemble and trim trailing spaces and dots
  let name = ext ? base + '.' + ext : base
  name = name.replace(/[\s.]+$/, '')

  // Re-derive base and ext from trimmed name (trim may have changed things)
  const trimmedLastDot = name.lastIndexOf('.')
  if (trimmedLastDot === -1) {
    base = name
    ext = ''
  } else {
    base = name.slice(0, trimmedLastDot)
    ext = name.slice(trimmedLastDot + 1)
  }

  // Step 4: replace Windows reserved names
  if (WINDOWS_RESERVED.test(base)) {
    base = 'archivo_1'
  }

  // Step 5: truncate base so total name length <= 255
  const dotAndExt = ext ? '.' + ext : ''
  const maxBaseLength = 255 - dotAndExt.length
  if (base.length > maxBaseLength) {
    base = base.slice(0, maxBaseLength)
  }

  name = base + dotAndExt

  // Step 6: prepend prefix if provided and non-empty
  if (prefix && prefix.length > 0) {
    return `${prefix}_${name}`
  }

  return name
}
