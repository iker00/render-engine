import { describe, expect, it } from 'vitest'
import { resolveFileManagerLabel } from '../../runtime/nodes/file-manager/resolve-file-manager-label'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const state: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    currentEntryIndex: 0,
    lastError: null,
  },
  forms: {},
  queries: {},
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
  modal: {
    activeModalId: null,
    activeIterationKey: null,
  },
  i18n: {
    translations: {
      saludo: { es: 'Hola', en: 'Hello' },
      foo: { es: 'Zorro', en: 'Fox' },
    },
    activeLanguage: 'es',
  },
  tokens: {},
}

describe('resolveFileManagerLabel', () => {
  it('returns defaultText literal when the key is absent from labels', () => {
    expect(
      resolveFileManagerLabel({
        labels: undefined,
        key: 'dropzoneIdle',
        defaultText: 'Arrastra los ficheros aquí o haz clic para seleccionar',
        state,
      }),
    ).toBe('Arrastra los ficheros aquí o haz clic para seleccionar')

    expect(
      resolveFileManagerLabel({
        labels: { listEmpty: 'No hay nada' },
        key: 'dropzoneIdle',
        defaultText: 'Arrastra los ficheros aquí o haz clic para seleccionar',
        state,
      }),
    ).toBe('Arrastra los ficheros aquí o haz clic para seleccionar')
  })

  it('returns an empty string when the key is explicitly set to ""', () => {
    expect(
      resolveFileManagerLabel({
        labels: { listEmpty: '' },
        key: 'listEmpty',
        defaultText: 'No hay ficheros subidos.',
        state,
      }),
    ).toBe('')
  })

  it('returns a fixed string as-is when it has no interpolation', () => {
    expect(
      resolveFileManagerLabel({
        labels: { dropzoneIdle: 'Suelta aquí' },
        key: 'dropzoneIdle',
        defaultText: 'Arrastra los ficheros aquí o haz clic para seleccionar',
        state,
      }),
    ).toBe('Suelta aquí')
  })

  it('resolves a full reference to the active translations catalog value', () => {
    expect(
      resolveFileManagerLabel({
        labels: { listEmpty: 't.saludo' },
        key: 'listEmpty',
        defaultText: 'No hay ficheros subidos.',
        state,
      }),
    ).toBe('Hola')
  })

  it('interpolates a local placeholder passed by the consumer', () => {
    expect(
      resolveFileManagerLabel({
        labels: { uploadFileError: 'Error al subir "{{fileName}}"' },
        key: 'uploadFileError',
        defaultText: 'Error al subir el fichero.',
        placeholders: { fileName: 'foo.pdf' },
        state,
      }),
    ).toBe('Error al subir "foo.pdf"')
  })

  it('degrades an unrecognized placeholder to an empty string while keeping the rest of the text', () => {
    expect(
      resolveFileManagerLabel({
        labels: { listEmpty: 'Vacío: {{unknown}}' },
        key: 'listEmpty',
        defaultText: 'No hay ficheros subidos.',
        state,
      }),
    ).toBe('Vacío: ')
  })

  it('resolves a translations placeholder and a local placeholder in the same pass', () => {
    expect(
      resolveFileManagerLabel({
        labels: { uploadFileError: '{{t.foo}} - {{fileName}}' },
        key: 'uploadFileError',
        defaultText: 'Error al subir el fichero.',
        placeholders: { fileName: 'foo.pdf' },
        state,
      }),
    ).toBe('Zorro - foo.pdf')
  })

  it('does not re-interpolate a placeholder value that itself contains {{t.foo}}', () => {
    expect(
      resolveFileManagerLabel({
        labels: { uploadFileError: 'Nombre: {{fileName}}' },
        key: 'uploadFileError',
        defaultText: 'Error al subir el fichero.',
        placeholders: { fileName: '{{t.foo}}' },
        state,
      }),
    ).toBe('Nombre: {{t.foo}}')
  })
})
