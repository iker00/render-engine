import * as LucideIcons from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { createElement } from 'react'

interface IconNodeProps {
  name: string | undefined
  className?: string
}

type LucideIconComponent = ComponentType<SVGProps<SVGSVGElement> & { 'aria-hidden'?: string }>

export function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function IconNode({ name, className }: IconNodeProps) {
  if (!name) return null

  const resolved = toPascalCase(name)
  const candidate = (LucideIcons as Record<string, unknown>)[resolved]

  if (!candidate || (typeof candidate !== 'function' && typeof candidate !== 'object')) return null

  const IconComponent = candidate as LucideIconComponent

  return createElement(IconComponent, { 'aria-hidden': 'true', className })
}
