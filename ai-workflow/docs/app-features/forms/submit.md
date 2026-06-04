> Cuándo leer: `submitAction.type: executeOperation`, payload efectivo, resolución de `forms.*`/`item.*` en submit, `resetOnSuccess`, semántica de `resetForm`.
> Tamaño: corto.
> Relacionados: [[../queries/execution.md]], [[validation-rules.md]], [[../references/reference-resolution.md]].

# Submit y reseteo

## Submit
- `form` renderiza un `<form>` real y maneja submit nativo.
- `submitAction` soporta `type: executeOperation` (singular) para una sola operación, o `type: executeOperations` (plural) para lanzar varias operaciones en paralelo.
- El submit puede activarse con Enter cuando aplica o con un `button` sin `action` dentro del subárbol del formulario.
- Un `button` con `action` explícita dentro del formulario sigue siendo auxiliar y no dispara submit implícito.
- `submitAction` puede añadir `query`, `body` y `headers` por ejecución sobre la operación `api` base sin duplicar operaciones casi idénticas.
- En `executeOperations` (plural), cada entrada de la lista declara `operationName` y puede aportar overrides propios de `query`, `body` y `headers`. Las operaciones se lanzan en paralelo; no existe orden garantizado entre ellas.
- El payload efectivo del submit reutiliza referencias `forms.{formId}.{fieldId}` ya soportadas en `api.query`, `api.body`, `api.headers` y en los canales equivalentes de `submitAction`.
- Dentro de un `repeater`, `submitAction.query`, `submitAction.body` y `submitAction.headers` también pueden resolver `item.*` contra el item actual sin abrir una semántica distinta por formulario.
- El resultado visible del submit vive solo en `queries.{operationName}`; no existe un dominio paralelo de `submitting`, `submitSuccess` o `submitError`.
- El submit resuelve sus referencias contra el snapshot más reciente del runtime tras la validación local del formulario.
- Si `submitAction` y la operación base aportan request params a la vez, `query` y `headers` combinan por clave con precedencia del submit, y `body` sigue la misma semántica limitada de merge superficial o sustitución total que usa el dominio `queries`.

## Reseteo
- `resetForm` restaura el estado inicial efectivo de cada campo del formulario objetivo.
- `resetForm` no borra `forms.{formId}` ni sustituye la limpieza por desmontaje; solo restaura el estado inicial efectivo del formulario actualmente presente en store.
- Si `form.resetOnSuccess` es `true`, el comportamiento depende del tipo de `submitAction`:
  - Con `submitAction.type: executeOperation` (singular): un submit exitoso dispara el reset.
  - Con `submitAction.type: executeOperations` (plural): el reset solo se dispara si **todas** las operaciones de la lista terminan en `status: success`. Si alguna operación falla, el formulario conserva sus valores actuales.
- Si el submit falla, el runtime conserva los valores actuales del usuario y no resetea automáticamente.
- El shape se valida en bootstrap, pero `formId` no se comprueba contra un catálogo semántico global inexistente.
- Si el formulario todavía no está inicializado en el store, la pantalla se mantiene estable y no aparece una semántica nueva de error.
