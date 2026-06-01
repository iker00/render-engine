import { screen } from '@testing-library/react'
import { useEffect } from 'react'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import {
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'

export function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()

  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

export function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

export function FormRuntimeFixture() {
  const { initializeQuery, setQueryLoading, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('visibilityQuery')
  }, [initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQueryLoading('visibilityQuery')}>
        Set visibility loading
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Set visibility success
      </button>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

export function RepeaterFormFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('profiles')
    setQuerySuccess('profiles', [
      {
        id: 'ada',
        requiresCode: true,
      },
    ])
  }, [initializeQuery, setQuerySuccess])

  return (
    <>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

export function DynamicSelectQueryFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('roleCatalog')
    initializeQuery('visibilityQuery')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('roleCatalog', {
            results: [
              {
                id: 'admin',
                label: 'Admin',
              },
              {
                id: 'editor',
                label: 'Editor',
              },
            ],
          })
        }
      >
        Seed role catalog
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('roleCatalog', {
            results: [
              {
                id: 'viewer',
                label: 'Viewer',
              },
            ],
          })
        }
      >
        Seed replacement role catalog
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Seed dynamic visibility success
      </button>
    </>
  )
}

export function VisibilityRuleQueryFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('selectedUser')
    initializeQuery('visibilityQuery')
    initializeQuery('thresholdQuery')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Countess',
            },
          })
        }
      >
        Seed conditional selected user
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Set conditional visibility success
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('thresholdQuery', [
            { id: 'user-1' },
            { id: 'user-2' },
          ])
        }
      >
        Seed threshold list
      </button>
      <button type="button" onClick={() => setQuerySuccess('thresholdQuery', [])}>
        Seed threshold empty list
      </button>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}
