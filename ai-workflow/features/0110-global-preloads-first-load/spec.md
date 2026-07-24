# Spec: `preloads` global de aplicación (primera carga)

## Objetivo

Añadir un nuevo bloque raíz opcional `preloads` en la configuración, independiente de cualquier página, que dispare
operaciones `api` exactamente una vez por carga completa de la aplicación (arranque del runtime), sin bloquear el
render de la página inicial. Permite precargar datos de uso transversal (por ejemplo catálogos compartidos entre
varias páginas) sin atarlos al ciclo de vida de `pageEntry` de una página concreta.

## Alcance

- Nuevo bloque raíz opcional `preloads`: array ordenado de objetos declarativos de una sola clave, hermano de
  `api`/`pages`/`initialPage`. Reutiliza el mismo shape ya validado para `pages[].preloads`: cada entrada tiene
  exactamente una clave (`operationName`) cuyo valor es `{}` o un objeto con `query`, `body` y/o `headers` según el
  contrato `RuntimeApiRequestParams` ya usado por `executeOperation`.
- Se lanza una única vez por instancia de runtime montada ("primera vez que se accede a la aplicación" = primera
  carga de la SPA en memoria). No se persiste entre recargas del navegador ni entre sesiones: recargar la página o
  abrir una pestaña nueva vuelve a lanzarlo, porque cada carga es una instancia de runtime nueva.
- El disparo es independiente de `initialPage` y de `pageEntry`: no depende de qué página resuelve como entrada ni
  se relanza al navegar internamente entre páginas (hash routing) dentro de la misma carga.
- Cada operación referenciada escribe su resultado en `queries.{operationName}`, con la misma semántica de estado
  (`status`, `data`, `error`, `requestSignature`) que cualquier otra ejecución de operación. Cualquier página o nodo
  puede consumir ese resultado con las referencias `queries.*` ya soportadas.
- No bloqueante: la página inicial se renderiza de inmediato, sin esperar a que termine ninguna operación del
  `preloads` global. Los nodos que dependan de `queries.{operationName}` reflejan su estado mediante el feedback ya
  existente (`queryStateFeedback`, `visibility`, interpolación, etc.). No se introduce ninguna pantalla de carga ni
  de error a nivel de aplicación.
- Reintentos acotados ante fallo: si una operación del `preloads` global falla, el runtime la reintenta
  automáticamente, sin espera entre intentos, hasta un máximo de **3 intentos totales** (intento inicial + 2
  reintentos). Si tras el tercer intento sigue en error, la query queda en `status: error` con el `code` del último
  fallo y no se vuelve a reintentar automáticamente durante esa misma carga de la aplicación. Una operación que
  tiene éxito en cualquier intento no continúa reintentándose.

## Fuera de alcance

- Modo bloqueante o cualquier pantalla de carga/error a nivel de aplicación mientras el `preloads` global está en
  curso. Se descarta explícitamente para esta feature; si en el futuro hace falta, se plantea como feature aparte
  con su propio `design.md`.
- Persistencia de "ya se lanzó" entre recargas de navegador o sesiones (por ejemplo `localStorage`). El
  comportamiento es exclusivamente en memoria, por carga de la SPA.
- Condición `when` en el `preloads` global. `pages[].preloads` sí admite `when` porque puede evaluarse contra
  `forms.*`/`queries.*`/`params.*` de una entrada de página activa; el `preloads` raíz se lanza antes de que exista
  ninguna página activa, así que no hay un contexto de evaluación equivalente. Declarar `when` en una entrada del
  `preloads` raíz se rechaza en bootstrap como config inválida.
- Referencias `item.*` en el `preloads` global, igual que ya ocurre en `pages[].preloads` (no existe contexto de
  iteración a nivel de arranque de aplicación).
- Cualquier cambio en el comportamiento ya vigente de `pages[].preloads` (shape, `when`, tanda por `pageEntry`,
  reevaluación selectiva por firma, latest-only). Sigue exactamente igual.
- Un nuevo tipo de acción o mecanismo para relanzar manualmente el `preloads` global desde la UI. Las operaciones
  que también aparecen ahí siguen siendo relanzables manualmente por los mecanismos ya existentes
  (`executeOperation`/`executeOperations` desde botón o submit), sin restricción adicional.
- Distinguir errores "reintentables" (red, HTTP) de errores deterministas (`operation-not-found`,
  `request-build-failed`). La política de reintentos acotados se aplica de forma uniforme a cualquier `code` de
  error; ver "Casos límite".
