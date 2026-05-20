import type { ImageLayoutNode } from '../../config/runtime-config'
import {
  resolveRuntimeImageAlt,
  resolveRuntimeImageSource,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { getImageNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface ImageNodeProps {
  node: ImageLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ImageNode({ node, iterationContext }: ImageNodeProps) {
  const state = useRuntimeState()
  const src = resolveRuntimeImageSource(node.props.src, state, { iterationContext })

  if (src === null) {
    return null
  }

  const alt = resolveRuntimeImageAlt(node.props.alt, state, { iterationContext })

  return <img data-layout-node="image" className={getImageNodeClassName()} src={src} alt={alt} />
}
