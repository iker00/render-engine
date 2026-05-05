> Nota histórica: esta spec depende de la semántica compartida de `queryStateFeedback`. Desde `0016-query-state-feedback-idle-state`, el estado visible previo a la primera ejecución de una query es `idle`, no `loading`.

# Spec: Declarative form node catalog

## Objetivo
Introducir una frontera declarativa mínima pero útil para formularios dentro del árbol `pages[].layout`, de forma que el runtime pueda renderizar formularios reales desde JSON, inicializar su estado compartido por `forms.{formId}.{fieldId}` y ejecutar un submit básico sin depender de componentes React específicos por caso de uso.

## Alcance
- Añadir `form` al catálogo declarativo soportado por el runtime.
- Añadir un catálogo inicial de campos declarativos compuesto por `input`, `textarea` y `select`.
- Mantener `form` como contenedor propietario del `formId`, de la inicialización del estado y del submit declarativo del formulario.
- Reutilizar el dominio `forms` ya existente en el store compartido del runtime, sin crear un estado paralelo.
- Permitir `defaultValue` literal o dinámico mediante referencias completas ya soportadas por el runtime.
- Soportar validación declarativa básica limitada a `required`.
- Permitir submit declarativo mínimo mediante `submitAction` con `type: executeOperation`.
- Permitir `resetOnSuccess` como comportamiento opcional tras un submit exitoso.
- Mantener el comportamiento nativo relevante de un `<form>` real, incluyendo envío con Enter cuando aplique.
- Permitir `queryStateFeedback` también sobre `form`, `input`, `textarea` y `select`.

## Fuera de alcance
- Añadir `radioGroup`, `checkboxGroup`, subida de archivos u otros tipos de campo fuera de `input`, `textarea` y `select`.
- Soportar items dinámicos en `select` o abrir todavía catálogos dinámicos de opciones.
- Introducir validación declarativa avanzada como `min`, `max`, patrones, validaciones cruzadas o mensajes personalizados complejos.
- Introducir visibilidad condicional de campos o secciones del formulario.
- Soportar secuencias de acciones, follow-ups por éxito o error, callbacks declarativos o branching en el submit.
- Resolver una política nueva de limpieza global de formularios al cambiar de página.
- Añadir theming, layout avanzado específico de formularios o un sistema visual configurable para controles.

## Requisitos funcionales
- El runtime debe aceptar un nodo `form` dentro de `layout` y renderizarlo como un `<form>` real.
- `form.id` debe ser único dentro de toda la configuración declarativa.
- Cada nodo `form` debe declarar un identificador estable propio mediante `form.id`.
- Los campos declarados dentro de un `form` deben escribir y leer su estado únicamente bajo `forms.{formId}.{fieldId}`.
- `form` debe reutilizar `children` como colección ordenada del runtime y admitir en esta iteración `input`, `textarea`, `select`, `button`, `heading`, `paragraph` y `container`.
- Los campos no deben declarar `formId`; ese vínculo debe heredarse siempre del `form` contenedor.
- Repetir el mismo `fieldId` dentro de un mismo `form` debe tratarse como error de validación previa al render.
- El catálogo inicial de campos debe incluir como base común:
  - `fieldId`
  - `label`
  - `required`
  - `defaultValue`
