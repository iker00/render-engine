# Tasks: Collection pagination variants

## Orden de ejecucion
Implementar las tareas en orden estricto: T01 -> T02 -> T03 -> T04 -> T05. T01 y T02 fijan el contrato y el modelo reusable; T03 y T04 consumen ese modelo desde `repeater`; T05 queda para la pasada documental posterior.

## T01 - Extender contrato y validacion de variantes locales

### ID
T01

### Estado
Completada.

### Objetivo
Ampliar el contrato de `repeater.props.pagination.controls.variant` para aceptar exactamente `previousNext`, `numbered` y `scroll`, manteniendo `previousNext` como default efectivo cuando `controls` o `variant` no se declaran.

### Fuera de alcance
- No implementar render visual de `numbered` ni `scroll`.
- No definir paginacion remota, cursores, metadatos de servidor ni campos nuevos fuera de `controls.variant`.
- No cambiar el contrato de `table`.
- No relajar el rechazo de claves extra dentro de `props.pagination` o `props.pagination.controls`.

### Dependencias
Ninguna. Es la primera tarea y bloquea el resto.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts` solo si hace falta ajustar diagnosticos para conservar rutas enfocadas.
- Tests a modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Tests de validacion que acepten `controls.variant: 'numbered'` y `controls.variant: 'scroll'`.
- Tests de regresion que mantengan valido `controls.variant: 'previousNext'`, `controls: {}` y ausencia de `controls`.
- Tests de rechazo para variantes no soportadas y claves extra dentro de la superficie local, incluyendo al menos las claves con apariencia remota `remote`, `cursor`, `total`, `page`, `limit`, `offset` y `hasNext`.

### Documentacion afectada
La documentacion funcional debe actualizarse en una pasada posterior para reflejar el nuevo catalogo cerrado de variantes y aclarar que las claves remotas siguen fuera de contrato.

### Criterios de finalizacion
- El tipo publico de variante local incluye solo `previousNext | numbered | scroll`.
- El schema `Zod` acepta las tres variantes y conserva `strict()` en `pagination` y `controls`.
- Las configuraciones existentes sin `controls` o con `previousNext` siguen normalizando igual.
- Los diagnosticos de configuraciones invalidas siguen apuntando a la ruta concreta de la propiedad fallida.

### Cierre de implementacion
La tarea queda cerrada cuando los tests enfocados de `runtime-config-validation.test.ts` pasan y no queda ningun cambio visual o de runtime mezclado en esta tarea.

### Cierre documental
Pendiente hasta T05 o la pasada `update-app-documentation`. Deben revisarse `config-contract.md`, `config-driven-ui-runtime.md` y `current-state.md`.

## T02 - Derivar modelos locales para numbered y scroll

### ID
T02

### Estado
Completada.

### Objetivo
Extender la capa reusable de paginacion local para exponer, de forma determinista, la ventana compacta de paginas numeradas y la ventana acumulada de items visibles para scroll incremental.

### Fuera de alcance
- No renderizar botones ni sentinel de scroll.
- No leer `queries.*`, estado React ni contexto visual.
- No cambiar la politica de filtrado de keys de `repeater`; esta tarea recibe la coleccion renderizable ya filtrada.
- No crear abstracciones para paginacion remota o `table`.

### Dependencias
Depende de T01 para que el vocabulario de variantes exista en el contrato.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/runtime-collection-pagination.ts`
- Tests a modificar:
  - `src/tests/runtime-collection-pagination.test.ts`
- Documentacion a revisar o actualizar:
  - Ninguna en esta tarea.

### Tests requeridos
- Unit tests para conservar el comportamiento actual de `createCollectionPaginationModel`.
- Unit tests para derivar una ventana numerada completa cuando `totalPages <= 5`.
- Unit tests para derivar una ventana numerada de cinco paginas, centrada y clampada en inicio/final cuando `totalPages > 5`.
- Unit tests para normalizar paginas pedidas fuera de rango.
- Unit tests para derivar scroll incremental: visible inicial `pageSize`, incrementos acumulados de `pageSize`, clamp al total y cero items para colecciones vacias.
- Unit tests que confirmen que los helpers no mutan la coleccion origen.

### Documentacion afectada
No requiere cambios documentales propios; el comportamiento estable quedara documentado al cerrar la feature.

