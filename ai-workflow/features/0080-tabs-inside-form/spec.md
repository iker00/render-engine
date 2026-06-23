# Feature 0080 — Tabs como hijo de form

## Objetivo

Permitir que el nodo `tabs` sea hijo válido de `form`, de modo que los campos de formulario (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`) puedan organizarse visualmente por pestañas dentro de un mismo formulario. Todos los campos de todos los tabs pertenecen al formulario contenedor y participan en su validación y submit.

## Alcance

- Añadir `tabs` al catálogo de `children` válidos de `form`.
- Los campos de formulario dentro de los paneles de tabs heredan el `formId` del formulario contenedor, igual que ocurre con `container` o `accordion`.
- Todos los campos de todos los tabs participan en la validación y el submit del formulario, independientemente del tab activo. Un campo `required` en un tab que el usuario no ha visitado bloquea el submit igual que si estuviera visible.
- La validación previa al render recorre recursivamente los `children` de cada item de tabs dentro de form, aplicando las mismas reglas semánticas que ya aplica a los hijos de `container` y `accordion` dentro de form: detección de `fieldId` duplicados, campos huérfanos, nodos prohibidos como `fileManager`, etc.
- El nodo `tabs` dentro de `form` puede anidarse dentro de otros nodos intermedios ya permitidos (`container`, `accordion`), y a su vez puede contener esos mismos nodos intermedios en sus paneles.

## Fuera de alcance

- Indicación visual en la barra de tabs de cuáles contienen errores de validación.
- Cambio automático al primer tab con errores tras un submit fallido.
- Submit independiente por tab.
- Modificación del comportamiento de `tabs` fuera de `form`.
- Tabs como contenedor de formularios independientes (dirección tabs → form, que ya funciona hoy).

## Requisitos funcionales

### Validación previa al render

- `form.children` acepta `tabs` como tipo válido, además de los ya soportados (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph`, `image`, `table`, `container`, `accordion`, `divider`).
- La validación semántica recorre los `children` de cada item de `tabs` dentro de form con las mismas reglas que aplica a `container.children` y `accordion.children` dentro de form:
  - Detección de `fieldId` duplicados dentro del mismo formulario, incluyendo campos repartidos entre distintos tabs.
  - Rechazo de nodos no permitidos dentro de form (como `fileManager`).
  - Rechazo de campos de formulario huérfanos dentro de tabs (ya cubierto por el recorrido existente de `validateFormNodesInCollection`).
- La validación semántica de `executeOperation`, `executeOperations`, `onSuccess` y `onError` recorre también los children de tabs dentro de form para comprobar body sobre GET.

### Ciclo de vida de campos en tabs dentro de form

- Los campos de formulario dentro de los paneles de tabs heredan el `formId` del formulario contenedor.
- Todos los campos de todos los tabs participan en la validación del submit del formulario, no solo los del tab activo. Si un campo `required` está en un tab inactivo y nunca fue visitado, el submit falla por validación.
- Los valores de campos de todos los tabs se incluyen en el payload del submit, no solo los del tab activo.
- Los campos en tabs inactivos conservan su estado (`value`, `error`, `touched`, `dirty`, `defaultValue`) mientras el formulario sigue montado, de la misma forma que ocurre con campos ocultos por `visibility`.
- `resetOnSuccess` y `resetForm` afectan a todos los campos del formulario, incluidos los que estén en tabs inactivos.

### Interacción con visibilidad por item

- Si un item de tabs tiene una regla `visibility` que evalúa como oculto, los campos dentro de ese item se comportan como campos ocultos por `visibility`: no participan en validación ni submit y sus referencias se omiten del payload. Esto sigue la semántica existente de campos ocultos.
- Si un tab es simplemente inactivo (no seleccionado por el usuario, sin regla de `visibility`), sus campos SÍ participan en validación y submit.

### Diferencia con accordion

