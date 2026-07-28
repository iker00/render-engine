const headingSizeClassMap: Record<number, string> = {
  1: 'text-lg sm:text-xl',
  2: 'text-base sm:text-lg',
  3: 'text-sm sm:text-base',
  4: 'text-sm sm:text-base',
  5: 'text-xs sm:text-sm',
  6: 'text-xs sm:text-sm',
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
  const weight = level <= 2 ? 'font-semibold' : 'font-medium'

  return [
    'm-0',
    ...(headingSizeClassMap[level] ?? headingSizeClassMap[6]).split(' '),
    weight,
    'leading-tight',
    'tracking-[-0.03em]',
    'text-app-text-strong',
  ].join(' ')
}

export function getParagraphNodeClassName() {
  return 'm-0 text-sm leading-6 text-app-text-muted sm:text-base sm:leading-7'
}

export function getListNodeClassName() {
  return 'm-0 grid list-disc gap-3 pl-5 text-app-text marker:text-app-accent'
}

export function getListItemClassName() {
  return 'leading-7'
}

export function getImageNodeClassName() {
  return 'block max-w-full rounded-card border border-app-border-soft bg-app-surface-subtle object-cover'
}

export function getLinkNodeClassName() {
  return 'inline-flex items-center text-primary-600 underline hover:text-primary-800 transition-colors font-medium'
}
