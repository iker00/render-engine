# Design: Feature 2026-08-24-12-58 - map-node

## Contexto
El catálogo de nodos (`ai-workflow/docs/app-features/nodes/`) sigue un patrón estable: contrato en `props`, validación previa al render en `src/config/` (fachada `validateRuntimeConfig`, con `validate-layout-nodes` como responsable de las reglas de shape por nodo), render en `src/runtime/nodes/<nodo>-layout-node.tsx` registrado en el dispatcher central, y soporte transversal de `layout.span`, `visibility` y `queryStateFeedback` ya resuelto de forma genérica por `layout-renderer`/`layout-node-renderer`.

Dos precedentes directos existen ya en el catálogo:
- `repeater` (`props.items.source` limitado a `queries.{queryName}.data(.*)`, `props.items.key` como ruta relativa al item) para el patrón de "una colección resuelta desde una query, navegada por ruta relativa por item".
- `select` en su shape `dinámico unificado` (`{ source, itemType, label?, value? }`, con `itemType: 'object'` exigiendo `label`/`value` como ruta relativa o interpolación) para el patrón de "extraer varios campos por item de una colección dinámica".

`map` combina ambos: necesita un origen de colección (como `repeater`) del que extraer varios campos por item (como `select`), pero además admite un modo estático puro (lista literal), y — a diferencia de cualquier nodo existente — admite **varias fuentes dinámicas simultáneas** en la misma instancia, cada una con su propio origen y estilo.

Ningún nodo actual depende de una librería de terceros con peso de bundle relevante ni con requisitos de layout propios (altura explícita). Ambas cosas son nuevas para el catálogo y requieren decisión explícita.

## Objetivos / No objetivos

### Objetivos
- Fijar el contrato exacto de `props` de `map`: centro, zoom, altura, marcadores estáticos, fuentes dinámicas y su diferenciación visual.
- Fijar la estrategia de carga de Leaflet/react-leaflet para no penalizar el bundle de páginas sin `map`.
- Fijar el criterio de validación (rechazo vs degradación) para cada campo del contrato, coherente con los precedentes ya vigentes (`repeater`, `select`, `tabs`).
- Fijar cómo se reutiliza la infraestructura existente (`runtime-collection-sources`, `queryStateFeedback`) en vez de duplicar lógica de resolución de colecciones o de estado de query.

### No objetivos
- No se diseña soporte en el dev editor (panel de propiedades para `map`); ya está explícitamente fuera de alcance en la spec.
- No se diseña clustering, capas adicionales, rutas ni geolocalización; fuera de alcance de spec.
- No se resuelve aquí el detalle de implementación línea a línea (nombres de funciones, tests concretos); eso pertenece a `generate-implementation-plan`.

## Decisiones

### 1. Librería: `react-leaflet` + `leaflet`, no Leaflet imperativo a mano
Se usa `react-leaflet` (bindings oficiales de React sobre Leaflet) en vez de integrar Leaflet de forma imperativa con `useEffect`/refs manuales.

- Por qué: `react-leaflet` ya resuelve el ciclo de vida (montaje/desmontaje del mapa, sincronización de props como `center`/`zoom`, limpieza de listeners) de una forma declarativa consistente con JSX, que es la convención por defecto del proyecto (`conventions.md`, sección JSX frente a `createElement`). Integrar Leaflet a mano evitaría una dependencia extra pequeña pero introduce una superficie real de bugs de ciclo de vida (fugas de instancias del mapa, listeners duplicados en remount) que no aporta beneficio proporcional.
- Alternativa descartada: Leaflet puro con wrapper manual. Ahorra el peso de `react-leaflet` (pequeño, wrapper fino) a cambio de más código imperativo propio y más riesgo de regresión en montaje/desmontaje dentro de árboles con `repeater`/`tabs`/`accordion` (remounts frecuentes). No compensa.
- Coste asumido: una dependencia adicional en `package.json` más allá de `leaflet`.

### 2. Carga diferida del nodo `map` (code-splitting)
El nodo `map` se registra en el dispatcher central como un componente cargado con `React.lazy(() => import(...))`, envuelto en `Suspense` con un fallback ligero (marcador de posición simple, sin dependencia de Leaflet). El import de `leaflet/dist/leaflet.css` vive como side-effect dentro del propio módulo diferido del nodo, no en el entrypoint global.

