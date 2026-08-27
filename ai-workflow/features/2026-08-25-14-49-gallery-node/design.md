# Design: Feature 2026-08-25-14-49 - gallery-node

## Contexto
`gallery` es un nodo hoja nuevo del catálogo (`src/runtime/nodes/`), sin `children`, que debe convivir con las fronteras ya vigentes en `architecture.md`: validación previa al render en `src/config/`, resolución de colecciones dinámicas centralizada en `runtime-collection-sources.ts`, sintaxis de referencias en `runtime-reference-syntax.ts`, red exclusivamente en `src/queries/` (para el modo `fetch` de `image`, ya delegada en el propio nodo `image` vía el mismo mecanismo que reutilizará `gallery`), y estilos con Tailwind sin API visual paralela.

El proyecto ya resuelve tres problemas estructuralmente idénticos a los que necesita `gallery`, y este design se apoya en reutilizarlos en vez de reimplementarlos:
- **Fuente dinámica unificada `queries.*` / `item.*`**: ya existe en `select.props.items` (shape `{ source, itemType, label?, value? }`) y se resuelve con `resolveCollectionSourceItems` (`src/runtime/runtime-collection-sources.ts`), compartida hoy por `list`, `select`, `radioGroup`, `checkboxGroup` y `map` (`markerSources`).
- **Paginación local**: ya está extraída como módulo neutro (`src/runtime/runtime-collection-pagination.ts`, genérico `<T>`) y su UI (`src/runtime/nodes/collection-pagination-controls.tsx`, sin acoplamiento a `repeater`/`table`), consumidos hoy por `repeater`, `table` y `file-manager`.
- **Carga diferida de una dependencia externa pesada**: ya resuelto para `Leaflet` en `map` (`map.md#Code-splitting-y-peso-de-bundle`): import estático solo en `eagerMap` (modo test) e import diferido `React.lazy` en `lazyMap`, registrado en `src/runtime/nodes/node-components-map.ts`.

Nada de lo anterior requiere leer más código fuente para fijar el contrato de `gallery`; las decisiones de abajo se apoyan en el contrato ya documentado de `image` (modos `src`/`fetch`), `repeater` (`items.key`, paginación) y `select` (shape dinámico unificado).

## Objetivos / No objetivos

### Objetivos
- Fijar el contrato exacto de `props` del nodo `gallery` (origen estático/dinámico, modo de carga por foto, modo de visualización) para que `generate-implementation-plan` pueda trocear tareas sin reabrir shape.
- Decidir qué módulos existentes se reutilizan tal cual (sin modificarlos) y cuáles son nuevos.
- Elegir la librería de carrusel y su estrategia de carga.
- Cerrar los 5 riesgos/preguntas abiertas listados en `spec.md`.

### No objetivos
- No se diseña el panel de propiedades del editor visual (fuera de alcance de la spec).
- No se diseña ningún mecanismo nuevo de límite de concurrencia de red a nivel de `src/queries/` (ver Decisión D11).
- No se reabre ningún criterio de aceptación de `spec.md`.

## Decisiones

### D1. Contrato de `props`
Dos bloques mutuamente excluyentes para el origen, más un bloque obligatorio de visualización:

```ts
props: {
  // Origen estático — exactamente uno de `images` / `source` debe declararse
  images?: Array<{ src: string; alt: string }>  // misma semántica que image.props.src/alt

  // Origen dinámico
  source?: {
    source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*'  // mismo patrón que select dinámico
    key: string          // mismo contrato que repeater.props.items.key ("$key" | "$index" | ruta relativa)
    alt: string           // ruta relativa al item o interpolación {{...}}
    mode: 'src' | 'fetch' // exactamente uno de `src` / `fetch` más abajo, según este discriminador
    src?: string           // requerido si mode: 'src'; ruta relativa/interpolación por item (misma semántica que image.props.src, resuelta con item.* como contexto)
    idField?: string       // solo válido si mode: 'fetch' (rechazado si mode: 'src'); ruta relativa al item (mismo validador que `alt`/`src`) que indica en qué propiedad está el id cuando cada elemento es un objeto (FR7). Si se omite, cada elemento se trata como id primitivo directo.
    fetch?: {              // requerido si mode: 'fetch'; mismo contrato que image.props.fetch, resuelto por item
      url: string
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      headers?: Record<string, string>
      body?: JsonTree
    }
  }

  display:
    | { mode: 'paginated'; pagination: { pageSize: number; controls?: { variant?: 'previousNext' | 'numbered' | 'scroll' } } }
    | { mode: 'carousel'; visibleCount: number /* 1-3 */; autoplay?: { enabled: true; intervalMs: number }; loop?: boolean }
}
```

