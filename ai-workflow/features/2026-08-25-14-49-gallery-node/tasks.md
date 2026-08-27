# Tareas: nodo `gallery`

Contrato de ejecución para implementar la feature descrita en `spec.md` y `design.md`. Cada tarea se implementa en el orden indicado (T1 → T9); cada una debe cerrarse (código + tests en verde) antes de empezar la siguiente, salvo que se indique explícitamente lo contrario.

Precedentes citados repetidamente: `src/config/validate-map-node.ts`, `src/config/validate-image-node.ts`, `src/config/validate-repeater-node.ts`, `src/runtime/runtime-collection-sources.ts` (`resolveMapMarkerSourceItems`), `src/runtime/nodes/image-layout-node.tsx` + `src/runtime/nodes/use-image-fetch-source.ts`, `src/runtime/nodes/repeater-layout-node.tsx` (variante `scroll`), `src/runtime/nodes/node-components-map.ts`, `src/runtime/layout-node-renderer.tsx`.

## Nota de reajuste posterior a T1-T7

`spec.md` y `design.md` se actualizaron después de cerrar T1-T7 (`status.yaml` los marca `completed`). Dos huecos quedan reflejados en las tareas nuevas de abajo:

- **Soporte en `dev-editor`** (Alcance/FR23 de `spec.md`): T1-T7 lo declaraban explícitamente "fuera de alcance de la spec", lo cual era cierto en el momento en que se planificaron pero dejó de serlo cuando `spec.md` incorporó el editor visual del nodo `gallery` en su alcance. El código de este soporte ya existe y está testeado en el working tree (selector de origen, editor de fuente dinámica, registro en el catálogo del canvas) sin haber pasado por esta skill de planificación. **T8** lo documenta retroactivamente como cerrado, para que `tasks.md` no contradiga el estado real del código.
- **`source.idField`** (FR7 de `spec.md`, D1/D4 de `design.md`): añadido a spec/design después de T1-T7; ni el schema, ni la validación, ni la resolución de fotos lo implementan todavía. **T9** es la tarea pendiente que cierra este hueco.

Ninguna de las dos reabre un criterio de aceptación ya cerrado por T1-T7: T8 es puramente descriptiva de trabajo ya hecho, T9 es una extensión aditiva y acotada del contrato de `source` en submodo `fetch`.

---

## T1 — Contrato de tipos y validación previa al render del nodo `gallery`

### Objetivo
Registrar `gallery` como tipo de nodo válido del catálogo: tipos TypeScript, schema Zod y validación previa al render (`src/config/`), incluyendo las cuatro reglas de exclusión mutua y el rango de `visibleCount`. Al cerrar esta tarea, un config con un nodo `gallery` bien formado se acepta y uno mal formado se rechaza con diagnóstico sobre la ruta exacta — sin que el nodo aún se renderice (eso es T7).

### Fuera de alcance
- Resolución en runtime de la colección (T2).
- Render de cualquier vista (T3-T7).
- Registro en `node-components-map.ts` / `layout-node-renderer.tsx` (T7).
- Soporte en `dev-editor` (fuera de alcance de la spec).

### Dependencias
Ninguna. Primera tarea de la feature.

### Interfaces

**Consume**: ninguno.

**Produce** (en `src/config/runtime-config-types.ts`, re-exportados desde `src/config/runtime-config.ts`):
- `GalleryStaticImage { src: string; alt: string }` — consumido por: T2.
- `GalleryDynamicSource { source: string; key: string; alt: string } & ({ mode: 'src'; src: string } | { mode: 'fetch'; fetch: ImageFetchConfig })` — consumido por: T2.
- `GalleryPaginatedDisplay { mode: 'paginated'; pagination: { pageSize: number; controls?: { variant?: RuntimeCollectionPaginationControlsVariant } } }` — consumido por: T4, T7.
- `GalleryCarouselDisplay { mode: 'carousel'; visibleCount: number; autoplay?: { enabled: true; intervalMs: number }; loop?: boolean }` — consumido por: T5, T7.
- `GalleryLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields { type: 'gallery'; id?: string; props: ({ images: GalleryStaticImage[] } | { source: GalleryDynamicSource }) & { display: GalleryPaginatedDisplay | GalleryCarouselDisplay } }` — consumido por: T2 (función `resolveGalleryPhotos`), T7 (función `GalleryNode`). T3-T6 no reciben el nodo completo, solo los tipos de sub-shape (`ResolvedGalleryPhoto`, `GalleryPaginatedDisplay`, `GalleryCarouselDisplay`) listados arriba.
- `validateGalleryNode(rawNode: Record<string, unknown>, path: string, pageId: string, breadcrumb?: BreadcrumbSegment[]): { status: 'ready'; node: GalleryLayoutNode } | { status: 'error'; error: RuntimeConfigError }` (en `src/config/validate-gallery-node.ts`) — sin consumidores directos en otra tarea (queda enlazado desde el dispatcher que esta misma tarea modifica); expuesto para tests propios de T1.

### Impacto esperado en archivos
- `src/config/runtime-config-types.ts`: añadir `'gallery'` a `LayoutNodeType`, los tipos de Produce arriba, y `GalleryLayoutNode` a la union `LayoutNode`.
- `src/config/runtime-config-zod.ts`:
  - añadir `'gallery'` al array `supportedNodeTypes` (línea ~4). Este array es el gate runtime previo al `switch` de `validate-layout-nodes-core.ts`: `validateLayoutNode` rechaza con `unsupportedNodeType(...)` cualquier `rawNode.type` que no esté en `supportedNodeTypes`, **antes** de llegar al `case 'gallery'` que esta misma tarea añade al switch. Sin esta línea, todo config con `type: 'gallery'` se rechazaría como tipo no soportado y `validateGalleryNode` sería inalcanzable — imprescindible para que los tests de aceptación de esta tarea pasen.
  - nuevo `galleryNodeSchema` (`z.object({ type: z.literal('gallery'), id, queryStateFeedback, visibility, layout, props: z.object({ images: z.array(...).optional(), source: z.object({...}).strict().optional(), display: z.discriminatedUnion('mode', [...]) }).strict(), children: z.never().optional() }).strip()`), siguiendo el mismo patrón que `mapNodeSchema`. `source` se valida como objeto propio (no `discriminatedUnion` sobre `mode` a nivel Zod si complica el mapeo de issues; se acepta resolver el discriminante `mode` de forma imperativa en `validateGalleryNode`, igual que `validate-image-node.ts` hace con `src`/`fetch`).
