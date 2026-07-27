import { describe, expect, it } from 'vitest'
import type { RuntimeIterationContext } from '../../runtime/runtime-references/runtime-reference-resolver'
import type { ResolvedFormFieldDefinition } from '../../runtime/runtime-form-validations'
import { evaluateFileManagerBatch, resolveFormFieldValue, validateFormFields } from '../../runtime/runtime-form-validations'
import type { RuntimeFileInputValidations, RuntimeFileManagerValidations } from '../../config/runtime-config-types'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const baseState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    currentEntryIndex: 0,
    lastError: null,
  },
  forms: {
    profileForm: {
      visibleName: {
        value: 'Ada',
        error: null,
        touched: true,
        dirty: true,
        defaultValue: '',
      },
      role: {
        value: 'editor',
        error: null,
        touched: true,
        dirty: true,
        defaultValue: 'editor',
      },
      hiddenNickname: {
        value: '',
        error: 'Required',
        touched: true,
        dirty: true,
        defaultValue: '',
      },
    },
  },
  queries: {
    visibilityQuery: {
      status: 'idle',
      data: null,
      error: null,
      requestSignature: null,
    },
  },
  pageEntry: {
    entryId: 0,
    pageId: 'home',
    params: {},
    preloadNames: [],
    status: 'idle',
  },
}

const repeaterIterationContext: RuntimeIterationContext = {
  item: {
    requiresCode: true,
  },
}

function createRequiredInputField(
  fieldId: string,
  options: Pick<ResolvedFormFieldDefinition, 'visibility' | 'queryStateFeedback'> = {},
): ResolvedFormFieldDefinition {
  return {
    fieldId,
    type: 'input',
    validations: {
      required: {
        value: true,
      },
    },
    multiple: false,
    defaultValue: '',
    ...options,
  }
}

