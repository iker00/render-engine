# 0137 — Navigation scroll position

## Objetivo

Mejorar el sistema de navegación para que el scroll de `window` se comporte de forma predecible respecto al historial de
páginas: al entrar en una `pageEntry` nueva, la página se muestra desde arriba; al volver a una `pageEntry` ya visitada,
la página conserva la posición de scroll que tenía el usuario antes de abandonarla.

## Alcance

- Scroll-to-top instantáneo (sin animación) de `window` al activarse una `pageEntry` nueva, entendiendo "nueva" en el
  mismo sentido que ya usa el modelo de historial del runtime: cualquier resultado de un push (`navigateTo`, entrada
  directa por URL, degradación a `initialPage` por hash inválido, o reentrada a la misma página con params efectivos
  distintos).
- Restauración de la posición de scroll de `window` al reactivarse una `pageEntry` ya existente en el historial,
  entendiendo esto como el resultado de un pop: el `goBack` declarativo de la app o los controles nativos atrás/adelante
  del navegador.
- Captura de la posición de scroll de la entrada activa en el momento en que deja de serlo, para poder restaurarla si se
  vuelve a ella.
- Coordinación con la política ya vigente de reevaluación de `preloads` por firma: si la entrada reactivada por pop
  relanza queries, la restauración de scroll espera a que esa entrada deje de estar en `loading`.

## Fuera de alcance

- Scroll restoration de contenedores internos con scroll propio (p. ej. `shell.sidebar`, tablas con scroll interno, el
  panel Monaco del editor de desarrollo). El alcance es exclusivamente el scroll de `window`.
- Cambios en la política vigente de relanzamiento de `preloads` en `goBack` o en reentradas; esta feature solo consume
  el estado agregado (`loading` / no `loading`) ya existente de `pageEntry`, no lo modifica.
- Animación o `smooth scroll`; el movimiento siempre es instantáneo.
- Persistencia de posiciones de scroll entre recargas de página (F5) o entre sesiones distintas del navegador.
- `routeParams` o cualquier cambio al modelo de hash routing existente (`#/pageId`).
- Comportamiento especial exclusivo del modo Editor del editor de desarrollo; si el editor reutiliza el mismo runtime de
  navegación de producción, hereda el mismo comportamiento sin tratamiento diferenciado.

## Requisitos funcionales

1. Al activarse una `pageEntry` nueva (push), el runtime posiciona el scroll de `window` en la parte superior (
   `scrollY = 0`) de forma instantánea, sin animación.
2. Al reactivarse una `pageEntry` ya existente en el historial (pop, ya sea vía `goBack` de la app o vía los controles
   nativos atrás/adelante del navegador), el runtime restaura la posición de scroll de `window` que tenía el usuario
   justo antes de abandonar esa entrada, sin animación.
3. La posición de scroll de una `pageEntry` se captura en el momento en que esa entrada deja de ser la activa, no de
   forma continua durante toda la visita.
4. Si la `pageEntry` reactivada por pop relanza sus `preloads` (según la política ya vigente de reevaluación por firma),
   la restauración de scroll espera a que el estado agregado de esa entrada deje de estar en `loading` antes de aplicar
   la posición guardada.
5. Navegar a la misma página con los mismos params efectivos (el no-op observable ya documentado que no crea entrada
   nueva ni relanza `preloads`) no dispara ni scroll-to-top ni restauración: el scroll permanece donde estaba.
6. Un intento de `navigateTo` a una página inexistente (que conserva la página anterior y registra el error recuperable
   `page-not-found`) no altera la posición de scroll actual.
7. Un `goBack` que actúa como no-op visible (entrada directa por URL sin historial previo observado por la sesión) no
   altera la posición de scroll actual.

## Requisitos no funcionales

- El scroll-to-top y la restauración deben ser instantáneos, sin animación ni easing, consistente con la ausencia de
  transición visual entre páginas del hash routing actual.