- `src/config/runtime-config.ts`: re-exportar los tipos nuevos (mismo patrón que el resto de `export type {...}`).
- `src/config/validate-gallery-node.ts` (nuevo): `validateGalleryNode`, siguiendo la estructura de `validate-map-node.ts` (parseo con Zod, mapeo de issues a `invalid-layout` sobre la ruta exacta, `validateQueryStateFeedback`/`validateVisibility` reutilizados, normalización final a `GalleryLayoutNode`).
  - Exclusión `images` vs `source`: exactamente uno declarado (ambos o ninguno → error sobre `{path}.props`).
  - Dentro de `source`: `source.source` se valida con `validateCollectionSource(entry.source, '{path}.props.source.source', pageId, { allowItemReference: true })` — mismo helper y misma opción que ya usan `validate-form-choice-items.ts`, `validate-heading-paragraph-list-nodes.ts` y `validate-table-node.ts` para admitir `queries.*`/`item.*`.
  - `source.alt` y, cuando `mode: 'src'`, `source.src`: se validan con `isValidCollectionProjectionPath` (de `validate-node-shared-helpers.ts`, ya usado por `validate-map-node.ts` para `markerSources[i].label`) — acepta ruta relativa o interpolación `{{...}}`.
  - `source.key`: se valida con un checker local nuevo y no exportado dentro de `validate-gallery-node.ts` que replica el contrato de `isValidRepeaterItemKeyPath` (privada en `validate-repeater-node.ts`, no importable — ver D3 de `design.md`): acepta `"$key"`, `"$index"` o ruta relativa no vacía sin prefijos reservados (`item`, `queries`, `forms`, `params`, `navigation`, `routeParams`). No se importa la función de `validate-repeater-node.ts`.
  - Exclusión `mode: 'src'` vs `mode: 'fetch'` dentro de `source`: exactamente uno de `src`/`fetch` presente según `mode` (si `mode: 'src'` falta `src`, o `mode: 'fetch'` falta `fetch`, o el campo del modo contrario está presente, error sobre la ruta exacta).
  - `source.fetch` (cuando `mode: 'fetch'`): mismo shape y misma validación que `image.props.fetch` (`fetch.url` obligatorio, `fetch.method` opcional del catálogo cerrado, `fetch.headers`/`fetch.body` con la semántica ya validada para `image`).
  - Exclusión `display.mode: 'paginated'` vs `'carousel'`: discriminada por `mode`; `display.pagination` (paginado) sigue el mismo shape cerrado que `repeater.props.pagination` pero **sin** el campo `enabled` (aquí la paginación siempre está activa porque `display.mode` ya lo declara) — reutilizar el mismo criterio de rechazo de claves extra.
  - `display.visibleCount` (carrusel): entero entre `1` y `3` inclusive; fuera de rango → error sobre `{path}.props.display.visibleCount`.
  - `display.autoplay` (carrusel, opcional): si existe, `enabled` debe ser exactamente `true` y `intervalMs` un entero positivo.
- `src/runtime/runtime-references/runtime-reference-diagnostics.ts`: añadir a la union `RuntimeReferenceSurface` los literales `'gallery.props.images.src'` y `'gallery.props.images.alt'` (origen estático, mismo patrón que `'image.props.src'`/`'image.props.alt'`).
- `src/config/validate-layout-nodes-core.ts`: importar `validateGalleryNode` y añadir `case 'gallery': return validateGalleryNode(rawNode, path, pageId, breadcrumb)` al `switch (rawNode.type)`.

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-gallery.test.ts` (nuevo)

**Comportamiento cubierto**:
- Acepta un nodo `gallery` con origen estático (`images`) bien formado y modo `paginated`.
- Acepta un nodo `gallery` con origen dinámico (`source`, `queries.*`) en modo `src` y modo `fetch`.
- Acepta un nodo `gallery` con origen dinámico `item.*` (sintácticamente válido vía `allowItemReference`).
- Rechaza un nodo que declara `images` y `source` a la vez, y uno que no declara ninguno.
- Rechaza `source.mode: 'src'` con `source.fetch` declarado (o sin `source.src`), y `source.mode: 'fetch'` con `source.src` declarado (o sin `source.fetch`).
- Rechaza `source.key` vacío, con prefijo reservado (`item.foo`, `queries.foo`) o con forma malformada (`$index.algo`); acepta `"$key"`, `"$index"` y una ruta relativa simple.
- Rechaza `source.alt` y `source.src` inválidos (ni ruta relativa ni interpolación).
- Rechaza un nodo sin `display` y uno con `display.mode` distinto de `paginated`/`carousel`.
- Modo `paginated`: rechaza `pagination` sin `pageSize`, con `pageSize` no entero o `< 1`, con `controls.variant` fuera de `previousNext|numbered|scroll`, o con claves extra en `pagination`/`pagination.controls`. Rechaza también `pagination.enabled` (no forma parte del contrato de `gallery`, a diferencia de `repeater`).
- Modo `carousel`: rechaza `visibleCount` fuera de `[1,3]`, no entero, o ausente; acepta `1`, `2` y `3`. Acepta `autoplay`/`loop` ausentes (default implícito desactivado) y rechaza `autoplay.intervalMs` no positivo.
- Rechaza `children` declarado en un nodo `gallery`.
- `visibility` y `queryStateFeedback` se validan con el contrato transversal estándar (reutilizar un caso de error de cada uno, como hace `runtime-config-validation-map.test.ts`).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-gallery.test.ts`

**Restricciones**:
- No importar ninguna función privada (no exportada) de `validate-repeater-node.ts`; el checker de `source.key` es una función local nueva en `validate-gallery-node.ts`.
- No añadir `enabled` al shape de `display.pagination`.

### Documentación afectada
Ninguno (se cubre en el cierre de la feature vía T7).

### Criterios de finalización
- `'gallery'` está presente en `supportedNodeTypes` (`runtime-config-zod.ts`) y en el `switch` de `validate-layout-nodes-core.ts`; un config con `type: 'gallery'` deja de rechazarse como `unsupportedNodeType`.
- `validateGalleryNode` cubre las cuatro exclusiones mutuas y el rango de `visibleCount` descritos arriba.
- `validate-layout-nodes-core.ts` despacha `'gallery'` a `validateGalleryNode`.
- Todos los tests de `runtime-config-validation-gallery.test.ts` pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre el fichero de test de la tarea en verde).

---

## T2 — Resolución pura de la colección de fotos (`resolveGalleryPhotos`)

### Objetivo
Función pura que, dado un `GalleryLayoutNode` ya validado y el `RuntimeState`, resuelve la lista de fotos a renderizar — sin disparar ninguna petición de red (el modo `fetch` se resuelve más tarde, por tile, en T3/T6, según D11 de `design.md`).

### Fuera de alcance
- Ejecutar la petición `fetch` de las fotos en modo `fetch` (T3, T6).
- Cualquier render.
- Soporte de fuente dinámica objeto-plano: `resolveCollectionSourceItems` (reutilizada tal cual, D2 de `design.md`) solo devuelve items cuando la fuente resuelta es un array; a diferencia de `repeater`, `gallery` no implementa detección de objeto-plano. Esto es intencional, no un hueco: si `source.key` es `"$key"`, el comportamiento efectivo es "cero iteraciones" (igual que documenta `repeater.md` para `"$key"` sobre fuente array) porque nunca hay fuente objeto-plano en `gallery`.

### Dependencias
T1.

### Interfaces

**Consume**:
- `GalleryLayoutNode` (de T1).
- `resolveCollectionSourceItems(source: string, state: RuntimeState, options?: { iterationContext?: RuntimeIterationContext }): unknown[]` (existente, `src/runtime/runtime-collection-sources.ts`, sin modificar).
- `resolveRuntimeVisibleValue(value: string | number | boolean, state: RuntimeState, surface: RuntimeReferenceSurface, options?): unknown` (existente, `src/runtime/runtime-references/runtime-reference-resolver.ts`) — reutilizada para el origen estático (`images[].src`/`.alt`, con los surfaces `'gallery.props.images.src'`/`'gallery.props.images.alt'` añadidos en T1) y para la rama con interpolación `{{...}}` de `source.src`/`source.alt` en origen dinámico.
- `hasRuntimeTemplateDelimiter(value: string): boolean` (existente, `src/config/runtime-reference-syntax.ts`) — para decidir, en origen dinámico, si `source.src`/`source.alt` se resuelven por interpolación o por ruta relativa simple.

**Produce** (en `src/runtime/runtime-gallery-photos.ts`, nuevo):
```
interface ResolvedGalleryPhoto {
  key: string
  alt: string
  source:
    | { mode: 'src'; src: string }
    | { mode: 'fetch'; fetch: ImageFetchConfig; iterationContext?: RuntimeIterationContext }
}

function resolveGalleryPhotos(
  node: GalleryLayoutNode,
  state: RuntimeState,
  options?: { iterationContext?: RuntimeIterationContext },
): ResolvedGalleryPhoto[]
```
— consumido por: T3 (tipo `ResolvedGalleryPhoto`), T4 (tipo), T5 (tipo), T6 (tipo), T7 (función y tipo).

