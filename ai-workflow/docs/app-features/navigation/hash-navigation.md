> Cuándo leer: hash routing del runtime, formato canónico `#/`, normalización de hashes inválidos, integración con history del navegador, `goBack`.
> Tamaño: corto.
> Relacionados: [[navigate-actions.md]], [[page-model.md]].

# Navegación por hash

## Estado actual
- El hash del navegador es la fuente de verdad visible de la entrada activa.
- La página activa sigue reflejándose en `navigation.currentPageId` dentro del store compartido del runtime.
- El runtime normaliza la home funcional declarada en `initialPage` como `#/`.
- Cualquier otra página visible usa el formato `#/pageId`.
- El historial interno ya no guarda solo `pageId`: cada entrada persiste `entryId`, `pageId` y `params` efectivos como traza observada por la sesión.
- Existe una acción interna `navigateToPage(pageId, params?)` que escribe el hash canónico correspondiente.

## Comportamiento del hash canónico
- Los query params del hash alimentan `params.*` como strings, incluidos números y booleanos con forma textual.
- Un param sin valor explícito en la URL se interpreta como `''`.
- Si una clave se repite en el hash, prevalece la última ocurrencia.
- El hash canónico ordena los query params alfabéticamente por clave y omite claves ausentes, `null` o no escalares.

## Atrás y adelante
- `goBack` ya delega en el historial real del navegador cuando la sesión actual conoce una entrada previa utilizable.
- En una entrada directa por URL sin historial observado previo, `goBack` actúa como no-op visible.

## Degradación
- Si se intenta navegar con `navigateTo` a una página inexistente, el runtime conserva la página anterior y guarda un error recuperable `page-not-found`.
- Si el usuario entra con un hash inválido o con una página inexistente en la URL, el runtime degrada a `initialPage` y normaliza el hash a `#/`.

## Límites de v1
- no hay routing por `pathname`
- no hay subrutas ni segmentos dinámicos
- no existen todavía `routeParams`
