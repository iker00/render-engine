# Tasks: Query-driven repeated layout node

## Resultado de revisión

Las decisiones que podían abrir implementaciones divergentes ya quedaron cerradas en `design.md`:

- el nuevo nodo público será `repeater` y no una sobrecarga de `container`
- la colección solo puede venir de `queries.{queryName}.data` o `queries.{queryName}.data.*`
- el contexto local por iteración entra como namespace acotado `item` y no como un sistema general de scopes
- la plantilla repetida vive en `props.template` como `LayoutNode[]`
- la identidad por iteración se resuelve con `props.items.key` como ruta relativa obligatoria

Con ese diseño, la siguiente tarea que debe ejecutarse es `T0024-01`.

## T0024-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para introducir el nodo `repeater`, fijar de forma inequívoca su shape público y rechazar antes del render las configuraciones estructuralmente incompatibles con la feature.

La tarea debe dejar cerrado este contrato:
- `type: 'repeater'`
- `props.items.source` limitado a `queries.{queryName}.data` o `queries.{queryName}.data.*`
- `props.items.key` como ruta relativa no vacía al item actual
- `props.template` como colección obligatoria `LayoutNode[]`
- `repeater` sin `children`, usando solo `props.template`

### Fuera de alcance
- Resolver todavía `item.*` en runtime.
- Renderizar todavía iteraciones visibles.
- Pasar todavía contexto de iteración a renderer, formularios o acciones.
- Introducir todavía diagnósticos runtime de keys inválidas o duplicadas por dato real.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos nuevos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el resultado normalizado desde la fachada pública
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `repeater` acepta `props.items.source`, `props.items.key` y `props.template` con el shape acordado.
- Confirmar que `props.items.source` acepta solo referencias completas `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- Confirmar que `props.items.key` rechaza string vacío, referencias completas como `item.id` o `queries.posts.data.0.id`, y rutas relativas mal formadas.
- Confirmar que `props.template` exige un array y reutiliza el mismo catálogo de `LayoutNode` ya soportado por el runtime.
- Confirmar que `repeater` rechaza combinaciones ambiguas como `children` junto con `props.template` o la ausencia de cualquiera de los campos obligatorios.
- Confirmar que una configuración existente sin `repeater` conserva exactamente el resultado normalizado actual.
- Confirmar que las claves extra siguen descartándose sin abrir semántica nueva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo nodo declarativo del contrato JSON.

### Criterios de finalización
- El shape público de `repeater` queda fijado por tipos, validación `Zod` y validación semántica previa al render.
- Bootstrap puede distinguir de forma determinista entre config válido, config inválido y dato runtime todavía ausente.
- El contrato no deja decisiones estructurales para el renderer.
- La compatibilidad hacia atrás del layout vigente queda fijada por tests.

### Cierre de implementación
Completado cuando el borde `config/` acepta y rechaza `repeater` de forma inequívoca sin delegar al runtime decisiones contractuales críticas.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, runtime y estado actual. No se cierra en esta tarea.

## T0024-02

### Estado
Completada

### Objetivo
Extender la capa central de referencias del runtime para soportar `item` e `item.*` solo dentro de un contexto explícito de iteración, reutilizando la misma semántica de navegación segura por objetos y arrays ya establecida para `queries.{queryName}.data.*`.

La tarea debe cerrar explícitamente:
- parsing y tipado del namespace `item`
- resolución segura de `item` e `item.*`
- degradación a `missing` cuando la ruta es válida pero el dato no existe o no es navegable
- diagnóstico de desarrollo cuando `item.*` se usa fuera de un `repeater`

### Fuera de alcance
- Renderizar todavía el nodo `repeater`.
- Expandir todavía el árbol declarativo por iteración.
- Conectar todavía botones, navegación, requests o formularios al contexto de iteración.
- Resolver todavía keys efectivas por item en el renderer.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0024-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-types.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts`
  - `src/runtime/runtime-layout-visibility.ts`
  - `src/runtime/runtime-collection-sources.ts` solo si hace falta preparar la resolución de `item.*` en orígenes descendientes
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-layout-visibility.test.ts`
  - `src/tests/runtime-state.test.tsx` solo si conviene fijar un helper compartido desde un harness ya existente
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que `item` resuelve el valor completo de la iteración actual.
- Confirmar que `item.slug`, `item.author.name` y rutas con índices sobre arrays reutilizan la misma semántica de navegación ya soportada en `queries.*.data.*`.
- Confirmar que usar `item.*` sin contexto de iteración produce `unsupported` o `missing` estable según el diseño elegido, con diagnóstico de desarrollo coherente.
- Confirmar que una ruta válida sobre un item parcial, `null` o no navegable degrada a `missing` y no a error fatal.
- Confirmar que `forms.*`, `queries.*` y `params.*` siguen resolviéndose igual cuando no existe contexto de iteración.
- Confirmar que `visibility.reference` puede evaluar `item.*` dentro del subárbol iterado sin cambiar la precedencia vigente con `queryStateFeedback`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el namespace `item` y su límite estricto de uso.

### Criterios de finalización
- La resolución de `item.*` vive en un único punto de verdad junto al resto de referencias del runtime.
- La semántica de uso dentro y fuera de contexto queda fijada por tests.
- La feature no abre un sistema global de variables ni un segundo parser ad hoc dentro de nodos concretos.

### Cierre de implementación
Completado cuando el runtime puede entender `item.*` como referencia soportada solo con contexto explícito de iteración y conserva intacta la semántica del resto de namespaces.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura y runtime. No se cierra en esta tarea.

## T0024-03

### Estado
Completada

### Objetivo
Integrar `repeater` en el renderer central como expansión estructural del árbol declarativo, evaluando su propia visibilidad efectiva, resolviendo la colección origen y renderizando `props.template` una vez por item con contexto de iteración y keys derivadas de `props.items.key`.

### Fuera de alcance
- Conectar todavía acciones declarativas, `defaultValue` o request params al contexto de iteración en todos los consumidores interactivos.
- Introducir todavía una política nueva de feedback visual distinta de `queryStateFeedback`.
- Abrir todavía fuentes nuevas de colección fuera de `queries.*`.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0024-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-renderer.tsx`
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/repeater-layout-node.tsx`
  - `src/runtime/runtime-collection-sources.ts`
  - `src/runtime/runtime-layout-visibility.ts` solo si hace falta propagar contexto de iteración al resolver `queryStateFeedback` y `visibility`
  - `src/config/runtime-config.ts` solo si hace falta reexportar el tipo nuevo del nodo
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx` solo si conviene fijar desde el store una transición visible de la query origen
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que un `repeater` con una query que devuelve objetos renderiza una iteración visible por item respetando el orden de la colección.
- Confirmar que `heading` y `paragraph` dentro de `props.template` leen `item.*` correcto para cada iteración y no reutilizan datos de otro item.
- Confirmar que una query ausente, fallida, vacía o cuya ruta resuelve un valor no array degrada a cero iteraciones sin romper el render.
- Confirmar que `queryStateFeedback` sobre el propio `repeater` sigue siendo el mecanismo suficiente para loading, error, empty e idle alrededor del bloque repetido.
- Confirmar que `visibility` sobre el propio `repeater` y sobre nodos descendientes iterados mantiene la precedencia vigente.
- Confirmar que un item escalar puede renderizarse usando `item` completo y que un acceso incompatible como `item.title` degrada solo ese consumidor.
- Confirmar que keys nulas, no escalares o duplicadas emiten diagnóstico de desarrollo y activan la degradación segura definida en diseño sin introducir una heurística contractual nueva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `repeater` como expansión estructural del layout y su degradación a cero iteraciones.

