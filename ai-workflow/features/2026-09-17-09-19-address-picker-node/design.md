# Design: Feature 2026-09-17-09-19 - address-picker-node

## Contexto
La spec (`spec.md`) fija el nodo de formulario `address-picker`: mapa interactivo + botón de geolocalización del navegador, que comparten un único disparo de geocodificación inversa centralizado en el mapa, y un campo de texto de dirección editable libremente. El valor efectivo del campo (`forms.{formId}.{fieldId}`) sigue siendo el texto de dirección; las coordenadas de la última posición fijada se exponen como dos referencias sintéticas nuevas `forms.{formId}.{fieldId}.$lat`/`.$lng`, en el mismo patrón que `item.$key`/`item.$index`/`row.$index`/`switch.next` (ver `reference-resolution.md`).

Este design resuelve cómo encaja eso en las capas existentes: hoy `forms.{formId}.{fieldId}` no admite navegación anidada (a diferencia de `queries.{queryName}.data`), el estado de formulario vive en un store plano `runtime-state/forms` con un valor por campo (no un registro con metadatos), y no existe ningún nodo del catálogo que combine mapa interactivo + campo de texto + una cuarta/quinta superficie de disparo de `queries.*` basada en coordenadas en vez de texto. `autocomplete` (`runtime-search-trigger.ts`) y `switch.next` (button variant switch) son los dos precedentes más cercanos, pero ninguno cubre exactamente este caso: `autocomplete` dispara por texto con debounce, `switch.next` es un valor efímero solo válido en el propio disparo del botón que lo declara, no un valor persistido consultable desde cualquier otra operación.

## Objetivos / No objetivos

### Objetivos
- Fijar el contrato de configuración y validación del nodo `address-picker`.
- Fijar dónde vive el estado de coordenadas del campo y cómo convive con el valor de texto ya existente en `runtime-state/forms`.
- Fijar el registro y la resolución de `$lat`/`$lng` como referencias sintéticas de `forms.*`, y su frontera de validación en bootstrap.
- Fijar el mecanismo de disparo unificado de la geocodificación inversa desde el mapa (click y botón convergen en el mismo evento).
- Fijar la integración con `navigator.geolocation` (primera vez que el proyecto usa esta API) y su tratamiento de error.
- Fijar la política de frescura ante clicks rápidos sucesivos.

### No objetivos
- No se diseña el proveedor real de geocodificación (Nominatim/Google/HERE): es configuración de backend, fuera de esta feature (ya fijado por la spec).
- No se diseña soporte en `dev-editor`: mismo criterio que tuvo `map` en su entrega inicial (fuera de alcance v1, ya fijado por la spec).
- No se diseña arrastre (drag) del marcador ni clustering/rutas: excluidos explícitamente por la spec.
- No se abre navegación anidada genérica bajo `forms.*`: `$lat`/`$lng` son formas sintéticas exactas, no un mecanismo general de segmentos (ver Decisión 3).
- `defaultValue` del campo solo siembra el texto de dirección, igual que cualquier campo de texto; no siembra `$lat`/`$lng` — no hay una forma declarativa de fijar una posición inicial en esta entrega.

## Decisiones

### 1. Contrato de configuración: nuevo nodo hoja de formulario `address-picker`
- **Elegido**: se añade `address-picker` a la unión discriminada por `type` del catálogo de nodos, restringido a descendientes de `form` con el mismo mecanismo ya usado por `input`/`select`/`autocomplete` (comprobación estructural en los walkers de `validate-form-semantics.ts`, entrando en `FORM_ONLY_LEAF_NODE_TYPES`). `props.fieldId` obligatorio y único dentro del `form`, mismo criterio que el resto de campos. `props.center`/`props.zoom`/`props.height` opcionales, mismo contrato y mismos defaults (Pamplona, zoom 13, `md`) que ya documenta `map.md`, para no introducir una segunda convención de mapa por defecto en el catálogo.
- **Por qué**: reutiliza el mecanismo de extensión de catálogo ya establecido (`architecture.md`: "Nuevo nodo declarativo: actualizar contrato en `src/config/`, implementar nodo en `src/runtime/nodes/`, conectarlo desde el dispatcher central") y el contrato de mapa ya cerrado por `map`, en vez de inventar una segunda convención de centro/zoom/altura.
- **Trade-off**: `address-picker` no reutiliza el componente `MapNode` tal cual (necesita marcador interactivo con `onClick`, sin `markerSources`/paleta multi-fuente, sin popup): se extrae la base común reutilizable (contenedor `MapContainer`+`TileLayer`+resolución de altura) a un módulo compartido en vez de duplicar el `import 'leaflet/dist/leaflet.css'` y el registro `eagerMap`/`lazyMap` en dos nodos distintos.
- **Riesgo residual**: ninguno relevante; es la extensión de catálogo más directa dado el precedente de `map`.

