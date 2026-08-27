import type {
  GalleryDynamicSource,
  GalleryLayoutNode,
  GalleryStaticImage,
  ImageFetchConfig,
} from '../config/runtime-config'
import { hasRuntimeTemplateDelimiter } from '../config/runtime-reference-syntax'
import { resolveCollectionSourceItems } from './runtime-collection-sources'
import type { RuntimeIterationContext } from './runtime-references/runtime-reference-resolver'
import { resolveRuntimeVisibleValue } from './runtime-references/runtime-reference-resolver'
import type { RuntimeState } from './runtime-state/runtime-state-types'

export interface ResolvedGalleryPhoto {
  key: string
  alt: string
  source:
    | { mode: 'src'; src: string }
    | { mode: 'fetch'; fetch: ImageFetchConfig; iterationContext?: RuntimeIterationContext }
}

export function resolveGalleryPhotos(
  node: GalleryLayoutNode,
  state: RuntimeState,
  options: { iterationContext?: RuntimeIterationContext } = {},
): ResolvedGalleryPhoto[] {
  if ('images' in node.props) {
    return resolveStaticGalleryPhotos(node.props.images, state, options.iterationContext)
  }

  return resolveDynamicGalleryPhotos(node.props.source, state, options.iterationContext)
}

function resolveStaticGalleryPhotos(
  images: GalleryStaticImage[],
  state: RuntimeState,
  iterationContext: RuntimeIterationContext | undefined,
): ResolvedGalleryPhoto[] {
  const photos: ResolvedGalleryPhoto[] = []

  images.forEach((image, index) => {
    const src = resolveRuntimeVisibleValue(image.src, state, 'gallery.props.images.src', { iterationContext })

    if (typeof src !== 'string' || src.length === 0) {
      return
    }

    const alt =
      normalizeGalleryTextValue(
        resolveRuntimeVisibleValue(image.alt, state, 'gallery.props.images.alt', { iterationContext }),
      ) ?? ''

    photos.push({ key: String(index), alt, source: { mode: 'src', src } })
  })

  return photos
}

function resolveDynamicGalleryPhotos(
  source: GalleryDynamicSource,
  state: RuntimeState,
  iterationContext: RuntimeIterationContext | undefined,
): ResolvedGalleryPhoto[] {
  const items = resolveCollectionSourceItems(source.source, state, { iterationContext })
  const photos: ResolvedGalleryPhoto[] = []
  const seenKeys = new Set<string>()

  items.forEach((item, index) => {
    const key = resolveGalleryItemKey(item, index, source.key, seenKeys)

    if (key === null) {
      return
    }

    const itemIterationContext: RuntimeIterationContext = { item, key, itemIndex: index }
    const alt = resolveGalleryDynamicAlt(source.alt, item, state, itemIterationContext)

    if (source.mode === 'fetch') {
      if (resolveGalleryFetchControlId(item, source.idField) === null) {
        return
      }

      photos.push({
        key,
        alt,
        source: { mode: 'fetch', fetch: source.fetch, iterationContext: itemIterationContext },
      })
      return
    }

    const src = resolveGalleryDynamicSrc(source.src, item, state, itemIterationContext)

    if (src === null) {
      return
    }

    photos.push({ key, alt, source: { mode: 'src', src } })
  })

  return photos
}

// Replicates repeater.props.items.key restricted to the array-only case (gallery never resolves
// a plain-object collection source, see resolveCollectionSourceItems), including its duplicate
// and "$index" semantics — see repeater.md.
function resolveGalleryItemKey(
  item: unknown,
  index: number,
  keyPath: string,
  seenKeys: Set<string>,
): string | null {
  if (keyPath === '$index') {
    return String(index)
  }

  if (keyPath === '$key') {
    return null
  }

  const resolvedPath = resolveGalleryItemPath(item, keyPath)

  if (!resolvedPath.found || (typeof resolvedPath.value !== 'string' && typeof resolvedPath.value !== 'number')) {
    return null
  }

  const candidateKey = String(resolvedPath.value)

  if (seenKeys.has(candidateKey)) {
    return null
  }

  seenKeys.add(candidateKey)
  return candidateKey
}

function resolveGalleryDynamicAlt(
  altPath: string,
  item: unknown,
  state: RuntimeState,
  iterationContext: RuntimeIterationContext,
): string {
  if (hasRuntimeTemplateDelimiter(altPath)) {
    return (
      normalizeGalleryTextValue(
        resolveRuntimeVisibleValue(altPath, state, 'gallery.props.images.alt', { iterationContext }),
      ) ?? ''
    )
  }

  const resolvedPath = resolveGalleryItemPath(item, altPath)
  return resolvedPath.found ? normalizeGalleryTextValue(resolvedPath.value) ?? '' : ''
}

function resolveGalleryDynamicSrc(
  srcPath: string,
  item: unknown,
  state: RuntimeState,
  iterationContext: RuntimeIterationContext,
): string | null {
  if (hasRuntimeTemplateDelimiter(srcPath)) {
    const resolvedValue = resolveRuntimeVisibleValue(srcPath, state, 'gallery.props.images.src', {
      iterationContext,
    })

    return typeof resolvedValue === 'string' && resolvedValue.length > 0 ? resolvedValue : null
  }

  const resolvedPath = resolveGalleryItemPath(item, srcPath)

  return resolvedPath.found && typeof resolvedPath.value === 'string' && resolvedPath.value.length > 0
    ? resolvedPath.value
    : null
}

// FR7: before triggering the per-photo fetch, gate on a control id — item[idField] when idField is
// declared, or the item itself otherwise — that must resolve to a non-empty string or a number. Not
// exposed as a new reference channel (D4): fetch.url/headers/body interpolation still only reads
// item.*, this is purely a validity gate ahead of resolveDynamicGalleryPhotos's photos.push.
function resolveGalleryFetchControlId(item: unknown, idField: string | undefined): string | number | null {
  const candidate = idField === undefined ? item : resolveGalleryFetchControlIdCandidate(item, idField)
  return isValidGalleryControlIdValue(candidate) ? candidate : null
}

function resolveGalleryFetchControlIdCandidate(item: unknown, idField: string): unknown {
  const resolvedPath = resolveGalleryItemPath(item, idField)
  return resolvedPath.found ? resolvedPath.value : undefined
}

function isValidGalleryControlIdValue(value: unknown): value is string | number {
  return typeof value === 'number' || (typeof value === 'string' && value.length > 0)
}

// Local equivalent of the private resolveCollectionItemPath in runtime-collection-sources.ts,
// which is not exported for reuse outside that module.
function resolveGalleryItemPath(item: unknown, path: string): { found: false } | { found: true; value: unknown } {
  const segments = path.split('.')
  let currentValue: unknown = item

  for (const segment of segments) {
    if (segment.length === 0) {
      return { found: false }
    }

    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return { found: false }
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return { found: false }
      }

      continue
    }

    if (!isGalleryPathRecord(currentValue) || !Object.hasOwn(currentValue, segment)) {
      return { found: false }
    }

    currentValue = currentValue[segment]
  }

  return { found: true, value: currentValue }
}

function isGalleryPathRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeGalleryTextValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}
