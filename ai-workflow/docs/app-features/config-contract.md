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
- `layout`: nodo raíz válido del árbol declarativo

La página ya no depende de `title` ni `description` fuera del árbol `layout`.

## Shape del layout
Cada nodo de layout usa un shape homogéneo basado en:
- `type`: tipo de nodo soportado
- `id`: opcional
- `props`: opcional según el tipo
- `children`: opcional, pero solo interpretado en `container`

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
- La validación comprueba estructura general, página inicial y shape de los nodos soportados.
- En desarrollo, los errores de configuración deben ser diagnósticos y visibles.
- En producción, los errores `development-only` degradan sin mostrar mensaje genérico visible.

## Límites de v1
- `api` no se ejecuta todavía.
- No hay `preloads` funcionales.
- No hay interpolación compleja dentro de strings.
- No hay sistema de plugins para componentes externos.
- No hay soporte para nodos distintos de `container`, `heading`, `paragraph` y `list`.
