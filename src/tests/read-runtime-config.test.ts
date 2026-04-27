import { describe, expect, it } from 'vitest'
import {
  readRuntimeConfig,
  type RuntimeConfig,
} from '../app/bootstrap/read-runtime-config'

const devConfig: RuntimeConfig = {
  api: {},
  pages: [
    {
      id: 'dev-home',
      title: 'Dev Home',
      description: 'Local development configuration.',
    },
  ],
  initialPage: 'dev-home',
}

describe('readRuntimeConfig', () => {
  it('uses the repository development config in development when data-config is absent', () => {
    const result = readRuntimeConfig({
      devConfig,
      isDevelopment: true,
      rootElement: document.createElement('div'),
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'dev-config',
      config: devConfig,
    })
  })

  it('prefers data-config when the root element provides it', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = JSON.stringify({
      api: {},
      pages: [
        {
          id: 'html-home',
          title: 'HTML Home',
          description: 'Provided by the HTML container.',
        },
      ],
      initialPage: 'html-home',
    })

    const result = readRuntimeConfig({
      devConfig,
      isDevelopment: true,
      rootElement,
    })

    expect(result).toEqual({
      status: 'ready',
      source: 'data-config',
      config: {
        api: {},
        pages: [
          {
            id: 'html-home',
            title: 'HTML Home',
            description: 'Provided by the HTML container.',
          },
        ],
        initialPage: 'html-home',
      },
    })
  })

  it('returns a clear error when data-config cannot be parsed', () => {
    const rootElement = document.createElement('div')
    rootElement.dataset.config = '{invalid json'

    const result = readRuntimeConfig({
      devConfig,
      isDevelopment: false,
      rootElement,
    })

    expect(result).toEqual({
      status: 'error',
      message: 'The runtime config in data-config is not valid JSON.',
    })
  })

  it('returns a clear error when no supported config source is available', () => {
    const result = readRuntimeConfig({
      devConfig,
      isDevelopment: false,
      rootElement: document.createElement('div'),
    })

    expect(result).toEqual({
      status: 'error',
      message: 'No runtime config was provided in data-config for this environment.',
    })
  })
})
