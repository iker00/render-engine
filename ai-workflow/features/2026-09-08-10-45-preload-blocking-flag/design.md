# Design: Feature 2026-09-08-10-45 - preload-blocking-flag

## Contexto
`spec.md` cierra el contrato funcional: un campo opcional `blocking` en las entradas de precarga (`pages[].preloads` y el bloque raíz `preloads`), default `false` (no bloqueante, comportamiento actual sin cambios). Cuando `blocking: true`, el render del contenido correspondiente se retrasa hasta que la precarga deja de estar en `loading` (éxito o error desbloquean igual), mostrando mientras tanto un indicador de carga genérico y fijo. La navegación por hash no se retrasa, solo la aparición del contenido.

Estado técnico relevante ya existente:
- `pageEntry` (`runtime-state/`) es la unidad observable de entrada a página: `{ entryId, pageId, params, preloadNames, status: idle|loading|success|error }`. `status` agrega **todas** las precargas de la tanda, no solo un subconjunto, y ya tiene consumidores con contrato propio: restauración de scroll (`navigate-actions.md`, espera a que `pageEntry` deje `loading`) y semántica latest-only.
- El estado individual de cada precarga vive en `queries.{operationName}` (`status|data|error|requestSignature`), independientemente de si la precarga es bloqueante.
- `runtime-query-state-feedback` ya deriva `idle|loading|error|empty|success` como función pura sobre `queries.*`, sin duplicar estado.
- El bloque raíz `preloads` no depende de `initialPage` ni se liga a ningún `pageEntry`: se dispara una vez por montaje del runtime.
- El foco programático del `<section>` de página y el scroll-to-top ya están ligados a la **activación** de la `pageEntry` (creación/reentrada), no al renderizado completo de su `layout`.
- La validación de precargas vive en `src/config/validate-preloads` (dominio propio dentro de la partición de `validate-runtime-config`), compartiendo shape de entrada entre `pages[].preloads` y el bloque raíz `preloads`, con la única asimetría ya existente de que el bloque raíz rechaza `when`.

## Objetivos / No objetivos

### Objetivos
- Definir dónde y cómo se valida el nuevo campo `blocking` sin romper el shape compartido ya validado por `validate-preloads`.
- Definir un mecanismo de "bloqueo pendiente" que no reinterprete ni contamine el contrato ya estable de `pageEntry.status`.
- Definir el punto de intercepción de render (página y app-mount) sin reabrir el contrato ya documentado de foco y scroll-to-top.
- Definir la naturaleza del indicador de carga genérico (fijo, accesible, no declarativo) y su encaje con `conventions.md`.

### No objetivos
- No se diseña la UI configurable del indicador de carga: la spec la deja explícitamente fuera de alcance.
- No se rediseña `pageEntry.status` ni la política de reintentos del bloque raíz (3 intentos): ambas se mantienen intactas.
- No se introduce un timeout para precargas bloqueantes que nunca resuelven.

## Decisiones

### D1. Shape de config y normalización
`blocking` se añade como campo opcional `boolean` al shape de entrada de precarga compartido por `pages[].preloads` y el bloque raíz `preloads` (mismo módulo `validate-preloads` que ya valida `query`/`body`/`headers`/`when`), con default `false`. El objeto normalizado interno (`{ operationName, requestParams }`) se amplía a `{ operationName, requestParams, blocking }`, para que los consumidores posteriores (creación de tanda de `pageEntry`, bootstrap raíz) lean el flag ya resuelto sin volver a tocar el config crudo.
- Alternativa descartada: nombre de campo distinto por bloque (p. ej. `critical` en el bloque raíz). Descartada porque la spec exige la misma semántica y el mismo nombre en ambos bloques; divergir el nombre no aporta nada y rompe consistencia.

### D2. Gate de render por página: derivado propio, no reuso de `pageEntry.status`
No se reutiliza `pageEntry.status` para decidir el bloqueo, porque agrega **todas** las precargas de la tanda y ya tiene consumidores (restauración de scroll, latest-only) cuyo contrato depende de esa agregación completa; cambiar su significado sería incompatible con comportamiento ya documentado.

En su lugar, al crear la tanda de una `pageEntry` se deriva `blockingPreloadNames`: el subconjunto de `preloadNames` de esa entrada (ya filtrado por `when`, igual que hoy) cuyas entradas de config declaran `blocking: true`. "Bloqueo pendiente" se calcula como una función pura sobre `queries.*`: existe algún nombre en `blockingPreloadNames` cuyo `status` es `loading`. No se persiste un booleano sincronizado aparte; se deriva en el momento de decidir qué renderizar, igual que ya hace `runtime-query-state-feedback` con sus propios estados.
- Alternativa descartada: añadir un valor nuevo a `pageEntry.status` (p. ej. `'blocked'`). Descartada por la razón anterior y porque mezclar dos semánticas de agregación (todas vs. solo bloqueantes) en el mismo campo es frágil y confuso para el resto de consumidores existentes de `status`.
- Trade-off asumido: recalcular el derivado en cada render relevante en vez de guardar un flag; el conjunto de nombres bloqueantes de una entrada es pequeño y estable durante su vida, así que el coste es despreciable.