describe('runtime form validations', () => {
  it('ignores required validation for fields hidden by visibility while preserving any stored error', () => {
    const result = validateFormFields({
      formId: 'profileForm',
      fieldDefinitions: [
        createRequiredInputField('visibleName'),
        createRequiredInputField('hiddenNickname', {
          visibility: {
            reference: 'forms.profileForm.role',
            operator: 'equals',
            value: 'admin',
          },
        }),
      ],
      state: baseState,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: {
        visibleName: null,
        hiddenNickname: 'Required',
      },
    })
  })

  it('ignores required validation for fields hidden by queryStateFeedback', () => {
    const result = validateFormFields({
      formId: 'profileForm',
      fieldDefinitions: [
        createRequiredInputField('visibleName'),
        createRequiredInputField('hiddenNickname', {
          queryStateFeedback: {
            query: 'visibilityQuery',
            states: {
              idle: {
                mode: 'hide',
              },
            },
          },
        }),
      ],
      state: baseState,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: {
        visibleName: null,
        hiddenNickname: 'Required',
      },
    })
  })

  it('keeps visible invalid fields blocking the form according to validation order', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        ...baseState.forms,
        profileForm: {
          ...baseState.forms.profileForm,
          visibleName: {
            value: '',
            error: null,
            touched: true,
            dirty: true,
            defaultValue: '',
          },
        },
      },
    }

    const result = validateFormFields({
      formId: 'profileForm',
      fieldDefinitions: [
        {
          ...createRequiredInputField('visibleName'),
          validations: {
            required: {
              value: true,
            },
            minLength: {
              value: 3,
            },
          },
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: {
        visibleName: 'Required',
      },
    })
  })

  it('reapplies validation when a previously hidden field becomes visible again', () => {
    const hiddenField = createRequiredInputField('hiddenNickname', {
      visibility: {
        reference: 'forms.profileForm.role',
        operator: 'equals',
        value: 'admin',
      },
    })

    const hiddenResult = validateFormFields({
      formId: 'profileForm',
      fieldDefinitions: [hiddenField],
      state: baseState,
    })

    const visibleState: RuntimeState = {
      ...baseState,
      forms: {
        ...baseState.forms,
        profileForm: {
          ...baseState.forms.profileForm,
          role: {
            ...baseState.forms.profileForm.role,
            value: 'admin',
          },
        },
      },
    }

    const visibleResult = validateFormFields({
      formId: 'profileForm',
      fieldDefinitions: [hiddenField],
      state: visibleState,
    })

    expect(hiddenResult).toEqual({
      isValid: true,
      errorsByFieldId: {
        hiddenNickname: 'Required',
      },
    })
    expect(visibleResult).toEqual({
      isValid: false,
      errorsByFieldId: {
        hiddenNickname: 'Required',
      },
    })
  })

  it('keeps item-based visibility aligned during validation when the field lives inside a repeater', () => {
    const result = validateFormFields({
      formId: 'profileForm',
      fieldDefinitions: [
        createRequiredInputField('hiddenNickname', {
          visibility: {
            reference: 'item.requiresCode',
            operator: 'equals',
            value: true,
          },
        }),
      ],
      state: baseState,
      iterationContext: repeaterIterationContext,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: {
        hiddenNickname: 'Required',
      },
    })
  })

  it('uses custom message for a required field when message is declared', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          username: { value: '', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'username',
          type: 'input',
          validations: { required: { value: true, message: 'Este campo es obligatorio' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { username: 'Este campo es obligatorio' },
    })
  })

  it('substitutes {{value}} in custom message for a minLength rule', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          username: { value: 'ab', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'username',
          type: 'input',
          validations: { minLength: { value: 3, message: 'Mínimo {{value}} caracteres' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { username: 'Mínimo 3 caracteres' },
    })
  })

  it('substitutes {{value}} with empty string for a required rule when rule.value is true', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          username: { value: '', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'username',
          type: 'input',
          validations: { required: { value: true, message: '{{value}} es requerido' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { username: ' es requerido' },
    })
  })

  it('resolves {{translations.key}} in custom message from the active language catalog', () => {
    const state: RuntimeState = {
      ...baseState,
      modal: { activeModalId: null, activeIterationKey: null },
      i18n: {
        translations: {
          max_length_error: { en: 'Maximum length exceeded', es: 'Longitud máxima superada' },
        },
        activeLanguage: 'en',
      },
      tokens: {},
      forms: {
        testForm: {
          bio: { value: 'a'.repeat(101), error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'bio',
          type: 'input',
          validations: { maxLength: { value: 100, message: '{{translations.max_length_error}}' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { bio: 'Maximum length exceeded' },
    })
  })

  it('substitutes {{value}} in custom message for a min rule on a number input field', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          age: { value: '2', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'age',
          type: 'input',
          inputType: 'number',
          validations: { min: { value: 5, message: 'Mínimo {{value}}' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { age: 'Mínimo 5' },
    })
  })

  it('substitutes {{value}} in custom message for a minSelections rule on a multiple select field', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          tags: { value: [], error: null, touched: false, dirty: false, defaultValue: [] },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'tags',
          type: 'checkboxGroup',
          validations: { minSelections: { value: 2, message: 'Selecciona al menos {{value}}' } },
          items: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
          multiple: true,
          defaultValue: [],
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { tags: 'Selecciona al menos 2' },
    })
  })

  it('returns the default runtime message when no custom message is declared on the rule', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          username: { value: 'ab', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'username',
          type: 'input',
          validations: { minLength: { value: 3 } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { username: 'Must be at least 3 characters.' },
    })
  })

  it('stores empty string as the error when message is an explicit empty string for a failing rule', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          username: { value: '', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'username',
          type: 'input',
          validations: { required: { value: true, message: '' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { username: '' },
    })
  })

  it('preserves the existing stored error for a hidden field without re-formatting the message', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          username: { value: '', error: 'Este campo es obligatorio', touched: true, dirty: true, defaultValue: '' },
          role: { value: 'editor', error: null, touched: false, dirty: false, defaultValue: 'editor' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'username',
          type: 'input',
          validations: { required: { value: true, message: 'Este campo es obligatorio' } },
          visibility: {
            reference: 'forms.testForm.role',
            operator: 'equals',
            value: 'admin',
          },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { username: 'Este campo es obligatorio' },
    })
  })
})

