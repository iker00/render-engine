# Tasks: Page entry query preloads

## T0010-01

### Estado
Completada

### Objetivo
Extender el contrato de página para soportar `preloads` como lista declarativa opcional de nombres de operación, fijando en tipos y validación qué shapes son válidos e inválidos sin convertir todavía esa declaración en ejecución automática.

### Fuera de alcance
- Ejecutar precargas al arrancar o navegar.
- Añadir el estado agregado de entrada de página en el store.
- Exponer todavía consumidores declarativos del nuevo estado desde el layout.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si la fachada pública necesita exportar tipos ajustados de página
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar compatibilidad del borde de bootstrap con páginas que declaran `preloads`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que una página sin `preloads` sigue siendo válida.
- Confirmar que una página con `preloads: []` sigue siendo válida.
- Confirmar que una página con `preloads: ['searchUsers']` se valida correctamente.
- Confirmar que se acepta más de un nombre en orden declarado dentro de `preloads`.
- Confirmar que se rechaza `preloads` cuando no es un array.
- Confirmar que se rechazan entradas vacías, no string o solo whitespace dentro de `preloads`.
- Confirmar que una configuración existente sin `preloads` conserva el resultado de validación previo.

### Criterios de finalización
- `RuntimePageConfig` incorpora `preloads` con un shape estable y mínimo.
- La validación de bootstrap acepta y rechaza exactamente los casos acordados para `preloads`.
- El cambio no introduce todavía semántica de ejecución en bootstrap ni rompe configuraciones existentes.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando el contrato JSON ya puede describir precargas de página de forma inequívoca y testeada, sin dejar ambigüedad sobre shapes válidos.

### Cierre documental
Pendiente de una pasada posterior para actualizar la ficha del contrato y la de páginas/navegación. No se cierra en esta tarea.

## T0010-02

### Estado
Completada

### Objetivo
Introducir el dominio agregado de entrada de página en `runtime-state/`, con estado, acciones y selectors suficientes para representar la tanda activa y distinguir `sin precargas`, `loading`, `success` y `error`, sin cablear todavía la ejecución automática.

### Fuera de alcance
- Lanzar requests automáticos al montar o navegar.
- Abrir un namespace de referencias declarativas como `pageEntry.*`.
- Cambiar la semántica individual de `queries.{queryName}` o añadir cancelación/deduplicación.

### Dependencias
- `T0010-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo para exponer selectors/hooks o helpers mínimos que dependan del nuevo dominio
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx` si se separa la nueva cobertura de integración del resto del store
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que el store puede representar explícitamente una entrada sin `preloads` como estado agregado `idle`.
- Confirmar que el dominio puede pasar a `loading`, `success` y `error` con el `pageId`, `entryId` y `preloadNames` esperados.
- Confirmar que el reducer ignora cierres agregados de una tanda antigua cuando su `entryId` ya no coincide con la entrada activa.
- Confirmar que los selectors del nuevo dominio leen el estado agregado sin afectar navegación, formularios ni queries.
- Confirmar que el store base sigue creando navegación, formularios y queries como antes.

### Criterios de finalización
- Existe un dominio estable en `runtime-state/` para la entrada de página actual.
- El shape observable de la entrada queda cerrado en tipos y reducers, sin esperar a consumidores visuales.
- La protección latest-only del agregado queda fijada en tests del store.
- Los tests relevantes del estado compartido quedan en verde.

### Cierre de implementación
Completado cuando el runtime ya dispone de una fuente de verdad explícita para la entrada de página y su cierre agregado, sin ambigüedad sobre transiciones ni protección frente a tandas antiguas.

### Cierre documental
Pendiente de una pasada posterior para reflejar el nuevo dominio compartido en la documentación funcional y arquitectónica. No se cierra en esta tarea.

## T0010-03

### Estado
Completada

### Objetivo
Cablear la ejecución automática de `preloads` al entrar en la página activa, reutilizando la frontera `api`, hidratando `queries.{operationName}` con la semántica ya estable y cerrando el agregado de entrada con latest-only para la tanda más reciente.

### Fuera de alcance
- Añadir todavía consumidores declarativos finales de `loading`, `error` o `empty` dentro del layout.
- Introducir políticas alternativas de reentrada, caché, secuencialidad o dependencias entre precargas.
- Reescribir el ejecutor remoto o imponer latest-only también sobre las queries individuales.

