# Tasks: nodo `map`

Contrato de ejecución para implementar el nodo `map` descrito en `spec.md` y `design.md`. Cuatro tareas secuenciales por dependencia; T1 desbloquea T2 y T3 (que pueden implementarse en cualquier orden entre sí una vez cerrada T1); T4 depende de las tres anteriores y cierra la feature.

Siguiente tarea a escoger: **T1**.

Paleta semántica reutilizada en todo el documento (idéntica a `badge`/`alert`/`stat`): `neutral | primary | success | warning | danger | info`. Valores hex de la escala `-500` ya declarados en `src/app/index.css`: `neutral #64748b`, `primary #3b82f6`, `success #22c55e`, `warning #f59e0b`, `danger #ef4444`, `info #06b6d4`.

---

## T1 — Contrato y validación previa al render de `map`

### Objetivo
Registrar `map` como tipo de nodo soportado en el contrato del runtime: tipos TypeScript, esquema `Zod`, y validación previa al render (`validate-map-node.ts`) conectada al dispatcher central de `src/config/`. Al cerrar esta tarea, un config que declare un nodo `map` con cualquier combinación válida o inválida de sus `props` se acepta o rechaza correctamente antes del render, sin que exista aún ningún componente de React que lo pinte.

### Fuera de alcance
- Resolución en runtime de `markerSources` contra `queries.*` (T2).
- Cualquier lógica de icono, color por defecto o clases Tailwind (T3).
- El componente de render `MapNode`, su registro en el dispatcher visual y en `node-components-map.ts` (T4).
- Instalación de `leaflet`/`react-leaflet` (no hace falta: esta tarea no importa la librería).

### Dependencias
Ninguna. Es la primera tarea de la feature.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `interface MapStaticMarker { lat: number; lng: number; label: string }` — consumido por: T4.
- `interface MapMarkerSource { source: string; position: { lat: string; lng: string }; label: string; color?: ButtonColor }` — consumido por: T2, T4.
- `type MapHeight = 'sm' | 'md' | 'lg' | 'xl'` — consumido por: T3, T4.
- `interface MapLayoutNode extends LayoutNodeFeedbackFields, LayoutNodeLayoutFields { type: 'map'; id?: string; props?: { center?: { lat: number; lng: number }; zoom?: number; height?: MapHeight; markers?: MapStaticMarker[]; markerSources?: MapMarkerSource[] }; children?: never }` — consumido por: T4.
- `function validateMapNode(rawNode: Record<string, unknown>, path: string, pageId: string, breadcrumb?: BreadcrumbSegment[]): { status: 'ready'; node: MapLayoutNode } | { status: 'error'; error: RuntimeConfigError }` — sin consumidores directos fuera del dispatcher de `src/config/` (cableado dentro de esta misma tarea).

### Impacto esperado en archivos
- `src/config/runtime-config-types.ts`: añadir `'map'` a `LayoutNodeType`, añadir `ButtonColor` a los imports si no está ya expuesto localmente, declarar `MapStaticMarker`, `MapMarkerSource`, `MapHeight` y `MapLayoutNode` (mismo patrón que `BadgeLayoutNode`/`RepeaterLayoutNode`), añadir `MapLayoutNode` a la unión `LayoutNode`.
- `src/config/runtime-config-zod.ts`: añadir `'map'` a `supportedNodeTypes` (array cerca de `'repeater'`/`'badge'`/`'divider'`), declarar `supportedMapHeights = ['sm', 'md', 'lg', 'xl'] as const`, `supportedMapMarkerColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const` (mismo patrón que `supportedBadgeColors`), y `mapNodeSchema` con la forma:
  - `type: z.literal('map')`, `id` opcional, `queryStateFeedback`/`visibility`/`layout` opcionales (mismo patrón que el resto de nodos hoja).
  - `props` opcional (`.strip().optional()`, igual que `dividerNodeSchema`/`skeletonNodeSchema`): si se omite por completo, equivale a `{}`.
    - `props.center`: objeto opcional `.strip()` con `lat: z.number().finite().min(-90).max(90)`, `lng: z.number().finite().min(-180).max(180)`.
    - `props.zoom`: `z.number().int().finite().min(0).max(19)` opcional.
    - `props.height`: `z.enum(supportedMapHeights)` opcional.
    - `props.markers`: `z.array(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), label: z.string() }).strip())` opcional.
    - `props.markerSources`: `z.array(z.object({ source: nonEmptyStringSchema, position: z.object({ lat: nonEmptyStringSchema, lng: nonEmptyStringSchema }).strip(), label: nonEmptyStringSchema, color: z.enum(supportedMapMarkerColors).optional() }).strip())` opcional.
  - `children: z.never().optional()`.
