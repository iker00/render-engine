/**
 * Provider for the PlataGes operation that persists the active runtime config JSON
 * (`ActualizarJSONConfiguracionEnPlataGes`). The HTTP transport and error mapping live in the
 * shared `platages-http-client`; this module keeps the raw PlataGes wire shape and the
 * business-result check specific to this operation (a 200 response with `Resultado: false` is a
 * rejection, not a success).
 */

import { postToPlatages } from '../platages-http-client'

export type SaveConfigOutcome =
  | { status: 'ok' }
  | { status: 'error'; error: { kind: 'auth' | 'integration'; message: string } }

export interface SaveConfigProvider {
  save(input: {
    url: string
    token: string
    idGestion: number
    idSeccion: number
    idObjetoOcurrencia: number
    configJson: string
  }): Promise<SaveConfigOutcome>
}

interface RawSaveConfigResponse {
  ActualizarJsonConfiguracionSalidaDTO?: {
    Resultado?: boolean
  }
}

const SAVE_FAILED_MESSAGE = 'No se pudo contactar con el proveedor externo.'

export function createPlatagesSaveConfigProvider(): SaveConfigProvider {
  return {
    async save({ url, token, idGestion, idSeccion, idObjetoOcurrencia, configJson }) {
      const outcome = await postToPlatages<RawSaveConfigResponse>(
        url,
        {
          ActualizarJsonConfiguracionEntradaDTO: {
            IdGestion: idGestion,
            IdSeccion: idSeccion,
            IdObjetoOcurrencia: idObjetoOcurrencia,
            Json: configJson,
          },
        },
        token,
      )

      if (outcome.status === 'error') {
        return outcome
      }

      if (outcome.data.ActualizarJsonConfiguracionSalidaDTO?.Resultado === true) {
        return { status: 'ok' }
      }

      return { status: 'error', error: { kind: 'integration', message: SAVE_FAILED_MESSAGE } }
    },
  }
}
