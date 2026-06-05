> Cuándo leer: si la tarea toca el nodo `divider` — separador visual horizontal con cuatro variantes de estilo.
> Tamaño: corto.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]], [[form.md]].

# Nodo `divider`

Nodo hoja declarativo que renderiza un separador visual horizontal. Soporta cuatro variantes de estilo (`solid`, `dashed`, `dotted`, `invisible`). No acepta `children`, no tiene texto ni etiqueta, y no es interactivo.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.variant` | `"solid" \| "dashed" \| "dotted" \| "invisible"` | no | `"solid"` | Variante visual del separador. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el separador no ocupa espacio.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Variantes de estilo

Se renderiza como un `<hr data-layout-node="divider">` con clases Tailwind según la variante:

| Variante | Clases Tailwind | Resultado visual |
|---|---|---|
| `solid` | `border-t border-app-border-soft` | Línea continua visible. |
| `dashed` | `border-t border-dashed border-app-border-soft` | Línea discontinua visible. |
| `dotted` | `border-t border-dotted border-app-border-soft` | Línea punteada visible. |
| `invisible` | `block h-0 border-0` | Separador sin línea visible; actúa como espaciador puro. `border-0` suprime el borde que aplica el preflight de Tailwind v4 al elemento `<hr>`. |

## Comportamiento de render

- Se renderiza siempre con `data-layout-node="divider"`.
- `props.variant` usa `"solid"` como default si no se declara.
- El nodo es hoja: si recibe `children` en la configuración, esos datos son descartados silenciosamente por el normalizador sin error de runtime.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Implementado con utilidades de Tailwind CSS; sin estilos inline.

## Uso en formularios

A partir de la feature `0057`, los `container` dentro de `form` con `surface: form-section` ya no reciben automáticamente el separador superior `border-t`. La separación visual entre secciones de formulario se consigue declarando un nodo `divider` explícito en el JSON, inmediatamente antes del `container` que actúa como sección dentro del `form`.

```json
{
  "type": "form",
  "id": "my-form",
  "children": [
    { "type": "container", "children": [...] },
    { "type": "divider" },
    { "type": "container", "children": [...] }
  ]
}
```

## Casos límite

- **`props.variant` ausente**: el runtime usa `"solid"` sin error.
- **`props.variant` con valor fuera del catálogo**: el config se rechaza antes del render con diagnóstico de ruta `{path}.props.variant`.
- **`children` declarados**: los datos se descartan silenciosamente; el nodo `divider` no los renderiza.
- **`visibility` evalúa como oculto**: el separador no se renderiza y no ocupa espacio en el DOM.
- **`queryStateFeedback` activo en estado no principal**: el nodo entero se sustituye por el feedback correspondiente.
- **`divider` dentro de `repeater.props.template`**: se repite una vez por item, igual que cualquier otro nodo hoja.
- **`divider` con `layout.span`**: se envuelve en el `div` con `col-span-*` cuando hay `parentGridColumns` activo en el renderer.

## Validación previa al render

- `props.variant` con valor fuera de `["solid", "dashed", "dotted", "invisible"]`: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.variant`.
- `layout.span` fuera del rango 1–12: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.layout.span`.
- `visibility`, `queryStateFeedback` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Orientación vertical del separador.
- Texto o etiqueta en el interior (divisores "OR").
- Grosor o color configurables desde JSON.
- Margen o padding configurables desde JSON.
- Theming declarativo o tokens visuales configurables.
