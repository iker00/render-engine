# Tasks: Client-side collection pagination

## Resultado de planificación

La feature requiere `design.md` y queda lista para implementación con el contrato cerrado en este plan. La decisión pública de v1 es:

```ts
repeater.props.pagination?: {
  enabled: true
  pageSize: number
  controls?: {
    variant?: 'previousNext'
  }
}
```

La ausencia de `props.pagination` conserva el comportamiento histórico del `repeater`. Si `pagination` existe, `enabled` debe ser exactamente `true`, `pageSize` debe ser un entero finito mayor o igual que `1`, y la única variante de controles soportada en v1 es `previousNext`, con default efectivo cuando `controls` no se declare. Las claves no soportadas dentro de `pagination` o `pagination.controls` se rechazan de forma explícita para no aceptar configuraciones que parezcan activar paginación remota, cursores o controles todavía fuera de v1.

La implementación debe mantener la paginación como capacidad reutilizable de colecciones, no como lógica escondida en el template de `repeater`. En la integración de `repeater`, la colección que entra en el helper común debe estar formada por las iteraciones renderizables tras aplicar la política actual de `props.items.key`; los items con key ausente, no escalar o duplicada no cuentan para páginas ni totales. La siguiente tarea a ejecutar es `T0038-01`.

## T0038-01

### Estado
Completada

### Objetivo
Ampliar el contrato de configuración para aceptar paginación local en `repeater.props.pagination` con el shape cerrado de v1, validación previa al render y diagnósticos trazables.

### Fuera de alcance
- Implementar todavía la lógica de paginado o los controles visibles.
- Añadir paginación a `table`.
- Aceptar `enabled: false`, paginación remota, cursores, metadatos backend, selector de tamaño, números de página o infinite scroll.
- Aceptar claves extra dentro de `props.pagination` o `props.pagination.controls` como extensiones silenciosas.
- Cambiar la semántica actual de `props.items.source`, `props.items.key` o `props.template`.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si la fachada pública necesita reexportar tipos nuevos.
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Aceptar un `repeater` con `props.pagination.enabled: true`, `pageSize` válido y `controls.variant: 'previousNext'`.
- Aceptar un `repeater` con `props.pagination.enabled: true` y `pageSize` válido aunque omita `controls`.
- Aceptar un `repeater` con `props.pagination.controls: {}` usando el default efectivo de controles en runtime.
- Confirmar que omitir `props.pagination` mantiene el nodo válido y normalizado como antes.
- Rechazar `enabled: false`, ausencia de `enabled`, ausencia de `pageSize`, `pageSize` no entero, `pageSize <= 0`, `pageSize` no finito y variantes de controles distintas de `previousNext`.
- Rechazar claves no soportadas dentro de `props.pagination` y `props.pagination.controls`, con rutas diagnósticas trazables.
- Confirmar que las rutas diagnósticas apuntan a `props.pagination.enabled`, `props.pagination.pageSize` o `props.pagination.controls.variant` según corresponda.
- Confirmar que el nuevo bloque convive con `queryStateFeedback`, `visibility`, `layout.span`, `items` y `template` sin relajar validaciones existentes.

### Documentación afectada
Pendiente de actualización posterior en las fichas del contrato y del runtime configurable.

### Criterios de finalización
- El contrato tipado incluye una interfaz o tipo explícito para paginación de colecciones reutilizable por futuros consumidores.
- `repeater.props.pagination` queda normalizado solo cuando venga declarado.
- La validación previa al render rechaza cualquier configuración de paginación inerte, ambigua o fuera de v1.
- Los tests fijan compatibilidad hacia atrás para repeaters sin paginación.

### Cierre de implementación
Completado cuando contrato, validación y tests de configuración quedan en verde con `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0038-02

### Estado
Completada

### Objetivo
Crear una base reusable de paginación de colecciones en cliente que derive páginas, límites y estado visible sin depender de `repeater`, de su template ni de queries remotas.

### Fuera de alcance
- Renderizar controles React.
- Leer directamente del store del runtime.
- Compartir página activa entre consumidores o persistirla en `runtime-state`.
- Añadir estrategias de paginación remota o cache de respuestas API.

### Dependencias
- `T0038-01` completada.

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-collection-pagination.ts`
- Tests a crear o modificar:
  - `src/tests/runtime-collection-pagination.test.ts`
- Documentación a revisar o actualizar después:
  - Ninguna documentación funcional estable en esta tarea; la capacidad se documentará cuando quede integrada de forma visible.

### Tests requeridos
- Derivar `totalItems`, `totalPages`, página activa normalizada, `canGoPrevious`, `canGoNext` y `visibleItems` para colecciones vacías, colecciones menores que `pageSize`, múltiplos exactos y última página parcial.
- Conservar el orden original de la colección.
- Normalizar índices fuera de rango a una página válida sin devolver una página vacía artificial cuando existen resultados.
- Devolver cero páginas navegables y lista visible vacía cuando la colección está vacía.
- Materializar o cachear el resultado derivado por colección y `pageSize` para que leer otra página del mismo modelo no recalcule cortes de colección.
- Mantener la utilidad sin dependencias de React, `repeater`, `table`, queries o DOM.

