import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'

const baseApi = {
  geocode: { method: 'GET', endpoint: '/api/geocode' },
  saveContact: { method: 'POST', endpoint: '/api/contacts' },
}

function addressPickerProps(fieldId: string, overrides: Record<string, unknown> = {}) {
  return {
    fieldId,
    label: fieldId,
    geocodeOperation: 'geocode',
    addressPath: 'formatted',
    ...overrides,
  }
}

// Form with an addressPicker ("direccion") plus one non-addressPicker field of each of the
// commonly confused field-bearing types (input, autocomplete, select), all under form "contacto".
function contactoForm(overrides: Record<string, unknown> = {}) {
  return {
    type: 'form',
    id: 'contacto',
    children: [
      { type: 'addressPicker', props: addressPickerProps('direccion') },
      { type: 'input', props: { fieldId: 'nombre', label: 'Nombre' } },
      {
        type: 'autocomplete',
        props: { fieldId: 'auto', label: 'Auto', items: [{ label: 'A', value: 'a' }] },
      },
      { type: 'select', props: { fieldId: 'rol', label: 'Rol', items: [{ label: 'Admin', value: 'admin' }] } },
    ],
    ...overrides,
  }
}

function configWithApi(api: Record<string, unknown>, layout: Array<Record<string, unknown>>) {
  return {
    api: { ...baseApi, ...api },
    pages: [{ id: 'home', layout }],
    initialPage: 'home',
  }
}

function configWithApiBody(reference: string, layout: Array<Record<string, unknown>> = [contactoForm()]) {
  return configWithApi(
    { saveCoords: { method: 'POST', endpoint: '/api/coords', body: { lat: reference } } },
    layout,
  )
}