- `src/config/validate-map-node.ts` (nuevo): función `validateMapNode` siguiendo literalmente el patrón de post-parse de `src/config/validate-badge-node.ts` (leaf simple) y `src/config/validate-repeater-node.ts` (fuente de colección):
  1. `mapNodeSchema.safeParse(rawNode)`; en caso de fallo, mapear el issue con `mapQueryStateFeedbackIssue` → `mapVisibilityIssue` → comprobaciones específicas por segmento de `issuePath` (`props.center.lat`, `props.center.lng`, `props.zoom`, `props.height`, `props.markers[i].lat`, `props.markers[i].lng`, `props.markers[i].label`, `props.markerSources[i].source`, `props.markerSources[i].position.lat`, `props.markerSources[i].position.lng`, `props.markerSources[i].label`, `props.markerSources[i].color`) → `mapLayoutNodeIssue`/`mapLeafNodeIssue` como fallback, cada rama devolviendo `enrichedInvalidLayout`/`enrichErrorResult` con el mensaje `Page "${pageId}" has an invalid layout at "${path}...".` sobre la ruta exacta, igual que los precedentes.
  2. Tras el parseo exitoso: `validateQueryStateFeedback` y `validateVisibility` igual que el resto de nodos.
  3. Exclusión mutua: si `parseResult.data.props?.markers !== undefined` y `parseResult.data.props?.markerSources !== undefined` a la vez, rechazar con `invalid-layout` sobre la ruta `${path}.props` (mensaje análogo al de `link.props.href`/`props.action`).
  4. Para cada entrada de `markerSources`, validar `source` con `validateCollectionSource(entry.source, "${path}.props.markerSources[i].source", pageId)` (sin `allowItemReference`, igual que `repeater.props.items.source`); si falla, propagar su error.
  5. Para cada entrada de `markerSources`, validar `position.lat` y `position.lng` con `isValidCollectionItemPath` (de `validate-node-shared-helpers.ts`); si alguna no es una ruta relativa válida, rechazar `invalid-layout` sobre `${path}.props.markerSources[i].position.lat` o `.lng` respectivamente.
  6. Para cada entrada de `markerSources`, validar `label` con `isValidCollectionProjectionPath` (de `validate-node-shared-helpers.ts`, acepta ruta relativa o interpolación `{{...}}`); si no es válida, rechazar `invalid-layout` sobre `${path}.props.markerSources[i].label`.
  7. Construir el `MapLayoutNode` final: si ni `markers` ni `markerSources` estaban declarados en el input, el nodo normalizado lleva `props.markers: []`; si `markers` estaba declarado, se conserva tal cual (incluido `[]`); si `markerSources` estaba declarado, se conserva con los `source` ya normalizados por `validateCollectionSource`. `center`, `zoom` y `height` se copian tal cual si están presentes (sin aplicar aquí ningún valor por defecto: los defaults de Pamplona/zoom 13/`height: 'md'` se resuelven en el nodo de render, T4, igual que `divider` resuelve su `variant` por defecto en `DividerNode` y no en la validación).
- `src/config/validate-layout-nodes-core.ts`: importar `validateMapNode` desde `./validate-map-node` y añadir el `case 'map': return validateMapNode(rawNode, path, pageId, breadcrumb)` al `switch` de `validateLayoutNode`.

