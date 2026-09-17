# Plan de implementación — Ajuste automático de centro/zoom del nodo `map` según sus marcadores

## Orden de ejecución

1. `T1` — contrato de config de `props.autoFitMarkers` (tipo, esquema `Zod`, validación y normalización).
2. `T2` — helper puro `resolveMapInitialView` que decide la vista inicial a partir de las coordenadas.
3. `T3` — integración en `MapNode`: resolver marcadores a una lista plana y aplicar la vista inicial congelada.

`T1` y `T2` son independientes entre sí y ambas bloquean a `T3`. `T3` no puede empezar hasta que las dos estén cerradas, porque consume el prop normalizado de `T1` y la función de `T2`.

## T1 — Contrato de config de `props.autoFitMarkers`

### Objetivo

Añadir `props.autoFitMarkers` como prop booleano opcional del nodo `map` en el contrato de configuración: tipo público, esquema `Zod`, rechazo con `invalid-layout` cuando el valor no es booleano, y conservación del valor en el nodo normalizado.

Concretamente:

- En `src/config/runtime-config-types.ts`, añadir `autoFitMarkers?: boolean` dentro de `MapLayoutNode['props']`, después de `markerSources`.
- En `src/config/runtime-config-zod.ts`, dentro de `mapNodeSchema` (`props`), añadir `autoFitMarkers: z.boolean().optional()` después de `markerSources`.
- En `src/config/validate-map-node.ts`, propagar el valor al nodo normalizado: añadir `autoFitMarkers: props?.autoFitMarkers` al objeto `props` del `return` final, después de `markerSources`.
- No añadir ninguna rama de mapeo de issue específica para `autoFitMarkers` en `validate-map-node.ts`: el `return mapLeafNodeIssue(...)` final ya produce el mensaje `Page "{pageId}" has an invalid layout at "{path}.props.autoFitMarkers".` a través de su formateo genérico de `issuePath`. El test de rechazo de esta tarea verifica precisamente esa ruta.
- `autoFitMarkers` declarado junto a `center`, `zoom`, `markers` o `markerSources` no produce ningún error ni altera la normalización de esos otros props: se conservan exactamente igual que hoy (incluida la precedencia de `markerSources` sobre `markers`).

### Fuera de alcance

- Cualquier cambio en el componente de render `src/runtime/nodes/map-layout-node.tsx` (es `T3`).
- Cualquier cálculo de bounds, centro o zoom (es `T2`).
- Añadir validación cruzada o rechazo por combinar `autoFitMarkers` con `center`/`zoom`: esa combinación es explícitamente válida.
- Cambiar el contrato o la normalización de `center`, `zoom`, `height`, `markers` o `markerSources`.
- Tocar `dev-editor` o cualquier superficie de edición visual.

### Dependencias

Ninguna. Es la primera tarea y puede ejecutarse en paralelo conceptual con `T2`, pero se aborda primero.

### Interfaces

**Consume**: ninguno.

**Produce**:

- `MapLayoutNode['props'].autoFitMarkers?: boolean` — consumido por: T3.

### Impacto esperado en archivos

