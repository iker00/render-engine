import type { LayoutNode, RuntimeConfig, RuntimeConfigError, RuntimePreloadConfig } from '../../config/runtime-config'

/**
 * Result of `commitCanvasMutation` (T4, `dev-runtime.tsx`). Declared here — not in
 * `dev-runtime.tsx` — so both `dev-runtime.tsx` (which owns the real implementation) and
 * `layout-canvas.tsx` (T14, which needs the type for its `onCommitCanvasMutation` prop) can
 * import it without a circular module dependency (`dev-runtime.tsx` already imports from this
 * file). `dev-runtime.tsx` re-exports it so existing external imports of
 * `CommitCanvasMutationResult` from `dev-runtime.tsx` keep working unchanged.
 */
export type CommitCanvasMutationResult = { status: 'applied' } | { status: 'rejected'; error: RuntimeConfigError }

/**
 * Builds a candidate RuntimeConfig with the layout of `activePageId` replaced by
 * `mutate(currentLayout)`. Every other page, plus `api`/`initialPage`/`tokens`/
 * `translations`, is carried over unchanged. Never mutates `currentConfig`.
 *
 * The result is only ever used to compute the mutated layout in memory (for
 * validation and for extracting the new page layout) — never serialized to text
 * directly. See `patchRawConfigTextWithLayout` for the text-patching path.
 */
export function buildCommitCandidateConfig(
  currentConfig: RuntimeConfig,
  activePageId: string,
  mutate: (pageLayout: LayoutNode[]) => LayoutNode[],
): RuntimeConfig {
  const nextPages = currentConfig.pages.map((page) => {
    if (page.id !== activePageId) return page
    return { ...page, layout: mutate(page.layout) }
  })

  return { ...currentConfig, pages: nextPages }
}

type FormNodeLike = Extract<LayoutNode, { type: 'form' }>

function hasChildrenCollection(
  node: LayoutNode,
): node is LayoutNode & { children?: LayoutNode[] } {
  return (
    node.type === 'container' ||
    node.type === 'form' ||
    node.type === 'modal' ||
    node.type === 'link' ||
    node.type === 'accordion'
  )
}

function denormalizeFormNode(node: FormNodeLike): unknown {
  const { onSuccess, onError, submitAction, children, ...rest } = node

  const denormalizedChildren = children ? denormalizeFormNodesForSerialization(children) : undefined

  if (onSuccess === undefined && onError === undefined) {
    return {
      ...rest,
      ...(submitAction !== undefined ? { submitAction } : {}),
      ...(denormalizedChildren !== undefined ? { children: denormalizedChildren } : {}),
    }
  }

  const nextSubmitAction: Record<string, unknown> = { ...(submitAction ?? {}) }
  if (onSuccess !== undefined) nextSubmitAction.onSuccess = onSuccess
  if (onError !== undefined) nextSubmitAction.onError = onError

  return {
    ...rest,
    submitAction: nextSubmitAction,
    ...(denormalizedChildren !== undefined ? { children: denormalizedChildren } : {}),
  }
}

/**
 * Recursively walks a `layout` tree (children of container/form/modal/link/
 * accordion, repeater.props.template, tabs.props.items[].children) and, for
 * every `form` node that declares `onSuccess`/`onError` as internal top-level
 * fields (the normalized `FormLayoutNode` shape — see `runtime-config-types.ts`),
 * nests them back inside `submitAction` so the result is safe to serialize and
 * re-validate as raw config JSON (the shape `validateRuntimeConfig` expects).
 *
 * This is the *only* raw/normalized divergence confirmed within `layout` (see
 * design.md, Contexto). If a future feature introduces a new node/field whose
 * validation reshapes the raw input the same way, this function must be
 * extended for that case too — it is a closed list, not a generic mechanism.
 */