### Tests
**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-map.test.ts` (nuevo)

**Comportamiento cubierto**:
- Un nodo `map` sin `props` se acepta y normaliza a `props.markers: []`.
- Un nodo `map` con `props.center` válido (`lat`/`lng` dentro de rango) se acepta.
- Un nodo `map` con `props.center.lat` fuera de `[-90, 90]` o `props.center.lng` fuera de `[-180, 180]` se rechaza con `invalid-layout` sobre la ruta exacta (`{path}.props.center.lat` / `.lng`).
- Un nodo `map` con `props.zoom` no entero, negativo o mayor que `19` se rechaza con `invalid-layout` sobre `{path}.props.zoom`.
- Un nodo `map` con `props.height` fuera del enum (`sm|md|lg|xl`) se rechaza con `invalid-layout` sobre `{path}.props.height`.
- Un nodo `map` con `props.markers` válido (array de `{lat, lng, label}` dentro de rango) se acepta, incluido `markers: []`.
- Un nodo `map` con un `markers[i].lat`/`lng` fuera de rango se rechaza con `invalid-layout` sobre la ruta exacta del índice.
- Un nodo `map` con `props.markerSources` válido (`source: 'queries.posts.data'`, `position: {lat: 'coords.lat', lng: 'coords.lng'}`, `label: 'name'`) se acepta.
- Un nodo `map` con `markerSources[i].source` que no cumple el patrón `queries.{queryName}.data(.*)` se rechaza con `invalid-layout`.
- Un nodo `map` con `markerSources[i].position.lat` o `.lng` vacío, con formato de ruta global (`queries.*`, `item.*`) o mal formado se rechaza con `invalid-layout` sobre la ruta exacta.
- Un nodo `map` con `markerSources[i].label` como ruta relativa válida (`"name"`) se acepta, y como interpolación parcial (`"{{item.name}} ({{item.city}})"`) también se acepta.
- Un nodo `map` con `markerSources[i].label` vacío o inválido (ni ruta relativa ni interpolación) se rechaza con `invalid-layout`.
- Un nodo `map` con `markerSources[i].color` fuera del enum de seis colores se rechaza con `invalid-layout`.
- Un nodo `map` que declara `props.markers` y `props.markerSources` a la vez se rechaza con `invalid-layout` sobre `{path}.props`.
- Un nodo `map` con `children` declarado no propaga esos datos al resultado normalizado (nodo hoja).
- Un nodo `map` con `queryStateFeedback`/`visibility` válidos se acepta siguiendo el contrato transversal estándar (reutilizar helpers de test ya usados en `runtime-config-validation-badge.test.ts`).
- Un nodo `map` con `queryStateFeedback`/`visibility` inválidos se rechaza con el mismo mensaje que el resto del catálogo.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-map.test.ts`

**Restricciones**:
- Seguir literalmente el estilo de aserciones de `src/tests/config-validation/runtime-config-validation-badge.test.ts` y `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (construir un `layout` mínimo de una página, invocar la fachada pública de validación, comprobar `status`/mensaje/ruta).
- No probar aquí resolución en runtime de `markerSources` contra un store real: eso es exclusivamente de T2/T4.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/map.md` (ficha nueva, contrato de `props` y reglas de validación de esta tarea).

### Criterios de finalización
`map` es un tipo de nodo reconocido por `validateRuntimeConfig`: se acepta o rechaza correctamente según las reglas anteriores, sin que exista todavía ningún render visual.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/config-validation/runtime-config-validation-map.test.ts` en verde, sin romper el resto de la suite de `config-validation/`).

---

## T2 — Resolución de fuentes dinámicas de marcadores

### Objetivo
Extender `runtime-collection-sources.ts` con una función pura que, dada una `MapMarkerSource` ya validada y el estado runtime, resuelve la colección referenciada por `source`, navega `position.lat`/`position.lng`/`label` por item y devuelve solo los marcadores con coordenadas válidas, omitiendo el resto en silencio (requisito funcional 11 de `spec.md`).

### Fuera de alcance
- Asignación de color por defecto cuando se omite `color` en una fuente (orquestación por instancia de `map`, es de T4).
- Icono visual del marcador (T3).
- Cualquier componente de React (T4).

### Dependencias
T1 (usa el tipo `MapMarkerSource`).

### Interfaces
**Consume**:
- `interface MapMarkerSource { source: string; position: { lat: string; lng: string }; label: string; color?: ButtonColor }` (de T1).

**Produce**:
- `function resolveMapMarkerSourceItems(source: MapMarkerSource, state: RuntimeState, options?: { iterationContext?: RuntimeIterationContext }): Array<{ lat: number; lng: number; label: string }>` — consumido por: T4.

### Impacto esperado en archivos
- `src/runtime/runtime-collection-sources.ts`: añadir `resolveMapMarkerSourceItems`, implementada reutilizando las funciones ya existentes en el propio fichero:
  - Obtener la colección con `resolveCollectionSourceItems(source.source, state, options)`.
  - Para cada item de la colección (índice `index`):
    - Resolver `lat`/`lng` navegando `position.lat`/`position.lng` como ruta relativa al item con la misma lógica que la función privada `resolveCollectionItemPath` (navegación por segmentos, sin interpolación). Un valor resuelto solo es válido si es `typeof 'number'`, finito, y está dentro de `[-90, 90]` (`lat`) / `[-180, 180]` (`lng`); cualquier otro caso (no encontrado, no numérico, fuera de rango, `NaN`, `Infinity`) omite el item completo del resultado, sin diagnóstico en producción y con el mismo `console.warn` condicionado a `import.meta.env.DEV` que ya usa `reportCollectionItemDiagnostic` para otros consumidores de este fichero.
    - Resolver `label` reutilizando la función privada `resolveInterpolatedCollectionString` del propio fichero cuando `label` contiene `{{`/`}}` (con `iterationContext: { item, key: String(index), itemIndex: index }`), o navegación de ruta relativa (`normalizeCollectionItemPathText`) en caso contrario; si `label` no resuelve a texto, el marcador se omite igual que si la posición fuera inválida.
  - Devolver la lista de `{ lat, lng, label }` de los items que superaron ambas comprobaciones.
- `src/runtime/runtime-references/runtime-reference-diagnostics.ts`: añadir el literal `'map.props.markerSources.label'` a la unión `RuntimeReferenceSurface`, usado como `surface` al invocar `resolveRuntimeVisibleValue` para el `label` interpolado.

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-map-marker-sources.test.ts` (nuevo)