- Código a modificar:
  - `src/config/runtime-config-types.ts` (campo `autoFitMarkers?: boolean` en `MapLayoutNode['props']`).
  - `src/config/runtime-config-zod.ts` (`mapNodeSchema.props.autoFitMarkers`).
  - `src/config/validate-map-node.ts` (propagación al nodo normalizado).
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-map.test.ts` (ampliación).
- Documentación afectada: `ai-workflow/docs/app-features/nodes/map.md`.

### Tests

#### Ficheros de test

- `src/tests/config-validation/runtime-config-validation-map.test.ts` (ampliación): añadir casos de aceptación al `describe('validateRuntimeConfig — map node: acceptance')` y casos de rechazo al `describe('validateRuntimeConfig — map node: rejection')`, reutilizando el helper local `createMapNode` y `createConfigWithLayout`.

#### Comportamiento cubierto

- Un `map` con `props.autoFitMarkers: true` valida como `ready` y el nodo normalizado conserva `props.autoFitMarkers: true`.
- Un `map` con `props.autoFitMarkers: false` valida como `ready` y el nodo normalizado conserva `props.autoFitMarkers: false` (no se normaliza a `undefined` ni se descarta).
- Un `map` sin `props.autoFitMarkers` valida como `ready` y el nodo normalizado deja `props.autoFitMarkers` como `undefined`, manteniendo `props.markers: []` como hoy.
- Un `map` con `props.autoFitMarkers: true` declarado junto a `props.center` y `props.zoom` valida como `ready` (no produce `invalid-layout`) y conserva los tres valores en el nodo normalizado.
- Un `map` con `props.autoFitMarkers: true` declarado junto a `props.markerSources` (y `props.markers` también declarado) valida como `ready`, conserva `autoFitMarkers: true`, conserva `markerSources` normalizado y deja `markers` como `undefined` (precedencia actual intacta).
- Un `map` con `props.autoFitMarkers` no booleano (por ejemplo la string `'true'`) se rechaza y el mensaje de error contiene la ruta `props.autoFitMarkers`.

#### Comandos durante la implementación

- `pnpm test --run src/tests/config-validation/runtime-config-validation-map.test.ts`

#### Restricciones

- Reusar los helpers ya presentes en el fichero (`createMapNode`, `createConfigWithLayout`); no introducir un nuevo constructor de config.
- Las aserciones de aceptación deben usar `toMatchObject` sobre `result.page.layout[0]`, con el guard `if (result.status === 'ready')` ya usado en el fichero.
- Las aserciones de rechazo deben comprobar la presencia de la subcadena `props.autoFitMarkers` en el mensaje, siguiendo el estilo de los casos de rechazo existentes del fichero.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/map.md`: tabla de contrato (`props`) con la nueva fila `props.autoFitMarkers`, sección "Normalización" (se copia tal cual, igual que `center`/`zoom`/`height`) y sección "Validación previa al render" (valor no booleano → `invalid-layout` sobre `{path}.props.autoFitMarkers`; combinación con `center`/`zoom` no se rechaza).

### Criterios de finalización

- `props.autoFitMarkers` existe en el tipo público, en el esquema `Zod` y en el nodo normalizado.
- Un valor no booleano se rechaza con `invalid-layout` sobre `{path}.props.autoFitMarkers`.
- Declarar `autoFitMarkers` junto a `center`/`zoom`/`markers`/`markerSources` no cambia la validación ni la normalización de esos props.
- Los tests existentes del fichero de validación del nodo `map` siguen pasando sin modificarse.

### Cierre de implementación

Código y tests de la tarea completos: `pnpm test --run src/tests/config-validation/runtime-config-validation-map.test.ts` en verde, sin cambios en `src/runtime/`.

## T2 — Helper puro `resolveMapInitialView`

### Objetivo

Crear el módulo `src/runtime/runtime-map-auto-fit.ts` con un helper puro que, dadas las coordenadas de los marcadores ya resueltos y un centro/zoom de fallback ya resuelto, decida la vista inicial del mapa: encuadre por bounds o centro con zoom.

Contrato exacto a implementar:

```ts
export type MapInitialView =
  | { mode: 'center'; center: { lat: number; lng: number }; zoom: number }
  | { mode: 'bounds'; bounds: [[number, number], [number, number]] }

export function resolveMapInitialView(
  coordinates: Array<{ lat: number; lng: number }>,
  fallback: { center: { lat: number; lng: number }; zoom: number },
): MapInitialView
```

Reglas de decisión, en este orden:

