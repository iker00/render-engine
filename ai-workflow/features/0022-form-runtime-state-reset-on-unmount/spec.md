# Spec: Form runtime state reset on unmount

## Objetivo
Hacer que un nodo `form` elimine por defecto su estado local en `runtimeState.forms` al desmontarse, permitiendo además una opción explícita para conservarlo cuando un flujo necesite persistir valores entre desmontajes dentro de la misma instancia del runtime.

## Alcance
- Cambiar el comportamiento por defecto del nodo `form` para que su estado local se elimine al desmontarse.
- Añadir una propiedad opcional en el nodo `form` para conservar el estado local entre desmontajes cuando un flujo lo necesite.
- Aplicar esta política al estado del formulario concreto que la declara, sin convertirla en una regla global ajena al propio nodo `form`.
- Hacer que, cuando el formulario no conserve su estado entre desmontajes, vuelva a inicializar sus campos con la misma semántica vigente de `defaultValue` la siguiente vez que se monte.
- Cubrir el caso de formularios hidratados desde `params.*`, `queries.*` u otros datos externos cuya entrada cambie entre visitas sucesivas dentro del mismo runtime.

## Fuera de alcance
- Introducir una limpieza global de `forms.*` al navegar de página, al hacer `goBack` o al cambiar `pageEntry`.
- Rehidratar automáticamente campos ya montados cuando cambian `params.*`, `queries.*` o cualquier otro origen dinámico mientras el formulario sigue montado.
- Añadir políticas intermedias de limpieza por campo, por cambio de parámetros o por eventos declarativos nuevos.
- Cambiar la semántica actual de ocultación por `queryStateFeedback` o `visibility` cuando el formulario no llega a desmontarse.

## Requisitos funcionales
- El nodo `form` debe poder declarar una propiedad opcional específica para indicar que su estado local debe conservarse entre desmontajes.
- Si la propiedad no está presente o está desactivada, al desmontarse el formulario el runtime debe eliminar el estado runtime asociado a ese `formId`, incluyendo los valores y metadatos locales de sus campos.
- Si la propiedad está activada, el formulario debe conservar su estado en `forms.{formId}.{fieldId}` dentro de la instancia activa del runtime aunque se desmonte y vuelva a montarse.
- Cuando un formulario sin conservación explícita vuelva a montarse más adelante dentro de la misma instancia, sus campos deben comportarse como una primera inicialización efectiva:
  - si tienen `defaultValue`, deben reconstruirse desde ese valor con la semántica ya vigente
  - si no tienen `defaultValue`, deben arrancar vacíos según la semántica propia de cada tipo de campo
- La eliminación o conservación del estado al desmontarse debe limitarse al formulario afectado y no debe alterar el estado de otros formularios presentes en la misma instancia.
- La opción debe servir tanto para formularios simples como para formularios cuyos `defaultValue` dependan de `params.*`, `queries.*` u otras referencias completas ya soportadas.
- Si un formulario sin conservación explícita se visita en un contexto y luego se vuelve a visitar en otro contexto distinto dentro de la misma instancia, el segundo montaje debe reflejar el nuevo contexto y no los valores persistidos del anterior.
- El caso de reentrada `search-posts -> home -> post-form`, cuando `post-form` inicializa campos a partir de datos externos, debe quedar resuelto por defecto para evitar reutilizar valores anteriores entre visitas separadas por un desmontaje real.
- La semántica vigente de inicialización lazy debe mantenerse:
  - no debe rehidratarse un campo mientras el formulario siga montado
  - la reconstrucción desde `defaultValue` solo debe ocurrir tras un desmontaje real y un montaje posterior
- El reset explícito del formulario debe seguir funcionando con la semántica actual y no debe depender de que la nueva opción esté activada o no.
- La validación `required`, el submit declarativo y la resolución de payloads desde `forms.*` deben seguir usando el estado local vigente del formulario después de cada nuevo montaje.
- Debe existir una forma explícita de preservar el comportamiento histórico de persistencia para los formularios que realmente dependan de él.

