import type { ReactNode } from 'react'
import type { SkeletonLayoutNode, SkeletonVariant } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getSkeletonAnimateClassName, getSkeletonBaseClassName } from '../runtime-node-styling'

interface SkeletonNodeProps {
  node: SkeletonLayoutNode
  iterationContext?: RuntimeIterationContext
}

interface SkeletonVariantContext {
  baseClass: string
  animateClass: string
  width: string | undefined
  height: string | undefined
  rounded: boolean
  lines: number
}

interface SkeletonVariantRender {
  className: string
  children: ReactNode
}

const skeletonVariantResolvers: Record<SkeletonVariant, (ctx: SkeletonVariantContext) => SkeletonVariantRender> = {
  rect: ({ baseClass, animateClass, width, height, rounded }) => {
    const widthClass = width ? `w-${width}` : ''
    const heightClass = height ? `h-${height}` : 'h-4'
    const roundedClass = rounded ? 'rounded' : ''
    return {
      className: [baseClass, 'block', heightClass, widthClass, roundedClass, animateClass]
        .filter(Boolean)
        .join(' '),
      children: null,
    }
  },
  circle: ({ baseClass, animateClass, width }) => {
    const sizeClass = width ? `w-${width} h-${width}` : 'w-12 h-12'
    return {
      className: [baseClass, 'rounded-full', sizeClass, animateClass].filter(Boolean).join(' '),
      children: null,
    }
  },
  text: ({ baseClass, animateClass, width, rounded, lines }) => {
    const lineWidthClass = width ? `w-${width}` : 'w-full'
    const lineRoundedClass = rounded ? 'rounded' : ''
    const lineClasses = [baseClass, 'h-3', lineWidthClass, lineRoundedClass].filter(Boolean).join(' ')
    return {
      className: ['flex', 'flex-col', 'gap-2', animateClass].filter(Boolean).join(' '),
      children: Array.from({ length: lines }, (_, i) => (
        <div key={i} className={lineClasses} />
      )),
    }
  },
}

export function SkeletonNode({ node }: SkeletonNodeProps) {
  const variant = node.props?.variant ?? 'rect'
  const animate = node.props?.animate ?? true
  const rounded = node.props?.rounded ?? false
  const width = node.props?.width
  const height = node.props?.height
  const lines = node.props?.lines ?? 1

  const { className, children } = skeletonVariantResolvers[variant]({
    baseClass: getSkeletonBaseClassName(),
    animateClass: getSkeletonAnimateClassName(animate),
    width,
    height,
    rounded,
    lines,
  })

  return (
    <div data-layout-node="skeleton" className={className}>
      {children}
    </div>
  )
}
