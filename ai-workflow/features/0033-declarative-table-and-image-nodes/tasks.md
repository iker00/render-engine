# Tasks: Declarative table and image nodes

## Resultado de revisión

La feature no requiere `design.md`.

Razones:
- el cambio se apoya en fronteras ya existentes y bien delimitadas entre `src/config/`, `src/runtime/` y `src/tests/`
- no introduce una estrategia alternativa fuerte de arquitectura: el catálogo declarativo, la validación previa al render, la resolución central de referencias y la capa compartida de colecciones ya fijan el marco técnico correcto
- el riesgo principal está en cerrar el contrato JSON y la semántica de degradación, no en decidir una arquitectura nueva

La planificación sí deja cerradas estas decisiones para evitar implementaciones divergentes:
- `image` será un nodo hoja nuevo con `type: 'image'` y `props.src` / `props.alt` como strings obligatorios que reutilizan la misma semántica de string literal o referencia runtime completa ya soportada por superficies textuales del runtime
- `table` será un nodo hoja nuevo con `type: 'table'`, `props.headers` como colección ordenada y `props.rows` como unión exclusiva entre modo manual y modo dinámico
- el modo manual de `table` usará `props.rows` como `Array<Array<string | number | boolean>>`, manteniendo el orden declarado de filas y columnas, exigiendo correspondencia exacta entre cada fila y `headers` y reutilizando en las celdas string la misma semántica de literal o referencia runtime completa que usará `image`
- el modo dinámico de `table` usará `props.rows` como objeto `{ source, cells }`, donde `source` reutiliza la misma familia de orígenes de colección ya soportada por `list`, `select` y `repeater`, y `cells` es un array ordenado de strings que se interpreta con la misma semántica de literal o referencia completa, incluyendo `item` e `item.*` cuando existe contexto de iteración
- `table` mantendrá una semántica de lectura básica con marcado HTML real de tabla (`table`, `thead`, `tbody`, `tr`, `th`, `td`) y no abrirá plantillas arbitrarias por celda ni composición rica por fila
- una tabla dinámica con colección ausente, fallida o no coleccionable degrada a cero filas; una fila parcial conserva la fila y degrada solo las celdas no resolubles a contenido vacío
- una tabla manual con celdas string no resolubles degrada solo esas celdas a contenido vacío con el mismo criterio diagnóstico que el resto de superficies textuales; las celdas numéricas y booleanas se muestran como texto visible estable
- `image` solo renderiza `<img>` cuando `src` resuelve un string utilizable; si `src` no está disponible o no resuelve un valor final válido, el nodo degrada a `null` sin romper la pantalla; `alt` mantiene fallback seguro a string vacío con diagnóstico de desarrollo

Con estas decisiones, la siguiente tarea que debe escogerse es `T0033-01`.

## T0033-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime config para introducir los nodos `image` y `table`, fijar de forma inequívoca su shape público y rechazar antes del render cualquier combinación estructuralmente incoherente con la feature.

La tarea debe dejar cerrado este contrato:
- `image` con `props.src` y `props.alt` obligatorios
- `table` con `props.headers` como array ordenado de cabeceras no vacías
- `table.props.rows` como unión exclusiva entre:
  - modo manual: array de filas
  - modo dinámico: objeto `{ source, cells }`
- celdas manuales limitadas a `string | number | boolean`, con strings interpretados como literal o referencia runtime completa y con rechazo explícito de arrays, objetos o `null`
- correspondencia estructural exacta entre `headers` y cada fila manual o dinámica
- compatibilidad de `queryStateFeedback` y `visibility` sobre ambos nodos

### Fuera de alcance
- Renderizar todavía los nodos nuevos.
- Resolver todavía `src`, `alt` o celdas dinámicas en runtime.
- Abrir una API nueva de theming, alineaciones por celda o wrappers visuales especiales.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si hace falta reexportar tipos nuevos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si conviene fijar el shape normalizado desde la fachada pública
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `image` acepta `props.src` y `props.alt` con strings no vacíos.
- Confirmar que `table` acepta `headers` no vacíos y un modo manual con filas de longitud exacta respecto a las cabeceras y celdas limitadas a `string | number | boolean`.
- Confirmar que `table` acepta un modo dinámico con `source` válido y `cells` de longitud exacta respecto a las cabeceras.
- Confirmar que `table` rechaza cabeceras vacías, ausencia de `rows`, filas de longitud distinta, `cells` de longitud distinta, celdas manuales con arrays, objetos o `null` y cualquier shape ambiguo que mezcle modos.
- Confirmar que `table.props.rows.source` acepta solo `queries.{queryName}.data`, `queries.{queryName}.data.*` o `item.*`.
- Confirmar que una configuración existente sin `table` ni `image` conserva el mismo resultado normalizado actual.
- Confirmar que `queryStateFeedback` y `visibility` siguen siendo válidos sobre ambos nodos sin abrir un contrato paralelo.