describe('pattern, email, and url validation rules', () => {
  it('does not produce error when pattern regex matches the field value', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          code: { value: '12345', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'code',
          type: 'input',
          validations: { pattern: { value: '^\\d{5}$' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { code: null },
    })
  })

  it('produces Invalid format error when pattern regex does not match the field value', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          code: { value: 'abc', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'code',
          type: 'input',
          validations: { pattern: { value: '^\\d{5}$' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { code: 'Invalid format.' },
    })
  })

  it('does not produce error for pattern when the field is empty', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          code: { value: '', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'code',
          type: 'input',
          validations: { pattern: { value: '^\\d{5}$' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { code: null },
    })
  })

  it('uses custom message for pattern when message is declared', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          code: { value: 'abc', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'code',
          type: 'input',
          validations: { pattern: { value: '^\\d{5}$', message: 'Introduce un código postal válido' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { code: 'Introduce un código postal válido' },
    })
  })

  it('does not auto-anchor pattern: "\\d+" accepts "abc123def" as partial match', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          code: { value: 'abc123def', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'code',
          type: 'input',
          validations: { pattern: { value: '\\d+' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { code: null },
    })
  })

  it('does not produce error when email is valid', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          email: { value: 'user@example.com', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'email',
          type: 'input',
          validations: { email: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { email: null },
    })
  })

  it('produces Invalid email address error when email is invalid', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          email: { value: 'noarroba', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'email',
          type: 'input',
          validations: { email: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { email: 'Invalid email address.' },
    })
  })

  it('rejects email without dot in domain', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          email: { value: 'user@example', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'email',
          type: 'input',
          validations: { email: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { email: 'Invalid email address.' },
    })
  })

  it('does not produce error for email when the field is empty', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          email: { value: '', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'email',
          type: 'input',
          validations: { email: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { email: null },
    })
  })

  it('uses custom message for email when message is declared', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          email: { value: 'noarroba', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'email',
          type: 'input',
          validations: { email: { value: true, message: 'Dirección de email no válida' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { email: 'Dirección de email no válida' },
    })
  })

  it('does not produce error when url is valid http', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: 'http://example.com', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { website: null },
    })
  })

  it('does not produce error when url is valid https', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: 'https://example.com', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { website: null },
    })
  })

  it('produces Invalid URL error for ftp protocol', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: 'ftp://files.com', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { website: 'Invalid URL.' },
    })
  })

  it('produces Invalid URL error for non-parseable string', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: 'not-a-url', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { website: 'Invalid URL.' },
    })
  })

  it('produces Invalid URL error for url without double slash (https:dsadas.com)', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: 'https:dsadas.com', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { website: 'Invalid URL.' },
    })
  })

  it('does not produce error for url when the field is empty', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: '', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { website: null },
    })
  })

  it('uses custom message for url when message is declared', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        testForm: {
          website: { value: 'not-a-url', error: null, touched: false, dirty: false, defaultValue: '' },
        },
      },
    }

    const result = validateFormFields({
      formId: 'testForm',
      fieldDefinitions: [
        {
          fieldId: 'website',
          type: 'input',
          validations: { url: { value: true, message: 'Introduce una URL válida' } },
          multiple: false,
          defaultValue: '',
        },
      ],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { website: 'Introduce una URL válida' },
    })
  })
})

function makeFile(name: string, type: string, size: number): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

function makeZeroByteFile(name: string, type = 'application/pdf'): File {
  return new File([], name, { type })
}

