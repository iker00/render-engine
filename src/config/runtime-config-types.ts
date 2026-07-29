export type LayoutNodeType =
  | 'container'
  | 'repeater'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'image'
  | 'table'
  | 'button'
  | 'link'
  | 'form'
  | 'input'
  | 'textarea'
  | 'select'
  | 'radioGroup'
  | 'checkboxGroup'
  | 'modal'
  | 'tabs'
  | 'accordion'
  | 'badge'
  | 'alert'
  | 'stat'
  | 'divider'
  | 'skeleton'
  | 'fileManager'
  | 'fileInput'
  | 'toggle'
  | 'hidden'
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

export type RuntimeApiFileField = { name: string; file: File }

export interface RuntimeApiRequestParams {
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue
  headers?: RuntimeApiHeaders
  files?: RuntimeApiFileField[]
}

export interface RuntimeApiErrorCondition {
  path: string
  equals?: RuntimeConfigValue
  notEquals?: RuntimeConfigValue
}

export interface RuntimeApiOperation extends RuntimeApiRequestParams {
  method: RuntimeApiMethod
  endpoint: string
  errorCondition?: RuntimeApiErrorCondition
  errorMessagePath?: string
  errorCodePath?: string
}

export interface RuntimePreloadConfig {
  operationName: string
  requestParams: RuntimeApiRequestParams
  when?: RuntimeWhenCondition
}

export type RuntimeApiConfig = Record<string, RuntimeApiOperation>
export type RuntimeCollectionObjectValue =
  | RuntimeConfigValue
  | RuntimeCollectionObjectValue[]
  | { [key: string]: RuntimeCollectionObjectValue }
export type RuntimeCollectionObjectItem = Record<string, RuntimeCollectionObjectValue>

export type QueryStateFeedbackVisibleState = 'idle' | 'loading' | 'error' | 'empty' | 'success'
export type RuntimeVisibilityOperator =
  | 'equals'
  | 'notEquals'
  | 'isTruthy'
  | 'isFalsy'
  | 'greaterThan'
  | 'lessThan'
  | 'arrayContains'
export type RuntimeVisibilityGroupOperator = 'and' | 'or'

export interface RuntimeVisibilityCondition {
  reference: string
  operator: RuntimeVisibilityOperator
  value?: RuntimeConfigValue
  itemField?: string
  negate?: boolean
}

export interface RuntimeVisibilityGroup {
  operator: RuntimeVisibilityGroupOperator
  conditions: RuntimeVisibilityCondition[]
}

export type RuntimeVisibilityConfig = RuntimeVisibilityCondition | RuntimeVisibilityGroup

export type RuntimeWhenCondition = RuntimeVisibilityConfig

export function isVisibilityGroup(config: RuntimeVisibilityConfig): config is RuntimeVisibilityGroup {
  return 'conditions' in config
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

export interface LayoutNodeLayoutFields {
  layout?: LayoutNodeLayoutConfig
}

export type RuntimeResponsiveBreakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type RuntimeResponsiveBoundedValue = Partial<Record<RuntimeResponsiveBreakpoint, number>>
export type RuntimeResponsiveLayoutValue = number | RuntimeResponsiveBoundedValue

export interface LayoutNodeLayoutConfig {
  span?: RuntimeResponsiveLayoutValue
}

export type ContainerAlign = 'start' | 'center' | 'end' | 'stretch'
export type ContainerJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
export type ContainerWrap = 'nowrap' | 'wrap' | 'wrap-reverse'
export type ContainerVariant = 'default' | 'card'

export interface ContainerLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'container'
  id?: string
  props?: {
    direction?: string
    gap?: string
    columns?: RuntimeResponsiveLayoutValue
    variant?: ContainerVariant
    align?: ContainerAlign
    justify?: ContainerJustify
    wrap?: ContainerWrap
  }
  children?: LayoutNode[]
}

export type RuntimeCollectionPaginationControlsVariant = 'previousNext' | 'numbered' | 'scroll'

export interface RuntimeCollectionPaginationControlsConfig {
  variant?: RuntimeCollectionPaginationControlsVariant
}

export interface RuntimeCollectionPaginationConfig {
  enabled: true
  pageSize: number
  controls?: RuntimeCollectionPaginationControlsConfig
}

export interface RepeaterLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'repeater'
  id?: string
  props: {
    items: {
      source: string
      key: string
    }
    pagination?: RuntimeCollectionPaginationConfig
    template: LayoutNode[]
  }
  children?: never
}

export interface HeadingLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'heading'
  id?: string
  props: {
    text: string
    level: number
    icon?: string
  }
  children?: unknown
}