- `accordion` dentro de form ya es un hijo válido. Los campos dentro de un accordion cerrado se desmontan y no participan en submit si nunca fueron montados. Este comportamiento se mantiene sin cambios.
- `tabs` dentro de form tiene un comportamiento distinto: los campos de todos los tabs participan en validación y submit independientemente del tab activo. Esta diferencia es intencional porque tabs organiza secciones obligatorias de un formulario, mientras que accordion agrupa secciones opcionales o colapsables.

## Requisitos no funcionales

- No debe cambiar el comportamiento de `tabs` fuera de `form`.
- No debe cambiar el comportamiento de `form` sin `tabs`.
- No debe cambiar el comportamiento de `accordion` dentro de `form`.
- El rendimiento no debe degradarse visiblemente para formularios con pocos tabs (hasta ~5 tabs con ~10 campos cada uno).

## Criterios de aceptación

- Un JSON de configuración con `tabs` dentro de `form.children` pasa la validación previa al render.
- Un JSON con `tabs` dentro de `form` → `container` → `tabs` pasa la validación.
- Un JSON con un campo `input` duplicado (`fieldId` repetido) repartido entre dos tabs del mismo form se rechaza con `invalid-layout`.
- Un JSON con `fileManager` dentro de un tab que está dentro de un form se rechaza con `invalid-layout`.
- Al submit, los campos en todos los tabs participan en la validación, incluidos los de tabs no visitados. Si un campo `required` en un tab no visitado no tiene valor, el submit falla por validación.
- Al submit exitoso, el payload incluye los valores de campos de todos los tabs.
- `resetOnSuccess` limpia el estado de campos en todos los tabs.
- `resetForm` limpia el estado de campos en todos los tabs.
- Si un item de tabs tiene `visibility` que evalúa como oculto, los campos dentro no participan en validación ni submit.
- Si un item de tabs no tiene `visibility` pero no es el tab activo, los campos dentro sí participan en validación y submit.
- `defaultValue` con referencia a `queries.*`, `params.*` o `item.*` funciona correctamente para campos dentro de tabs.
- El nodo `tabs` fuera de `form` sigue comportándose exactamente igual que antes (solo el panel activo en el DOM).

## Casos límite

- Form con un solo tab: funciona como un wrapper visual adicional sin impacto funcional.
- Form con todos los tabs ocultos por `visibility`: no hay campos visibles, el submit se comporta como un formulario vacío.
- Form con tabs donde el tab activo no tiene campos pero otros tabs sí: los campos de los otros tabs participan en submit.
- Tabs anidado en container que está dentro de accordion que está dentro de form: los campos heredan el formId y participan en submit solo si el accordion ha sido abierto al menos una vez (semántica de accordion preservada).
- Campo con `visibility` individual dentro de un tab inactivo: el campo se evalúa como no visible (tanto por el tab como por su propia regla), y no participa en submit.
- Tabs dentro de form dentro de tabs (anidamiento): el tabs exterior puede estar fuera de form (con semántica actual) y contener un form cuyos children incluyen otro tabs (con la nueva semántica). Cada nivel sigue su propia regla.

## Riesgos o preguntas abiertas

Ninguno bloqueante.

## Áreas de producto afectadas

- Catálogo de nodos: ficha `tabs.md` (ya menciona placement dentro de form, se confirma) y ficha `form.md` (añadir `tabs` al catálogo de children válidos).
- Validación: `validation.md` (actualizar reglas de `form.children`).
- Formularios: `lifecycle.md` (clarificar comportamiento de campos en tabs inactivos dentro de form).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/form.md` — actualizar allowlist de children.
- `ai-workflow/docs/app-features/nodes/tabs.md` — confirmar y detallar comportamiento dentro de form.
- `ai-workflow/docs/app-features/config/validation.md` — actualizar reglas de validación de form.children.
- `ai-workflow/docs/app-features/forms/lifecycle.md` — clarificar ciclo de vida de campos en tabs dentro de form.