**Comportamiento cubierto**:
- Con una colección de items válidos (`position.lat`/`.lng` resolviendo a números en rango y `label` como ruta relativa), `resolveMapMarkerSourceItems` devuelve un marcador por item con `lat`/`lng`/`label` correctos y en el mismo orden que la colección.
- Un item cuyo `position.lat` o `position.lng` no resuelve (ruta ausente en el item) se omite del resultado sin lanzar excepción; el resto de items se resuelven con normalidad.
- Un item cuyo `position.lat`/`.lng` resuelve a un valor no numérico, `NaN`, `Infinity` o fuera de `[-90,90]`/`[-180,180]` se omite del resultado.
- Un `label` declarado como interpolación parcial (`"{{item.name}} ({{item.city}})"`) se resuelve usando el item actual como contexto de iteración.
- Un `label` declarado como ruta relativa simple (`"name"`) navega el valor del item.
- Una `source` que resuelve a una colección vacía o a un valor no-colección (siguiendo la degradación ya existente de `resolveCollectionSourceItems`) produce una lista de marcadores vacía sin error.
- La lista de items nunca se muta; llamadas repetidas con el mismo estado devuelven resultados equivalentes.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-map-marker-sources.test.ts`

**Restricciones**:
- Construir el `RuntimeState` de prueba con el mismo helper/patrón ya usado por otros tests puros de `runtime/` que ejercitan `runtime-references/` (por ejemplo el usado en `runtime-reference-resolution.test.tsx`), sembrando `queries.{queryName}.data` directamente en el estado en vez de montar componentes.
- No renderizar ningún nodo React en este fichero: es una prueba de función pura.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/map.md`: sección de comportamiento de fuentes dinámicas y degradación ante coordenadas inválidas.

