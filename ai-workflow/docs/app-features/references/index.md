> Cuándo leer: si la tarea toca el sistema de referencias dinámicas del runtime (`queries.*`, `forms.*`, `params.*`, `item.*`), la interpolación `{{...}}`, las reglas de `visibility` o las de `queryStateFeedback`.
> Tamaño: corto.
> Relacionados: [[../queries/state-model.md]], [[../forms/lifecycle.md]], [[../nodes/index.md]].

# Referencias y reactividad declarativa

Sistema central de referencias dinámicas e interpolación que el runtime resuelve en superficies visibles, requests y reglas de visibilidad.

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [reference-resolution.md](./reference-resolution.md) | Familias `queries.*`, `forms.*`, `params.*`, `item.*`, fronteras por familia y superficies admitidas. |
| [dynamic-strings.md](./dynamic-strings.md) | Interpolación parcial `{{...}}`, catálogo cerrado de superficies, semántica de placeholders no resolubles, catálogo de formatters (`\| formatter[:arg]`) y su gramática. |
| [visibility.md](./visibility.md) | `node.visibility`: operadores, referencias admitidas, composición booleana (`and`/`or`), negación de condición, prioridad respecto a `queryStateFeedback`. |
| [query-state-feedback.md](./query-state-feedback.md) | `node.queryStateFeedback`: estados visibles, `mode: show/hide/fallback`, semántica `idle`. |
