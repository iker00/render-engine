# Tasks: Declarative query state feedback

> Nota histórica: estas tareas reflejan el contrato de implementación original de `0013`. La semántica vigente fue reemplazada por `0016-query-state-feedback-idle-state`, que separa `idle` de `loading`.

## T0013-01

### Estado
Completada

### Objetivo
Extender el contrato del runtime config para soportar `queryStateFeedback` como bloque opcional y transversal por nodo, fijando el shape exacto de `query`, `states`, `mode` y `fallback`, y rechazando antes del render cualquier fallback estructuralmente inválido.

### Fuera de alcance
- Calcular todavía la semántica runtime de `loading`, `error`, `empty` y `success`.
- Integrar todavía el feedback en el renderer visible.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.
- Abrir referencias nuevas fuera del dominio existente `queries.{queryName}`.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si la fachada pública necesita exportar los nuevos tipos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde del bootstrap con errores visibles del nuevo bloque
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que un nodo puede declarar `queryStateFeedback.query` con un nombre de query no vacío y sin exigir que la operación exista en `api`.
- Confirmar que `states` acepta solo `loading`, `error`, `empty` y `success`.
- Confirmar que un nombre de estado desconocido dentro de `states` rechaza el config completo en lugar de descartarse silenciosamente.
- Confirmar que cada estado acepta `mode: show` y `mode: hide` sin `fallback`.
- Confirmar que `mode: fallback` exige `fallback` y que esa rama acepta una colección ordenada de nodos soportados.
- Confirmar que un fallback puede contener varios nodos hermanos sin wrapper sintético.
- Confirmar que un fallback inválido por shape o por `type` no soportado rechaza el config completo antes del render.
- Confirmar que las claves extra de la raíz del bloque y de sus reglas se descartan del objeto validado final sin abrir semántica nueva.
- Confirmar que una configuración previa sin `queryStateFeedback` mantiene exactamente el resultado normalizado actual.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo bloque transversal del contrato JSON y su validación previa al render.

### Criterios de finalización
- `LayoutNode` incorpora `queryStateFeedback` con un shape inequívoco y exportado.
- La validación estructural acepta solo los modos y estados soportados.
- Los nombres de estado no soportados fallan con error de config y no se degradan a no-op silencioso.
- El contrato deja fijado que `fallback` reutiliza `LayoutNode[]` y no un nodo único ni un wrapper artificial.
- Los fallbacks inválidos se rechazan en bootstrap y no quedan diferidos al renderer.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando el JSON del runtime ya puede describir feedback declarativo por estado de query de forma inequívoca y validada, sin dejar decisiones abiertas sobre el shape del bloque ni sobre la forma del fallback.

### Cierre documental
Pendiente de una pasada posterior para actualizar la documentación funcional del contrato y del runtime. No se cierra en esta tarea.

## T0013-02

### Estado
Completada

### Objetivo
Introducir una capa explícita del runtime que derive el estado visible de una query (`loading | error | empty | success`), aplique la heurística común de vacío y resuelva la respuesta efectiva del nodo (`show | hide | fallback`) con los defaults contractuales de la feature.

### Fuera de alcance
- Renderizar todavía fallbacks visibles dentro del árbol React final.
- Reorganizar el store de `queries` o cambiar la semántica de ejecución remota ya existente.
- Añadir reglas configurables de emptiness por dominio o por query.
- Abrir navegación declarativa adicional sobre `error.*`, `status.*` o `pageEntry.*`.

