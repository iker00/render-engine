> Cuándo leer: si la tarea toca el estado compartido de queries, ejecución de operaciones `api`, precargas por entrada de página o feedback visual ligado al estado de una query.
> Tamaño: corto.
> Relacionados: [[../config/api-catalog.md]], [[../references/reference-resolution.md]], [[../references/query-state-feedback.md]], [[../navigation/navigate-actions.md]].

# Queries, ejecución y feedback

Estado compartido del dominio `queries`, ejecución declarativa de operaciones `api`, precargas por `pageEntry`, precargas globales de aplicación y feedback visual local.

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [state-model.md](./state-model.md) | `status`/`data`/`error`, `requestSignature`, ciclo de vida del estado y lectura desde el layout. |
| [execution.md](./execution.md) | `api`, `executeOperation`, `headers`, `body`, errores tipados, semántica de merge entre operación base y override. |
| [preloads.md](./preloads.md) | Request-aware preloads por página (snapshot común, `pageEntry`, latest-only) y precargas globales de aplicación (`preloads` raíz: disparo único por carga, no bloqueante, reintentos acotados). |
| [feedback.md](./feedback.md) | `idle | loading | error | empty | success`, heurística común de `empty`, integración con `queryStateFeedback`. |