- `input` debe cubrir entrada de una sola línea y limitar esta iteración a variantes textuales comunes de v1.
- `textarea` debe cubrir entrada multilínea.
- `select` debe aceptar únicamente una colección estática de opciones con forma `{ label, value }`.
- `select` puede usar valores `string` o `number`; si llega un valor numérico, el runtime debe normalizarlo a string para compararlo y almacenarlo.
- Dentro de un mismo `select`, los valores declarados deben mantener un tipo consistente para evitar configuraciones ambiguas.
- `select` puede incluir opciones con `label` vacío.
- La inicialización declarativa de un campo debe ocurrir solo cuando `forms.{formId}.{fieldId}` todavía no exista en la instancia activa del runtime.
- En esa primera inicialización, el valor efectivo del campo debe tomarse de `defaultValue` si existe; si no existe, debe usarse un valor vacío coherente con el tipo de control.
- Si `defaultValue` es dinámico, su valor efectivo debe resolverse en el momento de la primera inicialización del campo y quedar fijado como base de esa instancia hasta que una acción explícita cambie el estado.
- Si el valor resuelto para `defaultValue` de un `select` no coincide con ninguna opción disponible, el campo debe quedar vacío.
- Si el usuario ya escribió en un campo y el formulario vuelve a renderizarse, cambia de página y regresa o reaparece dentro de la misma instancia, el runtime debe conservar el valor actual y no sobrescribirlo con el `defaultValue` declarado.
- El reset por formulario debe seguir restaurando el estado inicial efectivo de cada campo ya inicializado, usando el `defaultValue` resuelto durante su primera inicialización.
- La validación declarativa inicial debe limitarse a `required` y debe impedir el submit cuando exista al menos un campo visible obligatorio sin valor válido.
- Para `input` y `textarea`, `required` debe considerar inválido tanto el string vacío como un valor compuesto solo por espacios.
- Para `select`, `required` debe considerar inválido el valor vacío aunque exista una opción placeholder visible.
- Cuando el submit quede bloqueado por `required`, el runtime debe marcar error de formulario a nivel de campo sin inventar un dominio paralelo distinto del ya previsto en `forms`.
- Cuando un campo con error vuelva a tener un valor válido, el error debe desaparecer sin exigir un nuevo intento de submit.
- El nodo `form` debe poder declarar `submitAction` y, en esta iteración, esa acción debe limitarse a `type: executeOperation`.
- Si `resetOnSuccess: true` aparece sin `submitAction`, la configuración debe fallar en validación previa al render.
- El payload del submit debe poder reutilizar referencias ya soportadas en `api.body`, por ejemplo `forms.userForm.email`, sin abrir una sintaxis nueva específica del formulario.
- Si un `form` declara `submitAction`, el envío del formulario debe dispararse tanto por Enter cuando aplique como por controles de submit declarados dentro de `children`.
- Dentro de `form.children`, un `button` sin `action` propia debe actuar como trigger de submit del formulario contenedor.
- Dentro de `form.children`, un `button` con `action` explícita debe seguir comportándose como acción auxiliar y no debe convertirse implícitamente en submit.
- Un `button` sin `action` fuera de un `form` debe tratarse como configuración inválida y dejar diagnóstico visible en desarrollo.
- Si el submit declarativo termina con éxito y `resetOnSuccess` está activado, el runtime debe resetear ese formulario usando la misma semántica estable de reset por `formId`.
- Si el submit falla, el formulario debe conservar los valores actuales del usuario y no resetearse automáticamente.
- El `submitAction` del `form` puede convivir con botones internos que disparen otras `action` auxiliares distintas.
- Ocultar un `form` o un campo mediante `queryStateFeedback` no debe borrar su estado ni sus errores ya existentes.
- Mientras un campo permanezca oculto por `queryStateFeedback`, no debe bloquear el submit del formulario aunque conserve un error previo.
- Una configuración que no use nodos `form` debe seguir comportándose como hoy sin exigir migraciones colaterales.

## Requisitos no funcionales
- La feature debe mantener el alcance acotado de v1: abrir una frontera útil de formularios sin convertirse todavía en un motor completo de formularios dinámicos.
- La terminología debe mantenerse alineada con el vocabulario vigente del proyecto: `form`, `fieldId`, `defaultValue`, `submitAction`, `executeOperation`, `resetOnSuccess`, `forms.*` y `api`.
- El contrato debe seguir siendo razonablemente simple de producir desde backend legacy, evitando estructuras profundas o reglas implícitas difíciles de serializar.
- La solución debe preservar la separación ya marcada por la arquitectura entre contrato JSON, validación previa al render, renderer y estado compartido.
- La validación del config debe seguir siendo previa al render, diagnóstica en desarrollo y coherente con rutas canónicas del JSON afectado.
- El render de los controles debe mantener una base accesible y consistente con la convención visual actual del runtime.
- Las decisiones de ocultación por `queryStateFeedback` y de validación `required` deben ser coherentes entre sí para no bloquear envíos por campos que no están visibles.

