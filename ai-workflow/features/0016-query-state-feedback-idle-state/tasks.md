# Tasks: Query state feedback idle state

## T0016-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para que `queryStateFeedback.states` admita `idle` como estado visible soportado de primera clase, alineado con `queries.{queryName}.status: idle`.

### Fuera de alcance
- Cambiar todavía la derivación runtime que hoy proyecta `idle` y query ausente como `loading`.
- Integrar todavía la nueva semántica en el renderer o en la validación de formularios.
- Añadir estados visibles nuevos fuera de `idle`.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si la fachada pública necesita exportar el tipo ampliado
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el borde de bootstrap con el contrato ampliado
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `queryStateFeedback.states` acepta `idle` además de `loading`, `error`, `empty` y `success`.
- Confirmar que `idle` admite `mode: show`, `mode: hide` y `mode: fallback` con la misma forma de `fallback` ya soportada por el resto de estados.
- Confirmar que una clave no soportada distinta de `idle`, por ejemplo `pending`, sigue rechazando el config completo.
- Confirmar que un fallback inválido bajo `states.idle` sigue rechazándose antes del render igual que en el resto de estados.
- Confirmar que una configuración previa sin `idle` conserva exactamente el resultado normalizado actual.
- Confirmar que las claves extra del bloque siguen descartándose sin abrir semántica nueva.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `idle` como estado visible soportado del contrato JSON.

### Criterios de finalización
- El tipo exportado de estados visibles de `queryStateFeedback` ya incluye `idle`.
- La validación estructural acepta `idle` y mantiene el rechazo explícito del resto de claves no soportadas.
- La semántica de `fallback` bajo `idle` queda fijada por tests y no introduce un shape especial.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando el contrato JSON ya puede describir reglas específicas para `idle` sin dejar ambigüedad sobre shape, validación ni compatibilidad hacia atrás.

### Cierre documental
Pendiente de una pasada posterior sobre contrato y queries. No se cierra en esta tarea.

## T0016-02

### Estado
Completada

### Objetivo
Cambiar la derivación compartida de `queryStateFeedback` para que `idle` represente solo una query no lanzada todavía, `loading` represente solo una ejecución en curso y una query ausente del store se evalúe como `idle`, manteniendo intacta la heurística actual de `empty` y la política uniforme de defaults por estados no declarados. Como el renderer central y la visibilidad efectiva de formularios ya consumen esta capa compartida, esta tarea debe cerrar también el cambio observable de extremo a extremo.

### Fuera de alcance
- Cambiar el shape público del dominio `queries`.
- Redefinir la heurística común de `empty`.
- Añadir una distinción nueva entre “query no declarada” y “query declarada pero no ejecutada” fuera de `queryStateFeedback`.
- Actualizar documentación en esta misma tarea.

### Dependencias
- `T0016-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-query-state-feedback.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hace falta un tipo auxiliar explícito para el estado visible ampliado
  - `src/runtime/layout-node-renderer.tsx` solo si aparece un ajuste real del borde común al integrar la nueva semántica
  - `src/runtime/nodes/form-layout-node.tsx` solo si aparece un ajuste real del borde común al integrar la nueva semántica
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx` si hace falta fijar la transición visible de `idle` a `loading` en precargas reales
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que `queries.{queryName}.status: idle` proyecta el estado visible `idle`.
- Confirmar que una query ausente del store proyecta igualmente `idle`.
- Confirmar que `status: loading` con o sin `data` previo conservado sigue proyectando `loading`.
- Confirmar que `status: error` sigue proyectando `error`.
- Confirmar que `status: success` con `null`, `undefined`, `''`, `[]` y `{}` sigue proyectando `empty`.
- Confirmar que `status: success` con `0`, `false`, strings no vacíos, arrays con elementos u objetos con claves sigue proyectando `success`.
- Confirmar que, sin reglas explícitas, `idle` sigue la política común de estados no declarados y no abre un default especial fuera del contrato.
- Confirmar que una regla explícita para `idle` sobrescribe solo ese estado y no altera `loading`, `error`, `empty` ni `success`.
- Confirmar en el renderer visible que `states.idle.mode: hide` y `states.idle.mode: fallback` dejan de reutilizar la rama `loading`.
- Confirmar que un campo `required` oculto por `states.idle` no bloquea el submit mientras la query observada siga sin lanzarse y vuelve a validarse cuando abandona `idle`.
- Confirmar que la misma semántica se mantiene para queries lanzadas por `preloads` y para queries lanzadas manualmente.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva derivación compartida `idle | loading | error | empty | success` y su efecto real en formularios.

### Criterios de finalización
- Existe una única capa compartida y testeada que deriva `idle` y `loading` sin mezclar “no lanzada” con “en ejecución”.
- La query ausente del store se resuelve de forma explícita y estable como `idle`.
- La heurística de `empty` y los defaults efectivos permanecen uniformes y fijados por tests.
- El cambio observable queda validado también en renderer y formularios sin abrir ramas paralelas fuera del helper compartido.

### Cierre de implementación
Completado cuando la semántica compartida de estados visibles queda cerrada y validada, incluido su efecto real sobre renderer y formularios.

### Cierre documental
Pendiente de una pasada posterior sobre queries, formularios, arquitectura y estado actual. No se cierra en esta tarea.

## T0016-03

### Estado
Completada

### Objetivo
Cerrar la regresión de integración de la feature y cualquier ajuste residual mínimo detectado tras `T0016-02`, validando conjuntamente contrato, derivación visible `idle | loading | error | empty | success`, renderer, formularios y compatibilidad con `preloads`, manteniendo el gate global de cobertura del proyecto.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Realizar en esta tarea la pasada documental amplia.
- Reabrir decisiones contractuales o semánticas ya fijadas por las tareas anteriores.

### Dependencias
- `T0016-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/app-shell.test.tsx` solo si aparece impacto real en bootstrap o render inicial
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato ampliado, de la derivación compartida y de la integración visible con formularios.
- Confirmar que configuraciones previas sin `states.idle` conservan su comportamiento observable salvo el cambio deliberado de que `idle` ya no se proyecta como `loading`.
- Confirmar que una query nunca ejecutada o todavía ausente del store no rompe el runtime y mantiene la rama `idle`.
- Confirmar que queries lanzadas por `preloads` abandonan `idle` al iniciar la ejecución y comparten exactamente la misma semántica visible que las lanzadas manualmente.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, queries, formularios y estado actual.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, helper compartido, renderer y formularios respecto a `idle`.
- El subconjunto afectado del runtime queda validado por regresión.
- `pnpm test` mantiene el umbral global mínimo del proyecto.
- La feature queda lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, con el cambio de semántica de `idle` explícitamente cubierto por tests.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0016-01`.

No se debe empezar `T0016-02` hasta cerrar `T0016-01`, ni `T0016-03` hasta cerrar `T0016-02`.