- Por qué: cada campo reutiliza literalmente un contrato ya validado y documentado (`image.src`/`alt`, `repeater.items.key`, `select` dinámico, `repeater.pagination`), en vez de inventar nomenclatura nueva — reduce superficie de revisión y reutiliza tests de referencia como precedente de casos límite.
- Alternativa descartada: aplanar `source`/`mode`/`src`/`fetch` directamente bajo `props` (sin el wrapper `source`). Se descarta porque rompería la exclusión mutua estática/dinámica de forma menos explícita (más difícil de validar "declara ambos o ninguno" con campos sueltos) y no sigue el patrón ya establecido por `repeater.props.items` y `map.props.markerSources`.
- Coste asumido: el nodo tiene más anidamiento que `image`, pero es el mismo nivel de anidamiento que `repeater`/`select` dinámico, ya familiar en el catálogo.
- Riesgo residual: ninguno; el shape es 1:1 con los requisitos funcionales 1-12 de `spec.md`.

### D2. Resolución de la colección dinámica
`gallery.props.source.source` se resuelve con `resolveCollectionSourceItems` (`runtime-collection-sources.ts`) sin modificarlo, exactamente igual que hoy hace `select` con su shape dinámico unificado (`queries.*` / `item.*`).

- Por qué: es la única función ya compartida entre 5 consumidores para este patrón exacto de origen; añadir `gallery` como sexto consumidor no requiere cambios en la función.
- Alternativa descartada: resolver `item.*` de forma ad-hoc dentro del propio nodo `gallery` (como hacía el `select` legacy antes de unificarse). Se descarta explícitamente: `architecture.md` prohíbe parsers locales de referencias fuera de `runtime-references/`/`runtime-collection-sources.ts`.
- Riesgo residual: ninguno.

### D3. Resolución de la key de iteración
`gallery.props.source.key` reutiliza el mismo contrato textual que `repeater.props.items.key` (ruta relativa, `"$key"`, `"$index"`), pero la lógica de resolución de `repeater` no está hoy extraída como helper compartido (vive acoplada a la expansión estructural del propio `repeater`).

- Decisión: implementar la resolución de key para `gallery` como una función propia y pequeña que replica el contrato ya documentado (no la lógica interna de `repeater`), sin acoplarse al módulo de `repeater`.
- Por qué: `gallery` no expande subárbol (no hay wrapper estructural que reutilizar) — solo necesita una key de iteración para React y para la detección de duplicados/omisión, un problema mucho más pequeño que el de `repeater`.
- Trade-off asumido: hay una pequeña duplicación de contrato (mismo comportamiento para `$key`/`$index`/ruta relativa) entre `repeater` y `gallery`. Si en el futuro aparece un tercer consumidor del mismo contrato, se debe extraer a un helper compartido; no se hace ahora para no tocar `repeater` fuera del alcance de esta feature.
- Riesgo residual: bajo — divergencia futura si el contrato de `$key`/`$index` cambia en un sitio y no en el otro. Mitigación: los tests de `gallery` deben citar explícitamente el contrato de `repeater.md` como fuente de verdad compartida.

### D4. Resolución por item del modo `src`/`fetch`
Para origen dinámico, cada foto se resuelve por item usando el propio item como `iterationContext`, mismo mecanismo que ya usa `resolveMapMarkerSourceItems` para resolver `label` por item con interpolación, y que ya soporta `item.*` como "proyección local de un item de colección" (`reference-resolution.md#Frontera-específica-de-item`, ya vigente, sin necesidad de ampliar esa frontera).

