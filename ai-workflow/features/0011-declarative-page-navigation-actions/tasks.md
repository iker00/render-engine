# Tasks: Declarative page navigation actions

## T0011-01

### Estado
Completada

### Objetivo
Extender el contrato del runtime para soportar un nodo `button` con una única acción declarativa de navegación (`navigateTo` o `goBack`), validando desde bootstrap qué shapes son válidos y rechazando destinos `pageId` mal declarados antes de renderizar.

### Fuera de alcance
- Implementar todavía el comportamiento visible del botón en React.
- Añadir `goBack` al provider o cambiar el reducer de navegación.
- Disparar navegación declarativa desde el layout.
- Abrir un sistema general `events` o acciones múltiples por nodo.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` si la fachada pública necesita exportar los nuevos tipos de `button` y de acción
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con configuraciones que incluyan botones válidos e inválidos
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`

### Tests requeridos
- Confirmar que una página puede declarar un nodo `button` con `label` y acción `navigateTo` hacia una página existente.
- Confirmar que una página puede declarar un nodo `button` con acción `goBack`.
- Confirmar que varios botones dentro del mismo `layout` se validan en orden sin colisionar entre sí.
- Confirmar que `button` sigue la política actual del contrato frente a claves extra: se aceptan pero no forman parte del objeto normalizado final ni cambian la semántica soportada.
- Confirmar que `children` en `button` no abre semántica nueva y no altera el shape validado del nodo.
- Confirmar que se rechaza `button` sin `props`, sin `label` o con `label` no string.
- Confirmar que se rechaza `button` sin `action` o con `action.type` no soportado.
- Confirmar que se rechaza `navigateTo` sin `pageId`, con `pageId` vacío o con `pageId` inexistente en `pages`.
- Confirmar que una configuración existente sin nodos `button` mantiene el resultado de validación previo.

### Documentación afectada
- Pendiente de actualización posterior en las fichas de contrato y runtime.

### Criterios de finalización
- `LayoutNode` incorpora `button` con un shape de props inequívoco y exportado.
- La validación del config acepta solo los shapes soportados para `button`, `navigateTo` y `goBack`.
- La política respecto a `children` y a claves extra queda fijada y testeada para evitar reinterpretaciones durante la implementación del renderer.
- El destino de `navigateTo` queda validado contra las páginas declaradas en bootstrap.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando el JSON del runtime ya puede describir botones de navegación de forma inequívoca y testeada, sin dejar decisiones abiertas sobre shapes válidos o inválidos.

### Cierre documental
Pendiente de una pasada posterior para actualizar la documentación funcional del contrato y del runtime. No se cierra en esta tarea.

## T0011-02

### Estado
Completada

### Objetivo
Cerrar la semántica del historial interno para `goBack` dentro del store compartido, exponiendo una operación pública del provider que permita volver a la entrada válida anterior sin tocar la URL y sin romper la política ya existente de `navigateToPage`.

### Fuera de alcance
- Renderizar todavía el nuevo nodo `button`.
- Resolver la acción declarativa desde el layout.
- Añadir referencias `navigation.*`, estados de deshabilitado o visibilidad condicional.
- Modificar la política de `preloads` más allá de reutilizar la reentrada ya existente.

