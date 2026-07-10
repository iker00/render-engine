import { describe, expect, it } from 'vitest'
import {
  buttonNodeSchema,
  supportedButtonColors,
  supportedButtonVariants,
} from '../../config/runtime-config-zod'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

describe('buttonNodeSchema — color, variant, fullWidth (Zod shape)', () => {
  it('accepts a button with props.color: "primary" and props.variant: "solid"', () => {
    const result = buttonNodeSchema.safeParse({
      type: 'button',
      props: { label: 'Save', color: 'primary', variant: 'solid' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a button with props.fullWidth: true', () => {
    const result = buttonNodeSchema.safeParse({
      type: 'button',
      props: { label: 'Save', fullWidth: true },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a button without color, variant or fullWidth (all optional)', () => {
    const result = buttonNodeSchema.safeParse({
      type: 'button',
      props: { label: 'Save' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a button with props.color: "purple"', () => {
    const result = buttonNodeSchema.safeParse({
      type: 'button',
      props: { label: 'Save', color: 'purple' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a button with props.variant: "flat"', () => {
    const result = buttonNodeSchema.safeParse({
      type: 'button',
      props: { label: 'Save', variant: 'flat' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a button with props.fullWidth: "yes" (string instead of boolean)', () => {
    const result = buttonNodeSchema.safeParse({
      type: 'button',
      props: { label: 'Save', fullWidth: 'yes' },
    })
    expect(result.success).toBe(false)
  })
})

describe('supportedButtonColors and supportedButtonVariants constants', () => {
  it('supportedButtonColors exports exactly the six semantic colors', () => {
    expect([...supportedButtonColors]).toEqual([
      'neutral',
      'primary',
      'success',
      'warning',
      'danger',
      'info',
    ])
  })

  it('supportedButtonVariants exports exactly the four catalogue variants', () => {
    expect([...supportedButtonVariants]).toEqual(['solid', 'outline', 'ghost', 'link'])
  })
})

describe('validateRuntimeConfig — button color, variant and fullWidth', () => {
  it('rejects a button with props.color: "purple" with invalid-layout and path .props.color', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'button',
            props: {
              label: 'Save',
              color: 'purple',
              action: { type: 'goBack' },
            },
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.color".
  → button("Save")
  Node: {"type":"button","props":{"label":"Save"}}`,
      },
    })
  })

  it('rejects a button with props.variant: "flat" with invalid-layout and path .props.variant', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'button',
            props: {
              label: 'Save',
              variant: 'flat',
              action: { type: 'goBack' },
            },
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.variant".
  → button("Save")
  Node: {"type":"button","props":{"label":"Save"}}`,
      },
    })
  })

  it('rejects a button with props.fullWidth: "yes" with invalid-layout and path .props.fullWidth', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'button',
            props: {
              label: 'Save',
              fullWidth: 'yes',
              action: { type: 'goBack' },
            },
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.fullWidth".
  → button("Save")
  Node: {"type":"button","props":{"label":"Save"}}`,
      },
    })
  })

  it('rejects a button with props.color: "" with invalid-layout and path .props.color', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithLayout([
          {
            type: 'button',
            props: {
              label: 'Save',
              color: '',
              action: { type: 'goBack' },
            },
          },
        ]),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: `Page "home" has an invalid layout at "layout[0].props.color".
  → button("Save")
  Node: {"type":"button","props":{"label":"Save"}}`,
      },
    })
  })

  it('produces a normalized node with color, variant and fullWidth when declared with valid values', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'button',
          props: {
            label: 'Delete',
            color: 'danger',
            variant: 'outline',
            fullWidth: true,
            action: { type: 'goBack' },
          },
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    const node = result.config.pages[0].layout[0] as {
      type: 'button'
      props: { label: string; color?: string; variant?: string; fullWidth?: boolean }
    }

    expect(node.type).toBe('button')
    expect(node.props.color).toBe('danger')
    expect(node.props.variant).toBe('outline')
    expect(node.props.fullWidth).toBe(true)
  })

  it('produces a normalized node where color, variant and fullWidth are undefined when not declared', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'button',
          props: {
            label: 'Back',
            action: { type: 'goBack' },
          },
        },
      ]),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      throw new Error('Expected ready result')
    }

    const node = result.config.pages[0].layout[0] as {
      type: 'button'
      props: { label: string; color?: string; variant?: string; fullWidth?: boolean }
    }

    expect(node.props.color).toBeUndefined()
    expect(node.props.variant).toBeUndefined()
    expect(node.props.fullWidth).toBeUndefined()
  })
})