### Impacto esperado en archivos
- `src/runtime/runtime-gallery-photos.ts` (nuevo):
  - Origen estático (`node.props.images`): por cada entrada, resolver `src` con `resolveRuntimeVisibleValue(entry.src, state, 'gallery.props.images.src', { iterationContext })` (degradar a omitir la entrada si el resultado no es un string no vacío, mismo criterio que `resolveRuntimeImageSource` pero sin poder reutilizar esa función directamente porque hardcodea el surface `'image.props.src'`) y `alt` con `resolveRuntimeVisibleValue(entry.alt, state, 'gallery.props.images.alt', { iterationContext })` normalizado a string (igual que `resolveRuntimeImageAlt`). `key` = índice del array como string.
  - Origen dinámico (`node.props.source`): `items = resolveCollectionSourceItems(node.props.source.source, state, { iterationContext })`. Por cada `item` con índice `i`:
    - `key`: función local nueva (no exportada) que replica, sobre `item`/`i`, el contrato de `repeater.props.items.key` restringido al caso array (`"$index"` → `String(i)`; `"$key"` → siempre inválido, se omite la iteración porque no hay fuente objeto-plano; ruta relativa → navegar el path dentro de `item`, se omite la iteración si no se encuentra o no es escalar).
    - `alt`: si `hasRuntimeTemplateDelimiter(node.props.source.alt)`, resolver con `resolveRuntimeVisibleValue(node.props.source.alt, state, 'gallery.props.images.alt', { iterationContext: { item, key, itemIndex: i } })`; si no, navegar `node.props.source.alt` como ruta relativa dentro de `item` (nueva función local pequeña de navegación por path, análoga a la privada `resolveCollectionItemPath` de `runtime-collection-sources.ts`, no importable porque no está exportada) y convertir a texto, degradando a `''` si no se encuentra.
    - Si `node.props.source.mode === 'src'`: resolver `source.src` con la misma estrategia interpolación-o-ruta-relativa que `alt` (surface `'gallery.props.images.src'` en la rama interpolada); si el resultado no es un string no vacío, **omitir la entrada completa del array devuelto** (FR16).
    - Si `node.props.source.mode === 'fetch'`: no resolver nada de red aquí; producir `{ key, alt, source: { mode: 'fetch', fetch: node.props.source.fetch, iterationContext: { item, key, itemIndex: i } } }` para **todas** las iteraciones con key válida (sin omitir por resultado de fetch — eso ocurre por tile en T3/T6, ver FR17 y D11).
    - Iteraciones con `key` inválido/omitido no producen entrada (mismo criterio que `repeater` con key ausente/no escalar/duplicada; ver `repeater.md`).

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-gallery-photos.test.ts` (nuevo)

**Comportamiento cubierto**:
- Origen estático: una entrada por elemento de `images`, con `src`/`alt` resueltos; entrada con `src` no resoluble a string no vacío se omite.
- Origen dinámico `queries.{q}.data` con datos: una entrada por elemento, `key`/`alt` resueltos correctamente.
- Origen dinámico `item.*` dentro de un contexto de iteración simulado (`iterationContext.item`) vs fuera de él (sin `iterationContext`, o `item` ausente): dentro resuelve normalmente, fuera degrada a cero fotos.
- `queries.*` sin datos o con la query aún no ejecutada: cero fotos, sin error.
- `source.key`: `"$index"` usa el índice; `"$key"` siempre omite todas las iteraciones (fuente array); ruta relativa resuelve contra el item y se omite si no se encuentra.
- Modo `src` dinámico: entrada con `source.src` no resoluble a string no vacío se omite; el resto de entradas se resuelve con normalidad.
- Modo `fetch` dinámico: se produce una entrada `{ mode: 'fetch', fetch, iterationContext }` por cada item con key válida, sin ninguna omisión basada en el resultado de una petición (esta función no dispara red).
- `alt` dinámico: interpolación `{{...}}` con `item.*` resuelve correctamente; ruta relativa simple (sin `{{}}`) navega el item directamente sin tratarlo como referencia global.
- Colección vacía (estática `[]` o dinámica sin datos): devuelve `[]`.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-gallery-photos.test.ts`

**Restricciones**:
- No importar funciones privadas (no exportadas) de `runtime-collection-sources.ts` (`resolveCollectionItemPath`, `resolveMapMarkerLabel`, etc.); replicar el patrón con funciones locales nuevas.
- No usar `resolveRuntimeImageSource`/`resolveRuntimeImageAlt` directamente (hardcodean el surface `'image.props.*'`); usar `resolveRuntimeVisibleValue` con los surfaces de `gallery` en su lugar.

### Documentación afectada
Ninguno (se cubre en el cierre de la feature vía T7).

### Criterios de finalización
- `resolveGalleryPhotos` cubre origen estático y dinámico, ambos modos de carga, y el contrato completo de `key`.
- Todos los tests de `runtime-gallery-photos.test.ts` pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre el fichero de test de la tarea en verde).

---

## T3 — Tile de foto individual (`GalleryPhotoTile`)

### Objetivo
Componente reutilizable que renderiza una única foto resuelta (modo `src` o modo `fetch`, con ejecución real de la petición binaria en este último caso) y expone un click para seleccionarla (abrir lightbox). Reutilizado tal cual por T4 (grid paginado) y T5 (carrusel).

### Fuera de alcance
- Layout de grid/paginación (T4) o de carrusel (T5).
- El propio lightbox (T6) — este replica el mismo patrón de dos componentes descrito abajo, no reutiliza `GalleryPhotoTile` directamente (D11 de `design.md`: misma unidad de *resolución*, no el mismo componente de *interacción*).

### Dependencias
T2.

### Interfaces

**Consume**:
- `ResolvedGalleryPhoto` (de T2).
- `useImageFetchSource(fetchConfig: ImageFetchConfig, iterationContext?: RuntimeIterationContext): { status: 'pending' | 'success' | 'error'; src: string | null }` (existente, `src/runtime/nodes/use-image-fetch-source.ts`, sin modificar).

**Produce** (en `src/runtime/nodes/gallery-photo-tile.tsx`, nuevo):
```
function GalleryPhotoTile(props: { photo: ResolvedGalleryPhoto; onSelect: () => void }): JSX.Element | null
```
— consumido por: T4, T5.

### Impacto esperado en archivos
- `src/runtime/nodes/gallery-photo-tile.tsx` (nuevo): `GalleryPhotoTile` como componente no-hook que decide, según `photo.source.mode`, entre renderizar la rama `src` directamente o delegar en un componente hermano privado `GalleryPhotoTileWithFetch` que sí llama a `useImageFetchSource` incondicionalmente — mismo patrón exacto que `ImageNode`/`ImageNodeWithFetch` en `image-layout-node.tsx` (evita violar las reglas de hooks de React). Rama `fetch` en estado `pending`/`error` (o `src` resultante `null`): no renderiza ningún `<img>` (FR17). El elemento renderizado (botón o `<img>` envuelto en un elemento clicable) invoca `onSelect` en click; usar un `<button type="button">` envolvente para accesibilidad (foco y activación por teclado gratis).
- `src/runtime/runtime-node-styling-gallery.ts` (nuevo): helper(s) de clases Tailwind para el tile (tamaño, `object-fit`, estado clicable), siguiendo el patrón de `runtime-node-styling-map.ts` (fichero de estilos dedicado por nodo cuando el nodo tiene suficiente superficie visual propia).

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-gallery-photo-tile.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-styling-gallery.test.ts` (nuevo)

**Comportamiento cubierto**:
- Modo `src`: renderiza `<img>` con el `src`/`alt` de la foto.
- Modo `fetch`: dispara la petición al montar (mock de `useImageFetchSource` o del binary fetch subyacente, igual que `runtime-file-input-hook.test.tsx`/`runtime-image-binary-fetch.test.ts` mockean su capa de red); no renderiza `<img>` mientras está `pending` o tras `error`; renderiza `<img>` con el `src` (`blob:...`) al resolver con éxito.
- Click sobre el tile invoca `onSelect` exactamente una vez (en ambos modos, cuando hay imagen renderizada).
- `runtime-node-styling-gallery.test.ts`: helpers puros de clase para el tile (sin DOM), sin acoplarse a un valor de clase concreto salvo lo que sea parte del contrato Tailwind del proyecto.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-gallery-photo-tile.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-node-styling-gallery.test.ts`

