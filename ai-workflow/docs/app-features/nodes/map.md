> Cuándo leer: si la tarea toca el nodo `map` — mapa con marcadores estáticos o derivados de una colección `queries.*`.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[./repeater.md]], [[../config/validation.md]].

# Nodo `map`

Nodo hoja que declara un mapa con centro, zoom y marcadores, renderizado sobre `react-leaflet`/`Leaflet`. Estado actual: feature completa (T1–T4) — el nodo se renderiza de punta a punta a través de `LayoutRenderer`, con code-splitting propio.

## Contrato (`props`)

`props` es opcional en su totalidad; si se omite, equivale a `{}` y el nodo normalizado siempre lleva `props.markers: []`.

| Prop | Tipo | Requerido | Descripción |
|---|---|---|---|
| `props.center` | `{ lat: number; lng: number }` | no | Centro inicial del mapa. `lat` en `[-90, 90]`, `lng` en `[-180, 180]`. Sin efecto si `props.autoFitMarkers: true`. |
| `props.zoom` | `number` (entero) | no | Nivel de zoom inicial, entre `0` y `19` inclusive. Sin efecto si `props.autoFitMarkers: true` (salvo fallback con un único marcador o sin marcadores). |
| `props.height` | `"sm" \| "md" \| "lg" \| "xl"` | no | Altura del contenedor del mapa. |
| `props.markers` | `MapStaticMarker[]` | no | Marcadores estáticos. Se ignora si `props.markerSources` también está declarado. |
| `props.markerSources` | `MapMarkerSource[]` | no | Marcadores derivados de una colección `queries.*`. Si está declarado, prevalece sobre `props.markers`. |
| `props.autoFitMarkers` | `boolean` | no | Si es `true`, el mapa encuadra su vista inicial automáticamente para que todos los marcadores resueltos sean visibles. Ignorado si no hay marcadores. Ver "Ajuste automático de vista" abajo. |