### Dependencias
- `T0011-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/runtime-state-types.ts`
  - `src/runtime/runtime-state/runtime-state-reducer.ts`
  - `src/runtime/runtime-state/runtime-state-provider.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si la nueva semántica necesita una lectura más explícita para tests o helpers
- Tests a crear o modificar:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que `navigateToPage(pageId)` hacia una página distinta sigue actualizando `currentPageId`, añade historial y limpia `lastError`.
- Confirmar que `navigateToPage(pageId)` hacia la misma página visible sigue siendo `no-op` sin duplicar historial.
- Confirmar que `goBackPage()` después de `home -> details -> home` devuelve al usuario a `details`.
- Confirmar que `goBackPage()` poda la entrada actual del historial en lugar de añadir una navegación nueva.
- Confirmar que `goBackPage()` con menos de dos entradas no cambia la página visible ni crea error recuperable.
- Confirmar que el error recuperable `page-not-found` sigue existiendo para `navigateToPage(pageId)` imperativo con destino inexistente.
- Confirmar que volver atrás a una página con `preloads` reutiliza la reentrada ya implementada y vuelve a disparar su tanda automática.

### Documentación afectada
- Pendiente de actualización posterior sobre historial, navegación interna y reentrada con `preloads`.

### Criterios de finalización
- El reducer soporta una transición explícita y testeada para `goBack`.
- El historial conserva la semántica contractual para repetición de páginas y para `no-op` al volver atrás sin entradas previas.
- El provider expone una superficie pública mínima para volver atrás sin tocar la URL.
- Los tests relevantes del store y de reentrada quedan en verde.

### Cierre de implementación
Completado cuando la navegación interna ya soporta `goBack` de forma inequívoca y reutilizable, sin ambigüedad sobre historial, errores recuperables ni reentrada de página.

### Cierre documental
Pendiente de una pasada posterior para reflejar la semántica final de historial y reentrada. No se cierra en esta tarea.

## T0011-03

### Estado
Completada

### Objetivo
Incorporar el nodo visual `button` al renderer del runtime y conectarlo a un ejecutor declarativo mínimo de acciones de navegación que reutilice el provider y el estado compartido sin introducir un sistema general de eventos.

### Fuera de alcance
- Soportar triggers distintos de `button`.
- Añadir composición de varias acciones, condiciones o handlers por evento.
- Exponer todavía referencias declarativas sobre navegación para deshabilitar u ocultar botones.
- Rediseñar la capa visual del runtime más allá de una convención base coherente con el resto de nodos.

### Dependencias
- `T0011-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/button-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo para exponer la acción pública necesaria al botón si aún no quedó cerrada en `T0011-02`
  - `src/runtime/runtime-actions/` con un ejecutor o helper específico para acciones de navegación declarativa
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que el renderer muestra un `<button type="button">` con la etiqueta declarada.
- Confirmar que `button` se comporta como nodo hoja aunque llegue con `children` en el config.
- Confirmar que un botón `navigateTo` hacia otra página existente cambia la página visible.
- Confirmar que un botón `navigateTo` hacia la misma página visible no cambia la página ni duplica historial.
- Confirmar que un botón `goBack` devuelve al usuario a la página previa válida más reciente.
- Confirmar que un botón `goBack` sin historial previo es `no-op`.
- Confirmar que varias activaciones rápidas siguen dejando la navegación visible en el último destino efectivo.
- Confirmar que un botón que entra en una página con `preloads` reutiliza el ciclo ya implementado de entrada y cierre agregado.
- Confirmar que una configuración sin nodos `button` mantiene el render estático existente sin regresiones.

### Documentación afectada
- Pendiente de actualización posterior sobre el nuevo nodo soportado y la primera superficie interactiva del runtime.

### Criterios de finalización
- El catálogo soportado del renderer incorpora `button` con semántica accesible de botón.
- La acción declarativa se ejecuta desde una capa reutilizable fuera del componente visual.
- El renderer mantiene la convención actual de nodos hoja para `button` sin introducir semántica implícita en `children`.
- `navigateTo` y `goBack` quedan operativos de extremo a extremo desde el `layout`.
- La implementación no introduce todavía `events`, `onClick` ni composición general de interacciones; queda explícitamente acotada al trigger mínimo acordado.
- Los tests de integración relevantes del renderer, navegación y reentrada quedan en verde.

### Cierre de implementación
Completado cuando el runtime ya puede renderizar y ejecutar botones declarativos de navegación de extremo a extremo, sin dejar trabajo técnico ambiguo sobre dónde vive la acción ni cómo se conecta al estado.

### Cierre documental
Pendiente de una pasada posterior para actualizar la ficha del runtime, de navegación y el estado actual del producto. No se cierra en esta tarea.

## T0011-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature validando la coherencia entre contrato `button`, historial interno, trigger declarativo, reentrada con `preloads` y gate global de cobertura del proyecto.

### Fuera de alcance
- Añadir nuevas capacidades declarativas fuera de la spec.
- Actualizar documentación funcional y arquitectónica dentro de esta misma tarea.
- Extender el runtime con referencias declarativas de navegación o estados visuales condicionales.

### Dependencias
- `T0011-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/app-shell.test.tsx` solo si el cierre detecta impacto real en el arranque visible del runtime
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta de validación del config, historial interno, render del botón y reentrada con `preloads`.
- Confirmar que una configuración previa sin nodos `button` conserva su comportamiento observable actual.
- Confirmar que `goBack` no rompe el historial mínimo ni deja errores recuperables espurios.
- Confirmar que una navegación declarativa a una página con `preloads` vuelve a disparar sus queries al reentrar.
- Confirmar que los errores recuperables de navegación imperativa inexistente siguen sin derribar el runtime completo.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre runtime, navegación y contrato JSON.

### Criterios de finalización
- No quedan incoherencias entre contrato `button`, provider, historial y reentrada con `preloads`.
- Las configuraciones previas sin botones siguen siendo compatibles.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0011-01`.

No se debe empezar `T0011-02` hasta cerrar `T0011-01`, ni `T0011-03` hasta cerrar `T0011-02`, ni `T0011-04` hasta cerrar `T0011-03`.
