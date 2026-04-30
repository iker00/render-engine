# Tasks: Zod runtime config validation

## T0012-01

### Estado
Completada

### Objetivo
Introducir la base interna de validación con `Zod` para el contrato estructural del runtime config, cubriendo `api`, `pages`, `preloads` y el catálogo vigente de nodos soportados, sin cambiar todavía la fachada pública ni mezclar en esta tarea las validaciones cruzadas finales del conjunto completo.

### Fuera de alcance
- Cerrar todavía la coherencia global de `initialPage` contra `pages`.
- Cerrar todavía la coherencia global de `button.props.action.pageId` contra el catálogo de páginas declarado.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.
- Abrir validación `Zod` fuera del runtime config.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `package.json`
  - `pnpm-lock.yaml`
  - `src/config/runtime-config-zod.ts` o módulo equivalente con esquemas y helpers internos
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config-types.ts` solo si hace falta introducir tipos internos auxiliares o ajustar exports sin romper la fachada pública
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que una configuración actualmente válida con `api`, `pages`, `initialPage`, `preloads` y nodos soportados sigue devolviendo un resultado `ready` normalizado.
- Confirmar que `api` debe ser objeto y que cada operación sigue validando `method`, `endpoint`, `query` y `body` con la semántica vigente.
- Confirmar que `query` sigue aceptando solo valores finales `string | number | boolean`.
- Confirmar que `body` sigue aceptando JSON serializable válido, incluido `null` en raíz para métodos con body.
- Confirmar que `GET` sigue rechazando `body`.
- Confirmar que `pages` sigue siendo array y que `preloads` sigue aceptando solo strings no vacíos en orden.
- Confirmar que `container`, `heading`, `paragraph`, `list` y `button` siguen validando el mismo shape estructural soportado hoy.
- Confirmar que `button.props.action.type` sigue aceptando solo `navigateTo | goBack`.
- Confirmar que `button.props.action.pageId` sigue siendo obligatorio y no vacío para `navigateTo`, pero sin exigir todavía en esta tarea que el destino exista dentro de `pages`.
- Confirmar que las claves extra no soportadas se descartan del objeto validado final sin convertir el config en inválido.
- Confirmar que `children` en nodos hoja no abren semántica nueva ni sobreviven al resultado normalizado.
- Confirmar que un `type` de nodo no soportado sigue produciendo un error explícito diferenciado del resto de layouts inválidos.

### Documentación afectada
- Pendiente de actualización posterior. Esta tarea cambia la base interna del validador y la documentación deberá reflejar que la validación ya se apoya en `Zod`.

### Criterios de finalización
- El repositorio declara `zod` como dependencia de runtime.
- Existe un módulo interno de esquemas que cubre el contrato estructural vigente del runtime config.
- `validateRuntimeConfig` ya reutiliza esa capa estructural para aceptar y normalizar configuraciones válidas.
- La tarea deja explícitamente diferida a `T0012-03` la existencia real de `button.props.action.pageId` dentro del catálogo `pages`.
- La política actual de descarte de claves extra queda fijada por tests.
- La distinción entre `invalid-layout` y `unsupported-node-type` sigue cubierta por tests.

### Cierre de implementación
Completado cuando el runtime ya valida su estructura base mediante `Zod` y mantiene paridad observable en la normalización y en los rechazos estructurales del contrato actual.

### Cierre documental
Pendiente de una pasada posterior para actualizar arquitectura, estado actual y fichas funcionales. No se cierra en esta tarea.

## T0012-02

### Estado
Completada

### Objetivo
Cerrar la adaptación diagnóstica entre los errores del esquema y `RuntimeConfigError`, manteniendo la fachada pública estable y mejorando la trazabilidad de rutas concretas del JSON sin exponer internamente `Zod` a bootstrap ni a los consumidores públicos.

### Fuera de alcance
- Añadir una nueva taxonomía pública de errores.
- Exigir compatibilidad textual exacta con cada mensaje histórico si eso empeora la claridad diagnóstica.
- Actualizar todavía la documentación de producto o arquitectura.

### Dependencias
- `T0012-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config-validation-errors.ts` o módulo equivalente para adaptación de issues
  - `src/config/runtime-config-types.ts` solo si hace falta documentar alguna ampliación no disruptiva del shape de error; la opción preferida es no tocar la API pública
  - `src/config/runtime-config.ts` solo si la reorganización interna exige ajustar exports públicos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con mensajes diagnósticos más trazables
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/development-workflow.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un error en `pages`, `layout`, `preloads`, `api.query` o `api.body` devuelve mensajes que apuntan a la ruta afectada de forma al menos tan útil como hoy.
- Confirmar que, cuando aplique, la ruta diagnóstica usa el path canónico del contrato actual, por ejemplo `layout[0].props.action.pageId`.
- Confirmar que un nodo no soportado sigue devolviendo `code: unsupported-node-type`.
- Confirmar que el resto de fallos estructurales siguen devolviendo `code: invalid-layout`.
- Confirmar que la política de visibilidad (`always` frente a `development-only`) se mantiene.
- Confirmar que `readRuntimeConfig` sigue traduciendo JSON inválido y config ausente con la misma semántica pública actual.
- Confirmar que una configuración válida existente no cambia su resultado observable por la mejora diagnóstica interna.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la mejora diagnóstica y la permanencia de la frontera pública estable.

### Criterios de finalización
- La adaptación desde `Zod` a `RuntimeConfigError` vive en una capa explícita y testeada.
- Los mensajes de error estructural incluyen rutas concretas del JSON cuando aplica.
- La API pública de `validateRuntimeConfig` sigue siendo coherente para bootstrap y tests.
- Los tests del borde de lectura del config siguen en verde si el cambio afecta al mensaje visible esperado.

### Cierre de implementación
Completado cuando la mejora diagnóstica ya está integrada en la frontera pública sin exponer `Zod` ni degradar la semántica pública de errores.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, workflow de desarrollo y estado actual. No se cierra en esta tarea.

## T0012-03

### Estado
Completada

### Objetivo
Reintroducir sobre el objeto ya parseado las validaciones cruzadas que no deben perderse con la migración, en particular la coherencia de `initialPage` y de los destinos declarativos `button.props.action.pageId` cuando `action.type` es `navigateTo`, asegurando que el runtime siga fallando antes del render cuando esas referencias globales sean inválidas.

### Fuera de alcance
- Añadir nuevas validaciones de negocio fuera de las ya soportadas por el contrato actual.
- Abrir referencias nuevas, navegación nueva o reglas declarativas no documentadas en la spec.
- Actualizar documentación dentro de la tarea.

### Dependencias
- `T0012-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config-zod.ts` o módulo equivalente solo si conviene exportar helpers de recorrido ya normalizados
  - `src/config/runtime-config-types.ts` solo si la implementación necesita tipos auxiliares internos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `initialPage` inexistente sigue devolviendo `initial-page-not-found` antes del render.
- Confirmar que `button.props.action.pageId` hacia una página inexistente sigue rechazándose durante validación del config y no en tiempo de interacción.
- Confirmar que una configuración válida con botones y destinos existentes sigue aceptándose.
- Confirmar que una acción `goBack` sigue fuera del alcance de estas validaciones cruzadas y no requiere `pageId`.
- Confirmar que las configuraciones previas sin botones siguen siendo compatibles.
- Confirmar que una mezcla de ramas válidas con una única referencia global inválida rechaza el config completo y señala la rama problemática.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que las validaciones cruzadas siguen vivas encima de la capa `Zod`.

### Criterios de finalización
- La migración no pierde ninguna validación cruzada estable del contrato actual.
- `initialPage` y `button.props.action.pageId` siguen resolviéndose como errores de configuración previos al render cuando son inválidos.
- Los tests relevantes de paridad estructural y semántica quedan en verde.

### Cierre de implementación
Completado cuando la migración a `Zod` conserva también la coherencia semántica global del runtime config y no solo su shape estructural.

### Cierre documental
Pendiente de una pasada posterior para actualizar fichas funcionales y estado actual. No se cierra en esta tarea.

## T0012-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature validando conjuntamente contrato estructural, adaptación de errores, validaciones cruzadas y compatibilidad del bootstrap, incluyendo el gate global de cobertura del proyecto.

### Fuera de alcance
- Añadir nuevas capacidades del contrato JSON.
- Realizar en esta tarea la pasada documental amplia.
- Reabrir decisiones de diseño ya cerradas en `design.md`.

### Dependencias
- `T0012-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/app/bootstrap/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/app-bootstrap.test.tsx` solo si la regresión descubre impacto real en la superficie visible de bootstrap
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/development-workflow.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta de validación del config y lectura del config desde bootstrap.
- Confirmar que configuraciones previamente válidas mantienen su comportamiento observable.
- Confirmar que configuraciones inválidas siguen fallando antes del render con códigos semánticos coherentes.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación funcional y arquitectónica sobre la nueva base de validación.

### Criterios de finalización
- No quedan incoherencias entre esquemas `Zod`, adaptación de errores, validaciones cruzadas y lectura del config en bootstrap.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0012-01`.

No se debe empezar `T0012-02` hasta cerrar `T0012-01`, ni `T0012-03` hasta cerrar `T0012-02`, ni `T0012-04` hasta cerrar `T0012-03`.