### Documentación afectada
- Pendiente de actualización posterior para reflejar los nuevos nodos del catálogo y su shape contractual.

### Criterios de finalización
- El shape público de `image` y `table` queda fijado por tipos, validación `Zod` y validación semántica previa al render.
- El modo manual y el modo dinámico de `table` quedan cerrados sin ambigüedad contractual.
- La validación previa al render asume la responsabilidad de rechazar configuraciones incoherentes, sin delegar ese trabajo al renderer.
- La compatibilidad hacia atrás del catálogo actual queda fijada por tests.

### Cierre de implementación
Completado cuando el borde `config/` acepta y rechaza `image` y `table` de forma inequívoca y deja el runtime libre de decidir shapes contractuales durante el render.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0033-02

### Estado
Completada

### Objetivo
Introducir la base runtime para resolver valores visibles de `image` y de celdas de tabla reutilizando la frontera central de referencias, y renderizar el nodo `image` con degradación segura cuando `src` o `alt` no producen un valor utilizable.

La tarea debe cerrar explícitamente:
- una resolución compartida de valores visibles que mantenga literal vs referencia completa sin crear un parser nuevo por nodo
- el comportamiento de `image` cuando `src` no resuelve un string final utilizable
- el comportamiento de `image` cuando `alt` no resuelve un valor textual final
- la integración de `image` en el dispatcher central y en la capa de styling estable del runtime

### Fuera de alcance
- Renderizar todavía la tabla.
- Introducir lazy loading configurable, placeholders visuales, fallback gráfico o recuperación de errores de red del navegador para imágenes.
- Abrir interpolación parcial dentro de `src`, `alt` o celdas.
- Actualizar todavía la documentación estable.

### Dependencias
- `T0033-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/image-layout-node.tsx`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` solo si hace falta ampliar superficies diagnósticas
  - `src/runtime/runtime-node-styling.ts`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la nueva resolución visible merece contrato propio
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un `image` con `src` y `alt` literales válidos renderiza un `<img>` en el flujo normal del layout.
- Confirmar que `image.src` y `image.alt` resuelven referencias completas soportadas contra `queries.*`, `params.*` e `item.*` cuando existe contexto.
- Confirmar que un `src` ausente, no escalar o vacío degrada a no renderizar el nodo sin romper la pantalla.
- Confirmar que un `alt` no resoluble degrada a string vacío y mantiene diagnóstico de desarrollo coherente.
- Confirmar que `queryStateFeedback` y `visibility` siguen envolviendo o condicionando `image` desde el borde transversal ya existente.
- Confirmar que el nodo expone clases estables del runtime y no introduce una API visual paralela.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el nuevo nodo visible `image` y su degradación segura.

### Criterios de finalización
- `image` usa la capa común de referencias y no crea una lógica ad hoc separada para literales y referencias.
- la resolución visible compartida queda preparada para reutilizarse también en celdas manuales y dinámicas de `table`, sin duplicar la semántica de strings visibles por nodo
- La degradación segura de `image` queda fijada por tests de comportamiento observable.
- El dispatcher central del runtime soporta `image` sin alterar el comportamiento del resto del catálogo.

### Cierre de implementación
Completado cuando el runtime puede renderizar `image` con valores literales o dinámicos y degradar con seguridad ante `src` no utilizable.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0033-03

### Estado
Completada

### Objetivo
Implementar la resolución y el render del nodo `table` para tablas básicas de lectura, cubriendo modo manual y modo dinámico, preservando orden declarado y reutilizando las capas comunes de colecciones, referencias y visibilidad del runtime.

La tarea debe dejar cerrada esta semántica:
- `headers` conserva el orden declarado
- el modo manual conserva el orden declarado de filas
- el modo dinámico itera la colección efectiva en su orden resuelto
- cada celda dinámica interpreta su string como literal o referencia completa, con `item` e `item.*` disponibles por fila
- una colección ausente o no array degrada a cero filas
- una fila parcial conserva la fila y degrada solo las celdas no resolubles a vacío

### Fuera de alcance
- Ordenación, paginación, filtros, búsqueda, selección, acciones por fila o edición inline.
- Plantillas arbitrarias por celda o nodos ricos incrustados dentro de la tabla.
- API declarativa de alineación, tamaño o theming por columna o por celda.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `T0033-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/table-layout-node.tsx`
  - `src/runtime/runtime-collection-sources.ts`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` solo si conviene exponer un helper visible compartido para celdas
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la proyección de celdas comparte contrato verificable fuera del renderer
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que una tabla manual renderiza cabeceras, filas y celdas en el orden declarado.
- Confirmar que una tabla manual soporta celdas con strings literales, referencias completas resolubles y escalares `number | boolean` sin abrir otro contrato por celda.
- Confirmar que una tabla dinámica alimentada por `queries.*` renderiza una fila por item y proyecta cada celda con la referencia correcta.
- Confirmar que una tabla dentro de `repeater` puede consumir `item.*` del contexto iterado y referencias globales en la misma fila.
- Confirmar que una colección ausente, fallida o no coleccionable degrada a tabla sin filas visibles.
- Confirmar que arrays de escalares pueden proyectarse usando `item` completo y que arrays de objetos pueden proyectarse con `item.*`.
- Confirmar que items parciales conservan la fila y vacían solo las celdas no resolubles.
- Confirmar que celdas manuales o dinámicas cuyo valor final no sea visible como string, number o boolean se degradan a vacío sin romper la fila.
- Confirmar que `queryStateFeedback` y `visibility` siguen envolviendo o condicionando `table` igual que el resto del catálogo.
- Confirmar que el marcado final usa semántica HTML real de tabla y clases estables del runtime.