describe('validateRuntimeConfig — addressPicker coordinate references: admitted surfaces acceptance', () => {
  it('accepts forms.{formId}.{fieldId}.$lat and .$lng in api.{op}.body targeting an addressPicker field', () => {
    const result = validateRuntimeConfig(
      configWithApi(
        {
          saveCoords: {
            method: 'POST',
            endpoint: '/api/coords',
            body: { lat: 'forms.contacto.direccion.$lat', lng: 'forms.contacto.direccion.$lng' },
          },
        },
        [contactoForm()],
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts forms.{formId}.{fieldId}.$lat and .$lng in api.{op}.query targeting an addressPicker field', () => {
    const result = validateRuntimeConfig(
      configWithApi(
        {
          saveCoords: {
            method: 'GET',
            endpoint: '/api/coords',
            query: { lat: 'forms.contacto.direccion.$lat', lng: 'forms.contacto.direccion.$lng' },
          },
        },
        [contactoForm()],
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts the coordinate reference in form.submitAction.body', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm({
          submitAction: {
            type: 'executeOperation',
            operationName: 'saveContact',
            body: { lat: 'forms.contacto.direccion.$lat' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts the coordinate reference in form.submitAction.operations[i].body (plural)', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm({
          submitAction: {
            type: 'executeOperations',
            operations: [{ operationName: 'saveContact', body: { lat: 'forms.contacto.direccion.$lat' } }],
          },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts the coordinate reference in button.props.action.body for a button living outside the form', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm(),
        {
          type: 'button',
          props: {
            label: 'Save coords',
            action: {
              type: 'executeOperation',
              operationName: 'saveContact',
              body: { lat: 'forms.contacto.direccion.$lat' },
            },
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts the coordinate reference in button.props.action.operations[i].query', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm(),
        {
          type: 'button',
          props: {
            label: 'Save coords',
            action: {
              type: 'executeOperations',
              operations: [{ operationName: 'saveContact', query: { lat: 'forms.contacto.direccion.$lat' } }],
            },
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('indexes an addressPicker nested inside tabs.props.items[i].children inside the form', () => {
    const result = validateRuntimeConfig(
      configWithApiBody('forms.contacto.direccion.$lat', [
        contactoForm({
          children: [
            {
              type: 'tabs',
              props: { items: [{ label: 'Tab 1', children: [{ type: 'addressPicker', props: addressPickerProps('direccion') }] }] },
            },
          ],
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('indexes an addressPicker nested inside steps.props.items[i].children inside the form', () => {
    const result = validateRuntimeConfig(
      configWithApiBody('forms.contacto.direccion.$lat', [
        contactoForm({
          submitAction: { type: 'executeOperation', operationName: 'saveContact' },
          children: [
            {
              type: 'steps',
              props: { items: [{ label: 'Step 1', children: [{ type: 'addressPicker', props: addressPickerProps('direccion') }] }] },
            },
          ],
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('indexes an addressPicker nested inside a container nested inside the form', () => {
    const result = validateRuntimeConfig(
      configWithApiBody('forms.contacto.direccion.$lat', [
        contactoForm({
          children: [
            {
              type: 'container',
              children: [{ type: 'addressPicker', props: addressPickerProps('direccion') }],
            },
          ],
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('indexes an addressPicker inside a form nested inside a repeater.props.template', () => {
    const result = validateRuntimeConfig(
      configWithApiBody('forms.contacto.direccion.$lat', [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.contacts.data', key: 'id' },
            template: [contactoForm()],
          },
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })
})

describe('validateRuntimeConfig — addressPicker coordinate references: admitted surfaces rejection', () => {
  it('rejects forms.contacto.noExiste.$lat: unknown fieldId', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.noExiste.$lat'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('saveCoords.body.lat')
    }
  })

  it('rejects forms.noExiste.direccion.$lat: unknown formId', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.noExiste.direccion.$lat'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('saveCoords.body.lat')
    }
  })

  it('rejects forms.contacto.nombre.$lat: nombre is an input, not an addressPicker', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.nombre.$lat'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain(
        'forms.contacto.nombre.$lat/$lng requires "nombre" to be an addressPicker field; only an addressPicker exposes coordinates.',
      )
    }
  })

  it('rejects forms.contacto.auto.$lat: auto is an autocomplete, not an addressPicker', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.auto.$lat'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain(
        'forms.contacto.auto.$lat/$lng requires "auto" to be an addressPicker field; only an addressPicker exposes coordinates.',
      )
    }
  })

  it('rejects forms.contacto.rol.$lat: rol is a select, not an addressPicker', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.rol.$lat'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain(
        'forms.contacto.rol.$lat/$lng requires "rol" to be an addressPicker field; only an addressPicker exposes coordinates.',
      )
    }
  })

  it('rejects the malformed shape forms.contacto.direccion.$lat.extra even in an admitted surface', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.direccion.$lat.extra'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('saveCoords.body.lat')
    }
  })

  it('rejects the malformed shape forms.contacto.direccion.$other even in an admitted surface', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.direccion.$other'))
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('saveCoords.body.lat')
    }
  })
})

describe('validateRuntimeConfig — addressPicker coordinate references: non-admitted surfaces rejection', () => {
  it('rejects the reference as the full value of heading.props.text', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [contactoForm(), { type: 'heading', props: { text: 'forms.contacto.direccion.$lat', level: 2 } }]),
    )
    expect(result.status).toBe('error')
  })

  it('rejects the reference in a field defaultValue (toggle)', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm({
          children: [
            { type: 'addressPicker', props: addressPickerProps('direccion') },
            { type: 'toggle', props: { fieldId: 'other', label: 'Other', defaultValue: 'forms.contacto.direccion.$lat' } },
          ],
        }),
      ]),
    )
    expect(result.status).toBe('error')
  })

  it('rejects the reference in visibility.reference', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm(),
        {
          type: 'paragraph',
          props: { text: 'hidden text' },
          visibility: { reference: 'forms.contacto.direccion.$lat', operator: 'isTruthy' },
        },
      ]),
    )
    expect(result.status).toBe('error')
  })

  it('rejects the reference in api.{op}.headers', () => {
    const result = validateRuntimeConfig(
      configWithApi(
        {
          saveCoords: {
            method: 'POST',
            endpoint: '/api/coords',
            headers: { 'x-lat': 'forms.contacto.direccion.$lat' },
          },
        },
        [contactoForm()],
      ),
    )
    expect(result.status).toBe('error')
  })

  it('rejects the reference in form.submitAction.headers', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm({
          submitAction: {
            type: 'executeOperation',
            operationName: 'saveContact',
            headers: { 'x-lat': 'forms.contacto.direccion.$lat' },
          },
        }),
      ]),
    )
    expect(result.status).toBe('error')
  })

  it('rejects the reference in repeater.props.items.source', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        contactoForm(),
        {
          type: 'repeater',
          props: {
            items: { source: 'forms.contacto.direccion.$lat', key: 'id' },
            template: [{ type: 'heading', props: { text: 'item.title', level: 2 } }],
          },
        },
      ]),
    )
    expect(result.status).toBe('error')
  })
})

describe('validateRuntimeConfig — addressPicker coordinate references: regression', () => {
  it('still accepts a plain forms.{formId}.{fieldId} reference (no synthetic suffix) targeting an addressPicker field', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.direccion'))
    expect(result.status).toBe('ready')
  })

  it('still accepts a plain forms.{formId}.{fieldId} reference (no synthetic suffix) targeting a non-addressPicker field', () => {
    const result = validateRuntimeConfig(configWithApiBody('forms.contacto.nombre'))
    expect(result.status).toBe('ready')
  })

  it('validates a config without any $lat/$lng reference and without any addressPicker the same way as before', () => {
    const result = validateRuntimeConfig(
      configWithApi({}, [
        {
          type: 'form',
          id: 'user-form',
          children: [{ type: 'input', props: { fieldId: 'name', label: 'Name' } }],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })
})
