# Tasks: Form container alignment

## Resultado de revisión

La feature no requiere `design.md`.

Razones:
- el cambio está acotado a una heurística visual ya localizada en `src/runtime/nodes/container-layout-node.tsx` y `src/runtime/runtime-node-styling.ts`
- no cambia el contrato JSON ni la validación estructural previa al render
- no introduce una decisión arquitectónica nueva entre varios módulos o capas

La revisión sí exige fijar explícitamente la heurística funcional que la implementación debe conservar:
- dentro de `form`, un `container` sigue usando la superficie especial de sección cuando actúa como bloque vertical por defecto o cuando declara `columns`
- dentro de `form`, un `container` con `direction: row` y sin `columns` deja de tratarse como sección especial y debe renderizarse como layout lineal normal, sin sangrado lateral ni márgenes negativos

Con esto, la implementación puede ejecutarse sin rediseñar la feature durante la pasada. La siguiente tarea que debe escogerse es `T0028-01`.

## T0028-01

### Estado
Completada

### Objetivo
Eliminar el sangrado lateral implícito de los `container` dentro de `form` sin perder su borde separador ni su papel de bloque visual diferenciado, dejando fijada sin ambigüedad esta heurística: superficie especial para `container` de formulario en modo vertical por defecto o con `columns`, y superficie `plain` para `direction: row` cuando no existan columnas.

### Fuera de alcance
- Cambiar el contrato JSON de `container`, `form` o sus props.
- Añadir nodos nuevos como `section`, `fieldset` o variantes visuales declarativas.
- Reabrir la semántica global de `container` fuera del contexto de formularios.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que la variante visual de sección dentro de `form` deja de añadir `-mx-*` horizontales y mantiene `border-t`.
- Confirmar que el padding interior y el `gap` efectivo del `container` siguen siendo estables tras retirar el sangrado lateral.
- Confirmar que un `container` de formulario sin `direction` explícita sigue resolviendo la superficie especial de sección.
- Confirmar que un `container` de formulario con `columns` sigue renderizando `grid` y conserva la separación visual de bloque.
- Confirmar que un `container` de formulario con `direction: row` y sin `columns` deja de usar la superficie especial y no recupera márgenes negativos laterales por contexto de formulario.
- Confirmar que la semántica general de `gap` arbitrario y aliases de `container` no se rompe por este ajuste.

### Documentación afectada
- Pendiente de actualización posterior para reflejar que la sección visual del formulario ya no se interpreta como bloque a sangre.

### Criterios de finalización
- La heurística visual especial de `container` dentro de `form` queda centralizada y sin ambigüedad.
- Queda fijado por tests que `columns` prevalece sobre `direction: row` también para decidir la superficie visible del bloque.
- El bloque mantiene separación visual coherente, pero vuelve a respetar el ancho útil normal del formulario.
- No se reintroducen estilos inline generales ni compensaciones laterales implícitas.
- Los tests unitarios y de renderer afectados dejan fijado el nuevo comportamiento visible.

### Cierre de implementación
Completado cuando el runtime renderiza los `container` de formulario sin sangrado lateral, mantiene el divisor superior acordado y deja el nuevo comportamiento cubierto por tests relevantes en verde.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0028-02

### Estado
Completada

### Objetivo
Cerrar la regresión visible del runtime sobre configuraciones representativas de formularios para asegurar que el ajuste de alineación no rompe layouts históricos, composiciones en columnas ni formularios con acciones anidadas dentro de `container`.

### Fuera de alcance
- Redefinir otra vez la heurística ya cerrada en `T0028-01` salvo bug demostrado por tests.
- Retocar la configuración de validación del runtime o el catálogo de nodos.
- Hacer todavía la pasada documental amplia de la feature.

### Dependencias
- `T0028-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/dev/config.json` solo si hace falta un ejemplo local más representativo del ajuste
  - `src/runtime/nodes/container-layout-node.tsx` solo para ajustes residuales detectados por regresión
  - `src/runtime/runtime-node-styling.ts` solo para ajustes residuales detectados por regresión
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si alguna aserción visible de formularios anidados necesita endurecerse
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/features/index.md` solo si al cerrar implementación conviene reflejar el avance de estado global

### Tests requeridos
- Confirmar que el formulario representativo del runtime mantiene alineación horizontal consistente entre campos sueltos y bloques `container`.
- Confirmar que un `container` de formulario con `columns` conserva `grid-cols-*`, borde superior y padding útil sin desbordar lateralmente el shell.
- Confirmar que un botón submit implícito anidado dentro de un `container` de formulario sigue funcionando igual tras el ajuste visual.
- Confirmar que los `container` fuera de `form` mantienen su styling actual sin regresión observable.
- Confirmar el subconjunto completo afectado y cerrar con el gate global de `pnpm test`.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la regresión visible cerrada y el alcance real del ajuste.

### Criterios de finalización
- El comportamiento visible queda estabilizado tanto en helpers de styling como en render de páginas y formularios reales.
- La feature no introduce regresiones en submit implícito, jerarquía visual ni composiciones existentes fuera de formularios.
- La configuración de desarrollo representativa y el flujo de submit implícito siguen cubiertos por tests de integración legibles, sin depender de inspección manual del navegador.
- El subconjunto afectado de tests y la regresión global del proyecto quedan en verde.

### Cierre de implementación
Completado cuando la regresión visible queda validada sobre los tests afectados y `pnpm test` confirma que el gate global de coverage sigue cumpliéndose.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0028-03

### Estado
Pendiente

### Objetivo
Actualizar la documentación funcional y de estado para dejar explícito que `container` dentro de `form` sigue actuando como sección visual separada, pero ya no usa sangrado lateral ni márgenes negativos implícitos.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Convertir `README` u otros documentos breves en historial de cambios.
- Introducir roadmap de nuevas variantes visuales o nodos adicionales.

### Dependencias
- `T0028-02` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0028-form-container-alignment/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0028-02` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable describe el nuevo comportamiento visible sin contradecir la spec ni los tests.
- Queda claro qué se conserva de la semántica de sección y qué se elimina de la composición anterior a sangre.
- `status.yaml` refleja correctamente el paso posterior de documentación o el cierre final real de la feature, sin reabrir validación técnica ya cerrada en `T0028-02`.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0028-02`.

### Cierre documental
Completado cuando la documentación funcional y el estado del workflow quedan actualizados de forma consistente.