### Criterios de finalizacion
- La logica de pagina activa, totales, limites y ventanas vive en `runtime-collection-pagination.ts` y no se duplica en componentes.
- La ventana numerada sigue exactamente la decision de diseno: todas las paginas hasta cinco; si hay mas, cinco paginas numericas centradas y clampadas.
- El modelo de scroll opera sobre cantidad visible acumulada, no sobre pagina activa.
- Los helpers aceptan colecciones vacias sin errores y devuelven estados no navegables.

### Cierre de implementacion
La tarea queda cerrada cuando `runtime-collection-pagination.test.ts` cubre los modelos nuevos y las regresiones existentes permanecen en verde.

### Cierre documental
Ninguno especifico.

## T03 - Renderizar variante numbered en repeater

### ID
T03

### Estado
Completada.

### Objetivo
Implementar la variante `numbered` en `RepeaterNode` usando el modelo local de T02, con controles de primera, anterior, paginas, siguiente y ultima, manteniendo aislamiento de estado por instancia y sin alterar `queries.*`.

### Fuera de alcance
- No implementar scroll incremental.
- No cambiar el comportamiento visible de `previousNext`.
- No disparar operaciones remotas, navegacion, cambios de formularios ni escritura en URL.
- No introducir personalizacion visual declarativa desde JSON.

### Dependencias
Depende de T01 y T02.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/nodes/repeater-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
- Tests a modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Integration tests que con 5 items y `pageSize: 2` muestren inicialmente los dos primeros items y pagina 1 actual.
- Tests de seleccion de pagina concreta: pagina 2 muestra items 3 y 4; `Ultima` muestra el item 5.
- Tests de limites: `Primera` y `Anterior` deshabilitados en pagina 1; `Siguiente` y `Ultima` deshabilitados en la ultima pagina.
- Test semantico de `aria-current="page"` en la pagina activa.
- Test de una sola pagina efectiva sin controles accionables innecesarios.
- Test de ventana compacta cuando existen mas de cinco paginas.
- Tests de regresion para `previousNext` con `controls.variant: 'previousNext'`, `controls: {}` y `controls` omitido, estado independiente entre repeaters, reset ante cambio de coleccion o `pageSize`, items omitidos por key invalida o duplicada e `item.*` correcto en descendientes.
- Tests de clases de styling para boton normal, boton actual y controles full-row centrados dentro de grid efectivo.

### Documentacion afectada
La pasada documental debe describir la variante `numbered`, su default no automatico, la ventana compacta, los controles disponibles, la semantica local y la ausencia de red.

### Criterios de finalizacion
- `previousNext` conserva labels y comportamiento actual sin texto auxiliar de pagina.
- `numbered` se activa solo con `controls.variant: 'numbered'`.
- La posicion de pagina queda representada por el boton activo en `numbered`; no se renderiza texto auxiliar `Página X de Y`.
- La pagina activa se identifica visual y semanticamente.
- Los controles de pagination usan la superficie de styling compartida y ocupan fila completa dentro de grids efectivos.
- Cambiar pagina no llama a `fetch`, no despacha cambios de query y no modifica navegacion, formularios ni URL.

### Cierre de implementacion
La tarea queda cerrada cuando pasan los tests enfocados de `layout-renderer.test.tsx` y `runtime-node-styling.test.ts` para `numbered`, junto con las regresiones existentes de `previousNext`.

### Cierre documental
Pendiente hasta T05 o la pasada `update-app-documentation`.

## T04 - Implementar scroll incremental local en repeater

### ID
T04

### Estado
Completada.

### Objetivo
Implementar la variante `scroll` como carga incremental local sobre la coleccion ya resuelta: mostrar inicialmente hasta `pageSize` items renderizables y ampliar la cantidad visible por bloques de `pageSize` al alcanzar el sentinel o, sin `IntersectionObserver`, al pulsar una accion local equivalente.

### Fuera de alcance
- No implementar infinite scroll remoto, cursor, refetch ni virtualizacion.
- No reutilizar `pageEntry`, `queries.*` ni acciones UI para avanzar.
- No modificar `table`.
- No mostrar un selector de tamano de pagina ni salto directo.

