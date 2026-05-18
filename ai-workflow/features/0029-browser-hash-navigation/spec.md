# Spec: Browser hash navigation

## Objetivo
Hacer que la navegación entre páginas del runtime deje de vivir solo en estado interno y pase a sincronizarse con el hash del navegador, usando el formato `#/pageId` como entrada activa, permitiendo query params en la URL y reutilizando `params.*` como namespace funcional de esos parámetros.

## Alcance
- Introducir navegación basada en hash del navegador con formato `#/pageId`.
- Tratar `initialPage` como la home funcional del runtime y representarla en la URL normalizada como `#/`.
- Resolver la página activa inicial y las reentradas posteriores a partir del hash visible del navegador.
- Reutilizar el `id` de cada página como slug de ruta.
- Permitir query params en el hash, por ejemplo `#/anuncios?id=42`.
- Hacer que esos query params alimenten el namespace existente `params.*`.
- Hacer que `navigateTo` siga pudiendo declarar `params` y que, cuando existan, los refleje también en la URL.
- Mantener la semántica actual de carga por entrada de página, incluida la reactivación de `preloads` cuando la entrada observable cambie.
- Sustituir la dependencia funcional del historial interno propio para navegación atrás/adelante por el historial del navegador.

## Fuera de alcance
- Introducir routing por segmentos anidados, rutas jerárquicas o patrones dinámicos.
- Añadir soporte para `routeParams.*` distinto de `params.*`.
- Abrir navegación por `pathname` real del navegador o integrar un router externo completo.
- Soportar serialización de objetos, arrays o estructuras complejas en query string.
- Definir reglas nuevas de caché, deduplicación o refetch más allá de la semántica vigente por entrada.
- Abrir un sistema general de guards, redirects declarativos o 404 visibles como página de producto.

## Requisitos funcionales
- El runtime debe interpretar el hash del navegador como fuente de verdad de la entrada activa de página.
- El formato soportado debe ser `#/pageId` para páginas distintas de la home funcional.
- La home funcional debe corresponder a `initialPage` y debe normalizarse como `#/`.
- Si el navegador entra sin hash o con `#`, el runtime debe cargar `initialPage` y normalizar la URL a `#/`.
- Si el hash apunta a una página existente, el runtime debe cargar esa página como entrada activa.
- Si el hash incluye query params, esos valores deben quedar disponibles como `params.{paramName}` en la entrada activa.
- Los valores leídos desde la URL deben tratarse como strings, incluidos números y booleanos con forma textual.
- `params.*` debe seguir siendo la única familia declarativa para consumir parámetros de navegación en texto visible, requests, formularios y nuevas navegaciones.
- `navigateTo` debe seguir aceptando un bloque opcional `params`.
- Cuando `navigateTo` cree una navegación efectiva, el runtime debe actualizar la URL al formato `#/pageId?query...` o `#/?query...` cuando el destino sea la home funcional.
- Cuando `navigateTo` no incluya params efectivos, la URL resultante no debe inventar un query string vacío.
- Si `navigateTo` recibe params con valores ausentes, `null` o no escalares tras la resolución efectiva, esos params deben omitirse de la URL y de la entrada resultante.
- Navegar a la misma página con los mismos params efectivos debe seguir siendo un no-op observable: no debe crear una nueva entrada ni relanzar `preloads`.
- Navegar a la misma página con params efectivos distintos debe crear una nueva entrada observable y relanzar `preloads` si la página los declara.
- Las acciones del navegador atrás y adelante deben reactivar la entrada correspondiente a la URL visible en ese momento, restaurando también sus `params.*`.
- La acción declarativa `goBack` debe delegar en el historial del navegador para volver a la entrada previa real cuando exista.
- Si `goBack` se invoca sin una entrada previa utilizable del navegador, el runtime debe comportarse como no-op visible.
- Si el hash apunta a una página inexistente, el runtime debe redirigir a `initialPage`, limpiar la URL a `#/` y no dejar un slug inválido persistente.
- Si el hash usa un formato no soportado por el contrato acordado, el runtime debe degradar del mismo modo que una página inexistente: volver a `initialPage` y normalizar a `#/`.
- La página inicial declarada en la configuración debe seguir validándose antes del render; si `initialPage` no existe en `pages`, el arranque sigue fallando con error de configuración.
- Una configuración existente que no use `navigateTo.params` debe mantener compatibilidad funcional, con la diferencia de que la página activa ya se refleja en la URL.

## Requisitos no funcionales
- La feature debe mantener el alcance intencionadamente acotado a hash routing simple, sin convertirse en un router general de aplicación.
- La semántica debe ser consistente con la terminología ya existente del proyecto: `pages`, `initialPage`, `navigateTo`, `goBack`, `preloads` y `params.*`.
- La normalización de URL debe ser determinista para evitar múltiples hashes equivalentes para la misma entrada.
- La navegación debe seguir siendo robusta ante recargas del navegador y entradas directas por URL.
- La feature debe dejar explícito el cambio de contrato respecto a la restricción previa de v1 que excluía modificar la URL del navegador.

## Áreas de producto afectadas
- Páginas y navegación.
- Contrato declarativo del runtime.
- Referencias dinámicas `params.*`.
- Precargas automáticas y reentradas de página.

## Documentación probablemente afectada
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

## Criterios de aceptación
- Dada una configuración con `initialPage: "home"`, si la aplicación arranca sin hash, carga `home` y la URL queda normalizada como `#/`.
- Dada una URL `#/anuncios`, la aplicación carga la página `anuncios` si existe.
- Dada una URL `#/anuncios?id=42`, la aplicación carga la página `anuncios` y expone `params.id` con valor `"42"`.
- Dado un `navigateTo` hacia `anuncios` con `params: { id: "42" }`, al activarlo la URL pasa a `#/anuncios?id=42`.
- Dado un `navigateTo` hacia `initialPage` con params efectivos, al activarlo la URL pasa a `#/?...` sin incluir el slug de la home.
- Dado un `navigateTo` hacia la misma página ya visible con los mismos params efectivos, no cambia la entrada activa ni se relanzan `preloads`.
- Dado un `navigateTo` hacia la misma página ya visible con params efectivos distintos, sí cambia la entrada activa y se relanzan los `preloads` de esa página si existen.
- Dada una navegación `#/ -> #/anuncios?id=42 -> #/anuncios?id=77`, al usar atrás del navegador la aplicación vuelve a la entrada `#/anuncios?id=42` y restaura `params.id = "42"`.
- Dada una URL `#/no-existe`, la aplicación redirige a `initialPage` y deja la URL como `#/`.
- Dada una URL con formato inválido para el contrato soportado, la aplicación redirige igualmente a `initialPage` y deja la URL como `#/`.

## Casos límite
- Query params presentes en la home funcional, por ejemplo `#/?tab=busqueda`.
- Navegación directa por URL a una página con `preloads`.
- Reentrada a la misma página con distinto orden de query params pero mismos pares clave-valor.
- Query params sin valor explícito en la URL.
- Query params repetidos para la misma clave en el hash.
- Parámetros resueltos desde `navigateTo.params` que no pueden serializarse como valor escalar visible.

## Riesgos o preguntas abiertas
- Riesgo alto por cambio transversal de la fuente de verdad de navegación y por conflicto explícito con la restricción previa de v1 que excluía modificar la URL.
- La spec asume una única normalización estable de URL para home: `#/`. Si más adelante el producto quisiera otra convención visible, deberá tratarse como cambio de contrato.
- La estrategia exacta de serialización y comparación de query params deberá cerrarse en `design.md` para evitar divergencias entre URL, historial y no-op de reentrada.
