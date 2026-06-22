# Tasks: 0077 — Submit omite referencias a campos ocultos en el wire format

> Contrato de ejecución secuencial. Cada tarea es atómica, verificable y diseñada para que dos agentes competentes produzcan un resultado funcionalmente equivalente. Cada tarea incluye su sub-bloque `tests`. Las reglas globales de testing (umbral 80%, organización de ficheros) viven en `ai-workflow/standards/testing-rules.md` y no se repiten aquí.

> Orden: T-01 → T-02 → T-03. T-01 habilita el canal de tipos sin cambio observable; T-02 introduce el comportamiento de omisión en la capa de queries; T-03 conecta el form al canal y completa la feature.

---

## T-01 — Introducir `RuntimeApiHiddenFormFields` y propagar la firma sin cambio de comportamiento

**Estado**: completada

**Objetivo**: añadir el canal estático para comunicar "este formulario tiene estos `fieldIds` ocultos" desde el caller hasta `buildRuntimeApiRequest`, sin modificar la lógica de resolución. Al cerrar esta tarea, el parámetro es opcional, ningún caller lo está usando todavía y todos los tests existentes siguen verdes.

**Fuera de alcance**:
- cualquier cambio funcional en `resolvePayloadValue`, `resolveJsonPayloadValue`, `resolveBody`, `resolveQuery`, `resolveHeaders` o `resolveEndpoint`.
- cambios en `form-layout-node.tsx`.
- omisión real de claves en el payload.
- propagación del parámetro a `executeInlineQueryOperation` (sigue el mismo patrón si conviene, pero no es parte de esta feature).

**Dependencias**: ninguna.

**Impacto esperado en archivos**:
- código:
  - `src/queries/runtime-api-types.ts` (modificar): añadir `RuntimeApiHiddenFormFields` y extender `BuildRuntimeApiRequestOptions`, `BuildInlineRuntimeApiRequestOptions`, `ExecuteRuntimeApiOperationOptions`, `ExecuteInlineRuntimeApiOperationOptions` con `hiddenFormFields?: RuntimeApiHiddenFormFields`.
  - `src/queries/runtime-api-request.ts` (modificar): aceptar `hiddenFormFields` en `buildRuntimeApiRequest` y `buildInlineRuntimeApiRequest`, propagarlo al objeto `resolveOptions` pasado a `resolveBody`/`resolveQuery`/`resolveHeaders`. `resolveEndpoint` NO recibe `hiddenFormFields`.
  - `src/queries/runtime-api-payload-resolver.ts` (modificar): añadir el campo opcional `hiddenFormFields?: RuntimeApiHiddenFormFields` a `ResolvePayloadValueOptions`. No usarlo todavía en la lógica.
  - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar): añadir `hiddenFormFields?: RuntimeApiHiddenFormFields` a las opciones de `executeQueryOperation` y `executeQueryOperationWithSnapshot`, y propagarlo a `buildRuntimeApiRequest`. Sin cambio de comportamiento si no se pasa.
- tests: ninguno nuevo.
- documentación: ninguna.

**Tests**:
- **Ficheros de test**: ninguno; cubierto por la suite existente, que debe seguir verde sin tocar nada.
- **Comportamiento cubierto**:
  - Los tipos compilan sin errores.
  - `pnpm test` sigue verde sin nuevos casos. El parámetro es opcional y ningún caller lo pasa todavía.
- **Comandos durante la implementación**: `pnpm test --run`.
- **Restricciones**: no añadir tests para esta tarea — su objetivo es estrictamente estructural y la cobertura del campo nuevo se valida funcionalmente en T-02 (resolver) y T-03 (form node).

**Documentación afectada**: ninguna.

**Criterios de finalización**:
- `RuntimeApiHiddenFormFields` existe en `src/queries/runtime-api-types.ts` con la forma `{ formId: string; fieldIds: ReadonlySet<string> }`.
- Las firmas mencionadas exponen `hiddenFormFields?: RuntimeApiHiddenFormFields`.
- `buildRuntimeApiRequest`/`buildInlineRuntimeApiRequest` reciben el campo y lo pasan al objeto de opciones de resolución sin alterar nada más.
- `pnpm test --run` sigue verde.

**Cierre de implementación**: tipos publicados, propagación de la firma completa hasta el resolver, suite global en verde, sin cambios observables en runtime.

