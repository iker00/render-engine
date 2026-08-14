/**
 * Shared HTTP client for PlataGes operations: a single authenticated POST with a fixed error
 * mapping. Consumed by both the translations panel provider and the external config save
 * provider so the fetch/error semantics are defined once.
 */

export type PlatagesRequestError =
  | { kind: 'auth'; message: string }
  | { kind: 'integration'; message: string }

export type PlatagesRequestOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: PlatagesRequestError }

const AUTH_ERROR_MESSAGE =
  'La autenticación con el proveedor externo falló. Revisa el token seleccionado.'
const NETWORK_ERROR_MESSAGE = 'No se pudo contactar con el proveedor externo.'

interface RawErrorPayload {
  code?: string
  message?: string
}

async function mapErrorResponse(response: Response): Promise<PlatagesRequestError> {
  if (response.status === 401 || response.status === 403) {
    return { kind: 'auth', message: AUTH_ERROR_MESSAGE }
  }

  const fallbackMessage = `La llamada al proveedor externo falló (HTTP ${response.status}).`

  try {
    const body = (await response.json()) as RawErrorPayload | null
    if (body && typeof body.message === 'string' && body.message.trim() !== '') {
      return { kind: 'integration', message: body.message }
    }
    return { kind: 'integration', message: fallbackMessage }
  } catch {
    return { kind: 'integration', message: fallbackMessage }
  }
}

export async function postToPlatages<TRaw>(
  url: string,
  body: unknown,
  token: string,
): Promise<PlatagesRequestOutcome<TRaw>> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { status: 'error', error: { kind: 'integration', message: NETWORK_ERROR_MESSAGE } }
  }

  if (!response.ok) {
    return { status: 'error', error: await mapErrorResponse(response) }
  }

  try {
    const data = (await response.json()) as TRaw
    return { status: 'ok', data }
  } catch {
    return { status: 'error', error: { kind: 'integration', message: NETWORK_ERROR_MESSAGE } }
  }
}
