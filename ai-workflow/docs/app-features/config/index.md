> Cuándo leer: si la tarea toca el shape del JSON soportado, sus bloques principales (`api`, `pages`, `initialPage`, `preloads`), la validación previa al render o los errores estructurales.
> Tamaño: corto.
> Relacionados: [[../nodes/index.md]], [[../references/index.md]], [[../navigation/page-model.md]].

# Contrato de configuración

Estructura general del JSON que el runtime interpreta. Los detalles del shape de cada nodo viven en [`../nodes/`](../nodes/index.md); las reglas de referencias viven en [`../references/`](../references/index.md).

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [structure.md](./structure.md) | Bloques raíz `api`/`pages`/`initialPage`, modelo de página, shape de `preloads`, shape general de `layout`. |
| [api-catalog.md](./api-catalog.md) | Modelo declarativo de `api`: `method`, `endpoint`, `query`, `body`, `headers` y reglas funcionales. |
| [validation.md](./validation.md) | Validación previa al render con `Zod`, fachada pública, errores estructurales, política dev/prod. |