---

## T-02 — Omisión de claves en `body`/`query`/`headers` cuando la referencia apunta a un campo oculto del propio form

**Estado**: completada

**Objetivo**: implementar el terminal `'omit'` en el resolver de payload y propagar su semántica a las superficies `body` JSON anidado, `query` y `headers`. Cuando `hiddenFormFields` se pasa, una referencia `forms.{formId}.{fieldId}` que devuelve `missing` y cuyo `formId`/`fieldId` coinciden con el set se traduce en "no incluir esta clave". Cualquier otro `missing` sigue siendo error. Los arrays dentro de `body` reaccionan al terminal `'omit'` con `request-build-failed`. `resolveEndpoint` no participa.

**Fuera de alcance**:
- cambios en `form-layout-node.tsx`.
- propagar el parámetro desde nuevos callers — sólo se prueba inyectándolo directamente en tests.
- poda de objetos contenedores vacíos.
- interpolación `{{...}}` dentro de `body`/`query`/`headers`.

**Dependencias**: T-01.

**Impacto esperado en archivos**:
- código:
  - `src/queries/runtime-api-payload-resolver.ts` (modificar):
    - `resolvePayloadValue` puede devolver ahora `{ status: 'ready'; value } | { status: 'omit' } | { status: 'error' }`.
    - El terminal `'omit'` se devuelve sólo cuando: `resolveRuntimeReference` devuelve `status: 'missing'`, la `reference.namespace === 'forms'`, `reference.path.length === 2`, `reference.path[0] === options.hiddenFormFields?.formId` y `options.hiddenFormFields.fieldIds.has(reference.path[1])`. En cualquier otra condición, el comportamiento es idéntico al actual.
    - `resolveJsonPayloadValue` propaga `'omit'` en su union, y para `Array.isArray(value)` un hijo con `'omit'` se traduce en `status: 'error'` (no se intenta "compactar" el array).
    - `resolveJsonPayloadValue` aplicada a objetos planos: las claves cuyo hijo resuelve a `'omit'` se excluyen del objeto resultante. Los objetos contenedores vacíos se conservan tal cual.
    - `resolveBody` interpreta `'omit'` en el nivel raíz como `'ready'` con body vacío equivalente, de manera coherente con el comportamiento anidado.
    - `resolveHeaders`: una clave con valor `'omit'` se excluye del objeto headers resultante.
  - `src/queries/runtime-api-request.ts` (modificar):
    - `resolveQuery`: una clave con valor `'omit'` se excluye del objeto query resultante.
    - `resolveEndpoint` no se modifica. Sigue tratando cualquier no-`resolved` como error.
- tests:
  - `src/tests/runtime/runtime-api-payload-omission.test.ts` (nuevo): unit tests directos sobre `resolvePayloadValue`, `resolveJsonPayloadValue`, `resolveBody`, `resolveQuery` y `resolveHeaders`. Cubre la matriz completa de la decisión D3 del design sin pasar por el form node.
- documentación: ninguna en este paso; la actualización efectiva se hace tras la última tarea (declarada en T-03).

**Tests**:
- **Ficheros de test**:
  - `src/tests/runtime/runtime-api-payload-omission.test.ts` (nuevo).
- **Comportamiento cubierto**:
  - `resolvePayloadValue` devuelve `'omit'` cuando la referencia es `forms.{formId}.{fieldId}` missing, `formId` coincide con `hiddenFormFields.formId` y `fieldId` está en `hiddenFormFields.fieldIds`.
  - `resolvePayloadValue` NO devuelve `'omit'` cuando el `formId` no coincide (es otro form) — sigue siendo `'error'`.
  - `resolvePayloadValue` NO devuelve `'omit'` cuando `path.length !== 2` (por ejemplo `forms.x.y.z`) — sigue siendo `'error'`.
  - `resolvePayloadValue` NO devuelve `'omit'` para namespaces distintos a `forms` (`params.*`, `queries.*`, `item.*`, `translations.*` missing siguen siendo `'error'`).
  - `resolvePayloadValue` NO devuelve `'omit'` si `hiddenFormFields` no se pasa (comportamiento idéntico al previo).
  - `resolveJsonPayloadValue` sobre un objeto plano omite la clave cuyo hijo resuelve a `'omit'` y conserva las claves restantes.
  - `resolveJsonPayloadValue` sobre un objeto anidado preserva el contenedor padre como `{}` cuando todas sus claves hijas se omiten (no poda).
  - `resolveJsonPayloadValue` sobre un array devuelve `status: 'error'` cuando alguna entrada del array resuelve a `'omit'`.
  - `resolveBody` devuelve `body` resuelto sin las claves omitidas; si todas las claves del body raíz se omiten, devuelve `{}`.
  - `resolveHeaders` excluye del objeto resultante las claves cuyo valor resuelve a `'omit'`.
  - `resolveQuery` excluye del objeto resultante las claves cuyo valor resuelve a `'omit'`.
  - `resolveEndpoint` NO se modifica: una referencia a un campo oculto del form actual en el template del endpoint sigue produciendo `request-build-failed`.
  - Una clave del body que apunta a un campo visible vacío (`""`) sigue presente con `""`.