- Modo `src`: se resuelve `props.source.src` como ruta relativa/interpolación contra el item; solo produce imagen si resuelve a string no vacío (mismo criterio que `image.props.src`); si no, el elemento se omite en silencio (FR16).
- Modo `fetch`: se resuelve `props.source.fetch.{url,headers,body}` con la misma semántica de referencias que `image.props.fetch`, pero con el item como contexto adicional disponible (además de `queries.*`/`forms.*`/`params.*`); cada elemento dispara su propia petición independiente, reutilizando el mismo mecanismo de `fetch` binario → `blob:` URL → revocación al desmontar que ya implementa `image`.
- Resolución del id por elemento (FR7, cierra el caso límite "propiedad de id declarada no resuelve a un valor utilizable"): antes de disparar la petición de cada elemento se calcula un id de control — si `source.idField` está declarado, `id = item[idField]` (misma resolución de ruta relativa que `alt`/`src`); si no está declarado, `id` es el propio `item`. Si ese id no resuelve a un `string`/`number` no vacío, el elemento se omite en silencio sin disparar `fetch`, con el mismo criterio de degradación silenciosa que FR16/FR19/FR20.
- Este id de control **no** se expone como un nombre de referencia nuevo (p. ej. `{{id}}`): la interpolación de `fetch.url`/`headers`/`body` sigue usando exclusivamente `item.*` como contexto, igual que hoy. Si el config necesita ese valor dentro de la URL, lo referencia directamente como `item.<idField>` (o interpolado `{{item...}}`), sin sintaxis nueva. Se decide así explícitamente para no ampliar el mecanismo de referencias fuera de `runtime-references/`/`runtime-collection-sources.ts` (coherente con D2); `idField` solo gobierna la validez del elemento antes de llamar a la API, no añade una prefijo de referencia nuevo.
- Por qué: no se reinventa resolución de referencias ni lógica de fetch binaria; se reutiliza tal cual el contrato ya probado de `image`, y el nuevo campo `idField` es puramente un gate de validez por elemento, sin tocar el resolver de referencias compartido.
- Riesgo residual: `gallery` es el primer consumidor de `fetch` binario resuelto per-item fuera del propio nodo `image` (dentro de un `repeater`, cada instancia de `image` ya lo hace, pero aquí es un único nodo `gallery` quien orquesta N peticiones). Ver D11 para el trade-off de cuándo se montan esas peticiones.

### D5. Ubicación de la validación previa al render
La validación de `gallery` vive en `src/config/`, como una unidad dedicada dentro del dominio de `validate-layout-nodes` (mismo nivel que la validación específica que ya existe para `repeater`/`map`/`select` en ese dominio), reutilizando:
- el validador compartido de patrón de fuente de colección (`queries.*` / `item.*`) ya usado por `select`/`map`.
- el validador de `pagination` ya usado por `repeater`/`table` (mismo shape cerrado `enabled`/`pageSize`/`controls.variant`, sin claves extra).

Lo único genuinamente nuevo a validar es: exclusión mutua `images`/`source`, exclusión mutua `mode: 'src'`/`mode: 'fetch'` dentro de `source`, exclusión mutua `display.mode: 'paginated'`/`'carousel'`, el rango `1-3` de `visibleCount`, y `idField` (rechazado si `mode: 'src'`; cuando `mode: 'fetch'` y se declara, debe ser una ruta de proyección relativa válida — reutiliza el mismo validador ya usado para `alt`/`src`, sin validador nuevo).

- Por qué: minimiza código de validación nuevo a solo las reglas genuinamente específicas de `gallery`.
- Riesgo residual: ninguno; los diagnósticos (`invalid-layout` + ruta exacta) siguen el mismo patrón que el resto del catálogo.

### D6. Modelo de paginación
El modo `paginated` reutiliza **sin modificar**:
- `createCollectionPaginationModel<T>` / `createNumberedPaginationWindow` / `createCollectionScrollWindow<T>` (`runtime-collection-pagination.ts`), genéricos y sin acoplamiento a `repeater`/`table`.
- `CollectionPaginationControls` (`collection-pagination-controls.tsx`), cuya interfaz ya es agnóstica del tipo de item.

`T` en este caso es el descriptor resuelto de imagen (`{ key, alt, src }` o `{ key, alt, fetch }`, ya con `src`/`fetch` resueltos, no crudos).

