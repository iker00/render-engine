import { describe, expect, it } from 'vitest'
import devConfig from '../../dev/dev-config'
import { validateRuntimeConfig } from '../../config/runtime-config'

describe('dev-config merge', () => {
  it('validates the merged development configuration', () => {
    const result = validateRuntimeConfig(devConfig)

    if (result.status === 'error') {
      throw new Error(result.error.message)
    }

    expect(result.status).toBe('ready')
  })

  it('includes ficha-hecho page and obtenerFichaHecho mock', () => {
    expect(devConfig.pages.some((page) => page.id === 'ficha-hecho')).toBe(true)
    expect(devConfig.api.obtenerFichaHecho).toMatchObject({
      mockResponse: expect.objectContaining({
        FichaHechoDTO: expect.any(Object),
      }),
    })
  })

  it('merges tokens so Authorization headers can resolve in development', () => {
    expect(devConfig.tokens).toMatchObject({
      token: {
        value: '#bearer_token#',
      },
    })
    expect(devConfig.api.obtenerPermisosPantallaInicio).toMatchObject({
      mockResponse: expect.objectContaining({
        PermisosPantallaInicioDTO: expect.any(Object),
      }),
    })
  })
})