### Criterios de finalización
`resolveMapMarkerSourceItems` resuelve correctamente colecciones dinámicas a marcadores válidos, degradando en silencio ante items sin coordenadas válidas, sin depender de ningún componente de render.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/runtime/runtime-map-marker-sources.test.ts` en verde).

---

## T3 — Dependencias Leaflet y helpers de estilo del nodo `map`

### Objetivo
Añadir `leaflet` y `react-leaflet` como dependencias del proyecto y crear el módulo de estilo del nodo `map` (`runtime-node-styling-map.ts`) con dos helpers puros: la clase Tailwind de altura del contenedor y el icono de marcador Leaflet (`divIcon` con SVG inline) por color semántico, siguiendo el mismo patrón de lookup map que `runtime-node-styling-badge.ts`.

### Fuera de alcance
- Uso de estos helpers dentro de un árbol React real (T4).
- Cualquier lógica de resolución de datos (T2).

### Dependencias
T1 (usa el tipo `MapHeight`).

### Interfaces
**Consume**:
- `type MapHeight = 'sm' | 'md' | 'lg' | 'xl'` (de T1).

**Produce**:
- `function getMapHeightClassName(height: MapHeight): string` — consumido por: T4.
- `function getMapMarkerIcon(color: ButtonColor): L.DivIcon` — consumido por: T4.

### Impacto esperado en archivos
- `package.json`: añadir `"leaflet": "^1.9.4"` y `"react-leaflet": "^5.0.0"` a `dependencies`, y `"@types/leaflet"` (versión mayor `^1.9`) a `devDependencies`. Instalar con `pnpm add leaflet react-leaflet` y `pnpm add -D @types/leaflet`.
- `src/runtime/runtime-node-styling-map.ts` (nuevo):
  - `mapHeightClassMap: Record<MapHeight, string>` con `sm: 'h-64'`, `md: 'h-80'`, `lg: 'h-96'`, `xl: 'h-[32rem]'` (valores fijados en `design.md`, decisión 5).
  - `getMapHeightClassName(height)` devuelve `mapHeightClassMap[height]`.
  - `mapMarkerColorHexMap: Record<ButtonColor, string>` con `neutral: '#64748b'`, `primary: '#3b82f6'`, `success: '#22c55e'`, `warning: '#f59e0b'`, `danger: '#ef4444'`, `info: '#06b6d4'` (valores `-500` ya declarados en `src/app/index.css`).
  - `getMapMarkerIcon(color)` construye y devuelve:
    ```ts
    import L from 'leaflet'

    L.divIcon({
      className: 'map-marker-icon',
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36"><path fill="${mapMarkerColorHexMap[color]}" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/></svg>`,
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36],
    })
    ```
    (SVG, tamaños y anclas literales, no ajustables por el implementador: deben coincidir exactamente entre agentes.)

### Tests
**Ficheros de test**:
- `src/tests/runtime/runtime-node-styling-map.test.ts` (nuevo)

**Comportamiento cubierto**:
- `getMapHeightClassName` devuelve la clase Tailwind esperada para cada uno de los cuatro valores de `MapHeight`.
- `getMapMarkerIcon` devuelve una instancia de `L.DivIcon` para cada uno de los seis colores semánticos.
- El `html` del icono devuelto por `getMapMarkerIcon` contiene el hex de color correcto para cada uno de los seis colores (comprobación de substring sobre `icon.options.html`).
- `getMapMarkerIcon` usa siempre `iconSize: [24, 36]`, `iconAnchor: [12, 36]` y `popupAnchor: [0, -36]` con independencia del color.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/runtime/runtime-node-styling-map.test.ts`

**Restricciones**:
- Prueba de función pura: no requiere `@testing-library/react` ni montar ningún componente, solo importar `leaflet` y los helpers e inspeccionar el objeto devuelto.

### Documentación afectada
- Ninguno (detalle de implementación interno; el resultado visual se documenta como parte de T4 en `nodes/map.md`).