### Documentación afectada
- Pendiente de actualización posterior para reflejar `table` como superficie de lectura tabular básica y sus reglas de degradación.

### Criterios de finalización
- `table` reutiliza la frontera común de colecciones y referencias en lugar de abrir un mini lenguaje nuevo por fila.
- las celdas manuales y dinámicas comparten la misma normalización visible para strings literales, referencias completas y escalares renderizables
- El modo manual y el modo dinámico producen resultados funcionalmente equivalentes al contrato fijado en esta planificación.
- La degradación por colección ausente o datos parciales queda fijada por tests del renderer.

### Cierre de implementación
Completado cuando el runtime puede renderizar `table` en ambos modos con semántica estable, segura y compatible con `repeater`, `queryStateFeedback` y `visibility`.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0033-04

### Estado
Completada

### Objetivo
Ejecutar la regresión transversal del subconjunto afectado para demostrar que el nuevo catálogo `image` + `table` no rompe validación, renderer, referencias, visibilidad ni pantallas existentes que no usan estos nodos.

### Fuera de alcance
- Añadir capacidades nuevas fuera de la spec.
- Reabrir el shape contractual ya fijado salvo bug demostrado por tests.
- Realizar en esta tarea la pasada documental amplia.

### Dependencias
- `T0033-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/config/` o `src/runtime/` estrictamente necesario para cerrar la integración sin ampliar alcance
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si forma parte del contrato cerrado
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la nueva resolución visible quedó formalizada
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Ejecutar la regresión conjunta del contrato de config y del renderer visible afectado por `image` y `table`.
- Confirmar en conjunto que configuraciones históricas sin estos nodos siguen renderizando igual.
- Confirmar en conjunto que `item.*`, `queries.*` y `params.*` mantienen su semántica actual fuera y dentro de los nuevos nodos.
- Ejecutar `pnpm test` para validar el gate global del 80% sobre `src/`.

### Documentación afectada
- Pendiente de actualización posterior en la pasada documental de la feature.

### Criterios de finalización
- El subconjunto afectado queda validado de extremo a extremo sin regresiones abiertas dentro del alcance.
- La compatibilidad exigida por la spec queda demostrada por tests y no solo asumida.
- El gate global de tests y coverage queda listo para pasar a documentación.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, con `pnpm test` en verde y sin deuda funcional abierta dentro del alcance acordado.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0033-05

### Estado
Completada

### Objetivo
Actualizar la documentación funcional, el estado del workflow y el índice de features para dejar explícito el nuevo catálogo `image` + `table`, su contrato JSON, sus límites de alcance y la semántica de degradación segura que queda soportada.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Convertir `README.md` u otros documentos breves en changelog.
- Diseñar capacidades futuras como galerías, tablas avanzadas o theming declarativo por nodo.

### Dependencias
- `T0033-04` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0033-declarative-table-and-image-nodes/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0033-04` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable describe sin ambigüedad el shape de `image` y `table`, sus límites y su integración con `queryStateFeedback`, `visibility` y `repeater`.
- Queda explícito que la tabla sigue acotada a lectura básica y que `image` no abre una superficie de media avanzada.
- `status.yaml` refleja correctamente el cierre de planificación, implementación y documentación según el momento real de la feature.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0033-04`.

### Cierre documental
Completado cuando la documentación funcional y el estado del workflow quedan actualizados de forma consistente.
