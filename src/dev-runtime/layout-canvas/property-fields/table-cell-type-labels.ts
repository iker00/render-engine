import type { TableCellType } from './table-cell-type-property-field'

// Spanish labels per type (spec sub-block above), same lookup-table pattern as `VARIANT_LABELS` in
// `discriminated-union-property-field.tsx`. Split from `table-cell-type-property-field.tsx` (a
// component file) so Fast Refresh keeps working there; the rows/columns widget (T8, 0138) imports
// this to render the same badge label for a collapsed dynamic column-template item.
export const CELL_TYPE_LABELS: Record<TableCellType, string> = {
  text: 'Texto',
  image: 'Imagen',
  list: 'Lista',
  button: 'Botón',
  container: 'Contenedor',
  heading: 'Título',
  paragraph: 'Párrafo',
  link: 'Enlace',
}
