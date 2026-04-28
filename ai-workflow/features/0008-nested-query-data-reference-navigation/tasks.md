# Tasks: Nested query data reference navigation

## T0008-01

### Estado
Completada

### Objetivo
Ampliar el contrato central de parsing y tipos de referencias para aceptar rutas anidadas bajo `queries.{queryName}.data`, fijando desde tests la semántica de shape válido, segmentos adicionales y límites explícitos de `status` y `error`.

### Fuera de alcance
- Resolver todavía el valor final contra estructuras anidadas reales del store.
- Cambiar la política visible de `heading.props.text` o `paragraph.props.text`.
- Abrir navegación anidada en `forms.*`, `queries.*.status`, `queries.*.error`, `navigation.*`, `routeParams.*` o `params.*`.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-types.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo para ajustar el contrato tipado si el parser ampliado lo exige
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que `queries.searchUsers.data.results.0.name` y `queries.searchUsers.data.user.profile.name` se clasifican como referencias soportadas.
- Confirmar que `queries.searchUsers`, `queries.searchUsers.data`, `queries.searchUsers.status` y `queries.searchUsers.error` mantienen su clasificación actual.
- Confirmar que `queries.searchUsers.error.message` y `queries.searchUsers.status.label` siguen clasificándose como inválidas.
- Confirmar que rutas mal formadas como `queries`, `queries.searchUsers.data.`, `queries.searchUsers.data..results` o `queries.searchUsers.data.results.` se clasifican de forma uniforme como inválidas.
- Confirmar que el escape literal con `\` sigue funcionando también cuando el literal coincide con una ruta anidada soportada.

### Criterios de finalización
- El parser reconoce la familia `queries.{queryName}.data.*` sin alterar el contrato de los demás namespaces.
- La validez sintáctica de rutas anidadas queda fijada en tests y no depende del valor concreto cargado en una query.
- Las ramas `status` y `error` quedan explícitamente cerradas para navegación adicional.
- Los tests del parser ampliado quedan en verde.

### Cierre de implementación
Completado cuando la convención string de referencias para datos anidados de query queda fijada en la capa central y ya no admite interpretaciones alternativas durante la implementación posterior.

### Cierre documental
Pendiente de una pasada posterior para reflejar la ampliación del contrato de referencias y sus límites. No se cierra en esta tarea.

## T0008-02

### Estado
Completada

### Objetivo
Implementar la navegación segura e iterativa dentro de `queries.{queryName}.data` en el resolver central, distinguiendo con tests entre valor resuelto, ruta ausente y ruta inválida para objetos, arrays, primitivos y datos no cargados.

### Fuera de alcance
- Integrar aún nuevos casos visibles en nodos de texto.
- Añadir transformaciones, filtros o sintaxis calculada sobre segmentos.
- Exponer navegación anidada sobre el objeto completo de la query, `error` o `status`.

### Dependencias
- `T0008-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-state/runtime-state-selectors.ts`
  - helpers internos adicionales dentro de `src/runtime/runtime-references/` solo si hacen falta funciones pequeñas y con intención clara
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que una ruta anidada sobre objeto como `queries.searchUsers.data.user.profile.name` devuelve el valor correcto.
- Confirmar que una ruta anidada sobre arrays como `queries.searchUsers.data.results.0.id` devuelve el elemento esperado.
- Confirmar que una ruta que alterna objetos y arrays en varios niveles, como `queries.searchUsers.data.sections.0.items.2.label`, se recorre de izquierda a derecha con resultado uniforme.
- Confirmar que un segmento numérico se trata como índice solo cuando el valor actual es un array y como propiedad literal cuando el valor actual es un objeto.
- Confirmar que query inexistente, `data` nulo o indefinido, clave ausente, índice fuera de rango o intento de profundizar dentro de un primitivo devuelven `missing`.
- Confirmar que `queries.searchUsers`, `queries.searchUsers.data`, `queries.searchUsers.status` y `queries.searchUsers.error` siguen resolviéndose como hoy.

### Criterios de finalización
- El resolver central ya puede navegar de forma segura por subrutas de `data` sin abrir otras ramas de `queries`.
- La distinción `resolved | missing | invalid` queda fijada para los casos límite de la spec.
- La regla de segmentos numéricos queda explícita en código y tests.
- Los tests del resolver y del store quedan en verde.

### Cierre de implementación
Completado cuando la semántica completa de navegación anidada ya vive en la capa central y no queda pendiente ninguna decisión sobre cómo recorrer datos remotos complejos.

### Cierre documental
Pendiente de una pasada posterior para reflejar el comportamiento estable del runtime y del store de queries. No se cierra en esta tarea.

## T0008-03

### Estado
Completada

### Objetivo
Verificar la integración visible existente para `heading.props.text` y `paragraph.props.text` con rutas anidadas de queries, manteniendo la misma degradación y el mismo diagnóstico de desarrollo ya acordados en `0007`.

### Fuera de alcance
- Habilitar referencias anidadas en `list.props.items` u otras superficies no textuales.
- Cambiar la normalización visible de objetos, arrays, `null` o `undefined`.
- Rediseñar el sistema de diagnósticos o la convención de escape literal.

### Dependencias
- `T0008-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si la proyección textual necesita absorber el nuevo resultado central sin cambiar su política
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` solo si el mensaje de diagnóstico necesita ajustar cobertura de rutas anidadas sin cambiar el formato estable
  - `src/runtime/nodes/heading-layout-node.tsx` solo si la integración requiere un ajuste mínimo no arquitectónico
  - `src/runtime/nodes/paragraph-layout-node.tsx` solo si la integración requiere un ajuste mínimo no arquitectónico
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`

