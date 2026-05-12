import type { ParagraphLayoutNode } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getParagraphNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface ParagraphNodeProps {
  node: ParagraphLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ParagraphNode({ node, iterationContext }: ParagraphNodeProps) {
  const state = useRuntimeState()
  const text = resolveRuntimeTextReference(node.props.text, state, 'paragraph.props.text', { iterationContext })

  return (
    <p data-layout-node="paragraph" className={getParagraphNodeClassName()}>
      {text}
    </p>
  )
}
