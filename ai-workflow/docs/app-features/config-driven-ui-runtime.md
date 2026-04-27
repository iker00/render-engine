# Runtime UI configurable

## Objetivo
Renderizar una aplicación multipágina a partir de una configuración JSON servida por backend, sin necesidad de desarrollar una pantalla React específica por cada caso de uso.

## Qué resuelve
- Permite que backend describa páginas, layouts y flujos de interacción.
- Centraliza la ejecución de endpoints declarados.
- Expone estado compartido para queries, formularios y navegación.
- Hace posible construir pantallas de búsqueda, detalle o edición sin una implementación frontend dedicada por caso.

## Áreas funcionales principales
- Configuración y contrato JSON.
- Páginas y navegación interna.
- Queries, mutaciones y feedback de carga/error/vacío.
- Formularios, campos y validación básica.
- Modo desarrollo local sin backend.

## Estructura de alto nivel
La configuración de v1 se organiza alrededor de:
- `api`
- `pages`
- `initialPage`

Cada página define al menos:
- `id`
- `layout`
- `preloads` opcionales

## Estado compartido
El runtime mantiene contexto compartido para:
- formularios
- navegación interna
- route params
- resultados y estado de queries

Cada query expone en v1:
- `status`: `idle | loading | success | error`
- `data`
- `error`

## Referencias relacionadas
- [`./config-contract.md`](./config-contract.md)
- [`./pages-and-navigation.md`](./pages-and-navigation.md)
- [`./queries-and-feedback.md`](./queries-and-feedback.md)
- [`./forms-and-validation.md`](./forms-and-validation.md)
- [`./development-workflow.md`](./development-workflow.md)