- Deduplicación nueva entre el `preloads` global y `pages[].preloads` cuando comparten `operationName`: se apoya en
  la política ya vigente de reevaluación selectiva por firma, sin lógica adicional.

## Requisitos funcionales

1. La configuración admite un bloque raíz opcional `preloads`, con el mismo shape de entrada ya validado para
   `pages[].preloads` (una clave = `operationName`, valor `{}` o `{query?, body?, headers?}`).
2. Tras validar la configuración y resolver `initialPage`, el runtime lanza en paralelo todas las operaciones
   declaradas en el `preloads` raíz, exactamente una vez por carga de la aplicación.
3. El lanzamiento del `preloads` global no depende de `initialPage` ni de `pageEntry`, y no se relanza al navegar
   internamente entre páginas dentro de la misma carga.
4. Cada operación referenciada en el `preloads` global actualiza `queries.{operationName}` con la misma semántica de
   estado que cualquier otra ejecución de operación, consumible desde cualquier página o nodo mediante las
   referencias `queries.*` ya soportadas.
5. El render de la página inicial no espera a ninguna operación del `preloads` global: se muestra de inmediato y el
   estado se refleja de forma reactiva mediante el feedback ya existente.
6. Si una operación del `preloads` global falla, el runtime la reintenta automáticamente sin espera entre intentos,
   hasta un máximo de 3 intentos totales.
7. Si tras agotar los 3 intentos la operación sigue en error, queda en `status: error` con el `code` del último
   fallo y no se reintenta más automáticamente durante esa misma carga de la aplicación.
8. Una operación del `preloads` global que tiene éxito en cualquier intento no se reintenta ni se relanza más
   durante esa misma carga.
9. El `preloads` raíz no admite `when`; una entrada con `when` se rechaza en bootstrap con ruta exacta al error.
10. El `preloads` raíz no admite referencias `item.*` en `query`/`body`/`headers`; una config que las use se rechaza
    en bootstrap con ruta exacta, igual que ya ocurre en `pages[].preloads`.
11. Dentro del `preloads` raíz no se admite repetir el mismo `operationName`, igual que ya ocurre en
    `pages[].preloads`; una config que lo haga se rechaza en bootstrap.
12. Un `operationName` puede aparecer simultáneamente en el `preloads` global y en `pages[].preloads` de una o
    varias páginas. Ambas rutas comparten el mismo estado en `queries.{operationName}` y siguen la política ya
    vigente de reevaluación selectiva por firma.
13. Las operaciones también declaradas en el `preloads` global siguen siendo relanzables manualmente mediante
    `executeOperation`/`executeOperations` desde botón o submit, sin restricción adicional; la última ejecución en
    completar (manual o automática) es la que queda reflejada en `queries.{operationName}`, siguiendo la semántica
    latest-only ya vigente por query.
14. Un config sin bloque raíz `preloads` (ausente) o con `preloads: []` se comporta exactamente igual que antes de
    esta feature: no se lanza ninguna operación adicional al arrancar.

## Requisitos no funcionales

- La composición y ejecución de requests (incluidos los reintentos) se mantiene en `src/queries/`; el bootstrap de
  aplicación en `src/app/` solo orquesta el disparo inicial, sin construir requests ni manejar reintentos por su
  cuenta.
- No se introduce ninguna dependencia externa nueva.
- El cambio no debe alterar el comportamiento de configuraciones sin bloque raíz `preloads`, ni el comportamiento ya
  vigente de `pages[].preloads`.

## Criterios de aceptación

1. Una config con `preloads: [{ operationName: {} }]` en la raíz dispara esa operación al arrancar el runtime, sin
   depender de `initialPage` ni del layout de la página inicial.
2. La página inicial se renderiza (nodos visibles en el DOM) antes de que la operación del `preloads` global
   complete, cuando esta se demora artificialmente en el test.
3. Un nodo con `queryStateFeedback` sobre `queries.{operationName}` en la página inicial transita de `loading` a
   `success` o `error` reflejando el resultado del preload global, sin acción adicional del usuario.
4. Navegar internamente a otra página y volver a la inicial no emite una nueva request para una operación del
   `preloads` global ya resuelta (no existe ningún disparador ligado a `pageEntry` para el `preloads` raíz).
5. Con una operación configurada para fallar siempre, tras 3 intentos totales fallidos la query queda en
   `status: error` y no se emiten más requests automáticas para ese `operationName` durante esa carga.
