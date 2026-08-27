> Cuándo leer: si la tarea toca el nodo `gallery` — colección de imágenes con origen manual o dinámico, vista paginada o carrusel, y lightbox.
> Tamaño: medio.
> Relacionados: [[./image.md]], [[./repeater.md]], [[../references/reference-resolution.md]], [[../references/query-state-feedback.md]], [[../development/dev-mode-editor.md#selector-de-origen-y-widget-dedicado-para-source-de-gallery]].

# Nodo `gallery`

Nodo hoja que muestra una colección de imágenes en rejilla paginada o en carrusel, con lightbox al pulsar cualquiera de ellas. Estado actual: feature completa (T1–T9, incluido `source.idField`) — el nodo se renderiza de punta a punta a través de `LayoutRenderer`, con soporte en `dev-editor` y code-splitting propio en dos niveles.

## Contrato (`props`)

Dos bloques mutuamente excluyentes para el origen de las imágenes, más un bloque `display` obligatorio:

| Prop | Tipo | Requerido | Descripción |
|---|---|---|---|
| `props.images` | `GalleryStaticImage[]` | uno de `images`/`source`, exactamente uno | Origen estático: lista literal de imágenes. |
| `props.source` | `GalleryDynamicSource` | uno de `images`/`source`, exactamente uno | Origen dinámico: colección resuelta en tiempo de ejecución. |
| `props.display` | `GalleryPaginatedDisplay \| GalleryCarouselDisplay` | sí | Modo de visualización, discriminado por `display.mode`. |

### Origen estático (`props.images`)

`props.images[i]` (`GalleryStaticImage`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `src` | `string` | sí | Misma semántica que `image.props.src`: literal, referencia dinámica completa o interpolación `{{...}}`. |
| `alt` | `string` | sí | Misma semántica que `image.props.alt`. |

### Origen dinámico (`props.source`)

`props.source` (`GalleryDynamicSource`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `source` | `string` | sí | Fuente de colección: `queries.{queryName}.data`, `queries.{queryName}.data.*` o `item.*` (mismo contrato que `repeater.props.items.source`, con `item.*` habilitado). |
| `key` | `string` | sí | Key de iteración por foto: `"$key"`, `"$index"` o ruta relativa al item sin prefijos reservados (`item`/`queries`/`forms`/`params`/`navigation`/`routeParams`) — mismo contrato textual que `repeater.props.items.key`. |
| `alt` | `string` | sí | Ruta relativa al item o interpolación `{{...}}` (no admite referencia global fuera de interpolación). |
| `mode` | `'src' \| 'fetch'` | sí | Submodo de carga por foto, discriminador de los dos bloques siguientes. |
| `src` | `string` | solo si `mode: 'src'` | Ruta relativa al item o interpolación `{{...}}`; mismo criterio de degradación que `image.props.src`. Rechazado si `mode: 'fetch'`. |
| `fetch` | `ImageFetchConfig` (`url`/`method`/`headers`/`body`) | solo si `mode: 'fetch'` | Mismo contrato que `image.props.fetch`, resuelto por item. Rechazado si `mode: 'src'`. |
| `idField` | `string` | no, solo válido si `mode: 'fetch'` | Ruta relativa al item que indica en qué propiedad está el id de control de cada elemento. Si se omite, el propio elemento se usa como id. Rechazado si `mode: 'src'`. |

### Visualización (`props.display`)

Modo `paginated` (`GalleryPaginatedDisplay`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `display.pagination.pageSize` | `number` (entero ≥ 1) | sí | Mismo contrato que `repeater.props.pagination.pageSize`. |
| `display.pagination.controls.variant` | `'previousNext' \| 'numbered' \| 'scroll'` | no | Default efectivo `previousNext`, mismo modelo que `repeater`/`table`. |

Modo `carousel` (`GalleryCarouselDisplay`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `display.visibleCount` | `number` (entero 1–3) | sí | Número de imágenes visibles simultáneamente. |
| `display.autoplay.enabled` | `true` | no (bloque completo opcional) | Avance automático, desactivado por defecto. |
| `display.autoplay.intervalMs` | `number` (entero positivo) | sí si `autoplay` está declarado | Intervalo de avance en milisegundos. |
| `display.loop` | `boolean` | no, default `false` | Bucle al llegar al final/principio. |

No admite `children` (nodo hoja): si el config declara `children` en un nodo `gallery`, se rechaza antes del render con `invalid-layout` sobre `{path}.children`, igual que `map`/`repeater`/`tabs`.

## Normalización

- Origen estático: `props.images` se conserva tal cual (cada entrada ya validada como `{ src, alt }` no vacíos); `props.source` queda ausente.
- Origen dinámico: se conserva solo el subconjunto de campos relevante al `mode` activo — `mode: 'src'` normaliza a `{ mode, source, key, alt, src }` (sin `fetch`/`idField`); `mode: 'fetch'` normaliza a `{ mode, source, key, alt, fetch, idField }` (sin `src`; `idField` queda `undefined` si no se declaró).
- `display` se normaliza al subconjunto de campos de su `mode`: `paginated` conserva solo `pagination`; `carousel` conserva `visibleCount`/`autoplay`/`loop`.

## Validación previa al render

Vive en `src/config/validate-gallery-node.ts` (`validateGalleryNode`), reutilizando sin modificar el validador de fuente de colección de `repeater`/`select`/`map` (`validateCollectionSource`, con `allowItemReference: true`) y el mismo validador de rutas de proyección (`isValidCollectionProjectionPath`) que el resto del catálogo.

- `props.images` y `props.source` declarados a la vez, o ninguno de los dos: `invalid-layout` sobre `{path}.props`.
- `props.source.source` fuera del patrón `queries.{queryName}.data(.*)` o `item.*`: `invalid-layout` sobre `{path}.props.source.source` (mismo diagnóstico que `validateCollectionSource`).
- `props.source.alt` vacío o con formato inválido (ni ruta relativa ni interpolación): `invalid-layout` sobre `{path}.props.source.alt`.
- `props.source.key` que no sea `"$key"`, `"$index"` ni una ruta relativa válida sin prefijo reservado: `invalid-layout` sobre `{path}.props.source.key`.
- `mode: 'src'` con `fetch` declarado: `invalid-layout` sobre `{path}.props.source.fetch`.
- `mode: 'src'` con `idField` declarado: `invalid-layout` sobre `{path}.props.source.idField`.
- `mode: 'src'` sin `src` válido: `invalid-layout` sobre `{path}.props.source.src`.
- `mode: 'fetch'` con `src` declarado: `invalid-layout` sobre `{path}.props.source.src`.
- `mode: 'fetch'` sin `fetch` declarado: `invalid-layout` sobre `{path}.props.source.fetch`.
- `mode: 'fetch'` con `idField` declarado pero con formato inválido: `invalid-layout` sobre `{path}.props.source.idField`.
- `display.visibleCount` fuera de `1..3`, `display.pagination.pageSize` no entero ≥ 1, o `display.mode` ausente/no reconocido: `invalid-layout` sobre la ruta exacta del campo (rechazo por schema Zod, unión discriminada por `display.mode`).
- `children` declarado: `invalid-layout` sobre `{path}.children`.
- `visibility` y `queryStateFeedback` siguen el contrato transversal estándar.

## Resolución en runtime (`resolveGalleryPhotos`, `src/runtime/runtime-gallery-photos.ts`)

Función pura que toma el `GalleryLayoutNode` ya validado y el `RuntimeState`, y devuelve `ResolvedGalleryPhoto[]` (`{ key, alt, source }`, con `source` ya resuelto a `{ mode: 'src'; src }` o `{ mode: 'fetch'; fetch; iterationContext }`).

**Origen estático**: por cada entrada de `props.images`, resuelve `src` con `resolveRuntimeVisibleValue` (superficie de referencia `gallery.props.images.src`); si no resuelve a un string no vacío, la entrada se omite en silencio (FR19). `alt` se normaliza a string (`''` si no hay valor visible). `key` es el índice como string.

**Origen dinámico**: resuelve la colección con `resolveCollectionSourceItems(source.source, state, { iterationContext })` (mismo mecanismo compartido que `select`/`repeater`/`map`). Por cada item, en orden:
1. **Key** (`resolveGalleryItemKey`): `"$index"` → índice como string; ruta relativa → valor de esa ruta si es `string`/`number`, sin duplicar una key ya vista en la misma resolución (un duplicado se omite, igual que `repeater`). **`"$key"` siempre resuelve a `null`** y la entrada se omite: a diferencia de `repeater`, el origen dinámico de `gallery` solo resuelve colecciones de forma array (nunca la variante objeto/diccionario de `resolveCollectionSourceItems`), así que no existe una key de diccionario real que `"$key"` pueda leer — declarar `key: "$key"` deja la galería sin fotos, sin error de validación ni de render.
2. **Alt**: interpolación `{{...}}` si `source.alt` contiene delimitadores (vía `resolveRuntimeVisibleValue`), o ruta relativa simple en caso contrario; degrada a `''` si no resuelve.
3. Con `mode: 'fetch'`: se calcula un id de control (`resolveGalleryFetchControlId`) — `item[idField]` si `idField` está declarado, o el propio `item` si no — que debe resolver a un `string` no vacío o a un `number`; si no, la entrada se omite sin construir el descriptor de foto (FR7, caso límite de `idField` no resoluble). Este id **no** se expone como una referencia nueva: la interpolación de `fetch.url`/`headers`/`body` sigue leyendo solo `item.*`, igual que hoy.
4. Con `mode: 'src'`: se resuelve `source.src` igual que `alt` (interpolación o ruta relativa); si no produce un string no vacío, la entrada se omite en silencio (FR19).

La petición HTTP del submodo `fetch` **no** se dispara dentro de `resolveGalleryPhotos` — solo se dispara cuando el componente que renderiza esa foto se monta (ver "Render" abajo), igual que `image.props.fetch`.

## Render

### `GalleryNode` (`src/runtime/nodes/gallery-layout-node.tsx`)

- Memoiza `photos = resolveGalleryPhotos(...)` para que abrir/cerrar el lightbox (estado local) no cambie la identidad del array y dispare un reset de posición no deseado (ver D12 más abajo).
- Colección vacía: en producción/preview no renderiza nada (`null`); en modo Editor del `dev-editor` renderiza un placeholder seleccionable ("Galería vacía") para que el nodo siga siendo clicable en el canvas, mismo patrón que el `isEditMode` de `modal`.
- Según `display.mode`, renderiza `GalleryPaginatedView` o, dentro de un `Suspense` con `fallback={null}`, la vista de carrusel cargada de forma diferida (ver "Code-splitting" abajo).
- Pulsar cualquier foto abre el lightbox con `activeIndex` en esa foto; si la colección cambia mientras el lightbox está abierto y el índice activo deja de existir, el lightbox deja de renderizarse (degradación defensiva, no un requisito de producto).

### Vista paginada (`GalleryPaginatedView`, `src/runtime/nodes/gallery-paginated-view.tsx`)

Reutiliza sin modificar `createCollectionPaginationModel`/`createCollectionScrollWindow` (`runtime-collection-pagination.ts`) y `CollectionPaginationControls`, el mismo modelo que `repeater`/`table`/`file-manager`. Variante default `previousNext`; controles solo se muestran si hay más de una página (`previousNext`/`numbered`) o si `canShowMore` (`scroll`, con `IntersectionObserver` y fallback a botón "Mostrar más" cuando no está disponible).

### Vista carrusel (`GalleryCarouselView`, `src/runtime/nodes/gallery-carousel-view.tsx`)

Construida sobre `embla-carousel-react` (`useEmblaCarousel`) más el plugin oficial `embla-carousel-autoplay`:
- `display.loop` (default `false`) se pasa directo a la opción `loop` de embla.
- `display.autoplay.enabled` añade el plugin `Autoplay({ delay: display.autoplay.intervalMs })`; sin `autoplay`, solo hay navegación manual.
- `display.visibleCount` (1–3) fija el ancho de cada slide.
- Flechas "Anterior"/"Siguiente" (`aria-label`) deshabilitadas según `canScrollPrev`/`canScrollNext` de embla, recalculadas ante el evento `select` de embla (embla muta su estado interno de forma imperativa y no notifica a React por sí solo).
- Con menos fotos que `display.visibleCount`: comportamiento nativo de embla, sin relleno artificial — se muestran las disponibles y los controles de navegación quedan deshabilitados.

### Lightbox (`GalleryLightbox`, `src/runtime/nodes/gallery-lightbox.tsx`)

Implementación propia, **no** una instancia del nodo `modal` ni de su dominio `openModal`/`closeModal` (para que cada instancia de `gallery` — incluida cada iteración dentro de un `repeater` — tenga su propio lightbox aislado sin pasar por el registro global de modales):
- Overlay + panel centrado; cierre por botón explícito (`aria-label="Cerrar"`), clic fuera del panel (comprobando `event.target === event.currentTarget`) o tecla `Esc`.
- Navegación anterior/siguiente sobre el conjunto completo de fotos de la galería (no solo las visibles en la página/tramo de carrusel activo); los botones se deshabilitan en los extremos — el lightbox **no** aplica bucle aunque el carrusel lo tenga activado.
- Reutiliza la misma unidad de resolución por-item que ya usan las tiles visibles (`useImageFetchSource`, el mismo hook de `image.props.fetch`): navegar a una foto ya montada como tile no dispara una petición nueva; navegar a una que no está montada monta una instancia nueva de esa unidad (fetch al montar, revocación del `blob:` al desmontar), acotando el número de peticiones simultáneas a "tiles renderizadas + como máximo una foto de lightbox", nunca al tamaño total de la colección.
- **Fuera de alcance v1** (explícito, no un olvido): sin foco atrapado y sin navegación por flechas de teclado dentro del lightbox — solo el cierre con `Esc` es accesible por teclado.

## Code-splitting y peso de bundle

Dos niveles:
1. **Nivel nodo** (igual que el resto del catálogo): `gallery` está registrado en `src/runtime/nodes/node-components-map.ts` con el mismo patrón dual `eagerMap` (solo tests)/`lazyMap` (`React.lazy`, dev/prod) — su propio chunk, descargado solo si una página usa `gallery`.
2. **Nivel sub-componente** (particular de `gallery`, no presente en `map`): dentro del propio módulo de `gallery`, la vista de carrusel —la única que importa `embla-carousel-react`/`embla-carousel-autoplay`— se carga con un `React.lazy` adicional, separado de la vista paginada. Como `display.mode` es una propiedad estática del config, una instancia de `gallery` en modo `paginated` nunca descarga el chunk de `embla`.

## Editor visual (`dev-editor`)

Soporte completo en el panel de propiedades (ver [[../development/dev-mode-editor.md#selector-de-origen-y-widget-dedicado-para-source-de-gallery]]): un selector "Origen" (Estático/Dinámico) al principio de la pestaña `Props`, y — en modo dinámico — un widget dedicado para `props.source` con su propio selector `mode` (`src`/`fetch`) y, en `fetch`, el editor genérico de `image.props.fetch` reutilizado tal cual.

## Límites (v1)

- Sin foco atrapado ni navegación por flechas de teclado dentro del lightbox (solo cierre con `Esc`).
- Sin posibilidad de deshabilitar el lightbox por instancia: pulsar cualquier foto siempre lo abre.
- Sin zoom, gestos táctiles avanzados (pinch-to-zoom) ni descarga de imagen desde el lightbox.
- Sin paginación remota/cursor-based: la paginación del modo `paginated` es siempre local en cliente.
- Sin límite de concurrencia dedicado para el submodo `fetch`: acotado de forma natural a "tiles renderizadas + como máximo una foto de lightbox" (ver "Lightbox" arriba), sin cola ni capa nueva en `src/queries/`.
- `key: "$key"` en origen dinámico nunca produce una key válida (ver "Resolución en runtime" arriba): la galería queda sin fotos, sin diagnóstico. Usar `"$index"` o una ruta relativa al item.
- No combina en la misma instancia origen manual y dinámico, ni submodo `src` y `fetch` dentro del mismo origen dinámico; el shape de los elementos en submodo `fetch` es homogéneo por instancia (todos id primitivo, o todos objeto con la misma propiedad de id).
