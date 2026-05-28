> Cuándo leer: nodos visuales simples `heading`, `paragraph` y `list` — props y shapes admitidos para items.
> Tamaño: corto.
> Relacionados: [[../references/dynamic-strings.md]].

# `heading`, `paragraph`, `list`

## `heading`
- `props.text`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.level`: número entero obligatorio.
- `heading.props` soporta `text` y `level`; `text` admite literal, referencia completa o interpolación parcial visible.
- `heading` conserva su jerarquía semántica actual, pero con una escala tipográfica y un bloque introductorio más contenidos que en la baseline previa.

## `paragraph`
- `props.text`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `paragraph.props` soporta `text`; `text` admite literal, referencia completa o interpolación parcial visible.
- `paragraph` conserva su jerarquía semántica actual, pero con una escala tipográfica y un bloque introductorio más contenidos que en la baseline previa.

## `list`
- `props.items`: obligatorio. Shapes admitidos:
  - shape histórico: array de strings.
  - shape manual escalar: `{ values: Array<string> }`.
  - shape manual objeto: `{ values: Array<object>, itemText: string }`.
  - shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', itemType: 'scalar' }`.
  - shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', itemText: string }`.
- `list.props` soporta `items` como array histórico de strings o como origen declarativo manual/dinámico de colecciones escalares u objeto; los strings visibles directos y `itemText` pueden interpolar placeholders.

## Estilo común
- `heading`, `paragraph`, `list`, `image` y `table` usan clases base estables de `Tailwind` para mantener jerarquía, legibilidad y la baseline institucional compacta del runtime.
