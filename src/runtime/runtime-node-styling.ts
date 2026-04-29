import type { CSSProperties } from 'react'

const containerGapClassMap: Record<string, string> = {
  sm: 'gap-3',
  md: 'gap-5',
  lg: 'gap-8',
}

const headingSizeClassMap: Record<number, string> = {
  1: 'text-5xl',
  2: 'text-4xl',
  3: 'text-3xl',
  4: 'text-2xl',
  5: 'text-xl',
  6: 'text-lg',
}

interface ContainerNodeStylingOptions {
  direction?: string
  gap?: string
}

interface ContainerNodeStyling {
  className: string
  style?: CSSProperties
}

type ContainerGapStyle = CSSProperties & {
  '--runtime-container-gap': string
}

export function getContainerNodeStyling({ direction, gap }: ContainerNodeStylingOptions): ContainerNodeStyling {
  const classNames = ['flex', 'w-full', direction === 'row' ? 'flex-row' : 'flex-col']

  if (!gap) {
    return {
      className: classNames.join(' '),
    }
  }

  const mappedGapClassName = containerGapClassMap[gap]

  if (mappedGapClassName) {
    return {
      className: [...classNames, mappedGapClassName].join(' '),
    }
  }

  return {
    className: [...classNames, 'gap-[var(--runtime-container-gap)]'].join(' '),
    style: {
      '--runtime-container-gap': gap,
    } satisfies ContainerGapStyle,
  }
}

export function getHeadingTag(level: number) {
  if (level <= 1) {
    return 'h1'
  }

  if (level === 2) {
    return 'h2'
  }

  if (level === 3) {
    return 'h3'
  }

  if (level === 4) {
    return 'h4'
  }

  if (level === 5) {
    return 'h5'
  }

  return 'h6'
}

export function getHeadingNodeClassName(level: number) {
  return [
    'm-0',
    headingSizeClassMap[level] ?? headingSizeClassMap[6],
    'font-semibold',
    'leading-tight',
    'tracking-[-0.03em]',
    'text-slate-50',
  ].join(' ')
}

export function getParagraphNodeClassName() {
  return 'm-0 text-base leading-7 text-slate-300'
}

export function getListNodeClassName() {
  return 'm-0 grid list-disc gap-2 pl-5 text-slate-200'
}

export function getListItemClassName() {
  return 'leading-6'
}

export function getButtonNodeClassName() {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'self-start',
    'rounded-md',
    'border',
    'border-slate-300/20',
    'bg-slate-200',
    'px-4',
    'py-2',
    'text-sm',
    'font-medium',
    'text-slate-950',
    'transition-colors',
    'hover:bg-white',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-slate-200',
  ].join(' ')
}