1. `coordinates` vacío: devolver `{ mode: 'center', center: fallback.center, zoom: fallback.zoom }`.
2. Calcular `minLat`, `maxLat`, `minLng`, `maxLng` recorriendo todas las coordenadas.
3. Si `minLat === maxLat && minLng === maxLng` (una sola coordenada, o varias coordenadas idénticas entre sí): devolver `{ mode: 'center', center: { lat: minLat, lng: minLng }, zoom: fallback.zoom }`.
4. En cualquier otro caso: devolver `{ mode: 'bounds', bounds: [[minLat, minLng], [maxLat, maxLng]] }`, es decir la esquina suroeste primero y la noreste después, en el formato `LatLngBoundsExpression` que acepta `MapContainer` de `react-leaflet`.

Notas de implementación:

- Un conjunto que comparte `lat` pero difiere en `lng` (o al revés) **no** es degenerado: produce `mode: 'bounds'` con un lado de longitud cero.
- La función es pura: no muta el array de entrada ni el objeto `fallback`, y no lee estado global ni del runtime.
- No aplica ningún valor por defecto propio: el centro y el zoom de fallback llegan ya resueltos desde el llamador.
- No filtra ni valida rangos de coordenadas: las coordenadas que recibe ya vienen validadas por el contrato de config (`props.markers`) o por `resolveMapMarkerSourceItems` (`props.markerSources`).

### Fuera de alcance

- Conectar el helper con el componente `MapNode` (es `T3`).
- Padding, `boundsOptions` o cualquier parámetro de ajuste fino del encuadre.
- Recalcular la vista ante cambios posteriores de los marcadores.
- Cualquier cambio en `src/config/` o en `resolveMapMarkerSourceItems`.

### Dependencias

Ninguna funcional. Se aborda después de `T1` por orden del plan, pero no consume nada de `T1`.

### Interfaces

**Consume**: ninguno.

**Produce**:

- `resolveMapInitialView(coordinates: Array<{ lat: number; lng: number }>, fallback: { center: { lat: number; lng: number }; zoom: number }): MapInitialView` — consumido por: T3.
- `MapInitialView` (tipo unión discriminado por `mode`, con las variantes `{ mode: 'center'; center: { lat: number; lng: number }; zoom: number }` y `{ mode: 'bounds'; bounds: [[number, number], [number, number]] }`) — consumido por: T3.

### Impacto esperado en archivos

- Código a crear: `src/runtime/runtime-map-auto-fit.ts`.
- Tests a crear: `src/tests/runtime/runtime-map-auto-fit.test.ts`.
- Documentación afectada: ninguna en esta tarea (el comportamiento observable se documenta con `T3`).

### Tests

#### Ficheros de test

- `src/tests/runtime/runtime-map-auto-fit.test.ts` (nuevo): tests unitarios directos sobre `resolveMapInitialView`, sin render ni estado del runtime.

#### Comportamiento cubierto

- Con `coordinates: []` devuelve `{ mode: 'center', center: <fallback.center>, zoom: <fallback.zoom> }`.
- Con una única coordenada devuelve `mode: 'center'` centrado en esa coordenada y con `zoom` igual a `fallback.zoom`, ignorando `fallback.center`.
- Con dos o más coordenadas idénticas entre sí devuelve `mode: 'center'` centrado en ese punto y con `zoom` igual a `fallback.zoom`.
- Con dos coordenadas distintas devuelve `mode: 'bounds'` con `bounds` igual a `[[minLat, minLng], [maxLat, maxLng]]`.
- Con tres o más coordenadas dispersas (incluyendo valores negativos y coordenadas que no llegan ordenadas) devuelve el `bounds` que contiene a todas: esquina suroeste con el mínimo de `lat` y de `lng`, esquina noreste con el máximo de `lat` y de `lng`.
- Con dos coordenadas que comparten `lat` pero difieren en `lng` devuelve `mode: 'bounds'` (no degenera a `mode: 'center'`).
- No muta el array de coordenadas recibido: tras la llamada, el array de entrada conserva su orden y su contenido original.

#### Comandos durante la implementación

- `pnpm test --run src/tests/runtime/runtime-map-auto-fit.test.ts`

#### Restricciones

