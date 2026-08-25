import type { LayoutNodeType } from './runtime-config-types'

/**
 * Leaf node types that only ever make sense as descendants of a `form` node.
 * Mirrors the inline type lists previously repeated in `validate-form-nodes.ts`
 * (`validateFormNodesInCollection` and `validateFormChildren`).
 */
export const FORM_ONLY_LEAF_NODE_TYPES: ReadonlySet<LayoutNodeType> = new Set([
  'input',
  'textarea',
  'select',
  'radioGroup',
  'checkboxGroup',
  'fileInput',
  'toggle',
  'hidden',
])

/**
 * A `button` node requires a `form` ancestor unless it declares its own `props.action`.
 * Uses optional chaining so it tolerates synthetic nodes without `props` (e.g. a
 * palette-originated drag preview node), where the absence of `props.action` also
 * means "requires a form ancestor".
 */
export function buttonRequiresFormAncestor(node: { props?: { action?: unknown } }): boolean {
  return node.props?.action === undefined
}

/**
 * Closed catalogue of node types allowed as descendants of a `form` node (including
 * nested via `container`/`accordion`/`tabs`). Mirrors the inline list previously
 * repeated in `validateFormChildren`.
 */
export const FORM_ALLOWED_DESCENDANT_TYPES: ReadonlySet<LayoutNodeType> = new Set([
  'input',
  'textarea',
  'select',
  'radioGroup',
  'checkboxGroup',
  'fileInput',
  'toggle',
  'hidden',
  'button',
  'heading',
  'paragraph',
  'image',
  'table',
  'container',
  'accordion',
  'divider',
  'tabs',
  'steps',
])

/**
 * Node types whose `children` collection is interpreted directly at the node's root.
 * Reuses the same contract already enforced by production rendering:
 * `hasChildren()` in `src/runtime/layout-renderer.tsx` for container/form/modal/link,
 * and `src/runtime/nodes/accordion-layout-node.tsx` for accordion.
 *
 * `tabs` is intentionally excluded: it does not accept children at its root, only
 * per-tab via `props.items[i].children`. `repeater` is intentionally excluded: it
 * only accepts `props.template`.
 */
export function nodeTypeAcceptsChildren(type: LayoutNodeType): boolean {
  return type === 'container' || type === 'form' || type === 'modal' || type === 'link' || type === 'accordion'
}

/**
 * Relocated from `validate-layout-nodes.ts` (was a local, unexported `Set`) so it can
 * be reused by the canvas drop-validity engine without duplicating the catalogue.
 */
export const MODAL_ALLOWED_CHILD_TYPES: ReadonlySet<LayoutNodeType> = new Set([
  'container',
  'form',
  'heading',
  'paragraph',
  'list',
  'image',
  'table',
  'button',
  'repeater',
  'accordion',
  'fileManager',
])

/**
 * Relocated from `validate-layout-nodes.ts` (was a local, unexported `Set`) so it can
 * be reused by the canvas drop-validity engine without duplicating the catalogue.
 */
export const LINK_ALLOWED_CHILD_TYPES: ReadonlySet<LayoutNodeType> = new Set([
  'container',
  'heading',
  'paragraph',
  'list',
  'image',
  'badge',
  'alert',
  'stat',
  'divider',
  'skeleton',
])
