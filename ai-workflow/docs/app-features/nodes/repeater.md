> Cuándo leer: estructura de `repeater`, `props.items.source`, `props.items.key`, `props.template`, iteración sobre array y objeto plano, paginación local con variantes `previousNext`/`numbered`/`scroll`, comportamiento dentro de `pageEntry`.
> Tamaño: medio.
> Relacionados: [[../queries/state-model.md]], [[../references/reference-resolution.md]].

# `repeater`

## Contrato (`props`)
- `props.items.source`: obligatorio y limitado a `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- `props.items.key`: obligatorio; ruta relativa no vacía al item actual (por ejemplo `id` o `meta.slug`), el literal reservado `"$key"` para usar la clave del diccionario cuando la fuente es objeto plano, o el literal reservado `"$index"` para usar el índice numérico de iteración (0, 1, 2…) como React key.
- `props.pagination`: opcional; cuando existe activa paginación local en cliente con el shape cerrado de v1.
- `props.pagination.enabled`: obligatorio y exactamente `true`.
- `props.pagination.pageSize`: obligatorio, entero, finito y mayor o igual que `1`.
- `props.pagination.controls`: opcional; si se omite, el runtime usa el default efectivo de controles anterior/siguiente.
- `props.pagination.controls.variant`: opcional y limitado a `previousNext | numbered | scroll`.
- `props.template`: colección ordenada obligatoria de `LayoutNode[]`.
- no admite `children`.

## Detección del shape de la fuente
El repeater detecta automáticamente si la fuente resuelta es array u objeto plano:
- **Array**: comportamiento actual sin cambios. `item.*` navega dentro de cada elemento del array.
- **Objeto plano** (no array, no `null`): itera las entradas propias y enumerables del objeto en el orden natural de inserción, equivalente a `Object.keys`. Dentro del subárbol, `item.*` navega dentro del valor de la entrada y `item.$key` expone la clave del diccionario como string.
- **Cualquier otro valor** (`null`, `undefined`, número, string, `{}`): cero iteraciones de forma silenciosa, sin diagnóstico específico.

## Reglas de render
- `repeater.props.items.source` solo admite `queries.{queryName}.data` o `queries.{queryName}.data.*`.
- `repeater.props.items.key` exige una ruta relativa no vacía al item actual, o los literales reservados `"$key"` y `"$index"`.
- `repeater.props.pagination` puede activar paginación local en cliente con variantes cerradas de controles.
- `repeater.props.template` reutiliza una colección `LayoutNode[]` sin `children`.
- `repeater` no paginado no introduce markup propio: expande su `template` como hermanos por iteración y omite cualquier item cuya key efectiva sea ausente, no escalar o duplicada, con diagnóstico en desarrollo.
- `repeater` paginado aplica la paginación después de filtrar las iteraciones renderizables por key válida y única, mantiene `item.*` apuntando al item original visible y conserva estado local e independiente por instancia.
- La página activa o cantidad visible de un `repeater` paginado vuelve a la posición inicial cuando cambia la colección resuelta (incluyendo cambio de shape array/objeto), `pageSize` o la variante de controles; navegar o avanzar localmente no modifica `queries.*`, `pageEntry`, formularios, navegación ni dispara red.

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

## Límites del nodo
- `repeater` ya puede expandir un subárbol completo por item de una colección remota y aplicar paginación local opcional con `props.pagination`, pero sigue fuera de alcance cualquier DSL de templates, filtros cliente, ordenación, paginación remota o fuentes de colección ajenas a `queries.*`.