- Los tests deben llamar a la función directamente; no usar `@testing-library/react` ni montar componentes en este fichero.
- No mockear `react-leaflet` ni `leaflet` aquí: el módulo no debe importarlos.

### Documentación afectada

Ninguna.

### Criterios de finalización

- `src/runtime/runtime-map-auto-fit.ts` exporta `resolveMapInitialView` y el tipo `MapInitialView` con la firma declarada en `Interfaces`.
- Las cuatro reglas de decisión (vacío, degenerado, bounds, orden suroeste/noreste) están implementadas y cubiertas por tests.
- El módulo no importa `react-leaflet`, `leaflet` ni estado del runtime.

### Cierre de implementación

Código y tests de la tarea completos: `pnpm test --run src/tests/runtime/runtime-map-auto-fit.test.ts` en verde, con el módulo nuevo sin consumidores todavía.

## T3 — Aplicar la vista automática en `MapNode`

### Objetivo

Integrar `props.autoFitMarkers` en el componente `MapNode` (`src/runtime/nodes/map-layout-node.tsx`): resolver los marcadores efectivos a una lista plana antes del JSX, calcular con `resolveMapInitialView` la vista inicial una única vez en el primer render, y pasar a `MapContainer` o bien `bounds` o bien `center`/`zoom`.

Cambios exactos a realizar en `MapNode`:

1. Resolver los marcadores efectivos a una lista plana **antes** del `return`, sustituyendo el `flatMap` actual dentro del JSX. Cada entrada de esa lista lleva `{ lat: number; lng: number; label: string; color: ButtonColor }`:
   - Si `node.props?.markerSources === undefined`: una entrada por cada `node.props?.markers ?? []`, con `color: 'primary'` (comportamiento actual del modo estático).
   - Si `node.props?.markerSources !== undefined`: recorrer las fuentes en orden, resolviendo cada una con `resolveMapMarkerSourceItems(source, state, { iterationContext })` y aplicando el mismo color efectivo de hoy (`source.color` si está declarado, o si no `MAP_SOURCE_COLOR_CYCLE[sourceIndex % MAP_SOURCE_COLOR_CYCLE.length]`).
   - El `key` de cada `<Marker>` debe seguir distinguiendo fuente e índice igual que hoy (`` `${sourceIndex}-${itemIndex}` `` en modo dinámico, `index` en modo estático); mantener esa información en la lista plana o en el mapeo a JSX.
2. Calcular la vista inicial y **congelarla en el primer render** con un `useRef`, de modo que re-renders posteriores no la recalculen ni la cambien:

   ```ts
   const initialViewRef = useRef<MapInitialView | null>(null)
   if (initialViewRef.current === null) {
     initialViewRef.current = resolveMapInitialView(
       node.props?.autoFitMarkers === true ? resolvedMarkers.map(({ lat, lng }) => ({ lat, lng })) : [],
       { center, zoom },
     )
   }
   const initialView = initialViewRef.current
   ```

   donde `center` y `zoom` son los valores efectivos que el componente ya calcula hoy (`node.props?.center ?? DEFAULT_MAP_CENTER` y `node.props?.zoom ?? DEFAULT_MAP_ZOOM`). Pasar `[]` cuando `autoFitMarkers` no es `true` garantiza que el camino sin la opción devuelve siempre `mode: 'center'` con el centro/zoom de hoy.
3. Derivar las props de vista de `MapContainer` sin duplicar el JSX del contenedor:

   ```ts
   const viewProps =
     initialView.mode === 'bounds'
       ? { bounds: initialView.bounds }
       : { center: [initialView.center.lat, initialView.center.lng] as [number, number], zoom: initialView.zoom }
   ```

   y renderizar `<MapContainer {...viewProps} className={...}>`. No declarar `center`/`zoom` cuando se pasa `bounds`, ni al revés. Mantener un único `<MapContainer>` en el JSX: no duplicar el árbol por rama.
