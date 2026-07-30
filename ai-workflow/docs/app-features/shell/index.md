> Cuándo leer: si la tarea toca el chrome de aplicación compartido entre páginas (`shell`), la cabecera configurable (`shell.header`), la navegación lateral (`shell.sidebar`), sus menús/árboles con desplegables, el estado "activo" de navegación, o la sección "Shell" del editor visual.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../config/validation.md]], [[../navigation/index.md]], [[../development/dev-mode-editor.md]].

# Shell de aplicación

Chrome compartido y persistente entre páginas, declarado bajo el bloque raíz opcional `shell`. Cubre dos secciones
independientes y aditivas: `shell.header` (logo, título, menú de navegación con un nivel de desplegables, acciones
de usuario) y `shell.sidebar` (navegación lateral jerárquica, árbol de profundidad arbitraria, modo rail con
flyouts). Ambas pueden declararse por separado, juntas o ninguna.

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [header.md](./header.md) | Shape de `shell.header`, contrato de `menuItem` (raíz y anidado), render, desplegable, estado activo de navegación, y la sección "Shell" del editor visual. |
| [sidebar.md](./sidebar.md) | Shape de `shell.sidebar`, contrato recursivo de `sidebarItem`, composición con `shell.header`, expansión de ramas, modo rail y su flyout, estado activo de navegación, y la sección "Shell" del editor visual para sidebar. |

## Relación con otras áreas
- El shape del JSON y sus reglas de validación cruzada están indexados también desde [`../config/structure.md`](../config/structure.md) y [`../config/validation.md`](../config/validation.md).
- El estado "activo" del menú se deriva del `pageId` de la página visible; ver [`../navigation/navigate-actions.md`](../navigation/navigate-actions.md) para el modelo de navegación del que depende.
- `shell.header.actions` reutiliza el contrato ya documentado de [`link`](../nodes/link.md) y [`button`](../nodes/button.md); `shell.header.logo` reutiliza el contrato de [`image`](../nodes/image.md).
