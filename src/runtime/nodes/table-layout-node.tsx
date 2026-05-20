import type { TableCellValue, TableLayoutNode } from '../../config/runtime-config'
import { resolveCollectionSourceItems } from '../runtime-collection-sources'
import {
  resolveRuntimeVisibleValue,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import {
  getTableBodyRowClassName,
  getTableCellClassName,
  getTableContainerClassName,
  getTableHeaderCellClassName,
  getTableNodeClassName,
} from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface TableNodeProps {
  node: TableLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function TableNode({ node, iterationContext }: TableNodeProps) {
  const state = useRuntimeState()
  const rows = resolveTableRows(node, state, iterationContext)

  return (
    <div data-layout-node="table" className={getTableContainerClassName()}>
      <table className={getTableNodeClassName()}>
        <thead>
          <tr>
            {node.props.headers.map((header) => (
              <th key={header} scope="col" className={getTableHeaderCellClassName()}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className={getTableBodyRowClassName()}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${cellIndex}`} className={getTableCellClassName()}>
                  {normalizeTableCellValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function resolveTableRows(
  node: TableLayoutNode,
  state: ReturnType<typeof useRuntimeState>,
  iterationContext?: RuntimeIterationContext,
) {
  if (Array.isArray(node.props.rows)) {
    return node.props.rows.map((row) =>
      row.map((cell) => {
        if (typeof cell !== 'string') {
          return cell
        }

        return resolveRuntimeVisibleValue(cell, state, 'table.cell', { iterationContext })
      }),
    )
  }

  const items = resolveCollectionSourceItems(node.props.rows.source, state, { iterationContext })

  return items.map((item) =>
    node.props.rows.cells.map((cell) =>
      resolveRuntimeVisibleValue(cell, state, 'table.cell', {
        iterationContext: {
          item,
        },
      }),
    ),
  )
}

function normalizeTableCellValue(value: string | number | boolean) {
  if (typeof value === 'string') {
    return value
  }

  return String(value)
}