### Dependencias
- `T0013-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta exportar tipos auxiliares de estado visible
  - `src/runtime/` con una utilidad nueva para resolver `queryStateFeedback`, por ejemplo `runtime-query-state-feedback.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si la implementación necesita compartir utilidades sin mezclar superficies textuales y feedback
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/layout-renderer.test.tsx` solo si conviene fijar ya parte de la semántica desde el borde del renderer
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `queries.{queryName}.status: idle` proyecta el estado visible `loading`.
- Confirmar que `status: loading` con `data` previo conservado sigue proyectando `loading`.
- Confirmar que `status: error` proyecta `error`.
- Confirmar que `status: success` con `data: null`, `undefined`, `''`, `[]` y `{}` proyecta `empty`.
- Confirmar que `status: success` con `0`, `false`, strings no vacíos, arrays con elementos u objetos con claves proyecta `success`.
- Confirmar que la ausencia total de `queries.{queryName}` en el store se trata como rama equivalente a `loading`.
- Confirmar que, sin reglas explícitas, los defaults efectivos son `success -> show` y `loading/error/empty -> hide`.
- Confirmar que una regla explícita por estado sobrescribe el default sin afectar a los demás estados no declarados.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la semántica visible uniforme y la heurística común de `empty`.

### Criterios de finalización
- Existe una capa única y testeada que deriva el estado visible de la query.
- La heurística de `empty` queda fijada por tests y no se reparte entre componentes.
- La resolución de respuesta efectiva del nodo es determinista y no depende del tipo de nodo concreto.
- La tarea deja explícitamente diferida a `T0013-03` la conexión final con el renderer React.

### Cierre de implementación
Completado cuando la semántica compartida de estado visible y respuesta efectiva ya está cerrada y validada, sin trabajo ambiguo pendiente sobre `idle`, `loading` con dato previo o detección de vacío.

### Cierre documental
Pendiente de una pasada posterior sobre arquitectura, estado actual y fichas funcionales. No se cierra en esta tarea.

## T0013-03

### Estado
Completada

### Objetivo
Integrar `queryStateFeedback` en el renderer central del runtime para que cada nodo pueda mostrarse, ocultarse o sustituirse por un fallback local reutilizando `LayoutRenderer`, sin mezclar la lógica transversal en `heading`, `paragraph`, `list`, `button` o `container`.

### Fuera de alcance
- Introducir un motor general de visibilidad no ligado a queries.
- Abrir nuevos nodos visuales dedicados como `skeleton`.
- Reescribir el dispatcher de nodos más allá de la integración necesaria del nuevo borde de feedback.
- Actualizar documentación en esta misma tarea.

### Dependencias
- `T0013-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/layout-renderer.tsx`
  - `src/runtime/nodes/container-layout-node.tsx` solo si la integración exige ajustar su punto de render de hijos
  - `src/runtime/nodes/heading-layout-node.tsx` solo si hace falta una adaptación mínima de imports o props
  - `src/runtime/nodes/paragraph-layout-node.tsx` solo si hace falta una adaptación mínima de imports o props
  - `src/runtime/nodes/list-layout-node.tsx` solo si hace falta una adaptación mínima de imports o props
  - `src/runtime/nodes/button-layout-node.tsx` solo si hace falta una adaptación mínima de imports o props
  - `src/runtime/` con el helper de feedback introducido en `T0013-02`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si conviene fijar que `button` también respeta el nuevo borde
  - `src/tests/runtime-page-entry-preloads.test.tsx` solo si se necesita cubrir transición visible durante preloads reales
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-contract.md`

### Tests requeridos
- Confirmar que un nodo sin `queryStateFeedback` mantiene su render actual sin cambios.
- Confirmar que un nodo con rama `loading: hide` no se renderiza mientras la query esté en `idle` o `loading`.
- Confirmar que un nodo con `loading: fallback` renderiza la colección fallback y que desaparece al pasar a `success` con datos no vacíos.
- Confirmar que un nodo con `error: fallback` sustituye al nodo original cuando la query falla.
- Confirmar que un nodo configurado solo para `success` no se renderiza en `loading`, `error` y `empty`.
- Confirmar que un fallback con varios nodos conserva su orden declarado.
- Confirmar que varios nodos distintos pueden reaccionar de forma distinta al mismo `queryName` sin colisionar entre sí.
- Confirmar que una recarga que vuelve a `loading` con `data` previo hace reaparecer la rama de `loading`.
- Confirmar que `button` y el resto del catálogo soportado pueden seguir usando esta capacidad sin introducir divergencia por tipo de nodo.

### Documentación afectada
- Pendiente de actualización posterior sobre renderer declarativo y feedback visual por query.

### Criterios de finalización
- El renderer central decide de forma única si muestra el nodo original, nada o el fallback local.
- Los fallbacks reutilizan `LayoutRenderer` y no crean un dialecto visual separado.
- La integración no mueve lógica de negocio a nodos visuales concretos.
- Varios nodos pueden escuchar la misma query con respuestas distintas y deterministas.
- Los tests de integración relevantes del renderer quedan en verde.

### Cierre de implementación
Completado cuando la capacidad declarativa ya funciona de extremo a extremo desde el JSON validado hasta el render visible del runtime, sin trabajo técnico ambiguo sobre dónde vive la decisión de feedback.

### Cierre documental
Pendiente de una pasada posterior para actualizar fichas funcionales, arquitectura y estado actual. No se cierra en esta tarea.

## T0013-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature validando conjuntamente contrato, semántica de estado visible, render alternativo local y compatibilidad con `preloads`, recargas y gate global de cobertura del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Realizar en esta tarea la pasada documental amplia.
- Reabrir decisiones de shape o semántica ya fijadas en `design.md`.

### Dependencias
- `T0013-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si hay cobertura real del catálogo completo
  - `src/tests/app-shell.test.tsx` solo si el cierre detecta impacto visible en el arranque del runtime
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato de `queryStateFeedback`, de la derivación `loading/error/empty/success` y del renderer con fallback local.
- Confirmar que una configuración previa sin `queryStateFeedback` conserva su comportamiento observable.
- Confirmar que las queries disparadas por `preloads` y las disparadas manualmente comparten exactamente la misma semántica visual.
- Confirmar que un `queryName` inexistente o nunca ejecutado mantiene la rama equivalente a `loading` sin romper el runtime.
- Confirmar que los fallbacks inválidos siguen fallando antes del render y no como error recuperable tardío.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, runtime y queries.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, semántica compartida de query state feedback y renderer visible.
- Las configuraciones previas sin feedback por estado siguen siendo compatibles.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0013-01`.

No se debe empezar `T0013-02` hasta cerrar `T0013-01`, ni `T0013-03` hasta cerrar `T0013-02`, ni `T0013-04` hasta cerrar `T0013-03`.