describe('evaluateFileManagerBatch', () => {
  it('returns all files as accepted and no rejection when no validations are configured', () => {
    const file1 = makeFile('doc.pdf', 'application/pdf', 1000)
    const file2 = makeFile('image.jpg', 'image/jpeg', 2000)

    const result = evaluateFileManagerBatch(undefined, [], [file1, file2], baseState)

    expect(result.acceptedFiles).toEqual([file1, file2])
    expect(result.rejection).toBeUndefined()
  })

  it('rejects a zero-byte file with scope per-file and ruleName zero-bytes', () => {
    const emptyFile = makeZeroByteFile('empty.pdf')

    const result = evaluateFileManagerBatch(undefined, [], [emptyFile], baseState)

    expect(result.rejection).toBeDefined()
    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('zero-bytes')
    expect(result.rejection?.message).toBe('El fichero "empty.pdf" tiene 0 bytes.')
    expect(result.acceptedFiles).toEqual([])
  })

  it('rejects duplicate name against existingFiles with scope per-file and ruleName duplicate-name', () => {
    const existing = makeFile('doc.pdf', 'application/pdf', 1000)
    const duplicate = makeFile('doc.pdf', 'application/pdf', 500)

    const result = evaluateFileManagerBatch(undefined, [existing], [duplicate], baseState)

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('duplicate-name')
    expect(result.rejection?.message).toBe('Ya se ha subido un fichero con el nombre "doc.pdf".')
    expect(result.acceptedFiles).toEqual([])
  })

  it('rejects second file in incomingBatch that duplicates first file in same batch', () => {
    const file1 = makeFile('doc.pdf', 'application/pdf', 1000)
    const file2 = makeFile('doc.pdf', 'application/pdf', 2000)

    const result = evaluateFileManagerBatch(undefined, [], [file1, file2], baseState)

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('duplicate-name')
    expect(result.acceptedFiles).toEqual([file1])
  })

  it('rejects file with invalid MIME type with scope per-file and ruleName accept', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf', 'image/jpeg'] },
    }
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile], baseState)

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('accept')
    expect(result.rejection?.message).toBe('El fichero "doc.txt" no es de un tipo válido.')
    expect(result.acceptedFiles).toEqual([])
  })

  it('accepts file whose MIME type is in the accept list', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf', 'image/jpeg'] },
    }
    const validFile = makeFile('doc.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [validFile], baseState)

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([validFile])
  })

  it('rejects file exceeding maxFileSize and includes the limit in the message', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFileSize: { value: 0.001 },
    }
    const bigFile = makeFile('big.pdf', 'application/pdf', 2000)

    const result = evaluateFileManagerBatch(validations, [], [bigFile], baseState)

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('maxFileSize')
    expect(result.rejection?.message).toBe('El fichero "big.pdf" supera el tamaño máximo permitido (0.001 MB).')
    expect(result.acceptedFiles).toEqual([])
  })

  it('accepts file within maxFileSize', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFileSize: { value: 0.01 },
    }
    const file = makeFile('doc.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file], baseState)

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([file])
  })

  it('accepts file whose name matches at least one validFileNames regex', () => {
    const validations: RuntimeFileManagerValidations = {
      validFileNames: { value: ['^FACT_\\d{4}_\\d{3}\\.pdf$'] },
    }
    const validFile = makeFile('FACT_2024_001.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [validFile], baseState)

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([validFile])
  })

  it('rejects file whose name does not match any validFileNames regex', () => {
    const validations: RuntimeFileManagerValidations = {
      validFileNames: { value: ['^FACT_\\d{4}_\\d{3}\\.pdf$'] },
    }
    const invalidFile = makeFile('document.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile], baseState)

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('validFileNames')
    expect(result.rejection?.message).toBe('El nombre del fichero "document.pdf" no coincide con los patrones permitidos.')
    expect(result.acceptedFiles).toEqual([])
  })

  it('rejects entire batch when maxFiles is exceeded counting existingFiles + acceptedFiles', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFiles: { value: 2 },
    }
    const existing = makeFile('existing.pdf', 'application/pdf', 1000)
    const file1 = makeFile('new1.pdf', 'application/pdf', 1000)
    const file2 = makeFile('new2.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [existing], [file1, file2], baseState)

    expect(result.rejection?.scope).toBe('batch')
    expect(result.rejection?.ruleName).toBe('maxFiles')
    expect(result.rejection?.message).toBe('Se ha superado el número máximo de ficheros permitidos (2).')
    expect(result.acceptedFiles).toEqual([])
  })

  it('rejects entire batch when maxTotalSize is exceeded by sum of existingFiles.size + acceptedFiles.size', () => {
    const validations: RuntimeFileManagerValidations = {
      maxTotalSize: { value: 0.002 },
    }
    const existing = makeFile('existing.pdf', 'application/pdf', 1000)
    const file1 = makeFile('new1.pdf', 'application/pdf', 800)
    const file2 = makeFile('new2.pdf', 'application/pdf', 800)

    const result = evaluateFileManagerBatch(validations, [existing], [file1, file2], baseState)

    expect(result.rejection?.scope).toBe('batch')
    expect(result.rejection?.ruleName).toBe('maxTotalSize')
    expect(result.rejection?.message).toBe('El tamaño total del lote supera el límite (0.002 MB).')
    expect(result.acceptedFiles).toEqual([])
  })

  it('does not reject for minFiles even when existingFiles + acceptedFiles < minFiles', () => {
    const validations: RuntimeFileManagerValidations = {
      minFiles: { value: 5 },
    }
    const file = makeFile('doc.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file], baseState)

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([file])
  })

  it('uses custom message from per-file rule when provided', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf'], message: 'Solo PDF permitidos' },
    }
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile], baseState)

    expect(result.rejection?.message).toBe('Solo PDF permitidos')
  })

  it('uses custom message from batch rule when provided', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFiles: { value: 1, message: 'Máximo 1 fichero' },
    }
    const file1 = makeFile('a.pdf', 'application/pdf', 1000)
    const file2 = makeFile('b.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file1, file2], baseState)

    expect(result.rejection?.message).toBe('Máximo 1 fichero')
  })

  it('evaluates accept before maxFileSize when file violates both (accept wins)', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['image/jpeg'] },
      maxFileSize: { value: 0.001 },
    }
    const file = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file], baseState)

    expect(result.rejection?.ruleName).toBe('accept')
  })

  it('batch rejection overwrites per-file rejection when both occur', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf'] },
      maxFiles: { value: 1 },
    }
    const existing = makeFile('existing.pdf', 'application/pdf', 1000)
    const invalidMime = makeFile('doc.txt', 'text/plain', 1000)
    const validFile = makeFile('valid.pdf', 'application/pdf', 1000)

    // existing + valid = 2 > maxFiles(1), but invalidMime would also be rejected per-file
    const result = evaluateFileManagerBatch(validations, [existing], [invalidMime, validFile], baseState)

    // batch rejection should win
    expect(result.rejection?.scope).toBe('batch')
    expect(result.rejection?.ruleName).toBe('maxFiles')
    expect(result.acceptedFiles).toEqual([])
  })

  it('continues processing other files in batch when one file is rejected per-file', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf'] },
    }
    const validFile = makeFile('doc.pdf', 'application/pdf', 1000)
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)
    const anotherValidFile = makeFile('report.pdf', 'application/pdf', 2000)

    const result = evaluateFileManagerBatch(validations, [], [validFile, invalidFile, anotherValidFile], baseState)

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('accept')
    // first per-file rejection is invalidFile (second in batch)
    expect(result.acceptedFiles).toEqual([validFile, anotherValidFile])
  })

  it('resolves {{translations.key}} inside a custom accept message from the active language catalog', () => {
    const state: RuntimeState = {
      ...baseState,
      modal: { activeModalId: null, activeIterationKey: null },
      i18n: {
        translations: {
          tipoNoValido: { en: 'Invalid file type', es: 'Tipo de fichero no válido' },
        },
        activeLanguage: 'en',
      },
      tokens: {},
    }
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf'], message: '{{translations.tipoNoValido}}' },
    }
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile], state)

    expect(result.rejection?.message).toBe('Invalid file type')
  })

  it('substitutes {{value}} in a custom maxFileSize message with the configured limit', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFileSize: { value: 2, message: 'Máximo {{value}} MB' },
    }
    const bigFile = makeFile('big.pdf', 'application/pdf', 3 * 1024 * 1024)

    const result = evaluateFileManagerBatch(validations, [], [bigFile], baseState)

    expect(result.rejection?.message).toBe('Máximo 2 MB')
  })

  it('resolves {{translations.key}} inside a custom maxTotalSize message (batch scope)', () => {
    const state: RuntimeState = {
      ...baseState,
      modal: { activeModalId: null, activeIterationKey: null },
      i18n: {
        translations: {
          excedido: { en: 'Total size exceeded', es: 'Tamaño total excedido' },
        },
        activeLanguage: 'en',
      },
      tokens: {},
    }
    const validations: RuntimeFileManagerValidations = {
      maxTotalSize: { value: 0.001, message: '{{translations.excedido}}' },
    }
    const file = makeFile('big.pdf', 'application/pdf', 2000)

    const result = evaluateFileManagerBatch(validations, [], [file], state)

    expect(result.rejection?.scope).toBe('batch')
    expect(result.rejection?.message).toBe('Total size exceeded')
  })

  it('substitutes {{value}} in a custom maxFiles message with the configured limit (batch scope)', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFiles: { value: 3, message: '{{value}} máx' },
    }
    const file1 = makeFile('a.pdf', 'application/pdf', 1000)
    const file2 = makeFile('b.pdf', 'application/pdf', 1000)
    const file3 = makeFile('c.pdf', 'application/pdf', 1000)
    const file4 = makeFile('d.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file1, file2, file3, file4], baseState)

    expect(result.rejection?.scope).toBe('batch')
    expect(result.rejection?.message).toBe('3 máx')
  })

  it('returns a validFileNames custom message without placeholders as-is', () => {
    const validations: RuntimeFileManagerValidations = {
      validFileNames: { value: ['^FACT_\\d{4}_\\d{3}\\.pdf$'], message: 'Nombre de fichero no permitido' },
    }
    const invalidFile = makeFile('document.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile], baseState)

    expect(result.rejection?.message).toBe('Nombre de fichero no permitido')
  })

  it('returns an explicit empty string message for accept instead of falling back to the default', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf'], message: '' },
    }
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile], baseState)

    expect(result.rejection?.message).toBe('')
  })

  it('keeps the hardcoded Spanish message for zero-bytes and duplicate-name, which do not support override', () => {
    const emptyFile = makeZeroByteFile('empty.pdf')
    const zeroBytesResult = evaluateFileManagerBatch(undefined, [], [emptyFile], baseState)
    expect(zeroBytesResult.rejection?.message).toBe('El fichero "empty.pdf" tiene 0 bytes.')

    const existing = makeFile('doc.pdf', 'application/pdf', 1000)
    const duplicate = makeFile('doc.pdf', 'application/pdf', 500)
    const duplicateResult = evaluateFileManagerBatch(undefined, [existing], [duplicate], baseState)
    expect(duplicateResult.rejection?.message).toBe('Ya se ha subido un fichero con el nombre "doc.pdf".')
  })
})

