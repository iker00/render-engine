> Cuándo leer: estructura de `repeater`, `props.items.source`, `props.items.key`, `props.template`, iteración sobre array y objeto plano, paginación local con variantes `previousNext`/`numbered`/`scroll`, modo grid propio (`props.columns`/`gap`/`align`/`justify`), comportamiento dentro de `pageEntry`.
> Tamaño: medio.
> Relacionados: [[../queries/state-model.md]], [[../references/reference-resolution.md]], [[../references/collection-pipeline.md]], [[container.md]].

# `repeater`

## Contrato (`props`)
- `props.items.source`: obligatorio y limitado a `queries.{queryName}.data` o `queries.{queryName}.data.*`, opcionalmente seguido de un pipeline declarativo (ver [[../references/collection-pipeline.md]]) para filtrar, ordenar o recortar la colección sin backend.
- `props.items.key`: obligatorio; ruta relativa no vacía al item actual (por ejemplo `id` o `meta.slug`), el literal reservado `"$key"` para usar la clave del diccionario cuando la fuente es objeto plano, o el literal reservado `"$index"` para usar el índice numérico de iteración (0, 1, 2…) como React key.
- `props.pagination`: opcional; cuando existe activa paginación local en cliente con el shape cerrado de v1.
- `props.pagination.enabled`: obligatorio y exactamente `true`.
- `props.pagination.pageSize`: obligatorio, entero, finito y mayor o igual que `1`.
- `props.pagination.controls`: opcional; si se omite, el runtime usa el default efectivo de controles anterior/siguiente.
- `props.pagination.controls.variant`: opcional y limitado a `previousNext | numbered | scroll`.
- `props.columns`: opcional; entero entre `1` y `12`, o mapa responsive cerrado por breakpoint `base | sm | md | lg | xl | 2xl` con valores enteros entre `1` y `12` — mismo shape que `container.props.columns`. Su presencia activa el modo grid del `repeater` (ver [[#Modo grid]]).
- `props.gap`: opcional; misma escala estable `sm | md | lg | xl | 2xl` que `container.props.gap`, con la misma compatibilidad heredada para valor CSS string arbitrario. Solo tiene efecto en modo grid.
- `props.align`: opcional, con el mismo catálogo cerrado `start | center | end | stretch` que `container.props.align`. Solo tiene efecto en modo grid.
- `props.justify`: opcional, con el mismo catálogo cerrado `start | center | end | between | around | evenly` que `container.props.justify`. Solo tiene efecto en modo grid.
- `props.template`: colección ordenada obligatoria de `LayoutNode[]`.
- no admite `children`.

## Detección del shape de la fuente
El repeater detecta automáticamente si la fuente resuelta es array u objeto plano:
- **Array**: comportamiento actual sin cambios. `item.*` navega dentro de cada elemento del array.
- **Objeto plano** (no array, no `null`): itera las entradas propias y enumerables del objeto en el orden natural de inserción, equivalente a `Object.keys`. Dentro del subárbol, `item.*` navega dentro del valor de la entrada y `item.$key` expone la clave del diccionario como string.
- **Cualquier otro valor** (`null`, `undefined`, número, string, `{}`): cero iteraciones de forma silenciosa, sin diagnóstico específico.

## Reglas de render
- `repeater.props.items.source` solo admite `queries.{queryName}.data` o `queries.{queryName}.data.*`, opcionalmente con pipeline declarativo.
- Cuando se declara un pipeline, se aplica sobre la fuente resuelta como colección array (no se aplica a iteración por objeto plano). El resultado es siempre un array que sustituye a la rama "Array" de detección de shape.
- `repeater.props.items.key` exige una ruta relativa no vacía al item actual, o los literales reservados `"$key"` y `"$index"`.
- `repeater.props.pagination` puede activar paginación local en cliente con variantes cerradas de controles.
- `repeater.props.template` reutiliza una colección `LayoutNode[]` sin `children`.
- `repeater` sin `props.columns` no introduce markup propio: expande su `template` como hermanos por iteración y omite cualquier item cuya key efectiva sea ausente, no escalar o duplicada, con diagnóstico en desarrollo.
- `repeater` con `props.columns` envuelve las iteraciones visibles en un wrapper de grid propio; ver [[#Modo grid]] para su contrato completo.
- `repeater` paginado aplica la paginación después de filtrar las iteraciones renderizables por key válida y única, mantiene `item.*` apuntando al item original visible y conserva estado local e independiente por instancia.
- La página activa o cantidad visible de un `repeater` paginado vuelve a la posición inicial cuando cambia la colección resuelta (incluyendo cambio de shape array/objeto), `pageSize` o la variante de controles; navegar o avanzar localmente no modifica `queries.*`, `pageEntry`, formularios, navegación ni dispara red.
- Un refresco de la colección resuelta reconcilia por fila en vez de remontar el subárbol completo del `repeater`: React solo añade, quita o reordena iteraciones según su key efectiva. El reseteo de paginación descrito arriba sigue siendo observable (vuelve a la posición inicial), pero se aplica ajustando el estado interno del `repeater`, no desmontando y remontando el componente. Como consecuencia, el estado local de una fila no afectada por el refresco —por ejemplo un `modal` abierto dentro de `props.template`— se preserva: el nodo DOM del modal es el mismo antes y después del refresco, y su contenido interpolado (`item.*`) refleja los datos actualizados de esa fila.

## Literal reservado `"$key"` en `props.items.key`
- Cuando `props.items.key` es `"$key"` y la fuente resuelta es **objeto plano**, la clave del diccionario se usa directamente como React key por cada entrada. La duplicidad es imposible en un objeto plano, pero cualquier clave no escalar se omite con el diagnóstico actual.
- Cuando `props.items.key` es `"$key"` y la fuente resuelta es **array**, no existe clave de diccionario disponible: todas las iteraciones se omiten y se emite el diagnóstico actual de key no válida en desarrollo.
- Cuando `props.items.key` es una ruta relativa convencional (por ejemplo `id`) y la fuente es objeto plano, la ruta se navega dentro del valor de cada entrada exactamente como hoy se navega dentro de cada item de array.

## Literal reservado `"$index"` en `props.items.key`
- Cuando `props.items.key` es `"$index"` y la fuente resuelta es **array**, cada elemento recibe como React key su índice numérico dentro del array (0, 1, 2…).
- Cuando `props.items.key` es `"$index"` y la fuente resuelta es **objeto plano**, cada entrada recibe como React key su posición ordinal dentro del orden natural de iteración del objeto (0, 1, 2…).
- No se aplica detección de duplicados cuando `key` es `"$index"`, dado que los índices son inherentemente únicos dentro de una colección.
- Entradas cuyo valor es `null`, `undefined` o un primitivo se iteran normalmente cuando `key` es `"$index"`; el índice sigue siendo válido independientemente del contenido del elemento.
- Desbloquea la iteración de arrays de valores primitivos (strings, números) que no pueden recorrerse con rutas relativas convencionales porque no existe forma de extraer una key única de cada elemento.

## Propiedad sintética `item.$index`
- `item.$index` es una referencia sintética disponible dentro del subárbol iterado de cualquier `repeater`, con independencia del valor de `props.items.key`.
- Expone el índice numérico (0, 1, 2…) de la iteración actual como número.
- Funciona tanto con fuentes array como con fuentes objeto plano.
- `item.$index` tiene precedencia sobre cualquier propiedad literal `$index` que pudiera existir dentro del valor del item, de forma análoga a la precedencia de `item.$key` sobre propiedades literales `$key`.
- En un `repeater` paginado, `item.$index` expone la posición dentro de la colección completa, no la posición relativa dentro de la página visible.
- Las superficies donde `item.$index` es utilizable son las mismas donde hoy es utilizable `item.$key` e `item.*`.
- `item.$index` fuera del subárbol de un `repeater` no forma parte del contrato soportado y degrada a string vacío en superficies textuales, igual que `item.*` fuera de un `repeater`.

## Modo grid
- `props.columns` presente activa el modo grid: las iteraciones visibles del `repeater` se envuelven en un único contenedor con clases de grid (`grid-cols-{n}` fijo o por breakpoint responsive), igual mecanismo que `container.props.columns` (ver [[container.md]]). `props.columns` ausente conserva el comportamiento actual: el `repeater` no introduce markup propio.
- El grid envuelve exactamente las iteraciones actualmente visibles: después de excluir items con key ausente, no escalar o duplicada, y después de aplicar la ventana de paginación local vigente (página activa en `previousNext`/`numbered`, ventana acumulada en `scroll`) cuando `props.pagination` existe. Cada iteración visible ocupa una celda.
- Sin `props.gap` declarado y con grid activo, usa `md` como separación por defecto, igual que `container`. Con `props.gap` declarado, se traduce a la misma escala estable (`sm | md | lg | xl | 2xl`) o a la misma compatibilidad heredada de valor CSS arbitrario.
- `props.align` y `props.justify` se traducen a las mismas clases estables que sus equivalentes en `container` cuando el modo grid está activo; sin `columns`, no tienen efecto.
- Los controles de paginación (`previousNext`, `numbered`, `scroll`) se renderizan siempre como hermanos del wrapper de grid, fuera de él, sin ocupar una celda.
- El nodo raíz visible de `props.template` puede declarar su propio `layout.span` para ocupar más de una columna dentro del grid del `repeater`, con el mismo mecanismo de clamp contra columnas disponibles y cascada de breakpoints que documenta `container.md` — ver [[#layout.span sobre el propio repeater]] para cuándo el propio `repeater` (y no solo el nodo raíz de su `template`) es también elegible para `layout.span`.
- Colección resuelta sin iteraciones renderizables con `columns` declarado: el wrapper de grid se renderiza sin celdas, sin markup adicional ni empty state propio.
- En modo edición del canvas del editor visual, el wrapper de grid se aplica igual sobre la única iteración de muestra que renderiza el modo Editor (ver [[../development/dev-mode-editor.md]]).

## Variantes de controles
- La variante `previousNext` es el default efectivo cuando `controls` o `controls.variant` se omiten y muestra controles mínimos `Anterior`/`Siguiente` cuando hay más de una página efectiva.
- La variante `numbered` muestra `Primera`, `Anterior`, una ventana compacta de hasta cinco páginas numeradas, `Siguiente` y `Última`; la página activa queda identificada visualmente y con `aria-current="page"`, sin texto auxiliar de posición.
- La variante `scroll` muestra inicialmente hasta `pageSize` items renderizables y amplía la ventana visible por bloques acumulados del mismo tamaño al alcanzar un sentinel observado; cuando el navegador no soporta `IntersectionObserver`, degrada a una acción local `Mostrar más`.
- `previousNext` conserva la paginación local por páginas con controles anterior/siguiente y es el default efectivo cuando `controls` o `controls.variant` no se declaran.
- `numbered` conserva la misma semántica local por páginas, pero renderiza controles para primera página, página anterior, una ventana compacta de hasta cinco páginas concretas, página siguiente y última página.
- `scroll` no define paginación remota: aplica una ventana incremental local sobre la colección ya cargada, muestra inicialmente hasta `pageSize` items y amplía la cantidad visible por bloques acumulados de `pageSize`.

## Degradación
- En `repeater`, una referencia válida cuyo valor runtime actual no es una colección utilizable degrada a cero iteraciones en vez de romper el render.
- En `repeater` paginado, la colección completa ya resuelta desde `queries.*` se pagina en cliente después de aplicar la política de keys válidas y únicas; cambiar de página, seleccionar una página numerada o ampliar la ventana visible de `scroll` solo cambia estado local del consumidor y no ejecuta ni limpia queries.

## Validación específica
- La ausencia de `repeater.props.pagination` o `table.props.pagination` es el único modo soportado para no paginar en cada nodo; `enabled: false`, `pagination: {}` o paginación sin `pageSize` no son contratos válidos.
- `repeater.props.pagination` solo acepta la superficie local v1; claves extra dentro de `props.pagination` o `props.pagination.controls` se rechazan de forma explícita para no aceptar cursores, paginación remota o metadatos de servidor.
- Si un `repeater` omite `props.items.source`, `props.items.key` o `props.template`, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `repeater.props.items.key` está vacío, usa una referencia global como `item.id` o `queries.posts.data.0.id`, contiene una ruta relativa mal formada, o usa variantes malformadas de literales reservados como `"$index.algo"` o `"meta.$index"`, el config completo se rechaza antes del render.
- Si `repeater.props.pagination` existe, debe declarar `enabled: true` y un `pageSize` entero, finito y mayor o igual que `1`; valores como `enabled: false`, `pageSize: 0`, decimales, infinitos o `pageSize` ausente se rechazan antes del render sobre la ruta exacta.
- Si `repeater.props.pagination.controls.variant` existe, debe ser `previousNext`, `numbered` o `scroll`; cualquier otra variante se rechaza antes del render.
- Si `repeater.props.pagination` o `repeater.props.pagination.controls` incluyen claves no soportadas, el config completo se rechaza antes del render sobre la ruta exacta de la clave extra.
- Si `repeater.props.items.source` declara un origen dinámico, este debe apuntar exactamente a `queries.{queryName}.data` o a una ruta anidada bajo `queries.{queryName}.data.*`.
- `repeater.props.columns`, `repeater.props.gap`, `repeater.props.align` y `repeater.props.justify` se validan contra los mismos catálogos y shapes cerrados que sus equivalentes en `container` (ver [[container.md#Validación específica]]); un valor fuera de contrato en cualquiera de los cuatro se rechaza antes del render con ruta diagnóstica explícita sobre `props.{columns|gap|align|justify}`.

## `layout.span` sobre el propio `repeater`
- Un `repeater` sin `props.columns` sigue excluido de `layout.span`: declararlo sobre el propio nodo no produce wrapper ni ocupación visible; el nodo raíz visible de `props.template` debe declarar su propio `layout.span` si necesita ocupar columnas del grid ancestro. Ver [[container.md]] para el contrato general de `layout.span`.
- Un `repeater` con `props.columns` (modo grid propio) sí es elegible para `layout.span`: el wrapper de grid del propio `repeater` recibe `col-span-*`, clampado contra las columnas del grid ancestro más cercano (`container` o `repeater` padre en modo grid), igual que cualquier otro nodo de una sola caja.
- El `layout.span` del nodo raíz de `props.template` se sigue clampando contra las columnas propias del `repeater` (`props.columns`), no contra las del ancestro, con independencia de si el propio `repeater` declara o no `layout.span`.

## Límites del nodo
- `repeater` ya puede expandir un subárbol completo por item de una colección remota, aplicar paginación local opcional con `props.pagination`, y filtrar/ordenar/recortar la colección mediante pipeline declarativo en `props.items.source` sin backend. Sigue fuera de alcance cualquier DSL de templates, paginación remota o fuentes de colección ajenas a `queries.*`.
