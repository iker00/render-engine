# Tasks: Declarative runtime visibility rules

## T0019-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para admitir un bloque opcional `visibility` en cualquier nodo soportado del layout, con una única condición por nodo, un catálogo cerrado de operadores y validación previa al render de referencias, shape y uso correcto de `value`, fijando además que `equals` y `notEquals` comparan contra un único literal declarativo y no contra una segunda referencia runtime implícita.

### Fuera de alcance
- Evaluar todavía la condición en runtime.
- Introducir todavía precedencia efectiva con `queryStateFeedback`.
- Integrar todavía la capacidad en renderer o formularios.
- Abrir todavía namespaces nuevos, condiciones múltiples, `fallback` o expresiones compuestas.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

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
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que cualquier nodo soportado acepta opcionalmente `visibility` con `reference`, `operator` y `value` solo cuando corresponda.
- Confirmar que `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan` y `lessThan` forman el único catálogo válido de operadores.
- Confirmar que `forms.{formId}.{fieldId}`, `queries.{queryName}`, `queries.{queryName}.data`, `queries.{queryName}.data.*`, `queries.{queryName}.status` y `queries.{queryName}.error` son las únicas referencias aceptadas para `visibility`.
- Confirmar que rutas fuera de alcance como `navigation.*`, `routeParams.*`, `params.*`, `queries.{queryName}.status.*` o `queries.{queryName}.error.*` rechazan el config antes del render con ruta diagnóstica estable.
- Confirmar que `isTruthy` e `isFalsy` rechazan configuraciones que declaran `value`.
- Confirmar que `equals`, `notEquals`, `greaterThan` y `lessThan` rechazan configuraciones sin `value`.
- Confirmar que `equals` y `notEquals` aceptan solo literales escalares declarativos (`string`, `number`, `boolean` y `null`) y rechazan arrays u objetos para no abrir comparaciones profundas o semánticas implícitas nuevas.
- Confirmar que un `value` string con forma de referencia como `forms.profile.role` o `queries.search.status` se conserva como literal declarativo dentro del contrato y no se reinterpreta como una segunda referencia runtime.
- Confirmar que `greaterThan` y `lessThan` aceptan solo umbrales numéricos declarativos y no amplían silenciosamente el contrato a strings, objetos o arrays literales.
- Confirmar que una configuración previa sin `visibility` conserva exactamente el resultado normalizado actual.
- Confirmar que las claves extra del bloque siguen descartándose sin abrir semántica nueva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `visibility` como capacidad transversal del contrato JSON.

### Criterios de finalización
- El contrato JSON describe de forma inequívoca el shape de `visibility` y la obligatoriedad/opcionalidad de cada campo según operador.
- La validación previa al render rechaza operadores y referencias fuera del alcance acordado sin delegar esa frontera al renderer.
- El uso de `value` queda fijado por tests y no depende de heurísticas implícitas en runtime.
- La compatibilidad hacia atrás de nodos sin `visibility` queda fijada por tests.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista toda la nueva superficie contractual de `visibility` sin dejar reglas críticas para consumidores posteriores.

### Cierre documental
Pendiente de una pasada posterior sobre contrato y runtime. No se cierra en esta tarea.

## T0019-02

### Estado
Completada

### Objetivo
Introducir una utilidad transversal de visibilidad efectiva dentro de `runtime/` que combine la resolución de `queryStateFeedback` y `visibility`, aplique una precedencia única y exponga una decisión reutilizable por renderer y formularios sin lógica duplicada.

### Fuera de alcance
- Renderizar todavía nodos con la nueva capacidad desde el dispatcher central.
- Integrar todavía la visibilidad efectiva en la validación o inicialización de formularios.
- Cambiar todavía el contrato público del store o añadir namespaces nuevos de referencias.
- Añadir coerciones complejas, comparaciones lexicográficas o evaluación item a item sobre colecciones.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0019-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-layout-visibility.ts`
  - `src/runtime/runtime-query-state-feedback.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si hace falta exponer o reutilizar un helper ya existente para distinguir valor ausente de valor resuelto
  - `src/config/runtime-config.ts` solo si conviene exportar tipos auxiliares compartidos con el runtime