export interface ParagraphLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'paragraph'
  id?: string
  props: {
    text: string
    icon?: string
  }
  children?: unknown
}

export interface ListLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'list'
  id?: string
  props: {
    items: ListLayoutNodeItems
  }
  children?: unknown
}

export interface ImageFetchConfig {
  url: string
  method?: RuntimeApiMethod
  headers?: RuntimeApiHeaders
  body?: RuntimeApiBodyValue | null
}

export interface ImageLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'image'
  id?: string
  props: { src: string; alt: string } | { fetch: ImageFetchConfig; alt: string }
  children?: unknown
}

export type TableCellPrimitive = string | number | boolean
export type TableCellNode =
  | ImageLayoutNode
  | ListLayoutNode
  | ButtonLayoutNode
  | ContainerLayoutNode
  | HeadingLayoutNode
  | ParagraphLayoutNode
export type TableCellValue = TableCellPrimitive | TableCellNode
export type TableManualRows = TableCellValue[][]

export interface TableDynamicRows {
  source: string
  cells: (string | TableCellNode)[]
}

export type TableRows = TableManualRows | TableDynamicRows

export interface TableColumnConfig {
  id: string
  filterable?: true
  filterPlaceholder?: string
  sortable?: true
}

export interface TableLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'table'
  id?: string
  props: {
    headers: string[]
    columns?: TableColumnConfig[]
    rows: TableRows
    pagination?: RuntimeCollectionPaginationConfig
  }
  children?: unknown
}

export interface FormLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'form'
  id: string
  persistOnUnmount?: boolean
  submitAction?: ExecuteOperationRuntimeUiAction | ExecuteOperationsRuntimeUiAction
  resetOnSuccess?: boolean
  children?: LayoutNode[]
  onSuccess?: FormOnSuccessAction[]
  onError?: FormOnErrorAction[]
}

export type RuntimeFormValidationRuleName =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'minSelections'
  | 'maxSelections'
  | 'pattern'
  | 'email'
  | 'url'

export interface RuntimeRequiredValidationRule {
  value: true
  message?: string
  when?: RuntimeWhenCondition
}

export interface RuntimeNumericValidationRule {
  value: number
  message?: string
  when?: RuntimeWhenCondition
}

export interface RuntimePatternValidationRule {
  value: string
  message?: string
  when?: RuntimeWhenCondition
}

export interface RuntimeBooleanFlagValidationRule {
  value: true
  message?: string
  when?: RuntimeWhenCondition
}

export interface RuntimeFormFieldValidations {
  required?: RuntimeRequiredValidationRule
  minLength?: RuntimeNumericValidationRule
  maxLength?: RuntimeNumericValidationRule
  min?: RuntimeNumericValidationRule
  max?: RuntimeNumericValidationRule
  minSelections?: RuntimeNumericValidationRule
  maxSelections?: RuntimeNumericValidationRule
  pattern?: RuntimePatternValidationRule
  email?: RuntimeBooleanFlagValidationRule
  url?: RuntimeBooleanFlagValidationRule
}

export interface RuntimeFileManagerValidations {
  accept?: { value: string[]; message?: string }
  maxFileSize?: { value: number; message?: string }
  maxTotalSize?: { value: number; message?: string }
  minFiles?: { value: number; message?: string }
  maxFiles?: { value: number; message?: string }
  validFileNames?: { value: string[]; message?: string }
}

export interface RuntimeFileInputValidations {
  required?: RuntimeRequiredValidationRule
  accept?: { value: string[]; message?: string }
  maxFileSize?: { value: number; message?: string }
  maxTotalSize?: { value: number; message?: string }
  minFiles?: RuntimeNumericValidationRule
  maxFiles?: { value: number; message?: string }
  validFileNames?: { value: string[]; message?: string }
}

export interface FormFieldLayoutNodeProps {
  fieldId: string
  label: string
  tooltip?: string
  validations?: RuntimeFormFieldValidations
  defaultValue?: RuntimeConfigValue | unknown[]
}

export interface InputLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'input'
  id?: string
  props: FormFieldLayoutNodeProps & {
    inputType?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'date' | 'datetime-local' | 'time'
    placeholder?: string
    icon?: string
    iconPosition?: 'left' | 'right'
  }
  children?: unknown
}

export interface TextareaLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'textarea'
  id?: string
  props: FormFieldLayoutNodeProps & {
    placeholder?: string
  }
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

export interface SelectDynamicScalarItemsSource {
  source: string
  itemType: 'scalar'
}

export interface SelectDynamicObjectItemsSource {
  source: string
  itemType: 'object'
  label: string
  value: string
}

export type SelectDynamicItemsSource = SelectDynamicScalarItemsSource | SelectDynamicObjectItemsSource

