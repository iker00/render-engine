import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimeStateSnapshot } from './helpers'
import { readRuntimeStateSnapshot } from './read-runtime-state-snapshot'

const testConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

function buildStateWithField(fieldValue: unknown = '123 Main St') {
  const state = createRuntimeState(testConfig)
  return runtimeStateReducer(state, {
    type: 'forms/initialize',
    payload: { formId: 'address-form', fields: { address: { defaultValue: fieldValue } } },
  })
}

describe('forms domain — synthetic field metadata (reducer)', () => {
  it('stores synthetic keys on an already-initialized field without altering value, error, touched or dirty', () => {
    const state = buildStateWithField('123 Main St')

    const next = runtimeStateReducer(state, {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7, lng: -74 } },
    })

    expect(next.forms['address-form'].address).toEqual({
      value: '123 Main St',
      error: null,
      touched: false,
      dirty: false,
      defaultValue: '123 Main St',
      synthetic: { lat: 40.7, lng: -74 },
    })
  })

  it('merges successive dispatches with distinct keys and overwrites only the repeated key', () => {
    const state = buildStateWithField()

    const withLat = runtimeStateReducer(state, {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7 } },
    })
    const withLatLng = runtimeStateReducer(withLat, {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lng: -74 } },
    })

    expect(withLatLng.forms['address-form'].address.synthetic).toEqual({ lat: 40.7, lng: -74 })

    const overwritten = runtimeStateReducer(withLatLng, {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 41.0 } },
    })

    expect(overwritten.forms['address-form'].address.synthetic).toEqual({ lat: 41.0, lng: -74 })
  })

  it('preserves synthetic when forms/set-value runs afterward (editing the text does not erase coordinates)', () => {
    const withSynthetic = runtimeStateReducer(buildStateWithField(), {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7, lng: -74 } },
    })

    const next = runtimeStateReducer(withSynthetic, {
      type: 'forms/set-value',
      payload: { formId: 'address-form', fieldId: 'address', value: '456 Elm St' },
    })

    expect(next.forms['address-form'].address).toMatchObject({
      value: '456 Elm St',
      synthetic: { lat: 40.7, lng: -74 },
    })
  })

  it('preserves synthetic when forms/set-error runs afterward', () => {
    const withSynthetic = runtimeStateReducer(buildStateWithField(), {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7, lng: -74 } },
    })

    const next = runtimeStateReducer(withSynthetic, {
      type: 'forms/set-error',
      payload: { formId: 'address-form', fieldId: 'address', error: 'Required' },
    })

    expect(next.forms['address-form'].address).toMatchObject({
      error: 'Required',
      synthetic: { lat: 40.7, lng: -74 },
    })
  })

  it('clears synthetic together with the rest of the field state on forms/reset', () => {
    const withSynthetic = runtimeStateReducer(buildStateWithField(), {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7, lng: -74 } },
    })

    const next = runtimeStateReducer(withSynthetic, {
      type: 'forms/reset',
      payload: { formId: 'address-form' },
    })

    expect(next.forms['address-form'].address.synthetic).toBeUndefined()
  })

  it('removes the whole form, including synthetic, on forms/remove', () => {
    const withSynthetic = runtimeStateReducer(buildStateWithField(), {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7 } },
    })

    const next = runtimeStateReducer(withSynthetic, {
      type: 'forms/remove',
      payload: { formId: 'address-form' },
    })

    expect(next.forms['address-form']).toBeUndefined()
  })

  it('is a no-op on a field that does not exist in store: no field is created and nothing throws', () => {
    const state = createRuntimeState(testConfig)

    const next = runtimeStateReducer(state, {
      type: 'forms/set-synthetic',
      payload: { formId: 'address-form', fieldId: 'address', synthetic: { lat: 40.7 } },
    })

    expect(next.forms['address-form']).toBeUndefined()
  })

  it('leaves synthetic undefined for a field initialized without coordinates', () => {
    const state = buildStateWithField()

    expect(state.forms['address-form'].address.synthetic).toBeUndefined()
    expect(Object.keys(state.forms['address-form'].address)).not.toContain('synthetic')
  })

  it('produces the exact same field shape as before for a form that never uses synthetic (regression)', () => {
    const initialized = buildStateWithField('Ada')
    expect(initialized.forms['address-form'].address).toEqual({
      value: 'Ada',
      error: null,
      touched: false,
      dirty: false,
      defaultValue: 'Ada',
    })

    const afterSetValue = runtimeStateReducer(initialized, {
      type: 'forms/set-value',
      payload: { formId: 'address-form', fieldId: 'address', value: 'Grace' },
    })
    expect(afterSetValue.forms['address-form'].address).toEqual({
      value: 'Grace',
      error: null,
      touched: true,
      dirty: true,
      defaultValue: 'Ada',
    })

    const afterSetError = runtimeStateReducer(afterSetValue, {
      type: 'forms/set-error',
      payload: { formId: 'address-form', fieldId: 'address', error: 'Required' },
    })
    expect(afterSetError.forms['address-form'].address).toEqual({
      value: 'Grace',
      error: 'Required',
      touched: true,
      dirty: true,
      defaultValue: 'Ada',
    })

    const afterReset = runtimeStateReducer(afterSetError, {
      type: 'forms/reset',
      payload: { formId: 'address-form' },
    })
    expect(afterReset.forms['address-form'].address).toEqual({
      value: 'Ada',
      error: null,
      touched: false,
      dirty: false,
      defaultValue: 'Ada',
    })

    const afterRemove = runtimeStateReducer(afterReset, {
      type: 'forms/remove',
      payload: { formId: 'address-form' },
    })
    expect(afterRemove.forms['address-form']).toBeUndefined()
  })
})

function ScopedSyntheticFixture() {
  const { initializeForm, setFormFieldSynthetic } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm(
      'address-form',
      { address: { defaultValue: '' } },
      { scopeChain: [{ kind: 'repeater', key: 'row-1' }] },
    )
    initializeForm(
      'address-form',
      { address: { defaultValue: '' } },
      { scopeChain: [{ kind: 'repeater', key: 'row-2' }] },
    )
  }, [initializeForm])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setFormFieldSynthetic(
            'address-form',
            'address',
            { lat: 1 },
            { scopeChain: [{ kind: 'repeater', key: 'row-1' }] },
          )
        }
      >
        Set row-1 coordinates
      </button>
      <button
        type="button"
        onClick={() =>
          setFormFieldSynthetic(
            'address-form',
            'address',
            { lat: 2 },
            { scopeChain: [{ kind: 'repeater', key: 'row-2' }] },
          )
        }
      >
        Set row-2 coordinates
      </button>
    </>
  )
}

describe('forms domain — setFormFieldSynthetic facade (scope-aware)', () => {
  it('writes under the scope-derived key so two iterations with the same formId/fieldId never collide', () => {
    render(
      <RuntimeStateProvider config={testConfig}>
        <ScopedSyntheticFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set row-1 coordinates' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set row-2 coordinates' }))

    const snapshot = readRuntimeStateSnapshot('runtime-state')
    expect(snapshot.forms['address-form::r:row-1'].address.synthetic).toEqual({ lat: 1 })
    expect(snapshot.forms['address-form::r:row-2'].address.synthetic).toEqual({ lat: 2 })
  })
})