### D3. Gate de render inicial: mismo patrón, ámbito de aplicación
Para el bloque raíz `preloads`, se deriva una vez en bootstrap (capa `src/app/`) el conjunto de `operationName` con `blocking: true`. El montaje de la página inicial se retrasa mientras alguno de esos nombres siga en `status: 'loading'` en `queries.*`, con la misma función derivada que D2 pero sin depender de `pageEntry` (coherente con que el bloque raíz ya es independiente de `initialPage`/`pageEntry`).
- Ambos gates (página y app-mount) se evalúan de forma independiente aunque un mismo `operationName` esté declarado en ambos bloques y comparta `queries.{operationName}` por el dedup ya existente: cada bloque decide su propio bloqueo solo con lo que él mismo declara. Esto resuelve sin lógica nueva el caso límite ya fijado en la spec.

### D4. Punto de intercepción del render
El gate no vive dentro de `layout-renderer` (que resuelve nodo a nodo dentro de un layout ya decidido a renderizarse), sino un nivel por encima:
- Página: en el componente que hoy decide montar el `<section>` de la página activa. El `<section>` se sigue montando de inmediato en la activación de la `pageEntry` (preserva el foco programático y el scroll-to-top ya documentados en `page-model.md`/`navigate-actions.md`, que están ligados a la activación, no al renderizado completo). Solo el **contenido interno** de ese `<section>` alterna entre el indicador de carga genérico y el árbol de `layout-renderer`, según el derivado de D2.
- App-mount: en el punto de composición raíz de `src/app/`, antes de montar la página inicial, análogo pero sin `<section>` de página todavía activo.
- Por qué: evita reabrir contratos ya estables (foco, scroll-to-top, scroll restoration) que están atados a la existencia de la entrada, no a si su layout ya es visible.

### D5. Indicador de carga genérico
Componente de presentación fijo interno (no un nodo declarativo del catálogo de `src/runtime/nodes/`), reutilizado tanto en el gate de página como en el de app-mount. Envuelto en un contenedor `role="status"` con texto accesible, consistente con `ai-workflow/standards/accessibility.md` (estado `loading` → `role="status"` + texto legible por lectores de pantalla) y con el tratamiento ya existente del fallback `loading` de `queryStateFeedback`. Usa utilidades `Tailwind`/tokens globales ya existentes (`runtime-node-styling`), sin introducir una API visual nueva.
- Alternativa descartada: exponerlo como nodo configurable del catálogo. Descartada porque la spec deja explícitamente fuera de alcance su personalización, y porque ampliaría el catálogo de nodos para un concepto que no vive dentro del árbol `layout` de una página.

### D6. Validación del nuevo campo
`blocking` no introduce reglas cruzadas nuevas: no depende de otros campos de la precarga ni cambia la restricción ya existente de `when` en el bloque raíz. Se valida como boolean opcional con el mismo formato de error posicional que ya usa `validate-preloads` para el resto del shape (ruta canónica del campo afectado, p. ej. `preloads[i].blocking` o dentro de `pages[j].preloads[i].blocking` según el bloque).

### D7. Interacción con reevaluación selectiva por firma
No requiere lógica adicional: al derivarse el gate directamente de `queries.*.status`, una precarga bloqueante cuya firma efectiva ya coincide con una query visible (no se relanza, según la política de reevaluación selectiva ya documentada) nunca entra en `loading` para esa entrada, por lo que el gate no bloquea el render. Esto ya cubre el criterio de aceptación de la spec sobre reentradas con firma coincidente.

## Riesgos y trade-offs
- Riesgo aceptado (ya fijado en la spec): si todas las precargas bloqueantes de una tanda son bloqueantes y una nunca resuelve, el contenido queda retrasado indefinidamente; no hay timeout en esta feature.
- Riesgo residual menor: `architecture.md` identifica `src/app/` como la capa de composición raíz pero no nombra el símbolo exacto de montaje de la página inicial; la localización exacta del punto de intercepción de D3/D4 se resuelve en la fase de planning/implementación, sin reabrir esta decisión de capa.
- Trade-off de D2/D3: usar un derivado puro en vez de estado sincronizado simplifica el modelo y evita una nueva clase de bugs de desincronización, a cambio de recalcular la comparación en cada render relevante (coste despreciable dado el tamaño típico de `blockingPreloadNames`).

## Migración o despliegue
No aplica: cambio puramente aditivo en el contrato de config, sin migración de datos ni flag de despliegue. Los configs existentes sin `blocking` declarado mantienen comportamiento observable idéntico al actual.

## Preguntas abiertas
Ninguna bloqueante para planificación: todas las decisiones técnicas necesarias quedan cerradas arriba. El único punto pendiente (localización exacta del componente de montaje en `src/app/`, D4/riesgo residual) es de grano de implementación, no de arquitectura, y no impide trocear el trabajo en `generate-implementation-plan`.