### Criterios de finalización
- El renderer central soporta `repeater` sin crear un wrapper visual obligatorio ni duplicar semántica en nodos descendientes.
- La expansión por iteración y la identidad por `props.items.key` quedan fijadas por tests.
- `queryStateFeedback` y `visibility` siguen resolviéndose desde el borde transversal ya existente.

### Cierre de implementación
Completado cuando el runtime puede expandir un subárbol `template` por item de una query y mantener un render estable, seguro y coherente con el resto del layout.

### Cierre documental
Pendiente de una pasada posterior sobre runtime visible, queries y estado actual. No se cierra en esta tarea.

## T0024-04

### Estado
Completada

### Objetivo
Conectar el contexto de iteración a los consumidores interactivos y dinámicos que ya reutilizan la capa común de referencias, para que `item.*` funcione de extremo a extremo dentro de navegación, acciones remotas de `button`, `form.submitAction`, `defaultValue` de campos y consumidores descendientes de colecciones dentro del `template`.

### Fuera de alcance
- Abrir generación dinámica de `formId`, `fieldId` u otros identificadores estructurales.
- Añadir nodos visuales nuevos, interpolación parcial de strings o una DSL de plantillas.
- Cambiar el contrato de `preloads`, `goBack` o `queryStateFeedback`.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `T0024-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/queries/runtime-api-request.ts`
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/nodes/button-layout-node.tsx` solo si hace falta propagar explícitamente el contexto al ejecutor común
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/nodes/heading-layout-node.tsx`
  - `src/runtime/nodes/paragraph-layout-node.tsx`
  - `src/runtime/runtime-collection-sources.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si hace falta completar helpers compartidos para valores no textuales
- Tests a crear o modificar:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `button.props.action.type: navigateTo` dentro de un `repeater` transporta params resueltos desde `item.*` para la iteración correcta.
- Confirmar que `button.props.action.type: executeOperation` dentro de un `repeater` resuelve `query`, `body` y `headers` con el snapshot correcto del item actual.
- Confirmar que `form.submitAction.type: executeOperation` dentro de un `repeater` resuelve `query`, `body` y `headers` con el snapshot correcto del item actual, sin perder la semántica actual de submit y `resetOnSuccess`.
- Confirmar que `defaultValue` de campos dentro de un `repeater` puede leer `item.*` en su primera inicialización efectiva sin rehidratarse durante rerenders ordinarios.
- Confirmar que un `list`, `select`, `radioGroup` o `checkboxGroup` dentro del `template` puede usar `item.*` en sus rutas relativas declarativas cuando el diseño lo permita y degrada a vacío cuando el dato no es utilizable.
- Confirmar que `forms.*`, `queries.*` y `params.*` siguen disponibles dentro del subárbol repetido y no quedan eclipsados por `item.*`.
- Confirmar que un consumidor descendiente con dato parcial degrada solo su propio resultado y no rompe la iteración ni el resto del `repeater`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el alcance funcional de `item.*` en acciones, formularios y consumidores descendientes.

### Criterios de finalización
- `item.*` funciona de forma coherente en todas las superficies declarativas mínimas comprometidas por la spec y el diseño.
- La integración reutiliza la capa común de referencias y no introduce ramas manuales por consumidor.
- La semántica de degradación local sigue siendo consistente entre texto, acciones, formularios y colecciones descendientes.

### Cierre de implementación
Completado cuando el subárbol iterado puede disparar navegación, requests desde `button` y `form`, y defaults dependientes del item actual sin reinterpretar el contrato en cada consumidor.

### Cierre documental
Pendiente de una pasada posterior sobre navegación, formularios, queries y estado actual. No se cierra en esta tarea.

## T0024-05

### Estado
Completada

### Objetivo
Cerrar la regresión integrada del subconjunto afectado validando conjuntamente contrato, referencias `item.*`, renderer, acciones por iteración, formularios, degradación segura y gate global de coverage del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir decisiones contractuales o de diseño ya cerradas en `T0024-01` a `T0024-04`.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0024-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/`, `src/queries/` o `src/tests/` necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` si participa en la regresión contractual final
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-layout-visibility.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Confirmar en conjunto que el config acepta `repeater` y rechaza usos fuera de alcance con diagnósticos trazables.
- Confirmar que `item.*` funciona dentro del `repeater` y sigue fuera de alcance fuera de él.
- Confirmar que el runtime conserva compatibilidad hacia atrás en pantallas que no usan `repeater`.
- Confirmar que una query con dato no coleccionable o items parciales no rompe renderer, navegación, requests ni formularios.
- Confirmar que `form.submitAction` dentro de `repeater` queda cubierto en la regresión final junto con `button.props.action`.
- Confirmar que `queryStateFeedback` sigue siendo el único mecanismo de feedback visible alrededor de la query origen.
- Ejecutar el subconjunto relevante de `vitest` durante la tarea y cerrar la pasada con `pnpm test`, manteniendo el mínimo global del 80% de coverage sobre `src/`.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, runtime, queries, navegación y formularios.

### Criterios de finalización
- El alcance funcional completo queda validado sin regresiones abiertas en contrato, renderer, referencias ni consumidores interactivos.
- La compatibilidad hacia atrás queda fijada por regresión.
- El gate global de tests y coverage queda en verde.
- No quedan tareas técnicas de implementación dentro del alcance acordado.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo con el gate global del repositorio intacto.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## Orden de ejecución

La secuencia de implementación queda cerrada en este orden:

1. `T0024-01`
2. `T0024-02`
3. `T0024-03`
4. `T0024-04`
5. `T0024-05`

La siguiente tarea que debe escogerse al empezar la implementación es `T0024-01`.
