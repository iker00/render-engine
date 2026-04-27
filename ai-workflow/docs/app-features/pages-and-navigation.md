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
- Si `initialPage` no coincide con ningún `id`, el arranque falla con un error claro.

## Estado actual de navegación
- La página activa vive en `navigation.currentPageId` dentro del store compartido del runtime.
- Existe una acción interna `navigateToPage(pageId)` para cambiar de página sin tocar la URL del navegador.
- El estado base conserva `history` como preparación para historial interno, aunque todavía no existe una UI declarativa final de `goBack`.
- Si se intenta navegar a una página inexistente, el runtime conserva la página anterior y guarda un error recuperable `page-not-found`.
- La URL del navegador no cambia.
- Declarar varias páginas ya permite navegación interna controlada desde el runtime, aunque la configuración JSON todavía no expone acciones declarativas finales para ello.

## Route params
- `routeParams` siguen fuera de alcance en la implementación actual.
- El runtime todavía no expone parámetros de navegación a las páginas.

## Relación con futuras iteraciones
- El modelo actual ya separa `pages` e `initialPage` y mueve la resolución visible al store compartido, de modo que futuras acciones declarativas podrán reutilizar ese mismo estado sin rehacer el contrato base.
- La futura navegación seguirá siendo interna al runtime y no dependerá del router del navegador en la primera versión funcional.

## Límites de v1
- no hay deep links
- no hay sincronización con historial externo del navegador
- no se ejecutan `preloads`
- no existen todavía `routeParams`
