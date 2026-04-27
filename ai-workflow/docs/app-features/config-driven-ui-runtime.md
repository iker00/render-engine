# Runtime UI configurable

## Objetivo
Renderizar la primera página estática del runtime a partir de una configuración JSON validada, sin depender todavía de navegación interactiva, formularios ni datos remotos.

## Qué resuelve
- Permite que la configuración declare varias páginas aunque, por ahora, solo se resuelva la indicada por `initialPage`.
- Valida el contrato mínimo del runtime antes de renderizar.
- Interpreta un árbol declarativo de layout con un catálogo inicial y acotado de nodos.
- Sustituye el shell provisional por una página visible renderizada desde configuración.

## Áreas funcionales principales
- Configuración y contrato JSON.
- Selección de página inicial.
- Render estático de layout.
- Gestión de errores de configuración entre desarrollo y producción.
- Modo desarrollo local sin backend.

## Estructura de alto nivel
La configuración soportada hoy se organiza alrededor de:
- `api`
- `pages`
- `initialPage`

Cada página soportada define al menos:
- `id`
- `layout`

## Catálogo inicial de nodos
El renderer estático soporta estos nodos:
- `container`
- `heading`
- `paragraph`
- `list`

Reglas funcionales vigentes:
- Solo `container` admite `children`.
- `container.props` soporta `direction` y `gap`.
- `heading.props` soporta `text` y `level`.
- `paragraph.props` soporta `text`.
- `list.props` soporta `items` como array de strings.

## Comportamiento de errores
- Si `initialPage` no coincide con ninguna página declarada, el runtime muestra un error visible.
- Si el `layout` es inválido o aparece un nodo no soportado, en desarrollo se muestra un error diagnóstico.
- En producción, los errores marcados como `development-only` degradan a una superficie vacía en lugar de mostrar un mensaje genérico o inventar contenido.

## Límites actuales
- No existe navegación entre páginas.
- No se ejecutan `preloads`, queries ni endpoints declarados en `api`.
- No existe todavía estado compartido de formularios, queries o navegación.
- No se resuelven referencias dinámicas como `forms.*`, `queries.*` o `routeParams.*`.

## Referencias relacionadas
- [`./config-contract.md`](./config-contract.md)
- [`./pages-and-navigation.md`](./pages-and-navigation.md)
- [`./queries-and-feedback.md`](./queries-and-feedback.md)
- [`./forms-and-validation.md`](./forms-and-validation.md)
- [`./development-workflow.md`](./development-workflow.md)