### 2. Estado de coordenadas: registro por-campo del dominio `forms` en `runtime-state`, no un dominio paralelo
- **Elegido**: el dominio `forms` de `runtime-state/` pasa de guardar "un valor por campo" a guardar, para campos que lo necesiten, "un valor más metadatos sintéticos opcionales" (`{ value, synthetic?: Record<string, unknown> }` o forma equivalente); el valor efectivo (`forms.{formId}.{fieldId}` bare) sigue siendo exactamente `value` para todo consumidor existente — cero cambio de forma para el resto del catálogo, que nunca declara `synthetic`. `address-picker` es el primer (y único, en esta entrega) consumidor que escribe `synthetic.lat`/`synthetic.lng` junto al texto.
- **Por qué**: `architecture.md` fija que "el estado compartido vive en `runtime-state/`... no duplicar dominios de estado paralelos". Guardar las coordenadas en un store local al componente las dejaría inalcanzables para `resolveRuntimeReference` en el momento de construir el request de *otra* operación (p. ej. el submit del formulario, que puede ejecutarse mucho después del último click) — a diferencia de `switch.next`, que solo necesita resolver en el instante del propio click y por eso le basta viajar como campo hermano efímero de `iterationContext` sin tocar el store compartido.
- **Trade-off**: es un cambio de forma interna del dominio `forms` (aunque aditivo y opt-in por campo), más amplio que lo que hizo `switch.next`. Cualquier código que hoy asuma "el valor de un campo de formulario es un escalar/array plano, nunca un contenedor con metadatos" debe auditarse (ver Riesgos).
- **Riesgo residual**: superficie de auditoría — confirmar en planificación que ningún consumidor existente de `runtime-state/forms` itera sus valores asumiendo esa forma plana (p. ej. serialización genérica del payload de submit, si la hay, debe seguir leyendo solo `value`).

### 3. Resolución de `$lat`/`$lng`: formas sintéticas exactas de `forms.*`, no navegación anidada general
- **Elegido**: `runtime-reference-syntax.ts` reconoce `forms.{formId}.{fieldId}.$lat` y `forms.{formId}.{fieldId}.$lng` como formas sintéticas exactas — mismo criterio que `item.$key`/`item.$index`/`row.$index` ("distinta de la navegación genérica", variantes con segmentos adicionales como `.$lat.extra` son rutas inválidas). `runtime-references/` las resuelve contra `synthetic.lat`/`synthetic.lng` del registro de campo (Decisión 2); sin valor fijado, degradan a dato ausente con la misma política que cualquier referencia bien formada sin dato disponible.
- **Por qué**: mantiene cerrada la frontera ya documentada ("la navegación anidada adicional solo se admite bajo `queries.{queryName}.data`/`.error`"); abrir segmentos arbitrarios bajo `forms.*` para resolver un caso de dos claves fijas sería una superficie de cambio mucho mayor y sin necesidad real.
- **Trade-off**: cada forma sintética nueva de `forms.*` exige tocar la lista cerrada de formas reconocidas; no escala a "N metadatos por campo" sin repetir el patrón, pero la spec solo pide dos.
- **Riesgo residual**: ninguno relevante para esta entrega (dos formas fijas).

