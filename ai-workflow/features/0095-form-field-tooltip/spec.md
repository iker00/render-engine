# Feature 0095 — Tooltip de ayuda en campos de formulario

## Objetivo

Permitir que los campos de formulario del runtime muestren texto de ayuda contextual a través de un tooltip asociado al
label del campo, sin ocupar espacio adicional en el layout.

## Alcance

- Nueva prop opcional `props.tooltip` en los siete field nodes con label: `input`, `textarea`, `select`, `radioGroup`,
  `checkboxGroup`, `toggle` y `fileInput`.
- Renderizado de un icono de información junto al texto del label cuando `props.tooltip` está declarado y resuelve a un
  string no vacío.
- Texto flotante visible al hacer hover sobre el icono o al recibir foco por teclado.
- El contenido del tooltip soporta texto literal y strings visibles interpolados con `{{...}}` (misma semántica que
  `props.label` y `props.placeholder`).
- Posicionamiento del tooltip con CSS puro, relativo al icono, sin dependencia de posicionamiento dinámico.
- Validación del contrato en `src/config/`: `props.tooltip` debe ser string cuando está presente; cualquier otro tipo
  rechaza el config antes del render.

## Fuera de alcance

- Tooltip en nodos que no sean field nodes de formulario (ej. `heading`, `button`, `paragraph`, `image`, etc.).
- Contenido rico dentro del tooltip (otros nodos, HTML, markdown).
- Popover con activación por click.
- Biblioteca de posicionamiento dinámico (Floating UI o similar).
- Configuración visual del tooltip desde JSON (posición, color, ancho).
- Tooltip en el nodo `hidden` (no tiene render visible ni label).

## Requisitos funcionales

### Contrato JSON

- `props.tooltip`: string opcional. Acepta literal, referencia dinámica completa o string visible interpolado con
  `{{...}}`.
- Cuando `props.tooltip` no está declarado o resuelve a string vacío tras la interpolación, no se renderiza ningún icono
  ni tooltip.

### Comportamiento visual

- Cuando `props.tooltip` resuelve a un string no vacío, se renderiza un icono de información (Lucide `HelpCircle`) junto
  al texto del label.
- El icono se posiciona inmediatamente después del texto del label, en la misma línea.
- En `radioGroup` y `checkboxGroup`, el icono acompaña al texto del `<legend>` dentro del `<fieldset>`.
- En `toggle` con `labelPosition: inline`, el icono acompaña al label en su posición inline.

### Comportamiento interactivo

- El tooltip aparece al hacer hover sobre el icono.
- El tooltip aparece al hacer focus sobre el icono (navegación por teclado).
- El tooltip desaparece al retirar el cursor o al perder el foco.
- No hay delay artificial de entrada ni de salida.

### Posicionamiento

- El tooltip se posiciona con CSS `position: absolute` relativo a un contenedor con `position: relative` que envuelve el
  icono.
- Posición por defecto: encima del icono, centrado horizontalmente.
- El texto del tooltip se ajusta dentro de un ancho máximo razonable con word-wrap.

### Interpolación

- `props.tooltip` soporta `{{translations.someKey}}`, `{{params.someParam}}`, `{{forms.someForm.someField}}`,
  `{{queries.someQuery.data.somePath}}` y cualquier otra familia de referencia soportada por el runtime en strings
  visibles.
- La resolución sigue las mismas reglas que `props.label`: si un placeholder no resuelve, se sustituye por string vacío
  sin romper el resto del texto.

## Requisitos no funcionales

### Accesibilidad

- El icono debe ser focusable por teclado (`tabindex="0"` o elemento nativo focusable).
- El icono debe declarar `aria-label` descriptivo (ej. `"Help"`) para lectores de pantalla.
- El contenido del tooltip debe estar asociado al icono vía `aria-describedby` para que el texto sea accesible sin
  depender del hover.
- El tooltip debe usar `role="tooltip"` en el elemento flotante.

### Rendimiento

- Cuando `props.tooltip` no está declarado, el render del campo no debe incluir ningún elemento adicional ni listener de
  eventos.

### Consistencia visual

- El icono y el tooltip deben compartir el mismo aspecto visual en los siete field nodes.
- El estilo del tooltip se implementa con utilidades de Tailwind CSS, sin estilos inline ni tokens visuales nuevos.

## Criterios de aceptación

1. Cada uno de los siete field nodes (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`,
   `fileInput`) renderiza un icono de ayuda junto al label cuando `props.tooltip` contiene un string no vacío.
2. No se renderiza icono ni tooltip cuando `props.tooltip` no está declarado.
3. No se renderiza icono ni tooltip cuando `props.tooltip` resuelve a string vacío tras la interpolación.
4. Hacer hover sobre el icono muestra el texto del tooltip.
5. Hacer focus sobre el icono (tab) muestra el texto del tooltip.
6. El contenido del tooltip interpola correctamente `{{...}}` con las mismas reglas que `props.label`.
7. El tooltip es accesible: el icono es focusable, tiene `aria-label`, el tooltip tiene `role="tooltip"` y la asociación
   `aria-describedby` está presente.
8. La validación de config rechaza `props.tooltip` cuando el valor no es string.
9. La validación de config acepta field nodes sin `props.tooltip` sin regresión.
10. El tooltip no afecta al valor, validación ni submit del campo.

## Casos límite

- `tooltip: ""` (string vacío literal): se trata como ausente; no se renderiza icono.
- `tooltip: "{{translations.someKey}}"` donde la clave no existe: sigue el fallback estándar del runtime (clave literal
  en dev, string vacío en producción). Si el resultado final es vacío, no se renderiza icono.
- Campo oculto por `visibility` o `queryStateFeedback`: el tooltip se oculta junto con el campo.
- Texto de tooltip largo: se ajusta con word-wrap dentro de un `max-width` razonable definido por Tailwind.
- `input` con `props.icon` declarado: el tooltip no interfiere con el icono del campo; el icono de ayuda acompaña al
  label, no al control.
- `toggle` con `labelPosition: inline`: el icono de ayuda se posiciona junto al label en su posición inline, no junto al
  control switch.

## Riesgos o preguntas abiertas

Ninguno. El alcance está acotado a una prop simple en nodos existentes, sin cambio arquitectónico ni dependencia
externa.

## Áreas de producto afectadas

- Catálogo de nodos: fichas de los siete field nodes en `ai-workflow/docs/app-features/nodes/`.
- Formularios: mención de la nueva prop en `ai-workflow/docs/app-features/forms/` si procede.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/input.md`
- `ai-workflow/docs/app-features/nodes/textarea.md`
- `ai-workflow/docs/app-features/nodes/select.md`
- `ai-workflow/docs/app-features/nodes/choice-groups.md`
- `ai-workflow/docs/app-features/nodes/toggle.md`
- `ai-workflow/docs/app-features/nodes/file-input.md`
