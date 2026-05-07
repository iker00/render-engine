# Tasks: NavigateTo page params

## T0020-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para que `button.props.action.type: navigateTo` acepte opcionalmente `params` como objeto plano de valores escalares y cerrar en bootstrap las validaciones estructurales y semánticas que esta feature puede resolver antes del render, incluyendo la frontera donde `params.*` debe seguir rechazándose.

### Fuera de alcance
- Persistir todavía params en el estado de navegación.
- Resolver todavía los valores efectivos de `navigateTo.params` al hacer click.
- Convertir todavía `params.*` en namespace soportado por el resolver runtime.
- Reorquestar todavía `preloads` o `goBack`.
- Actualizar documentación funcional o arquitectónica en esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos nuevos desde la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el borde de bootstrap con el contrato ampliado
  - `src/tests/runtime-reference-resolution.test.tsx` solo si se reutiliza para fijar rutas `params.*` inválidas detectadas desde la misma convención central
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `navigateTo` sigue siendo válido sin `params`.
- Confirmar que `navigateTo.params` acepta un objeto plano con claves no vacías y valores `string | number | boolean | null`.
- Confirmar que `navigateTo.params` rechaza arrays, objetos anidados, claves vacías o valores fuera del catálogo escalar.
- Confirmar que `button.props.action.pageId` sigue rechazando páginas inexistentes aunque `params` sea válido.
- Confirmar que `visibility.reference` sigue rechazando `params.*` antes del render.
- Confirmar que `list.props.items.source` y `select.props.items.source` siguen rechazando `params.*` antes del render.
- Confirmar que rutas inválidas como `params`, `params.user.id` o segmentos vacíos se rechazan sobre las superficies semánticamente validadas por esta tarea.
- Confirmar que configuraciones existentes con `navigateTo` sin `params` conservan el resultado normalizado actual.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `navigateTo.params` y la frontera explícita de `params.*`.

### Criterios de finalización
- El contrato JSON describe inequívocamente `navigateTo.params` como objeto plano y escalar.
- La validación previa al render separa shape inválido de `params` y uso fuera de alcance de `params.*`.
- La compatibilidad hacia atrás de `navigateTo` sin params queda fijada por tests.
- No queda trabajo de validación contractual importante delegado a nodos visuales o al provider.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista la nueva superficie contractual de navegación con params sin dejar ambigüedad sobre shape ni sobre los consumidores fuera de alcance.

### Cierre documental
Pendiente de una pasada posterior sobre contrato y navegación. No se cierra en esta tarea.

## T0020-02

### Estado
Completada

### Objetivo
Reestructurar el estado compartido de navegación para que cada entrada del historial persista `pageId` y params efectivos, ampliar `pageEntry` con esos params y fijar la semántica exacta de reentrada, no-op y restauración por `goBack`.

### Fuera de alcance
- Resolver todavía strings de `params.*` desde el runtime.
- Ejecutar todavía `navigateTo.params` contra el snapshot real al click.
- Reorquestar todavía la carga automática de `preloads` por `entryId`.
- Actualizar documentación funcional o arquitectónica en esta tarea.