## Requisitos no funcionales
- La feature debe mantener el contrato del runtime deliberadamente pequeño: una semántica por defecto clara de limpieza al desmontar y una excepción opt-in por formulario para persistir.
- La terminología debe seguir alineada con el proyecto actual: `form`, `formId`, `defaultValue`, `forms.*`, `params.*` y estado local del runtime.
- El comportamiento debe seguir siendo coherente entre contrato JSON, validación previa al render, ciclo de vida visible del formulario y semántica de inicialización lazy ya documentada.
- La solución debe dejar trazable que el cambio altera una semántica histórica del runtime y que los formularios que dependan de la persistencia previa tendrán que declararla de forma explícita.
- La redacción del contrato debe dejar claro que la limpieza depende del desmontaje real del nodo `form`, no simplemente de cambios de valor o de rerenders internos.

## Criterios de aceptación
- Dada una configuración sin la nueva propiedad, cuando el usuario abandona la página y el formulario se desmonta, su estado desaparece de `runtimeState.forms`.
- Dada esa misma configuración sin la nueva propiedad, cuando el formulario se vuelve a montar más tarde, sus campos se reconstruyen desde `defaultValue` con la semántica vigente y no reaparecen los valores escritos en la visita anterior.
- Dado un formulario cuyos `defaultValue` dependen de `params.*`, si se entra una primera vez con un parámetro y después con otro distinto, el segundo montaje usa el segundo valor por defecto.
- Dado un formulario de edición hidratado desde datos externos cargados en `queries.*`, si el formulario se desmonta y luego se vuelve a montar con otra carga externa, el nuevo montaje no reutiliza el estado anterior por defecto.
- Dado el flujo `search-posts -> home -> post-form`, si `post-form` depende de contexto externo, al volver a entrar no reutiliza valores persistidos de una visita previa por defecto.
- Dado un formulario con la opción explícita de persistencia activada, al desmontarse y volver a montarse conserva los valores escritos previamente dentro de la misma instancia del runtime.
- Dado un formulario que sigue montado mientras cambian datos externos, el runtime no rehidrata los campos automáticamente solo por ese cambio.
- Dado un formulario oculto por reglas internas pero no desmontado realmente, la semántica visible del formulario no cambia solo por esta feature.
- Dado un runtime con varios formularios, activar la opción de persistencia en uno de ellos no altera la política aplicada al resto.
- Dado un formulario legacy que necesita la persistencia histórica, puede recuperarla declarando de forma explícita la nueva propiedad.

## Casos límite
- Formulario con `defaultValue` dinámico que en la primera visita se resuelve a un valor y en la segunda a otro distinto.
- Formulario con varios campos cuyos valores dependen parcialmente de estado externo y parcialmente de entrada manual del usuario.
- Reentrada a la misma página con otro contexto después de haber desmontado el formulario al pasar por una página intermedia.
- Formulario desmontado mientras una query relacionada sigue teniendo datos en `queries.*`; al remontar, el formulario debe reconstruirse desde el estado externo vigente, no desde `forms.*` previo.
- Runtime con dos formularios distintos donde solo uno activa la persistencia explícita.
- Campo oculto por `visibility` o `queryStateFeedback` que sigue perteneciendo a un formulario todavía montado; la feature no debe convertir ese caso en una limpieza implícita.

## Riesgos o preguntas abiertas
- La spec propone `persistOnUnmount` como nombre preferido para la propiedad opcional que recupera la persistencia explícita, porque expresa la excepción sin volver ambigua la nueva semántica base.
- No se identifica un riesgo de regresión en producción porque este comportamiento todavía no está desplegado, pero sí un requisito claro de actualización documental para que la nueva semántica por defecto quede visible y no se reinterprete después.
- La planificación e implementación deben incluir la actualización de la documentación funcional y técnica afectada para dejar claro que el comportamiento por defecto ahora es limpiar el estado del formulario al desmontar y que la persistencia pasa a ser opt-in.

## Áreas de producto afectadas
- Runtime UI configurable
- Formularios y validación
- Páginas y navegación

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/config-contract.md`