export interface SelectManualScalarItemsSource {
  values: Array<string | number>
}

export type SelectLayoutNodeItems =
  | SelectLayoutNodeItem[]
  | SelectManualScalarItemsSource
  | SelectDynamicItemsSource

export interface SelectLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'select'
  id?: string
  props: FormFieldLayoutNodeProps & {
    items: SelectLayoutNodeItems
    multiple?: boolean
    placeholder?: string
    emptySubmitValue?: string | number
  }
  children?: unknown
}

export type ChoiceGroupOptionLayout = 'vertical' | 'inline'

export interface RadioGroupLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'radioGroup'
  id?: string
  props: FormFieldLayoutNodeProps & {
    items: SelectLayoutNodeItems
    optionLayout?: ChoiceGroupOptionLayout
  }
  children?: unknown
}

export interface CheckboxGroupLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'checkboxGroup'
  id?: string
  props: FormFieldLayoutNodeProps & {
    items: SelectLayoutNodeItems
    optionLayout?: ChoiceGroupOptionLayout
  }
  children?: unknown
}

export type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalLayoutNodeProps {
  size?: ModalSize
  defaultOpen?: boolean
  label?: string
}

export interface ModalLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'modal'
  id: string
  props?: ModalLayoutNodeProps
  children?: LayoutNode[]
}

export type TabsOrientation = 'horizontal' | 'vertical'

export interface TabsItem {
  label: string
  children?: LayoutNode[]
  visibility?: RuntimeVisibilityConfig
}

export interface TabsLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'tabs'
  id?: string
  props: {
    orientation?: TabsOrientation
    defaultTab?: number
    items: TabsItem[]
  }
  children?: never
}

export interface AccordionLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'accordion'
  id?: string
  props: {
    label: string
    defaultOpen?: boolean
    groupId?: string
  }
  children?: LayoutNode[]
}

export type BadgeVariant = 'pill' | 'circle'
export type BadgeColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'badge'
  id?: string
  props: {
    label: string
    variant?: BadgeVariant
    color?: BadgeColor
  }
  children?: unknown
}

export type AlertType = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface AlertLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'alert'
  id?: string
  props: {
    message: string
    type?: AlertType
    title?: string
  }
  children?: never
}

export type StatVariant = 'accent' | 'tinted' | 'plain'
export type StatColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface StatLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'stat'
  id?: string
  props: {
    label: string
    value: string
    variant?: StatVariant
    color?: StatColor
    icon?: string
  }
  children?: unknown
}

export type DividerVariant = 'solid' | 'dashed' | 'dotted' | 'invisible'

export interface DividerLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'divider'
  id?: string
  props?: { variant?: DividerVariant }
  children?: never
}

export type SkeletonVariant = 'text' | 'rect' | 'circle'

export interface SkeletonLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'skeleton'
  id?: string
  props?: {
    variant?: SkeletonVariant
    lines?: number
    width?: string
    height?: string
    rounded?: boolean
    animate?: boolean
  }
  children?: never
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

export interface ExecuteOperationsRuntimeUiActionEntry {
  operationName: string
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue
  headers?: RuntimeApiHeaders
  when?: RuntimeWhenCondition
}

export interface ExecuteOperationsRuntimeUiAction {
  type: 'executeOperations'
  operations: ExecuteOperationsRuntimeUiActionEntry[]
}

export interface ResetFormRuntimeUiAction {
  type: 'resetForm'
  formId: string
}

export interface OpenModalRuntimeUiAction {
  type: 'openModal'
  modalId: string
}

export interface CloseModalRuntimeUiAction {
  type: 'closeModal'
  modalId: string
}

export type RuntimeUiActionType = 'navigateTo' | 'goBack' | 'executeOperation' | 'executeOperations' | 'resetForm' | 'openModal' | 'closeModal'

export type RuntimeUiAction =
  | NavigateToRuntimeUiAction
  | GoBackRuntimeUiAction
  | ExecuteOperationRuntimeUiAction
  | ExecuteOperationsRuntimeUiAction
  | ResetFormRuntimeUiAction
  | OpenModalRuntimeUiAction
  | CloseModalRuntimeUiAction

export type FormOnSuccessAction = RuntimeUiAction & { when?: RuntimeWhenCondition }

export type FormOnErrorAction = RuntimeUiAction & { when?: RuntimeWhenCondition }

export type NavigateToButtonAction = NavigateToRuntimeUiAction
export type GoBackButtonAction = GoBackRuntimeUiAction
export type ButtonAction = RuntimeUiAction

export type ButtonColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link'