export function denormalizeFormNodesForSerialization(nodes: readonly LayoutNode[]): unknown[] {
  return nodes.map((node) => {
    if (node.type === 'form') {
      return denormalizeFormNode(node)
    }

    if (node.type === 'repeater') {
      return {
        ...node,
        props: { ...node.props, template: denormalizeFormNodesForSerialization(node.props.template) },
      }
    }

    if (node.type === 'tabs') {
      return {
        ...node,
        props: {
          ...node.props,
          items: node.props.items.map((item) =>
            item.children
              ? { ...item, children: denormalizeFormNodesForSerialization(item.children) }
              : item,
          ),
        },
      }
    }

    if (hasChildrenCollection(node) && node.children) {
      return { ...node, children: denormalizeFormNodesForSerialization(node.children) }
    }

    return node
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Patches a single top-level key of `rawConfigText`, leaving every other root key exactly as it
 * was in the raw text — never reserializes the rest of the document from an in-memory
 * `RuntimeConfig` (see `patchRawConfigTextWithLayout`, whose `pages` patch this generalizes, and
 * design.md/0122-T5's Shell config panel, which uses this directly for the `shell` key).
 *
 * `value === undefined` removes the key entirely rather than writing a literal `"key": undefined`
 * (not valid JSON) — this is how the Shell panel's "deactivate header" toggle drops `shell`
 * from the document instead of leaving a stray empty block behind.
 */
export function patchRootKey(rawConfigText: string, key: string, value: unknown): string {
  const rawConfigObject = JSON.parse(rawConfigText) as Record<string, unknown>

  if (value === undefined) {
    const { [key]: _removed, ...rest } = rawConfigObject
    return JSON.stringify(rest, null, 2)
  }

  return JSON.stringify({ ...rawConfigObject, [key]: value }, null, 2)
}

/**
 * Patches only the `layout` key of the page `activePageId` inside `rawConfigText`,
 * leaving the rest of the document (other pages, their `preloads`/`title`, `api`,
 * `initialPage`, `tokens`, `translations`) exactly as it was in the raw text.
 * Never reserializes the document from an in-memory `RuntimeConfig` — this is
 * what keeps `preloads` in its raw crude shape (see design.md, Contexto).
 */
export function patchRawConfigTextWithLayout(
  rawConfigText: string,
  activePageId: string,
  mutatedLayout: readonly LayoutNode[],
): string {
  const rawConfigObject = JSON.parse(rawConfigText) as Record<string, unknown>
  const rawPages = Array.isArray(rawConfigObject.pages) ? rawConfigObject.pages : []

  const nextPages = rawPages.map((rawPage) => {
    if (isRecord(rawPage) && rawPage.id === activePageId) {
      return { ...rawPage, layout: denormalizeFormNodesForSerialization(mutatedLayout) }
    }
    return rawPage
  })

  return patchRootKey(rawConfigText, 'pages', nextPages)
}

/**
 * Converts the normalized `RuntimePreloadConfig[]` shape (`{ operationName, requestParams,
 * when? }`, the shape `validateRuntimeConfig` produces and `ApiConfigPanel`/`PreloadsListEditor`
 * edit in memory) back into the raw shape `validatePreloadEntries`
 * (`src/config/validate-preloads.ts`) actually accepts on input: one object per entry whose only
 * key (besides an optional sibling `when`) *is* the operation name, with `requestParams` as that
 * key's value — e.g. `{ "loadUsers": { "query": { "page": "2" } } }`. Serializing the normalized
 * shape as-is (`{ "operationName": "loadUsers", "requestParams": {...} }`) is a 2-key object
 * without `when`, which `validatePreloadEntries` rejects as "must be an object with exactly one
 * non-empty operationName key" — this is the raw/normalized divergence `preloads` has of its own,
 * on top of (not replacing) the `layout`-specific one `denormalizeFormNodesForSerialization`
 * already guards against.
 */
export function denormalizePreloadsForSerialization(
  preloads: readonly RuntimePreloadConfig[],
): unknown[] {
  return preloads.map((preload) => {
    const entry: Record<string, unknown> = { [preload.operationName]: preload.requestParams }
    if (preload.when !== undefined) {
      entry.when = preload.when
    }
    return entry
  })
}

/**
 * Patches only the `preloads` key of the page `activePageId` inside `rawConfigText` — sibling
 * function to `patchRawConfigTextWithLayout` (same technique: parse, replace only the targeted
 * page's key inside the raw `pages` array, delegate to `patchRootKey` for `pages`), but for
 * `preloads` instead of `layout`. An `undefined` or empty `mutatedPreloads` drops the `preloads`
 * key from that page's object entirely, rather than leaving a stray `"preloads": []` behind —
 * same "no empty residual block" criterion `commitShellSectionToggle` (`ShellConfigPanel`)
 * already applies when deactivating a shell section. A non-empty `mutatedPreloads` is written
 * through `denormalizePreloadsForSerialization`, not as-is, to round-trip correctly through
 * `validateRuntimeConfig`.
 */
export function patchRawConfigTextWithPagePreloads(
  rawConfigText: string,
  activePageId: string,
  mutatedPreloads: readonly RuntimePreloadConfig[] | undefined,
): string {
  const rawConfigObject = JSON.parse(rawConfigText) as Record<string, unknown>
  const rawPages = Array.isArray(rawConfigObject.pages) ? rawConfigObject.pages : []

  const nextPages = rawPages.map((rawPage) => {
    if (!isRecord(rawPage) || rawPage.id !== activePageId) return rawPage
    if (mutatedPreloads === undefined || mutatedPreloads.length === 0) {
      const { preloads: _removed, ...rest } = rawPage
      return rest
    }
    return { ...rawPage, preloads: denormalizePreloadsForSerialization(mutatedPreloads) }
  })

  return patchRootKey(rawConfigText, 'pages', nextPages)
}
