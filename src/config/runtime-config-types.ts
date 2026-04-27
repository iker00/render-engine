export type LayoutNodeType = 'container' | 'heading' | 'paragraph' | 'list'

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
  layout: LayoutNodeCollection
}

export interface RuntimeConfig {
  api: Record<string, unknown>
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
