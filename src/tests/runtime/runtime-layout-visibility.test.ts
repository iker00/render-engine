import { describe, expect, it } from 'vitest'
import type { LayoutNode, QueryStateFeedbackConfig, RuntimeVisibilityConfig } from '../../config/runtime-config'
import {
  isLayoutNodeVisible,
  matchesVisibilityRule,
  resolveLayoutNodeVisibility,
} from '../../runtime/runtime-layout-visibility'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'

const runtimeState: RuntimeState = {
  navigation: {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    lastError: null,
  },
  forms: {
    profileForm: {
      role: {
        value: 'admin',
        error: null,
        touched: true,
        dirty: true,
        defaultValue: '',
      },
      visits: {
        value: 3,
        error: null,
        touched: true,
        dirty: true,
        defaultValue: 0,
      },
      nickname: {
        value: '',
        error: null,
        touched: false,
        dirty: false,
        defaultValue: '',
      },
      nullable: {
        value: undefined,
        error: null,
        touched: false,
        dirty: false,
      },
    },
  },
  queries: {
    searchUsers: {
      status: 'success',
      data: {
        total: 2,
        results: [
          { id: 'user-1', role: 'admin' },
          { id: 'user-2', role: 'editor' },
        ],
      },
      error: {
        code: 'network',
        message: 'Recovered error',
      },
    },
    pendingUsers: {
      status: 'idle',
      data: null,
      error: null,
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

const iterationContext = {
  item: {
    role: 'admin',
    meta: {
      score: 4,
    },
    tags: ['alpha', 'beta'],
  },
}

function createNode(options: {
  queryStateFeedback?: QueryStateFeedbackConfig
  visibility?: RuntimeVisibilityConfig
  fallback?: readonly LayoutNode[]
} = {}) {
  return {
    type: 'heading',
    props: {
      text: 'Visible heading',
      level: 2,
    },
    ...options,
  } satisfies LayoutNode
}

describe('Runtime layout visibility', () => {
  it('keeps nodes without queryStateFeedback or visibility visible', () => {
    expect(resolveLayoutNodeVisibility(createNode(), runtimeState)).toEqual({
      mode: 'show',
    })
    expect(isLayoutNodeVisible(createNode(), runtimeState)).toBe(true)
  })

  it('applies queryStateFeedback before visibility and only evaluates visibility after show', () => {
    expect(
      resolveLayoutNodeVisibility(
        createNode({
          queryStateFeedback: {
            query: 'pendingUsers',
            states: {
              idle: {
                mode: 'hide',
              },
            },
          },
          visibility: {
            reference: 'forms.profileForm.role',
            operator: 'equals',
            value: 'admin',
          },
        }),
        runtimeState,
      ),
    ).toEqual({
      mode: 'hide',
    })

    expect(
      resolveLayoutNodeVisibility(
        createNode({
          queryStateFeedback: {
            query: 'searchUsers',
            states: {
              success: {
                mode: 'show',
              },
            },
          },
          visibility: {
            reference: 'forms.profileForm.role',
            operator: 'equals',
            value: 'guest',
          },
        }),
        runtimeState,
      ),
    ).toEqual({
      mode: 'hide',
    })
  })

  it('preserves queryStateFeedback fallback without letting visibility reopen the original node', () => {
    const fallback = [
      {
        type: 'paragraph',
        props: {
          text: 'Loading fallback',
        },
      },
    ] satisfies readonly LayoutNode[]

    expect(
      resolveLayoutNodeVisibility(
        createNode({
          queryStateFeedback: {
            query: 'pendingUsers',
            states: {
              idle: {
                mode: 'fallback',
                fallback,
              },
            },
          },
          visibility: {
            reference: 'forms.profileForm.role',
            operator: 'equals',
            value: 'guest',
          },
        }),
        runtimeState,
      ),
    ).toEqual({
      mode: 'fallback',
      fallback,
      visibleState: 'idle',
    })
  })

  it('evaluates equals and notEquals against the declared literal without coercion', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.role',
          operator: 'equals',
          value: 'admin',
        },
        runtimeState,
      ),
    ).toBe(true)

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.status',
          operator: 'equals',
          value: 'success',
        },
        runtimeState,
      ),
    ).toBe(true)

    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.visits',
          operator: 'equals',
          value: '3',
        },
        runtimeState,
      ),
    ).toBe(false)

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.status',
          operator: 'notEquals',
          value: 'loading',
        },
        runtimeState,
      ),
    ).toBe(true)
  })

  it('keeps value strings that look like references as literals', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.role',
          operator: 'equals',
          value: 'queries.searchUsers.status',
        },
        runtimeState,
      ),
    ).toBe(false)
  })

  it('treats missing references as absent values for truthy and falsy checks', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.missingField',
          operator: 'isTruthy',
        },
        runtimeState,
      ),
    ).toBe(false)

    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.missingField',
          operator: 'isFalsy',
        },
        runtimeState,
      ),
    ).toBe(true)

    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.nickname',
          operator: 'isFalsy',
        },
        runtimeState,
      ),
    ).toBe(true)
  })

  it('supports truthy and falsy checks for objects and null-like query values', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers',
          operator: 'isTruthy',
        },
        runtimeState,
      ),
    ).toBe(true)

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.pendingUsers.error',
          operator: 'isFalsy',
        },
        runtimeState,
      ),
    ).toBe(true)

    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.nullable',
          operator: 'isFalsy',
        },
        runtimeState,
      ),
    ).toBe(true)
  })

  it('compares numbers directly and arrays by length for greaterThan and lessThan', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.visits',
          operator: 'greaterThan',
          value: 2,
        },
        runtimeState,
      ),
    ).toBe(true)

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.data.results',
          operator: 'lessThan',
          value: 3,
        },
        runtimeState,
      ),
    ).toBe(true)
  })

  it('degrades non-comparable values to no match for greaterThan and lessThan', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers',
          operator: 'greaterThan',
          value: 0,
        },
        runtimeState,
      ),
    ).toBe(false)

    expect(
      matchesVisibilityRule(
        {
          reference: 'forms.profileForm.role',
          operator: 'lessThan',
          value: 5,
        },
        runtimeState,
      ),
    ).toBe(false)

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.pendingUsers.error',
          operator: 'greaterThan',
          value: 0,
        },
        runtimeState,
      ),
    ).toBe(false)
  })

  it('returns the same visibility decision for render and form consumers through the shared helper', () => {
    const feedbackFields = {
      visibility: {
        reference: 'queries.searchUsers.data.results',
        operator: 'greaterThan',
        value: 1,
      },
    } satisfies Pick<LayoutNode, 'visibility'>

    expect(resolveLayoutNodeVisibility(feedbackFields, runtimeState)).toEqual({
      mode: 'show',
    })
    expect(isLayoutNodeVisible(feedbackFields, runtimeState)).toBe(true)
  })

  it('supports item.* visibility references only when iteration context is provided', () => {
    const visibility = {
      reference: 'item.role',
      operator: 'equals',
      value: 'admin',
    } satisfies RuntimeVisibilityConfig

    expect(matchesVisibilityRule(visibility, runtimeState)).toBe(false)
    expect(matchesVisibilityRule(visibility, runtimeState, iterationContext)).toBe(true)

    expect(
      resolveLayoutNodeVisibility(
        {
          visibility,
        },
        runtimeState,
        iterationContext,
      ),
    ).toEqual({
      mode: 'show',
    })
  })

  it('degrades missing or non-navigable item visibility references without changing queryStateFeedback precedence', () => {
    expect(
      matchesVisibilityRule(
        {
          reference: 'item.meta.score.value',
          operator: 'isTruthy',
        },
        runtimeState,
        iterationContext,
      ),
    ).toBe(false)

    expect(
      resolveLayoutNodeVisibility(
        {
          queryStateFeedback: {
            query: 'pendingUsers',
            states: {
              idle: {
                mode: 'hide',
              },
            },
          },
          visibility: {
            reference: 'item.role',
            operator: 'equals',
            value: 'admin',
          },
        },
        runtimeState,
        iterationContext,
      ),
    ).toEqual({
      mode: 'hide',
    })
  })

  it('evaluates error.code equality when the query has an active error with matching code', () => {
    const stateWithUnauthorizedError: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'error',
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized',
          },
        },
      },
    }

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.error.code',
          operator: 'equals',
          value: 'UNAUTHORIZED',
        },
        stateWithUnauthorizedError,
      ),
    ).toBe(true)
  })

  it('evaluates error.code equality as false when the error code does not match', () => {
    const stateWithHttpError: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'error',
          data: null,
          error: {
            code: 'http-error',
            message: 'HTTP error',
          },
        },
      },
    }

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.error.code',
          operator: 'equals',
          value: 'UNAUTHORIZED',
        },
        stateWithHttpError,
      ),
    ).toBe(false)
  })

  it('evaluates error.code equals as false when the query has no active error', () => {
    const stateWithSuccess: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'success',
          data: ['Ada'],
          error: null,
        },
      },
    }

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.error.code',
          operator: 'equals',
          value: 'UNAUTHORIZED',
        },
        stateWithSuccess,
      ),
    ).toBe(false)
  })

  it('evaluates error.code isFalsy as true when the query has no active error', () => {
    const stateWithIdle: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'idle',
          data: null,
          error: null,
        },
      },
    }

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.error.code',
          operator: 'isFalsy',
        },
        stateWithIdle,
      ),
    ).toBe(true)
  })

  it('evaluates error.code isTruthy as true when error has business-error-condition code', () => {
    const stateWithBusinessError: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'error',
          data: null,
          error: {
            code: 'business-error-condition',
            message: 'Error en la respuesta del servidor',
          },
        },
      },
    }

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.error.code',
          operator: 'isTruthy',
        },
        stateWithBusinessError,
      ),
    ).toBe(true)
  })

  it('evaluates error.message isTruthy as true when the query has an active error with non-empty message', () => {
    const stateWithActiveError: RuntimeState = {
      ...runtimeState,
      queries: {
        ...runtimeState.queries,
        searchUsers: {
          status: 'error',
          data: null,
          error: {
            code: 'http-error',
            message: 'Could not connect',
          },
        },
      },
    }

    expect(
      matchesVisibilityRule(
        {
          reference: 'queries.searchUsers.error.message',
          operator: 'isTruthy',
        },
        stateWithActiveError,
      ),
    ).toBe(true)
  })

  describe('params.* visibility references', () => {
    const stateWithParams: RuntimeState = {
      ...runtimeState,
      navigation: {
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: { userId: 'u-42', mode: 'edit', page: '3' } },
        ],
        currentEntryIndex: 1,
        lastError: null,
      },
      pageEntry: {
        entryId: 1,
        pageId: 'details',
        params: { userId: 'u-42', mode: 'edit', page: '3' },
        preloadNames: [],
        status: 'idle',
      },
    }

    const stateWithoutParam: RuntimeState = {
      ...runtimeState,
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        currentEntryIndex: 0,
        lastError: null,
      },
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    it('isTruthy: shows when param contains a non-empty string; hides when param is absent', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isTruthy' },
          stateWithParams,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isTruthy' },
          stateWithoutParam,
        ),
      ).toBe(false)
    })

    it('isFalsy: shows when param is absent or empty string; hides when param is a non-empty string', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isFalsy' },
          stateWithoutParam,
        ),
      ).toBe(true)

      const stateWithEmptyParam: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'details',
          history: [{ entryId: 0, pageId: 'details', params: { userId: '' } }],
          currentEntryIndex: 0,
          lastError: null,
        },
        pageEntry: {
          entryId: 0,
          pageId: 'details',
          params: { userId: '' },
          preloadNames: [],
          status: 'idle',
        },
      }

      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isFalsy' },
          stateWithEmptyParam,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isFalsy' },
          stateWithParams,
        ),
      ).toBe(false)
    })

    it('equals: shows only when param matches exact value; hides when different or absent', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'equals', value: 'edit' },
          stateWithParams,
        ),
      ).toBe(true)

      const stateWithReadonlyMode: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'details',
          history: [{ entryId: 0, pageId: 'details', params: { mode: 'readonly' } }],
          currentEntryIndex: 0,
          lastError: null,
        },
        pageEntry: {
          entryId: 0,
          pageId: 'details',
          params: { mode: 'readonly' },
          preloadNames: [],
          status: 'idle',
        },
      }

      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'equals', value: 'edit' },
          stateWithReadonlyMode,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'equals', value: 'edit' },
          stateWithoutParam,
        ),
      ).toBe(false)
    })

    it('notEquals: shows when param differs from value; hides when param is absent (absent = no-match)', () => {
      const stateWithReadonlyMode: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'details',
          history: [{ entryId: 0, pageId: 'details', params: { mode: 'readonly' } }],
          currentEntryIndex: 0,
          lastError: null,
        },
        pageEntry: {
          entryId: 0,
          pageId: 'details',
          params: { mode: 'readonly' },
          preloadNames: [],
          status: 'idle',
        },
      }

      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'notEquals', value: 'readonly' },
          stateWithParams,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'notEquals', value: 'readonly' },
          stateWithReadonlyMode,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'notEquals', value: 'readonly' },
          stateWithoutParam,
        ),
      ).toBe(false)
    })

    it('equals with boolean value: strict comparison against string param — no coercion', () => {
      const stateWithStringTrue: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'details',
          history: [{ entryId: 0, pageId: 'details', params: { mode: 'true' } }],
          currentEntryIndex: 0,
          lastError: null,
        },
        pageEntry: {
          entryId: 0,
          pageId: 'details',
          params: { mode: 'true' },
          preloadNames: [],
          status: 'idle',
        },
      }

      expect(
        matchesVisibilityRule(
          { reference: 'params.mode', operator: 'equals', value: true },
          stateWithStringTrue,
        ),
      ).toBe(false)
    })

    it('greaterThan: string param degrades to no-match without error', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'params.page', operator: 'greaterThan', value: 2 },
          stateWithParams,
        ),
      ).toBe(false)
    })

    it('lessThan: string param degrades to no-match without error', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'params.page', operator: 'lessThan', value: 10 },
          stateWithParams,
        ),
      ).toBe(false)
    })

    it('page change that removes referenced param: absent param applies value-absent semantics per operator', () => {
      const stateBeforePageChange: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'details',
          history: [{ entryId: 0, pageId: 'details', params: { userId: 'u-42' } }],
          currentEntryIndex: 0,
          lastError: null,
        },
        pageEntry: {
          entryId: 0,
          pageId: 'details',
          params: { userId: 'u-42' },
          preloadNames: [],
          status: 'idle',
        },
      }

      const stateAfterPageChange: RuntimeState = {
        ...runtimeState,
        navigation: {
          currentPageId: 'home',
          history: [
            { entryId: 0, pageId: 'details', params: { userId: 'u-42' } },
            { entryId: 1, pageId: 'home', params: {} },
          ],
          currentEntryIndex: 1,
          lastError: null,
        },
        pageEntry: {
          entryId: 1,
          pageId: 'home',
          params: {},
          preloadNames: [],
          status: 'idle',
        },
      }

      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isFalsy' },
          stateBeforePageChange,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'isFalsy' },
          stateAfterPageChange,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'params.userId', operator: 'equals', value: 'u-42' },
          stateAfterPageChange,
        ),
      ).toBe(false)
    })
  })

  describe('boolean composition and negate', () => {
    it('and group with two matching simple conditions is a match', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'admin' },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 2 },
            ],
          },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('and group with one non-matching simple condition is not a match', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'admin' },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 10 },
            ],
          },
          runtimeState,
        ),
      ).toBe(false)
    })

    it('or group with at least one matching simple condition is a match', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'editor' },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 2 },
            ],
          },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('or group with no matching simple condition is not a match', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'editor' },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 10 },
            ],
          },
          runtimeState,
        ),
      ).toBe(false)
    })

    it('and group with a single condition behaves like the standalone condition', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [{ reference: 'forms.profileForm.role', operator: 'equals', value: 'admin' }],
          },
          runtimeState,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [{ reference: 'forms.profileForm.role', operator: 'equals', value: 'editor' }],
          },
          runtimeState,
        ),
      ).toBe(false)
    })

    it('or group with a single condition behaves like the standalone condition', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [{ reference: 'forms.profileForm.role', operator: 'equals', value: 'admin' }],
          },
          runtimeState,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [{ reference: 'forms.profileForm.role', operator: 'equals', value: 'editor' }],
          },
          runtimeState,
        ),
      ).toBe(false)
    })

    it('negate: true on equals inverts the match', () => {
      expect(
        matchesVisibilityRule(
          {
            reference: 'forms.profileForm.role',
            operator: 'equals',
            value: 'admin',
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          {
            reference: 'forms.profileForm.role',
            operator: 'equals',
            value: 'editor',
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('negate: true on isTruthy with missing reference flips from no match to match', () => {
      expect(
        matchesVisibilityRule(
          {
            reference: 'forms.profileForm.missingField',
            operator: 'isTruthy',
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('negate: true on isFalsy with missing reference flips from match to no match', () => {
      expect(
        matchesVisibilityRule(
          {
            reference: 'forms.profileForm.missingField',
            operator: 'isFalsy',
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(false)
    })

    it('negate: true on greaterThan with non-comparable string value flips from no match to match', () => {
      expect(
        matchesVisibilityRule(
          {
            reference: 'forms.profileForm.role',
            operator: 'greaterThan',
            value: 5,
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('negate: true on lessThan with non-comparable object or null value flips from no match to match', () => {
      expect(
        matchesVisibilityRule(
          {
            reference: 'queries.searchUsers',
            operator: 'lessThan',
            value: 100,
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          {
            reference: 'queries.pendingUsers.error',
            operator: 'lessThan',
            value: 100,
            negate: true,
          },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('and group combines individual results (with negate already applied) using AND', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'editor', negate: true },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 2 },
            ],
          },
          runtimeState,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'admin', negate: true },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 2 },
            ],
          },
          runtimeState,
        ),
      ).toBe(false)
    })

    it('or group combines individual results (with negate already applied) using OR', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'admin', negate: true },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 2 },
            ],
          },
          runtimeState,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'admin', negate: true },
              { reference: 'forms.profileForm.visits', operator: 'greaterThan', value: 10 },
            ],
          },
          runtimeState,
        ),
      ).toBe(false)
    })
  })

  describe('arrayContains', () => {
    function stateWithQueryXData(data: unknown): RuntimeState {
      return {
        ...runtimeState,
        queries: {
          ...runtimeState.queries,
          x: {
            status: 'success',
            data,
            error: null,
          },
        },
      }
    }

    it('matches when itemField resolves to the condition value on some element of an object array', () => {
      const state = stateWithQueryXData({
        permissions: [{ code: '1-1' }, { code: '1-2' }, { code: '2-2' }, { code: '3-1' }],
      })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', itemField: 'code', value: '3-1' },
          state,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', itemField: 'code', value: '9-9' },
          state,
        ),
      ).toBe(false)
    })

    it('matches the full element against the condition value when itemField is not declared (primitive array)', () => {
      const state = stateWithQueryXData({ tags: ['a', 'b', 'c'] })

      expect(
        matchesVisibilityRule({ reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'b' }, state),
      ).toBe(true)

      expect(
        matchesVisibilityRule({ reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'z' }, state),
      ).toBe(false)
    })

    it('navigates nested itemField segments before comparing', () => {
      const state = stateWithQueryXData({
        permissions: [{ user: { code: '1-1' } }, { user: { code: '3-1' } }],
      })

      expect(
        matchesVisibilityRule(
          {
            reference: 'queries.x.data.permissions',
            operator: 'arrayContains',
            itemField: 'user.code',
            value: '3-1',
          },
          state,
        ),
      ).toBe(true)
    })

    it('does not match when the reference does not resolve', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', value: 'a' },
          stateWithQueryXData({}),
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', value: 'a' },
          runtimeState,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', value: 'a' },
          stateWithQueryXData('not navigable'),
        ),
      ).toBe(false)
    })

    it('does not match when the resolved reference value is not an array', () => {
      const nonArrayValues: unknown[] = [{ nested: true }, 'a string', 42, true, null]

      nonArrayValues.forEach((permissions) => {
        expect(
          matchesVisibilityRule(
            { reference: 'queries.x.data.permissions', operator: 'arrayContains', value: 'a' },
            stateWithQueryXData({ permissions }),
          ),
        ).toBe(false)
      })
    })

    it('does not match an empty array, with or without itemField', () => {
      const state = stateWithQueryXData({ permissions: [] })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', value: 'a' },
          state,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', itemField: 'code', value: 'a' },
          state,
        ),
      ).toBe(false)
    })

    it('does not match when itemField segment is missing on every element', () => {
      const state = stateWithQueryXData({
        permissions: [{ other: 'x' }, { other: 'y' }],
      })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', itemField: 'code', value: '3-1' },
          state,
        ),
      ).toBe(false)
    })

    it('does not match when itemField is declared over an array of primitives', () => {
      const state = stateWithQueryXData({ tags: ['a', 'b'] })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.tags', operator: 'arrayContains', itemField: 'code', value: 'a' },
          state,
        ),
      ).toBe(false)
    })

    it('ignores non plain-object elements in a mixed array without invalidating the match', () => {
      const state = stateWithQueryXData({
        permissions: [{ code: '1-1' }, 'suelto', 42, null],
      })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', itemField: 'code', value: '1-1' },
          state,
        ),
      ).toBe(true)
    })

    it('matches value: null with itemField using strict equality', () => {
      const state = stateWithQueryXData({
        permissions: [{ code: null }, { code: 'x' }],
      })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.permissions', operator: 'arrayContains', itemField: 'code', value: null },
          state,
        ),
      ).toBe(true)
    })

    it('behaves the same on a single-element array as on any other size', () => {
      const state = stateWithQueryXData({ tags: ['only'] })

      expect(
        matchesVisibilityRule({ reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'only' }, state),
      ).toBe(true)

      expect(
        matchesVisibilityRule({ reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'other' }, state),
      ).toBe(false)
    })

    it('negate: true inverts the match', () => {
      const state = stateWithQueryXData({ tags: ['a', 'b', 'c'] })

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'z', negate: true },
          state,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'b', negate: true },
          state,
        ),
      ).toBe(false)
    })

    it('composes with or/and groups alongside other operators', () => {
      const state = stateWithQueryXData({ tags: ['a', 'b', 'c'] })

      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [
              { reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'b' },
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'editor' },
            ],
          },
          state,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [
              { reference: 'queries.x.data.tags', operator: 'arrayContains', value: 'b' },
              { reference: 'forms.profileForm.role', operator: 'equals', value: 'editor' },
            ],
          },
          state,
        ),
      ).toBe(false)
    })
  })

  describe('row.* references', () => {
    it('matches a simple condition against iterationContext.row', () => {
      const visibility = {
        reference: 'row.status',
        operator: 'equals',
        value: 'active',
      } satisfies RuntimeVisibilityConfig

      expect(
        matchesVisibilityRule(visibility, runtimeState, { row: { status: 'active' }, rowIndex: 1 }),
      ).toBe(true)
    })

    it('does not match the same condition when iterationContext.row has a different value', () => {
      const visibility = {
        reference: 'row.status',
        operator: 'equals',
        value: 'active',
      } satisfies RuntimeVisibilityConfig

      expect(
        matchesVisibilityRule(visibility, runtimeState, { row: { status: 'archived' }, rowIndex: 1 }),
      ).toBe(false)
    })

    it('degrades row.* to an absent reference when iterationContext is undefined, matching the item.* precedent', () => {
      expect(
        matchesVisibilityRule(
          { reference: 'row.status', operator: 'equals', value: 'active' },
          runtimeState,
        ),
      ).toBe(false)

      expect(
        matchesVisibilityRule(
          { reference: 'row.status', operator: 'isFalsy' },
          runtimeState,
        ),
      ).toBe(true)
    })

    it('matches row.$index against iterationContext.rowIndex', () => {
      const visibility = {
        reference: 'row.$index',
        operator: 'lessThan',
        value: 4,
      } satisfies RuntimeVisibilityConfig

      expect(matchesVisibilityRule(visibility, runtimeState, { row: {}, rowIndex: 3 })).toBe(true)
    })

    it('combines row.* with forms.* in an and group', () => {
      const stateWithActiveFilter: RuntimeState = {
        ...runtimeState,
        forms: {
          ...runtimeState.forms,
          filters: {
            active: {
              value: true,
              error: null,
              touched: true,
              dirty: true,
              defaultValue: false,
            },
          },
        },
      }

      expect(
        matchesVisibilityRule(
          {
            operator: 'and',
            conditions: [
              { reference: 'row.status', operator: 'equals', value: 'active' },
              { reference: 'forms.filters.active', operator: 'isTruthy' },
            ],
          },
          stateWithActiveFilter,
          { row: { status: 'active' } },
        ),
      ).toBe(true)
    })

    it('combines row.* with queries.* in an or group', () => {
      expect(
        matchesVisibilityRule(
          {
            operator: 'or',
            conditions: [
              { reference: 'row.priority', operator: 'greaterThan', value: 3 },
              { reference: 'queries.overrideVisible.data', operator: 'isTruthy' },
            ],
          },
          runtimeState,
          { row: { priority: 5 } },
        ),
      ).toBe(true)
    })

    it('resolves row.* and item.* independently from a mixed iterationContext without mutual shadowing', () => {
      const mixedIterationContext = {
        item: { name: 'Repeater item' },
        itemIndex: 0,
        row: { name: 'Row data' },
        rowIndex: 2,
      }

      expect(
        matchesVisibilityRule(
          { reference: 'row.name', operator: 'equals', value: 'Row data' },
          runtimeState,
          mixedIterationContext,
        ),
      ).toBe(true)

      expect(
        matchesVisibilityRule(
          { reference: 'item.name', operator: 'equals', value: 'Repeater item' },
          runtimeState,
          mixedIterationContext,
        ),
      ).toBe(true)
    })
  })
})
