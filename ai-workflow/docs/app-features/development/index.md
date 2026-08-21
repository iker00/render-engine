> Cuándo leer: si la tarea toca el arranque local del runtime, la carga de configuración desde `src/dev/config.json` o desde `data-config`, o los ejemplos locales para iterar sin backend.
> Tamaño: corto.
> Relacionados: [[../config/index.md]].

# Desarrollo local

Documentación del modo de desarrollo local del runtime y sus fronteras de bootstrap.

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [local-config.md](./local-config.md) | Cargar config local, prioridad `data-config`, ejemplos sin backend, config de endpoints externos (`data-endpoints-config`), límites del modo dev. |
| [dev-mode-editor.md](./dev-mode-editor.md) | Editor Monaco en vivo, drawer lateral con pestañas Visual/JSON, editor visual del `layout` por manipulación directa (canvas de arrastrar y soltar), sección `Shell`, sección `Api` (CRUD de operaciones `api` y de entradas de `preloads` globales/de página), sección `Traducciones` (gestión manual de `translations` y sincronización con el proveedor externo PlataGes), botón "Guardar"/Ctrl+S hacia un backend externo, acción Aplicar, preservación de estado, HMR automático, autocompletado JSON Schema. |