### Documentación afectada
Ninguna en esta tarea.

### Criterios de finalización
- Existe una API interna pequeña y nombrada por dominio de paginación de colecciones.
- La API opera sobre `unknown[]` o arrays genéricos y devuelve un modelo reusable por `repeater` y una futura `table`.
- La derivación de páginas queda probada de forma determinista y no muta la colección origen.
- El comportamiento de límites y colecciones vacías queda definido antes de integrar UI.

### Cierre de implementación
Completado cuando la utilidad reusable y sus unit tests quedan en verde con `pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts`.

### Cierre documental
No aplica; esta tarea no cambia todavía comportamiento visible estable por sí sola.

## T0038-03

### Estado
Completada

### Objetivo
Integrar la base de paginación en `RepeaterNode` para que un `repeater` paginado renderice solo los items de la primera página efectiva, manteniendo intactos `item.*`, keys, orden y degradación segura.

### Fuera de alcance
- Añadir todavía botones de anterior y siguiente.
- Cambiar cómo se resuelve `props.items.source`.
- Cambiar la política actual de omitir items con key ausente, no escalar o duplicada.
- Añadir wrappers visuales alrededor de cada item repetido.

### Dependencias
- `T0038-02` completada.

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/repeater-layout-node.tsx`
  - `src/runtime/runtime-collection-pagination.ts` solo si la integración revela un ajuste menor de API.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Dado un `repeater` paginado con 5 items y `pageSize: 2`, el render inicial muestra solo los 2 primeros items.
- Dado un `repeater` sin `props.pagination`, el render mantiene todos los items y conserva los tests históricos.
- Dentro de cada item visible, `heading`, `paragraph`, `list`, `table`, `image`, `button` o formularios descendientes siguen resolviendo `item.*` contra el item real de la colección origen.
- Los items fuera de la página activa no se renderizan ni producen descendientes visibles.
- La identidad declarativa por `props.items.key` se aplica antes de paginar para derivar iteraciones renderizables, manteniendo los mismos diagnósticos de desarrollo y evitando que keys inválidas o duplicadas generen páginas o totales fantasma.
- Query ausente, `loading`, `error`, ruta no array o colección vacía siguen degradando a cero iteraciones sin romper `queryStateFeedback`.

### Documentación afectada
Pendiente de actualización posterior para documentar que `repeater` puede limitar localmente la colección completa ya resuelta.

### Criterios de finalización
- `RepeaterNode` usa la utilidad compartida de paginación y no implementa reglas propias incompatibles.
- La semántica de `item` e `item.*` no cambia para los items visibles.
- Los totales y límites de paginación de `repeater` se calculan sobre iteraciones renderizables con key válida y única, no sobre entradas que el `repeater` ya omitiría.
- Los repeaters sin paginación no cambian su salida observable.
- La integración no introduce red, cambios en queries ni cambios en navegación.

### Cierre de implementación
Completado cuando los tests de renderer relevantes quedan en verde con `pnpm exec vitest run src/tests/layout-renderer.test.tsx`.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0038-04

### Estado
Completada

### Objetivo
Añadir controles visibles mínimos de paginación para `repeater` paginado: anterior, siguiente e indicador textual de página activa sobre total de páginas.

### Fuera de alcance
- Números de página, salto directo, selector de tamaño, infinite scroll, virtualización o controles configurables adicionales.
- Disparar red, refetch o mutaciones de query al cambiar de página.
- Cambiar la gramática visual general del runtime o abrir theming declarativo.

### Dependencias
- `T0038-03` completada.

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/repeater-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/runtime-collection-pagination.ts` solo si hace falta exponer flags de navegación adicionales.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`

### Tests requeridos
- Con 5 items y `pageSize: 2`, el botón siguiente muestra items 3 y 4, y otro click muestra item 5.
- El botón anterior desde la última página vuelve a los items 3 y 4 y después a los 2 primeros.
- El botón anterior está deshabilitado o no accionable en la primera página.
- El botón siguiente está deshabilitado o no accionable en la última página.
- El indicador textual muestra al menos página activa y total de páginas, por ejemplo `Página 1 de 3`.
- Cuando la colección tiene cero o una sola página efectiva, no se muestran controles accionables inútiles.
- Los controles usan botones accesibles `type="button"` y clases coherentes con la baseline compacta.
- Cuando los controles están dentro de un grid efectivo, ocupan una fila completa y no se renderizan como una celda adicional indistinguible del template repetido.
- Tras navegar a otra página, las acciones o descendientes que consumen `item.*` siguen usando el item visible activo y no un contexto obsoleto de una página anterior.

### Documentación afectada
Pendiente de actualización posterior para documentar los controles visibles de v1 y sus límites.

### Criterios de finalización
- Los controles se renderizan después de los items visibles del `repeater` paginado sin envolver ni alterar cada template.
- Los límites de primera y última página quedan bloqueados por estado de botón y por el handler.
- El cambio de página solo cambia estado local del consumidor paginado.
- La salida visual usa helpers centralizados de styling y no clases dispersas incompatibles.

### Cierre de implementación
Completado cuando los tests de renderer y styling quedan en verde con `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0038-05

