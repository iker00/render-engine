import type { SkeletonLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getSkeletonAnimateClassName, getSkeletonBaseClassName } from '../runtime-node-styling'

interface SkeletonNodeProps {
  node: SkeletonLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function SkeletonNode({ node }: SkeletonNodeProps) {
  const variant = node.props?.variant ?? 'rect'
  const animate = node.props?.animate ?? true
  const rounded = node.props?.rounded ?? false
  const width = node.props?.width
  const height = node.props?.height
  const lines = node.props?.lines ?? 1

  const baseClass = getSkeletonBaseClassName()
  const animateClass = getSkeletonAnimateClassName(animate)

  if (variant === 'text') {
    const wrapperClasses = ['flex', 'flex-col', 'gap-2', animateClass].filter(Boolean).join(' ')
    const lineWidthClass = width ? `w-${width}` : 'w-full'
    const lineRoundedClass = rounded ? 'rounded' : ''
    const lineClasses = [baseClass, 'h-3', lineWidthClass, lineRoundedClass].filter(Boolean).join(' ')

    return (
      <div data-layout-node="skeleton" className={wrapperClasses}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={lineClasses} />
        ))}
      </div>
    )
  }

  if (variant === 'circle') {
    const sizeClass = width ? `w-${width} h-${width}` : 'w-12 h-12'
    const circleClasses = [baseClass, 'rounded-full', sizeClass, animateClass].filter(Boolean).join(' ')

    return <div data-layout-node="skeleton" className={circleClasses} />
  }

  // rect (default)
  const widthClass = width ? `w-${width}` : ''
  const heightClass = height ? `h-${height}` : 'h-4'
  const roundedClass = rounded ? 'rounded' : ''
  const rectClasses = [baseClass, 'block', heightClass, widthClass, roundedClass, animateClass]
    .filter(Boolean)
    .join(' ')

  return <div data-layout-node="skeleton" className={rectClasses} />
}
