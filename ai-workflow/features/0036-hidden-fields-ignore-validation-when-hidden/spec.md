# Spec: Hidden fields ignore validation while hidden

## Objetivo
Corregir el comportamiento de validación de formularios para que un campo oculto no se valide ni bloquee el submit mientras siga oculto, incluso si conserva un error previo en su estado local.

## Alcance
- Corregir la semántica observable de submit en formularios con campos ocultos por `visibility`.
- Corregir la misma semántica cuando el campo quede oculto por `queryStateFeedback`.
- Corregir la misma semántica cuando el campo quede oculto indirectamente porque un contenedor ancestro deja de renderizarse por `visibility` o `queryStateFeedback`.
- Mantener la conservación del estado local del campo oculto, incluidos `value`, `error`, `dirty`, `touched` y `defaultValue`.
- Asegurar que el submit del formulario solo tenga en cuenta los campos efectivamente visibles en el momento de validar.
- Asegurar que un error ya almacenado en un campo que pasa a ocultarse deje de bloquear el submit mientras el campo permanezca oculto.

## Fuera de alcance
- Cambiar la política de persistencia del estado local de un campo al ocultarse o volver a mostrarse.
- Introducir un reseteo automático de errores al ocultar un campo.
- Añadir nuevas reglas declarativas de validación o nuevos tipos de campo.
- Cambiar la semántica general de `defaultValue`, `resetForm`, `persistOnUnmount` o submit remoto.
- Añadir un estado agregado nuevo de formulario como `isValid` o un dominio separado de errores.

## Requisitos funcionales
- Si un campo de formulario está oculto en el momento del submit, el runtime no debe evaluarlo dentro de la pasada de validación del formulario.
- Si un campo oculto conserva un error previo en `forms.{formId}.{fieldId}.error`, ese error no debe bloquear el submit mientras el campo siga oculto.
- La exclusión de validación debe aplicarse con la misma semántica tanto para campos ocultos por `visibility` como para campos ocultos por `queryStateFeedback`.
- La misma exclusión debe aplicarse cuando el campo permanezca dentro de una rama oculta porque cualquiera de sus ancestros visibles en layout haya quedado en modo oculto.
- La decisión sobre si un campo participa o no en la validación debe reutilizar la misma visibilidad efectiva ya usada por el renderer del runtime.
- Un campo que pasa de visible a oculto debe conservar su estado local existente.
- Un campo que vuelve de oculto a visible debe recuperar su estado local existente y volver a participar en la validación normal desde ese momento.
- Si un campo oculto vuelve a hacerse visible y sigue incumpliendo sus reglas declaradas, el siguiente submit debe volver a bloquearse por ese campo.
- El comportamiento debe ser coherente tanto cuando el campo ya estaba oculto antes del primer submit como cuando se oculta después de haber generado un error visible en un submit anterior.
- El resto de campos visibles del formulario debe mantener intacta su semántica actual de validación, error visible y bloqueo de submit.

## Requisitos no funcionales
- La corrección debe restaurar la semántica ya documentada del producto sin ampliar el alcance del motor de formularios.
- La regla debe ser consistente y comprobable para cualquier campo soportado del catálogo actual.
- El comportamiento debe seguir siendo coherente entre renderer, visibilidad efectiva, validación local y submit.
- La spec debe mantener la frontera de producto: corregir la exclusión de campos ocultos sin rediseñar el sistema de errores ni el contrato JSON.

## Áreas de producto afectadas
- Formularios y validación.
- Reglas de visibilidad declarativa.
- Feedback ligado al estado visible de queries cuando afecta a campos de formulario.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`

## Criterios de aceptación
- Dado un campo `required` oculto por `visibility`, el formulario puede enviarse si el resto de campos visibles son válidos.
- Dado un campo `required` oculto por `queryStateFeedback`, el formulario puede enviarse si el resto de campos visibles son válidos.
- Dado un campo `required` visible solo dentro de un contenedor que pasa a estar oculto por `visibility` o `queryStateFeedback`, el formulario puede enviarse si el resto de campos efectivamente visibles son válidos.
- Dado un campo que era visible, falló validación y guardó error en su estado local, si después pasa a ocultarse, ese error deja de bloquear el siguiente submit.
- Dado un formulario con varios campos, ocultar uno con error no altera la validación de los demás campos visibles.
- Dado un campo oculto que vuelve a mostrarse con un valor aún inválido, vuelve a bloquear el submit en la siguiente validación del formulario.
- Dado un campo oculto con valor válido o con error previo ya resuelto, al volver a mostrarse reaparece con su estado local conservado.
- Dado un formulario donde un campo permanece oculto durante toda la interacción, ese campo no genera un bloqueo de submit por sus reglas declaradas mientras siga oculto.
- Dado un formulario con una mezcla de campos visibles y ocultos por mecanismos distintos, solo participan en la validación los que estén efectivamente visibles en ese momento.

## Casos límite
- Campo oculto antes del primer submit y sin estado inicial todavía creado.
- Campo que se oculta después de haber recibido un error por `required`.
- Campo oculto por `visibility` que vuelve a mostrarse varias veces durante la misma sesión del formulario.
- Campo oculto por `queryStateFeedback.states.idle` antes de la primera ejecución de la query observada.
- Campo visible en sí mismo pero anidado dentro de uno o varios contenedores ancestro que dejan de renderizarse.
- Formulario con varios campos ocultos simultáneamente, algunos con error previo y otros sin error previo.
- Campo cuyo valor ya no coincide con el catálogo efectivo al volver a mostrarse tras un cambio de opciones dinámicas.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes; el comportamiento esperado ya está alineado con la documentación vigente de formularios y visibilidad.
- Riesgo bajo: es una corrección acotada de semántica observable, pero conviene comprobar que la misma utilidad de visibilidad siga siendo la única fuente de verdad entre render y validación.