**Restricciones**:
- No usar un único hook que llame condicionalmente a `useImageFetchSource`; replicar el patrón de dos componentes de `image-layout-node.tsx`.

### Documentación afectada
Ninguno (se cubre en el cierre de la feature vía T7).

### Criterios de finalización
- `GalleryPhotoTile` renderiza correctamente ambos modos y degrada según FR16/FR17.
- Todos los tests de ambos ficheros pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre los ficheros de test de la tarea en verde).

---

## T4 — Vista paginada (`GalleryPaginatedView`)

### Objetivo
Grid de fotos con paginación local en cliente, reutilizando el modelo ya existente de `repeater`/`table`, con las tres variantes de controles (`previousNext`, `numbered`, `scroll`).

### Fuera de alcance
- Vista carrusel (T5).
- Lightbox (T6) — esta tarea solo invoca `onSelectPhoto`, no abre nada.
- Registro del nodo en el catálogo (T7).

### Dependencias
T1, T2, T3.

### Interfaces

**Consume**:
- `ResolvedGalleryPhoto`, `GalleryPaginatedDisplay` (de T1/T2).
- `GalleryPhotoTile` (de T3).
- `createCollectionPaginationModel<T>(items: readonly T[], pageSize: number): CollectionPaginationModel<T>`, `createCollectionScrollWindow<T>(items: readonly T[], pageSize: number, visibleCount: number): CollectionScrollWindow<T>`, `createNumberedPaginationWindow(input): number[]` (existentes, `src/runtime/runtime-collection-pagination.ts`, sin modificar).
- `CollectionPaginationControls` (existente, `src/runtime/nodes/collection-pagination-controls.tsx`, sin modificar) — cubre únicamente las variantes `previousNext`/`numbered`.

**Produce** (en `src/runtime/nodes/gallery-paginated-view.tsx`, nuevo):
```
function GalleryPaginatedView(props: {
  display: GalleryPaginatedDisplay
  photos: ResolvedGalleryPhoto[]
  onSelectPhoto: (index: number) => void
}): JSX.Element | null
```
— consumido por: T7.

### Impacto esperado en archivos
- `src/runtime/nodes/gallery-paginated-view.tsx` (nuevo): grid de `GalleryPhotoTile` (una celda por foto visible en la página/ventana actual); estado local `activePage`/`scrollVisibleCount` reseteado a su valor inicial cuando cambia la identidad/longitud de `photos` (D12 de `design.md`, mismo criterio que `repeater` paginado). `onSelectPhoto(index)` recibe el índice de la foto **dentro del array completo `photos`** (no el índice relativo a la página/ventana visible), para que T7 pueda abrir el lightbox sobre el conjunto completo (FR14).
  - Variantes `previousNext`/`numbered`: usar `createCollectionPaginationModel` + `CollectionPaginationControls` tal cual.
  - Variante `scroll`: **no** existe un componente compartido para esto (`CollectionPaginationControls` no la implementa); replicar el patrón local de `RepeaterScrollControls` en `repeater-layout-node.tsx` (sentinel con `IntersectionObserver`, umbral `0.75`, fallback a botón "Mostrar más" cuando `IntersectionObserver` no está disponible) como un componente privado nuevo dentro de este mismo fichero, usando `createCollectionScrollWindow`.
- `src/runtime/runtime-node-styling-gallery.ts` (ampliación de T3): helpers de clase para el grid y los controles de paginación de `gallery` (no reutilizar los helpers específicos de `repeater`, p. ej. `getRepeaterPaginationControlsClassName`, que son privados/propios de ese nodo).

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-gallery-paginated-view.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-styling-gallery.test.ts` (ampliación — añade los casos de los helpers de clase para el grid y los controles de paginación descritos en "Impacto esperado en archivos")

**Comportamiento cubierto**:
- Con `pageSize` declarado, muestra como máximo `pageSize` fotos por página.
- Variante `previousNext`: navega adelante/atrás, deshabilita botones en los extremos.
- Variante `numbered`: muestra ventana de hasta cinco páginas, marca la activa con `aria-current="page"`.
- Variante `scroll`: muestra inicialmente `pageSize` fotos y amplía la ventana al interactuar con el sentinel/botón "Mostrar más" (mock de `IntersectionObserver`, mismo patrón que `layout-renderer-repeater-pagination.test.tsx`); fallback a botón cuando `IntersectionObserver` no existe en el entorno de test.
- Click en un tile invoca `onSelectPhoto` con el índice correcto dentro del array completo (no el índice relativo a la página).
- Colección vacía: no renderiza controles de paginación ni tiles.
- Cambiar la identidad de `photos` (simulando refetch) resetea la página/ventana activa a su estado inicial.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-gallery-paginated-view.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-node-styling-gallery.test.ts`

**Restricciones**:
- No importar `RepeaterScrollControls` ni ningún helper privado de `repeater-layout-node.tsx`; replicar el patrón localmente.

### Documentación afectada
Ninguno (se cubre en el cierre de la feature vía T7).

### Criterios de finalización
- Las tres variantes de control funcionan sobre la colección de fotos resuelta.
- Todos los tests de `runtime-gallery-paginated-view.test.tsx` pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre el fichero de test de la tarea en verde).

---

## T5 — Vista carrusel (`GalleryCarouselView`)

### Objetivo
Vista de carrusel con 1-3 imágenes visibles simultáneas, navegación manual, autoplay y loop opcionales, implementada sobre `embla-carousel-react` + `embla-carousel-autoplay` (D7 de `design.md`).

### Fuera de alcance
- Vista paginada (T4, ya cerrada).
- Lightbox (T6).
- El `React.lazy` que carga este módulo bajo demanda (D8, segundo nivel de code-splitting) — eso lo hace T7 al componer `GalleryNode`; este módulo se implementa como un componente normal, no como el punto de entrada `React.lazy` en sí.

### Dependencias
T1, T2, T3.

### Interfaces

**Consume**:
- `ResolvedGalleryPhoto`, `GalleryCarouselDisplay` (de T1/T2).
- `GalleryPhotoTile` (de T3).

**Produce** (en `src/runtime/nodes/gallery-carousel-view.tsx`, nuevo):
```
function GalleryCarouselView(props: {
  display: GalleryCarouselDisplay
  photos: ResolvedGalleryPhoto[]
  onSelectPhoto: (index: number) => void
}): JSX.Element | null
```
— consumido por: T7 (envuelto en `React.lazy`).

### Impacto esperado en archivos
- `package.json`: añadir `embla-carousel-react` y `embla-carousel-autoplay` a `dependencies` (no `devDependencies`, se usan en el bundle final — mismo criterio que `leaflet`/`react-leaflet`). Ejecutar `pnpm install` para regenerar `pnpm-lock.yaml`.
- `src/runtime/nodes/gallery-carousel-view.tsx` (nuevo):
  - `useEmblaCarousel` con opción `loop: display.loop ?? false` y, si `display.autoplay?.enabled`, el plugin `Autoplay({ delay: display.autoplay.intervalMs })` de `embla-carousel-autoplay`.
  - `display.visibleCount` (1-3) controla cuántos slides son visibles simultáneamente vía el tamaño de cada slide (técnica estándar de `embla-carousel-react`: cada slide con `flex-basis` = `100 / visibleCount`%, sin lógica adicional de la librería).
  - Un `GalleryPhotoTile` por foto, dentro de la estructura de slides de `embla`; `onSelect` de cada tile invoca `onSelectPhoto(index)` con el índice dentro del array completo `photos` (igual que T4, para FR14).
  - Controles de navegación manual (flechas prev/next) siempre visibles y operativos con independencia del autoplay (FR12); usar la API programática de `embla` (`scrollPrev`/`scrollNext`) para implementarlos.
  - Colección con menos fotos que `visibleCount` (incluida una sola foto): se renderiza sin relleno artificial; controles de navegación deshabilitados (comportamiento nativo de `embla` cuando el viewport configurado excede el número de slides — D9 de `design.md`, sin lógica adicional).
  - Reset de posición activa al cambiar la identidad/longitud de `photos` (D12).