4. La lista de marcadores **no** se congela: si `markerSources` resuelve datos después del primer render, los `<Marker>` nuevos se renderizan con normalidad mientras la vista inicial permanece intacta.
5. El `<TileLayer>`, el `<Popup>{label}</Popup>` por marcador, la clase `w-full ${heightClassName}` y la ausencia de `eventHandlers` se mantienen exactamente como hoy.

### Fuera de alcance

- Cambiar el contrato de config (ya cerrado en `T1`) o las reglas de decisión de la vista (ya cerradas en `T2`).
- Padding, `boundsOptions`, animación o transición del encuadre.
- Recalcular o mover la vista ante cambios posteriores de marcadores, de `center` o de `zoom`.
- `invalidateSize()` ante remounts en `repeater`/`tabs`/`accordion` (límite vigente del nodo, sin cambios).
- Cambios en `runtime-node-styling-map.ts`, en `resolveMapMarkerSourceItems` o en el registro de `node-components-map.ts`.

### Dependencias

Depende de `T1` (el prop `autoFitMarkers` debe existir en el nodo normalizado) y de `T2` (la función `resolveMapInitialView` debe existir). No puede empezar antes de que ambas estén cerradas.

### Interfaces

**Consume**:

- `MapLayoutNode['props'].autoFitMarkers?: boolean` (de T1).
- `resolveMapInitialView(coordinates: Array<{ lat: number; lng: number }>, fallback: { center: { lat: number; lng: number }; zoom: number }): MapInitialView` (de T2).
- `MapInitialView` (tipo unión discriminado por `mode`, con las variantes `{ mode: 'center'; center: { lat: number; lng: number }; zoom: number }` y `{ mode: 'bounds'; bounds: [[number, number], [number, number]] }`) (de T2).
- `resolveMapMarkerSourceItems(source: MapMarkerSource, state: RuntimeState, options?: { iterationContext?: RuntimeIterationContext }): ResolvedMapMarkerSourceItem[]` (existente en `src/runtime/runtime-collection-sources.ts`, sin cambios).

**Produce**: ninguno (última tarea del plan; no expone firmas nuevas a tareas posteriores).

### Impacto esperado en archivos

- Código a modificar: `src/runtime/nodes/map-layout-node.tsx`.
- Tests a modificar: `src/tests/layout-renderer/layout-renderer-map.test.tsx` (ampliación, incluida la ampliación del mock local de `react-leaflet`).
- Documentación afectada: `ai-workflow/docs/app-features/nodes/map.md`.

### Tests

#### Ficheros de test

- `src/tests/layout-renderer/layout-renderer-map.test.tsx` (ampliación): nuevo `describe` para el ajuste automático, más la ampliación del doble de `MapContainer` en el `vi.mock('react-leaflet', ...)` ya existente en el fichero.

El doble de `MapContainer` debe pasar a exponer también los bounds y a omitir los atributos ausentes, manteniendo compatibles los tests actuales que leen `data-center` y `data-zoom`:

```tsx
MapContainer: ({ center, zoom, bounds, className, children }: AnyProps) => (
  <div
    data-testid="map-container"
    data-center={center ? JSON.stringify(center) : undefined}
    data-bounds={bounds ? JSON.stringify(bounds) : undefined}
    data-zoom={zoom}
    className={className}
  >
    {children}
  </div>
)
```

#### Comportamiento cubierto

