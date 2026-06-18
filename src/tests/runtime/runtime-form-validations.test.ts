import { describe, expect, it } from 'vitest'
import type { RuntimeIterationContext } from '../../runtime/runtime-references/runtime-reference-resolver'
import type { ResolvedFormFieldDefinition } from '../../runtime/runtime-form-validations'
import { evaluateFileManagerBatch, validateFormFields } from '../../runtime/runtime-form-validations'
import type { RuntimeFileManagerValidations } from '../../config/runtime-config-types'
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

    const result = evaluateFileManagerBatch(undefined, [], [file1, file2])

    expect(result.acceptedFiles).toEqual([file1, file2])
    expect(result.rejection).toBeUndefined()
  })

  it('rejects a zero-byte file with scope per-file and ruleName zero-bytes', () => {
    const emptyFile = makeZeroByteFile('empty.pdf')

    const result = evaluateFileManagerBatch(undefined, [], [emptyFile])

    expect(result.rejection).toBeDefined()
    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('zero-bytes')
    expect(result.rejection?.message).toBe('El fichero "empty.pdf" tiene 0 bytes.')
    expect(result.acceptedFiles).toEqual([])
  })

  it('rejects duplicate name against existingFiles with scope per-file and ruleName duplicate-name', () => {
    const existing = makeFile('doc.pdf', 'application/pdf', 1000)
    const duplicate = makeFile('doc.pdf', 'application/pdf', 500)

    const result = evaluateFileManagerBatch(undefined, [existing], [duplicate])

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('duplicate-name')
    expect(result.rejection?.message).toBe('Ya se ha subido un fichero con el nombre "doc.pdf".')
    expect(result.acceptedFiles).toEqual([])
  })

  it('rejects second file in incomingBatch that duplicates first file in same batch', () => {
    const file1 = makeFile('doc.pdf', 'application/pdf', 1000)
    const file2 = makeFile('doc.pdf', 'application/pdf', 2000)

    const result = evaluateFileManagerBatch(undefined, [], [file1, file2])

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('duplicate-name')
    expect(result.acceptedFiles).toEqual([file1])
  })

  it('rejects file with invalid MIME type with scope per-file and ruleName accept', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf', 'image/jpeg'] },
    }
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile])

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

    const result = evaluateFileManagerBatch(validations, [], [validFile])

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([validFile])
  })

  it('rejects file exceeding maxFileSize and includes the limit in the message', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFileSize: { value: 0.001 },
    }
    const bigFile = makeFile('big.pdf', 'application/pdf', 2000)

    const result = evaluateFileManagerBatch(validations, [], [bigFile])

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

    const result = evaluateFileManagerBatch(validations, [], [file])

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([file])
  })

  it('accepts file whose name matches at least one validFileNames regex', () => {
    const validations: RuntimeFileManagerValidations = {
      validFileNames: { value: ['^FACT_\\d{4}_\\d{3}\\.pdf$'] },
    }
    const validFile = makeFile('FACT_2024_001.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [validFile])

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([validFile])
  })

  it('rejects file whose name does not match any validFileNames regex', () => {
    const validations: RuntimeFileManagerValidations = {
      validFileNames: { value: ['^FACT_\\d{4}_\\d{3}\\.pdf$'] },
    }
    const invalidFile = makeFile('document.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile])

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

    const result = evaluateFileManagerBatch(validations, [existing], [file1, file2])

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

    const result = evaluateFileManagerBatch(validations, [existing], [file1, file2])

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

    const result = evaluateFileManagerBatch(validations, [], [file])

    expect(result.rejection).toBeUndefined()
    expect(result.acceptedFiles).toEqual([file])
  })

  it('uses custom message from per-file rule when provided', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['application/pdf'], message: 'Solo PDF permitidos' },
    }
    const invalidFile = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [invalidFile])

    expect(result.rejection?.message).toBe('Solo PDF permitidos')
  })

  it('uses custom message from batch rule when provided', () => {
    const validations: RuntimeFileManagerValidations = {
      maxFiles: { value: 1, message: 'Máximo 1 fichero' },
    }
    const file1 = makeFile('a.pdf', 'application/pdf', 1000)
    const file2 = makeFile('b.pdf', 'application/pdf', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file1, file2])

    expect(result.rejection?.message).toBe('Máximo 1 fichero')
  })

  it('evaluates accept before maxFileSize when file violates both (accept wins)', () => {
    const validations: RuntimeFileManagerValidations = {
      accept: { value: ['image/jpeg'] },
      maxFileSize: { value: 0.001 },
    }
    const file = makeFile('doc.txt', 'text/plain', 1000)

    const result = evaluateFileManagerBatch(validations, [], [file])

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
    const result = evaluateFileManagerBatch(validations, [existing], [invalidMime, validFile])

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

    const result = evaluateFileManagerBatch(validations, [], [validFile, invalidFile, anotherValidFile])

    expect(result.rejection?.scope).toBe('per-file')
    expect(result.rejection?.ruleName).toBe('accept')
    // first per-file rejection is invalidFile (second in batch)
    expect(result.acceptedFiles).toEqual([validFile, anotherValidFile])
  })
})