- `src/runtime/runtime-node-styling-gallery.ts` (ampliación de T3/T4): helpers de clase para el viewport/contenedor/slide del carrusel y sus controles (flechas), sin CSS propio de `embla` (headless, D7).

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-gallery-carousel-view.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-styling-gallery.test.ts` (ampliación — añade los casos de los helpers de clase para el viewport/slides/flechas del carrusel descritos en "Impacto esperado en archivos")

**Comportamiento cubierto**:
- Con `visibleCount` entre 1 y 3, muestra ese número de fotos simultáneas y permite navegar manualmente al resto.
- Autoplay activado: las imágenes avanzan según `intervalMs` sin bloquear la navegación manual.
- Loop activado: al llegar a la última imagen, avanzar vuelve a la primera (y viceversa).
- Loop desactivado: al llegar a la última imagen, no hay avance adicional (o el control de avance queda deshabilitado).
- Colección con una única foto: se renderiza sin controles de navegación operativos.
- Click en un tile invoca `onSelectPhoto` con el índice correcto dentro del array completo.
- Cambiar la identidad de `photos` resetea la posición activa del carrusel.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-gallery-carousel-view.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-node-styling-gallery.test.ts`

**Restricciones**:
- Mockear `embla-carousel-react` y `embla-carousel-autoplay` en el test (mismo criterio que `layout-renderer-map.test.tsx` mockea `react-leaflet` con `vi.mock('react-leaflet', () => ({...}))`); no depender del comportamiento real de drag/swipe de `embla`.
- No introducir CSS propio de terceros (`embla` es headless); todo el markup se estiliza con Tailwind vía `runtime-node-styling-gallery.ts`.

### Documentación afectada
Ninguno (se cubre en el cierre de la feature vía T7).

### Criterios de finalización
- El carrusel cubre `visibleCount`, autoplay, loop y navegación manual según FR9-FR12.
- Todos los tests de `runtime-gallery-carousel-view.test.tsx` pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre el fichero de test de la tarea en verde).

---

## T6 — Lightbox (`GalleryLightbox`)

### Objetivo
Vista ampliada superpuesta de una foto, con navegación anterior/siguiente sobre el conjunto **completo** de fotos de la galería y cierre explícito (botón, clic fuera, tecla Esc).

### Fuera de alcance
- Reutilizar el nodo `modal` del catálogo (D10 de `design.md`: implementación propia, no instancia de `modal`).
- Atrapamiento de foco y navegación por flechas de teclado entre imágenes (fuera de alcance v1 explícito, D10).
- Zoom, gestos táctiles, descarga de imagen (fuera de alcance de `spec.md`).

### Dependencias
T1, T2.

### Interfaces

**Consume**:
- `ResolvedGalleryPhoto` (de T2).
- `useImageFetchSource` (existente, igual que T3).

**Produce** (en `src/runtime/nodes/gallery-lightbox.tsx`, nuevo):
```
function GalleryLightbox(props: {
  photos: ResolvedGalleryPhoto[]
  activeIndex: number
  onNavigate: (index: number) => void
  onClose: () => void
}): JSX.Element
```
— consumido por: T7.

### Impacto esperado en archivos
- `src/runtime/nodes/gallery-lightbox.tsx` (nuevo):
  - Overlay semitransparente + panel centrado con la foto en `photos[activeIndex]`, replicando el patrón visual ya establecido por `modal` (overlay, cierre por botón explícito, clic fuera del panel, tecla Esc) como implementación local — no instancia el nodo `modal`.
  - Resolución de la imagen activa: replicar el mismo patrón de dos componentes (uno para `mode: 'src'`, uno hermano que llama a `useImageFetchSource` para `mode: 'fetch'`) que usa `GalleryPhotoTile` (T3) e `ImageNode`/`ImageNodeWithFetch` — misma unidad de resolución por-item, sin wrapper de click-to-select (D11 de `design.md`). Mientras la foto activa está en modo `fetch` y su petición sigue `pending`/ha fallado, el lightbox no muestra `<img>` (mismo criterio de degradación que en el tile).
  - Navegación anterior/siguiente invoca `onNavigate` con el índice siguiente/anterior dentro de `photos` (clamp en los extremos: sin loop propio del lightbox, salvo que `spec.md`/`design.md` no piden loop aquí — no se añade).
  - Cierre: botón explícito, clic en el overlay (fuera del panel de imagen) y tecla Esc invocan `onClose`.
  - Si `activeIndex` queda fuera de rango de `photos` (por ejemplo tras cambiar la colección con el lightbox abierto), el componente no intenta renderizar una foto inexistente; esta tarea expone el caso pero **no** decide si se cierra automáticamente — esa decisión de orquestación (cerrar el lightbox) vive en T7, que es quien controla el estado `activeIndex`/`open`.
- `src/runtime/runtime-node-styling-gallery.ts` (ampliación): helpers de clase para el overlay/panel/controles del lightbox.

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-gallery-lightbox.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-styling-gallery.test.ts` (ampliación — añade los casos de los helpers de clase para el overlay/panel/controles del lightbox descritos en "Impacto esperado en archivos")

**Comportamiento cubierto**:
- Renderiza la foto en `photos[activeIndex]` ampliada.
- Navegar adelante/atrás invoca `onNavigate` con el índice correcto; en los extremos sin loop, no invoca `onNavigate` con un índice fuera de rango.
- Cierre por botón explícito invoca `onClose`.
- Cierre por clic fuera del panel (overlay) invoca `onClose`; clic dentro del panel no lo hace.
- Cierre por tecla Esc invoca `onClose`.
- Foto activa en modo `fetch`: no renderiza `<img>` mientras está `pending`/tras `error`; lo renderiza al resolver con éxito (mock de `useImageFetchSource`, mismo patrón que T3).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-gallery-lightbox.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-node-styling-gallery.test.ts`

**Restricciones**:
- No instanciar el nodo `modal` del catálogo ni su dominio de estado `openModal`/`closeModal`.
- No implementar foco atrapado ni navegación por flechas de teclado (fuera de alcance v1).

### Documentación afectada
Ninguno (se cubre en el cierre de la feature vía T7).

### Criterios de finalización
- El lightbox cubre FR13-FR15 (abrir, navegar sobre el conjunto completo, cerrar por las tres vías).
- Todos los tests de `runtime-gallery-lightbox.test.tsx` pasan.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre el fichero de test de la tarea en verde).

---

## T7 — Composición del nodo `gallery` y registro en el catálogo

### Objetivo
Ensamblar `GalleryNode` (resuelve fotos, gestiona el estado del lightbox, despacha entre vista paginada y vista carrusel con el segundo nivel de code-splitting de D8) y registrarlo en el catálogo de nodos del runtime, dejando `gallery` operativo de punta a punta a través de `LayoutRenderer`.

### Fuera de alcance
- Cualquier lógica de resolución, validación o vista ya cerrada en T1-T6 (esta tarea solo compone y registra).
- Soporte en `dev-editor` (fuera de alcance de la spec).
- Test dedicado de peso de bundle del split interno de `embla` (D8 de `design.md` señala explícitamente que no hace falta un test nuevo para esto; verificación manual del chunk generado por `vite build` como criterio de finalización, no como test automatizado).

### Dependencias
T1, T2, T4, T5, T6.

### Interfaces

