import { describe, expect, it } from 'vitest'
import {
  getContainerNodeStyling,
  getHeadingNodeClassName,
  getHeadingTag,
  getListItemClassName,
  getListNodeClassName,
  getParagraphNodeClassName,
} from '../runtime/runtime-node-styling'

describe('runtime node styling', () => {
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

  it('returns stable Tailwind classes for leaf nodes', () => {
    expect(getHeadingNodeClassName(2)).toBe('m-0 text-4xl font-semibold leading-tight tracking-[-0.03em] text-slate-50')
    expect(getParagraphNodeClassName()).toBe('m-0 text-base leading-7 text-slate-300')
    expect(getListNodeClassName()).toBe('m-0 grid list-disc gap-2 pl-5 text-slate-200')
    expect(getListItemClassName()).toBe('leading-6')
  })

  it('keeps heading tag resolution separate from styling', () => {
    expect(getHeadingTag(0)).toBe('h1')
    expect(getHeadingTag(3)).toBe('h3')
    expect(getHeadingTag(9)).toBe('h6')
  })
})
