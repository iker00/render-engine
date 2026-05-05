> Nota histórica: este diseño se apoya en la semántica compartida de `queryStateFeedback`. Desde `0016-query-state-feedback-idle-state`, esa semántica visible ya no es `loading | error | empty | success`, sino `idle | loading | error | empty | success`.

# Design: Declarative form node catalog

## Contexto
La feature `0006` ya dejó estable el dominio compartido `forms` con almacenamiento por `forms.{formId}.{fieldId}`, `defaultValue`, `error`, `touched`, `dirty` y reset por formulario. La feature `0014` ya dejó una base común de acciones UI reutilizable desde nodos interactivos. Lo que falta es conectar ambas piezas con una frontera declarativa real dentro de `pages[].layout`.

Sin diseño previo, esta feature deja abiertas varias divergencias peligrosas:
- cómo se representa el catálogo de nodos `form`, `input`, `textarea` y `select` sin romper el contrato estable del runtime
- dónde vive la herencia implícita de `form.id` para que los campos no declaren `formId`
- cómo se resuelven `defaultValue` dinámicos sin sobrescribir estado ya escrito por el usuario
- cómo se evita que un campo oculto por `queryStateFeedback` siga bloqueando el submit por `required`
- cómo conviven los botones auxiliares con la semántica nativa de submit de un `<form>` real

## Objetivos / No objetivos

### Objetivos
- Añadir `form` como contenedor declarativo propietario de `form.id`, inicialización de campos y submit básico.
- Añadir un catálogo inicial de campos con `input`, `textarea` y `select`.
- Reutilizar exclusivamente el dominio compartido `forms` ya existente en el store.
- Reutilizar `executeOperation` como única acción de submit en esta iteración.
- Mantener `queryStateFeedback` operativo también sobre `form` y los nuevos campos.
- Cerrar antes del render todas las validaciones estructurales y semánticas que el config sí puede resolver.

### No objetivos
- Abrir `radioGroup`, `checkboxGroup`, subida de archivos o catálogos dinámicos de opciones.
- Introducir validaciones declarativas avanzadas más allá de `required`.
- Añadir un subsistema general de eventos, callbacks por éxito/error o secuencias de acciones.
- Redefinir la política global de persistencia de formularios entre páginas.
- Introducir theming, layout específico complejo o una capa visual configurable para controles.

## Decisiones

### 1. `form` será el único nodo propietario de identidad y submit; los campos heredan contexto
El contrato debe introducir estos nodos nuevos:
- `form`
- `input`
- `textarea`
- `select`

`form.id` será el identificador declarativo estable del formulario. Los campos no declararán `formId`; lo heredarán siempre del `form` contenedor.

`form.children` reutilizará la colección ordenada del runtime y, en esta iteración, solo admitirá:
- `input`
- `textarea`
- `select`
- `button`
- `heading`
- `paragraph`
- `container`

La regla de ancestry debe aplicarse sobre todo el subárbol del `form`, no solo sobre sus hijos directos:
- `input`, `textarea` y `select` son válidos en cualquier descendiente de un `form`
- un `button` sin `action` es válido en cualquier descendiente de un `form`
- un `container` dentro de un `form` puede agrupar campos y botones, pero no abre un nuevo contexto de formulario

Razonamiento:
- evita duplicar `formId` en cada campo
- hace que la estructura sea fácil de serializar desde backend
- mantiene a `form` como borde natural para inicialización, validación y submit

### 2. El contrato de `button` pasa a admitir `action` opcional, pero solo dentro de un `form`
Para soportar submit nativo declarativo, `button.props.action` debe dejar de ser obligatoria a nivel estructural. La validación semántica debe cerrar esta regla:
- un `button` sin `action` dentro de `form.children` es válido y se interpreta como submit del formulario contenedor
- un `button` sin `action` fuera de un `form` es inválido
- un `button` con `action` explícita sigue siendo un botón auxiliar y no un submit implícito

Razonamiento:
- permite soportar Enter y submit real sin crear un nodo `submitButton` nuevo
- conserva una única clave pública `action` para los botones auxiliares
- evita dejar al renderer la decisión de si un botón sin `action` es válido o no

### 3. La validación previa al render debe recorrer el árbol con contexto de formulario
La validación estructural con `Zod` debe ampliarse para reconocer el shape de `form`, `input`, `textarea` y `select`, pero varias reglas relevantes exigen una pasada semántica adicional con contexto:
- `form.id` debe ser único en toda la configuración
- `fieldId` debe ser único dentro de cada `form`
- `input`, `textarea` y `select` fuera de un `form` son inválidos
- `button` sin `action` fuera de un `form` es inválido
- `resetOnSuccess: true` sin `submitAction` es inválido
- `submitAction.operationName` debe apuntar a una operación existente en `api`
- `select.props.items` debe usar valores homogéneos `string` o `number` dentro del mismo campo
- `defaultValue` de `select` no necesita coincidir en bootstrap con una opción concreta si es dinámico; ese ajuste pertenece al runtime de inicialización

Razonamiento:
- el contrato ya no puede validarse correctamente solo por nodo aislado
- `form` introduce reglas de ancestry y unicidad que deben cerrarse antes del render
- mantener esta lógica en bootstrap evita errores recuperables tardíos dentro del renderer

### 4. La inicialización declarativa seguirá siendo lazy y vivirá en el `form`
La primera renderización de un `form` debe resolver una definición de campos con sus `defaultValue` efectivos y llamar a `initializeForm(formId, fields)` una sola vez por campo ausente.

Semántica fijada:
- si `forms.{formId}.{fieldId}` no existe, el campo se inicializa
- si ya existe, el runtime conserva su estado actual
- si `defaultValue` es una referencia dinámica, se resuelve con el snapshot visible en ese primer momento
- ese valor resuelto pasa a ser la base persistente para `resetForm(formId)`
- si el valor resuelto de un `select` no coincide con ninguna opción, el campo se inicializa vacío

