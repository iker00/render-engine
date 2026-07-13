import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ButtonLayoutNode, RuntimeUiAction } from '../../config/runtime-config'
import { FormContextProvider } from '../../runtime/form-context'
import { ButtonNode } from '../../runtime/nodes/button-layout-node'
import * as runtimeUiActionExecutor from '../../runtime/runtime-actions/runtime-ui-action-executor'

const useRuntimeStateActionsMock = vi.fn()
const runtimeStateMock = {
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
}

vi.mock('../../runtime/runtime-state/runtime-state-provider', () => ({
  useRuntimeState: () => runtimeStateMock,
  useRuntimeStateActions: () => useRuntimeStateActionsMock(),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('executeRuntimeUiAction', () => {
  function createHandlers() {
    return {
      executeQueryOperation: vi.fn(),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }
  }

  it('maps navigateTo to navigateToPage only', () => {
    const handlers = createHandlers()

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'navigateTo',
        pageId: 'details',
      },
      handlers,
    )

    expect(handlers.navigateToPage).toHaveBeenCalledWith('details', undefined, {
      iterationContext: undefined,
    })
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
  })

  it('maps navigateTo params to navigateToPage without resolving them in the executor', () => {
    const handlers = createHandlers()

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'navigateTo',
        pageId: 'details',
        params: {
          userId: 'queries.selectedUser.data.id',
          isEditing: true,
        },
      },
      handlers,
    )

    expect(handlers.navigateToPage).toHaveBeenCalledWith(
      'details',
      {
        userId: 'queries.selectedUser.data.id',
        isEditing: true,
      },
      {
        iterationContext: undefined,
      },
    )
  })

  it('maps goBack to goBackPage only', () => {
    const handlers = createHandlers()

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'goBack',
      },
      handlers,
    )

    expect(handlers.goBackPage).toHaveBeenCalledTimes(1)
    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
  })

  it('maps executeOperation to executeQueryOperation without awaiting in the caller surface', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    const result = runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperation',
        operationName: 'searchUsers',
        query: {
          page: 2,
        },
        body: {
          search: 'forms.userSearch.name',
        },
        headers: {
          authorization: 'queries.session.data.token',
        },
      },
      handlers,
    )

    expect(result).toBeUndefined()
    expect(handlers.executeQueryOperation).toHaveBeenCalledWith('searchUsers', {
      requestParams: {
        query: {
          page: 2,
        },
        body: {
          search: 'forms.userSearch.name',
        },
        headers: {
          authorization: 'queries.session.data.token',
        },
      },
    })
    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
  })

  it('maps resetForm to resetForm only', () => {
    const handlers = createHandlers()

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'resetForm',
        formId: 'search-form',
      },
      handlers,
    )

    expect(handlers.resetForm).toHaveBeenCalledWith('search-form', {
      preserveFieldIds: undefined,
    })
    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
  })

  it('maps openModal to openModal handler only', () => {
    const handlers = createHandlers()

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'openModal',
        modalId: 'my-modal',
      },
      handlers,
    )

    expect(handlers.openModal).toHaveBeenCalledWith('my-modal', {
      iterationContext: undefined,
    })
    expect(handlers.closeModal).not.toHaveBeenCalled()
    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
  })

  it('maps closeModal to closeModal handler only', () => {
    const handlers = createHandlers()

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'closeModal',
        modalId: 'my-modal',
      },
      handlers,
    )

    expect(handlers.closeModal).toHaveBeenCalledWith('my-modal', {
      iterationContext: undefined,
    })
    expect(handlers.openModal).not.toHaveBeenCalled()
    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
  })

  it('propagates iterationContext to openModal', () => {
    const handlers = createHandlers()
    const iterationContext = { item: { id: 'row-1' }, key: 'row-1', itemIndex: 0 }

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'openModal',
        modalId: 'my-modal',
      },
      handlers,
      { iterationContext },
    )

    expect(handlers.openModal).toHaveBeenCalledWith('my-modal', { iterationContext })
  })

  it('propagates iterationContext to closeModal', () => {
    const handlers = createHandlers()
    const iterationContext = { item: { id: 'row-2' }, key: 'row-2', itemIndex: 0 }

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'closeModal',
        modalId: 'my-modal',
      },
      handlers,
      { iterationContext },
    )

    expect(handlers.closeModal).toHaveBeenCalledWith('my-modal', { iterationContext })
  })

  it('calls executeQueryOperation once per entry when executeOperations has two entries in the same tick', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [
          { operationName: 'op1', query: { page: 1 } },
          { operationName: 'op2', body: { id: 'item-1' } },
        ],
      },
      handlers,
    )

    expect(handlers.executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(handlers.executeQueryOperation).toHaveBeenNthCalledWith(1, 'op1', {
      requestParams: { query: { page: 1 }, body: undefined, headers: undefined },
      iterationContext: undefined,
    })
    expect(handlers.executeQueryOperation).toHaveBeenNthCalledWith(2, 'op2', {
      requestParams: { query: undefined, body: { id: 'item-1' }, headers: undefined },
      iterationContext: undefined,
    })
  })

  it('calls executeQueryOperation exactly once for a single-entry executeOperations action', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [{ operationName: 'onlyOp' }],
      },
      handlers,
    )

    expect(handlers.executeQueryOperation).toHaveBeenCalledTimes(1)
    expect(handlers.executeQueryOperation).toHaveBeenCalledWith('onlyOp', {
      requestParams: { query: undefined, body: undefined, headers: undefined },
      iterationContext: undefined,
    })
  })

  it('does not call any other handler when executeOperations is dispatched', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [{ operationName: 'op1' }, { operationName: 'op2' }],
      },
      handlers,
    )

    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.openModal).not.toHaveBeenCalled()
    expect(handlers.closeModal).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
  })

  it('propagates all request params (query, body, headers) per entry in executeOperations', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [
          {
            operationName: 'fullOp',
            query: { filter: 'active' },
            body: { name: 'Ada' },
            headers: { authorization: 'token-xyz' },
          },
        ],
      },
      handlers,
    )

    expect(handlers.executeQueryOperation).toHaveBeenCalledWith('fullOp', {
      requestParams: {
        query: { filter: 'active' },
        body: { name: 'Ada' },
        headers: { authorization: 'token-xyz' },
      },
      iterationContext: undefined,
    })
  })

  it('propagates body null literally in executeOperations entry', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [{ operationName: 'clearOp', body: null }],
      },
      handlers,
    )

    expect(handlers.executeQueryOperation).toHaveBeenCalledWith('clearOp', {
      requestParams: { query: undefined, body: null, headers: undefined },
      iterationContext: undefined,
    })
  })

  it('propagates iterationContext to all executeQueryOperation calls in executeOperations', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)
    const iterationContext = { item: { id: 'row-5' }, key: '4', itemIndex: 4 }

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [{ operationName: 'op1' }, { operationName: 'op2' }],
      },
      handlers,
      { iterationContext },
    )

    expect(handlers.executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(handlers.executeQueryOperation).toHaveBeenNthCalledWith(1, 'op1', {
      requestParams: { query: undefined, body: undefined, headers: undefined },
      iterationContext,
    })
    expect(handlers.executeQueryOperation).toHaveBeenNthCalledWith(2, 'op2', {
      requestParams: { query: undefined, body: undefined, headers: undefined },
      iterationContext,
    })
  })

  it('filters executeOperations entries by when: only launches entries whose condition is met', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    const stateWithQuerySuccess = {
      ...runtimeStateMock,
      queries: {
        statusQuery: {
          status: 'success' as const,
          data: { flag: true },
          error: null,
          requestSignature: null,
        },
      },
    }

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [
          {
            operationName: 'op1',
            when: { reference: 'queries.statusQuery.data.flag', operator: 'isTruthy' },
          },
          {
            operationName: 'op2',
            when: { reference: 'queries.statusQuery.data.flag', operator: 'isFalsy' },
          },
        ],
      },
      handlers,
      { state: stateWithQuerySuccess },
    )

    expect(handlers.executeQueryOperation).toHaveBeenCalledTimes(1)
    expect(handlers.executeQueryOperation).toHaveBeenCalledWith('op1', expect.objectContaining({
      requestParams: { query: undefined, body: undefined, headers: undefined },
    }))
    expect(handlers.executeQueryOperation).not.toHaveBeenCalledWith('op2', expect.anything())
  })

  it('fires no queries when all executeOperations entries are filtered by when', () => {
    const handlers = createHandlers()
    handlers.executeQueryOperation.mockResolvedValue(undefined)

    const stateWithQuerySuccess = {
      ...runtimeStateMock,
      queries: {
        flagQuery: {
          status: 'success' as const,
          data: { enabled: false },
          error: null,
          requestSignature: null,
        },
      },
    }

    runtimeUiActionExecutor.executeRuntimeUiAction(
      {
        type: 'executeOperations',
        operations: [
          {
            operationName: 'op1',
            when: { reference: 'queries.flagQuery.data.enabled', operator: 'isTruthy' },
          },
          {
            operationName: 'op2',
            when: { reference: 'queries.flagQuery.data.enabled', operator: 'isTruthy' },
          },
        ],
      },
      handlers,
      { state: stateWithQuerySuccess },
    )

    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
  })
})