- Por qué: Leaflet + react-leaflet añaden un peso no despreciable (Leaflet ronda ~40KB gzip, react-leaflet suma un wrapper adicional) frente al resto de nodos del catálogo, que son componentes ligeros basados en utilidades de Tailwind. Páginas de configuración que no declaran ningún `map` no deben pagar ese coste en el bundle inicial. Esto responde directamente al requisito no funcional de la spec sobre evaluar el peso añadido.
- Alternativa descartada: incluir Leaflet en el bundle síncrono principal, igual que el resto del catálogo. Más simple de implementar, pero penaliza el tiempo de carga de toda página que no usa mapas, incluidas las más frecuentes del catálogo actual (formularios, tablas).
- Trade-off asumido: el primer render de una página con `map` muestra brevemente el fallback mientras se descarga el chunk; se acepta como coste aceptable frente a penalizar todas las páginas sin mapa.
- Riesgo residual: si en el futuro la mayoría de páginas de una instancia real usan `map`, el beneficio de la carga diferida se reduce a un único chunk cacheado tras la primera página; no se considera un problema para v1.

### 3. Iconografía de marcadores: `divIcon` con SVG inline, no imágenes de marcador por color
La diferenciación visual por fuente (`color`) se resuelve generando el icono del marcador como `L.divIcon` con un SVG de pin inline, coloreado según un `Record<Color, string>` (hex), en vez de usar el marcador por defecto de Leaflet (imagen PNG) o mantener un set de imágenes PNG por color.

- Por qué: el marcador por defecto de Leaflet depende de rutas de imagen (`marker-icon.png`, etc.) que requieren reconfigurar manualmente `L.Icon.Default` bajo bundlers como Vite (problema conocido de la librería); generar el pin como SVG inline evita ese problema por completo y evita añadir assets binarios nuevos al repo, siguiendo la preferencia general del proyecto por SVG/utilidades sobre binarios paralelos. Además reutiliza el mismo patrón de "lookup map por variante" (`Record<Variant, string>`) que ya usan `divider-layout-node.tsx` y `button-layout-node.tsx`, exigido por `conventions.md`.
- Alternativa descartada: parchear `L.Icon.Default.mergeOptions` con imágenes estáticas importadas y mantener variantes de imagen por color. Añade assets y complejidad de bundling sin beneficio visual sobre un SVG inline.
- Coste asumido: el pin no es el icono clásico de Leaflet, sino un SVG propio del proyecto; se acepta como parte de la identidad visual del catálogo.

### 4. Paleta de diferenciación por fuente: reutilizar la paleta semántica cerrada existente
`markerSources[].color` reutiliza exactamente la misma paleta cerrada de seis colores ya usada por `badge`, `alert` y `stat` (`neutral | primary | success | warning | danger | info`), en vez de introducir una paleta nueva propia de `map`.

- Por qué: coherencia visual transversal del catálogo y cero superficie nueva de validación (`Zod` enum ya existente conceptualmente, aunque la implementación concreta del enum es detalle de plan).
- Regla de asignación: `color` es opcional por fuente. Si se omite y hay más de una fuente dinámica declarada, el runtime asigna color por orden de declaración recorriendo la paleta (`primary, success, warning, danger, info, neutral`, cíclico) para garantizar diferenciación sin exigir configuración manual. Si solo hay una fuente (estática o dinámica) sin `color` declarado, se usa `primary` como estilo por defecto.
- Alternativa descartada: exigir `color` obligatorio en cada fuente dinámica cuando hay más de una. Más explícito, pero añade fricción de configuración para un caso (diferenciación visual) donde un default razonable ya cumple el criterio de aceptación de la spec ("marcadores de cada fuente son visualmente distinguibles").

### 5. Contrato de `props` de `map`

```
props.center?: { lat: number; lng: number }
  // default: Pamplona { lat: 42.8125, lng: -1.6458 }

props.zoom?: number
  // entero, default 13 (vista de ciudad)

props.height: 'sm' | 'md' | 'lg' | 'xl'
  // obligatorio con default 'md' si se omite; resuelto vía lookup map a utilidades
  // de altura de Tailwind (p. ej. sm=h-64, md=h-80, lg=h-96, xl=h-[32rem]),
  // mismo patrón de variante que divider/button.

props.markers?: Array<{ lat: number; lng: number; label: string }>
  // modo estático

props.markerSources?: Array<{
  source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*'
  position: { lat: string; lng: string }   // ruta relativa al item, como items.key de repeater
  label: string                             // ruta relativa al item o interpolación parcial {{...}}, como select dinámico
  color?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}>
  // modo dinámico, una o varias fuentes simultáneas
```

