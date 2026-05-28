> Cuándo leer: nodo `image`, contrato de `src`/`alt`, degradación cuando no hay valor utilizable.
> Tamaño: corto.
> Relacionados: [[../references/dynamic-strings.md]], [[../references/reference-resolution.md]].

# `image`

## Contrato (`props`)
- `props.src`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.alt`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.

## Reglas de render
- `image.props` soporta `src` y `alt` como strings obligatorios; ambos reutilizan la convención central de literal, referencia runtime completa o interpolación parcial.
- `src` solo renderiza la imagen cuando resuelve un string no vacío.
- `alt` degrada a string vacío si no hay valor textual visible.
- En `image`, `src` solo produce render cuando la resolución final es un string no vacío; referencias ausentes, no resolubles o con valor final no textual degradan a no render, y `alt` degrada a string vacío si no hay valor visible.

## Validación específica
- Si un nodo `image` omite `props.src` o `props.alt`, el config completo se rechaza antes del render sobre la ruta exacta.
