> Cuándo leer: si la tarea toca el chrome de aplicación compartido entre páginas (`shell`), la cabecera configurable (`shell.header`), su menú con desplegables, el estado "activo" de navegación, o la sección "Shell" del editor visual.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../config/validation.md]], [[../navigation/index.md]], [[../development/dev-mode-editor.md]].

# Shell de aplicación

Chrome compartido y persistente entre páginas, declarado bajo el bloque raíz opcional `shell`. Hoy cubre únicamente
`shell.header` (logo, título, menú de navegación con un nivel de desplegables, acciones de usuario). Un futuro
`shell.sidebar` es una feature aparte que reutilizará el mismo contrato de `menuItem`.

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [header.md](./header.md) | Shape de `shell.header`, contrato de `menuItem` (raíz y anidado), render, desplegable, estado activo de navegación, y la sección "Shell" del editor visual. |

## Relación con otras áreas
- El shape del JSON y sus reglas de validación cruzada están indexados también desde [`../config/structure.md`](../config/structure.md) y [`../config/validation.md`](../config/validation.md).
- El estado "activo" del menú se deriva del `pageId` de la página visible; ver [`../navigation/navigate-actions.md`](../navigation/navigate-actions.md) para el modelo de navegación del que depende.
- `shell.header.actions` reutiliza el contrato ya documentado de [`link`](../nodes/link.md) y [`button`](../nodes/button.md); `shell.header.logo` reutiliza el contrato de [`image`](../nodes/image.md).
