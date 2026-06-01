export function createConfigWithApi(api: Record<string, unknown>) {
  return {
    api,
    pages: [
      {
        id: 'home',
        layout: [],
      },
    ],
    initialPage: 'home',
  }
}

export function createConfigWithPages(pages: Array<Record<string, unknown>>, initialPage = 'home') {
  return {
    api: {},
    pages,
    initialPage,
  }
}

export function createConfigWithLayout(layout: Array<Record<string, unknown>>) {
  return createConfigWithPages([
    {
      id: 'home',
      layout,
    },
  ])
}

export function createRepeaterNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'repeater',
    props: {
      items: {
        source: 'queries.posts.data',
        key: 'id',
      },
      template: [
        {
          type: 'heading',
          props: {
            text: 'item.title',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'item.summary',
          },
        },
      ],
    },
    ...overrides,
  }
}

export function createConfigWithNavigateToButtonAction(
  actionOverrides: Record<string, unknown> = {},
  options: { extraPages?: Array<Record<string, unknown>> } = {},
) {
  return createConfigWithPages(
    [
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: {
              label: 'Open details',
              action: {
                type: 'navigateTo',
                pageId: 'details',
                ...actionOverrides,
              },
            },
          },
        ],
      },
      {
        id: 'details',
        layout: [],
      },
      ...(options.extraPages ?? []),
    ],
    'home',
  )
}

export function createConfigWithExecuteOperationButtonAction(
  actionOverrides: Record<string, unknown> = {},
  options: { api?: Record<string, unknown> } = {},
) {
  return {
    api: {
      searchUsers: {
        method: 'GET',
        endpoint: '/api/users',
      },
      ...options.api,
    },
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'button',
            props: {
              label: 'Load users',
              action: {
                type: 'executeOperation',
                operationName: 'searchUsers',
                ...actionOverrides,
              },
            },
          },
        ],
      },
    ],
    initialPage: 'home',
  }
}

export function createFormNode(overrides: Record<string, unknown> = {}) {
  return {
    type: 'form',
    id: 'user-form',
    submitAction: {
      type: 'executeOperation',
      operationName: 'submitUserForm',
    },
    resetOnSuccess: true,
    children: [
      {
        type: 'input',
        props: {
          fieldId: 'name',
          label: 'Name',
          defaultValue: 'Ada',
        },
      },
      {
        type: 'container',
        children: [
          {
            type: 'textarea',
            props: {
              fieldId: 'bio',
              label: 'Bio',
              defaultValue: 'Runtime builder',
            },
          },
          {
            type: 'select',
            props: {
              fieldId: 'role',
              label: 'Role',
              defaultValue: 'admin',
              items: [
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
              ],
            },
          },
          {
            type: 'button',
            props: {
              label: 'Submit',
            },
          },
        ],
      },
    ],
    ...overrides,
  }
}

export function createConfigWithFormLayout(
  formOverrides: Record<string, unknown> = {},
  options: { api?: Record<string, unknown>; extraPages?: Array<Record<string, unknown>> } = {},
) {
  return {
    api: {
      submitUserForm: {
        method: 'POST',
        endpoint: '/api/forms',
      },
      ...options.api,
    },
    pages: [
      {
        id: 'home',
        layout: [createFormNode(formOverrides)],
      },
      ...(options.extraPages ?? []),
    ],
    initialPage: 'home',
  }
}

export function createVisibilityRule(overrides: Record<string, unknown> = {}) {
  const rule = {
    reference: 'forms.profile.role',
    operator: 'equals',
    value: 'admin',
    ...overrides,
  }

  if (
    (rule.operator === 'isTruthy' || rule.operator === 'isFalsy') &&
    !Object.prototype.hasOwnProperty.call(overrides, 'value')
  ) {
    delete rule.value
  }

  return rule
}
