export function getAccordionHeaderClassName() {
  return [
    'w-full',
    'text-left',
    'px-4',
    'py-2',
    'font-medium',
    'flex',
    'items-center',
    'justify-between',
    'bg-primary-50',
    'cursor-pointer',
    'hover:bg-primary-100',
    'focus:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-primary-600',
    'transition-colors',
  ].join(' ')
}

export function getAccordionChevronClassName(isOpen: boolean) {
  return [
    'h-4',
    'w-4',
    'text-primary-600',
    'transition-transform',
    'duration-200',
    'ease-out',
    ...(isOpen ? ['rotate-180'] : []),
  ].join(' ')
}

export function getAccordionBodyClassName() {
  return 'px-4 py-2 flex flex-col gap-5'
}

export function getAccordionBodyAnimationClassName(isOpen: boolean) {
  return isOpen ? 'animate-accordion-open' : 'animate-accordion-close'
}