### Dependencias
- `T0010-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-reducer.ts` solo si hace falta un ajuste final de acciones o guards del agregado
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si el helper compartido necesita afinar el contrato del dominio
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si la lectura del agregado requiere una superficie más explícita
  - `src/queries/runtime-api-executor.ts` solo si la integración necesita un pequeño ajuste del contrato de retorno ya existente
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` solo si el helper compartido obliga a fijar mejor el resultado devuelto por el ejecutor
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que el `initialPage` con `preloads` dispara automáticamente sus operaciones al montar el runtime.
- Confirmar que navegar a otra página con `preloads` dispara una nueva tanda automática al entrar.
- Confirmar que volver a una página ya visitada vuelve a disparar sus `preloads`.
- Confirmar que una misma entrada de página no relanza sus `preloads` por rerenders del provider ni por cambios de estado derivados de las propias queries mientras `navigation.currentPageId` siga siendo el mismo.
- Confirmar que una página sin `preloads` no emite red y deja el agregado en `idle`.
- Confirmar que varias precargas de la misma entrada se lanzan en paralelo y no esperan orden secuencial.
- Confirmar que una tanda con todas las operaciones exitosas termina en `success`.
- Confirmar que una tanda mixta, con al menos un error, termina en `error` sin borrar los datos exitosos ya guardados en otras queries.
- Confirmar que una operación inexistente o un request no construible por referencias ausentes termina como error recuperable en su query y en el agregado.
- Confirmar que el agregado final de una tanda antigua no sobreescribe el de una entrada más reciente aunque sus promesas se resuelvan después.
- Confirmar que las precargas de una misma tanda resuelven sus payloads contra un snapshot común del estado de entrada, no contra un estado mutado por otras operaciones de esa misma tanda.

### Criterios de finalización
- El runtime dispara `preloads` automáticamente al montar y al cambiar `navigation.currentPageId`.
- La misma entrada de página dispara como máximo una tanda automática de `preloads`; rerenders o cambios de estado internos no generan tandas duplicadas.
- Cada precarga reutiliza la semántica existente de `queries.*` sin duplicar lógica remota en la UI.
- El agregado de entrada refleja `idle | loading | success | error` para la página activa y solo la tanda más reciente puede cerrarlo.
- Los tests de integración relevantes quedan en verde.

### Cierre de implementación
Completado cuando la orquestación declarativa de entrada de página queda cerrada de extremo a extremo, con ejecución automática, agregado observable y semántica latest-only del agregado validada.

### Cierre documental
Pendiente de una pasada posterior para actualizar estado actual y fichas funcionales del runtime, navegación y queries. No se cierra en esta tarea.

## T0010-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature verificando compatibilidad con configuraciones sin `preloads`, coherencia entre validación, store y ejecución automática, y mantenimiento del gate global de cobertura del proyecto.

### Fuera de alcance
- Abrir nuevas capacidades declarativas fuera de la spec.
- Actualizar documentación funcional o arquitectónica en esta misma tarea.
- Extender el runtime con consumidores visuales finales del agregado de entrada.

### Dependencias
- `T0010-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/`, `src/queries/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` solo si hubo ajuste del contrato de retorno
  - `src/tests/app-shell.test.tsx` solo si la regresión final revela impacto real en el arranque visible
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta de validación del config, store compartido y ejecución automática de `preloads`.
- Confirmar que una configuración existente sin `preloads` mantiene su comportamiento observable actual.
- Confirmar que `preloads: []` no emite red y no rompe el arranque.
- Confirmar que la entrada inicial y la navegación posterior siguen resolviendo la página visible correcta.
- Confirmar que los errores recuperables de precarga no derriban el runtime completo.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Criterios de finalización
- No quedan incoherencias entre contrato `preloads`, estado agregado, queries individuales y navegación interna.
- Las configuraciones previas sin `preloads` conservan compatibilidad funcional.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0010-01`.

No se debe empezar `T0010-02` hasta cerrar `T0010-01`, ni `T0010-03` hasta cerrar `T0010-02`, ni `T0010-04` hasta cerrar `T0010-03`.
