export type LayoutNodeType = 'container' | 'heading' | 'paragraph' | 'list'
export type RuntimeApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RuntimeApiQueryValue = string | number | boolean
export type RuntimeApiQuery = Record<string, RuntimeApiQueryValue>
export type RuntimeApiBodyValue =
  | string
  | number
  | boolean
  | null
  | RuntimeApiBodyValue[]
  | { [key: string]: RuntimeApiBodyValue }

export interface RuntimeApiOperation {
  method: RuntimeApiMethod
  endpoint: string
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue
}

export type RuntimeApiConfig = Record<string, RuntimeApiOperation>

export interface ContainerLayoutNode {
  type: 'container'
  id?: string
  props?: {
    direction?: string
    gap?: string
  }
  children?: LayoutNode[]
}

export interface HeadingLayoutNode {
  type: 'heading'
  id?: string
  props: {
    text: string
    level: number
  }
  children?: unknown
}

export interface ParagraphLayoutNode {
  type: 'paragraph'
  id?: string
  props: {
    text: string
  }
  children?: unknown
}

export interface ListLayoutNode {
  type: 'list'
  id?: string
  props: {
    items: string[]
  }
  children?: unknown
}

export type LayoutNode =
  | ContainerLayoutNode
  | HeadingLayoutNode
  | ParagraphLayoutNode
  | ListLayoutNode

export type LayoutNodeCollection = LayoutNode[]

export interface RuntimePageConfig {
  id: string
  preloads?: string[]
  layout: LayoutNodeCollection
}

export interface RuntimeConfig {
  api: RuntimeApiConfig
  pages: RuntimePageConfig[]
  initialPage: string
}

export interface RuntimeConfigError {
  code:
    | 'invalid-json'
    | 'missing-config'
    | 'initial-page-not-found'
    | 'invalid-layout'
    | 'unsupported-node-type'
  displayMode: 'always' | 'development-only'
  message: string
}

export type RuntimeConfigValidationResult =
  | {
      status: 'ready'
      config: RuntimeConfig
      page: RuntimePageConfig
    }
  | {
      status: 'error'
      error: RuntimeConfigError
    }
