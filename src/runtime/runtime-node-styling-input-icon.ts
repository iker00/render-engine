export function getInputIconHolderClassName(position: 'left' | 'right' = 'left'): string {
  const borderClass = position === 'right' ? 'border-l' : 'border-r'
  return `flex items-center justify-center px-3 bg-neutral-50 ${borderClass} border-app-border-soft shrink-0`
}

export function getInputIconClassName(): string {
  return 'text-app-text-muted size-4 pointer-events-none'
}

export function getInputWithIconClassName(): string {
  return 'flex-1 min-w-0 bg-white px-3 py-2 text-sm leading-5 text-app-text placeholder:text-app-text-muted focus-visible:outline-none'
}

export function getInputIconWrapperClassName(hasError: boolean): string {
  return [
    'flex',
    'items-stretch',
    'w-full',
    'rounded-control',
    'border',
    'overflow-hidden',
    hasError ? 'border-app-danger' : 'border-app-border-soft',
    hasError ? 'focus-within:border-app-danger' : 'focus-within:border-app-accent',
    hasError ? 'focus-within:ring-app-danger' : 'focus-within:ring-app-accent',
    'focus-within:ring-2',
  ].join(' ')
}
