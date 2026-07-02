import React from 'react'
import { AccordionNode } from './accordion-layout-node'
import { AlertNode } from './alert-layout-node'
import { BadgeNode } from './badge-layout-node'
import { ButtonNode } from './button-layout-node'
import { CheckboxGroupNode } from './checkbox-group-layout-node'
import { ContainerNode } from './container-layout-node'
import { DividerNode } from './divider-layout-node'
import { FileInputNode } from './file-input-layout-node'
import { FileManagerNode } from './file-manager-layout-node'
import { FormNode } from './form-layout-node'
import { HeadingNode } from './heading-layout-node'
import { ImageNode } from './image-layout-node'
import { InputNode } from './input-layout-node'
import { LinkNode } from './link-layout-node'
import { ListNode } from './list-layout-node'
import { ModalNode } from './modal-layout-node'
import { ParagraphNode } from './paragraph-layout-node'
import { RadioGroupNode } from './radio-group-layout-node'
import { RepeaterNode } from './repeater-layout-node'
import { SelectNode } from './select-layout-node'
import { SkeletonNode } from './skeleton-layout-node'
import { StatNode } from './stat-layout-node'
import { TableNode } from './table-layout-node'
import { TabsNode } from './tabs-layout-node'
import { TextareaNode } from './textarea-layout-node'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>

// Eager variant: static imports used in test mode to avoid Suspense in the test suite.
// Vite/Rollup eliminates this branch (and its imports) in dev/prod builds via dead code
// elimination of the `import.meta.env.MODE === 'test'` condition.
const eagerMap = {
  accordion: AccordionNode as AnyComponent,
  alert: AlertNode as AnyComponent,
  badge: BadgeNode as AnyComponent,
  button: ButtonNode as AnyComponent,
  checkboxGroup: CheckboxGroupNode as AnyComponent,
  container: ContainerNode as AnyComponent,
  divider: DividerNode as AnyComponent,
  fileInput: FileInputNode as AnyComponent,
  fileManager: FileManagerNode as AnyComponent,
  form: FormNode as AnyComponent,
  heading: HeadingNode as AnyComponent,
  image: ImageNode as AnyComponent,
  input: InputNode as AnyComponent,
  link: LinkNode as AnyComponent,
  list: ListNode as AnyComponent,
  modal: ModalNode as AnyComponent,
  paragraph: ParagraphNode as AnyComponent,
  radioGroup: RadioGroupNode as AnyComponent,
  repeater: RepeaterNode as AnyComponent,
  select: SelectNode as AnyComponent,
  skeleton: SkeletonNode as AnyComponent,
  stat: StatNode as AnyComponent,
  table: TableNode as AnyComponent,
  tabs: TabsNode as AnyComponent,
  textarea: TextareaNode as AnyComponent,
}

// Lazy variant: each entry is a React.lazy() that produces an independent chunk in dev/prod.
// The .then() adapter converts the named export to the default export required by React.lazy().
const lazyMap = {
  accordion: React.lazy(() => import('./accordion-layout-node').then((m) => ({ default: m.AccordionNode }))),
  alert: React.lazy(() => import('./alert-layout-node').then((m) => ({ default: m.AlertNode }))),
  badge: React.lazy(() => import('./badge-layout-node').then((m) => ({ default: m.BadgeNode }))),
  button: React.lazy(() => import('./button-layout-node').then((m) => ({ default: m.ButtonNode }))),
  checkboxGroup: React.lazy(() =>
    import('./checkbox-group-layout-node').then((m) => ({ default: m.CheckboxGroupNode })),
  ),
  container: React.lazy(() => import('./container-layout-node').then((m) => ({ default: m.ContainerNode }))),
  divider: React.lazy(() => import('./divider-layout-node').then((m) => ({ default: m.DividerNode }))),
  fileInput: React.lazy(() =>
    import('./file-input-layout-node').then((m) => ({ default: m.FileInputNode })),
  ),
  fileManager: React.lazy(() =>
    import('./file-manager-layout-node').then((m) => ({ default: m.FileManagerNode })),
  ),
  form: React.lazy(() => import('./form-layout-node').then((m) => ({ default: m.FormNode }))),
  heading: React.lazy(() => import('./heading-layout-node').then((m) => ({ default: m.HeadingNode }))),
  image: React.lazy(() => import('./image-layout-node').then((m) => ({ default: m.ImageNode }))),
  input: React.lazy(() => import('./input-layout-node').then((m) => ({ default: m.InputNode }))),
  link: React.lazy(() => import('./link-layout-node').then((m) => ({ default: m.LinkNode }))),
  list: React.lazy(() => import('./list-layout-node').then((m) => ({ default: m.ListNode }))),
  modal: React.lazy(() => import('./modal-layout-node').then((m) => ({ default: m.ModalNode }))),
  paragraph: React.lazy(() => import('./paragraph-layout-node').then((m) => ({ default: m.ParagraphNode }))),
  radioGroup: React.lazy(() =>
    import('./radio-group-layout-node').then((m) => ({ default: m.RadioGroupNode })),
  ),
  repeater: React.lazy(() => import('./repeater-layout-node').then((m) => ({ default: m.RepeaterNode }))),
  select: React.lazy(() => import('./select-layout-node').then((m) => ({ default: m.SelectNode }))),
  skeleton: React.lazy(() => import('./skeleton-layout-node').then((m) => ({ default: m.SkeletonNode }))),
  stat: React.lazy(() => import('./stat-layout-node').then((m) => ({ default: m.StatNode }))),
  table: React.lazy(() => import('./table-layout-node').then((m) => ({ default: m.TableNode }))),
  tabs: React.lazy(() => import('./tabs-layout-node').then((m) => ({ default: m.TabsNode }))),
  textarea: React.lazy(() => import('./textarea-layout-node').then((m) => ({ default: m.TextareaNode }))),
}

/**
 * Central map from node `type` to its React component.
 *
 * - In test mode (`import.meta.env.MODE === 'test'`): exposes eager static imports so the
 *   existing ~2300 tests can render nodes synchronously without Suspense.
 * - In dev/prod: each entry is a `React.lazy()` that produces an independent JS chunk,
 *   so only the node types actually rendered in a session are downloaded.
 */
export const NodeComponents: typeof eagerMap =
  import.meta.env.MODE === 'test' ? eagerMap : (lazyMap as unknown as typeof eagerMap)