- Tests a crear o modificar:
  - `src/tests/runtime-layout-visibility.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si hace falta fijar explícitamente algún borde de resolución que el helper reutiliza
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que un nodo sin `queryStateFeedback` ni `visibility` se resuelve como visible sin cambiar su semántica actual.
- Confirmar que `queryStateFeedback` sigue resolviéndose primero y que `visibility` solo se evalúa sobre el nodo original cuando `queryStateFeedback` deja `show`.
- Confirmar que una rama `hide` o `fallback` de `queryStateFeedback` impide que `visibility` reabra el nodo o altere el fallback.
- Confirmar que `equals` y `notEquals` comparan contra el literal declarado sin coerciones no explícitas.
- Confirmar que `equals` y `notEquals` tratan `value` siempre como literal ya validado, incluso cuando el string declarado tenga forma de referencia runtime.
- Confirmar que `isTruthy` e `isFalsy` tratan una referencia válida sin dato como valor ausente y aplican una semántica estable de verdad/falsedad.
- Confirmar que `greaterThan` y `lessThan` comparan numéricamente valores escalares y usan `length` solo cuando el valor observado es un array.
- Confirmar que objetos, strings, `null`, errores de query y otros valores no comparables para `greaterThan` y `lessThan` degradan a `no match` en vez de lanzar error o inventar conversiones implícitas.
- Confirmar que `queries.{queryName}`, `queries.{queryName}.error` y otros valores objeto pueden evaluarse con `isTruthy` e `isFalsy` sin romper el helper compartido.
- Confirmar que una referencia válida pero ausente produce el mismo resultado para renderer y formularios a través de la misma utilidad.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva capa compartida de visibilidad efectiva y la precedencia con `queryStateFeedback`.

### Criterios de finalización
- Existe una única utilidad testeada que resuelve la visibilidad efectiva del nodo sin duplicar semántica entre consumidores.
- La precedencia `queryStateFeedback` antes de `visibility` queda fijada por tests en un único punto del runtime.
- La noción de valor ausente y la degradación de comparaciones no soportadas quedan cerradas por tests.
- La feature no abre un segundo sistema de referencias ni extiende silenciosamente el lenguaje condicional fuera de la spec.

### Cierre de implementación
Completado cuando la semántica central de `visibility` queda encapsulada y validada en una capa runtime compartida, lista para ser consumida por renderer y formularios sin reinterpretación.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura, queries y formularios. No se cierra en esta tarea.

## T0019-03

### Estado
Completada

### Objetivo
Conectar el renderer central con la utilidad de visibilidad efectiva para que cualquier nodo soportado pueda mostrarse, ocultarse o seguir delegando en el fallback ya existente según la combinación real de `queryStateFeedback` y `visibility`.

### Fuera de alcance
- Cambiar todavía la semántica de validación o submit de formularios.
- Añadir tipos nuevos de nodo o superficies declarativas nuevas.
- Duplicar evaluación de `visibility` dentro de nodos concretos como `heading`, `input` o `select`.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0019-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/layout-renderer.tsx` solo si hace falta un ajuste mínimo para renderizar fallbacks desde la utilidad compartida
  - `src/runtime/runtime-layout-visibility.ts`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx` solo si conviene fijar desde un harness existente una transición visible ligada a queries o forms
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `heading`, `paragraph`, `list`, `button`, `container` y `form` pueden mostrarse u ocultarse por `visibility` sin lógica específica por nodo.
- Confirmar que un nodo visible por defecto sigue renderizando exactamente igual cuando no declara `visibility`.
- Confirmar que un nodo observado por `forms.*` o `queries.*` cambia de visible a oculto y viceversa al cambiar el estado compartido.
- Confirmar que un nodo con `queryStateFeedback.mode: fallback` sigue mostrando el fallback cuando corresponde y no ejecuta una rama paralela de `visibility` sobre ese fallback.
- Confirmar que los nodos renderizados dentro de un `fallback` pueden declarar su propio `visibility` como cualquier otro `LayoutNode`, sin reabrir la rama original oculta ni alterar la precedencia principal.
- Confirmar que `queries.{queryName}.status`, `queries.{queryName}.error` y rutas anidadas bajo `queries.{queryName}.data.*` pueden controlar visibilidad visible en render.
- Confirmar que comparaciones por longitud sobre arrays vacíos y arrays con elementos activan o desactivan el render según el operador declarado, mientras que objetos y strings en esas mismas comparaciones no generan match implícito.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo comportamiento visible transversal del renderer.

### Criterios de finalización
- El dispatcher central es el único borde de render que decide si un nodo se muestra, se oculta o delega en fallback con la nueva semántica.
- Ningún nodo visual concreto reimplementa la evaluación de `visibility`.
- La convivencia observable entre `queryStateFeedback` y `visibility` queda cerrada por tests de render.

### Cierre de implementación
Completado cuando el renderer soporta `visibility` de extremo a extremo para todos los nodos ya admitidos, reutilizando la semántica compartida sin ramas divergentes.

### Cierre documental
Pendiente de una pasada posterior sobre runtime visible y estado actual. No se cierra en esta tarea.

## T0019-04

### Estado
Completada

### Objetivo
Integrar la visibilidad efectiva en formularios para que la inicialización lazy, la validación `required`, la conservación del estado local y el submit compartan exactamente la misma semántica de campos visibles y ocultos.

### Fuera de alcance
- Cambiar la política de persistencia del estado local al ocultar o reexponer campos.
- Introducir validaciones declarativas nuevas fuera de `required`.
- Añadir comportamientos de limpieza automática de errores, `dirty` o `touched` fuera de la semántica actual.
- Actualizar documentación funcional o arquitectónica en esta tarea.

### Dependencias
- `T0019-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-layout-visibility.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si hace falta un helper explícito para leer el estado de campos visibles sin duplicar traversal
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta tipar mejor el resultado compartido consumido por formularios
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx` solo si conviene fijar desde el mismo escenario la reaparición visible de campos ya inicializados
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que un campo `required` oculto por `visibility` no bloquea el submit mientras permanezca oculto.
- Confirmar que un campo oculto por `visibility` conserva `value`, `error`, `dirty`, `touched` y `defaultValue` ya inicializados.
- Confirmar que al volver a ser visible, el campo reutiliza su estado local existente y vuelve a participar en la validación normal.
- Confirmar que un campo visible por primera vez puede inicializarse lazy aunque el resto del formulario ya exista en store.
- Confirmar que la combinación `queryStateFeedback + visibility` sobre un campo usa exactamente la misma precedencia que el renderer.
- Confirmar que `greaterThan` y `lessThan` pueden gobernar visibilidad de campos según números o longitud de colecciones sin romper `select`, `input` o `textarea`.
- Confirmar que errores persistidos de un campo oculto dejan de bloquear el submit mientras el campo no sea visible.
- Confirmar que el submit sigue leyendo el snapshot más reciente del runtime después de la validación local y antes de ejecutar `submitAction`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva semántica visible de formularios y validación.

### Criterios de finalización
- Formularios reutilizan exactamente la misma utilidad de visibilidad efectiva que el renderer.
- La inicialización lazy y la validación `required` dejan de depender solo de `queryStateFeedback`.
- La conservación del estado local al ocultar y reexponer campos queda fijada por tests sin introducir una política de limpieza nueva.

### Cierre de implementación
Completado cuando los formularios soportan campos ocultables por `visibility` con semántica coherente entre render, inicialización, validación y submit.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, arquitectura y estado actual. No se cierra en esta tarea.

## T0019-05

### Estado
Completada

### Objetivo
Cerrar la regresión final del subconjunto afectado validando conjuntamente contrato, helper compartido, renderer, formularios, compatibilidad hacia atrás y gate global de coverage del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de semántica ya fijadas por las tareas anteriores.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0019-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-layout-visibility.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si quedó cubriendo un borde real de referencias reutilizado por `visibility`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato ampliado, de la utilidad compartida y de la integración visible en renderer y formularios.
- Confirmar que nodos y campos sin `visibility` conservan su comportamiento observable previo.
- Confirmar que referencias válidas pero ausentes no rompen render, validación ni submit y siguen una semántica estable según operador.
- Confirmar que la precedencia entre `queryStateFeedback` y `visibility` se mantiene igual en helpers, render y formularios.
- Confirmar que comparaciones sobre números y longitudes de colección no introducen coerciones implícitas ni errores de ejecución.
- Ejecutar `pnpm test` para validar el gate global de coverage del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, runtime, queries, formularios y estado actual.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, helper compartido, renderer y formularios respecto a `visibility`.
- La compatibilidad hacia atrás del runtime queda fijada por regresión.
- El subconjunto afectado del runtime queda validado por tests relevantes y por el gate global de coverage.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, sin divergencias entre capas y con regresión suficiente para evitar reinterpretaciones futuras del contrato.

### Cierre documental
Pendiente de una pasada posterior sobre fichas funcionales, arquitectura y estado global. No se cierra en esta tarea.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0019-01`.

No se debe empezar `T0019-02` hasta cerrar `T0019-01`, ni `T0019-03` hasta cerrar `T0019-02`, ni `T0019-04` hasta cerrar `T0019-03`, ni `T0019-05` hasta cerrar `T0019-04`.