### Dependencias
Depende de T01 y T02. Debe ejecutarse despues de T03 para reutilizar la superficie de controles y evitar duplicar styling.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/nodes/repeater-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
- Tests a modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Integration test con 5 items y `pageSize: 2`: render inicial de items 1 y 2.
- Test con `IntersectionObserver` mockeado: al disparar interseccion se muestran items 1 a 4; al disparar de nuevo se muestran los 5.
- Test de desaparicion de sentinel/accion cuando todos los items locales estan visibles.
- Test de fallback sin `IntersectionObserver` con boton `Mostrar mas`, confirmando los mismos incrementos y desaparicion final.
- Test de ciclo de vida del observer: se registra solo cuando quedan items ocultos, se desconecta al desmontar o al cambiar coleccion, `pageSize` o `controls.variant`, y no avanza mas alla del total aunque el callback se repita.
- Tests de reset al cambiar coleccion, `pageSize` o `controls.variant`.
- Tests de independencia entre varios repeaters con variante `scroll`, incluso si leen la misma query.
- Test de items omitidos por key invalida o duplicada antes de calcular bloques visibles.
- Test que confirme que avanzar no ejecuta red ni muta `queries.*`.
- Tests de styling para superficie full-row dentro de grid efectivo y accion fallback.

### Documentacion afectada
La pasada documental debe describir `scroll` como incremento local, su fallback accionable, su ausencia de red y su diferencia con paginacion remota futura.

### Criterios de finalizacion
- `scroll` se activa solo con `controls.variant: 'scroll'`.
- El primer render muestra como maximo `pageSize` items renderizables.
- Cada avance muestra un bloque adicional acumulado y nunca salta ni reordena items.
- Cuando no quedan items ocultos no se renderiza indicador ni accion que sugiera mas resultados locales.
- El observer se crea y limpia desde un efecto acotado a la variante `scroll`, al sentinel activo y a la existencia de items ocultos, sin conservar callbacks obsoletos tras reset o desmontaje.
- El avance local no dispara `fetch`, no despacha acciones de query y no modifica navegacion, formularios ni URL.
- El sentinel o accion fallback ocupan la superficie de control del repeater y no se mezclan como item del template.

### Cierre de implementacion
La tarea queda cerrada cuando los tests enfocados de `layout-renderer.test.tsx` y `runtime-node-styling.test.ts` para `scroll` pasan y las regresiones de paginacion local siguen en verde.

### Cierre documental
Pendiente hasta T05 o la pasada `update-app-documentation`.

## T05 - Actualizar documentacion funcional y estado vigente

### ID
T05

### Estado
Completada.

### Objetivo
Actualizar la documentacion estable para reflejar las variantes locales `numbered` y `scroll` una vez que T01-T04 esten implementadas y validadas.

### Fuera de alcance
- No modificar codigo de producto.
- No ampliar alcance hacia `table`, paginacion remota, cursores, virtualizacion ni selector de `pageSize`.
- No convertir `README.md` en changelog.

### Dependencias
Depende de T01, T02, T03 y T04 implementadas con tests relevantes en verde y coverage final validado.

### Impacto esperado en archivos
- Codigo a modificar:
  - Ninguno.
- Tests a modificar:
  - Ninguno.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md` si el indice historico de features requiere registrar el cierre o estado de la feature.
  - `ai-workflow/features/0039-collection-pagination-variants/status.yaml`

### Tests requeridos
No requiere tests nuevos. Antes del cierre documental debe constar que `pnpm test` paso durante la fase de implementacion y que el gate de cobertura global sigue cumplido.

### Documentacion afectada
Todas las rutas listadas en el impacto documental.

### Criterios de finalizacion
- `current-state.md` refleja que `repeater` soporta `previousNext`, `numbered` y `scroll` como variantes locales.
- `config-driven-ui-runtime.md` describe el comportamiento visible estable de las nuevas variantes.
- `config-contract.md` actualiza el catalogo de `controls.variant` y conserva la frontera contra claves remotas.
- `queries-and-feedback.md` aclara que estas variantes consumen la coleccion local cargada sin modificar estado de queries.
- `status.yaml` avanza a la fase documental o completa que corresponda segun el workflow.

### Cierre de implementacion
No aplica; esta tarea no cambia codigo.

### Cierre documental
Cerrado. La documentacion afectada esta actualizada y `status.yaml` refleja el cierre final de la feature.

## Siguiente tarea recomendada
Ninguna. La feature queda cerrada.
