import type { ImageFetchConfig, ImageLayoutNode } from '../../config/runtime-config'
import {
  resolveRuntimeImageAlt,
  resolveRuntimeImageSource,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { getImageNodeClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { useImageFetchSource } from './use-image-fetch-source'

interface ImageNodeProps {
  node: ImageLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ImageNode({ node, iterationContext }: ImageNodeProps) {
  const state = useRuntimeState()

  if ('fetch' in node.props) {
    return (
      <ImageNodeWithFetch
        fetchConfig={node.props.fetch}
        alt={node.props.alt}
        iterationContext={iterationContext}
        state={state}
      />
    )
  }

  const src = resolveRuntimeImageSource(node.props.src, state, { iterationContext })

  if (src === null) {
    return null
  }

  const alt = resolveRuntimeImageAlt(node.props.alt, state, { iterationContext })

  return <img data-layout-node="image" className={getImageNodeClassName()} src={src} alt={alt} />
}

interface ImageNodeWithFetchProps {
  fetchConfig: ImageFetchConfig
  alt: string
  iterationContext?: RuntimeIterationContext
  state: ReturnType<typeof useRuntimeState>
}

function ImageNodeWithFetch({ fetchConfig, alt: altProp, iterationContext, state }: ImageNodeWithFetchProps) {
  const { src } = useImageFetchSource(fetchConfig, iterationContext)

  if (src === null) {
    return null
  }

  const alt = resolveRuntimeImageAlt(altProp, state, { iterationContext })

  return <img data-layout-node="image" className={getImageNodeClassName()} src={src} alt={alt} />
}
