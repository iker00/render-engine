# Spec: Declarative form validation rules

## Objetivo
Ampliar la validación declarativa de formularios con un primer conjunto útil de reglas locales adicionales a `required`, manteniendo la semántica actual de estado compartido, visibilidad y submit, y preparando el contrato para que en una iteración futura cada regla pueda incorporar un texto personalizado sin rediseñar otra vez la superficie JSON.

## Alcance
- Añadir una superficie declarativa común de validaciones en los campos de formulario ya soportados.
- Sustituir la declaración histórica de `required` por una superficie declarativa común de validaciones, conservando su misma semántica funcional.
- Introducir en esta iteración solo reglas locales y síncronas evaluables dentro del runtime:
  - `required`
  - `minLength`
  - `maxLength`
  - `min`
  - `max`
  - `minSelections`
  - `maxSelections`
- Hacer que el contrato de cada regla pueda crecer más adelante con metadatos adicionales, incluido texto personalizado por validación, sin mover la regla a otra ubicación del JSON.
- Mantener una única fuente de verdad para los errores de campo en `forms.{formId}.{fieldId}.error`.
- Mantener coherencia entre validación, visibilidad efectiva, limpieza de errores al editar y submit declarativo del formulario.

## Fuera de alcance
- Añadir validaciones remotas o asíncronas.
- Añadir validaciones cruzadas entre varios campos del mismo formulario.
- Introducir `pattern`, expresiones arbitrarias, validaciones compuestas complejas o scripting declarativo.
- Añadir mensajes personalizados efectivos en esta iteración; el contrato debe quedar preparado para ello, pero la capacidad visible sigue pudiendo apoyarse en mensajes por defecto del runtime.
- Extender `min` y `max` a `date`, `datetime-local` u otras familias con semántica temporal específica.
- Añadir reglas nuevas para `radioGroup`, `select` simple o tipos de campo futuros fuera del catálogo actual.
- Introducir un estado agregado nuevo de formulario como `isValid`, `submitErrors` o un dominio paralelo distinto de `forms.*` y `queries.*`.

## Requisitos funcionales
- Los campos de formulario declarativos deben poder expresar sus validaciones mediante una propiedad común orientada a crecimiento futuro, en lugar de seguir ampliando solo props sueltas por regla.
- La superficie declarativa nueva debe sustituir el `required` histórico como capacidad declarativa preferente; como la aplicación aún no está en producción, no hace falta conservar compatibilidad prolongada con una doble forma de declarar la misma regla.
- Cuando una regla admita configuración numérica o booleana, el contrato debe permitir una forma breve y también una forma extendida estable por regla para dejar espacio a metadatos futuros como texto personalizado.
- La regla `required` debe conservar la semántica vigente:
  - `input` y `textarea` siguen siendo inválidos con `''` o solo espacios
  - `select` simple y `radioGroup` siguen siendo inválidos con selección vacía
  - `checkboxGroup` y `select.multiple` siguen siendo inválidos con selección vacía
- `minLength` y `maxLength` deben aplicarse solo a campos textuales:
  - `input` con variantes textuales ya soportadas
  - `textarea`
- `minLength` y `maxLength` deben evaluar la longitud efectiva del valor actual del campo textual.
- `min` y `max` deben aplicarse solo a `input` con `inputType: 'number'`.
- `min` y `max` deben comparar contra el valor numérico efectivo capturado por el usuario sin abrir coerciones ambiguas sobre tipos no numéricos.
- `minSelections` y `maxSelections` deben aplicarse solo a `checkboxGroup` y `select` con `multiple: true`.
- `minSelections` y `maxSelections` deben contar solo las selecciones efectivamente válidas tras la normalización ya estable del catálogo de opciones.
- Si un campo queda oculto por `queryStateFeedback` o `visibility`, ninguna de sus reglas activas debe bloquear el submit mientras siga oculto.
- Si un campo vuelve a mostrarse, debe reincorporarse a la validación normal reutilizando su estado local ya existente.
- La validación completa del formulario debe seguir ejecutándose al hacer submit.
- Mientras el usuario edita un campo, el runtime no necesita revalidar todo el formulario, pero sí debe poder reevaluar de forma local un campo con error para limpiar ese error cuando ya cumpla sus reglas visibles.
- Cuando un campo incumpla varias reglas a la vez, el runtime debe producir un único error visible por campo con un orden determinista y revisable.
- La prioridad de evaluación debe ser estable para evitar mensajes erráticos entre renders y submits.
- Las configuraciones inválidas deben seguir rechazándose antes del render cuando una regla se use sobre un tipo de campo incompatible o con un shape no soportado.
- El submit declarativo debe seguir reutilizando los mismos valores de `forms.{formId}.{fieldId}` ya validados localmente, sin adaptadores adicionales por regla.

