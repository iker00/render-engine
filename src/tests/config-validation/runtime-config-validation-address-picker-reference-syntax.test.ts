import { describe, expect, it } from 'vitest'
import { parseRuntimeReference } from '../../config/runtime-reference-syntax'

describe('forms.{formId}.{fieldId}.$lat / .$lng reference syntax', () => {
  describe('with allowFormCoordinateReference enabled', () => {
    it('parses forms.{formId}.{fieldId}.$lat as a supported reference', () => {
      expect(
        parseRuntimeReference('forms.contacto.direccion.$lat', { allowFormCoordinateReference: true }),
      ).toEqual({
        kind: 'reference',
        status: 'supported',
        namespace: 'forms',
        path: ['contacto', 'direccion', '$lat'],
        source: 'forms.contacto.direccion.$lat',
      })
    })

    it('parses forms.{formId}.{fieldId}.$lng as a supported reference', () => {
      expect(
        parseRuntimeReference('forms.contacto.direccion.$lng', { allowFormCoordinateReference: true }),
      ).toEqual({
        kind: 'reference',
        status: 'supported',
        namespace: 'forms',
        path: ['contacto', 'direccion', '$lng'],
        source: 'forms.contacto.direccion.$lng',
      })
    })

    it.each([
      'forms.contacto.direccion.$lat.extra',
      'forms.contacto.$lat',
      'forms.contacto.direccion.$latitude',
      'forms.contacto.direccion.$lng.0',
      'forms.contacto.direccion.$other',
      'forms.contacto.direccion.otro',
    ])('keeps "%s" invalid even with the option active', (value) => {
      const result = parseRuntimeReference(value, { allowFormCoordinateReference: true })

      expect(result.kind).toBe('reference')
      if (result.kind === 'reference') {
        expect(result.status).toBe('invalid')
      }
    })

    it('keeps the classic forms.{formId}.{fieldId} shape unaffected', () => {
      expect(
        parseRuntimeReference('forms.contacto.direccion', { allowFormCoordinateReference: true }),
      ).toEqual({
        kind: 'reference',
        status: 'supported',
        namespace: 'forms',
        path: ['contacto', 'direccion'],
        source: 'forms.contacto.direccion',
      })
    })

    it.each(['forms', 'forms.contacto'])('keeps "%s" invalid', (value) => {
      const result = parseRuntimeReference(value, { allowFormCoordinateReference: true })

      expect(result.kind).toBe('reference')
      if (result.kind === 'reference') {
        expect(result.status).toBe('invalid')
      }
    })

    it('keeps escaped literal forms behaving as literal', () => {
      expect(
        parseRuntimeReference('\\forms.contacto.direccion.$lat', { allowFormCoordinateReference: true }),
      ).toEqual({
        kind: 'literal',
        value: 'forms.contacto.direccion.$lat',
      })
    })
  })

  describe('without allowFormCoordinateReference', () => {
    it('parses forms.{formId}.{fieldId}.$lat as invalid', () => {
      const result = parseRuntimeReference('forms.contacto.direccion.$lat')

      expect(result).toEqual({
        kind: 'reference',
        status: 'invalid',
        namespace: 'forms',
        path: ['contacto', 'direccion', '$lat'],
        source: 'forms.contacto.direccion.$lat',
      })
    })

    it('parses forms.{formId}.{fieldId}.$lng as invalid', () => {
      const result = parseRuntimeReference('forms.contacto.direccion.$lng')

      expect(result).toEqual({
        kind: 'reference',
        status: 'invalid',
        namespace: 'forms',
        path: ['contacto', 'direccion', '$lng'],
        source: 'forms.contacto.direccion.$lng',
      })
    })
  })

  describe('regression: other synthetic references are unaffected by the new option', () => {
    it.each([
      ['item.$key', { allowItemReference: true }],
      ['item.$index', { allowItemReference: true }],
      ['row.$index', { allowRowReference: true }],
      ['switch.next', { allowSwitchNextReference: true }],
    ] as const)('keeps the same parse result for "%s" with and without allowFormCoordinateReference', (value, baseOptions) => {
      const withoutOption = parseRuntimeReference(value, baseOptions)
      const withOption = parseRuntimeReference(value, { ...baseOptions, allowFormCoordinateReference: true })

      expect(withOption).toEqual(withoutOption)
    })
  })

  describe('regression: other reference families are unaffected by the new option', () => {
    it.each([
      'queries.x.data.a.b',
      'params.userId',
      'tokens.t.value',
      't.clave',
      'group.param',
    ])('keeps the same parse result for "%s" with and without allowFormCoordinateReference', (value) => {
      const withoutOption = parseRuntimeReference(value)
      const withOption = parseRuntimeReference(value, { allowFormCoordinateReference: true })

      expect(withOption).toEqual(withoutOption)
    })
  })
})
