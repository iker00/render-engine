# Tasks: Expanded container layout controls

## Resultado de revisión

La feature requiere `design.md` porque fija una decisión arquitectónica pequeña pero relevante:
- `columns` activa modo `grid` y prevalece sobre `direction`
- `wrap` solo se soporta en modo lineal y se rechaza junto con `columns`
- `align` y `justify` se cierran sobre un vocabulario declarativo pequeño y estable
- `gap` pasa a tener default `md` y mantiene valor arbitrario solo como compatibilidad heredada

Con esas decisiones, la implementación ya no necesita rediseñar el contrato durante la ejecución. La siguiente tarea que debe ejecutarse es `T0027-01`.

## T0027-01

### Estado
Completada

### Objetivo
Ampliar el contrato de `container` en tipos, parseo `Zod` y validación semántica para soportar `gap` ampliado, `columns`, `align`, `justify` y `wrap`, cerrando también defaults, precedencias y combinaciones inválidas antes del render.

### Fuera de alcance
- Renderizar todavía las nuevas clases de layout en el nodo React.
- Ajustar todavía la heurística visual de `container` dentro de `form`.
- Actualizar todavía la documentación estable del producto.

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
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar la lectura pública del contrato ampliado
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que `container.props.gap` acepta `sm | md | lg | xl | 2xl`.
- Confirmar que el config sigue aceptando `gap` arbitrario como compatibilidad heredada.
- Confirmar que `columns` solo acepta enteros entre `1` y `12`.
- Confirmar que `align`, `justify` y `wrap` solo aceptan valores del catálogo cerrado acordado.
- Confirmar que `wrap` y `columns` juntos se rechazan con diagnóstico explícito sobre la ruta del nodo.
- Confirmar que `direction` y `columns` pueden coexistir en el contrato y que esa combinación no invalida el config por sí misma.
- Confirmar que configuraciones previas de `container` sin props nuevas siguen normalizando correctamente.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el contrato ampliado de `container`, sus defaults y la combinación inválida `columns + wrap`.

### Criterios de finalización
- El contrato JSON de `container` queda definido sin ambigüedad para todas las props nuevas.
- La validación previa al render rechaza valores fuera de catálogo y la combinación `columns + wrap`.
- La compatibilidad con `gap` arbitrario y con configuraciones históricas queda fijada por tests.
- No queda semántica contractual importante delegada al renderer visible.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista toda la nueva superficie declarativa de `container` y deja cerradas las precedencias del contrato.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, runtime y formularios. No se cierra en esta tarea.

## T0027-02

### Estado
Completada

### Objetivo
Implementar la resolución visual efectiva de `container` para soportar el default `gap: md`, el modo `grid` por `columns` y el mapeo estable de `align`, `justify` y `wrap`, manteniendo la excepción existente para `gap` arbitrario.

### Fuera de alcance
- Ajustar todavía la semántica específica de secciones dentro de `form`.
- Convertir `container` en una API general de estilos o responsive declarativo.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `T0027-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/config/runtime-config-types.ts` solo si la implementación necesita tipos auxiliares más precisos para el helper visual
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md` solo si se fija una convención reusable nueva en la capa de styling

### Tests requeridos
- Confirmar que un `container` sin `gap` renderiza la separación equivalente a `md`.
- Confirmar que los alias `sm | md | lg | xl | 2xl` se resuelven a clases estables sin estilos inline nuevos.
- Confirmar que un `container` con `columns` renderiza `grid` y la clase de columnas correcta entre `1` y `12`.
- Confirmar que `columns` prevalece visualmente sobre `direction` cuando ambas props existen.
- Confirmar que `align` y `justify` se traducen de forma estable en modo lineal y en modo columnas.
- Confirmar que `wrap` solo afecta al modo lineal y que el fallback de `gap` arbitrario sigue usando la variable CSS local existente.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el layout efectivo de `container` y sus defaults visibles.

### Criterios de finalización
- `container` puede resolver de forma estable ambos modos de layout acordados: lineal y columnas.
- El default de `gap` queda centralizado y testeado.
- Las precedencias visuales coinciden con el contrato validado en bootstrap.
- No se reintroducen estilos inline generales ni lógica de layout dispersa fuera de la capa de styling.

### Cierre de implementación
Completado cuando el helper visual y el nodo `container` renderizan la semántica acordada con tests de styling y de renderer en verde.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0027-03

### Estado
Completada

### Objetivo
Cerrar la integración de `container` dentro de formularios y del renderer afectado, garantizando que las nuevas capacidades de layout no rompen la semántica actual de sección, ni la lectura visual ni la compatibilidad del catálogo existente.

### Fuera de alcance
- Añadir nodos nuevos para secciones, grids de formulario o variantes visuales por JSON.
- Reabrir el contrato ya fijado para `wrap`, `columns`, `align`, `justify` o `gap`.
- Realizar todavía la pasada documental amplia de la feature.

### Dependencias
- `T0027-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/form-layout-node.tsx` solo si hace falta fijar mejor la integración con el contexto de formulario
  - `src/dev/config.json` solo si conviene añadir una composición representativa para iteración local
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/app-bootstrap.test.tsx` solo si la configuración local de desarrollo se amplía de forma relevante
  - `src/tests/runtime-button-navigation.test.tsx` solo si alguna aserción de formulario visible necesita endurecerse
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md` solo si se necesita reflejar el avance al cerrar la implementación

### Tests requeridos
- Confirmar que un `container` dentro de `form` sin props nuevas sigue comportándose como sección vertical con separación visual estable.
- Confirmar que un `container` dentro de `form` puede declarar `columns` sin perder el wrapper semántico ni romper la lectura del formulario.
- Confirmar que un `container` dentro de `form` puede declarar `align`, `justify` y `gap` ampliado sin alterar la semántica de los campos descendientes.
- Confirmar que la combinación `direction + columns` en render usa el modo columnas efectivo también dentro de formularios.
- Confirmar que páginas existentes con `container` lineales siguen renderizando como antes salvo por el nuevo default `gap: md`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el alcance real de `container` en formularios y la compatibilidad mantenida.

### Criterios de finalización
- La feature queda integrada en el renderer visible sin regresión sobre formularios ni composiciones existentes.
- Las nuevas capacidades pueden usarse dentro de `form` sin introducir heurísticas ambiguas de sección.
- El subconjunto afectado de tests deja fijada la compatibilidad hacia atrás del catálogo actual.

### Cierre de implementación
Completado cuando la integración en formularios y el renderer afectado quedan probados de extremo a extremo dentro del alcance funcional de la feature.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0027-04

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y técnica afectada para dejar explícito el contrato ampliado de `container`, sus defaults, su precedencia de `columns`, el límite de `wrap` y el nuevo alcance de layout del runtime.

### Fuera de alcance
- Reabrir decisiones de contrato o implementación ya cerradas.
- Convertir `README.md` en un changelog o historial de la feature.
- Introducir roadmap de responsive declarativo, spans por hijo o theming desde JSON.

### Dependencias
- `T0027-03` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md` solo si la implementación fija una convención nueva relevante en `runtime-node-styling.ts`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0027-expanded-container-layout-controls/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0027-03` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable deja claro qué soporta ahora `container` y qué sigue fuera de alcance.
- Defaults, precedencias y combinación inválida `columns + wrap` quedan documentados de forma consistente.
- `status.yaml` refleja la feature implementada, validada y pendiente solo del cierre documental si todavía no se completa en esta misma pasada.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0027-03`.

### Cierre documental
Completado cuando la documentación funcional y técnica afectada queda actualizada y `status.yaml` refleja el estado final real de la feature.
