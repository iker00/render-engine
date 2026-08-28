import type { GoBackRuntimeUiAction, NavigateToRuntimeUiAction, RuntimeVisibilityConfig } from '../../config/runtime-config'
import type { MenuItemChildConfig, MenuItemConfig } from '../../config/runtime-config-types'
import { DiscriminatedUnionPropertyField } from '../layout-canvas/property-fields/discriminated-union-property-field'
import { EnumPropertyField } from '../layout-canvas/property-fields/enum-property-field'
import { IconPickerPropertyField } from '../layout-canvas/property-fields/icon-picker-property-field'
import { PropertyFieldDispatcher } from '../layout-canvas/property-fields/property-field-dispatcher'
import {
  buildDefaultObjectForRequiredFields,
  getDiscriminatedUnionVariants,
  isPlainObject,
  resolveUnionBranch,
} from '../layout-canvas/property-fields/property-field-schema-resolution'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'
import { computeMenuItemMode, MODE_LABELS, NEW_CHILD_LABEL, type MenuItemMode } from './menu-item-mode'
import { getMenuItemJsonSchema } from './shell-config-panel-schema'

interface MenuItemFieldsEditorProps {
  item: MenuItemConfig | MenuItemChildConfig
  /** Root items may switch into "Con desplegable" mode; `menuItemChild` rows never can (0122-T1). */
  allowChildren: boolean
  onChange: (next: MenuItemConfig | MenuItemChildConfig) => void
  /** Distinguishes rows across the form for accessible field labels (e.g. "Elemento de menú 1"). */
  labelText: string
  /** Called right after switching this item into "Con desplegable" mode, once its first child has
   * been seeded — lets the caller expand that brand-new child row (every row starts collapsed by
   * default, but a freshly created one should open right away), the same as `addChild`. Optional
   * so a caller that doesn't track collapse state (there is none today, but keeps this component
   * usable standalone) doesn't have to pass a no-op. */
  onEnterChildrenMode?: () => void
}

/**
 * Shared field set for a single `menuItem`/`menuItemChild` row: `label`, `icon`, the mode
 * selector (none/href/action/children), the active mode's own fields, and `visibility` — reused
 * identically by the root `menu` list and by every open `children` sublist (0122-T5).
 */
export function MenuItemFieldsEditor({ item, allowChildren, onChange, labelText, onEnterChildrenMode }: MenuItemFieldsEditorProps) {
  const mode = computeMenuItemMode(item)
  const modeOptions: MenuItemMode[] = allowChildren ? ['none', 'href', 'action', 'children'] : ['none', 'href', 'action']

  const menuItemSchema = getMenuItemJsonSchema()
  const schemaProperties = isPlainObject(menuItemSchema.properties) ? menuItemSchema.properties : {}
  const actionSchema = isPlainObject(schemaProperties.action) ? (schemaProperties.action as Record<string, unknown>) : undefined
  const visibilitySchema = isPlainObject(schemaProperties.visibility) ? (schemaProperties.visibility as Record<string, unknown>) : undefined
  const actionVariants = actionSchema ? getDiscriminatedUnionVariants(actionSchema) : undefined

  function handleModeChange(nextValue: string | number) {
    const nextMode = String(nextValue) as MenuItemMode
    if (nextMode === mode) return

    const base = { label: item.label, icon: item.icon, visibility: item.visibility }
    if (nextMode === 'none') {
      onChange(base)
      return
    }
    if (nextMode === 'href') {
      onChange({ ...base, href: '' })
      return
    }
    if (nextMode === 'action') {
      const [firstVariant] = actionVariants ?? []
      const nextAction = firstVariant
        ? ({ ...buildDefaultObjectForRequiredFields(firstVariant.schema), type: firstVariant.typeValue } as NavigateToRuntimeUiAction | GoBackRuntimeUiAction)
        : undefined
      onChange({ ...base, action: nextAction })
      return
    }
    // A brand-new child must itself satisfy `refineMenuItemShape` (0122-T1: every menuItem/
    // menuItemChild needs exactly one of href/action/children) — seeded with an empty `href`,
    // same convention `addItem`/`addChild` below use for a freshly added root item.
    onChange({ ...base, children: [{ label: NEW_CHILD_LABEL, href: '' }] } as MenuItemConfig)
    onEnterChildrenMode?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-700">{labelText}</span>
      <TextPropertyField
        label="Etiqueta"
        value={item.label}
        onChange={(value) => onChange({ ...item, label: value })}
        required
      />
      <IconPickerPropertyField
        label="Icono"
        value={item.icon}
        onChange={(value) => onChange({ ...item, icon: typeof value === 'string' && value.length > 0 ? value : undefined })}
      />
      <EnumPropertyField
        label="Modo"
        value={mode}
        options={modeOptions}
        optionLabels={MODE_LABELS}
        onChange={handleModeChange}
        required
      />
      {mode === 'href' && (
        <TextPropertyField
          label="Href"
          value={item.href ?? ''}
          onChange={(value) => onChange({ ...item, href: value })}
          required
        />
      )}
      {mode === 'action' && actionVariants && (
        <DiscriminatedUnionPropertyField
          variants={actionVariants}
          value={item.action}
          onChange={(nextAction) => onChange({ ...item, action: nextAction as NavigateToRuntimeUiAction | GoBackRuntimeUiAction | undefined })}
          label="Acción"
          required
        />
      )}
      <PropertyFieldDispatcher
        schema={resolveUnionBranch(visibilitySchema, item.visibility)}
        value={item.visibility ?? {}}
        onChange={(nextVisibility) => onChange({ ...item, visibility: nextVisibility as RuntimeVisibilityConfig })}
        label="Visibilidad"
      />
    </div>
  )
}