### 4. Frontera de bootstrap de `$lat`/`$lng`: extensión de `validate-form-nodes.ts`, no un check ad hoc por nodo consumidor
- **Elegido**: la validación de que `forms.{formId}.{fieldId}.$lat`/`.$lng` solo es válida cuando `fieldId` referencia un nodo `address-picker` dentro de ese mismo `form` se resuelve en `validate-form-nodes.ts`, que ya indexa los campos de un `form` para comprobar unicidad de `fieldId` — reutiliza ese índice en vez de construir uno nuevo. Cualquier referencia a `$lat`/`$lng` sobre un `fieldId` que no exista o no sea `address-picker` se rechaza en bootstrap (`invalid-layout`), no se degrada en runtime.
- **Por qué**: a diferencia de `switch.next` (autocontenido: el propio `button` valida su propia acción, con "frontera de bootstrap propia en `validate-button-node.ts`"), `$lat`/`$lng` puede referenciarse desde *otro* nodo del mismo `form` (p. ej. `form.submitAction.body`), así que la validación necesita conocer el tipo del nodo que declaró ese `fieldId` en cualquier punto del árbol del formulario — información que ya calcula `validate-form-nodes.ts` para la regla de unicidad, y que un validador ad hoc en el nodo consumidor no tiene disponible sin duplicar ese recorrido.
- **Trade-off**: acopla la validación de una referencia (`runtime-reference-syntax`/`runtime-references`) al conocimiento de tipos de nodo de formulario (`validate-form-nodes`), una dependencia cruzada que hoy no existe entre esos dos módulos.
- **Riesgo residual**: **no verificado contra el código** — confirmar en planificación que `validate-form-nodes.ts` expone (o puede exponer sin refactor mayor) el índice `fieldId → tipo de nodo` que esta decisión asume. Si no existe en esa forma, es el punto de mayor incertidumbre técnica del design (ver Preguntas abiertas).

### 5. Disparo de geocodificación: módulo `runtime-*` dedicado, reactivo a la posición del marcador, no duplicado en dos handlers
- **Elegido**: un módulo `runtime-*` nuevo (mismo criterio que `runtime-search-trigger.ts` de `autocomplete`: fuera de `runtime-actions/` porque no traduce una acción declarada en el config, sino consecuencia de la interacción del propio nodo) expone una función que, dado `{lat, lng}`, ejecuta `executeQueryOperation` sobre la operación configurada. Tanto el `onClick` del mapa como el resultado de `navigator.geolocation` (Decisión 6) llaman al mismo punto de entrada — el botón nunca llama a `executeQueryOperation` por su cuenta, solo entrega coordenadas al mismo camino que ya usa el click.
- **Por qué**: es la quinta superficie de disparo de `queries.*` (junto a `preloads`, botón, submit y `autocomplete`), y sigue exactamente el precedente ya establecido de dónde vive código de disparo "por interacción de nodo, no por acción declarada".
- **Trade-off**: ninguno relevante — mismo patrón, nuevo dominio (coordenadas en vez de texto).
- **Riesgo residual**: ninguno relevante.

### 6. Geolocalización del navegador: hook dedicado, ajeno a `src/queries/`
- **Elegido**: un hook nuevo (p. ej. `useBrowserGeolocation`) encapsula `navigator.geolocation.getCurrentPosition`, con manejo explícito de los tres casos: éxito (coords), permiso denegado (`PERMISSION_DENIED`) y API no disponible (`navigator.geolocation` ausente) — estos dos últimos casos producen el mismo error inline en la UI, sin diferenciar mensaje (la spec no lo exige). No pasa por `src/queries/` porque no es una petición de red: es una API del navegador, fuera de la frontera "la red vive en `src/queries/`" (que aplica a `fetch`, no a APIs nativas del navegador).
- **Por qué**: primera vez que el proyecto integra esta API; aislarla en un hook propio evita mezclar su manejo de error (basado en callbacks/promesa nativa, con códigos de error propios `PERMISSION_DENIED`/`POSITION_UNAVAILABLE`/`TIMEOUT`) con el modelo de error tipado ya existente de `queries.*` (`network-error`/`http-error`/etc.), que no aplica aquí.
- **Trade-off**: el error de geolocalización no se expone como `queries.{queryName}.error` ni sigue su shape (`message`/`code` tipado); es un estado de error local al nodo, distinto en forma del resto del catálogo de errores de queries. Se documenta explícitamente para que no se confunda con un error de operación `api`.
- **Riesgo residual**: ninguno relevante — el "no soportado" (dispositivo/navegador sin `navigator.geolocation`, o contexto no seguro fuera de `https`) se trata igual que un permiso denegado a efectos de UI, sin distinguir causa.

