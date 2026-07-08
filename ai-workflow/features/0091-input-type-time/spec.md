# Feature 0091 — Input type time

## Objetivo

Ampliar el catálogo de `inputType` del nodo `input` con el valor `time` para permitir la entrada de horas mediante el selector nativo del navegador.

## Alcance

- Añadir `time` al enum cerrado de `props.inputType`.
- Renderizar `<input type="time">` con el mismo tratamiento visual y de accesibilidad que el resto de `inputType` soportados.
- Almacenar el valor como string en `forms.{formId}.{fieldId}` con el formato nativo del navegador (`HH:MM`).
- Soportar `defaultValue` literal o referencia dinámica, igual que el resto de tipos.
- Soportar `props.validations.required` con la misma semántica que los demás tipos textuales (valor vacío `''` se considera inválido).
- Soportar `props.icon` y `props.iconPosition` con el mismo comportamiento que el resto de `inputType`.
- Validar en `src/config/` que `time` es un valor válido del enum; rechazar el config completo si no lo es (comportamiento ya existente para valores fuera del catálogo).

## Fuera de alcance

- Validaciones `min`/`max` para rangos horarios. Actualmente solo aplican a `inputType: 'number'`, y ni `date` ni `datetime-local` las soportan. Si se necesitan en el futuro, deben abrirse como feature separada que extienda `min`/`max` a tipos temporales.
- Validaciones `minLength`/`maxLength`. No aplican a tipos no textuales.
- Atributo `step` para controlar el intervalo del selector.
- Formato de visualización configurable (12h/24h). El navegador aplica el formato según el locale del usuario.
- Segundos en el valor (`HH:MM:SS`). Se acepta el formato estándar del navegador, que es `HH:MM` salvo que `step` lo cambie (y `step` está fuera de alcance).

## Requisitos funcionales

1. El enum `props.inputType` pasa de `text | email | password | search | tel | url | number | date | datetime-local` a `text | email | password | search | tel | url | number | date | datetime-local | time`.
2. Cuando `inputType` es `time`, el nodo renderiza `<input type="time">` con el mismo wrapper visual, label, placeholder, icono y feedback de error que cualquier otro tipo.
3. El valor se lee y escribe en `forms.{formId}.{fieldId}` como string. Un campo vacío almacena `''`.
4. `defaultValue` acepta un literal string (ej. `"09:00"`) o una referencia dinámica resoluble a string.
5. La validación `required` aplica con la misma semántica: `''` y strings de solo espacios se consideran inválidos.
6. Las validaciones `minLength`, `maxLength`, `min` y `max` no aplican a `time` y deben ignorarse si se declaran (mismo comportamiento que para `date` y `datetime-local`).

## Requisitos no funcionales

- Sin dependencias nuevas.
- Sin impacto en el bundle más allá de la ampliación del enum en el esquema Zod y el literal en el tipo.
- Los tests deben cubrir render, validación de config y comportamiento de formulario con el mismo nivel de detalle que los tipos existentes.

## Criterios de aceptación

1. Un JSON de configuración con `inputType: "time"` pasa la validación y renderiza un `<input type="time">`.
2. Un JSON con `inputType: "reloj"` (u otro valor no soportado) sigue siendo rechazado antes del render.
3. El valor seleccionado por el usuario queda almacenado en `forms.{formId}.{fieldId}` como string `HH:MM`.
4. `defaultValue: "14:30"` precarga el campo con la hora indicada.
5. Un campo `time` con `required` y valor vacío bloquea el submit y muestra el mensaje de error.
6. El campo soporta `icon` y `iconPosition` con el mismo comportamiento visual que el resto de tipos.
7. El control renderiza `id`, `aria-describedby` y vinculación con el span de error con el mismo patrón estable que el resto de inputs.

## Casos límite

- `defaultValue` con formato distinto a `HH:MM` (ej. `"9:00"`, `"25:00"`): se pasa tal cual al `<input type="time">` nativo y el navegador decide cómo interpretarlo; el runtime no valida el formato del valor.
- `defaultValue` como referencia dinámica que resuelve a un valor no temporal: se trata como cualquier otro `defaultValue` no resoluble (string vacío o el literal resuelto).
- Interacción con `visibility` y `queryStateFeedback`: sin cambio respecto al comportamiento transversal existente.

## Riesgos o preguntas abiertas

Ninguno. El patrón de extensión está bien establecido con `date` y `datetime-local`.