6. Con una operación que falla en el primer intento y tiene éxito en el segundo, la query termina en
   `status: success` con el dato del intento exitoso, sin un tercer intento.
7. Una config sin bloque raíz `preloads`, o con `preloads: []`, se comporta exactamente igual que antes de esta
   feature (sin regresión).
8. Un `operationName` repetido entre el `preloads` global y `pages[].preloads` de la página inicial, con la misma
   request efectiva, no dispara dos requests independientes cuando la firma ya coincide (reutiliza la política ya
   vigente).
9. Una config con `item.*` dentro de una entrada del `preloads` raíz se rechaza en bootstrap con un error de
   validación de ruta exacta.
10. Una config con `when` dentro de una entrada del `preloads` raíz se rechaza en bootstrap con un error de
    validación de ruta exacta.
11. Una config con el mismo `operationName` repetido dos veces dentro del `preloads` raíz se rechaza en bootstrap.

## Casos límite

- `preloads: []` en la raíz: bloque presente pero vacío, no dispara nada; comportamiento idéntico a no declararlo.
- La operación no existe en el catálogo `api`: la query queda en `status: error` con `code: operation-not-found`,
  sin red emitida. Al ser un fallo determinista, los 3 intentos fallan de forma idéntica sin más efecto que agotar
  la política de reintentos; no se introduce una categoría separada de "errores no reintentables" para esta
  feature.
- Referencias no resolubles en `query`/`body`/`headers` de un preload global (por ejemplo `forms.*`/`params.*`, que
  no tienen contexto significativo antes de que exista ninguna página activa): la query queda en `status: error`
  con `code: request-build-failed`, sujeta a la misma política de reintentos acotados; en la práctica fallará igual
  en cada intento porque el contexto no cambia entre intentos.
- Ejecutar manualmente (botón o submit) una operación mientras el `preloads` global todavía está reintentándola:
  ambas ejecuciones conviven sin coordinación nueva; el resultado que complete último es el que queda reflejado en
  `queries.{operationName}`, siguiendo la semántica latest-only ya vigente por query.
- Varias operaciones del `preloads` global fallan y tienen éxito de forma intercalada: cada `operationName` sigue su
  propia política de reintentos de forma independiente; no existe un agregado de estado equivalente al `pageEntry`
  de página para el `preloads` raíz.

## Áreas de producto afectadas

- **Contrato JSON**: nuevo bloque raíz opcional `preloads`, con su propio shape de validación (más restrictivo que
  `pages[].preloads`: sin `when`, sin `item.*`).
- **Bootstrap del runtime**: nuevo punto de disparo de operaciones en el arranque de la aplicación, desacoplado de
  `initialPage`/`pageEntry`.
- **Queries, ejecución y feedback**: nueva política de reintentos acotados ante fallo, hoy inexistente en el resto
  de superficies de ejecución (`executeOperation`, `pages[].preloads`), que se introduce específicamente para el
  `preloads` global.
- **Validación previa al render**: nuevas reglas de rechazo (`when`, `item.*`, `operationName` repetido) sobre el
  nuevo bloque raíz.

## Documentación probablemente afectada

- `app-features/config/structure.md` — documentar el nuevo bloque raíz opcional `preloads` junto a `api`/`pages`/
  `initialPage`, y su shape restringido frente al de `pages[].preloads`.
- `app-features/config/index.md` — referenciar el nuevo bloque en la guía de selección si aplica.
- `app-features/queries/preloads.md` — documentar el `preloads` global como mecanismo distinto y complementario al
  ya existente por página, dejando claro qué comparten (shape base, `queries.*` como destino) y qué no (disparo por
  `pageEntry`, `when`, tanda agregada, reintentos).
- `app-features/queries/index.md` — actualizar la mención de precargas si el resumen de área cambia.
- `current-state.md` — la fila "Queries, preloads y feedback" pasa a apuntar a esta feature como última relevante.

## Riesgos o preguntas abiertas

Ninguno bloqueante. Las decisiones de alcance (comportamiento en memoria por carga de la SPA, no persistente; no
bloqueante; sin `when`; política de reintentos acotada) ya se cerraron en la conversación previa de
`explore-feature-scope`. El único punto no trivial es de estrategia técnica —dónde vive la orquestación de arranque
y de reintentos, y si se reutiliza o no el mecanismo existente de tanda/`pageEntry`— y se deja explícitamente para
`generate-feature-design` antes de planificar tareas.