`props.markers[i]` (`MapStaticMarker`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `lat` | `number` | sí | `[-90, 90]`. |
| `lng` | `number` | sí | `[-180, 180]`. |
| `label` | `string` | sí | Etiqueta del marcador. |

`props.markerSources[i]` (`MapMarkerSource`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `source` | `string` | sí | Fuente de colección, mismo contrato que `repeater.props.items.source`: `queries.{queryName}.data` o `queries.{queryName}.data.*`. |
| `position.lat` | `string` | sí | Ruta relativa al item de la colección (por ejemplo `coords.lat`). No admite rutas globales (`queries.*`, `item.*`) ni interpolación. |
| `position.lng` | `string` | sí | Igual que `position.lat`, para la longitud. |
| `label` | `string` | sí | Ruta relativa al item o interpolación `{{...}}` (mismo contrato que las proyecciones de colección, no admite rutas globales fuera de interpolación). |
| `color` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | Color semántico del marcador. |

No admite `children` (nodo hoja): si el config declara `children` en un nodo `map`, se rechaza antes del render con `invalid-layout` sobre `{path}.children`, igual que `repeater`/`tabs` — a diferencia de otros nodos hoja como `badge`/`divider`, que aceptan y descartan `children` en silencio.

## Normalización

- Sin `props.markers` ni `props.markerSources` declarados: el nodo normalizado lleva `props.markers: []`.
- Con `props.markers` declarado (incluido `[]`) y `props.markerSources` ausente: `markers` se conserva tal cual.
- Con `props.markerSources` declarado (con o sin `props.markers` también declarado): se conserva `markerSources` con cada `source` ya normalizado por la misma validación de fuente de colección que usa `repeater`; `props.markers` queda `undefined` (se ignora), aunque el config lo hubiera declarado. `markerSources` prevalece siempre que esté presente.
- `props.center`, `props.zoom` y `props.height` se copian tal cual si están presentes; esta tarea no aplica ningún valor por defecto (centro/zoom/altura por defecto se resuelven en el componente de render, no en la validación — mismo patrón que `divider` resolviendo su `variant` por defecto).
- `props.autoFitMarkers` se copia tal cual si está presente. No interfiere con la normalización de otros props; su efecto (prioridad sobre `center`/`zoom`) se resuelve en el render, no en validación.

## Validación previa al render

- `props.center.lat` fuera de `[-90, 90]` o `props.center.lng` fuera de `[-180, 180]`: `invalid-layout` sobre `{path}.props.center.lat` / `.lng`.
- `props.zoom` no entero, negativo o mayor que `19`: `invalid-layout` sobre `{path}.props.zoom`.
- `props.height` fuera de `sm|md|lg|xl`: `invalid-layout` sobre `{path}.props.height`.
- `props.markers[i].lat`/`.lng` fuera de rango o `.label` no string: `invalid-layout` sobre la ruta exacta del índice.
- `props.markerSources[i].source` fuera del patrón `queries.{queryName}.data(.*)`: `invalid-layout` sobre `{path}.props.markerSources[i].source`.
- `props.markerSources[i].position.lat`/`.lng` vacío, con formato de ruta global o mal formado: `invalid-layout` sobre la ruta exacta.
- `props.markerSources[i].label` vacío o inválido (ni ruta relativa ni interpolación): `invalid-layout` sobre `{path}.props.markerSources[i].label`.
- `props.markerSources[i].color` fuera de la paleta semántica de seis colores: `invalid-layout` sobre `{path}.props.markerSources[i].color`.
- `props.markers` y `props.markerSources` declarados a la vez: **no se rechaza**; `markerSources` prevalece y `markers` se descarta en la normalización (ver "Normalización" arriba).
- `props.autoFitMarkers` no es `boolean` (cuando está presente): `invalid-layout` sobre `{path}.props.autoFitMarkers`.
- `props.autoFitMarkers: true` declarado a la vez que `props.center` y/o `props.zoom`: **no se rechaza**; el ajuste automático prevalece en render y `center`/`zoom` sirven como fallback (ver "Ajuste automático de vista" abajo).
- `children` declarado: `invalid-layout` sobre `{path}.children`.
- `visibility` y `queryStateFeedback` siguen el contrato transversal estándar.

## Resolución en runtime de `markerSources` (T2)

`resolveMapMarkerSourceItems(source, state, options?)` (en `src/runtime/runtime-collection-sources.ts`) toma un `MapMarkerSource` ya validado y el `RuntimeState` y devuelve `Array<{ lat: number; lng: number; label: string }>`:

- Resuelve la colección de `source.source` reutilizando `resolveCollectionSourceItems` (mismo contrato que `repeater`/`list`/`select`: colección vacía o valor no-colección degrada a `[]` sin error).
- Por cada item, navega `position.lat`/`position.lng` como ruta relativa al item (sin interpolación, sin rutas globales). Un valor solo es válido si es `typeof 'number'`, finito y está dentro de `[-90, 90]` (`lat`) / `[-180, 180]` (`lng`); cualquier otro caso (ruta no encontrada, no numérico, `NaN`, `Infinity`, fuera de rango) omite el item completo del resultado en silencio (sin excepción, sin diagnóstico en producción, con `console.warn` solo en DEV).
- Resuelve `label` con interpolación `{{...}}` (usando el item como `iterationContext`) si contiene delimitadores, o como ruta relativa simple en caso contrario. Si `label` no resuelve a texto (ruta relativa ausente o no escalar), el item se omite igual que si la posición fuera inválida; la interpolación siempre produce un string (degrada a `''` igual que el resto de superficies de texto del runtime), por lo que nunca omite el marcador por esta vía.
- Es una función pura: no muta la colección de entrada ni el estado; llamadas repetidas con el mismo estado devuelven resultados equivalentes.

## Ajuste automático de vista (`props.autoFitMarkers`)

Cuando `props.autoFitMarkers: true`, el mapa calcula su centro y zoom iniciales automáticamente a partir de los marcadores resueltos en el primer render. Este cálculo prevalece sobre `props.center` y `props.zoom` declarados.

**Comportamiento según el número de marcadores resueltos:**

- **Cero marcadores** (sin `props.markers` ni `props.markerSources`, o colección vacía): se usa `props.center` si está declarado, o si no el centro por defecto (Pamplona `{ lat: 42.8125, lng: -1.6458 }`) y zoom `13`.
- **Un único marcador**: se centra el mapa en ese punto, usando `props.zoom` si está declarado o zoom `13` en caso contrario.
- **Dos o más marcadores**: se calcula un encuadre rectangular que contiene a todos ellos, y se aplica ese encuadre como vista inicial (los marcadores quedan visibles sin excepción dentro del viewport, al máximo zoom que permite Leaflet en ese rango).
- **Marcadores con coordenadas idénticas** (dos o más puntos con la misma `lat`/`lng`): se trata como el caso de un único marcador, centrando en ese punto con `props.zoom` si está declarado o `13` en caso contrario.

**Reactividad:**

- El ajuste se calcula una sola vez, en el primer render del nodo. Si `props.markerSources` resuelve nuevos items después de ese primer render (por ejemplo, porque una query estaba en curso), esos marcadores nuevos se renderizan en el mapa pero **no recalculan ni mueven** el centro/zoom. Este comportamiento es consistente con cómo funciona hoy la resolución de `center`/`zoom` manual.

## Render (`MapNode`, `src/runtime/nodes/map-layout-node.tsx`)

- Valores por defecto cuando no se declaran: `center` = Pamplona (`{ lat: 42.8125, lng: -1.6458 }`), `zoom` = `13`, `height` = `md` (clase `h-80`, ver `getMapHeightClassName` en `runtime-node-styling-map.ts`).
- **Resolución de la vista inicial**: 
  - Si `props.autoFitMarkers: true`, se calcula mediante `resolveMapInitialView` (en `src/runtime/runtime-map-auto-fit.ts`) a partir de los marcadores resueltos y el fallback `{ center: props.center ?? Pamplona, zoom: props.zoom ?? 13 }` (ver sección "Ajuste automático de vista"). El resultado es una vista inicial en modo `center`/`zoom` o `bounds` (encuadre rectangular).
  - Si `props.autoFitMarkers` no está presente o es `false`, la vista se aplica en modo `center`/`zoom` usando directamente `props.center` (o Pamplona) y `props.zoom` (o 13).
- Se renderiza `<MapContainer>` aplicando la vista inicial (bien sea `center={[lat,lng]} zoom={zoom}` o `bounds={[[south,west],[north,east]]}`) junto con `className="w-full {heightClass}"` y un `<TileLayer>` de OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Modo estático** (`props.markers` declarado, `props.markerSources` ausente): un `<Marker>` por entrada de `props.markers`, todos con icono de color fijo `primary` (`getMapMarkerIcon('primary')` en `runtime-node-styling-map.ts`) — una sola fuente de marcadores no necesita distinguir color.
- **Modo dinámico** (`props.markerSources` declarado): un bloque de marcadores por cada `MapMarkerSource`, resuelto con `resolveMapMarkerSourceItems(source, state, { iterationContext })` (T2). El color efectivo de cada fuente es `source.color` si está declarado, o si no el siguiente de una paleta cíclica de seis colores semánticos en orden `['primary', 'success', 'warning', 'danger', 'info', 'neutral']` indexada por la posición de la fuente en `props.markerSources` (una fuente con `color` explícito no consume ni desplaza el ciclo de las demás).
- Cada marcador (estático o dinámico) incluye un `<Popup>{label}</Popup>` hijo que se muestra al pulsar el marcador. No se declara ningún `eventHandlers`: pulsar un marcador solo abre su popup nativo de Leaflet, sin disparar ninguna acción del catálogo (navegación, apertura de modal, ejecución de operación).
- `visibility` y `queryStateFeedback` se resuelven de forma genérica en `LayoutNodeRenderer` antes de llegar al componente, igual que el resto del catálogo; `map` participa de `layout.span` como cualquier nodo hoja estándar.

## Code-splitting y peso de bundle

- `map` está registrado en `src/runtime/nodes/node-components-map.ts` con el mismo patrón dual que el resto del catálogo: import estático en `eagerMap` (usado solo en modo test) e import diferido `React.lazy(...)` en `lazyMap` (usado en dev/prod). El `import 'leaflet/dist/leaflet.css'` vive como side-effect en la parte superior de `map-layout-node.tsx`, dentro del propio módulo diferido.
- `leaflet` no publica una build ESM tree-shakeable (solo CJS, sin `sideEffects: false` en su `package.json`), por lo que Rollup lo trata por defecto como un módulo con efectos secundarios: basta con que sea estáticamente alcanzable —aunque sea por la rama muerta `eagerMap` en modo producción— para que no pueda eliminarse del entrypoint. `vite.config.ts` corrige esto marcando explícitamente el paquete `leaflet` como libre de efectos secundarios para el propósito de tree-shaking (`build.rollupOptions.treeshake.moduleSideEffects`), lo que permite que el peso de Leaflet (el más pesado del catálogo) solo se descargue cuando una página realmente usa `map`. El gate `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` verifica esto comprobando que la cadena `leaflet-container` (clase raíz que Leaflet añade al DOM) no aparece en el bundle inicial.

## Límites (v1)

- Sin clustering de marcadores, sin cálculo de rutas, sin geolocalización del usuario.
- Sin edición visual desde `dev-editor` (fuera de alcance de la feature completa).
- Sin `invalidateSize()` explícito ante remounts dentro de `repeater`/`tabs`/`accordion`.