## Requisitos no funcionales
- La feature debe mantenerse dentro del alcance acotado de la v1: más capacidad real de validación sin convertirse todavía en un motor completo de reglas declarativas.
- La terminología debe seguir alineada con el proyecto actual: `form`, `fieldId`, `required`, `defaultValue`, `forms.*`, `select`, `checkboxGroup` y `submitAction`.
- El contrato debe seguir siendo producible desde backend legacy con un shape simple, explícito y razonablemente serializable.
- La solución debe preservar la separación actual entre contrato JSON, validación previa al render, runtime de formularios y estado compartido.
- La semántica debe seguir siendo coherente entre catálogo de campos, visibilidad efectiva, validación local y submit.
- La ampliación puede asumir una migración directa del contrato declarativo actual porque la aplicación aún no está en producción.
- La superficie declarativa nueva debe dejar una vía clara para incorporar mensajes personalizados por regla en el futuro sin duplicar contratos paralelos.

## Criterios de aceptación
- Dado un formulario migrado a la nueva superficie declarativa con una regla `required` equivalente, su comportamiento observable respecto a la validación actual no cambia.
- Dado un `input` textual con `minLength`, cuando el valor tenga menos caracteres de los exigidos, el submit se bloquea y el campo refleja error.
- Dado un `input` textual con `maxLength`, cuando el valor exceda el límite declarado, el submit se bloquea y el campo refleja error.
- Dado un `textarea` con `minLength` o `maxLength`, el runtime aplica la misma semántica estable de longitud que en un `input` textual.
- Dado un `input` con `inputType: 'number'` y `min`, si el valor efectivo es menor que el umbral, el submit se bloquea y el campo refleja error.
- Dado un `input` con `inputType: 'number'` y `max`, si el valor efectivo supera el umbral, el submit se bloquea y el campo refleja error.
- Dado un `checkboxGroup` con `minSelections`, si el usuario mantiene menos selecciones válidas que las exigidas, el submit se bloquea y el campo refleja error.
- Dado un `checkboxGroup` con `maxSelections`, si el usuario supera el máximo permitido, el submit se bloquea y el campo refleja error.
- Dado un `select` multiselección con `minSelections` o `maxSelections`, el runtime aplica exactamente la misma semántica cardinal que en `checkboxGroup`.
- Dado un campo con varias reglas declaradas y más de un incumplimiento simultáneo, el runtime muestra siempre una sola regla fallida según el mismo orden estable.
- Dado un campo con error por una regla local y una edición posterior que ya cumple esa regla, el error se limpia sin exigir un nuevo submit.
- Dado un campo oculto por `visibility` o `queryStateFeedback`, sus reglas dejan de bloquear el submit mientras siga oculto.
- Dada una configuración que usa `min` o `max` sobre un campo que no es `inputType: 'number'`, el config completo falla antes del render con diagnóstico trazable.
- Dada una configuración que usa `minSelections` o `maxSelections` sobre un campo que no es multiselección real, el config completo falla antes del render con diagnóstico trazable.
- Dada una configuración que usa una forma extendida por regla, esa forma se acepta con la misma semántica funcional que la forma breve equivalente.
- Dado un campo que hoy solo necesita mensajes por defecto, el contrato ya deja la regla ubicada en una frontera estable preparada para añadir texto personalizado por validación en una iteración posterior sin romper su ubicación ni su identidad.

## Casos límite
- Campo textual `required` y `minLength` al mismo tiempo cuando el valor actual está vacío o contiene solo espacios.
- Campo textual con `minLength` y `maxLength` declarados a la vez.
- Campo numérico con `min` y `max` declarados a la vez.
- Campo multiselección cuya colección efectiva pierde opciones y reduce automáticamente la selección actual antes del submit.
- Campo con error previo que pasa a ocultarse por `visibility` o `queryStateFeedback` antes del siguiente submit.
- Campo multiselección con `minSelections` o `maxSelections` y `defaultValue` parcialmente inválido respecto al catálogo efectivo.
- Configuraciones donde distintos formularios ya migrados combinan varias reglas nuevas con distinto orden declarado dentro de `validations`.
- Campo con forma breve en una regla y forma extendida en otra dentro del mismo `validations`, manteniendo una semántica única y no ambigua.

## Riesgos o decisiones cerradas
- La feature es transversal entre contrato JSON, validación previa al render, runtime de formularios y documentación funcional, por lo que requiere `design.md` antes de implementarse.
- La prioridad de evaluación entre reglas se cierra a favor del orden declarado de las validaciones dentro del propio contrato, porque `forms.{formId}.{fieldId}.error` sigue exponiendo un único error visible por campo.
- El `required` histórico deja de ser la forma objetivo y la implementación puede migrar la semántica a la nueva superficie común sin mantener una convivencia indefinida entre dos contratos paralelos.
- La forma extendida por regla debe quedar fijada desde esta iteración para permitir una clave futura de texto personalizado por validación sin volver a mover la regla de sitio ni rediseñar el shape base.
- Debe evitarse que esta feature derive silenciosamente en validaciones remotas, cruzadas o dependientes de datos externos, porque eso abriría un alcance distinto del solicitado.

## Áreas de producto afectadas
- Contrato de configuración
- Formularios y validación
- Runtime UI configurable

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