- El estado de posiciones de scroll guardadas es efímero: vive en memoria de la sesión del runtime, igual que el resto
  del historial interno (`entryId`/`params`); no se persiste entre recargas de página ni entre sesiones del navegador.
- No se modifica la política vigente de relanzamiento de `preloads`; el comportamiento de scroll se apoya en el estado
  agregado de `pageEntry` ya existente, sin introducir un nuevo mecanismo de sincronización de datos.
- El comportamiento debe ser idéntico con la aplicación embebida en un sitio host o en modo standalone, al operar sobre
  `window`.

## Criterios de aceptación

1. Al hacer click en un control con `navigateTo` estando a mitad de scroll de una página larga, la página destino se
   muestra con `scrollY = 0` de forma inmediata y sin animación observable.
2. Tras scrollear una página de listado, navegar a una ficha de detalle vía `navigateTo` y volver mediante el `goBack`
   de la app, el listado se muestra con la misma posición de scroll que tenía antes de salir.
3. Repitiendo el escenario anterior pero volviendo mediante un enlace "volver al listado" implementado con
   `navigateTo` (no `goBack`) hacia la misma página de listado ya visitada, el listado se muestra con `scrollY = 0` (no
   se restaura), pese a ser la misma página.
4. Repitiendo el escenario de restauración pero usando el botón "atrás" nativo del navegador en vez del `goBack` de la
   app, el resultado es equivalente: se restaura la posición de scroll.
5. Si la entrada reactivada por `goBack` relanza `preloads` porque su firma efectiva cambió, la posición de scroll se
   aplica solo después de que esa entrada deje de estar en `loading`, nunca antes.
6. Navegar dos veces seguidas a la misma página con los mismos params efectivos no cambia la posición de scroll actual.
7. Un intento de navegación a una página inexistente no mueve el scroll de la página desde la que se intentó navegar.

## Casos límite

- Página cuyo contenido no permite hacer scroll: el scroll-to-top y la restauración son no-op visibles porque `scrollY`
  ya es `0`.
- Reentrada a `initialPage` por degradación de un hash inválido: se trata como push (entrada nueva), por lo que aplica
  scroll-to-top.
- `navigateTo` disparado dentro de un `repeater` con `item.*` resuelto: se comporta como cualquier otro `navigateTo` (
  push), sin caso especial.
- Navegaciones consecutivas muy rápidas, donde una restauración de scroll en curso podría no haber terminado de
  aplicarse cuando ya ocurre la siguiente navegación: el comportamiento observable esperado es que prevalezca el estado
  final de la entrada que termina activa; el manejo exacto de esa posible condición de carrera se resuelve como detalle
  técnico en diseño, no en esta spec.
- Sesión que arranca directamente en una página profunda por URL (deep link) sin historial previo: es una entrada
  nueva (push), por lo que el resultado esperado es scroll-to-top, coincidiendo además con el comportamiento por defecto
  del navegador en una carga fresca.

## Riesgos o preguntas abiertas

- El navegador tiene su propio mecanismo nativo de restauración de scroll en eventos `popstate` (gobernado por
  `history.scrollRestoration`), que puede competir con el comportamiento aquí definido y producir un salto visible doble
  si no se coordinan explícitamente. Se resuelve como decisión técnica en `design.md`.
- Dónde vive el estado de posiciones de scroll guardadas por `entryId` (nuevo dominio dentro de `runtime-state`, o
  estado local en el punto de montaje que ya aloja el listener de `hashchange`/`popstate`) es una decisión técnica que
  se resuelve en `design.md`, no en esta spec.

## Áreas de producto afectadas (alto nivel)

- Navegación y páginas: acciones `navigateTo`/`goBack`, sincronización con el hash y el historial real del navegador,
  ciclo de vida de `pageEntry`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/navigation/navigate-actions.md`
- `ai-workflow/docs/app-features/navigation/hash-navigation.md`
- `ai-workflow/docs/app-features/navigation/index.md` (si se añade un sub-documento dedicado)
- `ai-workflow/docs/current-state.md` (actualizar la feature relevante de la fila "Navegación y páginas")
