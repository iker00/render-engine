export function getTabsRootClassName(orientation: 'horizontal' | 'vertical') {
  return orientation === 'vertical' ? 'flex flex-row' : 'flex flex-col'
}

export function getTabsBarClassName(orientation: 'horizontal' | 'vertical') {
  return orientation === 'vertical'
    ? 'flex flex-col w-48 shrink-0'
    : 'flex flex-row overflow-x-auto scrollbar-hide'
}

export function getTabsButtonClassName(isActive: boolean, orientation: 'horizontal' | 'vertical') {
  const orientationClasses =
    orientation === 'vertical'
      ? 'text-left whitespace-normal break-words'
      : 'shrink-0 whitespace-nowrap'

  if (isActive) {
    const borderClasses =
      orientation === 'vertical'
        ? ['border-t', 'border-l', 'border-b', 'border-app-border-soft']
        : ['border-t', 'border-l', 'border-r', 'border-app-border-soft']

    const overlapClass = orientation === 'vertical' ? '-mr-px' : '-mb-px'

    return [
      ...borderClasses,
      overlapClass,
      'relative',
      'z-10',
      'bg-app-background',
      'text-primary-700',
      'font-semibold',
      'px-3',
      'py-1.5',
      'transition-colors',
      'cursor-pointer',
      orientationClasses,
    ].join(' ')
  }

  return [
    'text-app-text-muted',
    'hover:text-app-text-strong',
    'font-medium',
    'px-3',
    'py-1.5',
    'transition-colors',
    'cursor-pointer',
    orientationClasses,
  ].join(' ')
}

export function getTabsPanelClassName() {
  return 'flex-1 border border-app-border-soft p-4 flex flex-col gap-5'
}