- `markers` y `markerSources` no son mutuamente excluyentes a nivel de validación: declarar ambos es válido, y `markerSources` prevalece — el nodo normalizado descarta `markers` (queda `undefined`) y conserva `markerSources`. Decisión revisada tras la implementación inicial (que sí rechazaba la combinación con `invalid-layout` sobre `{path}.props`, siguiendo el patrón de `link.props.href`/`props.action`): se prefirió no bloquear el config completo por una combinación que el propio render ya resuelve sin ambigüedad (T4 ya despachaba en modo dinámico con solo comprobar `markerSources !== undefined`, ignorando `markers` en ese caso).
- Omitir ambos es válido y equivale a `markers: []` (mapa sin marcadores), igual que el caso límite ya aceptado de lista estática vacía.
- `map` no admite `children` (nodo hoja), igual que el resto de nodos hoja visibles.
- Por qué esta forma para `markerSources`: es la composición directa de los dos precedentes ya vigentes (`repeater.items.source` + `select` dinámico `itemType:'object'` con `label`/`value` como ruta relativa), evitando inventar una sintaxis nueva de referencia a colecciones.
- Por qué `height` como enum cerrado y no valor libre (píxeles/CSS arbitrario): Leaflet exige una altura explícita del contenedor para renderizar, pero `conventions.md` solo admite salirse de las utilidades de Tailwind mediante variable CSS como excepción puntual ya documentada para `container.props.gap`; generalizar esa excepción a una altura arbitraria por nodo abriría una API visual paralela no revisable. Un enum cerrado con lookup map es coherente con el patrón de variantes ya exigido por el proyecto.
  - Alternativa descartada: `props.height` numérico libre en píxeles alimentando una variable CSS (`h-[var(--map-height)]`). Más flexible, pero repite el mismo riesgo que `conventions.md` ya trata como excepcional y no quiere generalizar.

### 6. Validación: literales rechazan, datos runtime degradan
Se mantiene el mismo criterio ya vigente en el resto del catálogo: lo que el autor declara de forma literal se valida estrictamente antes del render (rechazo); lo que se resuelve en runtime desde una query degrada de forma silenciosa sin romper el resto del render.

- `props.center`: si se declara, `lat` debe estar en `[-90, 90]` y `lng` en `[-180, 180]`, ambos finitos; fuera de rango rechaza el config completo (`invalid-layout`) sobre la ruta exacta. Es dato literal de configuración, mismo criterio que el resto de props numéricos del catálogo (p. ej. `pageSize` de `repeater`).
- `props.zoom`: si se declara, debe ser un entero entre `0` y `19` (rango soportado por el proveedor de tiles de OSM); fuera de rango o no entero rechaza el config completo. Se elige **rechazar, no clamp**, resolviendo la pregunta abierta de la spec: es el mismo criterio que ya usa el proyecto para otros umbrales numéricos declarados de forma estática (`repeater.pagination.pageSize`, validaciones de formulario `min`/`max`), y evita que un config con un valor fuera de rango se comporte de forma distinta a la intención declarada sin que quede registrado como error.
- `props.markers[].lat/lng`: mismo rango que `center`; fuera de rango rechaza el config completo (son literales, igual que `center`).
- `props.markerSources[].position.lat/lng` (resuelto en runtime por item): si el valor resuelto no es un número finito dentro de rango válido, **ese elemento se omite silenciamente del mapa** sin romper el resto del render — esto ya está fijado como requisito funcional 11 de la spec y es coherente con la degradación ya documentada de `repeater` ante keys/colecciones inválidas.
- Resuelve la pregunta abierta de la spec sobre el comportamiento ante `error` de query en una fuente dinámica sin `queryStateFeedback`: sigue el mismo patrón de degradación silenciosa de `repeater` (cero marcadores de esa fuente, sin diagnóstico visible en producción), en vez de introducir un comportamiento propio de `map`.

### 7. Reutilizar `runtime-collection-sources` para resolver `markerSources`
La resolución de cada fuente dinámica (obtener la colección desde `queries.{queryName}.data(.*)`, iterar y navegar la ruta relativa por item) se implementa extendiendo `runtime-collection-sources` como un consumidor más, en vez de escribir una resolución de colecciones ad hoc dentro del nodo `map`.

