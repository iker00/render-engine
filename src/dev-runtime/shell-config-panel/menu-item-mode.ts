import type { MenuItemChildConfig, MenuItemConfig } from '../../config/runtime-config-types'

// Pure helpers/constants shared by `menu-item-fields-editor.tsx`, kept in their own
// (non-component) module — same rationale as `property-field-schema-resolution.ts`: Fast Refresh
// only preserves state across edits for modules that export components exclusively.

// `menuItem.action` is a genuine `z.discriminatedUnion('type', [navigateTo, goBack])` (0122-T1),
// so its own selector reuses `DiscriminatedUnionPropertyField` unchanged — same widget the canvas
// properties panel already uses for `link.props.action`/`button.props.action` (0107, T5).
//
// The outer "mode" selector below (none/href/action/children) is NOT itself a discriminated union
// in the schema: `href`/`action`/`children` are three independent optional fields whose mutual
// exclusivity is enforced by `refineMenuItemShape`'s `superRefine` (0122-T1), not by a shared
// `type` discriminant `toJSONSchema` can detect. Per the task's own escape hatch ("si el caso de
// children no encaja como una variante más, extender el widget... sin duplicar el resto de
// variantes"), `menu-item-fields-editor.tsx` composes a small bespoke selector for that outer
// choice while still delegating the real `action` variant fields to the genuine reusable widget.
export type MenuItemMode = 'none' | 'href' | 'action' | 'children'

export const MODE_LABELS: Record<MenuItemMode, string> = {
  none: 'Sin acción',
  href: 'Enlace (href)',
  action: 'Acción',
  children: 'Con desplegable',
}

export const NEW_CHILD_LABEL = 'Nuevo elemento'

export function computeMenuItemMode(item: MenuItemConfig | MenuItemChildConfig): MenuItemMode {
  if ('children' in item && item.children !== undefined) return 'children'
  if (item.href !== undefined) return 'href'
  if (item.action !== undefined) return 'action'
  return 'none'
}
