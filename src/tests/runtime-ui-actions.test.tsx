import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ButtonLayoutNode, RuntimeUiAction } from '../config/runtime-config'
import { FormContextProvider } from '../runtime/form-context'
import { ButtonNode } from '../runtime/nodes/button-layout-node'
import * as runtimeUiActionExecutor from '../runtime/runtime-actions/runtime-ui-action-executor'

const useRuntimeStateActionsMock = vi.fn()

vi.mock('../runtime/runtime-state/runtime-state-provider', () => ({
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

    expect(handlers.navigateToPage).toHaveBeenCalledWith('details')
    expect(handlers.goBackPage).not.toHaveBeenCalled()
    expect(handlers.executeQueryOperation).not.toHaveBeenCalled()
    expect(handlers.resetForm).not.toHaveBeenCalled()
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

    expect(handlers.resetForm).toHaveBeenCalledWith('search-form')
    expect(handlers.navigateToPage).not.toHaveBeenCalled()
    expect(handlers.goBackPage).not.toHaveBeenCalled()
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
    )
  })

  it('renders a submit button inside a form when action is omitted and does not call the shared executor on click', () => {
    const executeRuntimeUiActionSpy = vi.spyOn(runtimeUiActionExecutor, 'executeRuntimeUiAction')
    const runtimeHandlers = {
      executeQueryOperation: vi.fn(),
      goBackPage: vi.fn(),
      navigateToPage: vi.fn(),
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
})
