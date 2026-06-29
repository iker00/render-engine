# Spec: mensajes de error personalizados en validaciones de formulario

## Objetivo

Permitir que cada regla de validación de formulario declare un mensaje de error personalizado que sustituya al mensaje
por defecto del runtime, con soporte de interpolación de `{{value}}` (valor de la regla) y `{{translations.*}}` (
catálogo de traducciones existente).

## Alcance

- Aplica a todas las reglas del catálogo actual: `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`,
  `maxSelections`.
- Aplica a todos los tipos de campo de formulario: `input`, `textarea`, `select` simple, `select` múltiple,
  `radioGroup`, `checkboxGroup`.
- El campo `message` ya existe en el contrato TypeScript de cada regla; esta feature lo activa funcionalmente.

## Fuera de alcance

- Validaciones del nodo `fileManager` (sistema de error independiente; sin cambios).
- Referencias dinámicas distintas de `{{value}}` y `{{translations.*}}` en el mensaje (`forms.*`, `queries.*`,
  `params.*`, `item.*`).
- Validaciones remotas o cruzadas entre campos.
- Cambios en el shape del contrato JSON (`message` ya existe como campo opcional en cada regla).
- Mensajes personalizados globales por tipo de regla fuera de la declaración por campo.

## Requisitos funcionales

1. Cuando una regla falla y su `message` está presente, el runtime muestra ese mensaje en lugar del texto por defecto.
2. Si `message` no está presente en una regla, el comportamiento es idéntico al actual: se muestra el mensaje por
   defecto del runtime.
3. Antes de mostrar el mensaje, el runtime interpola:
    - `{{value}}`: sustituido por el valor declarado en la regla, convertido a string. Si la regla no tiene un valor
      numérico significativo (e.g., `required` con `value: true`), `{{value}}` se trata como string vacío.
    - `{{translations.someKey}}`: resuelto mediante el catálogo de traducciones y la cadena de fallback existente (
      idioma activo → idioma por defecto → clave en desarrollo / string vacío en producción).
4. Un mensaje puede contener `{{value}}`, `{{translations.someKey}}`, ambos, o ninguno.
5. Placeholders `{{...}}` no soportados (e.g., `{{forms.myForm.name}}`) producen string vacío para ese placeholder, sin
   romper el resto del mensaje ni el comportamiento del formulario.
6. La lógica de cuándo valida, qué regla tiene prioridad y dónde vive el error (`forms.{formId}.{fieldId}.error`) no
   cambia.

## Requisitos no funcionales

- La interpolación no debe penalizar el rendimiento de la validación en formularios sin mensajes personalizados.
- El comportamiento de degradación ante placeholders desconocidos debe ser coherente con la semántica existente de
  `dynamic-strings.md`.

## Criterios de aceptación

1. Un campo con `validations.minLength: { value: 3, message: "Mínimo {{value}} caracteres" }` muestra "Mínimo 3
   caracteres" al fallar.
2. Un campo con `validations.required: { value: true, message: "Este campo es obligatorio" }` muestra "Este campo es
   obligatorio" al fallar.
3. Un campo con `validations.required: { value: true, message: "{{value}} es requerido" }` muestra " es requerido" (
   placeholder vacío por ausencia de valor numérico).
4. Un campo con `validations.maxLength: { value: 100, message: "{{translations.max_length_error}}" }` muestra la cadena
   resuelta del catálogo de traducciones para el idioma activo.
5. Un campo con `validations.min: { value: 5, message: "Mínimo {{value}}" }` muestra "Mínimo 5".
6. Si `message` no está declarado en una regla, el error mostrado es el mensaje por defecto del runtime; el
   comportamiento es idéntico al actual.
7. La validación inline al editar (reevaluación del campo con error) también muestra el mensaje personalizado cuando
   corresponde.
8. Los campos sin mensaje personalizado en ninguna de sus reglas no ven cambios de comportamiento ni de rendimiento
   observable.
9. El nodo `fileManager` no se ve afectado.

## Casos límite

- `message: ""` (string vacío): se muestra string vacío como error; no se usa el mensaje por defecto. Es válido
  declararlo aunque el resultado visible sea vacío.
- Múltiples `{{value}}` en el mismo mensaje: cada ocurrencia se reemplaza por el mismo valor.
- `message` con solo `{{value}}` y sin texto literal: muestra únicamente el valor stringificado.
- Traducción no encontrada para `{{translations.someKey}}`: sigue la cadena de fallback existente del sistema de
  traducciones (clave en desarrollo, string vacío en producción).
- Regla con `value: 0` (e.g., `minLength: { value: 0 }`): `{{value}}` se sustituye por `"0"`.

## Áreas de producto afectadas

- `forms/` — lógica de validación y display de errores de formulario.
- `references/` — sistema de interpolación `{{...}}` y resolución de `translations.*`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/forms/validation-rules.md` — activar la sección de `message` y documentar la semántica
  de interpolación.

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de alcance, interpolación e i18n quedan cerradas en la conversación de exploración previa.
