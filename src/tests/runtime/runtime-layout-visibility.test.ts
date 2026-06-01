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
})