### Tests requeridos
- Confirmar que `heading.props.text` y `paragraph.props.text` renderizan valores anidados de `queries.*.data.*` cuando resuelven a `string`, `number` o `boolean`.
- Confirmar que una referencia anidada no resoluble se degrada a string vacío con la misma política actual.
- Confirmar que una ruta anidada que resuelve a objeto o array sigue degradándose a vacío en superficies textuales.
- Confirmar que `\\queries.searchUsers.data.results.0.name` se muestra como literal visible sin el carácter de escape.
- Confirmar que en desarrollo el diagnóstico mantiene la referencia completa y la superficie consumidora, por ejemplo `queries.searchUsers.data.results.3.name` en `heading.props.text`.

### Criterios de finalización
- Las superficies textuales ya soportadas absorben la navegación anidada sin introducir una política nueva de render.
- La degradación y el diagnóstico siguen saliendo de la capa central.
- Los tests visibles cubren tanto éxito como degradación para rutas anidadas.
- Los tests de integración de layout quedan en verde.

### Cierre de implementación
Completado cuando el comportamiento visible de textos dinámicos sigue siendo uniforme para referencias simples y anidadas, sin duplicar lógica fuera del resolver central.

### Cierre documental
Pendiente de una pasada posterior para actualizar la documentación funcional del runtime visible y del contrato de configuración. No se cierra en esta tarea.

## T0008-04

### Estado
Completada

### Objetivo
Cerrar la regresión final de la feature validando que la ampliación de `queries.{queryName}.data.*` no rompe referencias previas, mantiene el runtime estable y conserva el gate global de cobertura del proyecto.

### Fuera de alcance
- Añadir nuevas capacidades de referencias fuera de la spec.
- Reabrir decisiones de diseño ya fijadas para segmentos numéricos o semántica `missing`.
- Actualizar documentación funcional o arquitectónica dentro de esta misma tarea.

### Dependencias
- `T0008-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/app-shell.test.tsx` solo si la regresión final detecta un impacto real en el montaje del runtime
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión del parser, del resolver, del store compartido y del renderer visible relevante para la feature.
- Confirmar que una configuración sin referencias anidadas mantiene el comportamiento estable introducido en `0007`.
- Confirmar que `queries.searchUsers.status`, `queries.searchUsers.error` y `queries.searchUsers.data` no cambian de significado tras la ampliación.
- Ejecutar `pnpm test` para validar que el gate global de cobertura sigue cumpliéndose.

### Criterios de finalización
- No quedan incoherencias entre parser, resolver, selectores y superficies textuales.
- La ampliación no rompe las rutas ya soportadas por `0007`.
- La regresión relevante del runtime queda en verde.
- `pnpm test` mantiene el umbral global mínimo del proyecto.

### Cierre de implementación
Completado cuando la feature queda integrada, validada y lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0008-01`.

No se debe empezar `T0008-02` hasta cerrar `T0008-01`, ni `T0008-03` hasta cerrar `T0008-02`, ni `T0008-04` hasta cerrar `T0008-03`.