- Por qué: es exactamente el mismo modelo que pide `spec.md` ("reutilizando el mismo modelo ya soportado por repeater/table"), y ya está extraído como módulo neutro — no hay adaptación necesaria, solo consumo.
- Riesgo residual: ninguno.

### D7. Librería de carrusel
**Elegida: `embla-carousel-react` + plugin oficial `embla-carousel-autoplay`.**

- Es *headless* (no impone markup ni CSS propio): la mecánica de swipe/drag/loop la resuelve la librería, pero el markup de slides, flechas y dots se implementa con JSX + Tailwind del propio proyecto, igual que el resto del catálogo (`conventions.md`: "los componentes visuales del runtime deben expresar su presentación con `className` y utilidades de Tailwind"). Esto encaja mejor que `Swiper`, que exige importar su propio CSS (`swiper/css`, patrón similar al de `leaflet.css` que sí se aceptó para `map`, pero innecesario aquí porque `embla` no lo requiere).
- Es gratuita, MIT, sin cuenta ni licencia, y muy extendida (referencia de ecosistema: es la librería de carrusel que usa el propio componente `Carousel` de `shadcn/ui`, uno de los sistemas de componentes React más usados).
- Soporta nativamente `loop`, navegación programática (para las flechas propias) y un plugin oficial de autoplay con intervalo configurable — cubre FR9, FR10, FR11, FR12 sin código propio de mecánica de carrusel.
- Alternativas descartadas:
  - **`react-slick`**: depende de jQuery-free pero su API es más antigua, exige CSS propio (`slick.css`/`slick-theme.css`) y su mantenimiento es más lento que `embla`.
  - **`swiper`/`swiper/react`**: muy completo pero más pesado y con su propia capa de estilos, lo que empujaría a estilos no-Tailwind o a overrides frágiles.
  - **`keen-slider`**: viable y también headless, pero con adopción y ecosistema de ejemplos menor que `embla` para React.
- Coste asumido: nueva dependencia de bundle (~6-10kB core + autoplay plugin, gzip). Ver D8 para cómo se acota.
- Riesgo residual: bajo. `embla-carousel-react` es una librería activa y estable; si se necesitara alguna vez zoom/gestos avanzados (explícitamente fuera de alcance v1), habría que revisar si sigue siendo la elección correcta en una feature futura.

### D8. Estrategia de code-splitting (dos niveles)
1. **Nivel nodo** (igual que todos los nodos): `gallery` se registra en `node-components-map.ts` con el mismo patrón dual `eagerMap`/`lazyMap` que el resto del catálogo — su propio chunk, descargado solo si una página usa `gallery`.
2. **Nivel sub-componente** (nuevo respecto al patrón de `map`): dentro del propio módulo de `gallery`, la vista de carrusel (que es la única que importa `embla-carousel-react`/`embla-carousel-autoplay`) se carga con un `React.lazy` adicional, separado de la vista paginada/grid. Como `display.mode` es una propiedad estática del config (conocida antes del render, no cambia en runtime), una instancia de `gallery` en modo `paginated` nunca descarga el bundle de `embla`.

- Por qué: a diferencia de `Leaflet` en `map` (donde todo uso de `map` necesita el mapa), aquí el modo `paginated` de `gallery` no necesita el carrusel en absoluto — sería peso muerto si se empaquetara junto al resto del nodo.
- Trade-off asumido: un nivel más de `Suspense`/`React.lazy` que `map`, ligeramente más complejo que el patrón de un único nodo lazy. Se acepta porque el coste real de peso muerto (embla completo cuando no hace falta) es mayor que el coste de complejidad de un segundo `React.lazy` interno.
- Verificación: a diferencia del test de bundle de `map` (`runtime-nodes-bundle.test.ts`, que verifica el *bundle inicial*), este split interno afecta la composición del *chunk propio de `gallery`*, no el entrypoint. La cobertura de este split se deja como criterio de implementación (verificar manualmente el chunk generado por `vite build`), no como un nuevo test de bundle — no se considera necesario un test dedicado nuevo solo para esto.
- Riesgo residual: bajo. Si en el futuro se detecta que Rollup no separa correctamente el chunk (por ejemplo por falta de `sideEffects: false` en `embla-carousel-react`, a diferencia de `leaflet`), se resolvería igual que con `map`: marcando el paquete explícitamente libre de efectos secundarios en `vite.config.ts`. Es un ajuste de configuración menor si aparece, no un cambio de diseño.

