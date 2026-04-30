import type { RuntimeConfigError } from './runtime-config-types'

export function invalidLayout(message: string): { status: 'error'; error: RuntimeConfigError } {
  return {
    status: 'error',
    error: {
      code: 'invalid-layout',
      displayMode: 'development-only',
      message,
    },
  }
}

export function unsupportedNodeType(
  pageId: string,
  path: string,
  nodeType: string,
): { status: 'error'; error: RuntimeConfigError } {
  return {
    status: 'error',
    error: {
      code: 'unsupported-node-type',
      displayMode: 'development-only',
      message: `Page "${pageId}" uses unsupported layout node type "${nodeType}" at "${path}".`,
    },
  }
}

export function initialPageNotFound(initialPage: string): { status: 'error'; error: RuntimeConfigError } {
  return {
    status: 'error',
    error: {
      code: 'initial-page-not-found',
      displayMode: 'always',
      message: `The initialPage "${initialPage}" does not match any page id.`,
    },
  }
}