- Sin `props.autoFitMarkers` y con varios `props.markers`, el contenedor sigue recibiendo `data-center` con el centro por defecto (`[42.8125, -1.6458]`) y `data-zoom` `13`, y no recibe `data-bounds` (no hay cambio de comportamiento).
- Con `props.autoFitMarkers: false` y varios `props.markers`, el resultado es idéntico al caso anterior (sin `data-bounds`).
- Con `props.autoFitMarkers: true` y dos o más `props.markers` de coordenadas dispersas, el contenedor recibe `data-bounds` igual a `[[minLat, minLng], [maxLat, maxLng]]` de esos marcadores y no recibe `data-center`; los marcadores se siguen renderizando con sus posiciones y popups.
- Con `props.autoFitMarkers: true` y `props.center`/`props.zoom` declarados junto a dos o más marcadores, el contenedor recibe `data-bounds` y no aplica el centro manual (no hay `data-center`).
- Con `props.autoFitMarkers: true` y un único marcador, el contenedor recibe `data-center` igual a la posición de ese marcador y `data-zoom` igual al `props.zoom` declarado; sin `props.zoom` declarado, `data-zoom` es `13`.
- Con `props.autoFitMarkers: true` y varios marcadores de coordenadas idénticas entre sí, el contenedor recibe `data-center` en ese punto y no `data-bounds`.
- Con `props.autoFitMarkers: true` y cero marcadores (`props.markers: []` o sin `markers` ni `markerSources`), el contenedor recibe el `data-center`/`data-zoom` declarados si los hay, o el centro/zoom por defecto si no.
- Con `props.autoFitMarkers: true` y `props.markerSources` cuya query ya resolvió varios ítems con coordenadas válidas en el primer render, el contenedor recibe el `data-bounds` que encuadra esos ítems dinámicos, ignorando `props.center`/`props.zoom` declarados.
- Con `props.autoFitMarkers: true` y `props.markerSources` cuya query resuelve una colección vacía en el primer render, el contenedor cae al `data-center`/`data-zoom` de fallback (declarado o por defecto).
- Con `props.autoFitMarkers: true` y `props.markerSources`, si un re-render posterior aporta más ítems resueltos, los marcadores nuevos aparecen renderizados pero `data-bounds` (o `data-center`/`data-zoom`) del contenedor no cambia respecto al primer render.

#### Comandos durante la implementación

- `pnpm test --run src/tests/layout-renderer/layout-renderer-map.test.tsx`

#### Restricciones

- Reusar los helpers ya presentes en el fichero (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`) y el mock local de `react-leaflet`; no crear un fichero de test nuevo para el nodo `map` ni un segundo mock del paquete.
- Para el caso de re-render con más ítems resueltos, usar el `rerender` devuelto por `render` con un estado de runtime nuevo (misma técnica de proveedor explícito que `renderRuntimePageWithState`), no un `act` manual sobre el store.
- No modificar los tests existentes del fichero salvo lo estrictamente necesario para la ampliación del mock; todos deben seguir pasando sin cambiar sus aserciones.
- No añadir snapshots.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/map.md`: sección "Render (`MapNode`, ...)" con el comportamiento del ajuste automático (encuadre con `bounds` para dos o más marcadores distintos, fallback a centro/zoom para cero, uno o varios marcadores idénticos, prevalencia sobre `props.center`/`props.zoom`, cálculo único en el primer render y marcadores posteriores que se renderizan sin mover la vista). Si `T1` no lo hizo ya, completar también la fila de `props.autoFitMarkers` en la tabla de contrato.

### Criterios de finalización

- `MapNode` resuelve los marcadores efectivos a una lista plana antes del JSX y conserva el color por fuente y los popups actuales.
- Con `autoFitMarkers: true` y dos o más marcadores distintos, `MapContainer` recibe `bounds` y no recibe `center`/`zoom`.
- Con `autoFitMarkers` ausente o `false`, `MapContainer` recibe exactamente el `center`/`zoom` de hoy.
- La vista inicial se calcula una sola vez: un re-render con más marcadores resueltos no la modifica.
- Existe un único `<MapContainer>` en el JSX del componente.
- Todos los tests previos de `src/tests/layout-renderer/layout-renderer-map.test.tsx` siguen en verde.

### Cierre de implementación

Código y tests de la tarea completos: `pnpm test --run src/tests/layout-renderer/layout-renderer-map.test.tsx` en verde, con la feature funcionando de punta a punta desde el config validado hasta el render del mapa.

## Siguiente tarea

`T1` — Contrato de config de `props.autoFitMarkers`.