- Por qué: `architecture.md` ya identifica `runtime-collection-sources` como el módulo responsable de "normalizar colecciones para consumidores como `list`, `select`, `radioGroup` y `checkboxGroup`"; `map` es exactamente ese mismo tipo de consumidor (varios campos extraídos por item de una colección dinámica), y añadir un parser paralelo dentro de `runtime/nodes/map-layout-node.tsx` rompería la frontera "Ningún nodo visual debe reimplementar navegación por `queries.*`" ya fijada en `architecture.md`.
- Diferencia a resolver dentro de ese módulo (no aquí, es detalle de implementación): `map` es el primer consumidor con **múltiples fuentes simultáneas** en la misma instancia, mientras que los consumidores actuales resuelven una única colección por nodo. La extensión debe soportar invocarse una vez por fuente declarada.

### 8. `queryStateFeedback` con múltiples fuentes dinámicas
`map.queryStateFeedback.query` sigue el contrato transversal ya vigente: referencia a **una** query nombrada. Cuando `markerSources` declara varias fuentes sobre queries distintas, `queryStateFeedback` solo puede observar una de ellas; el resto de fuentes siguen su degradación silenciosa individual (ver decisión 6) con independencia del estado que gobierne `queryStateFeedback`.

- Por qué: no se introduce una heurística nueva de estado agregado (por ejemplo "loading si cualquiera de las queries está loading"), porque el contrato transversal de `queryStateFeedback` ya está cerrado a una query por nodo en todo el catálogo; generalizarlo a N queries es un cambio transversal que excede el alcance de esta feature y no lo pide la spec.
- Trade-off asumido: un `map` con varias fuentes dinámicas sobre distintas queries no puede mostrar un estado de carga/error unificado desde `queryStateFeedback` para todas ellas a la vez; solo para la que se declare explícitamente. Se documenta como límite conocido del nodo, no como bug.

### 9. Registro del nodo en el catálogo
- Contrato y validación: se extiende `validate-layout-nodes` (y los esquemas `Zod` internos de `runtime-config-zod.ts`) con las reglas de `map` descritas arriba, siguiendo el mismo patrón que `repeater`/`select`/`tabs` ya documentado en `validation.md`.
- Render: nuevo nodo hoja en `src/runtime/nodes/` (`map-layout-node.tsx`), cargado de forma diferida (decisión 2) y conectado desde el dispatcher central de nodos.
- `map` se añade a la lista de tipos que soportan `layout.span`, `visibility` y `queryStateFeedback` (todo el catálogo excepto `hidden`), sin lógica especial adicional en `layout-renderer`/`layout-node-renderer` más allá de esa inclusión.

## Riesgos y trade-offs
- **Peso de bundle**: mitigado con carga diferida (decisión 2), pero el chunk de Leaflet sigue siendo el más pesado del catálogo cuando se activa; aceptable porque solo lo pagan las páginas que realmente usan `map`.
- **Política de uso razonable de OSM**: v1 no añade ninguna capa de caché de tiles propia ni cabecera `User-Agent` personalizada más allá del comportamiento por defecto del navegador (caché HTTP estándar de imágenes de tile). Es aceptable para v1 dado el volumen esperado, pero es un riesgo real si el uso en producción crece de forma significativa (ver preguntas abiertas).
- **Múltiples fuentes dinámicas sin estado agregado** (decisión 8): un `map` con varias queries en distintos estados no tiene una forma declarativa de mostrar "cargando" mientras cualquiera de ellas está en curso; solo se puede observar una. Riesgo bajo dado que la spec no exige ese comportamiento agregado.
- **`react-leaflet` como dependencia nueva**: añade una dependencia de terceros más al proyecto (además de `leaflet`); se acepta por la reducción de riesgo de ciclo de vida frente a integración imperativa manual (decisión 1).

## Migración o despliegue
No aplica. `map` es un nodo nuevo y aditivo: ningún config existente lo declara, no hay contrato previo que migrar ni datos que transformar. El despliegue es el mismo flujo estándar de release del resto de features del catálogo.

## Preguntas abiertas
- Si el volumen real de tráfico a tiles de OpenStreetMap en producción incumple la política de uso razonable del proyecto OSM, hará falta evaluar una estrategia de proxy/caché de tiles propia o un proveedor de tiles alternativo compatible con OSM; es una dependencia externa no resoluble ahora y queda fuera de alcance de v1 salvo que se confirme el problema en producción.
