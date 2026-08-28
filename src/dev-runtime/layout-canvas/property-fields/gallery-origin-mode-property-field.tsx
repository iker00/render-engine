import type { GalleryDynamicSource, LayoutNode } from '../../../config/runtime-config'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'

type GalleryNode = Extract<LayoutNode, { type: 'gallery' }>

// The two mutually exclusive origins `gallery.props` can take (props.images vs props.source, T1 of
// feature 2026-08-25-14-49-gallery-node): "Estático" (a manual `images` array) or "Dinámico" (a
// `source` resolved from a collection at runtime). No other shape is part of the contract.
type GalleryOriginMode = 'static' | 'dynamic'

const SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'static', label: 'Estático' },
  { value: 'dynamic', label: 'Dinámico' },
]

// Minimal, structurally valid template seeded when reconstructing "Dinámico" from "Estático" —
// same "switching modes always replaces the value wholesale" rule as `ChoiceItemsPropertyField`'s
// `MODE_DEFAULTS`. `key: '$index'` is the simplest always-valid choice (T1's contract: `"$key"`,
// `"$index"`, or a non-empty relative path); the user edits `source`/`alt`/`src` from there.
//
// `source`/`alt`/`src` cannot be seeded empty like `ContainerColumnsModePropertyField`'s `columns`
// or `toStaticMode`'s `images: []` below: they're `nonEmptyStringSchema` in `runtime-config-zod.ts`
// (T1), so an empty seed makes the very first "Dinámico" commit fail full-config validation every
// time (`commitCanvasMutation` validates the whole config, not just this node) — the toggle would
// then show "Dinámico" via `pendingRejections.galleryOriginMode` while the Props tab below, which
// reads the real (still-static) node, never switches to the source editor at all, leaving the user
// with no field to fix the value from. These placeholders are syntactically valid on their own
// (`queries.query.data` parses as a well-formed, if likely nonexistent, query reference; `alt`/`src`
// are valid relative item paths) purely so the mode switch commits immediately — the user is
// expected to overwrite all three by hand afterwards, same as any other seeded default in this file.
const DEFAULT_DYNAMIC_SOURCE: GalleryDynamicSource = {
  source: 'queries.query.data',
  key: '$index',
  alt: 'alt',
  mode: 'src',
  src: 'src',
}

// Detects the origin from `props.images` presence alone, mirroring `resolveGalleryPhotos`'s own
// `'images' in node.props` narrowing (`runtime-gallery-photos.ts`) — the same criterion the runtime
// uses to pick a branch.
function detectMode(node: GalleryNode): GalleryOriginMode {
  return 'images' in node.props ? 'static' : 'dynamic'
}

// "Dinámico" -> "Estático": drops `source` entirely, seeds an empty `images` array. `display`
// (the only field common to both origin shapes) survives untouched.
function toStaticMode(node: GalleryNode): GalleryNode {
  return { ...node, props: { images: [], display: node.props.display } }
}

// "Estático" -> "Dinámico": drops `images` entirely, seeds `DEFAULT_DYNAMIC_SOURCE`. `display`
// survives untouched. Edge case (same as `ContainerColumnsModePropertyField`'s Columnas round trip):
// a previously edited `images` array is not remembered — a later "Dinámico" -> "Estático" round trip
// seeds a fresh `[]`, not the discarded array.
function toDynamicMode(node: GalleryNode): GalleryNode {
  return { ...node, props: { source: DEFAULT_DYNAMIC_SOURCE, display: node.props.display } }
}

export interface GalleryOriginModePropertyFieldProps {
  label: string
  node: GalleryNode
  onChange: (node: GalleryNode) => void
}

/**
 * Dedicated widget for the `gallery` node's mutually exclusive origin (T1, feature
 * 2026-08-25-14-49-gallery-node): "Estático" (`props.images`) vs "Dinámico" (`props.source`),
 * detected from `props.images` presence. Same full-node write scope as
 * `ContainerColumnsModePropertyField`/`LinkContentModePropertyField` — the panel wires this
 * widget's `onChange` to `onCommitNodeUpdate(path, (currentNode) => nextNode)` rather than the
 * generic per-subsection `props` patch the rest of `Props` uses, and renders it as a special block
 * at the top of the `Props` tabpanel, before the dispatcher-driven fields.
 *
 * The dispatcher-driven fields below stay in sync via `resolveGalleryPropsSchema`
 * (`layout-canvas-properties-panel.tsx`), which hides whichever of `images`/`source` isn't the
 * active origin — this widget only owns the toggle itself, not the origin-specific editors.
 */
export function GalleryOriginModePropertyField({ label, node, onChange }: GalleryOriginModePropertyFieldProps) {
  const mode = detectMode(node)

  function handleModeChange(nextMode: string | number) {
    if (nextMode === mode) return
    onChange(nextMode === 'dynamic' ? toDynamicMode(node) : toStaticMode(node))
  }

  return <SegmentedTogglePropertyField label={label} segments={SEGMENTS} activeValue={mode} onSelect={handleModeChange} />
}
