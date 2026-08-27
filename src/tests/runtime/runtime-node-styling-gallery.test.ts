import { describe, expect, it } from 'vitest'
import {
  getGalleryCarouselArrowButtonClassName,
  getGalleryCarouselContainerClassName,
  getGalleryCarouselControlsClassName,
  getGalleryCarouselSlideClassName,
  getGalleryCarouselViewportClassName,
  getGalleryEmptyPlaceholderClassName,
  getGalleryLightboxCloseButtonClassName,
  getGalleryLightboxImageClassName,
  getGalleryLightboxNavButtonClassName,
  getGalleryLightboxOverlayClassName,
  getGalleryLightboxPanelClassName,
  getGalleryPaginatedGridClassName,
  getGalleryPaginationButtonClassName,
  getGalleryPaginationControlsClassName,
  getGalleryPaginationCurrentButtonClassName,
  getGalleryPhotoTileButtonClassName,
  getGalleryPhotoTileImageClassName,
} from '../../runtime/runtime-node-styling-gallery'

describe('runtime-node-styling-gallery', () => {
  describe('getGalleryPhotoTileButtonClassName', () => {
    it('returns a non-empty Tailwind class string', () => {
      const className = getGalleryPhotoTileButtonClassName()

      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryPhotoTileButtonClassName()).toBe(getGalleryPhotoTileButtonClassName())
    })
  })

  describe('getGalleryPhotoTileImageClassName', () => {
    it('returns a non-empty Tailwind class string including object-fit cover behavior', () => {
      const className = getGalleryPhotoTileImageClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('object-cover')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryPhotoTileImageClassName()).toBe(getGalleryPhotoTileImageClassName())
    })
  })

  describe('getGalleryPaginatedGridClassName', () => {
    it('returns a Tailwind grid class string', () => {
      const className = getGalleryPaginatedGridClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('grid')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryPaginatedGridClassName()).toBe(getGalleryPaginatedGridClassName())
    })
  })

  describe('getGalleryPaginationControlsClassName', () => {
    it('returns a non-empty Tailwind class string', () => {
      const className = getGalleryPaginationControlsClassName()

      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryPaginationControlsClassName()).toBe(getGalleryPaginationControlsClassName())
    })
  })

  describe('getGalleryPaginationButtonClassName', () => {
    it('returns a non-empty Tailwind class string', () => {
      const className = getGalleryPaginationButtonClassName()

      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryPaginationButtonClassName()).toBe(getGalleryPaginationButtonClassName())
    })
  })

  describe('getGalleryPaginationCurrentButtonClassName', () => {
    it('differs from the default button class name to signal the active page', () => {
      expect(getGalleryPaginationCurrentButtonClassName()).not.toBe(getGalleryPaginationButtonClassName())
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryPaginationCurrentButtonClassName()).toBe(getGalleryPaginationCurrentButtonClassName())
    })
  })

  describe('getGalleryCarouselViewportClassName', () => {
    it('returns a Tailwind class string hiding overflow', () => {
      const className = getGalleryCarouselViewportClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('overflow-hidden')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryCarouselViewportClassName()).toBe(getGalleryCarouselViewportClassName())
    })
  })

  describe('getGalleryCarouselContainerClassName', () => {
    it('returns a Tailwind flex class string', () => {
      const className = getGalleryCarouselContainerClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('flex')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryCarouselContainerClassName()).toBe(getGalleryCarouselContainerClassName())
    })
  })

  describe('getGalleryCarouselSlideClassName', () => {
    it('sizes each slide as 100% for visibleCount 1', () => {
      expect(getGalleryCarouselSlideClassName(1)).toContain('basis-full')
    })

    it('sizes each slide as 50% for visibleCount 2', () => {
      expect(getGalleryCarouselSlideClassName(2)).toContain('basis-1/2')
    })

    it('sizes each slide as 33% for visibleCount 3', () => {
      expect(getGalleryCarouselSlideClassName(3)).toContain('basis-1/3')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryCarouselSlideClassName(2)).toBe(getGalleryCarouselSlideClassName(2))
    })
  })

  describe('getGalleryCarouselControlsClassName', () => {
    it('returns a non-empty Tailwind class string', () => {
      const className = getGalleryCarouselControlsClassName()

      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryCarouselControlsClassName()).toBe(getGalleryCarouselControlsClassName())
    })
  })

  describe('getGalleryCarouselArrowButtonClassName', () => {
    it('returns a non-empty Tailwind class string with a disabled state', () => {
      const className = getGalleryCarouselArrowButtonClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('disabled:cursor-not-allowed')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryCarouselArrowButtonClassName()).toBe(getGalleryCarouselArrowButtonClassName())
    })
  })

  describe('getGalleryLightboxOverlayClassName', () => {
    it('returns a fixed, full-viewport overlay class string', () => {
      const className = getGalleryLightboxOverlayClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('fixed')
      expect(className).toContain('inset-0')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryLightboxOverlayClassName()).toBe(getGalleryLightboxOverlayClassName())
    })
  })

  describe('getGalleryLightboxPanelClassName', () => {
    it('returns a non-empty Tailwind class string', () => {
      const className = getGalleryLightboxPanelClassName()

      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryLightboxPanelClassName()).toBe(getGalleryLightboxPanelClassName())
    })
  })

  describe('getGalleryLightboxImageClassName', () => {
    it('returns a Tailwind class string bounding the image within the viewport', () => {
      const className = getGalleryLightboxImageClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('object-contain')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryLightboxImageClassName()).toBe(getGalleryLightboxImageClassName())
    })
  })

  describe('getGalleryLightboxCloseButtonClassName', () => {
    it('returns a non-empty Tailwind class string', () => {
      const className = getGalleryLightboxCloseButtonClassName()

      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryLightboxCloseButtonClassName()).toBe(getGalleryLightboxCloseButtonClassName())
    })
  })

  describe('getGalleryLightboxNavButtonClassName', () => {
    it('returns a non-empty Tailwind class string with a disabled state', () => {
      const className = getGalleryLightboxNavButtonClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('disabled:cursor-not-allowed')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryLightboxNavButtonClassName()).toBe(getGalleryLightboxNavButtonClassName())
    })
  })

  describe('getGalleryEmptyPlaceholderClassName', () => {
    it('returns a dashed-border Tailwind class string, same visual language as EmptyContainerPlaceholder', () => {
      const className = getGalleryEmptyPlaceholderClassName()

      expect(typeof className).toBe('string')
      expect(className).toContain('border-dashed')
    })

    it('is stable across calls (pure, no side effects)', () => {
      expect(getGalleryEmptyPlaceholderClassName()).toBe(getGalleryEmptyPlaceholderClassName())
    })
  })
})
