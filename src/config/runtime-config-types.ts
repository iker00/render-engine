export type LayoutNodeType = 'container' | 'heading' | 'paragraph' | 'list' | 'button' | 'form' | 'input' | 'textarea' | 'select'
export type RuntimeApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type RuntimeApiQueryValue = string | number | boolean
export type RuntimeApiQuery = Record<string, RuntimeApiQueryValue>
export type RuntimeApiHeaderValue = string
export type RuntimeApiHeaders = Record<string, RuntimeApiHeaderValue>
export type RuntimeConfigValue = string | number | boolean | null
export type RuntimeApiBodyValue =
  | RuntimeConfigValue
  | RuntimeApiBodyValue[]
  | { [key: string]: RuntimeApiBodyValue }

export interface RuntimeApiRequestParams {
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue
  headers?: RuntimeApiHeaders
}

export interface RuntimeApiOperation extends RuntimeApiRequestParams {
  method: RuntimeApiMethod
  endpoint: string
}

export type RuntimeApiConfig = Record<string, RuntimeApiOperation>
export type RuntimeCollectionObjectValue =
  | RuntimeConfigValue
  | RuntimeCollectionObjectValue[]
  | { [key: string]: RuntimeCollectionObjectValue }
export type RuntimeCollectionObjectItem = Record<string, RuntimeCollectionObjectValue>

export type QueryStateFeedbackVisibleState = 'idle' | 'loading' | 'error' | 'empty' | 'success'
export type RuntimeVisibilityOperator = 'equals' | 'notEquals' | 'isTruthy' | 'isFalsy' | 'greaterThan' | 'lessThan'

export interface RuntimeVisibilityConfig {
  reference: string
  operator: RuntimeVisibilityOperator
  value?: RuntimeConfigValue
}

export interface QueryStateFeedbackShowRule {
  mode: 'show'
}

export interface QueryStateFeedbackHideRule {
  mode: 'hide'
}

export interface QueryStateFeedbackFallbackRule {
  mode: 'fallback'
  fallback: readonly LayoutNode[]
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
  visibility?: RuntimeVisibilityConfig
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
    items: ListLayoutNodeItems
  }
  children?: unknown
}

export interface FormLayoutNode extends LayoutNodeFeedbackFields {
  type: 'form'
  id: string
  submitAction?: ExecuteOperationRuntimeUiAction
  resetOnSuccess?: boolean
  children?: LayoutNode[]
}

export interface FormFieldLayoutNodeProps {
  fieldId: string
  label: string
  required?: boolean
  defaultValue?: RuntimeConfigValue
}

export interface InputLayoutNode extends LayoutNodeFeedbackFields {
  type: 'input'
  id?: string
  props: FormFieldLayoutNodeProps & {
    inputType?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url'
  }
  children?: unknown
}

export interface TextareaLayoutNode extends LayoutNodeFeedbackFields {
  type: 'textarea'
  id?: string
  props: FormFieldLayoutNodeProps
  children?: unknown
}

export interface SelectLayoutNodeItem {
  label: string
  value: string | number
}

export interface ListDynamicItemsSource {
  source: string
  itemType?: 'scalar'
  itemText?: string
}

export interface ListManualScalarItemsSource {
  values: string[]
}

export interface ListManualObjectItemsSource {
  values: RuntimeCollectionObjectItem[]
  itemText: string
}

export type ListLayoutNodeItems =
  | string[]
  | ListDynamicItemsSource
  | ListManualScalarItemsSource
  | ListManualObjectItemsSource

export interface SelectDynamicItemsSource {
  source: string
  itemType?: 'scalar'
  label?: string
  value?: string
}

export interface SelectManualScalarItemsSource {
  values: Array<string | number>
}

export interface SelectManualObjectItemsSource {
  values: RuntimeCollectionObjectItem[]
  label: string
  value: string
}

export type SelectLayoutNodeItems =
  | SelectLayoutNodeItem[]
  | SelectDynamicItemsSource
  | SelectManualScalarItemsSource
  | SelectManualObjectItemsSource

export interface SelectLayoutNode extends LayoutNodeFeedbackFields {
  type: 'select'
  id?: string
  props: FormFieldLayoutNodeProps & {
    items: SelectLayoutNodeItems
  }
  children?: unknown
}

export interface NavigateToRuntimeUiAction {
  type: 'navigateTo'
  pageId: string
  params?: Record<string, RuntimeConfigValue>
}

export interface GoBackRuntimeUiAction {
  type: 'goBack'
}

export interface ExecuteOperationRuntimeUiAction extends RuntimeApiRequestParams {
  type: 'executeOperation'
  operationName: string
}

export interface ResetFormRuntimeUiAction {
  type: 'resetForm'
  formId: string
}

export type RuntimeUiAction =
  | NavigateToRuntimeUiAction
  | GoBackRuntimeUiAction
  | ExecuteOperationRuntimeUiAction
  | ResetFormRuntimeUiAction

export type NavigateToButtonAction = NavigateToRuntimeUiAction
export type GoBackButtonAction = GoBackRuntimeUiAction
export type ButtonAction = RuntimeUiAction

export interface ButtonLayoutNode extends LayoutNodeFeedbackFields {
  type: 'button'
  id?: string
  props: {
    label: string
    action?: RuntimeUiAction
  }
  children?: unknown
}

export type LayoutNode =
  | ContainerLayoutNode
  | HeadingLayoutNode
  | ParagraphLayoutNode
  | ListLayoutNode
  | ButtonLayoutNode
  | FormLayoutNode
  | InputLayoutNode
  | TextareaLayoutNode
  | SelectLayoutNode

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
