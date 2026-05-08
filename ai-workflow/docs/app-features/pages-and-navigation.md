# Páginas y navegación

## Objetivo
Definir cómo se organiza el catálogo de páginas del runtime y cuál es el alcance real de la navegación en el estado actual del producto.

## Modelo de páginas
- La configuración declara varias páginas en `pages`.
- Cada página tiene un `id` único.
- Cada página contiene su propio `layout` como colección ordenada de bloques.
- En la capacidad actualmente implementada, el runtime valida todas las páginas declaradas y resuelve la visible desde estado interno compartido.
- La página seleccionada puede empezar por varios bloques hermanos sin `container` raíz artificial.

## Página inicial
- La configuración declara `initialPage`.
- El runtime entra en esa página al arrancar.
- Si la página inicial declara `preloads`, el runtime dispara automáticamente esa tanda al montar la instancia.
- Si `initialPage` no coincide con ningún `id`, el arranque falla con un error claro.

## Estado actual de navegación
- La página activa vive en `navigation.currentPageId` dentro del store compartido del runtime.
- El historial interno ya no guarda solo `pageId`: cada entrada persiste `entryId`, `pageId` y `params` efectivos.
- Existe una acción interna `navigateToPage(pageId, params?)` para cambiar de página sin tocar la URL del navegador.
- `button.props.action` ya puede disparar `navigateTo` y `goBack` reutilizando ese mismo estado compartido.
- `navigateTo` puede declarar `params` como objeto plano y escalar; si un valor llega como referencia soportada, el runtime lo resuelve al hacer click y persiste el valor efectivo en la nueva entrada.
- Navegar a la misma página con los mismos params efectivos sigue siendo un no-op observable: no duplica historial ni relanza `preloads`.
- Navegar a la misma página con params efectivos distintos crea una entrada nueva del historial.
- El historial interno ya sostiene `goBack` como acción declarativa estable cuando existe una página previa válida y restaura también los params asociados a la entrada anterior.
- Si se intenta navegar a una página inexistente, el runtime conserva la página anterior y guarda un error recuperable `page-not-found`.
- Cada entrada a una página con `preloads` dispara una nueva tanda automática de operaciones, también al volver a una página ya visitada o al reentrar en la misma página con params distintos.
- La unidad observable de reentrada es `pageEntry`, que refleja `entryId`, `pageId`, `params`, `preloadNames` y el estado agregado `idle | loading | success | error`.
- La misma entrada de página no relanza sus `preloads` por rerenders del provider ni por cambios internos de estado mientras `pageEntry.entryId` no cambie.
- La URL del navegador no cambia.
- Declarar varias páginas ya permite navegación interna controlada desde el runtime tanto por acciones imperativas internas como por `button.props.action`.

## Parámetros de navegación
- `routeParams` siguen fuera de alcance en la implementación actual.
- El runtime sí expone parámetros de navegación interna mediante la familia `params.{paramName}`.
- `params.*` representa datos de la entrada activa del historial interno, no segmentos de URL ni query string del navegador.
- La familia `params.*` puede reutilizarse en texto visible, requests declarativos, `defaultValue` de campos y nuevas navegaciones originadas desde una página ya parametrizada.
- Si una navegación desmonta un `form` y luego lo vuelve a montar en otra entrada, los `defaultValue` basados en `params.*` se recalculan por defecto contra los params vigentes de esa nueva entrada.
- `params.*` no forma parte todavía de `visibility` ni de las fuentes dinámicas de colección para `list` y `select`.

## Relación con futuras iteraciones
- El modelo actual ya separa `pages` e `initialPage` y mueve la resolución visible al store compartido, de modo que futuras acciones declarativas podrán reutilizar ese mismo estado sin rehacer el contrato base.
- La futura navegación seguirá siendo interna al runtime y no dependerá del router del navegador en la primera versión funcional.

## Límites de v1
- no hay deep links
- no hay sincronización con historial externo del navegador
- no existen políticas alternativas de reentrada, caché, secuencialidad ni dependencias entre `preloads`
- no existen todavía `routeParams`
