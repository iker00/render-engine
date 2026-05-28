> Cuándo leer: si la tarea toca cómo se organizan páginas, la página inicial, hash routing, navegación entre páginas, params transportados o reentradas observables (`pageEntry`).
> Tamaño: corto.
> Relacionados: [[../queries/preloads.md]], [[../references/reference-resolution.md]].

# Navegación y páginas

Modelo de páginas, página inicial, navegación por hash y acciones declarativas de navegación.

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [page-model.md](./page-model.md) | Estructura de `pages`, `initialPage`, contrato de `id` y `layout` por página. |
| [hash-navigation.md](./hash-navigation.md) | `#/` y `#/pageId`, history API, normalización del hash, `goBack`, degradación a `initialPage`. |
| [navigate-actions.md](./navigate-actions.md) | `navigateTo`, `goBack`, `params` transportados, `pageEntry`, reevaluación de `preloads` por firma. |
