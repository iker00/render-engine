import type { LayoutNode, LayoutNodeCollection, RuntimePageConfig } from './runtime-config-types'

/**
 * For every `modal.id` declared across the given pages, resolves the identity of its nearest
 * ancestor `repeater` node, or `null` when the modal lives at page level (no repeater ancestor).
 *
 * Mirrors the exact recursion of `collectModalIds`/`collectModalIdsInFallbacks` in
 * `validate-runtime-config.ts` (modal, container, form, repeater, plus queryStateFeedback
 * fallback branches) so the set of modals discovered here never diverges from the set the
 * existing validation already knows about.
 */
export function computeModalRepeaterOwnership(
  pages: readonly RuntimePageConfig[],
): Map<string, string | null> {
  const ownership = new Map<string, string | null>()

  for (const page of pages) {
    collectModalRepeaterOwnership(page.layout, 'layout', page.id, null, ownership)
  }

  return ownership
}

function collectModalRepeaterOwnership(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  nearestRepeaterId: string | null,
  ownership: Map<string, string | null>,
): void {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodePath = `${path}[${i}]`

    collectModalRepeaterOwnershipInFallbacks(node, nodePath, pageId, nearestRepeaterId, ownership)

    if (node.type === 'modal') {
      ownership.set(node.id, nearestRepeaterId)

      if (node.children) {
        collectModalRepeaterOwnership(node.children, `${nodePath}.children`, pageId, nearestRepeaterId, ownership)
      }
    } else if ((node.type === 'container' || node.type === 'form') && node.children) {
      collectModalRepeaterOwnership(node.children, `${nodePath}.children`, pageId, nearestRepeaterId, ownership)
    } else if (node.type === 'repeater') {
      const repeaterId = `${pageId}::${nodePath}`
      collectModalRepeaterOwnership(node.props.template, `${nodePath}.props.template`, pageId, repeaterId, ownership)
    }
  }
}

function collectModalRepeaterOwnershipInFallbacks(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  nearestRepeaterId: string | null,
  ownership: Map<string, string | null>,
): void {
  if (!node.queryStateFeedback?.states) return

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
    if (!rule || rule.mode !== 'fallback') continue

    collectModalRepeaterOwnership(
      [...rule.fallback],
      `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
      pageId,
      nearestRepeaterId,
      ownership,
    )
  }
}
