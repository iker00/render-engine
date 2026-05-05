# Tasks: Multi-value data sources

## Resultado de revisión

Las decisiones que bloqueaban la implementación han quedado cerradas:

- una referencia dinámica válida bajo `queries.{queryName}.data` o `queries.{queryName}.data.*` degrada a colección vacía cuando el dato runtime actual no es coleccionable
- el nuevo shape funcional del origen dinámico usa `source` y mapeos por consumidor, manteniendo compatibilidad con los arrays históricos
- los mapeos relativos por item admiten rutas simples y anidadas como `name` o `author.name`
- un `select` cuya opción vigente desaparece limpia también su estado persistido a `''`

Con esas decisiones ya no queda una reinterpretación peligrosa abierta antes de `T0017-01`.

## T0017-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para que `list.props.items` y `select.props.items` acepten tanto las colecciones manuales históricas como el nuevo shape declarativo de origen múltiple, y cerrar en bootstrap todas las validaciones semánticas que la feature puede decidir antes del render.

### Fuera de alcance
- Resolver todavía datos dinámicos en runtime.
- Renderizar todavía `list` con objetos o `select` con opciones dinámicas.
- Cambiar todavía la semántica de inicialización lazy, validación `required` o submit del formulario.
- Actualizar documentación funcional o arquitectónica dentro de esta tarea.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si la fachada pública necesita exportar tipos nuevos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el borde de bootstrap con el contrato ampliado
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/architecture.md`

### Tests requeridos
- Confirmar que `list.props.items: string[]` sigue siendo válido y conserva el resultado normalizado actual.
- Confirmar que `select.props.items: { label, value }[]` sigue siendo válido y conserva el resultado normalizado actual.
- Confirmar que `list.props.items` acepta un origen dinámico limitado a referencias completas `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- Confirmar que `select.props.items` acepta un origen dinámico limitado a referencias completas `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- Confirmar que `list` rechaza combinaciones ambiguas que mezclen origen manual histórico con origen dinámico o con dos familias incompatibles del nuevo shape.
- Confirmar que `select` rechaza combinaciones ambiguas que mezclen origen manual histórico con origen dinámico o con dos familias incompatibles del nuevo shape.
- Confirmar que un origen dinámico fuera de `queries.*.data` o `queries.*.data.*` rechaza el config completo con ruta diagnóstica trazable.
- Confirmar que los casos declarados para objetos exigen los mapeos mínimos del consumidor y que su omisión rechaza el config.
- Confirmar que `select` sigue rechazando valores heterogéneos cuando el origen manual ya declara opciones incompatibles dentro del mismo campo.
- Confirmar que las claves extra no introducen semántica nueva y se descartan como hoy.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el contrato ampliado de colecciones manuales y dinámicas.

### Criterios de finalización
- El contrato JSON describe inequívocamente el origen manual histórico y el origen dinámico nuevo sin obligar a reinterpretación en implementación.
- La validación previa al render distingue de forma estable config inválido, config ambiguo y dato que todavía no existe en runtime.
- La compatibilidad hacia atrás de `list` y `select` manuales queda fijada por tests.
- Los tests relevantes del contrato quedan en verde.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista toda la nueva superficie contractual sin dejar reglas críticas para los nodos visuales.

### Cierre documental
Pendiente de una pasada posterior sobre contrato, runtime y formularios. No se cierra en esta tarea.

## T0017-02

### Estado
Completada

### Objetivo
Introducir la utilidad compartida de resolución y normalización de colecciones efectivas del runtime y conectar `list` con esa capa para soportar colecciones manuales o dinámicas de escalares y de objetos con mapeo visible declarativo, degradando por item en desarrollo sin romper el render.

### Fuera de alcance
- Adaptar todavía `select` o la validación de formularios a la colección efectiva nueva.
- Cambiar todavía la semántica de `defaultValue` o del valor seleccionado actual.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0017-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-collection-sources.ts` o helper equivalente fuera de nodos concretos
  - `src/runtime/nodes/list-layout-node.tsx`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` o helpers adyacentes solo si hace falta reutilizar resolución existente sin duplicación
  - `src/runtime/layout-node-renderer.tsx` solo si aparece un ajuste mínimo del borde central
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos auxiliares consumidos por runtime
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx` solo si la utilidad compartida expone helpers que convenga fijar desde estado controlado
  - `src/tests/runtime-reference-resolution.test.tsx` solo si se extrae comportamiento reutilizable de resolución
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que un `list` manual histórico de strings conserva el mismo render observable.
- Confirmar que un `list` dinámico de escalares renderiza un item visible por valor resuelto.
- Confirmar que un `list` manual o dinámico de objetos renderiza el texto indicado por su mapeo declarativo.
- Confirmar que una referencia dinámica válida pero todavía vacía, ausente o no coleccionable degrada a lista vacía sin romper el árbol.
- Confirmar que elementos objeto incompletos degradan solo por item y no invalidan la colección completa.
- Confirmar que en desarrollo se emite diagnóstico trazable para items degradados sin convertir el caso en error fatal visible.
- Confirmar que varios `list` distintos pueden reutilizar la misma query con mapeos diferentes sin colisión de resultado.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la resolución compartida de colecciones y el nuevo alcance funcional de `list`.

### Criterios de finalización
- Existe una única capa reutilizable que obtiene la colección base y la proyecta a una colección efectiva utilizable por consumidores del runtime.
- `list` deja de depender exclusivamente de `string[]` manuales y queda cubierto por tests para escalares, objetos y degradación.
- La degradación por item queda fijada por tests y no derriba el render completo.

### Cierre de implementación
Completado cuando `list` ya consume la nueva abstracción compartida y el comportamiento de degradación queda cerrado sin ambigüedad técnica.

