> Cuándo leer: si la tarea toca el nodo `accordion` — sección colapsable con cabecera interactiva, coordinación de grupos, `defaultOpen`, children libres, accesibilidad ARIA.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[container.md]], [[form.md]], [[../config/validation.md]].

# Nodo `accordion`

Nodo estructural que representa una única sección colapsable con cabecera interactiva y cuerpo expandible. Varias instancias pueden coordinarse mediante un `groupId` compartido para garantizar que solo una esté expandida a la vez en toda la página. Sin `groupId`, cada instancia opera de forma completamente independiente.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.label` | `string` | sí | — | Texto visible de la cabecera. Soporta interpolación `{{...}}` con el sistema de referencias del runtime. |
| `props.defaultOpen` | `boolean` | no | `false` | Si `true`, la sección arranca expandida al montar. |
| `props.groupId` | `string` | no | — | Cuando se declara, el accordion participa en un grupo de página. Solo puede haber un accordion del mismo `groupId` expandido a la vez. |

## Children

`children`: colección ordenada de nodos hijos. Admite cualquier nodo válido del catálogo: `container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `repeater`, `modal`, `tabs`, `accordion`.

Los hijos solo están en el DOM cuando el accordion está expandido.

## Campos transversales

El nodo `accordion` aplica los campos transversales estándar sobre el nodo completo (cabecera + cuerpo):

- `visibility`: oculta o muestra el nodo entero. Si evalúa como oculto, ni la cabecera ni el cuerpo se renderizan.
- `queryStateFeedback`: sustituye el nodo entero por el feedback correspondiente cuando el estado de la query no es la rama principal. La cabecera no se muestra en ese caso.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Comportamiento

- Al montar, el accordion está cerrado por defecto. `props.defaultOpen: true` lo hace arrancar expandido.
- La cabecera es siempre visible e interactiva. Al pulsar una cabecera cerrada, el cuerpo aparece en el DOM. Al pulsarla de nuevo, el cuerpo desaparece (toggle).
- El estado abierto/cerrado es local al componente y se reinicia al desmontarse (por ejemplo, al navegar a otra página).
- La cabecera es un `<button type="button">` con `aria-expanded` que refleja el estado actual.
- **Estilo visual**: la cabecera usa un fondo de tono suave del color primario (`app-accent/10`), con un tono más marcado en hover (`app-accent/20`). El anillo de foco usa el color primario (`app-accent`).
- **Indicador chevron**: la cabecera muestra un icono chevron alineado a la derecha. El chevron apunta hacia abajo cuando el accordion está cerrado y hacia arriba cuando está abierto, con una rotación animada suave al cambiar de estado.
- **Transición de apertura/cierre**: el cuerpo del accordion aparece y desaparece con una transición visual suave en lugar de aparecer o desaparecer de golpe. Los hijos se montan/desmontan de forma síncrona con `isOpen`, por lo que la transición opera sobre el wrapper exterior del cuerpo.

### Coordinación de grupos

- Cuando varios accordions de la misma página comparten el mismo `props.groupId`, se coordinan a través de un React Context (`AccordionGroupProvider`) que envuelve el árbol de la página.
- Expandir un accordion del grupo cierra automáticamente cualquier otro del mismo grupo que estuviera abierto.
- Cerrar el accordion activo del grupo deja el grupo sin ninguno abierto.
- Un accordion sin `groupId` ignora por completo la lógica de grupo y puede estar expandido simultáneamente con cualquier otro accordion de la página.
- Un grupo de un solo miembro se comporta exactamente igual que un accordion sin `groupId`.

### Uso dentro de `form`

El accordion es un descendiente permitido de `form`. Sus hijos directos pueden incluir campos de formulario (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`). La lógica de validación de formulario aplica igualmente a los campos dentro del cuerpo del accordion.

### Uso dentro de `repeater.props.template`

Cada iteración del repeater genera su propia instancia de accordion con estado abierto/cerrado independiente. Si el accordion del template declara `groupId`, todas las instancias de todas las iteraciones participan en el mismo grupo de página: expandir la instancia de una iteración puede colapsar la de otra fila con el mismo `groupId`.

## Casos límite

- **Varios accordions del mismo grupo con `defaultOpen: true`**: solo el primero en montar arranca expandido; los demás arrancan cerrados.
- **Un único accordion con `groupId`**: se comporta exactamente igual que sin `groupId`.
- **Accordion sin `children` o con `children: []`**: válido; al expandirse muestra el cuerpo vacío sin error.
- **`visibility` que evalúa como oculto**: ni la cabecera ni el cuerpo se renderizan; el estado abierto/cerrado no es relevante.
- **`queryStateFeedback` en estado distinto de la rama principal**: el nodo entero se sustituye por el feedback correspondiente; la cabecera no se muestra.
- **Navegar a otra página**: todos los accordions pierden su estado local; al volver a entrar, aplica `defaultOpen` desde cero.
- **Accordion dentro de `repeater.props.template` con `groupId`**: todas las instancias de todas las iteraciones participan en el mismo grupo de página.

## Validación previa al render

- `props.label` es obligatorio y no puede ser string vacío. Rechazo con diagnóstico de ruta `{path}.props.label`.
- `props.defaultOpen` si se declara debe ser booleano. Rechazo con diagnóstico `{path}.props.defaultOpen`.
- `props.groupId` si se declara debe ser string. Rechazo con diagnóstico `{path}.props.groupId`.
- `children` se validan recursivamente; un tipo desconocido produce `unsupported-node-type`.
- `accordion` puede aparecer dentro de `modal.children`, `form.children`, `container.children` y `repeater.props.template` sin restricción de placement.

## Lo que está fuera de alcance (v1)

- Acciones UI para abrir o cerrar un accordion desde un botón externo (`openAccordion`, `closeAccordion`).
- Exposición del estado abierto/cerrado al sistema de referencias del runtime (`queries.*`, `forms.*`).
- Duración o tipo de transición de apertura/cierre configurable desde JSON (las transiciones son de duración fija y tipo fijo).
- Visibilidad o deshabilitación de la cabecera de forma independiente al nodo completo.
- Persistencia del estado abierto en navegación o `pageEntry`.
- Generación dinámica de ítems desde una colección de `queries.*` (forma multi-ítem declarativa).
