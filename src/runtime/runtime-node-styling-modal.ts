export function getModalOverlayClassName() {
  return 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 cursor-pointer'
}

const modalPanelSizeClassMap: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
}

export function getModalPanelClassName(size: 'sm' | 'md' | 'lg' = 'md') {
  return [
    'relative',
    'w-full',
    modalPanelSizeClassMap[size] ?? modalPanelSizeClassMap.md,
    'rounded-card',
    'border',
    'border-app-border-soft',
    'bg-white',
    'p-6',
    'shadow-shell',
    'cursor-auto',
    'sm:p-8',
    'max-h-[90vh]',
    'overflow-y-auto',
  ].join(' ')
}
