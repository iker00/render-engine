export type RuntimeDataValuesError = {
  code: 'invalid-data-values-json' | 'invalid-data-values-shape'
  displayMode: 'always'
  message: string
}

export type RuntimeDataValuesResult =
  | {
      status: 'ready'
      source: 'data-values' | 'dev-data-values' | 'none'
      dataValues: Record<string, unknown>
    }
  | {
      status: 'error'
      error: RuntimeDataValuesError
    }

interface ReadRuntimeDataValuesOptions {
  devDataValues: Record<string, unknown>
  isDevelopment: boolean
  rootElement: HTMLElement | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

export function readRuntimeDataValues({
  devDataValues,
  isDevelopment,
  rootElement,
}: ReadRuntimeDataValuesOptions): RuntimeDataValuesResult {
  const serializedValues = rootElement?.dataset.values

  if (serializedValues !== undefined) {
    let parsed: unknown

    try {
      parsed = JSON.parse(serializedValues)
    } catch {
      return {
        status: 'error',
        error: {
          code: 'invalid-data-values-json',
          displayMode: 'always',
          message:
            'The data-values attribute does not contain valid JSON. Check that the attribute value is a well-formed JSON object.',
        },
      }
    }

    if (!isPlainObject(parsed)) {
      return {
        status: 'error',
        error: {
          code: 'invalid-data-values-shape',
          displayMode: 'always',
          message:
            'The data-values attribute must be a plain JSON object (not an array, primitive, or null). Each key maps a query name to its initial data value.',
        },
      }
    }

    return {
      status: 'ready',
      source: 'data-values',
      dataValues: parsed,
    }
  }

  if (isDevelopment && Object.keys(devDataValues).length > 0) {
    return {
      status: 'ready',
      source: 'dev-data-values',
      dataValues: devDataValues,
    }
  }

  return {
    status: 'ready',
    source: 'none',
    dataValues: {},
  }
}
