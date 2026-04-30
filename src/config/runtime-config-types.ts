export type LayoutNodeType = 'container' | 'heading' | 'paragraph' | 'list' | 'button'
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

export type QueryStateFeedbackVisibleState = 'loading' | 'error' | 'empty' | 'success'

export interface QueryStateFeedbackShowRule {
  mode: 'show'
}

export interface QueryStateFeedbackHideRule {
  mode: 'hide'
}

export interface QueryStateFeedbackFallbackRule {
  mode: 'fallback'
  fallback: LayoutNode[]
}

export type QueryStateFeedbackRule =
  | QueryStateFeedbackShowRule
  | QueryStateFeedbackHideRule
  | QueryStateFeedbackFallbackRule

export interface QueryStateFeedbackConfig {
  query: string
  states?: Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>>
}

export interface LayoutNodeFeedbackFields {
  queryStateFeedback?: QueryStateFeedbackConfig
}

export interface ContainerLayoutNode extends LayoutNodeFeedbackFields {
  type: 'container'
  id?: string
  props?: {
    direction?: string
    gap?: string
  }
  children?: LayoutNode[]
}

export interface HeadingLayoutNode extends LayoutNodeFeedbackFields {
  type: 'heading'
  id?: string
  props: {
    text: string
    level: number
  }
  children?: unknown
}

export interface ParagraphLayoutNode extends LayoutNodeFeedbackFields {
  type: 'paragraph'
  id?: string
  props: {
    text: string
  }
  children?: unknown
}

export interface ListLayoutNode extends LayoutNodeFeedbackFields {
  type: 'list'
  id?: string
  props: {
    items: string[]
  }
  children?: unknown
}

export interface NavigateToButtonAction {
  type: 'navigateTo'
  pageId: string
}

export interface GoBackButtonAction {
  type: 'goBack'
}

export type ButtonAction = NavigateToButtonAction | GoBackButtonAction

export interface ButtonLayoutNode extends LayoutNodeFeedbackFields {
  type: 'button'
  id?: string
  props: {
    label: string
    action: ButtonAction
  }
  children?: unknown
}

export type LayoutNode =
  | ContainerLayoutNode
  | HeadingLayoutNode
  | ParagraphLayoutNode
  | ListLayoutNode
  | ButtonLayoutNode

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
