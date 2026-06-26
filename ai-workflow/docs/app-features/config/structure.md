> Cuándo leer: bloques raíz del JSON (`api`, `pages`, `initialPage`), modelo de página, shape de `preloads`, shape general de la colección `layout`.
> Tamaño: medio.
> Relacionados: [[api-catalog.md]], [[validation.md]], [[../navigation/page-model.md]], [[../queries/preloads.md]].

# Estructura del JSON

## Bloques raíz
La configuración parte de tres bloques principales:
- `api`: objeto requerido que define un catálogo declarativo de operaciones remotas nombradas.
- `pages`: array requerido de páginas declaradas.
- `initialPage`: identificador requerido de la página de entrada.

Bloques opcionales:
- `translations`: objeto opcional que define un catálogo de traducciones por idioma. Su estructura es un mapa cuyas claves son strings arbitrarios (claves de traducción) y cuyos valores son mapas idioma-string. Véase [[../references/reference-resolution.md]] para superficies admitidas y semántica de fallback.
- `tokens`: objeto opcional que define un catálogo de tokens de autenticación nombrados, cada uno con un valor inicial y refresco opcional proactivo. Véase [[../auth/tokens.md]] para configuración, ciclo de vida y refresco automático.

## Modelo de página
Cada página debe incluir:
- `id`: string no vacío y único dentro de `pages`.
- `preloads`: array opcional y ordenado de objetos declarativos de una sola clave.
- `layout`: array ordenado obligatorio de elementos declarativos.

Campos opcionales:
- `title`: string opcional que controla `document.title` mientras la página está activa. Véase [[../navigation/page-model.md#title-del-documento]] para el comportamiento.

La página ya no depende de `description` fuera del árbol `layout`.

## Shape de `preloads`
- cada entrada debe ser un objeto con exactamente una clave no vacía cuyo nombre actúa como `operationName`
- el valor de esa clave debe ser `{}` o un objeto con `query`, `body` y/o `headers`
- `query`, `body` y `headers` reutilizan exactamente el mismo contrato de `RuntimeApiRequestParams` ya soportado por `executeOperation`
- el runtime normaliza internamente cada entrada a `{ operationName, requestParams }`
- dentro de una misma página no se admite repetir el mismo `operationName`, aunque las requests declaradas fueran distintas
- el shape histórico `preloads: ["loadUsers"]` ya no forma parte del contrato soportado y se rechaza antes del render

## Shape general del `layout`
`layout` ya no usa un nodo raíz artificial. La colección puede empezar directamente con varios bloques hermanos y su orden define el orden visible de renderizado.

Cada elemento de layout usa un shape homogéneo basado en:
- `type`: tipo de nodo soportado.
- `id`: opcional.
- `layout`: opcional para metadatos transversales de layout.
- `props`: opcional según el tipo.
- `queryStateFeedback`: opcional para condicionar la salida visible del nodo según el estado de una query.
- `visibility`: opcional para mostrar u ocultar el nodo según un valor ya disponible en `forms.*`, `queries.*` o `item.*` cuando exista contexto de iteración.
- `children`: opcional, pero solo interpretado en `container` y `form`.

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
- `button` sin `action` solo es válido como descendiente de un `form`.
- las claves extra no soportadas se descartan del objeto validado final sin convertir por sí solas la configuración en inválida.

## Resolución inicial
- El runtime valida toda la configuración antes de renderizar.
- Tras validar `pages`, resuelve la página cuyo `id` coincide con `initialPage`.
- Si `initialPage` no existe dentro de `pages`, el arranque falla con un error explícito.
