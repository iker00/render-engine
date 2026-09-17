import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithFormLayout, createConfigWithPages } from './helpers'

const geocodeApi = { geocodeAddress: { method: 'GET', endpoint: '/api/geocode' } }

function validAddressPickerProps(overrides: Record<string, unknown> = {}) {
  return {
    fieldId: 'address',
    label: 'Address',
    geocodeOperation: 'geocodeAddress',
    addressPath: 'location.formatted',
    ...overrides,
  }
}

function createAddressPickerInForm(
  addressPickerProps: Record<string, unknown>,
  options: { formOverrides?: Record<string, unknown>; api?: Record<string, unknown>; extraPages?: Array<Record<string, unknown>> } = {},
) {
  return createConfigWithFormLayout(
    {
      children: [
        {
          type: 'addressPicker',
          props: addressPickerProps,
        },
      ],
      ...options.formOverrides,
    },
    { api: { ...geocodeApi, ...options.api }, extraPages: options.extraPages },
  )
}

describe('validateRuntimeConfig — addressPicker node: acceptance', () => {
  it('accepts a form with a valid addressPicker', () => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps()))
    expect(result.status).toBe('ready')
  })

  it('accepts addressPicker without center, zoom or height — normalized node does not invent defaults', () => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps()))
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      const form = result.page.layout[0] as { children: Array<{ props: { center?: unknown; zoom?: unknown; height?: unknown } }> }
      const node = form.children[0]
      expect(node.props.center).toBeUndefined()
      expect(node.props.zoom).toBeUndefined()
      expect(node.props.height).toBeUndefined()
    }
  })

  it('accepts addressPicker with a valid center, zoom and height', () => {
    const result = validateRuntimeConfig(
      createAddressPickerInForm(validAddressPickerProps({ center: { lat: 42.8125, lng: -1.6458 }, zoom: 13, height: 'md' })),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts addressPicker nested inside a container inside a form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout(
        {
          children: [
            {
              type: 'container',
              children: [
                {
                  type: 'addressPicker',
                  props: validAddressPickerProps(),
                },
              ],
            },
          ],
        },
        { api: geocodeApi },
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts validations.required: true', () => {
    const result = validateRuntimeConfig(
      createAddressPickerInForm(validAddressPickerProps({ validations: { required: true } })),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts two addressPicker nodes with the same fieldId in different forms', () => {
    const result = validateRuntimeConfig({
      api: geocodeApi,
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'form-a',
              children: [{ type: 'addressPicker', props: validAddressPickerProps() }],
            },
            {
              type: 'form',
              id: 'form-b',
              children: [{ type: 'addressPicker', props: validAddressPickerProps() }],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('regression: a config without any addressPicker still validates the same way (input + map)', () => {
    const result = validateRuntimeConfig({
      api: geocodeApi,
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'user-form',
              children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
            },
            { type: 'map', props: { center: { lat: 0, lng: 0 } } },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — addressPicker node: shape rejection', () => {
  it('rejects addressPicker with props.fieldId absent', () => {
    const props = validAddressPickerProps()
    delete (props as Record<string, unknown>).fieldId
    const result = validateRuntimeConfig(createAddressPickerInForm(props))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.fieldId')
    }
  })

  it('rejects addressPicker with props.fieldId empty', () => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps({ fieldId: '' })))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.fieldId')
    }
  })

  it('rejects addressPicker with props.label absent', () => {
    const props = validAddressPickerProps()
    delete (props as Record<string, unknown>).label
    const result = validateRuntimeConfig(createAddressPickerInForm(props))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.label')
    }
  })

  it('rejects addressPicker with props.geocodeOperation absent', () => {
    const props = validAddressPickerProps()
    delete (props as Record<string, unknown>).geocodeOperation
    const result = validateRuntimeConfig(createAddressPickerInForm(props))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.geocodeOperation')
    }
  })

  it('rejects addressPicker with props.geocodeOperation empty', () => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps({ geocodeOperation: '' })))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.geocodeOperation')
    }
  })

  it('rejects addressPicker with props.geocodeOperation referencing an operation that does not exist in api', () => {
    const result = validateRuntimeConfig(
      createAddressPickerInForm(validAddressPickerProps({ geocodeOperation: 'unknownGeocode' })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.geocodeOperation')
      expect(result.error.message).toContain('unknown operation "unknownGeocode"')
    }
  })

  it('rejects addressPicker with props.addressPath absent', () => {
    const props = validAddressPickerProps()
    delete (props as Record<string, unknown>).addressPath
    const result = validateRuntimeConfig(createAddressPickerInForm(props))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.addressPath')
    }
  })

  it('rejects addressPicker with props.addressPath empty', () => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps({ addressPath: '' })))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.addressPath')
    }
  })

  it('rejects addressPicker with props.center.lat out of range [-90, 90]', () => {
    const result = validateRuntimeConfig(
      createAddressPickerInForm(validAddressPickerProps({ center: { lat: 91, lng: 0 } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.center.lat')
    }
  })

  it('rejects addressPicker with props.center.lng out of range [-180, 180]', () => {
    const result = validateRuntimeConfig(
      createAddressPickerInForm(validAddressPickerProps({ center: { lat: 0, lng: -181 } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.center.lng')
    }
  })

  it.each([1.5, -1, 20])('rejects addressPicker with an invalid props.zoom (%s)', (zoom) => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps({ zoom })))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.zoom')
    }
  })

  it('rejects addressPicker with props.height outside the catalog', () => {
    const result = validateRuntimeConfig(createAddressPickerInForm(validAddressPickerProps({ height: 'huge' })))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props.height')
    }
  })

  it('rejects an addressPicker node that declares children', () => {
    const withChildren = createConfigWithFormLayout(
      {
        children: [
          {
            type: 'addressPicker',
            props: validAddressPickerProps(),
            children: [{ type: 'paragraph', props: { text: 'ignored' } }],
          },
        ],
      },
      { api: geocodeApi },
    )
    const result = validateRuntimeConfig(withChildren)
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('.children')
    }
  })

  it('rejects validations.minSelections on addressPicker', () => {
    const result = validateRuntimeConfig(
      createAddressPickerInForm(validAddressPickerProps({ validations: { minSelections: 1 } })),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].children[0].props.validations.minSelections')
    }
  })
})

describe('validateRuntimeConfig — addressPicker node: placement', () => {
  it('rejects an addressPicker declared at the root of pages[].layout, outside any form', () => {
    const result = validateRuntimeConfig(
      createConfigWithPages(
        [
          {
            id: 'home',
            layout: [{ type: 'addressPicker', props: validAddressPickerProps() }],
          },
        ],
        'home',
      ),
    )
    expect(result.status).toBe('error')
  })

  it('rejects two addressPicker nodes with the same fieldId in the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout(
        {
          children: [
            { type: 'addressPicker', props: validAddressPickerProps() },
            { type: 'addressPicker', props: validAddressPickerProps() },
          ],
        },
        { api: geocodeApi },
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('duplicate fieldId')
    }
  })

  it('rejects an addressPicker and an input sharing the same fieldId in the same form', () => {
    const result = validateRuntimeConfig(
      createConfigWithFormLayout(
        {
          children: [
            { type: 'addressPicker', props: validAddressPickerProps() },
            { type: 'input', props: { fieldId: 'address', label: 'Address (again)' } },
          ],
        },
        { api: geocodeApi },
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('duplicate fieldId')
    }
  })
})