### Dependencias
- `T0020-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo para exponer o consumir el nuevo shape del dominio
  - `src/runtime/runtime-page.tsx` solo si hace falta ajustar el selector de página activa sin cambiar el resultado visible
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que el estado inicial crea una entrada histórica con `initialPage` y params vacíos.
- Confirmar que navegar a otra página añade una nueva entrada con sus params efectivos.
- Confirmar que navegar a la misma página con params distintos añade una nueva entrada y que navegar a la misma página con params equivalentes sigue siendo no-op observable.
- Confirmar que `goBack` restaura la entrada previa completa, incluidos sus params.
- Confirmar que el historial sigue ignorando `goBack` cuando no existe una entrada previa.
- Confirmar que `pageEntry` refleja `entryId`, `pageId`, `params`, `preloadNames` y `status` coherentes con la entrada activa.
- Confirmar que los selectors del estado pueden leer la página actual y los params activos sin romper formularios, queries ni tests previos del store.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que el historial interno ya persiste entradas completas con params.

### Criterios de finalización
- El historial deja de depender de `string[]` y representa inequívocamente la entrada activa y sus params.
- La semántica de `goBack` y de reentrada a la misma página queda cerrada por tests.
- `pageEntry` ya puede actuar como espejo de la entrada activa sin una segunda fuente de verdad ambigua.

### Cierre de implementación
Completado cuando el store compartido ya puede describir y restaurar entradas parametrizadas de navegación sin necesidad de reinterpretar la semántica del historial en tareas posteriores.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura, estado actual y navegación. No se cierra en esta tarea.

## T0020-03

### Estado
Completada

### Objetivo
Convertir `params.*` en un namespace soportado por la capa central de referencias y conectar `navigateTo` para resolver `params` al navegar contra un snapshot único del runtime, dejando los valores efectivos disponibles para texto, requests, `defaultValue` y nuevas navegaciones originadas desde una página ya parametrizada.

### Fuera de alcance
- Reescribir todavía la orquestación automática de `preloads` para depender de `entryId`.
- Abrir `params.*` en `visibility`, `list.props.items.source` o `select.props.items.source`.
- Introducir interpolación parcial, navegación anidada adicional bajo `params.*` o payloads no escalares.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0020-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-types.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts`
  - `src/runtime/runtime-actions/runtime-navigation-action-executor.ts` si hace falta ajustar firmas compartidas
  - `src/config/runtime-config.ts` solo si conviene exportar tipos auxiliares compartidos entre config y runtime
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`

### Tests requeridos
- Confirmar que `parseRuntimeReference('params.userId')` pasa a clasificarse como referencia soportada y que `params.user.id` sigue siendo inválida.
- Confirmar que `resolveRuntimeReference('params.userId', state)` lee el valor desde la entrada activa y devuelve missing cuando la clave no existe.
- Confirmar que `navigateTo.params` resuelve referencias contra el snapshot vigente al click y persiste ya el valor efectivo, no la referencia original.
- Confirmar que una referencia ausente o resuelta a objeto/array dentro de `navigateTo.params` no bloquea la navegación y degrada a clave ausente en la entrada resultante.
- Confirmar que `heading.props.text` y `paragraph.props.text` pueden mostrar `params.*` desde la página destino.
- Confirmar que `api.query`, `api.body`, `api.headers`, `button.props.action.*` y `form.submitAction.*` pueden resolver `params.*` al ejecutar operaciones.
- Confirmar que `defaultValue` de `input`, `textarea` y `select` puede inicializarse desde `params.*` con la semántica lazy ya existente.
- Confirmar que una segunda navegación puede usar `params.*` como origen para construir los params de la siguiente entrada.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `params.*` como namespace soportado y su frontera funcional exacta.

### Criterios de finalización
- Existe una única capa de resolución para `params.*` dentro del runtime.
- `navigateTo` congela los params efectivos por entrada usando el snapshot real del runtime y sin lógica duplicada en nodos visuales.
- Texto, requests y `defaultValue` reutilizan la nueva capacidad sin consumers ad hoc adicionales.
- El runtime no abre silenciosamente `params.*` en superficies fuera de la spec.

### Cierre de implementación
Completado cuando el transporte y la resolución de params quedan cerrados de extremo a extremo, desde la acción de navegación hasta los consumidores declarativos soportados, sin reinterpretaciones entre capas.

### Cierre documental
Pendiente de una pasada posterior sobre runtime, navegación, queries y formularios. No se cierra en esta tarea.

## T0020-04

### Estado
Completada

### Objetivo
Reorquestar la entrada de página para que `preloads` dependan de la nueva entrada activa completa, disparándose por `pageEntry.entryId` y no solo por `currentPageId`, con restauración correcta al volver atrás y sin duplicados por rerender.

### Fuera de alcance
- Añadir consumidores declarativos nuevos fuera de `params.*`.
- Cambiar la semántica individual de `queries.{queryName}` más allá de reutilizar la ya existente.
- Introducir políticas nuevas de caché, cancelación, secuencialidad o deduplicación.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0020-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-reducer.ts` solo si hace falta ajustar la activación y el cierre agregado de `pageEntry`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si el helper compartido requiere afinar el contrato del dominio
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si conviene fijar una lectura más explícita de la entrada activa
  - `src/queries/runtime-api-executor.ts` solo si la integración necesita un ajuste mínimo del contrato de snapshot ya existente