### 7. Frescura ante clicks rápidos: comparación local de `requestSignature`, sin mecanismo nuevo en `src/queries/`
- **Elegido**: el nodo recuerda localmente la `requestSignature` de su última geocodificación disparada y solo aplica el resultado (`queries.{queryName}.data`) al campo de texto si coincide con la vigente en el momento de resolver — mismo patrón exacto que ya usa `autocomplete` para el mismo problema (varias instancias, o varios disparos sucesivos, sobre el mismo `queryName`).
- **Por qué**: es el precedente más directo y ya validado en el catálogo; evita introducir un mecanismo de cancelación/descarte genérico en `src/queries/` que ningún otro consumidor necesita hoy.
- **Trade-off**: mismo límite de producto ya aceptado por `autocomplete` — si dos instancias de `address-picker` compartieran `queryName` (p. ej. dentro de un `repeater`), no buscarían de forma verdaderamente independiente y simultánea. Se documenta igual que en `autocomplete.md`.
- **Riesgo residual**: ninguno relevante.

## Riesgos y trade-offs
- La Decisión 2 (estado de campo con metadatos opcionales) es la de mayor superficie de cambio: toca la forma interna de `runtime-state/forms`, hoy asumida plana en todo el resto del catálogo. Mitigación: es aditiva y opt-in por campo (ningún consumidor existente declara `synthetic`), y el valor bare (`forms.{formId}.{fieldId}`) no cambia de forma para nadie.
- La Decisión 4 (validación cruzada `fieldId → tipo de nodo` en `validate-form-nodes.ts`) es el punto técnico menos verificado del design — depende de una estructura de índice que no se ha confirmado contra el código (ver Preguntas abiertas).
- La Decisión 6 introduce el primer error de UI del catálogo que no sigue el shape tipado de `queries.*.error`; documentarlo explícitamente evita que se traten como equivalentes en implementación o en tests.

## Migración o despliegue
- Cambio puramente aditivo: `address-picker` es un tipo de nodo nuevo, `$lat`/`$lng` son formas de referencia nuevas, y el campo `synthetic` del registro de `forms` es opcional — ningún config ni comportamiento existente cambia de forma.
- No hay estado persistido entre sesiones que migrar (`context.md`: el estado de formularios es local al runtime).
- No hay flags de despliegue ni cambio de contrato observable en producción fuera de las superficies nuevas descritas.

## Preguntas abiertas
- **Forma real del índice `fieldId → tipo de nodo` en `validate-form-nodes.ts`** (Decisión 4): no verificado contra el código. Antes de planificar el detalle de esa validación cruzada, confirmar si el módulo ya expone (o puede exponer sin refactor mayor) esa información, o si hace falta construirla de cero.
- **Nombre definitivo del nodo**: la spec deja `address-picker` como nombre de trabajo. Se mantiene en este design salvo que el usuario indique lo contrario antes de planificar.
- **Superficies exactas donde se habilitan `$lat`/`$lng` más allá de la operación de geocodificación**: la spec pide "como mínimo, `body`/`query` de la operación de geocodificación" y deja a diseño si se habilitan en otras superficies. Este design las habilita en las mismas superficies donde hoy es válida una referencia completa `forms.*` en payloads (`api.query`/`body`, `button.props.action.query`/`body`, `form.submitAction.query`/`body`) y las excluye explícitamente de superficies visibles/interpolables y de `visibility.reference` (las coordenadas no son un dato pensado para mostrarse ni para condicionar visibilidad en esta entrega); confirmar que esta acotación es la esperada antes de planificar.
