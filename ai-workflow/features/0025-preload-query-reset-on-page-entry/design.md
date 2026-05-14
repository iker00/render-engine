# Design: Preload query reset on page entry

## Contexto
La feature `0010` ya centralizó la orquestación automática de `preloads` en `src/runtime/runtime-state/runtime-state-provider.tsx`, reutilizando la misma semántica individual de `queries.{queryName}` que usan las ejecuciones manuales y cerrando el agregado `pageEntry` como latest-only solo para la tanda activa. La feature `0020` hizo que esa orquestación dependiera de la entrada activa completa (`entryId/pageId/params`) y `0022` fijó que los formularios reconstruyen sus `defaultValue` tras un desmontaje real.

El comportamiento actual sigue dejando una ventana indeseada: al entrar en una nueva `pageEntry` con `preloads`, el provider marca la entrada como `loading` y dispara las operaciones, pero cada query individual conserva su `data` previo hasta que `queries/set-loading` se aplica. En esa ventana, la nueva página y sus formularios pueden renderizar o inicializarse leyendo datos obsoletos de la visita anterior.

## Objetivos / No objetivos

### Objetivos
- Limpiar de forma determinista solo las queries declaradas en la nueva tanda de `preloads`.
- Garantizar que esa limpieza quede aplicada antes de cualquier render útil de la nueva entrada que pueda leer `queries.{queryName}.data`.
- Mantener para `preloads` una transición visible directa a `loading`, sin paso observable por `idle`.
- Mantener intacta la semántica vigente de ejecuciones manuales de `executeOperation`, incluida la conservación del último `data` válido durante recargas.
- Reutilizar la arquitectura actual: store compartido, reducer como punto de verdad y provider como orquestador de entrada.

### No objetivos
- Cambiar el shape público de `queries.{queryName}`.
- Introducir caché por params, `keepPreviousData`, cancelación o latest-only por query individual.
- Convertir `defaultValue` en una referencia reactiva general ni rehidratar campos ya montados cuando cambian queries externas.
- Añadir un namespace declarativo nuevo para observar el reset intermedio desde el JSON.

## Decisiones

### 1. El inicio de una tanda de `preloads` pasa a ser una transición atómica del reducer
La entrada a una página con `preloads` dejará de componerse como:
- `page-entry/set-loading`
- varios `queries/set-loading` independientes

En su lugar, el reducer expondrá una acción específica de arranque de tanda que, en una sola reducción:
- fija `pageEntry` en `loading` para la nueva entrada activa
- limpia `data` y `error` de cada query incluida en `preloadNames`
- deja cada una de esas queries ya en `status: loading`

Consecuencia observable:
- la nueva entrada no expone un estado intermedio en el que `pageEntry` ya cambió pero `queries.*` todavía conservan datos previos
- tampoco aparece un paso visible por `idle`, porque el mismo commit deja las queries ya en `loading`

### 2. La limpieza previa se aplica solo a `preloads`, no a ejecuciones manuales
La nueva transición atómica se usará exclusivamente desde la orquestación automática de `pages[].preloads`.

Las ejecuciones manuales seguirán usando la ruta actual:
- `queries/set-loading`
- preservación del último `data` válido durante la recarga
- mismo cierre por `success` o `error`

Razonamiento:
- la spec fija explícitamente que la política nueva es semántica de reentrada automática, no una redefinición global de `executeQueryOperation`

### 3. El provider debe separar fase síncrona de preparación y fase asíncrona de ejecución
La orquestación de entrada queda dividida en dos fases:

1. Fase síncrona previa al paint:
- detectar cambio efectivo de `pageEntry`
- despachar la transición atómica de arranque cuando la página nueva tenga `preloads`
- o fijar `pageEntry: idle` cuando la nueva entrada no tenga `preloads`

2. Fase asíncrona posterior:
- lanzar las operaciones remotas de la tanda ya preparada
- reutilizar un snapshot capturado después del reset atómico
- cerrar el agregado `pageEntry` como `success` o `error` al terminar la tanda

La fase síncrona debe vivir en un `useLayoutEffect` del provider para que React aplique el reset de queries antes del primer paint útil de la nueva página. La fase asíncrona puede seguir en un `useEffect`, evitando hacer trabajo de red dentro del layout effect.

### 4. El snapshot común de la tanda se captura después del reset atómico
Todas las operaciones de una misma tanda seguirán resolviendo sus referencias contra un snapshot único del runtime. Ese snapshot ya no debe tomarse antes del reset, sino inmediatamente después de la transición atómica de arranque.

Consecuencias:
- cualquier `api.query`, `api.body` o `api.headers` que lea otra query precargada de la misma tanda verá el estado limpio, no el dato viejo de otra entrada
- los formularios o consumidores que lean `queries.*` durante `loading` verán `data: null` y `status: loading`
- se preserva la semántica previa de snapshot común por entrada

### 5. La protección latest-only sigue limitada al agregado `pageEntry`
Las respuestas tardías de una tanda antigua:
- pueden seguir cerrando sus queries individuales, igual que hoy
- no pueden cerrar ni reabrir el agregado visible de una entrada más reciente

No se introduce control de concurrencia nuevo por query individual. La feature corrige la ventana de datos obsoletos al entrar en página, no la carrera general entre ejecuciones concurrentes del mismo nombre de operación.

### 6. No se introduce una guardia general en formularios; la coherencia debe venir del orden de orquestación
La decisión principal es cerrar la ventana reordenando el provider y el reducer, no convirtiendo `form` en un subsistema reactivo a cambios de queries.

El nodo `form` debe conservar estas invariantes:
- `defaultValue` dinámico se resuelve una sola vez por primera inicialización efectiva
- un campo ya montado no se rehidrata durante rerenders ordinarios
- `persistOnUnmount: false` sigue dependiendo de desmontaje real, no de un reset lateral por navegación

Si durante la implementación aparece un ajuste mínimo en `form-layout-node.tsx`, deberá limitarse a alinearse con el nuevo orden del provider y no a introducir reactividad nueva de `defaultValue`.

## Riesgos y trade-offs
- Riesgo: ejecutar red en `useLayoutEffect` bloquearía el frame y complicaría la semántica.
  Mitigación: limitar el layout effect al reset atómico y dejar la red en un `useEffect` posterior.

- Riesgo: añadir un reset previo separado de `queries/set-loading` expondría `idle` de forma visible.
  Mitigación: usar una única transición atómica de arranque que deje las queries ya en `loading`.

- Riesgo: arreglar el caso solo en formularios dejaría consumidores textuales o estructurales todavía expuestos al dato viejo.
  Mitigación: resolver el problema en el store compartido antes del render útil.

- Riesgo: extender la política nueva a ejecuciones manuales rompería recargas existentes.
  Mitigación: mantener dos caminos explícitos, uno para `preloads` y otro para ejecuciones manuales.

## Migración o despliegue
No hay migración persistida ni cambios de contrato JSON.

Compatibilidad esperada:
- una página sin `preloads` sigue navegando sin limpiar queries por defecto
- una recarga manual desde botón o submit sigue conservando el último `data` mientras carga
- la semántica nueva solo se hace observable al reentrar automáticamente en una página con `preloads`

## Preguntas abiertas
- No quedan preguntas abiertas que bloqueen la implementación dentro del alcance actual.
