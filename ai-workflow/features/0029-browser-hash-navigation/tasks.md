# Tasks: Browser hash navigation

## Resultado de revisión

La feature mantiene `design.md` como artefacto obligatorio y suficiente, con una precisión adicional ya incorporada para cerrar dos decisiones que no debían quedar implícitas durante la implementación:
- la normalización canónica del hash usa `#/` para home, orden lexicográfico de query params y omite claves ausentes, `null` o no escalares
- el runtime conserva una traza interna mínima de navegación para no romper `pageEntry`, selectores y tests existentes, pero atrás/adelante pasan a depender del historial real del navegador

Con esas decisiones, la implementación puede ejecutarse sin rediseñar ni el contrato visible ni la convivencia entre URL, store y `preloads`. La siguiente tarea que debe escogerse es `T0029-01`.

## T0029-01

### Estado
Completada

### Objetivo
Introducir una frontera explícita y testeada para parsear, normalizar, comparar y serializar la navegación basada en hash, de modo que toda la feature reutilice una única semántica canónica para `#/pageId`, `#/`, query params string y equivalencia entre entradas.

### Fuera de alcance
- Sincronizar todavía el provider React con `window.location.hash`.
- Cambiar todavía la orquestación de `preloads`, `goBack` o el arranque del runtime.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-navigation/browser-hash-navigation.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta introducir un tipo compartido para la entrada normalizada derivada del hash
- Tests a crear o modificar:
  - `src/tests/runtime-browser-hash-navigation.test.ts`
  - `src/tests/runtime-state.test.tsx` solo si conviene fijar desde ya la equivalencia semántica de params reutilizable por el provider
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar parseo válido de `#/`, `#/pageId`, `#/?k=v` y `#/pageId?k=v`.
- Confirmar que ausencia de hash o `#` degradan a home normalizada `#/`.
- Confirmar que slugs inválidos, formatos fuera de contrato o páginas inexistentes se degradan al mismo fallback normalizado.
- Confirmar que todos los params leídos desde URL quedan como string.
- Confirmar que un param sin valor explícito se interpreta como `''`.
- Confirmar que claves repetidas se colapsan conservando la última ocurrencia.
- Confirmar que la serialización omite params `null`, ausentes o no escalares.
- Confirmar que dos entradas con mismos pares clave-valor en distinto orden son equivalentes y producen el mismo hash canónico.
- Confirmar que la home con params se serializa como `#/?...` y nunca como `#/initialPage?...`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva convención visible de URL y su normalización estable.

### Criterios de finalización
- Existe una única capa reutilizable que transforma hash del navegador en entrada normalizada y viceversa.
- La comparación semántica de entradas deja de depender del orden textual de los query params.
- El fallback de rutas inválidas queda fijado por tests antes de tocar el provider.
- No queda lógica de parseo o serialización dispersa entre acciones UI, reducer y efectos React.

### Cierre de implementación
Completado cuando la semántica canónica del hash queda fijada por tests unitarios y lista para ser consumida por la capa de estado.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0029-02

### Estado
Completada

### Objetivo
Rehacer la integración de navegación del runtime para que el hash del navegador sea la fuente observable de la entrada activa, manteniendo `pageEntry` y la semántica de `preloads`, delegando `goBack` en el browser y conservando una traza interna mínima coherente con la URL normalizada.

### Fuera de alcance
- Cambiar el contrato declarativo de `navigateTo.params` más allá de reflejarlo en la URL.
- Abrir routing por `pathname`, subrutas, `routeParams.*` o 404 visibles de producto.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `T0029-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-navigation/browser-hash-navigation.ts`
  - `src/runtime/runtime-actions/runtime-navigation-action-executor.ts` solo si la firma del handler necesita reflejar mejor la nueva fuente de verdad
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts` solo si la navegación declarativa necesita pasar metadatos adicionales a la capa de estado
  - `src/runtime/nodes/form-layout-node.tsx` solo si la detección de desmontaje real debe apoyarse en la entrada activa derivada del hash en lugar de la heurística actual
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx` solo si cambia la forma en que el ejecutor delega `navigateTo` y `goBack`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que el arranque sin hash o con `#` activa `initialPage` y normaliza la URL a `#/`.
- Confirmar que una entrada directa con `#/pageId` o `#/pageId?...` renderiza esa página y expone sus params.
- Confirmar que una entrada válida pero no canónica, por ejemplo con params en orden distinto al canónico, se reescribe al hash canónico sin cambiar la entrada observable.
- Confirmar que `navigateTo` escribe el hash canónico esperado para home y para páginas no home.
- Confirmar que navegar a la misma página con params equivalentes no crea nueva entrada observable ni relanza `preloads`.
- Confirmar que navegar a la misma página con params distintos sí crea una nueva entrada observable y relanza `preloads` cuando aplique.
- Confirmar que un `hashchange` hacia la entrada previa inmediata reutiliza la semántica de vuelta y reactiva `pageEntry` con los params correctos.
- Confirmar que un `hashchange` hacia una entrada futura ya observada reactiva esa entrada sin duplicarla en la traza interna.
- Confirmar que atrás y adelante del navegador restauran la página visible y los `params.*` correctos.
- Confirmar que `goBack` solo delega al historial del navegador cuando la sesión actual conoce una entrada previa utilizable y que, en una entrada directa sin historial propio observado, actúa como no-op visible.
- Confirmar que un hash inválido o una página inexistente redirigen a `#/` sin dejar slugs inválidos persistidos.
- Confirmar que los `preloads` arrancan desde estado limpio también cuando la reentrada viene del historial del navegador.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que la URL deja de ser un detalle ignorado y pasa a formar parte del contrato funcional.

