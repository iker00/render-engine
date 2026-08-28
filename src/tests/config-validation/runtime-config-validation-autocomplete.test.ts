import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithFormLayout, createConfigWithPages, createVisibilityRule } from './helpers'

function createAutocompleteInForm(autocompleteProps: Record<string, unknown>, formOverrides: Record<string, unknown> = {}) {
  return createConfigWithFormLayout({
    children: [
      {
        type: 'autocomplete',
        props: autocompleteProps,
      },
    ],
    ...formOverrides,
  })
}

describe('validateRuntimeConfig — autocomplete node', () => {
  describe('props.items contract', () => {
    it('accepts manual literal items array', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [
            { label: 'Madrid', value: 'madrid' },
            { label: 'Lisbon', value: 'lisbon' },
          ],
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts manual scalar items ({ values: [...] })', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: { values: ['madrid', 'lisbon'] },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts dynamic object items ({ source, itemType: "object", label, value })', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: {
            source: 'queries.searchCities.data',
            itemType: 'object',
            label: 'name',
            value: 'id',
          },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts dynamic scalar items with an item.* source ({ source: "item.*", itemType: "scalar" })', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: { source: 'item.city', itemType: 'scalar' },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects retired manual object items shape', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: {
            values: [{ id: 'madrid', name: 'Madrid' }],
            label: 'name',
            value: 'id',
          },
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.items'),
        },
      })
    })

    it('rejects dynamic items without an explicit itemType discriminator', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: { source: 'queries.searchCities.data' },
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.items'),
        },
      })
    })
  })

  describe('props.multiple and props.defaultValue', () => {
    it('rejects multiple: true with a non-array literal defaultValue', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'tags',
          label: 'Tags',
          multiple: true,
          defaultValue: 'madrid',
          items: [{ label: 'Madrid', value: 'madrid' }],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.defaultValue'),
        },
      })
    })

    it('rejects an array literal defaultValue when multiple is absent', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          defaultValue: ['madrid'],
          items: [{ label: 'Madrid', value: 'madrid' }],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.defaultValue'),
        },
      })
    })

    it('rejects an array literal defaultValue when multiple is explicitly false', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          multiple: false,
          defaultValue: ['madrid'],
          items: [{ label: 'Madrid', value: 'madrid' }],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.defaultValue'),
        },
      })
    })

    it('accepts multiple: true with an array literal defaultValue', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'tags',
          label: 'Tags',
          multiple: true,
          defaultValue: ['madrid', 'lisbon'],
          items: [
            { label: 'Madrid', value: 'madrid' },
            { label: 'Lisbon', value: 'lisbon' },
          ],
        }),
      )
      expect(result.status).toBe('ready')
    })
  })

  describe('props.allowFreeText', () => {
    it('rejects a non-boolean allowFreeText', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          allowFreeText: 'yes',
          items: [],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.allowFreeText'),
        },
      })
    })

    it('accepts allowFreeText: true', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          allowFreeText: true,
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })
  })

  describe('props.minChars', () => {
    it('rejects a negative minChars', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          minChars: -1,
          items: [],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.minChars'),
        },
      })
    })

    it('rejects a decimal minChars', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          minChars: 1.5,
          items: [],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.minChars'),
        },
      })
    })

    it('accepts autocomplete without minChars', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts minChars: 0', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          minChars: 0,
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts a positive integer minChars', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          minChars: 3,
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })
  })

  describe('props.searchParamName', () => {
    it('rejects a non-string searchParamName', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          searchParamName: 123,
          items: [],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.searchParamName'),
        },
      })
    })

    it('rejects an empty string searchParamName', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          searchParamName: '',
          items: [],
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.searchParamName'),
        },
      })
    })

    it('accepts autocomplete without searchParamName', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts a custom searchParamName', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          searchParamName: 'q',
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })
  })

  describe('props.validations', () => {
    it('accepts validations.required on single selection', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [],
          validations: { required: true },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts validations.required on multiple selection', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'tags',
          label: 'Tags',
          multiple: true,
          items: [],
          validations: { required: true },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts validations.minSelections/maxSelections when multiple: true', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'tags',
          label: 'Tags',
          multiple: true,
          items: [],
          validations: { minSelections: 1, maxSelections: 3 },
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects validations.minSelections when multiple is absent', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [],
          validations: { minSelections: 1 },
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.validations.minSelections'),
        },
      })
    })

    it('rejects validations.maxSelections when multiple is explicitly false', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          multiple: false,
          items: [],
          validations: { maxSelections: 2 },
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining('layout[0].children[0].props.validations.maxSelections'),
        },
      })
    })

    it.each(['minLength', 'maxLength', 'pattern', 'email', 'url'])('rejects unsupported validations.%s', (ruleName) => {
      const rawRule = ruleName === 'pattern' ? '.*' : ruleName === 'minLength' || ruleName === 'maxLength' ? 2 : true
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [],
          validations: { [ruleName]: rawRule },
        }),
      )
      expect(result).toEqual({
        status: 'error',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: expect.stringContaining(`layout[0].children[0].props.validations.${ruleName}`),
        },
      })
    })
  })

  describe('placement', () => {
    it('rejects autocomplete outside a form', () => {
      const result = validateRuntimeConfig(
        createConfigWithPages([
          {
            id: 'home',
            layout: [
              {
                type: 'autocomplete',
                props: { fieldId: 'city', label: 'City', items: [] },
              },
            ],
          },
        ]),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('autocomplete nodes must be descendants of a form node.')
    })

    it('accepts autocomplete as a direct child of form.children', () => {
      const result = validateRuntimeConfig(
        createAutocompleteInForm({
          fieldId: 'city',
          label: 'City',
          items: [],
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('accepts autocomplete nested inside a container inside a form', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'container',
              children: [
                {
                  type: 'autocomplete',
                  props: { fieldId: 'city', label: 'City', items: [] },
                },
              ],
            },
          ],
        }),
      )
      expect(result.status).toBe('ready')
    })
  })

  describe('transversal fields', () => {
    it('accepts autocomplete with valid visibility', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'autocomplete',
              visibility: createVisibilityRule(),
              props: { fieldId: 'city', label: 'City', items: [] },
            },
          ],
        }),
      )
      expect(result.status).toBe('ready')
    })

    it('rejects autocomplete with an invalid visibility operator', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'autocomplete',
              visibility: { reference: 'forms.user-form.role', operator: 'startsWith', value: 'a' },
              props: { fieldId: 'city', label: 'City', items: [] },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].children[0].visibility')
    })

    it('accepts autocomplete with a valid queryStateFeedback', () => {
      const result = validateRuntimeConfig({
        api: {
          submitUserForm: { method: 'POST', endpoint: '/api/forms' },
          loadCities: { method: 'GET', endpoint: '/api/cities' },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                submitAction: { type: 'executeOperation', operationName: 'submitUserForm' },
                children: [
                  {
                    type: 'autocomplete',
                    queryStateFeedback: { query: 'loadCities' },
                    props: { fieldId: 'city', label: 'City', items: [] },
                  },
                ],
              },
            ],
          },
        ],
        initialPage: 'home',
      })
      expect(result.status).toBe('ready')
    })

    it('rejects autocomplete with an invalid queryStateFeedback state name', () => {
      const result = validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'autocomplete',
              queryStateFeedback: { query: 'submitUserForm', states: { pending: { mode: 'hide' } } },
              props: { fieldId: 'city', label: 'City', items: [] },
            },
          ],
        }),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') throw new Error('Expected error')
      expect(result.error.message).toContain('layout[0].children[0].queryStateFeedback')
    })
  })
})
