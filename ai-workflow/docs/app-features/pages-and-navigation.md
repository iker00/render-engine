# Páginas y navegación

## Objetivo
Definir cómo se organiza el catálogo de páginas del runtime y cuál es el alcance real de la navegación en el estado actual del producto.

## Modelo de páginas
- La configuración declara varias páginas en `pages`.
- Cada página tiene un `id` único.
- Cada página contiene su propio `layout` como colección ordenada de bloques.
- En la capacidad actualmente implementada, el runtime valida todas las páginas declaradas pero solo renderiza una.
- La página seleccionada puede empezar por varios bloques hermanos sin `container` raíz artificial.

## Página inicial
- La configuración declara `initialPage`.
- El runtime entra en esa página al arrancar.
- Si `initialPage` no coincide con ningún `id`, el arranque falla con un error claro.

## Estado actual de navegación
- Todavía no existen acciones `navigateTo` ni `goBack`.
- No hay historial interno de páginas.
- La URL del navegador no cambia.
- Declarar varias páginas ya es válido como preparación para features posteriores, pero no habilita navegación por sí mismo.

## Route params
- `routeParams` siguen fuera de alcance en la implementación actual.
- El runtime todavía no expone parámetros de navegación a las páginas.

## Relación con futuras iteraciones
- El modelo actual ya separa `pages` e `initialPage` para que la navegación interna pueda añadirse más adelante sin rehacer el contrato base.
- La futura navegación seguirá siendo interna al runtime y no dependerá del router del navegador en la primera versión funcional.

## Límites de v1
- no hay deep links
- no hay sincronización con historial externo del navegador
- no se ejecutan `preloads`