describe('fileInput submit validation', () => {
  function createFileInputField(
    fieldId: string,
    fileValidations?: RuntimeFileInputValidations,
    options: Partial<Pick<ResolvedFormFieldDefinition, 'visibility' | 'queryStateFeedback'>> = {},
  ): ResolvedFormFieldDefinition {
    return {
      fieldId,
      type: 'fileInput',
      fileValidations,
      multiple: true,
      defaultValue: [],
      ...options,
    }
  }

  function makeStateWithFiles(formId: string, fieldId: string, files: File[]): RuntimeState {
    return {
      ...baseState,
      forms: {
        [formId]: {
          [fieldId]: {
            value: files,
            error: null,
            touched: false,
            dirty: false,
            defaultValue: [],
          },
        },
      },
    }
  }

  it('produces Required error and isValid false when required is true and value is empty array', () => {
    const file1 = new File(['content'], 'photo.png', { type: 'image/png' })
    const stateEmpty = makeStateWithFiles('uploadForm', 'attachments', [])
    const stateWithFile = makeStateWithFiles('uploadForm', 'attachments', [file1])

    const fieldDef = createFileInputField('attachments', { required: { value: true } })

    const resultEmpty = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state: stateEmpty,
    })

    expect(resultEmpty).toEqual({
      isValid: false,
      errorsByFieldId: { attachments: 'Required' },
    })

    const resultWithFile = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state: stateWithFile,
    })

    expect(resultWithFile).toEqual({
      isValid: true,
      errorsByFieldId: { attachments: null },
    })
  })

  it('does not produce error when required is absent and value is empty array', () => {
    const state = makeStateWithFiles('uploadForm', 'attachments', [])
    const fieldDef = createFileInputField('attachments', undefined)

    const result = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { attachments: null },
    })
  })

  it('produces minFiles error with default message when file count is below minimum', () => {
    const file1 = new File(['content'], 'photo.png', { type: 'image/png' })
    const file2 = new File(['content'], 'photo2.png', { type: 'image/png' })

    const stateOneFile = makeStateWithFiles('uploadForm', 'attachments', [file1])
    const stateTwoFiles = makeStateWithFiles('uploadForm', 'attachments', [file1, file2])

    const fieldDef = createFileInputField('attachments', { minFiles: { value: 2 } })

    const resultOneFile = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state: stateOneFile,
    })

    expect(resultOneFile).toEqual({
      isValid: false,
      errorsByFieldId: { attachments: 'Select at least 2 files.' },
    })

    const resultTwoFiles = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state: stateTwoFiles,
    })

    expect(resultTwoFiles).toEqual({
      isValid: true,
      errorsByFieldId: { attachments: null },
    })
  })

  it('uses custom message for required rule when message is declared', () => {
    const state = makeStateWithFiles('uploadForm', 'attachments', [])
    const fieldDef = createFileInputField('attachments', {
      required: { value: true, message: 'Sube al menos un fichero' },
    })

    const result = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state,
    })

    expect(result).toEqual({
      isValid: false,
      errorsByFieldId: { attachments: 'Sube al menos un fichero' },
    })
  })

  it('does not produce error for file-only rules (accept, maxFileSize) when value is empty and required is absent', () => {
    const state = makeStateWithFiles('uploadForm', 'attachments', [])
    const fieldDef = createFileInputField('attachments', {
      accept: { value: ['image/jpeg', 'image/png'] },
      maxFileSize: { value: 5 },
      maxTotalSize: { value: 20 },
      maxFiles: { value: 4 },
      validFileNames: { value: ['^IMG_\\d+\\.jpg$'] },
    })

    const result = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state,
    })

    expect(result).toEqual({
      isValid: true,
      errorsByFieldId: { attachments: null },
    })
  })

  it('does not block submit when fileInput is hidden by visibility even if required and value is empty', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {
        uploadForm: {
          role: {
            value: 'editor',
            error: null,
            touched: false,
            dirty: false,
            defaultValue: 'editor',
          },
          attachments: {
            value: [],
            error: null,
            touched: false,
            dirty: false,
            defaultValue: [],
          },
        },
      },
    }

    const fieldDef = createFileInputField(
      'attachments',
      { required: { value: true } },
      {
        visibility: {
          reference: 'forms.uploadForm.role',
          operator: 'equals',
          value: 'admin',
        },
      },
    )

    const result = validateFormFields({
      formId: 'uploadForm',
      fieldDefinitions: [fieldDef],
      state,
    })

    expect(result.isValid).toBe(true)
  })
})

describe('resolveFormFieldValue for fileInput', () => {
  it('returns File array from store when the field exists with files', () => {
    const file = new File(['content'], 'photo.png', { type: 'image/png' })
    const state: RuntimeState = {
      ...baseState,
      forms: {
        uploadForm: {
          attachments: {
            value: [file],
            error: null,
            touched: false,
            dirty: false,
            defaultValue: [],
          },
        },
      },
    }

    const fieldDef: ResolvedFormFieldDefinition = {
      fieldId: 'attachments',
      type: 'fileInput',
      multiple: true,
      defaultValue: [],
    }

    const result = resolveFormFieldValue(fieldDef, 'uploadForm', state)
    expect(result).toEqual([file])
  })

  it('returns empty array as defaultValue when the field is not in store', () => {
    const state: RuntimeState = {
      ...baseState,
      forms: {},
    }

    const fieldDef: ResolvedFormFieldDefinition = {
      fieldId: 'attachments',
      type: 'fileInput',
      multiple: true,
      defaultValue: [],
    }

    const result = resolveFormFieldValue(fieldDef, 'uploadForm', state)
    expect(result).toEqual([])
  })
})
