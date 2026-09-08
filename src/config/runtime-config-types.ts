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
  | 'steps'
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
  | 'map'
  | 'gallery'
  | 'autocomplete'
  | 'group'
  | 'slot'
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
  blocking?: boolean
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
    columns?: RuntimeResponsiveLayoutValue
    gap?: string
    align?: ContainerAlign
    justify?: ContainerJustify
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
  | LinkLayoutNode
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
  onSuccess?: RuntimeUiActionListEntry[]
  onError?: RuntimeUiActionListEntry[]
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

export interface AutocompleteLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'autocomplete'
  id?: string
  props: FormFieldLayoutNodeProps & {
    items: SelectLayoutNodeItems
    multiple?: boolean
    placeholder?: string
    allowFreeText?: boolean
    minChars?: number
    searchParamName?: string
  }
  children?: never
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
  icon?: string
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

export type StepsVariant = 'horizontal' | 'vertical' | 'progress'

export interface StepOnNextAction {
  operationName: string
  query?: RuntimeApiQuery
  body?: RuntimeApiBodyValue
  headers?: RuntimeApiHeaders
}

export interface StepsItem {
  label: string
  children?: LayoutNode[]
  visibility?: RuntimeVisibilityConfig
  onNext?: StepOnNextAction
}

export interface StepsLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'steps'
  id?: string
  props: {
    variant?: StepsVariant
    backLabel?: string
    nextLabel?: string
    submitLabel?: string
    items: StepsItem[]
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
    icon?: string
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

export interface MapStaticMarker {
  lat: number
  lng: number
  label: string
}

export interface MapMarkerSource {
  source: string
  position: { lat: string; lng: string }
  label: string
  color?: ButtonColor
}

export type MapHeight = 'sm' | 'md' | 'lg' | 'xl'

export interface MapLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'map'
  id?: string
  props?: {
    center?: { lat: number; lng: number }
    zoom?: number
    height?: MapHeight
    markers?: MapStaticMarker[]
    markerSources?: MapMarkerSource[]
  }
  children?: never
}

export interface GalleryStaticImage {
  src: string
  alt: string
}

export type GalleryDynamicSource = { source: string; key: string; alt: string } & (
  | { mode: 'src'; src: string }
  | { mode: 'fetch'; fetch: ImageFetchConfig; idField?: string }
)

export interface GalleryPaginatedDisplay {
  mode: 'paginated'
  pagination: {
    pageSize: number
    controls?: { variant?: RuntimeCollectionPaginationControlsVariant }
  }
}

export interface GalleryCarouselDisplay {
  mode: 'carousel'
  visibleCount: number
  autoplay?: { enabled: true; intervalMs: number }
  loop?: boolean
}

export interface GalleryLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'gallery'
  id?: string
  props: ({ images: GalleryStaticImage[] } | { source: GalleryDynamicSource }) & {
    display: GalleryPaginatedDisplay | GalleryCarouselDisplay
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
  onSuccess?: RuntimeUiActionListEntry[]
  onError?: RuntimeUiActionListEntry[]
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
  onSuccess?: RuntimeUiActionListEntry[]
  onError?: RuntimeUiActionListEntry[]
}

export interface ResetFormRuntimeUiAction {
  type: 'resetForm'
  formId: string
}

// Deliberately excluded from `RuntimeUiAction` and `RuntimeUiActionListEntry` (decision D7):
// `downloadOperation` is only valid as the first-level `action` of `button`/`link`, never as a
// chained entry inside another action's `onSuccess`/`onError` list.
export interface DownloadOperationRuntimeUiAction extends RuntimeApiRequestParams {
  type: 'downloadOperation'
  operationName: string
  filename?: string
  onSuccess?: RuntimeUiActionListEntry[]
  onError?: RuntimeUiActionListEntry[]
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

export type RuntimeUiActionListEntry = RuntimeUiAction & { when?: RuntimeWhenCondition }

export type NavigateToButtonAction = NavigateToRuntimeUiAction
export type GoBackButtonAction = GoBackRuntimeUiAction
export type ButtonAction = RuntimeUiAction

export type ButtonColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link' | 'switch'

export interface ButtonLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'button'
  id?: string
  props: {
    label: string
    action?: RuntimeUiAction | DownloadOperationRuntimeUiAction
    color?: ButtonColor
    variant?: ButtonVariant
    fullWidth?: boolean
    icon?: string
    iconPosition?: 'left' | 'right'
    checked?: boolean | string
    labelVisible?: boolean
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
    action?: NavigateToRuntimeUiAction | GoBackRuntimeUiAction | DownloadOperationRuntimeUiAction
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

export interface RuntimeGroupConfig {
  params: string[]
  template: LayoutNode[]
}

export type RuntimeGroupsConfig = Record<string, RuntimeGroupConfig>

export interface RuntimeGroupInstanceNodeProps {
  groupId: string
  params: Record<string, unknown>
}

export interface RuntimeGroupInstanceNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'group'
  id?: string
  props: RuntimeGroupInstanceNodeProps
  children?: LayoutNode[]
}

// Extends the same baseline mixins as every other `LayoutNode` member so generic infrastructure
// (visibility/queryStateFeedback resolution in `layout-node-renderer.tsx`, applied uniformly to
// every node regardless of type) keeps type-checking without special-casing `slot`. Functionally
// inert today: `slotNodeSchema` strips these keys, so a `slot` node never actually carries them.
export interface RuntimeSlotNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields {
  type: 'slot'
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
  | StepsLayoutNode
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
  | MapLayoutNode
  | GalleryLayoutNode
  | AutocompleteLayoutNode
  | RuntimeGroupInstanceNode
  | RuntimeSlotNode

export type LayoutNodeCollection = LayoutNode[]

// `menuItem` (root) allows one nesting level via `children`; `menuItemChild` cannot declare
// `children` itself — enforced by omitting the key from its type, not by a runtime check alone.
export interface MenuItemChildConfig {
  label: string
  icon?: string
  visibility?: RuntimeVisibilityConfig
  href?: string
  action?: NavigateToRuntimeUiAction | GoBackRuntimeUiAction
}

export interface MenuItemConfig extends MenuItemChildConfig {
  children?: MenuItemChildConfig[]
}

// Same public shape as the `image` node's `props` (without the `type` wrapper).
export type ShellHeaderLogoConfig = ImageLayoutNode['props']

export type ShellHeaderActionNode = LinkLayoutNode | ButtonLayoutNode

export interface ShellHeaderConfig {
  logo?: ShellHeaderLogoConfig
  title?: string
  menu?: MenuItemConfig[]
  actions?: ShellHeaderActionNode[]
}

// Unlike `menuItem`/`menuItemChild` (two fixed shapes, one nesting level), `sidebarItem` is
// genuinely recursive: any node in the tree accepts the same fields, including its own
// `children`, with no depth limit.
export interface SidebarItemConfig {
  label: string
  icon?: string
  visibility?: RuntimeVisibilityConfig
  href?: string
  action?: NavigateToRuntimeUiAction | GoBackRuntimeUiAction
  children?: SidebarItemConfig[]
}

export interface ShellSidebarConfig {
  items?: SidebarItemConfig[]
  defaultCollapsed?: boolean
}

export type ShellScrollBehavior = 'page' | 'fixed'

export interface ShellConfig {
  header?: ShellHeaderConfig
  sidebar?: ShellSidebarConfig
  scrollBehavior?: ShellScrollBehavior
}

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
  shell?: ShellConfig
  groups?: RuntimeGroupsConfig
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
