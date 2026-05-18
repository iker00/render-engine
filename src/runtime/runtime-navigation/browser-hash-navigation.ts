import type { RuntimeConfigValue } from '../../config/runtime-config'

export interface BrowserHashNavigationEntry {
  pageId: string
  params: Record<string, string>
}

export interface ParseBrowserHashNavigationHashOptions {
  initialPageId: string
  knownPageIds: Iterable<string>
}

export interface ParseBrowserHashNavigationHashResult {
  entry: BrowserHashNavigationEntry
  canonicalHash: string
  isCanonical: boolean
  isFallback: boolean
}

export interface CreateBrowserHashNavigationHashOptions {
  initialPageId: string
}

type BrowserHashNavigationParamValue = RuntimeConfigValue | undefined | Record<string, unknown> | unknown[]

const HOME_HASH = '#/'

export function parseBrowserHashNavigationHash(
  hash: string | null | undefined,
  options: ParseBrowserHashNavigationHashOptions,
): ParseBrowserHashNavigationHashResult {
  const fallbackEntry = createBrowserHashNavigationEntry(options.initialPageId, {})
  const fallbackResult = createParseResult(fallbackEntry, options, true, hash === HOME_HASH)

  if (hash == null || hash.length === 0 || hash === '#') {
    return fallbackResult
  }

  if (!hash.startsWith('#/')) {
    return fallbackResult
  }

  const hashWithoutMarker = hash.slice(1)
  const queryIndex = hashWithoutMarker.indexOf('?')
  const rawPath = queryIndex === -1 ? hashWithoutMarker : hashWithoutMarker.slice(0, queryIndex)
  const rawQuery = queryIndex === -1 ? '' : hashWithoutMarker.slice(queryIndex + 1)
  const pageId = resolvePageIdFromHashPath(rawPath, options.initialPageId)

  if (pageId == null) {
    return fallbackResult
  }

  const knownPageIds = new Set(options.knownPageIds)

  if (!knownPageIds.has(pageId)) {
    return fallbackResult
  }

  const entry = createBrowserHashNavigationEntry(pageId, normalizeBrowserHashNavigationSearchParams(rawQuery))
  return createParseResult(entry, options, false, hash === createBrowserHashNavigationHash(entry, options))
}

export function createBrowserHashNavigationHash(
  entry: {
    pageId: string
    params?: Record<string, BrowserHashNavigationParamValue>
  },
  options: CreateBrowserHashNavigationHashOptions,
): string {
  const normalizedParams = normalizeBrowserHashNavigationParams(entry.params)
  const sortedKeys = Object.keys(normalizedParams).sort((left, right) => left.localeCompare(right))
  const searchParams = new URLSearchParams()

  for (const key of sortedKeys) {
    searchParams.set(key, normalizedParams[key])
  }

  const normalizedPath = entry.pageId === options.initialPageId ? '/' : `/${entry.pageId}`
  const queryString = searchParams.toString()

  return queryString.length > 0 ? `#${normalizedPath}?${queryString}` : `#${normalizedPath}`
}

export function areBrowserHashNavigationEntriesEqual(
  left: BrowserHashNavigationEntry | null | undefined,
  right: BrowserHashNavigationEntry | null | undefined,
): boolean {
  if (left == null || right == null) {
    return left == null && right == null
  }

  if (left.pageId !== right.pageId) {
    return false
  }

  const leftParams = normalizeBrowserHashNavigationParams(left.params)
  const rightParams = normalizeBrowserHashNavigationParams(right.params)
  const leftKeys = Object.keys(leftParams).sort((first, second) => first.localeCompare(second))
  const rightKeys = Object.keys(rightParams).sort((first, second) => first.localeCompare(second))

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key, index) => key === rightKeys[index] && leftParams[key] === rightParams[key])
}

function createParseResult(
  entry: BrowserHashNavigationEntry,
  options: CreateBrowserHashNavigationHashOptions,
  isFallback: boolean,
  isCanonical: boolean,
): ParseBrowserHashNavigationHashResult {
  return {
    canonicalHash: createBrowserHashNavigationHash(entry, options),
    entry,
    isCanonical,
    isFallback,
  }
}

function resolvePageIdFromHashPath(pathname: string, initialPageId: string): string | null {
  if (pathname === '/') {
    return initialPageId
  }

  if (!pathname.startsWith('/')) {
    return null
  }

  const pageId = pathname.slice(1)

  if (pageId.length === 0 || pageId.includes('/')) {
    return null
  }

  return pageId
}

function createBrowserHashNavigationEntry(
  pageId: string,
  params: Record<string, string>,
): BrowserHashNavigationEntry {
  return {
    pageId,
    params,
  }
}

function normalizeBrowserHashNavigationSearchParams(rawQuery: string): Record<string, string> {
  const normalizedParams: Record<string, string> = {}
  const searchParams = new URLSearchParams(rawQuery)

  for (const [key, value] of searchParams.entries()) {
    normalizedParams[key] = value
  }

  return normalizedParams
}

function normalizeBrowserHashNavigationParams(
  params: Record<string, BrowserHashNavigationParamValue> | undefined,
): Record<string, string> {
  if (params == null) {
    return {}
  }

  const normalizedParams: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      normalizedParams[key] = String(value)
    }
  }

  return normalizedParams
}