**Consume**:
- `resolveGalleryPhotos`, `ResolvedGalleryPhoto` (de T2).
- `GalleryPaginatedView` (de T4).
- `GalleryCarouselView` (de T5).
- `GalleryLightbox` (de T6).
- `GalleryLayoutNode` (de T1).
- `useRuntimeState()` (existente, `src/runtime/runtime-state/use-runtime-state.ts`).

**Produce** (en `src/runtime/nodes/gallery-layout-node.tsx`, nuevo):
```
function GalleryNode(props: { node: GalleryLayoutNode; iterationContext?: RuntimeIterationContext }): JSX.Element
```
— consumido por: `node-components-map.ts` y `layout-node-renderer.tsx` (registro de catálogo, en esta misma tarea, no una tarea futura).

### Impacto esperado en archivos
- `src/runtime/nodes/gallery-layout-node.tsx` (nuevo):
  - `const state = useRuntimeState()`; `const photos = resolveGalleryPhotos(node, state, { iterationContext })`.
  - Estado local `{ open: boolean; activeIndex: number }` para el lightbox, con `onSelectPhoto = (index) => setLightbox({ open: true, activeIndex: index })`.
  - Si `photos.length === 0`: no renderiza ninguna vista ni controles (caso límite de `spec.md`: colección vacía).
  - Despacho por `node.props.display.mode`:
    - `'paginated'`: `<GalleryPaginatedView display={node.props.display} photos={photos} onSelectPhoto={onSelectPhoto} />` (import estático, mismo módulo que el resto del nodo).
    - `'carousel'`: `React.lazy(() => import('./gallery-carousel-view').then((m) => ({ default: m.GalleryCarouselView })))` envuelto en `<Suspense fallback={null}>` — segundo nivel de code-splitting de D8, para que una instancia en modo `paginated` nunca descargue `embla`.
  - Si `lightbox.open`, renderiza `<GalleryLightbox photos={photos} activeIndex={lightbox.activeIndex} onNavigate={...} onClose={() => setLightbox({ open: false, activeIndex: 0 })} />` por encima de la vista activa.
  - Si `photos` cambia de identidad/longitud mientras el lightbox está abierto y `lightbox.activeIndex >= photos.length`, cerrar el lightbox (regla defensiva mínima para no romper el render; no es un requisito nuevo de producto, es la misma política de "degradar sin romper" ya aplicada en el resto del catálogo).
- `src/runtime/nodes/node-components-map.ts`: añadir `import { GalleryNode } from './gallery-layout-node'`; añadir `gallery: GalleryNode as AnyComponent` a `eagerMap`; añadir `gallery: React.lazy(() => import('./gallery-layout-node').then((m) => ({ default: m.GalleryNode })))` a `lazyMap` — mismo patrón exacto que la entrada `map`.
- `src/runtime/layout-node-renderer.tsx`: añadir `case 'gallery': { const GalleryNode = NodeComponents.gallery; renderedNode = <GalleryNode node={node} iterationContext={iterationContext} />; break }` al `switch`, mismo patrón que el `case 'map'` existente.

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-gallery.test.tsx` (nuevo) — origen estático/dinámico, modo paginado, transversales (`layout.span`/`visibility`/`queryStateFeedback`), degradación FR16/FR17, reset por cambio de colección, apertura/cierre/navegación del lightbox.
- `src/tests/layout-renderer/layout-renderer-gallery-carousel.test.tsx` (nuevo) — modo carrusel end-to-end (`visibleCount`/autoplay/loop) y confirmación de que se registra vía el segundo nivel de lazy loading de T5/T7 (mock de `embla-carousel-react`/`embla-carousel-autoplay`, mismo criterio que T5).

**Comportamiento cubierto**:
- Config con lista estática de imágenes: renderiza una imagen por entrada declarada (criterio de aceptación de `spec.md`).
- Config con fuente dinámica `queries.*` con datos: renderiza una imagen por elemento resuelto.
- Config con fuente dinámica `item.*` dentro de `repeater.props.template`: cada iteración del `repeater` renderiza su propia galería con la colección de fotos de su propio item (FR de `spec.md` sobre `repeater`).
- Config que combina origen estático y dinámico, o ninguno: la validación previa al render rechaza el config completo (ya cubierto en T1, aquí se confirma que el nodo nunca llega a renderizarse en ese caso — verificación de integración, no repetición del test de validación).
- Modo paginado con `pageSize`: máximo `pageSize` imágenes por página y controles de la variante configurada, vía el pipeline real config → validate → render.
- Modo carrusel con `visibleCount`/autoplay/loop: comportamiento end-to-end (fichero dedicado).
- Click en cualquier imagen abre el lightbox con esa imagen; navegar dentro del lightbox recorre el conjunto completo (no solo la página/tramo visible); cierre por botón/clic fuera/Esc.
- Origen dinámico modo `src`: elemento sin `src` resoluble no se renderiza, el resto de la galería (incluida paginación) se renderiza con normalidad.
- Origen dinámico modo `fetch`: dispara una petición HTTP binaria por elemento (mock) y renderiza la imagen cuando resuelve; un elemento con petición en curso, fallida o binario inválido no se renderiza, sin romper el resto.
- `gallery` admite `layout.span`, `visibility` y `queryStateFeedback` con las mismas reglas transversales que el resto del catálogo (reutilizar un caso de cada uno, como hacen los tests de `map`/`repeater`).
- Colección vacía: sin imágenes, sin controles de paginación/carrusel, sin posibilidad de abrir lightbox.
- Cambio de la colección resuelta: la página/posición de carrusel activa vuelve a su estado inicial.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-gallery.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-gallery-carousel.test.tsx`

**Restricciones**:
- Estos dos ficheros prueban el pipeline completo (config real → `validate-runtime-config` → `LayoutRenderer`), no montan `GalleryNode` de forma aislada — mismo criterio que `layout-renderer-map.test.tsx`. Los tests aislados de cada pieza ya existen en T2-T6; no duplicar aquí esos casos unitarios.
- Si `layout-renderer-gallery.test.tsx` supera ~500 líneas o mezcla más de un dominio claramente distinto, dividirlo en ficheros adicionales siguiendo `ai-workflow/standards/testing-rules.md#Cuándo-dividir-un-fichero-existente`, actualizando después `ai-workflow/docs/test-index.md` (fuera de esta tarea, ver "Documentación afectada").

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva entrada del catálogo para `gallery`.
- Nueva ficha `ai-workflow/docs/app-features/nodes/gallery.md`.
- `ai-workflow/docs/app-features/nodes/repeater.md`: posible nota de cross-reference si el uso de `item.*` dentro de `repeater` por parte de `gallery` introduce algún matiz no cubierto ya por el contrato general.
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos".
- `ai-workflow/docs/test-index.md`: entradas nuevas por cada fichero de test creado en T1-T7.

### Criterios de finalización
- `gallery` se renderiza de punta a punta a través de `LayoutRenderer` para origen estático y dinámico, ambos modos de visualización y el lightbox.
- `node-components-map.ts` y `layout-node-renderer.tsx` registran `gallery` con el mismo patrón dual eager/lazy que el resto del catálogo.
- Verificación manual (no automatizada, per D8): tras `pnpm build`, confirmar que el chunk de una página sin ningún nodo `gallery` en modo `carousel` no incluye código de `embla-carousel-react`/`embla-carousel-autoplay`.
- Todos los tests de ambos ficheros pasan.
- `pnpm test` completo pasa y el umbral global de cobertura del 80% sobre `src/` se mantiene.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre los ficheros de test de la tarea en verde, y `pnpm test` completo en verde con el umbral de cobertura superado).

---

## T8 — Soporte en `dev-editor` para el nodo `gallery` (documentación retroactiva de trabajo ya implementado)