describe('ButtonNode', () => {
  function createButtonNode(action: RuntimeUiAction): ButtonLayoutNode {
    return {
      type: 'button',
      props: {
        label: 'Trigger action',
        action,
      },
    }
  }

  it('delegates clicks to the shared runtime ui action executor', () => {
    const executeRuntimeUiActionSpy = vi.spyOn(runtimeUiActionExecutor, 'executeRuntimeUiAction')
    const runtimeHandlers = {
      executeQueryOperation: vi.fn(),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }

    useRuntimeStateActionsMock.mockReturnValue(runtimeHandlers)

    render(
      <ButtonNode
        node={createButtonNode({
          type: 'executeOperation',
          operationName: 'searchUsers',
          query: {
            page: 2,
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger action' }))

    expect(executeRuntimeUiActionSpy).toHaveBeenCalledWith(
      {
        type: 'executeOperation',
        operationName: 'searchUsers',
        query: {
          page: 2,
        },
      },
      runtimeHandlers,
      {
        iterationContext: undefined,
      },
    )
  })

  it('renders a submit button inside a form when action is omitted and does not call the shared executor on click', () => {
    const executeRuntimeUiActionSpy = vi.spyOn(runtimeUiActionExecutor, 'executeRuntimeUiAction')
    const runtimeHandlers = {
      executeQueryOperation: vi.fn(),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }

    useRuntimeStateActionsMock.mockReturnValue(runtimeHandlers)

    render(
      <FormContextProvider value={{ formId: 'profile-form' }}>
        <ButtonNode
          node={{
            type: 'button',
            props: {
              label: 'Submit profile',
            },
          }}
        />
      </FormContextProvider>,
    )

    const button = screen.getByRole('button', { name: 'Submit profile' })

    expect(button).toHaveAttribute('type', 'submit')
    fireEvent.click(button)
    expect(executeRuntimeUiActionSpy).not.toHaveBeenCalled()
  })

  it('fires two executeQueryOperation calls when ButtonNode with executeOperations is clicked', () => {
    const runtimeHandlers = {
      executeQueryOperation: vi.fn().mockResolvedValue(undefined),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }

    useRuntimeStateActionsMock.mockReturnValue(runtimeHandlers)

    render(
      <ButtonNode
        node={createButtonNode({
          type: 'executeOperations',
          operations: [
            { operationName: 'deleteItem', body: { id: 'item-1' } },
            { operationName: 'reloadList' },
          ],
        })}
      />,
    )

    expect(runtimeHandlers.executeQueryOperation).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Trigger action' }))

    expect(runtimeHandlers.executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(runtimeHandlers.executeQueryOperation).toHaveBeenCalledWith('deleteItem', expect.objectContaining({
      requestParams: expect.objectContaining({ body: { id: 'item-1' } }),
    }))
    expect(runtimeHandlers.executeQueryOperation).toHaveBeenCalledWith('reloadList', expect.objectContaining({
      requestParams: expect.objectContaining({ body: undefined }),
    }))
  })

  it('propagates iterationContext to executeOperations calls when ButtonNode has an iterationContext prop', () => {
    const runtimeHandlers = {
      executeQueryOperation: vi.fn().mockResolvedValue(undefined),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }
    const iterationContext = { item: { id: 'row-7' }, key: '6', itemIndex: 6 }

    useRuntimeStateActionsMock.mockReturnValue(runtimeHandlers)

    render(
      <ButtonNode
        node={createButtonNode({
          type: 'executeOperations',
          operations: [{ operationName: 'op1' }, { operationName: 'op2' }],
        })}
        iterationContext={iterationContext}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger action' }))

    expect(runtimeHandlers.executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(runtimeHandlers.executeQueryOperation).toHaveBeenNthCalledWith(1, 'op1', expect.objectContaining({
      iterationContext,
    }))
    expect(runtimeHandlers.executeQueryOperation).toHaveBeenNthCalledWith(2, 'op2', expect.objectContaining({
      iterationContext,
    }))
  })
})

describe('Button action — header interpolation (T2 integration)', () => {
  function createButtonNodeWithAction(action: RuntimeUiAction): ButtonLayoutNode {
    return {
      type: 'button',
      props: {
        label: 'Trigger action',
        action,
      },
    }
  }

  it('button.props.action.headers with interpolation template passes raw template to executeQueryOperation', () => {
    const runtimeHandlers = {
      executeQueryOperation: vi.fn().mockResolvedValue(undefined),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }

    useRuntimeStateActionsMock.mockReturnValue(runtimeHandlers)

    render(
      <ButtonNode
        node={createButtonNodeWithAction({
          type: 'executeOperation',
          operationName: 'secureAction',
          headers: {
            Authorization: 'Bearer {{tokens.sede.value}}',
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger action' }))

    expect(runtimeHandlers.executeQueryOperation).toHaveBeenCalledWith('secureAction', {
      requestParams: {
        query: undefined,
        body: undefined,
        headers: {
          Authorization: 'Bearer {{tokens.sede.value}}',
        },
      },
    })
  })

  it('executeOperations plural: header templates are passed per-operation to executeQueryOperation (smoke)', () => {
    const runtimeHandlers = {
      executeQueryOperation: vi.fn().mockResolvedValue(undefined),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      resetForm: vi.fn(),
    }

    useRuntimeStateActionsMock.mockReturnValue(runtimeHandlers)

    render(
      <ButtonNode
        node={createButtonNodeWithAction({
          type: 'executeOperations',
          operations: [
            {
              operationName: 'op1',
              headers: { Authorization: 'Bearer {{tokens.sede.value}}' },
            },
            {
              operationName: 'op2',
              headers: { 'X-Static': 'static-value' },
            },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger action' }))

    expect(runtimeHandlers.executeQueryOperation).toHaveBeenCalledTimes(2)
    expect(runtimeHandlers.executeQueryOperation).toHaveBeenNthCalledWith(1, 'op1', {
      requestParams: {
        query: undefined,
        body: undefined,
        headers: { Authorization: 'Bearer {{tokens.sede.value}}' },
      },
      iterationContext: undefined,
    })
    expect(runtimeHandlers.executeQueryOperation).toHaveBeenNthCalledWith(2, 'op2', {
      requestParams: {
        query: undefined,
        body: undefined,
        headers: { 'X-Static': 'static-value' },
      },
      iterationContext: undefined,
    })
  })
})
