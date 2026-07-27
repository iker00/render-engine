> Cuándo leer: si la tarea toca el nodo `tabs` — paneles navegables por pestañas, orientación, `defaultTab`, children por panel.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[container.md]], [[../config/validation.md]].

# Nodo `tabs`

Nodo estructural que organiza contenido en paneles navegables por pestañas. La barra de tabs puede posicionarse en horizontal (encima del panel) o en vertical (a la izquierda del panel). El estado del tab activo es local al componente.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.items` | `Array<{ label: string, visibility?: VisibilityRule, children?: Node[] }>` | sí | — | Lista de paneles. Debe tener al menos un elemento. |
| `props.orientation` | `"horizontal" \| "vertical"` | no | `"horizontal"` | Posición de la barra de tabs. `horizontal`: barra encima del panel. `vertical`: barra a la izquierda del panel. |
| `props.defaultTab` | `number` (entero ≥ 0) | no | `0` | Índice 0-basado del tab activo al montar. |

### Estructura de cada item de `props.items`

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `label` | `string` | sí | Etiqueta visible del tab. Soporta interpolación `{{...}}` con el sistema de referencias del runtime. |
| `visibility` | `VisibilityRule` | no | — | Regla de visibilidad específica para este item. Usa el mismo shape que el `visibility` transversal del nodo (referencia, operador y valor opcionales). Tabs ocultos no aparecen en la barra y su panel no se renderiza. |
| `children` | `Node[]` | no | Nodos del panel correspondiente. Admite cualquier nodo válido del catálogo. |

## Campos transversales

El nodo `tabs` aplica los campos transversales estándar sobre el nodo completo (barra + panel activo):

- `visibility`: oculta o muestra el nodo entero. Si evalúa como oculto, ni la barra ni ningún panel se renderizan.
- `queryStateFeedback`: sustituye el nodo entero por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Comportamiento

### Ciclo de vida del tab activo y visibilidad

- Al montar, la barra de tabs muestra solo los items cuya `visibility` evalúa como visible (o todos si no declaran `visibility`). El tab activo es el indicado por `props.defaultTab`, salvo que esté oculto, en cuyo caso se activa el primer tab visible por índice creciente del array original.
- Un tab oculto por `visibility` no aparece como botón en la barra ni su panel se renderiza en el DOM.
- Al hacer clic en un tab visible, el panel correspondiente pasa a ser el activo y el anterior desaparece del DOM. Solo el panel del tab activo está presente en el DOM en cada momento.
- Si una referencia cambia en runtime y el tab activo pasa a estar oculto, el nodo activa automáticamente el primer tab visible disponible sin intervención del usuario.
- El estado del tab activo se mantiene por índice del array original, independientemente de cuántos tabs estén ocultos.
- Los `children` de cada item se renderizan como una colección de nodos usando el mismo renderer del runtime. Admiten cualquier nodo válido del catálogo, incluyendo `container`, `form`, `repeater`, nodos hoja, etc.
- El nodo `tabs` puede aparecer en cualquier posición del árbol de layout, incluyendo dentro de `form` y dentro de `container`.

## Comportamiento dentro de `form`

Cuando `tabs` aparece como hijo de un nodo `form`:

- Los campos de formulario (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`) dentro de los paneles de todos los items con `visibility` evaluada como visible participan en validación, inicialización y submit del formulario, **independientemente del tab activo**. Solo el panel activo se renderiza en el DOM.
- Los campos en items con `visibility` oculto no participan en validación ni submit; sus referencias se omiten del payload, igual que cualquier campo oculto por `visibility`.
- Los valores de campos de todos los items (con `visibility` visible) se incluyen en el payload del submit, no solo los del tab activo.
- Al montar el form, los campos de todos los tabs se inicializan en el store con su `defaultValue` resuelto, aunque el tab esté inactivo.
- Si un campo `required` vive en un tab inactivo nunca visitado por el usuario, el submit falla por validación igual que si el campo fuera visible.
- Los campos en tabs inactivos conservan su estado (`value`, `error`, `touched`, `dirty`) mientras el formulario sigue montado, aunque su panel no esté en el DOM.
- `resetOnSuccess` y `resetForm` afectan a todos los campos del formulario, incluidos los de tabs inactivos.

**Diferencia con `accordion`**: `accordion` dentro de form tiene un comportamiento distinto. Los campos dentro de un accordion cerrado se desmontan y no participan en submit si nunca fueron montados. Con `tabs`, todos los campos participan sin importar qué tab esté activo.

El nodo `tabs` fuera de form sigue comportándose exactamente igual que antes: solo el panel activo en el DOM, estado local del tab, sin relación con formularios.

### Comportamiento visual de la barra de tabs

La barra de tabs se adapta al espacio disponible según la `orientation`:

- En orientación `vertical` (barra a la izquierda): la barra tiene un ancho máximo fijo (~192px). Las etiquetas que superen ese ancho se muestran en múltiples líneas dentro del botón, permitiendo wrapping y ruptura de palabras largas sin desbordar el ancho de la barra.
- En orientación `horizontal` (barra encima del panel): cuando el conjunto de botones supera el ancho disponible del container padre, la barra permite scroll horizontal interno. En pantallas anchas con pocos tabs, el comportamiento visual es idéntico al anterior: sin scroll visible.

## Casos límite

- Si `props.defaultTab` apunta a un tab oculto, el runtime activa el primer tab visible en su lugar.
- Si `props.defaultTab` apunta a un índice fuera de rango, el runtime activa el primer tab visible (o índice 0 si todos están visibles) sin error de runtime.
- Si `props.items` está vacío (caso límite, la validación previa lo rechaza), el nodo no renderiza nada — degradación silenciosa.
- Si todos los items tienen `visibility` que evalúa como oculto, el nodo no renderiza la barra ni ningún panel — degradación silenciosa.
- Si un item no declara `children` o lo declara como array vacío, el panel activo se muestra vacío sin error.
- Si un item no declara `visibility`, se comporta siempre como visible sin afectar a otros items.
- Si `visibility` (a nivel del nodo completo) evalúa como oculto, ni la barra de tabs ni ningún panel se renderizan, independientemente del `visibility` por item.
- Si `queryStateFeedback` está activo en un estado distinto de la rama principal, el nodo entero se sustituye por el feedback correspondiente.

## Validación previa al render

Las reglas de validación específicas del nodo `tabs` están documentadas en [`../config/validation.md`](../config/validation.md) bajo la sección de reglas del nodo `tabs`. Resumen:

- `props.items` es obligatorio y debe tener al menos un elemento.
- Cada item de `props.items` debe declarar `label`.
- `props.orientation` solo acepta `"horizontal"` o `"vertical"` si se declara.
- Los `children` de cada item se validan recursivamente con las mismas reglas del catálogo: tipos desconocidos producen `unsupported-node-type`; contratos inválidos producen `invalid-layout`.

## Lo que está fuera de alcance (v1)

- Vinculación del tab activo a referencias declarativas del runtime (`queries.*`, `forms.*`).
- Control del tab activo mediante acciones UI (p. ej. `activateTab`).
- Tabs generados dinámicamente desde una colección de `queries.*`.
- Deshabilitar o cerrar tabs individuales (sin ocultarlos completamente).
- Persistencia del tab activo en navegación o `pageEntry`.
- Carga lazy de paneles.