### Objetivo
Dejar constancia formal, dentro del contrato de ejecución de la feature, del soporte ya implementado en el editor visual (`dev-editor`) para configurar el nodo `gallery` desde el panel de propiedades (Alcance y FR23 de `spec.md`), que se implementó y testeó en este working tree sin pasar por esta skill de planificación porque `spec.md` incorporó ese requisito después de cerrar T1-T7. Esta tarea no añade código nuevo: registra qué se implementó, dónde, y con qué tests, para que `tasks.md` sea coherente con el estado real del repositorio.

### Fuera de alcance
- Cualquier cambio de comportamiento sobre lo ya implementado (eso sería una tarea nueva, no esta).
- Soporte de edición visual para `source.idField`: no existía cuando se implementó este trabajo; lo añade **T9**, que amplía `GalleryDynamicSourcePropertyField` (producida aquí).
- Contrato runtime del nodo `gallery` (T1-T7, ya cerrado).

### Dependencias
T1 (consume `galleryNodeSchema`/`GalleryLayoutNode`).

### Interfaces

**Consume**:
- `GalleryLayoutNode`, `galleryNodeSchema` (de T1).
- `PropertyFieldDispatcher`, patrón `x-widget` (existente, `property-field-dispatcher.tsx`) — mismo mecanismo que `choice-items`.
- `imageFetchSchema` (existente, `runtime-config-zod.ts`) — reutilizado tal cual para derivar el JSON Schema del sub-editor de `fetch`.

**Produce** (ya presentes en el repositorio):
- `GalleryOriginModePropertyField(props: { label: string; node: Extract<LayoutNode, { type: 'gallery' }>; onChange: (nextNode: Extract<LayoutNode, { type: 'gallery' }>) => void }): JSX.Element` (`src/dev-runtime/layout-canvas/property-fields/gallery-origin-mode-property-field.tsx`) — consumido por `layout-canvas-properties-panel.tsx`.
- `GalleryDynamicSourcePropertyField(props: { label: string; value: unknown; onChange: (value: unknown) => void }): JSX.Element` (`src/dev-runtime/layout-canvas/property-fields/gallery-dynamic-source-property-field.tsx`) — consumido por `property-field-dispatcher.tsx` vía `x-widget: 'gallery-dynamic-source'`; **ampliado por T9** con el campo `idField`.
- `resolveGalleryPropsSchema(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown>` (privada, `layout-canvas-properties-panel.tsx`) — sin consumidores fuera de ese módulo.

