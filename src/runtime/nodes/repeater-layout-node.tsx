import type { RepeaterLayoutNode } from '../../config/runtime-config'
import { LayoutRenderer } from '../layout-renderer'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { resolveRuntimeReference } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface RepeaterNodeProps {
  node: RepeaterLayoutNode
}

export function RepeaterNode({ node }: RepeaterNodeProps) {
  const state = useRuntimeState()
  const items = resolveRepeaterItems(node.props.items.source, state)

  if (items.length === 0) {
    return null
  }

  const seenKeys = new Set<string>()

  return (
    <>
      {items.map((item, index) => {
        const resolvedKey = resolveRepeaterItemKey(item, node.props.items.key)

        if (resolvedKey === null) {
          reportRepeaterKeyDiagnostic(node, index, 'invalid')
          return null
        }

        const effectiveKey = String(resolvedKey)

        if (seenKeys.has(effectiveKey)) {
          reportRepeaterKeyDiagnostic(node, index, 'duplicate', effectiveKey)
          return null
        }

        seenKeys.add(effectiveKey)

        const iterationContext: RuntimeIterationContext = { item }

        return <LayoutRenderer key={effectiveKey} nodes={node.props.template} iterationContext={iterationContext} />
      })}
    </>
  )
}

function resolveRepeaterItems(source: string, state: ReturnType<typeof useRuntimeState>) {
  const result = resolveRuntimeReference(source, state)

  if (result.status !== 'resolved' || !Array.isArray(result.value)) {
    return []
  }

  return result.value
}

function resolveRepeaterItemKey(item: unknown, path: string): string | number | null {
  const segments = path.split('.')
  let currentValue = item

  for (const segment of segments) {
    if (segment.length === 0) {
      return null
    }

    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return null
      }

      currentValue = currentValue[Number(segment)]
      continue
    }

    if (typeof currentValue !== 'object' || currentValue === null) {
      return null
    }

    const objectValue = currentValue as Record<string, unknown>

    if (!Object.hasOwn(objectValue, segment)) {
      return null
    }

    currentValue = objectValue[segment]
  }

  return typeof currentValue === 'string' || typeof currentValue === 'number' ? currentValue : null
}

function reportRepeaterKeyDiagnostic(
  node: RepeaterLayoutNode,
  index: number,
  reason: 'invalid' | 'duplicate',
  key?: string,
) {
  if (!import.meta.env.DEV) {
    return
  }

  if (reason === 'duplicate') {
    console.warn(
      `[runtime-repeater] Skipping duplicate iteration key "${key ?? ''}" at repeater "${node.id ?? node.type}" item index ${index}.`,
    )
    return
  }

  console.warn(
    `[runtime-repeater] Skipping iteration with non-scalar or missing key at repeater "${node.id ?? node.type}" item index ${index}.`,
  )
}
