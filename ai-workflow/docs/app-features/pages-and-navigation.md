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
- El hash del navegador es la fuente de verdad visible de la entrada activa.
- La página activa sigue reflejándose en `navigation.currentPageId` dentro del store compartido del runtime.
- El runtime normaliza la home funcional declarada en `initialPage` como `#/`.
- Cualquier otra página visible usa el formato `#/pageId`.
- El historial interno ya no guarda solo `pageId`: cada entrada persiste `entryId`, `pageId` y `params` efectivos como traza observada por la sesión.
- Existe una acción interna `navigateToPage(pageId, params?)` que escribe el hash canónico correspondiente.
- `button.props.action` ya puede disparar `navigateTo` y `goBack` reutilizando ese mismo estado compartido.
- `navigateTo` puede declarar `params` como objeto plano y escalar; si un valor llega como referencia soportada, el runtime lo resuelve al hacer click y persiste el valor efectivo en la nueva entrada.
- Dentro de un `repeater`, `navigateTo.params` también puede resolver `item.*` contra la iteración activa y omite silenciosamente los params que acaben en valores no escalares.
- Los query params del hash alimentan `params.*` como strings, incluidos números y booleanos con forma textual.
- Un param sin valor explícito en la URL se interpreta como `''`.
- Si una clave se repite en el hash, prevalece la última ocurrencia.
- El hash canónico ordena los query params alfabéticamente por clave y omite claves ausentes, `null` o no escalares.
- Navegar a la misma página con los mismos params efectivos sigue siendo un no-op observable: no duplica historial ni relanza `preloads`.
- Navegar a la misma página con params efectivos distintos crea una entrada nueva del historial.
- `goBack` ya delega en el historial real del navegador cuando la sesión actual conoce una entrada previa utilizable.
- En una entrada directa por URL sin historial observado previo, `goBack` actúa como no-op visible.
- Si se intenta navegar con `navigateTo` a una página inexistente, el runtime conserva la página anterior y guarda un error recuperable `page-not-found`.
- Si el usuario entra con un hash inválido o con una página inexistente en la URL, el runtime degrada a `initialPage` y normaliza el hash a `#/`.
- Cada entrada a una página con `preloads` dispara una nueva tanda automática de operaciones, también al volver a una página ya visitada o al reentrar en la misma página con params distintos.
- Esa nueva tanda prepara primero la `pageEntry` activa y resetea solo sus queries precargadas antes del primer render útil de la entrada reactivada.
- Durante esa preparación, la nueva entrada ve esas queries ya limpias y en `loading`, sin un paso visible intermedio por `idle` ni reutilización transitoria del `data` de otra entrada.
- La misma política se reaplica también cuando `goBack` reactiva una entrada histórica con `preloads`.
- La unidad observable de reentrada es `pageEntry`, que refleja `entryId`, `pageId`, `params`, `preloadNames` y el estado agregado `idle | loading | success | error`.
- La misma entrada de página no relanza sus `preloads` por rerenders del provider ni por cambios internos de estado mientras `pageEntry.entryId` no cambie.
- Declarar varias páginas ya permite navegación controlada desde el runtime tanto por acciones imperativas internas como por `button.props.action`, con deep link por hash y soporte para atrás/adelante del navegador.

## Parámetros de navegación
- `routeParams` siguen fuera de alcance en la implementación actual.
- El runtime sí expone parámetros de navegación mediante la familia `params.{paramName}`.
- `params.*` representa los query params efectivos de la entrada activa normalizada, tanto si nacen de la URL directa como de una navegación declarativa interna.
- La familia `params.*` puede reutilizarse en texto visible, requests declarativos, `defaultValue` de campos y nuevas navegaciones originadas desde una página ya parametrizada.
- Si una navegación desmonta un `form` y luego lo vuelve a montar en otra entrada, los `defaultValue` basados en `params.*` se recalculan por defecto contra los params vigentes de esa nueva entrada.
- Si la nueva entrada además dispara `preloads`, cualquier `defaultValue` que dependa de esas queries precargadas se inicializa contra el estado limpio de la entrada nueva y ya no puede hidratarse con el dato de la visita anterior.
- `params.*` no forma parte todavía de `visibility` ni de las fuentes dinámicas de colección para `list` y `select`.

## Relación con futuras iteraciones
- El modelo actual ya separa `pages` e `initialPage`, resuelve la entrada visible desde una convención simple de hash y mantiene una traza interna mínima, de modo que futuras acciones declarativas podrán reutilizar ese mismo estado sin rehacer el contrato base.
- El alcance sigue intencionadamente acotado a hash routing simple; no introduce un router general por `pathname`.

## Límites de v1
- no hay routing por `pathname`
- no hay subrutas ni segmentos dinámicos
- no existen políticas alternativas de reentrada, caché, secuencialidad ni dependencias entre `preloads`; la política vigente es carga fresca por `pageEntry`
- no existen todavía `routeParams`