### D9. `visibleCount` mayor que imágenes disponibles
Cuando el número de imágenes resueltas es menor o igual que `visibleCount`, el carrusel renderiza únicamente las imágenes disponibles, sin relleno artificial ni recentrado, y los controles de navegación se renderizan deshabilitados (mismo criterio que "una única imagen en modo carrusel", ya cubierto por spec.md como caso límite explícito).

- Por qué: es el comportamiento nativo de `embla-carousel-react` cuando el número de slides es menor que el "viewport" configurado (no requiere lógica adicional); mantiene consistencia con el caso de una sola imagen ya descrito en la spec.
- Riesgo residual: ninguno.

### D10. Lightbox
Componente propio dentro del módulo de `gallery` (no reutiliza el nodo `modal`).

- Por qué no reutilizar `modal`: `modal` es un nodo de primer nivel con su propio dominio de estado (`openModal`/`closeModal` por `id`, `defaultOpen`, comportamiento especial dentro de `repeater.props.template`) — acoplar el lightbox de `gallery` a ese dominio introduciría una dependencia cruzada entre nodos que no existe hoy en el catálogo (ningún nodo hoy renderiza otro nodo del catálogo internamente) y complicaría el caso de `gallery` dentro de un `repeater` (cada iteración ya necesita su propio lightbox aislado, sin pasar por el registro global de modales por `id`).
- Comportamiento: overlay + panel centrado con la imagen activa, replicando el patrón visual ya establecido por `modal` (overlay semitransparente, cierre por botón explícito, clic fuera del panel, tecla Esc) pero como implementación local, no como instancia de `modal`.
- **Explícitamente fuera de alcance v1** (no silencioso): atrapamiento de foco dentro del lightbox y navegación por flechas de teclado entre imágenes. El NFR de `spec.md` solo exige accesibilidad por teclado "como mínimo" para el cierre (Esc); no se añade foco atrapado ni navegación por flechas porque no está pedido y añadiría superficie de comportamiento no cubierta por criterios de aceptación. Si se quiere en el futuro, es una mejora de accesibilidad incremental sin impacto en el contrato de `props`.
- Riesgo residual: bajo — usuarios de solo-teclado pueden cerrar el lightbox (Esc) pero no navegar entre fotos sin ratón/touch dentro de él; queda documentado como límite conocido de v1, no como omisión accidental.

### D11. Estrategia de fetch en modo `fetch` (sin límite de concurrencia nuevo)
El lightbox reutiliza la **misma unidad de resolución por-item** (componente interno que resuelve `src` o dispara el `fetch` binario) que ya usan las tiles visibles del grid/carrusel — no una unidad distinta.

- Consecuencia: al abrir el lightbox sobre una imagen que ya está montada como tile (visible en la página/carrusel actual), no se dispara ninguna petición nueva — se reutiliza el resultado ya resuelto. Al navegar dentro del lightbox hacia una imagen que **no** está montada como tile (por ejemplo, de otra página del modo paginado, o fuera de la ventana visible del carrusel), se monta una instancia nueva de esa misma unidad de resolución solo para esa imagen, con el mismo ciclo de vida que `image.props.fetch` (dispara al montar, revoca el `blob:` al desmontar).
- Por qué: en cualquier momento dado, el número de peticiones `fetch` en curso está acotado por "tiles actualmente renderizadas + como máximo una imagen de lightbox", nunca por el tamaño total de la colección — sin necesidad de introducir ninguna cola, límite de concurrencia o capa nueva en `src/queries/`.
- Alternativa descartada: pre-resolver (prefetch) todas las imágenes de la colección al montar `gallery`, para que el lightbox pueda navegar instantáneamente sin nuevas peticiones. Se descarta porque para colecciones grandes en modo `fetch` dispararía N peticiones simultáneas sin límite (justo el riesgo que `spec.md` señala como pendiente), y porque el caso límite de `spec.md` ya acepta que "cada elemento dispara su propia petición independiente" sin exigir que estén todas listas de antemano.
- Trade-off asumido: navegar en el lightbox a una imagen aún no resuelta en modo `fetch` muestra un estado intermedio (sin imagen, igual que la degradación ya documentada en `image` mientras la petición está en curso) hasta que la petición de esa imagen concreta resuelve.
- Riesgo residual: bajo, y es el mismo riesgo ya aceptado hoy por `image.props.fetch` en cualquier otro contexto del catálogo.

