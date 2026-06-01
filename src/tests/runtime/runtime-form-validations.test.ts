import { describe, expect, it } from 'vitest'
import type { RuntimeIterationContext } from '../../runtime/runtime-references/runtime-reference-resolver'
import type { ResolvedFormFieldDefinition } from '../../runtime/runtime-form-validations'
import { validateFormFields } from '../../runtime/runtime-form-validations'
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
