> Cuándo leer: nodos visuales simples `heading`, `paragraph` y `list` — props y shapes admitidos para items.
> Tamaño: corto.
> Relacionados: [[../references/dynamic-strings.md]], [[../references/collection-pipeline.md]].

# `heading`, `paragraph`, `list`

## `heading`
- `props.text`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.level`: número entero obligatorio.
- `props.icon`: string opcional, nombre del icono Lucide React (ej. `"User"`, `"Info"`). Se renderiza a la izquierda del texto del heading. Si el nombre no resuelve, se ignora silenciosamente.
- `heading.props` soporta `text`, `level` e `icon`; `text` admite literal, referencia completa o interpolación parcial visible.
- `heading` conserva su jerarquía semántica (`<h1>`–`<h6>`) intacta; el icono no altera la estructura semántica.
- `heading` conserva su escala tipográfica actual; el icono se alinea con la línea base del texto.

## `paragraph`
- `props.text`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.icon`: string opcional, nombre del icono Lucide React (ej. `"Info"`, `"AlertCircle"`). Se renderiza a la izquierda del texto del párrafo. Si el nombre no resuelve, se ignora silenciosamente.
- `paragraph.props` soporta `text` e `icon`; ambos admiten literal, referencia completa o interpolación parcial visible.
- `paragraph` conserva su jerarquía semántica (`<p>`) intacta; el icono no altera la estructura semántica.

## `list`
- `props.items`: obligatorio. Shapes admitidos:
  - shape histórico: array de strings.
  - shape manual escalar: `{ values: Array<string> }`.
  - shape manual objeto: `{ values: Array<object>, itemText: string }`.
  - shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*' [| pipeline], itemType: 'scalar' }`.
  - shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*' [| pipeline], itemText: string }`.
- `list.props` soporta `items` como array histórico de strings o como origen declarativo manual/dinámico de colecciones escalares u objeto. El `source` dinámico puede incluir opcionalmente un pipeline declarativo (ver [[../references/collection-pipeline.md]]) para filtrar, ordenar o recortar items. Los strings visibles directos y `itemText` pueden interpolar placeholders.

## Estilo común
- `heading`, `paragraph`, `list`, `image` y `table` usan clases base estables de `Tailwind` para mantener jerarquía, legibilidad y la baseline institucional compacta del runtime.