### Impacto esperado en archivos
Ya aplicado (working tree, sin commitear a fecha de este reajuste):
- `src/dev-runtime/layout-canvas/property-fields/gallery-origin-mode-property-field.tsx` (nuevo): widget de selección Estático/Dinámico que reconstruye `node.props` completo al cambiar de origen (mismo criterio de "sustitución completa al cambiar de modo" del caso límite de `spec.md`).
- `src/dev-runtime/layout-canvas/property-fields/gallery-dynamic-source-property-field.tsx` (nuevo): widget de `gallery.props.source` con campos `source`/`key`/`alt` directos y un toggle `mode: 'src'|'fetch'` que reconstruye la rama activa; delega en `PropertyFieldDispatcher` con `imageFetchSchema` para editar `fetch`.
- `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`: `resolveGalleryPropsSchema` (oculta `images`/`source` según el origen activo, mismo patrón que `resolveContainerPropsSchema`/`resolveChoiceLikePropsSchema`), bloque de renderizado de `GalleryOriginModePropertyField` con commit de nodo completo (mismo patrón de `PendingRejectionKey` que `containerColumnsMode`/`tableRows`), añadida la clave `'galleryOriginMode'`.
- `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: registro de `'gallery-dynamic-source': GalleryDynamicSourcePropertyField` en `WIDGET_REGISTRY`.
- `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts`: `buildDefaultNodeInstance` produce un `gallery` por defecto (`images: []`, `display: { mode: 'paginated', pagination: { pageSize: 6 } }`).
- `src/dev-runtime/layout-canvas/layout-canvas-node-palette.tsx`: entrada `gallery: 'Galería'` en `NODE_TYPE_LABELS`.
- `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`: entrada `gallery: galleryNodeSchema` en `nodeSchemaByType`.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-gallery-origin-mode.test.tsx` (nuevo, ya presente)
- `src/tests/dev-runtime/layout-canvas-property-field-gallery-dynamic-source.test.tsx` (nuevo, ya presente)
- `src/tests/dev-runtime/layout-canvas-properties-panel-gallery.test.tsx` (nuevo, ya presente)
- `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación, ya presente)
- `src/tests/runtime/runtime-node-components-map.test.tsx` (ampliación, ya presente)

**Comportamiento cubierto** (ya verificado, ejecutado como parte de este reajuste):
- Selector de origen (Estático/Dinámico) reconstruye `node.props` completo al cambiar, sin conservar valores del modo inactivo.
- Editor de fuente dinámica edita `source`/`key`/`alt`/`mode` y, según el modo, `src` o `fetch` (delegando en el editor genérico de `image.props.fetch`).
- El panel de propiedades del nodo `gallery` solo muestra `images` cuando el origen es estático y solo `source` cuando es dinámico.
- `gallery` aparece en la paleta de nodos con instancia por defecto válida y en el catálogo de schemas por tipo.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-gallery-origin-mode.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-gallery-dynamic-source.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-gallery.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
- `pnpm test --run src/tests/runtime/runtime-node-components-map.test.tsx`

**Restricciones**:
- No modificar este trabajo como parte de T8; cualquier corrección de comportamiento es una tarea nueva.

### Documentación afectada
Ninguno directamente desde T8 (se cubre, junto con el resto del nodo `gallery`, en el cierre documental pendiente de la feature vía `update-app-documentation`, ya señalado como impacto en la T7 original).

### Criterios de finalización
- Los cinco ficheros de test listados arriba pasan (ya verificado: `pnpm vitest run` sobre los tres nuevos pasa 35/35 a fecha de este reajuste).
- El panel de propiedades de `gallery` no muestra `images` y `source` simultáneamente.

### Cierre de implementación
Ya cumplido antes de este reajuste de plan: código y tests existen en el working tree y pasan. No requiere ejecución en la próxima pasada de `implement-task-test-first`; se incluye en `status.yaml` como tarea completada (`T8`) únicamente para que el contrato de `tasks.md` no omita trabajo real ya hecho.

---

## T9 — Campo `source.idField` en submodo `fetch` (FR7)

### Objetivo
Añadir el campo opcional `source.idField` al origen dinámico en submodo `fetch` (FR7 de `spec.md`; D1/D4/D5 de `design.md`, sección "Preguntas abiertas" del propio `design.md`): declara en qué propiedad de cada elemento está el id cuando los elementos de la colección son objetos. Antes de disparar la petición de cada foto, se calcula un id de control (`item[idField]` si `idField` está declarado, o el propio `item` si no lo está); si ese id no resuelve a un `string`/`number` no vacío, el elemento se omite en silencio sin disparar `fetch` (mismo criterio de degradación silenciosa que FR16/FR19/FR20). El id de control no se expone como una referencia nueva: la interpolación de `fetch.url`/`headers`/`body` sigue usando exclusivamente `item.*`, sin sintaxis nueva (D4). Incluye también la edición visual de `idField` en `dev-editor`, ampliando el widget ya existente de T8 (`GalleryDynamicSourcePropertyField`), para que el panel de propiedades del submodo `fetch` quede completo respecto al contrato runtime que esta misma tarea cierra (mismo principio de FR23 ya aplicado en T8 al resto de campos de `source`).

### Fuera de alcance
- `idField` en submodo `src`: sigue sin existir; declarado en ese modo se rechaza (regla ya prevista por D1, no es nueva).
- Cualquier sintaxis de referencia nueva (p. ej. `{{id}}`); D4 lo descarta explícitamente.
- Cambios en T3-T7 (tiles, vistas paginada/carrusel, lightbox, composición del nodo): consumen `ResolvedGalleryPhoto` sin cambios de shape — el gate de `idField` vive íntegramente dentro de `resolveGalleryPhotos` (T2), antes de producir la entrada; ningún elemento inválido llega nunca a esas tareas.
- Límite de concurrencia o cualquier cambio en `src/queries/` (D11 de `design.md`, no objetivo explícito).

### Dependencias
T1, T2, T8 (amplía `GalleryDynamicSourcePropertyField`, producida en T8).

### Interfaces

**Consume**:
- `GalleryDynamicSource`, `galleryNodeSchema`, `validateGalleryNode` (de T1, a ampliar en esta misma tarea).
- `resolveGalleryItemPath(item: unknown, path: string): { found: false } | { found: true; value: unknown }` (privada, `src/runtime/runtime-gallery-photos.ts`, de T2 — se reutiliza tal cual, ya resuelve rutas relativas dentro de un item).
- `isValidCollectionProjectionPath` (existente, `validate-node-shared-helpers.ts`, ya usada por T1 para `alt`/`src`).
- `GalleryDynamicSourcePropertyField(props: { label: string; value: unknown; onChange: (value: unknown) => void }): JSX.Element` (de T8, `gallery-dynamic-source-property-field.tsx`) — se amplía en el propio fichero, no se reemplaza.

**Produce** (amplía tipos/funciones existentes, no crea ficheros nuevos):
- `GalleryDynamicSource` (`src/config/runtime-config-types.ts`) pasa a ser `{ source: string; key: string; alt: string } & ({ mode: 'src'; src: string } | { mode: 'fetch'; fetch: ImageFetchConfig; idField?: string })` — consumido por: T2 (ya consumidor existente, ninguna tarea nueva lo consume).
- `ResolvedGalleryPhoto` (`src/runtime/runtime-gallery-photos.ts`) no cambia de shape; el efecto de `idField` es puramente una condición adicional de omisión dentro de `resolveGalleryPhotos`, sin nuevos consumidores.

### Impacto esperado en archivos
- `src/config/runtime-config-types.ts`: añadir `idField?: string` a la rama `mode: 'fetch'` de `GalleryDynamicSource`.
- `src/config/runtime-config-zod.ts`: añadir `idField: nonEmptyStringSchema.optional()` a `galleryDynamicSourceSchema` (mismo criterio flexible que `src`/`fetch`: la exclusión real la sigue aplicando `validateGalleryNode` de forma imperativa, no Zod).
- `src/config/validate-gallery-node.ts`:
  - en la rama `mode === 'src'`: rechazar si `entry.idField !== undefined` (error sobre `${path}.props.source.idField`), mismo patrón que ya usa para rechazar `entry.fetch` en esa rama.
  - en la rama `mode === 'fetch'`: si `entry.idField !== undefined`, validar con `isValidCollectionProjectionPath(entry.idField)` (mismo validador que `alt`/`src`); si no es válido, error sobre `${path}.props.source.idField`.
  - `normalizedSource` en la rama `fetch` pasa a incluir `idField: entry.idField`.
- `src/runtime/runtime-gallery-photos.ts`:
  - nueva función local no exportada `resolveGalleryFetchControlId(item: unknown, idField: string | undefined): string | number | null`: si `idField` está definido, navega `item` con `resolveGalleryItemPath` (ya existente) y exige que el valor encontrado sea `string` no vacío o `number`; si `idField` no está definido, exige que el propio `item` sea `string` no vacío o `number`. Devuelve `null` en cualquier otro caso.
  - en `resolveDynamicGalleryPhotos`, rama `source.mode === 'fetch'`: antes de hacer `photos.push(...)`, llamar a `resolveGalleryFetchControlId(item, source.idField)`; si devuelve `null`, omitir la iteración (`return`) sin producir entrada, igual que ya hace la rama `mode: 'src'` cuando `src` no resuelve.
- `src/dev-runtime/layout-canvas/property-fields/gallery-dynamic-source-property-field.tsx` (de T8, se amplía): añadir un `TextPropertyField` opcional para `idField`, visible únicamente cuando `mode === 'fetch'` (junto al editor de `fetch`), que hace `commitField('idField', next)` (extender la firma local `commitField` para aceptar `'idField'` además de `'source' | 'key' | 'alt' | 'src'`); al cambiar de `fetch` a `src` (`handleModeChange`), `idField` se descarta igual que `fetch` (el bloque `const { src: _src, fetch: _fetch, ...rest }` pasa a incluir también `idField`).

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-gallery.test.ts` (ampliación)
- `src/tests/runtime/runtime-gallery-photos.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-property-field-gallery-dynamic-source.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Validación: acepta `source.idField` como ruta relativa válida cuando `mode: 'fetch'`; rechaza `idField` inválido (ni ruta relativa ni interpolación, reutilizando los mismos casos límite ya cubiertos para `alt`/`src`); rechaza `idField` declarado cuando `mode: 'src'`; acepta `mode: 'fetch'` sin `idField` (sigue siendo válido, comportamiento por defecto).
- Resolución (`resolveGalleryPhotos`, modo `fetch`): con `idField` declarado y un elemento objeto cuyo campo resuelve a `string`/`number` no vacío, produce la entrada con normalidad; con ese campo ausente, vacío o no escalar, omite la entrada sin producir `fetch`; sin `idField` declarado y un elemento primitivo (`string`/`number`), produce la entrada con normalidad; sin `idField` y un elemento objeto, omite la entrada (este último caso es el cambio de comportamiento real que introduce FR7 respecto al código anterior a esta tarea, y debe quedar explícito en el test como regresión intencional).
- Editor visual: con `mode: 'fetch'` activo, el campo `idField` es visible y editable; con `mode: 'src'` activo, no se renderiza; cambiar de `fetch` a `src` descarta el valor de `idField` ya introducido (mismo criterio de "sustitución completa al cambiar de modo").

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-gallery.test.ts`
- `pnpm test --run src/tests/runtime/runtime-gallery-photos.test.ts`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-gallery-dynamic-source.test.tsx`

**Restricciones**:
- No introducir ninguna sintaxis de referencia nueva (`{{id}}` o similar) en `runtime-references/`; `idField` es exclusivamente un gate de validez previo al `fetch`, no un canal de interpolación.
- No modificar el shape de `ResolvedGalleryPhoto` ni el de T3-T6; si algún test de esas tareas empezara a fallar por este cambio, es señal de que el gate se implementó en el sitio equivocado (debe vivir solo en `resolveDynamicGalleryPhotos`).

### Documentación afectada
- Nueva ficha `ai-workflow/docs/app-features/nodes/gallery.md`: cuando se escriba (impacto ya señalado en la T7 original), debe documentar `idField` como parte del contrato de `source` en submodo `fetch` desde el principio, no como nota separada. Esta tarea no añade una entrada de documentación distinta.

### Criterios de finalización
- `validateGalleryNode` acepta/rechaza `source.idField` según las reglas descritas arriba.
- `resolveGalleryPhotos` omite en silencio los elementos cuyo id de control (con o sin `idField`) no resuelve a `string`/`number` no vacío, sin disparar `fetch` para ellos.
- El editor visual permite configurar `idField` únicamente cuando el submodo activo es `fetch`.
- Todos los tests de los tres ficheros listados pasan.
- `pnpm test` completo pasa y el umbral global de cobertura del 80% sobre `src/` se mantiene.

### Cierre de implementación
Código y tests de la tarea completos y validados (`pnpm test --run` sobre los tres ficheros de test de la tarea en verde, y `pnpm test` completo en verde con el umbral de cobertura superado). Al cerrar esta tarea, FR7 queda completamente implementado y el hueco señalado en `status.yaml`/`design.md` deja de aplicar.

---

## Siguiente tarea
T9 — Campo `source.idField` en submodo `fetch` (FR7). T8 no requiere ejecución: documenta trabajo ya cerrado (ver "Nota de reajuste" arriba).
