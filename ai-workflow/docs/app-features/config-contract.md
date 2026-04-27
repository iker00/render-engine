# Contrato de configuración

## Objetivo
Definir la estructura funcional mínima del JSON que el runtime interpreta hoy para resolver y renderizar una página estática inicial.

## Estructura vigente
La configuración parte de tres bloques principales:
- `api`: objeto requerido, reservado para capacidades futuras y todavía no ejecutado por el runtime actual
- `pages`: array requerido de páginas declaradas
- `initialPage`: identificador requerido de la página de entrada

## Modelo de página
Cada página debe incluir:
- `id`: string no vacío y único dentro de `pages`
- `layout`: array ordenado obligatorio de elementos declarativos

La página ya no depende de `title` ni `description` fuera del árbol `layout`.

## Shape del layout
`layout` ya no usa un nodo raíz artificial. La colección puede empezar directamente con varios bloques hermanos y su orden define el orden visible de renderizado.

Cada elemento de layout usa un shape homogéneo basado en:
- `type`: tipo de nodo soportado
- `id`: opcional
- `props`: opcional según el tipo
- `children`: opcional, pero solo interpretado en `container`

Reglas estructurales vigentes:
- `layout` debe ser siempre un array.
- `layout: []` es válido y produce una página sin contenido inventado.
- El shape antiguo con `layout` como objeto único ya no forma parte del contrato estable y se rechaza como error de configuración.
- `container.children` reutiliza el mismo modelo de colección ordenada y puede ser `[]` o no declararse.

Nodos soportados hoy:
- `container`
  - `props.direction`: string opcional, con soporte visual actual para `row` y fallback a columna
  - `props.gap`: string opcional, con aliases como `sm`, `md` y `lg` o cualquier valor CSS válido
- `heading`
  - `props.text`: string obligatorio
  - `props.level`: número entero obligatorio
- `paragraph`
  - `props.text`: string obligatorio
- `list`
  - `props.items`: array obligatorio de strings

## Resolución inicial
- El runtime valida toda la configuración antes de renderizar.
- Tras validar `pages`, resuelve la página cuyo `id` coincide con `initialPage`.
- Si `initialPage` no existe dentro de `pages`, el arranque falla con un error explícito.

## Referencias dinámicas
Las referencias dinámicas siguen formando parte del marco general del producto, por ejemplo:
- `forms.userSearch.name`
- `queries.searchUsers.data`
- `item.id`
- `routeParams.userId`
- `params.id`

Pero el runtime implementado en esta fase no las resuelve todavía dentro del layout.

## Validación
- La configuración debe validarse antes de renderizarse.
- La validación comprueba estructura general, página inicial, shape de la colección `layout` y shape de los nodos soportados.
- Si `layout` no es un array válido, el arranque falla con un error explícito sobre la ruta afectada.
- Si aparece un nodo no soportado en la raíz o dentro de `children`, el runtime lo trata como error de configuración y no lo reinterpreta.
- En desarrollo, los errores de configuración deben ser diagnósticos y visibles.
- En producción, los errores `development-only` degradan sin mostrar mensaje genérico visible.

## Límites de v1
- `api` no se ejecuta todavía.
- No hay `preloads` funcionales.
- No hay interpolación compleja dentro de strings.
- No hay sistema de plugins para componentes externos.
- No hay soporte para nodos distintos de `container`, `heading`, `paragraph` y `list`.