### Estado
Completada

### Objetivo
Cerrar la semántica de reset, independencia entre instancias y caché efectiva para repeaters paginados, cubriendo refetches, cambios de colección, cambios de `pageSize` y múltiples consumidores sobre la misma query.

### Fuera de alcance
- Guardar la página activa en `runtime-state`.
- Sincronizar la página activa con el hash del navegador.
- Compartir página activa entre `repeater` y una futura `table`.
- Introducir cache histórica entre refetches distintos.

### Dependencias
- `T0038-04` completada.

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/repeater-layout-node.tsx`
  - `src/runtime/runtime-collection-pagination.ts`
  - `src/runtime/runtime-state/` solo si durante la implementación se demuestra imprescindible; por defecto no debe tocarse.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-collection-pagination.test.ts`
  - `src/tests/runtime-state.test.tsx` solo si se toca `runtime-state/`.
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Si el usuario está en una página intermedia y la query reemplaza la colección por otra referencia, el `repeater` vuelve a la primera página válida.
- Si la nueva colección tiene menos páginas que la página activa anterior, no queda visible una página vacía artificial cuando existen resultados anteriores.
- Si cambia el `pageSize` efectivo, la página activa vuelve a la primera página.
- Dos repeaters paginados en la misma página, alimentados por la misma query o por queries distintas, mantienen páginas activas independientes.
- Navegar varias veces entre páginas de la misma colección reutiliza el modelo derivado por colección y `pageSize` en vez de volver a cortar la colección en cada transición.
- Una recarga manual que deja la query en `loading` conservando `data` previo sigue mostrando lo que dicta el estado actual del consumidor y no modifica `queryStateFeedback`.
- Una `pageEntry` nueva o refetch que cambie realmente `data` invalida la caché local y muestra la nueva colección.

### Documentación afectada
Pendiente de actualización posterior para describir reset, independencia local y límites de caché.

### Criterios de finalización
- La página activa se reinicia de forma predecible ante cambios reales de colección o configuración.
- La independencia entre instancias queda probada sin depender de nombres de query distintos.
- La caché queda limitada al resultado derivado local y no impide ver datos nuevos.
- No se introducen cambios en `queries.*`, `pageEntry`, navegación o formularios salvo que una prueba demuestre una necesidad explícita.
- La pasada completa de implementación queda cerrada con el gate global.

### Cierre de implementación
Completado cuando el subconjunto afectado y el gate global quedan en verde con `pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx` y `pnpm test`.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0038-06

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y el estado del workflow para reflejar la paginación local de colecciones ya implementada en `repeater`.

### Fuera de alcance
- Reabrir código de runtime o tests salvo para corregir una inconsistencia documental detectada durante el cierre.
- Documentar paginación en `table` como si ya estuviera implementada.
- Convertir `README.md` en changelog o roadmap de paginación remota.

### Dependencias
- `T0038-05` completada.

### Impacto esperado en archivos
- Código a crear o modificar:
  - Ninguno, salvo corrección menor estrictamente necesaria por inconsistencia documental.
- Tests a crear o modificar:
  - Ninguno.
- Documentación a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
  - `ai-workflow/features/0038-client-side-collection-pagination/status.yaml`

### Tests requeridos
- Ningún test nuevo.
- Confirmar que `T0038-05` dejó `pnpm test` en verde y que `status.yaml` no marca validación completa si ese gate no pasó.

### Documentación afectada
Se cierra en esta propia tarea.

### Criterios de finalización
- Las fichas funcionales afectadas describen la paginación local de `repeater`, su contrato, sus límites y su relación con queries.
- `current-state.md` refleja la nueva capacidad vigente sin convertirla en histórico.
- `ai-workflow/features/index.md` mueve la feature a completadas.
- `status.yaml` marca la documentación y la feature como cerradas.
- El contrato documenta `repeater.props.pagination`, `enabled: true`, `pageSize`, `controls.variant: 'previousNext'` y sus diagnósticos principales.
- La ficha de queries aclara que cambiar de página no dispara red ni cambia `queryStateFeedback`.

### Cierre de implementación
Ya completado en `T0038-05`; esta tarea no reabre el gate de implementación.

### Cierre documental
Completado en esta pasada documental.