### Criterios de finalización
- La página visible y `params.*` derivan siempre de la entrada normalizada del hash.
- `pageEntry` conserva su papel como unidad de reentrada y orquestación de `preloads`.
- El runtime deja de depender de una pila interna autónoma para resolver atrás/adelante.
- La traza interna residual distingue posición actual y entradas observadas suficientes para no sacar al usuario fuera de la app al ejecutar `goBack` desde una entrada directa.
- La URL canónica, la entrada activa y los efectos de reentrada no divergen entre sí.

### Cierre de implementación
Completado cuando la sincronización real con el navegador funciona en arranque, navegación declarativa y atrás/adelante, con tests de integración relevantes en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0029-03

### Estado
Completada

### Objetivo
Cerrar las regresiones transversales que dependen de `params.*`, de la resolución desde la entrada activa y de la normalización del hash, asegurando que referencias, formularios, requests declarativos y reentradas históricas siguen produciendo resultados funcionalmente equivalentes al contrato previsto.

### Fuera de alcance
- Introducir nuevos consumidores de `params.*` fuera de las superficies ya soportadas.
- Abrir soporte para arrays u objetos en query string.
- Hacer todavía la pasada documental amplia de la feature.

### Dependencias
- `T0029-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts` solo si hace falta endurecer diagnósticos o mantener explícita la frontera `params.{paramName}`
  - `src/queries/runtime-api-request.ts` solo si la normalización de params visibles afecta a la construcción declarativa de requests
  - `src/runtime/nodes/form-layout-node.tsx` solo para ajustes residuales detectados por reentrada real con params desde URL
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo para ajustes residuales detectados por regresión
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-button-navigation.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `params.*` sigue admitiendo solo `params.{paramName}` y ahora lee valores string llegados desde URL.
- Confirmar que textos visibles, `defaultValue` de formularios y nuevas navegaciones encadenadas consumen los params restaurados desde hash sin coerciones implícitas.
- Confirmar que requests declarativos y `preloads` siguen resolviendo `params.*` contra el snapshot correcto de la entrada activa.
- Confirmar que reentradas históricas con distinto orden textual de query params no disparan entradas observables redundantes.
- Confirmar que los hashes canónicos con params vacíos, repetidos o parcialmente omitidos no rompen las superficies ya soportadas del runtime.
- Confirmar que las regresiones del subárbol de formularios y de navegación con `repeater` siguen cubiertas tras el cambio de source of truth.
- Confirmar el subconjunto completo afectado antes del cierre global.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la continuidad de `params.*` como único namespace funcional y sus nuevos orígenes desde URL.

### Criterios de finalización
- Las superficies que ya consumían `params.*` mantienen un comportamiento coherente tras el cambio de fuente de verdad.
- No aparecen coerciones nuevas entre params declarados por navegación interna y params leídos desde URL.
- La regresión transversal queda cerrada con tests de referencias, renderer y requests en verde.
- El subconjunto afectado deja de depender de supuestos de historial interno ya obsoletos.

### Cierre de implementación
Completado cuando las regresiones transversales de `params.*`, formularios, requests y navegación repetida quedan cubiertas por tests relevantes en verde, y la feature puede cerrar con `pnpm test`.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0029-04

### Estado
Completada

### Objetivo
Actualizar la documentación funcional, técnica y de estado para dejar explícito que la navegación del runtime ya se sincroniza con el hash del navegador, que `params.*` puede venir de la URL y que la restricción histórica de v1 sobre “no modificar la URL” deja de aplicar.

### Fuera de alcance
- Reabrir decisiones de contrato o implementación ya cerradas.
- Convertir `README.md` en historial de cambios.
- Introducir alcance nuevo de routing o namespaces de parámetros adicionales.

### Dependencias
- `T0029-03` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/context.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0029-browser-hash-navigation/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0029-03` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable describe la URL canónica `#/` y `#/pageId`, el papel de `params.*` y la delegación de atrás/adelante al navegador sin contradicciones.
- Queda retirada o corregida la restricción previa que afirmaba que la navegación inicial no modificaba la URL del navegador.
- `status.yaml` refleja correctamente el paso posterior de documentación o el cierre final real de la feature.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0029-03`.

### Cierre documental
Completado cuando la documentación funcional, técnica y el estado del workflow quedan actualizados de forma consistente.