### Cierre documental
Pendiente de una pasada posterior sobre runtime, queries y estado actual. No se cierra en esta tarea.

## T0017-03

### Estado
Completada

### Objetivo
Conectar `select` y la capa de formulario con la misma colección efectiva compartida para soportar opciones manuales o dinámicas, mantener la normalización interna a string, respetar la inicialización lazy actual y tratar como vacío cualquier valor seleccionado que deje de existir en la colección efectiva disponible.

### Fuera de alcance
- Añadir nuevos tipos de campo, multiselect, búsqueda remota o transformaciones avanzadas.
- Cambiar el contrato de `submitAction`, `api`, `preloads` o `queryStateFeedback`.
- Actualizar documentación en esta tarea.

### Dependencias
- `T0017-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-collection-sources.ts` o helper equivalente compartido con `T0017-02`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/runtime-state/runtime-state-selectors.ts` solo si hace falta exponer lectura auxiliar estable del valor efectivo
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si hace falta un setter o lectura auxiliar para mantener coherencia entre render y validación
  - `src/runtime/runtime-state/runtime-state-types.ts` solo si la implementación necesita tipos auxiliares explícitos
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-api-execution.test.ts` solo si hace falta fijar un caso de submit con opciones dinámicas
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que un `select` manual histórico sigue renderizando y almacenando valores como hoy.
- Confirmar que un `select` dinámico de escalares usa cada valor como `label` y `value` efectivo.
- Confirmar que un `select` manual o dinámico de objetos construye opciones a partir del mapeo declarativo de `label` y `value`.
- Confirmar que la inicialización lazy sigue resolviendo `defaultValue` solo en la primera aparición efectiva del campo.
- Confirmar que la llegada tardía de opciones dinámicas no reinicializa un campo ya existente.
- Confirmar que un `defaultValue` efectivo solo se aplica si coincide con una opción disponible de la colección resuelta.
- Confirmar que un valor almacenado que deja de existir en la colección efectiva se renderiza como vacío, vuelve a contar como vacío para `required` y es el valor que se enviaría en submit.
- Confirmar que un `select required` con opción ya desaparecida vuelve a producir `Required`.
- Confirmar que items objeto inválidos degradan solo las opciones afectadas y no bloquean el resto del catálogo.
- Confirmar que varios `select` o combinaciones `list` + `select` pueden reutilizar la misma query con proyecciones distintas sin interferencia.

### Documentación afectada
- Pendiente de actualización posterior para reflejar options dinámicas, semántica de valor vigente y compatibilidad con validación `required`.

### Criterios de finalización
- `select`, render y formulario consumen la misma colección efectiva y no recalculan reglas divergentes por su cuenta.
- La semántica de valor vigente de `select` queda unificada para render, inicialización, validación y submit.
- Los casos límite de opciones tardías, opciones desaparecidas y objetos incompletos quedan fijados por tests.

### Cierre de implementación
Completado cuando `select` queda integrado de extremo a extremo con la nueva fuente de colecciones sin romper la semántica lazy ni la validación actual del formulario.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, runtime y estado actual. No se cierra en esta tarea.

## T0017-04

### Estado
Completada

### Objetivo
Cerrar la regresión de integración de la feature y cualquier ajuste residual mínimo detectado tras `T0017-03`, validando conjuntamente contrato ampliado, resolución compartida, renderer, formularios y compatibilidad hacia atrás, manteniendo el gate global de cobertura.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Realizar en esta tarea la pasada documental amplia.
- Reabrir decisiones contractuales o semánticas ya fijadas por las tareas anteriores.

### Dependencias
- `T0017-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/`, `src/runtime/` o `src/tests/` necesario para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si quedó cubriendo borde real del bootstrap
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la implementación final toca resolución genérica
  - `src/tests/runtime-api-execution.test.ts` solo si quedó involucrado en la semántica final de submit con `select`
  - `src/tests/app-shell.test.tsx` solo si aparece impacto real en bootstrap o render inicial
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato ampliado, de la resolución compartida y de la integración visible en `list` y `select`.
- Confirmar que configuraciones previas con `list.props.items: string[]` y `select.props.items: { label, value }[]` conservan su comportamiento observable.
- Confirmar que una query nunca ejecutada, ausente o con dato no coleccionable no rompe el runtime y mantiene colecciones efectivas vacías.
- Confirmar que la degradación por item en colecciones de objetos no rompe renderer, formularios ni submit.
- Confirmar que `queryStateFeedback` sigue siendo suficiente para loading, error, empty e idle alrededor de consumidores dinámicos sin exigir un estado paralelo de colecciones.
- Ejecutar `pnpm test` para validar el gate global de cobertura del proyecto.

### Documentación afectada
- Pendiente de una pasada posterior de documentación sobre contrato, runtime, queries, formularios y estado actual.

### Criterios de finalización
- No quedan incoherencias entre contrato JSON, helper compartido, `list`, `select` y formularios respecto al origen manual o dinámico de colecciones.
- El subconjunto afectado del runtime queda validado por regresión.
- `pnpm test` mantiene el umbral global mínimo del proyecto.
- La feature queda lista para una pasada documental posterior sin trabajo técnico pendiente dentro del alcance acordado.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, con compatibilidad hacia atrás y semántica de degradación cubiertas por tests.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados.

## Orden de ejecución
La secuencia de implementación quedó cerrada en este orden:

1. `T0017-01`
2. `T0017-02`
3. `T0017-03`
4. `T0017-04`

No quedan tareas técnicas de implementación pendientes dentro del alcance de esta feature. La siguiente pasada esperada es la documental.
