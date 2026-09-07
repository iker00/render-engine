import { useContext } from 'react'
import type { ParagraphLayoutNode } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { RuntimeGroupContextProvider } from '../runtime-references/runtime-group-context'
import { getParagraphNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { IconNode } from './icon-node'

interface ParagraphNodeProps {
  node: ParagraphLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ParagraphNode({ node, iterationContext }: ParagraphNodeProps) {
  const state = useRuntimeState()
  // `group.*` (T12 / feature reusable-node-groups): read via React context, not prop drilling —
  // any node placed inside a `groups[groupId].template` can resolve it this way regardless of
  // depth, without every intermediate layout node needing to forward it explicitly.
  const groupContext = useContext(RuntimeGroupContextProvider)
  const text = resolveRuntimeTextReference(node.props.text, state, 'paragraph.props.text', {
    iterationContext,
    groupContext,
  })

  return (
    <p data-layout-node="paragraph" className={getParagraphNodeClassName()}>
      <IconNode name={node.props.icon} className="size-[1em] shrink-0 inline-block align-middle mr-2" />
      {text}
    </p>
  )
}