- Tests a crear o modificar:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` solo si el helper compartido obliga a fijar mejor el resultado devuelto por el ejecutor
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que una navegación a la misma página con params distintos crea una nueva entrada y vuelve a disparar `preloads`.
- Confirmar que `goBack` restaura la entrada previa y relanza los `preloads` asociados a esa entrada restaurada.
- Confirmar que una navegación idéntica a la entrada visible no duplica historial ni relanza `preloads`.
- Confirmar que una misma entrada activa no relanza `preloads` por rerenders del provider ni por cambios de estado derivados de las propias queries.
- Confirmar que varias precargas de una misma entrada siguen resolviendo sus requests contra un snapshot común que ya incluye los params efectivos de esa entrada.
- Confirmar que el agregado `pageEntry` mantiene `idle | loading | success | error` y sigue siendo latest-only para el cierre de la entrada más reciente.
- Confirmar que una tanda mixta con algún error sigue dejando datos exitosos en queries individuales aunque el agregado final quede en `error`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que la unidad observable de reentrada ya es la entrada parametrizada completa.

### Criterios de finalización
- La orquestación automática depende de la entrada activa completa y no solo del `pageId`.
- Las reentradas con params distintos y las restauraciones por `goBack` disparan sus `preloads` de forma coherente con la spec.
- La protección latest-only del agregado sigue cerrada por tests sin imponer semántica nueva sobre queries individuales.

### Cierre de implementación
Completado cuando la entrada parametrizada gobierna correctamente tanto la navegación visible como la tanda automática de `preloads`, sin duplicados espurios ni pérdida de coherencia al volver atrás.

### Cierre documental
Pendiente de una pasada posterior sobre estado actual, runtime, navegación y queries. No se cierra en esta tarea.

## T0020-05

### Estado
Completada

### Objetivo
Cerrar la regresión final del subconjunto afectado validando conjuntamente contrato, historial parametrizado, resolución `params.*`, reentrada con `preloads`, compatibilidad hacia atrás y gate global de coverage del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de estado ya fijadas por las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0020-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/`, `src/queries/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato ampliado, del historial parametrizado, de la resolución `params.*` y de la reentrada con `preloads`.
- Confirmar que una configuración existente sin `navigateTo.params` conserva su comportamiento observable actual.
- Confirmar que la navegación a página inexistente sigue fallando en bootstrap aunque exista `params`.
- Confirmar que `goBack` sigue siendo estable cuando no hay historial previo y cuando las entradas previas no tienen params.
- Confirmar que campos y textos que no usan `params.*` mantienen su semántica actual.
- Confirmar que `params.*` sigue sin abrirse accidentalmente en `visibility` ni en fuentes dinámicas de colección.
- Ejecutar `pnpm test` para validar el gate global de coverage del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, runtime, navegación, queries, formularios y estado global.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, estado compartido, referencias runtime, `navigateTo`, `goBack` y `preloads`.
- La compatibilidad hacia atrás del runtime queda fijada por regresión.
- El subconjunto afectado del runtime queda validado por tests relevantes y por el gate global de coverage.

### Cierre de implementación
Completado cuando la feature queda cerrada de extremo a extremo, sin divergencias entre capas ni huecos de validación que obliguen a reinterpretar el contrato durante la implementación o revisión.

### Cierre documental
Pendiente de una pasada posterior sobre fichas funcionales, arquitectura y estado actual. No se cierra en esta tarea.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0020-01`.

No se debe empezar `T0020-02` hasta cerrar `T0020-01`, ni `T0020-03` hasta cerrar `T0020-02`, ni `T0020-04` hasta cerrar `T0020-03`, ni `T0020-05` hasta cerrar `T0020-04`.