export interface ButtonLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'button'
  id?: string
  props: {
    label: string
    action?: RuntimeUiAction
    color?: ButtonColor
    variant?: ButtonVariant
    fullWidth?: boolean
    icon?: string
    iconPosition?: 'left' | 'right'
  }
  children?: unknown
}

export interface LinkLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'link'
  id?: string
  props: {
    label?: string
    href?: string
    download?: string
    target?: string
    action?: NavigateToRuntimeUiAction | GoBackRuntimeUiAction
    icon?: string
    iconPosition?: 'left' | 'right'
  }
  children?: LayoutNodeCollection
}

export interface FileInputLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'fileInput'
  id?: string
  props: {
    fieldId: string
    label: string
    tooltip?: string
    multiple?: boolean
    capture?: 'environment' | 'user'
    validations?: RuntimeFileInputValidations
  }
  children?: unknown
}

export type ToggleLabelPosition = 'top' | 'inline'

export interface ToggleLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'toggle'
  id?: string
  props: {
    fieldId: string
    label: string
    tooltip?: string
    labelPosition?: ToggleLabelPosition
    defaultValue?: boolean | string
    validations?: RuntimeFormFieldValidations
  }
  children?: unknown
}

export interface HiddenLayoutNode extends LayoutNodeFeedbackFields {
  type: 'hidden'
  props: {
    fieldId: string
    value: string | number | boolean
  }
}

export type FileManagerLabelKey =
  | 'dropzoneIdle'
  | 'dropzoneAcceptedFormats'
  | 'dropzoneUploading'
  | 'dropzoneProgress'
  | 'dropzoneSuccess'
  | 'dropzoneMaxFilesReached'
  | 'dropzoneAriaLabel'
  | 'listLoadError'
  | 'listEmpty'
  | 'paginationPrevious'
  | 'paginationNext'
  | 'rowViewLabel'
  | 'rowViewAriaLabel'
  | 'rowViewUnavailableAriaLabel'
  | 'rowDownloadLabel'
  | 'rowDownloadAriaLabel'
  | 'rowDownloadUnavailableAriaLabel'
  | 'rowDeleteLabel'
  | 'rowDeleteAriaLabel'
  | 'uploadFileError'
  | 'uploadListPathMissing'
  | 'deleteError'

export type FileManagerLabels = Partial<Record<FileManagerLabelKey, string>>

export interface FileManagerLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'fileManager'
  id?: string
  props: {
    fieldName?: string
    fileField?: string
    listPath?: string
    fileIdField?: string
    fileNameField?: string
    multiple?: boolean
    prefix?: string
    acceptExtension?: string[]
    getOperation?: string | false
    uploadOperation?: string | false
    deleteOperation?: string | false
    viewOperation?: string | false
    downloadOperation?: string | false
    validations?: RuntimeFileManagerValidations
    pagination?: { pageSize?: number }
    labels?: FileManagerLabels
  }
}

export type LayoutNode =
  | ContainerLayoutNode
  | RepeaterLayoutNode
  | HeadingLayoutNode
  | ParagraphLayoutNode
  | ListLayoutNode
  | ImageLayoutNode
  | TableLayoutNode
  | ButtonLayoutNode
  | LinkLayoutNode
  | FormLayoutNode
  | InputLayoutNode
  | TextareaLayoutNode
  | SelectLayoutNode
  | RadioGroupLayoutNode
  | CheckboxGroupLayoutNode
  | ModalLayoutNode
  | TabsLayoutNode
  | AccordionLayoutNode
  | BadgeLayoutNode
  | AlertLayoutNode
  | StatLayoutNode
  | DividerLayoutNode
  | SkeletonLayoutNode
  | FileInputLayoutNode
  | ToggleLayoutNode
  | HiddenLayoutNode
  | FileManagerLayoutNode

export type LayoutNodeCollection = LayoutNode[]

export interface RuntimePageConfig {
  id: string
  preloads?: RuntimePreloadConfig[]
  title?: string
  layout: LayoutNodeCollection
}

export type RuntimeTranslationsLangMap = Record<string, string>
export type RuntimeTranslationsConfig = Record<string, RuntimeTranslationsLangMap>

export interface RuntimeTokenRefreshConfig {
  operation: string
  responsePath: string
  intervalSeconds: number
}

export interface RuntimeTokenConfig {
  value: string
  refresh?: RuntimeTokenRefreshConfig
}

export type RuntimeTokensConfig = Record<string, RuntimeTokenConfig>

export interface RuntimeConfig {
  api: RuntimeApiConfig
  pages: RuntimePageConfig[]
  initialPage: string
  preloads?: RuntimePreloadConfig[]
  translations?: RuntimeTranslationsConfig
  tokens?: RuntimeTokensConfig
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