- **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-api-payload-omission.test.ts`.
- **Restricciones**: trabajar a nivel unit, sin montar el `FormRuntimeFixture` ni renderizar React; construir el `RuntimeState` mínimo y los `RuntimeApiHiddenFormFields` directamente. No reutilizar fixtures de `runtime-state/helpers.tsx`.

**Documentación afectada**: ninguna en esta tarea; el impacto documental queda registrado en T-03 como cierre de la feature.

**Criterios de finalización**:
- Los terminales `'omit'` se devuelven exclusivamente en las condiciones definidas por D2/D3 del design.
- `pnpm test --run src/tests/runtime/runtime-api-payload-omission.test.ts` pasa.
- `pnpm test --run` global sigue verde — las suites previas que prueban "missing → request-build-failed" siguen pasando porque ningún caller existente pasa `hiddenFormFields`.

**Cierre de implementación**: comportamiento de omisión correctamente acotado al alcance del design, sin cambios observables para callers que no pasan `hiddenFormFields`, tests unit del nuevo fichero en verde.

---

## T-03 — `form-layout-node.handleSubmit` calcula `hiddenFormFields` y completa el flujo end-to-end del submit

**Estado**: completada

**Objetivo**: en `handleSubmit`, derivar el set de `fieldIds` ocultos del propio form (usando los mismos `latestFieldDefinitions` y `visibleFieldDefinitions` que ya se calculan para validación) y pasarlo como `hiddenFormFields: { formId: node.id, fieldIds }` al `executeQueryOperation` en las dos ramas del submit (`executeOperation` y `executeOperations`). Al cerrar esta tarea, la feature está implementada de extremo a extremo: el submit de un form con campos ocultos por `visibility`/`queryStateFeedback` produce un request HTTP cuyo wire format omite las claves correspondientes.

**Fuera de alcance**:
- pasar `hiddenFormFields` desde otros callers (botones, file-manager, preloads, link-action). Mantienen comportamiento actual.
- modificar `resolveEndpoint`.
- documentación de las fichas de `app-features/`. Esa pasada se ejecuta tras la implementación con `update-app-documentation` y no entra en `tasks.md`.

**Dependencias**: T-01, T-02.

**Impacto esperado en archivos**:
- código:
  - `src/runtime/nodes/form-layout-node.tsx` (modificar): en `handleSubmit`, después de calcular `visibleFieldDefinitions` y antes de invocar `executeQueryOperation` (en ambas ramas), construir el set:
    ```ts
    const visibleFieldIds = new Set(visibleFieldDefinitions.map((f) => f.fieldId))
    const hiddenFieldIds = new Set(
      latestFieldDefinitions
        .map((f) => f.fieldId)
        .filter((id) => !visibleFieldIds.has(id))
    )
    const hiddenFormFields = { formId: node.id, fieldIds: hiddenFieldIds }
    ```
    Pasarlo en el options de `executeQueryOperation` para la rama `executeOperation` y para cada `executeQueryOperation` del `Promise.all` en la rama `executeOperations`. Construir una sola vez por submit; no recalcular por entrada.
- tests:
  - `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx` (nuevo): integración con `FormRuntimeFixture` (o equivalente al patrón ya usado en `runtime-state/`). Renderiza un form con campos condicionales por `visibility`/`queryStateFeedback`, dispara submit y verifica el `body`/`query`/`headers` que llega al `fetch` mock.
- documentación afectada (sólo referencia, sin tarea documental aquí):
  - `ai-workflow/docs/app-features/forms/lifecycle.md` sección "Campos ocultos": nota cruzada al payload.
  - `ai-workflow/docs/app-features/forms/submit.md` (si existe) o equivalente: documentar que las referencias a campos ocultos del propio form se omiten del wire format.
  - `ai-workflow/docs/app-features/forms/validation-rules.md`: enlace cruzado al comportamiento del payload.
  - `ai-workflow/docs/app-features/queries/execution.md`: documentar el contrato del nuevo parámetro `hiddenFormFields` y su semántica acotada al submit.
  - Estas fichas se actualizarán con `update-app-documentation` tras cerrar la implementación.

**Tests**:
- **Ficheros de test**:
  - `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx` (nuevo).
- **Comportamiento cubierto**:
  - Form con dos modos seleccionables por `radioGroup` (`searchType`), cada modo muestra un conjunto distinto de campos por `visibility`. Al cargar la página en el modo por defecto y pulsar submit sin tocar nada:
    - `fetch` se invoca una vez (la petición sale).
    - El `body` enviado al `fetch` contiene únicamente las claves del modo activo.
    - Las claves correspondientes a los modos no activos NO aparecen en el body.
  - Tras cambiar al otro modo, rellenar los campos del nuevo modo y submit: el body contiene las claves del nuevo modo y omite las del modo previo.
  - Form con un campo visible vacío (sin `required`): la clave que lo referencia viaja con `""` (la omisión es por visibilidad, no por valor).
  - Form con un campo oculto por `queryStateFeedback` (no por `visibility`): la clave se omite igual que con `visibility`.
  - Una clave del body que referencia `params.X` donde `X` no existe en `params`: el submit dispara `request-build-failed` por `queries/set-error`, `fetch` NO se invoca, `onError` corre. Confirma que la omisión silenciosa NO se ha generalizado.
  - Una clave del body que referencia un campo de OTRO formulario presente en la página (también missing): sigue siendo `request-build-failed`. La omisión no aplica a forms ajenos.
  - Una referencia en `endpoint` (template `{{forms.{thisForm}.{hiddenField}}}`) a un campo oculto del form actual: sigue siendo `request-build-failed` (`endpoint` no se "salta").
  - Body anidado: si `body.A.B` referencia a un campo oculto y `body.A.C` a uno visible, el `fetch` recibe `{ A: { C: <valor> } }`. Si todas las claves bajo `A` se omiten, recibe `{ A: {} }`.
  - Rama `submitAction.type === 'executeOperations'`: las dos operaciones ejecutadas reciben el mismo `hiddenFormFields` y cada una omite sus propias claves correspondientes a campos ocultos del form.
- **Comandos durante la implementación**: `pnpm test --run src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx`.
- **Restricciones**: reutilizar el patrón de fixtures de `src/tests/runtime-state/helpers.tsx` (`FormRuntimeFixture` o el harness existente equivalente para forms). Mockear `fetch` con `vi.fn()` y verificar el `body` deserializando el `JSON.parse(init.body)`. No introducir snapshots; aserciones explícitas por clave.

**Documentación afectada**:
- `ai-workflow/docs/app-features/forms/lifecycle.md`
- `ai-workflow/docs/app-features/forms/submit.md`
- `ai-workflow/docs/app-features/forms/validation-rules.md`
- `ai-workflow/docs/app-features/queries/execution.md`

**Criterios de finalización**:
- `handleSubmit` propaga `hiddenFormFields` en las dos ramas del submit.
- Todos los comportamientos del bloque "Comportamiento cubierto" verifican el wire format real visto por `fetch`.
- `pnpm test --run` global queda en verde y el umbral de cobertura del proyecto (80%) sigue cumpliéndose.

**Cierre de implementación**: la feature está implementada end-to-end. El submit de un form con campos ocultos por `visibility` o `queryStateFeedback` produce un request HTTP que no incluye las claves correspondientes a esos campos, manteniendo intacto el comportamiento para cualquier otra superficie o caller.

---

## Siguiente tarea a abordar

T-01. Es prerrequisito de T-02 y T-03 y no es observable, así que cierra el contrato de firmas sin riesgo antes de tocar comportamiento.