### D12. Reset de posición al cambiar la colección
Cuando la colección resuelta cambia (refetch de query, cambio de `item` en un `repeater`), tanto la página activa (modo paginado) como el índice activo del carrusel (modo carrusel) vuelven a su estado inicial — mismo criterio que ya aplica `repeater` paginado (caso límite ya cerrado en `spec.md`).

- Por qué: consistencia de comportamiento con `repeater`, sin necesidad de una regla nueva.
- Riesgo residual: ninguno.

## Riesgos y trade-offs
- **Peso de bundle de `embla-carousel-react` + plugin autoplay**: mitigado por el doble code-splitting de D8; residual solo si Rollup no separa correctamente el chunk (mitigable igual que se hizo con `leaflet` en `vite.config.ts`, ver D8).
- **Primer consumidor de `fetch` binario per-item orquestado por un único nodo (no por N instancias de `image` bajo `repeater`)**: el patrón es el mismo, pero es la primera vez que un solo nodo dispara y gestiona el ciclo de vida de N peticiones binarias propias. Mitigado por D11 (nunca más peticiones simultáneas que tiles visibles + lightbox).
- **Duplicación pequeña del contrato de key** (`$key`/`$index`/ruta relativa) entre `repeater` y `gallery` (D3): riesgo bajo de divergencia futura, mitigado documentalmente citando `repeater.md` como fuente de verdad.
- **Cobertura de tests al 80% con una feature que añade una dependencia externa de UI (carrusel)**: el propio código de `gallery` (validación, resolución, render de grid/paginación/lightbox) es 100% testeable sin mockear `embla` de forma especial; el uso de `embla` en sí debería testearse con la misma estrategia ya usada para `Leaflet`/`react-leaflet` en los tests de `map` (mocks de la librería para tests unitarios, sin depender de su comportamiento real de drag/swipe).

## Migración o despliegue
No aplica migración de datos ni cambio de contrato existente: `gallery` es un nodo nuevo, aditivo, sin impacto en configuraciones ya desplegadas. Único paso operativo: añadir `embla-carousel-react` y `embla-carousel-autoplay` a `package.json` (dependencias de producción, no de desarrollo, porque se usan en el bundle final).

## Preguntas abiertas
Ninguna pregunta técnica bloqueante para planificación. Los 5 riesgos/preguntas abiertas de `spec.md` quedan resueltos en D1 (contrato, incluido `idField`), D7 (librería), D10 (accesibilidad de teclado, con límite v1 explícito), D9 (visibleCount > disponibles) y D11 (concurrencia de `fetch`).

Puntos a vigilar durante implementación, no bloqueantes:
- Confirmar el peso real (gzip) de `embla-carousel-react` + `embla-carousel-autoplay` una vez integrados, para decidir si el NFR de "peso significativo" de `spec.md` se considera cumplido solo con el split de D8 o si hace falta ajuste adicional — se resuelve con datos reales de build, no con una decisión de diseño pendiente.
- **`idField` (D1/D4) es una actualización de este design posterior al cierre de `tasks.md` y a la implementación ya completada de las tareas T1-T7** (`status.yaml` las marca `completed`, con `feature_status: implemented`). Ni el schema (`runtime-config-zod.ts`/`runtime-config-types.ts`), ni la validación (`validate-gallery-node.ts`), ni la resolución (`runtime-gallery-photos.ts`) contienen hoy `idField`. Este design ya no describe el estado actual del código para el submodo `fetch` con elementos-objeto; hace falta una tarea de implementación adicional (schema + validación + resolución + tests) antes de considerar cerrado FR7, y revisar si `status.yaml`/`feature_status` deben volver a un estado no terminal mientras tanto.