## Criterios de aceptación
- Dado un config válido con un `form` que declara `id` y campos compatibles, el runtime renderiza el formulario y registra los campos en `forms.{formId}.{fieldId}` sin requerir componentes específicos externos.
- Dado un campo con `defaultValue` literal o dinámico y sin estado previo en la instancia, el runtime lo inicializa con ese valor efectivo la primera vez que aparece.
- Dado un `defaultValue` dinámico que todavía no existe en el primer render y aparece más tarde, el campo no se rehidrata automáticamente después de su inicialización inicial.
- Dado un campo ya modificado por el usuario, un rerender o una vuelta posterior a la misma página no sobrescribe su valor actual con el `defaultValue` original.
- Dado un `form` con campos obligatorios vacíos, al intentar enviarlo el submit se bloquea y el runtime refleja el error en los campos afectados.
- Dado un campo `required` oculto por `queryStateFeedback`, su estado puede seguir existiendo pero no bloquea el envío del formulario mientras permanezca oculto.
- Dado un `form` con `submitAction.type: executeOperation`, al enviarlo el runtime ejecuta la operación declarada y reutiliza la semántica estable de `queries.{operationName}` para loading, success y error.
- Dado un `api.body` que referencia `forms.{formId}.{fieldId}`, el submit envía los valores actuales del formulario sin requerir un adaptador adicional específico.
- Dado un `button` sin `action` dentro de `form.children`, al activarlo dispara el mismo submit declarativo del formulario.
- Dado un `button` con `action` explícita dentro de `form.children`, al activarlo ejecuta su propia acción y no dispara implícitamente el submit del formulario.
- Dado un submit exitoso con `resetOnSuccess: true`, el formulario vuelve a su estado inicial efectivo.
- Dado un submit fallido, el formulario conserva los valores actuales y no se resetea.
- Dado un `submitAction` que apunta a una operación `api` inexistente, la configuración falla en validación previa al render.
- Dada una configuración sin `form`, el comportamiento observable del runtime actual no cambia.

## Casos límite
- Un formulario puede aparecer en una página, desaparecer al navegar y volver dentro de la misma instancia; su estado debe persistir por defecto mientras no exista una orden explícita de reset.
- Un `defaultValue` dinámico puede depender de datos de query disponibles en el primer render o llegar más tarde; en esta iteración solo se toma el valor disponible en el momento de inicialización inicial y no se rehidrata automáticamente después.
- Un `select` puede declararse sin selección inicial; debe conservar un estado vacío válido hasta que el usuario elija una opción o `required` lo invalide en submit.
- Una opción de `select` con `value` vacío puede funcionar como placeholder no válido para `required`.
- Un formulario puede contener botones auxiliares como reset o navegación; esos botones no deben romper la semántica del submit propio del formulario.
- Dos formularios distintos pueden coexistir en la misma página; sus campos y resets deben mantenerse aislados por `form.id`.
- Un `resetForm` disparado desde una acción auxiliar debe seguir restaurando el estado inicial efectivo del formulario aunque el usuario haya cambiado de página y vuelto después.
- Un campo oculto puede reaparecer más tarde con su estado y su error previo todavía presentes; ocultarlo no debe reescribir ni limpiar su estado por sí mismo.

## Riesgos o preguntas abiertas
- La feature sigue siendo transversal entre contrato JSON, validación, renderer, acciones compartidas y store del runtime, por lo que requiere `design.md` antes de implementarse.
- La primera iteración fija deliberadamente `select` con items estáticos y validación solo `required`; ampliar catálogo de campos, reglas o items dinámicos debe abrirse como alcance nuevo y no inferirse de esta spec.
- Queda fuera de esta spec la decisión de UX detallada para presentar mensajes, estilos y jerarquía visual de errores más allá de exigir que el submit bloqueado por `required` deje un error visible y coherente por campo.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Formularios y validación
- Queries y feedback

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