Razonamiento:
- reutiliza exactamente el dominio compartido ya estable
- evita rehidratar datos tardíos y sobrescribir entradas del usuario
- deja el reset alineado con la semántica existente del reducer

### 5. Los valores de `select` se normalizan a string en el borde del nodo
`select` aceptará opciones estáticas `{ label, value }` con `value` homogéneo `string` o `number`. En runtime:
- los valores numéricos declarados se normalizan a string para compararse y almacenarse
- el valor vacío seguirá representándose como `''`
- el `defaultValue` resuelto se compara ya normalizado contra las opciones disponibles

Razonamiento:
- el DOM trabaja con strings para `<select>`
- centralizar la normalización evita divergencias entre inicialización, cambio del usuario, validación y reset

### 6. La visibilidad efectiva del campo debe reutilizar la misma semántica de `queryStateFeedback`
La spec exige que un campo oculto por `queryStateFeedback` no bloquee el submit aunque conserve error previo. Para no duplicar reglas, la implementación debe introducir una utilidad compartida que:
- derive si un nodo está visible o no a partir de `queryStateFeedback`
- reutilice exactamente la semántica ya estable de `idle | loading | error | empty | success`
- pueda usarse tanto desde el renderer central como desde la validación del submit del formulario

Razonamiento:
- evita que renderer y submit calculen visibilidad de forma distinta
- mantiene una única fuente de verdad para el comportamiento de ocultación

### 7. La validación `required` vive en la capa de formulario y escribe solo en `forms`
La primera iteración solo debe validar `required`.

Semántica fijada:
- `input` y `textarea` son inválidos cuando su valor efectivo es `''` o solo espacios
- `select` es inválido cuando su valor efectivo es `''`
- solo los campos actualmente visibles pueden bloquear el submit
- los errores se escriben en `forms.{formId}.{fieldId}.error`
- cuando un campo con error vuelve a un valor válido, el error se limpia al cambiar sin exigir otro submit

Razonamiento:
- evita crear un dominio paralelo de errores de formulario
- conserva la UX mínima pedida por la spec sin abrir un subsistema de validación general

### 8. El submit real se resuelve en el nodo `form`, no en el botón
`form` debe renderizar un `<form>` real y manejar `onSubmit`. El flujo esperado es:
1. prevenir el submit HTML nativo
2. validar campos visibles `required`
3. si hay errores, escribirlos en `forms` y abortar
4. si el formulario declara `submitAction`, ejecutar `executeQueryOperation(operationName)`
5. si la operación termina con éxito y `resetOnSuccess` es `true`, llamar a `resetForm(formId)`
6. si falla, conservar valores y errores actuales

Antes de conectar `executeOperation`, la propia capa `form` debe poder ejecutar este mismo `onSubmit` en modo local:
- prevenir el submit nativo
- validar `required`
- escribir o limpiar errores en `forms`
- abortar siempre antes de tocar red mientras `submitAction` siga fuera del alcance de la tarea

La validación y el submit no deben leer un snapshot stale del store. La implementación debe basarse en el estado más reciente disponible en el mismo tick de interacción, de forma que un cambio de campo seguido inmediatamente de submit no valide ni envíe el valor anterior.

Los botones dentro del formulario quedan así:
- sin `action`: `type="submit"`
- con `action`: `type="button"` y delegan al ejecutor común existente

Razonamiento:
- respeta la semántica nativa del elemento `<form>`
- mantiene al botón como trigger mínimo
- evita mezclar lógica de submit con acciones auxiliares

### 9. No se introduce un estado efímero nuevo de submit
El resultado visible del submit debe seguir viviendo únicamente en `queries.{operationName}`. El formulario no abrirá un dominio paralelo de:
- `submitting`
- `submitError`
- `submitSuccess`

Razonamiento:
- la feature `0014` ya fijó que `executeOperation` proyecta su efecto visible en `queries`
- evita duplicar fuentes de verdad y reabrir la semántica de feedback

## Riesgos y trade-offs
- Riesgo: mezclar visibilidad declarativa y validación en dos implementaciones distintas.
  Mitigación: extraer una utilidad compartida de visibilidad efectiva por nodo.

- Riesgo: sobrescribir datos del usuario al re-renderizar formularios con `defaultValue` dinámicos.
  Mitigación: inicialización lazy por campo solo cuando el estado todavía no exista.

- Riesgo: dejar ambigua la diferencia entre botón submit y botón auxiliar.
  Mitigación: `button` sin `action` solo vale dentro de `form` y se renderiza como `submit`; con `action` siempre es auxiliar.

- Riesgo: introducir validaciones semánticas imposibles de cerrar solo con `Zod`.
  Mitigación: añadir una pasada recursiva posterior al parseo con contexto de formulario, unicidad y targets de `api`.

- Riesgo: abrir demasiado pronto una abstracción global de formularios.
  Mitigación: mantener todo el alcance dentro de `src/config/`, `src/runtime/nodes/` y el store existente, con helpers puntuales pero sin subsistema nuevo independiente.

## Migración o despliegue
No hay migración persistida.

Compatibilidad esperada:
- las configuraciones sin nodos `form` siguen siendo válidas y conservan el comportamiento actual
- la semántica estable de `queries`, `resetForm` y referencias `forms.*` no cambia
- el contrato de `button` se amplía, pero no rompe los botones existentes con `action`

## Preguntas abiertas
- No quedan preguntas abiertas que deban resolverse durante la implementación si se sigue esta partición.
- La ampliación a validaciones avanzadas, items dinámicos o nuevos tipos de campo queda explícitamente fuera de esta feature.