### Criterios de finalización
`leaflet` y `react-leaflet` están instaladas y compilan; `getMapHeightClassName` y `getMapMarkerIcon` devuelven exactamente los valores especificados para cada variante/color.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/runtime/runtime-node-styling-map.test.ts` en verde).

---

## T4 — Nodo de render `map` y registro en el catálogo

### Objetivo
Implementar `MapNode` (`src/runtime/nodes/map-layout-node.tsx`) sobre `react-leaflet`, aplicando los valores por defecto (centro Pamplona, zoom 13, altura `md`), los dos modos de marcadores (estático/dinámico) usando `resolveMapMarkerSourceItems` (T2) y `getMapMarkerIcon`/`getMapHeightClassName` (T3), la asignación de color por defecto cuando hay varias fuentes dinámicas, y el popup al pulsar un marcador. Registrar `map` en el dispatcher central (`node-components-map.ts` y `layout-node-renderer.tsx`) para que el nodo participe del mismo code-splitting por chunk que el resto del catálogo. Esta es la tarea que deja `map` completamente utilizable de punta a punta.

### Fuera de alcance
- Soporte en el editor visual (`dev-editor`) para configurar `map` desde un panel de propiedades: explícitamente fuera de alcance de la feature completa (ver `spec.md`).
- Cualquier optimización de `invalidateSize()` ante remounts dentro de `repeater`/`tabs`/`accordion`: no la exige `spec.md` ni `design.md`.

### Dependencias
T1, T2, T3.

### Interfaces
**Consume**:
- `interface MapLayoutNode { ... }` (de T1).
- `function resolveMapMarkerSourceItems(source, state, options?): Array<{ lat: number; lng: number; label: string }>` (de T2).
- `function getMapHeightClassName(height: MapHeight): string` (de T3).
- `function getMapMarkerIcon(color: ButtonColor): L.DivIcon` (de T3).

**Produce**:
- `MapNode: React.ComponentType<{ node: MapLayoutNode; iterationContext?: RuntimeIterationContext }>` — sin consumidores directos fuera del dispatcher central cableado en esta misma tarea.

### Impacto esperado en archivos
- `src/runtime/nodes/map-layout-node.tsx` (nuevo):
  - `import 'leaflet/dist/leaflet.css'` como side-effect en la parte superior del módulo (decisión de carga diferida de `design.md`: este import solo se descarga cuando el chunk de `map` se carga).
  - Import de `MapContainer`, `TileLayer`, `Marker`, `Popup` desde `react-leaflet`.
  - Constante `DEFAULT_MAP_CENTER = { lat: 42.8125, lng: -1.6458 }` (Pamplona), `DEFAULT_MAP_ZOOM = 13`, `DEFAULT_MAP_HEIGHT: MapHeight = 'md'`.
  - Paleta cíclica de asignación de color por defecto: `MAP_SOURCE_COLOR_CYCLE: ButtonColor[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral']`.
  - `MapNode({ node })`:
    - Resuelve `center = node.props?.center ?? DEFAULT_MAP_CENTER`, `zoom = node.props?.zoom ?? DEFAULT_MAP_ZOOM`, `heightClassName = getMapHeightClassName(node.props?.height ?? DEFAULT_MAP_HEIGHT)`.
    - Renderiza `<MapContainer center={[center.lat, center.lng]} zoom={zoom} className={\`w-full ${heightClassName}\`}>` conteniendo un `<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />`.
    - **Modo estático** (`node.props?.markerSources` es `undefined`): itera `node.props?.markers ?? []`; cada marcador usa `getMapMarkerIcon('primary')` (color único fijo, ver decisión 4 de `design.md`: una sola fuente sin color declarado usa `primary`).
    - **Modo dinámico** (`node.props?.markerSources` está definido): itera `node.props.markerSources` con su índice; el color efectivo de cada fuente es `source.color ?? MAP_SOURCE_COLOR_CYCLE[index % MAP_SOURCE_COLOR_CYCLE.length]`; para cada fuente llama `resolveMapMarkerSourceItems(source, state, { iterationContext })` (obtiene `state` vía el hook ya usado por el resto de nodos, `useRuntimeState`) y renderiza un `<Marker>` por item resuelto con `icon={getMapMarkerIcon(colorEfectivo)}`.
    - Cada `<Marker position={[lat, lng]} icon={icon}>` incluye un `<Popup>{label}</Popup>` hijo; no se declara ningún `eventHandlers` de navegación/acción (requisito funcional 10 de `spec.md`: sin acciones del catálogo).
    - El componente no gestiona `visibility`/`queryStateFeedback`: eso ya lo resuelve genéricamente `LayoutNodeRenderer` antes de llegar aquí (igual que el resto del catálogo).
- `src/runtime/nodes/node-components-map.ts`: añadir `MapNode` al `import`, a `eagerMap.map` y a `lazyMap.map` (`React.lazy(() => import('./map-layout-node').then((m) => ({ default: m.MapNode })))`), en la misma posición alfabética que el resto de entradas.
- `src/runtime/layout-node-renderer.tsx`: añadir `case 'map': { const MapNode = NodeComponents.map; renderedNode = <MapNode node={node} iterationContext={iterationContext} />; break }` al `switch (node.type)`. Este `switch` no sigue orden alfabético (sigue el orden de incorporación cronológica de cada tipo al catálogo): añadir el nuevo `case` al final, junto a `toggle`/`hidden`. `map` no necesita añadirse a `NODE_TYPES_INERT_IN_EDIT_MODE` (no tiene control de formulario nativo) ni a la exclusión de `gridChildSpanClassName` (participa de `layout.span` como cualquier nodo hoja estándar).

### Tests
**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-map.test.tsx` (nuevo)
- `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (ampliación)

**Comportamiento cubierto** (`layout-renderer-map.test.tsx`):
- Un `map` sin `props.center` se renderiza con centro Pamplona (`[42.8125, -1.6458]`).
- Un `map` con `props.center` explícito se renderiza con ese centro.
- Un `map` sin `props.zoom` usa zoom `13`; con `props.zoom` explícito usa ese valor.
- Un `map` sin `props.height` usa la clase `h-80` (`md`); con `props.height` explícito usa la clase correspondiente.
- Un `map` con `props.markers` estático renderiza un marcador por entrada declarada, con la posición y el icono `primary`, y su `label` visible en el `Popup` asociado.
- Un `map` con `props.markers: []` no renderiza ningún marcador.
- Un `map` con una fuente dinámica (`markerSources` de un elemento) apuntando a una query con datos renderiza un marcador por elemento de la colección resuelta, con posición y label correctos.
- Un `map` con dos fuentes dinámicas sin `color` declarado asigna colores distintos (`primary` y `success`, según el ciclo) a cada fuente.
- Un `map` con dos fuentes dinámicas donde una declara `color` explícito respeta ese color y asigna por ciclo solo a la que lo omite.
- Un elemento de una fuente dinámica sin coordenadas válidas no se renderiza como marcador; el resto de marcadores de esa fuente y de otras fuentes se renderizan con normalidad.
- Al pulsar (simular click) un marcador se muestra su `label`; no se dispara ninguna acción de navegación, apertura de modal ni ejecución de operación (verificar que no hay handlers de acción registrados/llamados).
- `map` respeta `layout.span`, `visibility` y `queryStateFeedback` (loading/error/fallback) exactamente igual que otro nodo hoja del catálogo (reutilizar el mismo patrón de test que `layout-renderer-badge.test.tsx` o `layout-renderer-divider.test.tsx` para estas tres capacidades transversales).

**Comportamiento cubierto** (ampliación de `runtime-nodes-bundle.test.ts`):
- Añadir una entrada nueva a `FORBIDDEN_NODE_MARKERS` con un texto que solo aparece dentro del CSS/JS de Leaflet (por ejemplo la cadena `'leaflet-container'`, clase raíz que Leaflet añade al DOM y que solo existe si el CSS de Leaflet se ha bundleado) para comprobar que el bundle inicial (entry + modulepreload) no incluye el peso de Leaflet.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-map.test.tsx`
- `pnpm test:build` (ejecuta específicamente `dev-runtime-bundle.test.ts` y `runtime-nodes-bundle.test.ts`; usar para validar la ampliación del gate de bundle, ya que ese fichero está excluido del `pnpm test` estándar por su coste de build real)

**Restricciones**:
- `react-leaflet`/`leaflet` no funcionan de forma fiable en `jsdom` (miden dimensiones reales del DOM y usan APIs de `canvas`/`ResizeObserver` que `jsdom` no implementa). `layout-renderer-map.test.tsx` debe mockear el módulo `react-leaflet` con `vi.mock('react-leaflet', ...)`, sustituyendo `MapContainer`, `TileLayer`, `Marker` y `Popup` por dobles de test ligeros que rendericen elementos HTML simples exponiendo las props relevantes como atributos `data-*` (por ejemplo `<div data-testid="map-container" data-center={...} data-zoom={...} className={className}>{children}</div>`, `<div data-testid="marker" data-lat={...} data-lng={...} data-icon-html={icon.options.html}>{children}</div>`, `<div data-testid="popup">{children}</div>`). Los tests deben aserciones sobre las props recibidas por estos dobles, no sobre comportamiento real de Leaflet (tiles, paneo, zoom con rueda del ratón).
- No mockear `leaflet` en sí (`getMapMarkerIcon` debe ejecutarse de verdad; ya está cubierto de forma aislada por T3).
- Reutilizar el helper de montaje de estado runtime ya usado por el resto de `layout-renderer/` (mismo patrón que `layout-renderer-badge.test.tsx`) para sembrar `queries.*` de las fuentes dinámicas.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva fila de `map` en la tabla de "Nodos hoja visibles".
- `ai-workflow/docs/app-features/nodes/map.md`: contrato completo de render, defaults, modo estático/dinámico, asignación de color, popup, límites del nodo (v1 sin clustering/rutas/geolocalización).
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos" si el documento registra la última feature relevante del área.

### Criterios de finalización
Un config real con `map` (estático o dinámico, con o sin `props.center`/`zoom`/`height`) se renderiza correctamente de punta a punta a través de `LayoutRenderer`, con code-splitting verificado por el gate de bundle.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run src/tests/layout-renderer/layout-renderer-map.test.tsx` en verde, y `pnpm test:build` en verde tras la ampliación del gate de bundle), sin romper el umbral de cobertura del 80% sobre `src/` exigido por el proyecto (`pnpm test`).
