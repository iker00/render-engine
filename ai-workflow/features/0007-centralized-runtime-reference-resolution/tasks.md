# Tasks: Centralized runtime reference resolution

## T0007-01

### Estado
Completada

### Objetivo
Introducir la capa común `runtime-references/` con el contrato de parsing y clasificación de referencias string, fijando desde tests la convención de namespaces soportados, namespaces reservados y escape literal sin conectar todavía el render visible.

### Fuera de alcance
- Resolver aún valores reales desde `RuntimeState`.
- Modificar `heading` o `paragraph` para consumir referencias.
- Añadir validación semántica exhaustiva en `src/config/`.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-types.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` con implementación todavía limitada al contrato de resultados y sin lookup completo al store
  - cualquier ajuste mínimo en `src/runtime/runtime-state/runtime-state-types.ts` solo si el contrato de tipos compartidos necesita importarse desde una frontera más estable
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `forms.userSearch.name` y `queries.searchUsers.data` se clasifican como referencias dinámicas válidas.
- Confirmar que `navigation.currentPageId`, `routeParams.userId` y `params.id` se clasifican como namespaces reservados no soportados todavía.
- Confirmar que `\\forms.userSearch.name` se interpreta como texto literal visible `forms.userSearch.name`.
- Confirmar que un texto con interpolación parcial como `User: forms.userSearch.name` sigue tratándose como literal.
- Confirmar que rutas incompletas o mal formadas para `forms` y `queries` se clasifican como inválidas con resultado uniforme.

### Criterios de finalización
- Existe una capa `runtime-references/` separada del render y del store.
- La convención de escape literal queda fijada en tests.
- El parser distingue de forma estable `literal`, `unsupported` e `invalid` antes de introducir lectura real de estado.
- Los tests del contrato base de referencias quedan en verde.

### Cierre de implementación
Completado cuando la convención de referencias ya no depende de heurísticas implícitas y queda definida en una capa común reutilizable por futuras superficies del runtime.

### Cierre documental
Pendiente de una pasada posterior para actualizar la documentación del contrato y del runtime. No se cierra en esta tarea.

## T0007-02

### Estado
Completada

### Objetivo
Conectar el resolver central al `RuntimeState` para soportar lookup oficial de `forms.{formId}.{fieldId}` y `queries.{queryName}[.data|.status|.error]`, distinguiendo en la salida semántica entre valor resuelto, ruta ausente y referencia inválida o no soportada.

### Fuera de alcance
- Aplicar todavía la resolución a superficies visibles del layout.
- Exponer subrutas adicionales de `forms` como `error`, `dirty` o `touched`.
- Habilitar `navigation.*`, `routeParams.*` o `params.*`.

### Dependencias
- `T0007-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si hacen falta tipos auxiliares públicos para la resolución
  - cualquier helper local adicional dentro de `src/runtime/runtime-references/` estrictamente necesario para lookup seguro
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que `forms.userSearch.name` devuelve el valor actual compartido del formulario dentro de la misma instancia.
- Confirmar que `queries.searchUsers` devuelve el objeto completo de la query y que `queries.searchUsers.data`, `.status` y `.error` devuelven la subruta correcta.
- Confirmar que dos lecturas de la misma referencia dentro de la misma instancia obtienen el mismo valor actual.
- Confirmar que una ruta soportada cuyo valor todavía no existe devuelve estado `missing` y no `invalid`.
- Confirmar que una subruta no oficial como `queries.searchUsers.foo` o `forms.userSearch.name.error` queda invalidada de forma uniforme.

### Criterios de finalización
- El resolver ya puede leer los dominios `forms` y `queries` desde el store compartido.
- La semántica `resolved | missing | unsupported | invalid` queda fijada con tests sobre el estado real del runtime.
- La lectura de rutas oficiales no depende de conocimiento incrustado en nodos visuales.
- Los tests del resolver y del store quedan en verde.

### Cierre de implementación
Completado cuando el runtime dispone de una fuente de verdad única para interpretar referencias a `forms` y `queries`, sin abrir todavía la política de render visible.

### Cierre documental
Pendiente de una pasada posterior para reflejar la nueva capa de resolución y las rutas oficiales soportadas. No se cierra en esta tarea.

## T0007-03

### Estado
Completada

### Objetivo
Aplicar la resolución central a `heading.props.text` y `paragraph.props.text`, con degradación uniforme a vacío para referencias no resolubles y diagnóstico centralizado solo en desarrollo.

### Fuera de alcance
- Habilitar referencias dinámicas en `list.props.items`, `defaultValue`, visibilidad condicional u otras superficies no textuales.
- Introducir interpolación parcial dentro de strings.
- Mostrar errores técnicos al usuario final en producción.

### Dependencias
- `T0007-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/heading-layout-node.tsx`
  - `src/runtime/nodes/paragraph-layout-node.tsx`
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si hace falta una proyección específica para texto visible
  - `src/runtime/layout-node-renderer.tsx` solo si la integración requiere pasar metadatos mínimos de superficie sin mezclar lógica de parsing en el nodo
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`

### Tests requeridos
- Confirmar que `heading.props.text` y `paragraph.props.text` renderizan el valor actual de referencias a `forms` y `queries`.
- Confirmar que un texto estático sin referencias sigue renderizándose como hoy.
- Confirmar que una referencia `missing`, `unsupported` o `invalid` se degrada a string vacío en ambas superficies.
- Confirmar que `\\forms.userSearch.name` se muestra como literal sin el carácter de escape.
- Confirmar que en desarrollo se emite un diagnóstico claro en consola con la ruta y la superficie afectada, y que ese diagnóstico no se exige para producción.

### Criterios de finalización
- `heading` y `paragraph` consumen la capa común de referencias en lugar de renderizar strings crudos sin interpretación.
- La degradación a vacío queda alineada entre ambas superficies.
- Los diagnósticos de desarrollo salen de un punto central, no de mensajes duplicados por nodo.
- Los tests visibles de render y de resolución quedan en verde.

### Cierre de implementación
Completado cuando los textos visibles cubiertos por esta iteración usan la misma política de resolución, degradación y diagnóstico sin introducir una sintaxis paralela por nodo.

### Cierre documental
Pendiente de una pasada posterior para actualizar la documentación funcional del runtime y del contrato. No se cierra en esta tarea.

## T0007-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature, verificando que la nueva capa de referencias no rompe el renderer estático actual ni el store compartido y que el gate global de cobertura sigue cumpliéndose.

### Fuera de alcance
- Añadir nuevas superficies consumidoras de referencias.
- Reabrir la convención de namespaces o la política de textos visibles ya fijada en `design.md`.
- Actualizar documentación funcional o arquitectónica dentro de esta misma tarea.

### Dependencias
- `T0007-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/app-shell.test.tsx` solo si la integración final revela una regresión en el montaje del runtime
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/context.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión relevante del resolver, del renderer visible y del store compartido.
- Confirmar que una configuración sin referencias dinámicas mantiene el comportamiento estable actual.
- Confirmar que el escape literal y la degradación a vacío no rompen el orden ni el render básico del layout.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Criterios de finalización
- No quedan incoherencias entre parser, resolver, textos visibles y store compartido.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada con validación final de regresión y coverage, lista para una pasada posterior de documentación.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0007-01`.

No se debe empezar `T0007-02` hasta cerrar `T0007-01`, ni `T0007-03` hasta cerrar `T0007-02`, ni `T0007-04` hasta cerrar `T0007-03`.
