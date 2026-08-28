> Cuándo leer: bloques raíz del JSON (`api`, `pages`, `initialPage`), modelo de página, shape de `preloads`, shape general de la colección `layout`.
> Tamaño: medio.
> Relacionados: [[api-catalog.md]], [[validation.md]], [[../navigation/page-model.md]], [[../queries/preloads.md]], [[../shell/header.md]], [[../shell/sidebar.md]].

# Estructura del JSON

## Bloques raíz
La configuración parte de tres bloques principales:
- `api`: objeto requerido que define un catálogo declarativo de operaciones remotas nombradas.
- `pages`: array requerido de páginas declaradas.
- `initialPage`: identificador requerido de la página de entrada.

Bloques opcionales:
- `translations`: objeto opcional que define un catálogo de traducciones por idioma. Su estructura es un mapa cuyas claves son strings arbitrarios (claves de traducción) y cuyos valores son mapas idioma-string. Véase [[../references/reference-resolution.md]] para superficies admitidas y semántica de fallback.
- `tokens`: objeto opcional que define un catálogo de tokens de autenticación nombrados, cada uno con un valor inicial y refresco opcional proactivo. Véase [[../auth/tokens.md]] para configuración, ciclo de vida y refresco automático.
- `preloads`: array opcional y ordenado de precargas globales de aplicación, hermano de `api`/`pages`/`initialPage`. Se dispara una única vez por carga del runtime, sin depender de `initialPage` ni de `pageEntry`. Reutiliza el mismo shape de entrada que `pages[].preloads` con reglas más restrictivas (ver más abajo). Véase [[../queries/preloads.md]] para el modelo completo de ejecución, reintentos y feedback.
- `shell`: objeto opcional, hermano de `api`/`pages`/`initialPage`, que agrupa secciones de chrome de aplicación compartidas y persistentes entre páginas. Admite dos secciones independientes y aditivas: `shell.header` (logo, título, menú con un nivel de desplegables, acciones de usuario restringidas a `link`/`button`) y `shell.sidebar` (navegación lateral jerárquica, árbol de `sidebarItem` sin límite de profundidad, modo rail), además de un campo opcional `scrollBehavior` (`"page"` | `"fixed"`, default `"page"`) que controla si el chrome permanece pegajoso mientras la página completa hace scroll, o si el chrome queda fijo y solo el área de contenido hace scroll interno. Ausencia del bloque, o de sus tres campos, reproduce el comportamiento previo a la feature `0122` sin cambios visuales ni de validación. Véase [[../shell/header.md]] para el shape de `header`, el contrato de `menuItem` y `scrollBehavior`, y [[../shell/sidebar.md]] para el shape de `sidebar` y el contrato recursivo de `sidebarItem`.

## Modelo de página
Cada página debe incluir:
- `id`: string no vacío y único dentro de `pages`.
- `preloads`: array opcional y ordenado de objetos declarativos de una sola clave.
- `layout`: array ordenado obligatorio de elementos declarativos.

Campos opcionales:
- `title`: string opcional que controla `document.title` mientras la página está activa. Véase [[../navigation/page-model.md#title-del-documento]] para el comportamiento.

La página ya no depende de `description` fuera del árbol `layout`.

## Shape de `preloads`
`pages[].preloads` y el bloque raíz `preloads` comparten el mismo shape de entrada:
- cada entrada debe ser un objeto con exactamente una clave no vacía cuyo nombre actúa como `operationName`
- el valor de esa clave debe ser `{}` o un objeto con `query`, `body` y/o `headers`
- `query`, `body` y `headers` reutilizan exactamente el mismo contrato de `RuntimeApiRequestParams` ya soportado por `executeOperation`
- el runtime normaliza internamente cada entrada a `{ operationName, requestParams }`
- dentro de un mismo bloque (una página o el bloque raíz) no se admite repetir el mismo `operationName`, aunque las requests declaradas fueran distintas
- el shape histórico `preloads: ["loadUsers"]` ya no forma parte del contrato soportado y se rechaza antes del render

El bloque raíz `preloads` es más restrictivo que `pages[].preloads`:
- no admite `when`; una entrada con `when` se rechaza en bootstrap con ruta exacta `preloads[i].when`
- no admite referencias `item.*` en `query`/`body`/`headers` (no existe contexto de iteración a nivel de arranque de aplicación)
- cada `operationName` referenciado debe existir en el catálogo `api`, igual que en `pages[].preloads`
- ausencia del bloque o `preloads: []` se comportan exactamente igual que no declararlo

## Shape general del `layout`
`layout` ya no usa un nodo raíz artificial. La colección puede empezar directamente con varios bloques hermanos y su orden define el orden visible de renderizado.

Cada elemento de layout usa un shape homogéneo basado en:
- `type`: tipo de nodo soportado.
- `id`: opcional.
- `layout`: opcional para metadatos transversales de layout.
- `props`: opcional según el tipo.
- `queryStateFeedback`: opcional para condicionar la salida visible del nodo según el estado de una query.
- `visibility`: opcional para mostrar u ocultar el nodo según un valor ya disponible en `forms.*`, `queries.*` o `item.*` cuando exista contexto de iteración.
- `children`: opcional, pero solo interpretado en `container`, `form`, `modal`, `link` y `accordion`. `tabs` no interpreta `children` a nivel de nodo: cada pestaña de `props.items` declara su propia colección de hijos. `repeater` tampoco interpreta `children`: solo admite repetición a través de `props.template`.

Reglas estructurales vigentes:
- `layout` debe ser siempre un array.
- `layout: []` es válido y produce una página sin contenido inventado.
- El shape antiguo con `layout` como objeto único ya no forma parte del contrato estable y se rechaza como error de configuración.
- el bloque opcional `node.layout` admite hoy `span` como entero entre `1` y `12` o como mapa responsive cerrado por breakpoint.
- `container.children` reutiliza el mismo modelo de colección ordenada y puede ser `[]` o no declararse.

## Reglas estructurales del catálogo
- `heading`, `paragraph`, `list`, `image`, `table` y `button` siguen tratándose como nodos hoja; si reciben `children`, esos datos no pasan al resultado normalizado.
- `repeater` rechaza `children` y solo admite repetición a través de `props.template`.
- `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` solo son válidos como descendientes de un `form`.
- `steps` también solo es válido como descendiente de un `form`, aunque es un nodo estructural (con `props.items[i].children`, no un nodo hoja de campo) — a diferencia de `tabs` y `accordion`, válidos también fuera de `form`.
- `button` sin `action` solo es válido como descendiente de un `form`.
- las claves extra no soportadas se descartan del objeto validado final sin convertir por sí solas la configuración en inválida.

## Resolución inicial
- El runtime valida toda la configuración antes de renderizar.
- Tras validar `pages`, resuelve la página cuyo `id` coincide con `initialPage`.
- Si `initialPage` no existe dentro de `pages`, el arranque falla con un error explícito.
