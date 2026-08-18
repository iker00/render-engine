import type { ShellHeaderActionNode } from '../../config/runtime-config-types'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { buildDefaultNodeInstance } from '../layout-canvas/layout-canvas-node-palette-defaults'
import { LayoutCanvasPropertiesPanel } from '../layout-canvas/layout-canvas-properties-panel'
import { EnumPropertyField } from '../layout-canvas/property-fields/enum-property-field'

const ACTION_TYPE_LABELS: Record<ShellHeaderActionNode['type'], string> = {
  link: 'Enlace',
  button: 'Botón',
}

// Every row gets a fixed, structurally-valid `LayoutNodePath` purely to satisfy
// `LayoutCanvasPropertiesPanel`'s prop contract (it resets its own pending-rejection state when
// the *serialized* path changes) — this panel never resolves the path against a real page
// layout tree, since shell actions don't live in one. `index` keeps each row's path distinct.
function actionRowPath(index: number): LayoutNodePath {
  return [{ field: 'children', index }]
}

interface ShellActionsListEditorProps {
  actions: ShellHeaderActionNode[]
  /** Runs the actual `shell` commit and returns its result, so per-row edits can surface the
   * same "role=alert" rejection banner `LayoutCanvasPropertiesPanel` already renders for the
   * canvas (0122-T5's requirement to reuse that feedback pattern without duplicating UI). */
  onCommitActions: (nextActions: ShellHeaderActionNode[]) => CommitCanvasMutationResult
}

/**
 * `shell.header.actions` list editor (0122-T5): each entry is a full `link`/`button` node edited
 * through the exact same per-node properties panel the canvas uses, restricted to those two
 * node types. Add/remove/reorder use plain form controls — no DnD here, only `menu` reorders by
 * drag (spec restriction).
 */
export function ShellActionsListEditor({ actions, onCommitActions }: ShellActionsListEditorProps) {
  function replaceAt(index: number, nextNode: ShellHeaderActionNode) {
    const next = actions.slice()
    next[index] = nextNode
    return onCommitActions(next)
  }

  function handleTypeChange(index: number, nextType: string | number) {
    const type = String(nextType) as ShellHeaderActionNode['type']
    replaceAt(index, buildDefaultNodeInstance(type) as ShellHeaderActionNode)
  }

  function handleRemove(index: number) {
    onCommitActions(actions.filter((_, i) => i !== index))
  }

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= actions.length) return
    const next = actions.slice()
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    onCommitActions(next)
  }

  function handleAdd() {
    onCommitActions([...actions, buildDefaultNodeInstance('link') as ShellHeaderActionNode])
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="px-1 text-xs font-medium text-gray-700">Acciones</legend>
      {actions.map((action, index) => (
        <div key={index} className="flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-700">{`Acción ${index + 1}`}</span>
          <div className="flex items-center justify-between gap-2">
            <EnumPropertyField
              label="Tipo"
              value={action.type}
              options={['link', 'button']}
              optionLabels={ACTION_TYPE_LABELS}
              onChange={(nextType) => handleTypeChange(index, nextType)}
              required
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                aria-label={`Subir acción ${index + 1}`}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Subir
              </button>
              <button
                type="button"
                onClick={() => handleMove(index, 1)}
                disabled={index === actions.length - 1}
                aria-label={`Bajar acción ${index + 1}`}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Bajar
              </button>
            </div>
          </div>
          {/* T2 (0127): no `pageLayout` here — `shell.header.actions` entries live outside the
              page's `layout` tree entirely (see `actionRowPath` above), so there is never a
              `container` ancestor to resolve `columns` from. The `Layout` subsection simply
              doesn't render for these rows, same as any other node with no `pageLayout`. */}
          <LayoutCanvasPropertiesPanel
            node={action}
            path={actionRowPath(index)}
            onCommitNodeUpdate={(_path, updater) => replaceAt(index, updater(action) as ShellHeaderActionNode)}
            onDeleteNode={() => handleRemove(index)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        aria-label="Añadir acción"
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Añadir acción
      </button>
    </fieldset>
  )
}
