> Cuándo leer: si la tarea toca el nodo `tabs` — paneles navegables por pestañas, orientación, `defaultTab`, children por panel.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[container.md]], [[../config/validation.md]].

# Nodo `tabs`

Nodo estructural que organiza contenido en paneles navegables por pestañas. La barra de tabs puede posicionarse en horizontal (encima del panel) o en vertical (a la izquierda del panel). El estado del tab activo es local al componente.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.items` | `Array<{ label: string, children?: Node[] }>` | sí | — | Lista de paneles. Debe tener al menos un elemento. |
| `props.orientation` | `"horizontal" \| "vertical"` | no | `"horizontal"` | Posición de la barra de tabs. `horizontal`: barra encima del panel. `vertical`: barra a la izquierda del panel. |
| `props.defaultTab` | `number` (entero ≥ 0) | no | `0` | Índice 0-basado del tab activo al montar. |

### Estructura de cada item de `props.items`

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `label` | `string` | sí | Etiqueta visible del tab. Soporta interpolación `{{...}}` con el sistema de referencias del runtime. |
| `children` | `Node[]` | no | Nodos del panel correspondiente. Admite cualquier nodo válido del catálogo. |

## Campos transversales

El nodo `tabs` aplica los campos transversales estándar sobre el nodo completo (barra + panel activo):

- `visibility`: oculta o muestra el nodo entero. Si evalúa como oculto, ni la barra ni ningún panel se renderizan.
- `queryStateFeedback`: sustituye el nodo entero por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Comportamiento

- Al montar, el tab activo es el indicado por `props.defaultTab` (o el índice 0 si no se declara).
- Al hacer clic en un tab de la barra, el panel correspondiente pasa a ser el activo y el anterior desaparece del DOM. Solo el panel del tab activo está presente en el DOM en cada momento.
- El estado del tab activo es local al componente y se reinicia al desmontarse.
- Los `children` de cada item se renderizan como una colección de nodos usando el mismo renderer del runtime. Admiten cualquier nodo válido del catálogo, incluyendo `container`, `form`, `repeater`, nodos hoja, etc.
- El nodo `tabs` puede aparecer en cualquier posición del árbol de layout, incluyendo dentro de `form` y dentro de `container`.

## Casos límite

- Si `props.defaultTab` apunta a un índice fuera de rango, el runtime activa el primer tab (índice 0) sin error de runtime.
- Si `props.items` está vacío (caso límite, la validación previa lo rechaza), el nodo no renderiza nada — degradación silenciosa.
- Si un item no declara `children` o lo declara como array vacío, el panel activo se muestra vacío sin error.
- Si `visibility` evalúa como oculto, ni la barra de tabs ni ningún panel se renderizan.
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
- Visibilidad por tab individual — `visibility` solo aplica al nodo `tabs` completo.
- Tabs generados dinámicamente desde una colección de `queries.*`.
- Deshabilitar o cerrar tabs individuales.
- Persistencia del tab activo en navegación o `pageEntry`.
- Carga lazy de paneles.
