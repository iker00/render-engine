import { describe, expect, it } from 'vitest'
import {
  getAppShellClassName,
  getAppShellContentClassName,
  getAppShellErrorBodyClassName,
  getAppShellErrorEyebrowClassName,
  getAppShellErrorTitleClassName,
  getAppShellFrameClassName,
  getFieldControlClassName,
  getRuntimePageClassName,
  getContainerNodeStyling,
  getHeadingNodeClassName,
  getHeadingTag,
  getListItemClassName,
  getListNodeClassName,
  getParagraphNodeClassName,
} from '../runtime/runtime-node-styling'

describe('runtime node styling', () => {
  it('exposes stable shell and page slots for the light institutional baseline', () => {
    expect(getAppShellClassName()).toBe(
      'min-h-screen bg-app-background text-app-text',
    )
    expect(getAppShellContentClassName()).toBe(
      'mx-auto flex w-full max-w-shell px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16',
    )
    expect(getAppShellFrameClassName()).toBe(
      'w-full rounded-shell border border-app-border-strong bg-app-surface p-5 shadow-shell sm:p-8 lg:p-10',
    )
    expect(getRuntimePageClassName()).toBe('grid gap-6 lg:gap-8')
    expect(getAppShellErrorEyebrowClassName()).toBe(
      'text-xs font-semibold uppercase tracking-[0.24em] text-app-accent',
    )
    expect(getAppShellErrorTitleClassName()).toBe(
      'm-0 text-3xl font-semibold leading-tight tracking-[-0.02em] text-app-text-strong sm:text-4xl',
    )
    expect(getAppShellErrorBodyClassName()).toBe(
      'max-w-2xl text-base leading-7 text-app-text-muted sm:text-lg sm:leading-8',
    )
  })

  it('returns stable Tailwind classes for container aliases without custom styles', () => {
    expect(getContainerNodeStyling({ direction: 'row', gap: 'sm' })).toEqual({
      className: 'flex w-full flex-row gap-3',
    })
  })

  it('preserves arbitrary gap values with a CSS variable escape hatch', () => {
    expect(getContainerNodeStyling({ direction: 'column', gap: '18px' })).toEqual({
      className: 'flex w-full flex-col gap-[var(--runtime-container-gap)]',
      style: {
        '--runtime-container-gap': '18px',
      },
    })
  })

  it('keeps focus styling on controls without outline offset gaps', () => {
    expect(getFieldControlClassName(false)).toContain('focus-visible:ring-2')
    expect(getFieldControlClassName(false)).toContain('focus-visible:outline-none')
    expect(getFieldControlClassName(false)).not.toContain('focus-visible:outline-offset-2')
  })

  it('returns stable Tailwind classes for leaf nodes', () => {
    expect(getHeadingNodeClassName(2)).toBe(
      'm-0 text-3xl sm:text-4xl font-semibold leading-tight tracking-[-0.03em] text-app-text-strong',
    )
    expect(getParagraphNodeClassName()).toBe(
      'm-0 max-w-3xl text-base leading-7 text-app-text-muted sm:text-lg sm:leading-8',
    )
    expect(getListNodeClassName()).toBe(
      'm-0 grid list-disc gap-3 pl-5 text-app-text marker:text-app-accent',
    )
    expect(getListItemClassName()).toBe('leading-7')
  })

  it('keeps heading tag resolution separate from styling', () => {
    expect(getHeadingTag(0)).toBe('h1')
    expect(getHeadingTag(3)).toBe('h3')
    expect(getHeadingTag(9)).toBe('h6')
  })
})
