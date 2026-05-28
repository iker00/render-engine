> Cuándo leer: estructura de `repeater`, `props.items.source`, `props.items.key`, `props.template`, paginación local con variantes `previousNext`/`numbered`/`scroll`, comportamiento dentro de `pageEntry`.
> Tamaño: medio.
> Relacionados: [[../queries/state-model.md]], [[../references/reference-resolution.md]].

# `repeater`

## Contrato (`props`)
- `props.items.source`: obligatorio y limitado a `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- `props.items.key`: obligatorio; ruta relativa no vacía al item actual, por ejemplo `id` o `meta.slug`.
- `props.pagination`: opcional; cuando existe activa paginación local en cliente con el shape cerrado de v1.
- `props.pagination.enabled`: obligatorio y exactamente `true`.
- `props.pagination.pageSize`: obligatorio, entero, finito y mayor o igual que `1`.
- `props.pagination.controls`: opcional; si se omite, el runtime usa el default efectivo de controles anterior/siguiente.
- `props.pagination.controls.variant`: opcional y limitado a `previousNext | numbered | scroll`.
- `props.template`: colección ordenada obligatoria de `LayoutNode[]`.
- no admite `children`.

## Reglas de render
- `repeater.props.items.source` solo admite `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- `repeater.props.items.key` exige una ruta relativa no vacía al item actual.
- `repeater.props.pagination` puede activar paginación local en cliente con variantes cerradas de controles.
- `repeater.props.template` reutiliza una colección `LayoutNode[]` sin `children`.
- `repeater` no paginado no introduce markup propio: expande su `template` como hermanos por iteración y omite cualquier item cuya key efectiva sea ausente, no escalar o duplicada, con diagnóstico en desarrollo.
- `repeater` paginado aplica la paginación después de filtrar las iteraciones renderizables por key válida y única, mantiene `item.*` apuntando al item original visible y conserva estado local e independiente por instancia.
- La página activa o cantidad visible de un `repeater` paginado vuelve a la posición inicial cuando cambia la colección resuelta, `pageSize` o la variante de controles; navegar o avanzar localmente no modifica `queries.*`, `pageEntry`, formularios, navegación ni dispara red.

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
- Si `repeater.props.items.key` está vacío, usa una referencia global como `item.id` o `queries.posts.data.0.id`, o contiene una ruta relativa mal formada, el config completo se rechaza antes del render.
- Si `repeater.props.pagination` existe, debe declarar `enabled: true` y un `pageSize` entero, finito y mayor o igual que `1`; valores como `enabled: false`, `pageSize: 0`, decimales, infinitos o `pageSize` ausente se rechazan antes del render sobre la ruta exacta.
- Si `repeater.props.pagination.controls.variant` existe, debe ser `previousNext`, `numbered` o `scroll`; cualquier otra variante se rechaza antes del render.
- Si `repeater.props.pagination` o `repeater.props.pagination.controls` incluyen claves no soportadas, el config completo se rechaza antes del render sobre la ruta exacta de la clave extra.
- Si `repeater.props.items.source` declara un origen dinámico, este debe apuntar exactamente a `queries.{queryName}.data` o a una ruta anidada bajo `queries.{queryName}.data.*`.

## Límites del nodo
- `repeater` ya puede expandir un subárbol completo por item de una colección remota y aplicar paginación local opcional con `props.pagination`, pero sigue fuera de alcance cualquier DSL de templates, filtros cliente, ordenación, paginación remota o fuentes de colección ajenas a `queries.*`.
