export function getGalleryPhotoTileButtonClassName(): string {
  return 'group block w-full overflow-hidden rounded-card border border-app-border-soft bg-app-surface-subtle text-left cursor-pointer transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
}

export function getGalleryPhotoTileImageClassName(): string {
  return 'aspect-square h-full w-full object-cover transition-transform group-hover:scale-105'
}

export function getGalleryPaginatedGridClassName(): string {
  return 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'
}

export function getGalleryPaginationControlsClassName(): string {
  return 'flex w-full flex-wrap items-center justify-center gap-3 pt-4'
}

export function getGalleryPaginationButtonClassName(): string {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-control',
    'border',
    'border-app-border-strong',
    'bg-white',
    'px-3',
    'py-1.5',
    'text-sm',
    'font-semibold',
    'leading-5',
    'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-app-surface-subtle',
    'disabled:cursor-not-allowed',
    'disabled:border-app-border-soft',
    'disabled:text-app-text-muted',
    'disabled:hover:bg-white',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getGalleryPaginationCurrentButtonClassName(): string {
  return getGalleryPaginationButtonClassName()
    .replace('border-app-border-strong', 'border-app-accent')
    .replace('bg-white', 'bg-app-accent')
    .replace('text-app-text-strong', 'text-white')
    .replace('hover:bg-app-surface-subtle', 'hover:bg-app-accent-strong')
}

export function getGalleryCarouselViewportClassName(): string {
  return 'overflow-hidden'
}

export function getGalleryCarouselContainerClassName(): string {
  return 'flex gap-4'
}

// Standard embla-carousel-react technique: each slide's flex-basis is 100 / visibleCount so
// `visibleCount` slides are visible simultaneously, without any extra library-side logic.
const GALLERY_CAROUSEL_SLIDE_FLEX_BASIS: Record<number, string> = {
  1: 'basis-full',
  2: 'basis-1/2',
  3: 'basis-1/3',
}

export function getGalleryCarouselSlideClassName(visibleCount: number): string {
  const flexBasis = GALLERY_CAROUSEL_SLIDE_FLEX_BASIS[visibleCount] ?? GALLERY_CAROUSEL_SLIDE_FLEX_BASIS[1]
  return `min-w-0 shrink-0 grow-0 ${flexBasis}`
}

export function getGalleryCarouselControlsClassName(): string {
  return 'flex items-center justify-center gap-3 pt-4'
}

export function getGalleryCarouselArrowButtonClassName(): string {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-full',
    'border',
    'border-app-border-strong',
    'bg-white',
    'p-2',
    'text-app-text-strong',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-app-surface-subtle',
    'disabled:cursor-not-allowed',
    'disabled:border-app-border-soft',
    'disabled:text-app-text-muted',
    'disabled:hover:bg-white',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-app-accent',
  ].join(' ')
}

export function getGalleryLightboxOverlayClassName(): string {
  return 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer'
}

export function getGalleryLightboxPanelClassName(): string {
  return 'relative flex max-h-[90vh] max-w-[90vw] items-center justify-center gap-4 cursor-auto'
}

export function getGalleryLightboxImageClassName(): string {
  return 'max-h-[85vh] max-w-[80vw] rounded-card object-contain'
}

export function getGalleryLightboxCloseButtonClassName(): string {
  return [
    'absolute',
    '-top-10',
    'right-0',
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-full',
    'border',
    'border-white/60',
    'bg-black/50',
    'p-2',
    'text-white',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-black/70',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-white',
  ].join(' ')
}

export function getGalleryEmptyPlaceholderClassName(): string {
  return 'rounded-control border border-dashed border-app-border-strong p-4 text-center text-sm text-app-text-muted'
}

export function getGalleryLightboxNavButtonClassName(): string {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-full',
    'border',
    'border-white/60',
    'bg-black/50',
    'p-2',
    'text-white',
    'transition-colors',
    'cursor-pointer',
    'hover:bg-black/70',
    'disabled:cursor-not-allowed',
    'disabled:opacity-40',
    'disabled:hover:bg-black/50',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-white',
  ].join(' ')
}
