> Cuándo leer: nodo `image`, contrato de `src` o `fetch`, degradación cuando no hay valor utilizable.
> Tamaño: corto.
> Relacionados: [[../references/dynamic-strings.md]], [[../references/reference-resolution.md]], [[../queries/execution.md]].

# `image`

## Contrato (`props`)
El nodo `image` soporta dos modos mutuamente excluyentes para obtener su contenido:

### Modo `src` (referencia a URL)
- `props.src`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.alt`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.

### Modo `fetch` (petición HTTP binaria local)
- `props.fetch`: objeto opcional que declara una petición HTTP a un endpoint binario.
  - `fetch.url`: string obligatorio, literal, referencia dinámica completa o string visible interpolado (misma semántica que `src`).
  - `fetch.method`: string opcional; métodos admitidos: `'GET'` (default), `'POST'`, `'PUT'`, `'PATCH'`, `'DELETE'`.
  - `fetch.headers`: objeto opcional con valores string; referencias completas o literales por clave (misma semántica que `api.headers`).
  - `fetch.body`: árbol JSON opcional cuyas hojas string admiten referencias completas o literales (misma semántica que `api.body`).
- `props.alt`: string obligatorio en ambos modos.

## Reglas de render

### Modo `src`
- `image.props` con `src` y `alt` como strings obligatorios; ambos reutilizan la convención central de literal, referencia runtime completa o interpolación parcial.
- `src` solo renderiza la imagen cuando resuelve un string no vacío.
- `alt` degrada a string vacío si no hay valor textual visible.
- En `image`, `src` solo produce render cuando la resolución final es un string no vacío; referencias ausentes, no resolubles o con valor final no textual degradan a no render, y `alt` degrada a string vacío si no hay valor visible.

### Modo `fetch`
- El nodo dispara la petición HTTP cuando se monta en el árbol.
- La respuesta binaria se convierte a un object URL (`blob:...`) para renderizar la imagen.
- El object URL se revoca automáticamente cuando el nodo se desmonta.
- Si la petición está en curso, ha fallado (red, HTTP, blob inválido) o la respuesta no es un binario utilizable: el nodo no renderiza ningún `<img>`.
- Dentro de un `repeater`, cada instancia del nodo dispara su propia petición independiente con su contexto `item.*` resuelto.
- La resolución de `fetch.url`, `fetch.headers` y `fetch.body` reutiliza la misma semántica de referencias dinámicas que el resto del runtime.

## Validación específica
- Un nodo `image` debe declarar exactamente uno de: `props.src` o `props.fetch`.
- Si omite ambos, el config se rechaza antes del render sobre la ruta exacta.
- Si declara ambos a la vez, el config se rechaza antes del render sobre la ruta exacta.
- Si declara `props.fetch` sin `props.fetch.url`, el config se rechaza antes del render sobre la ruta exacta.
- `props.alt` es obligatorio en ambos modos.
