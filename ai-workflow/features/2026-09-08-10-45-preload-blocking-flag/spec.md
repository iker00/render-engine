# Flag de bloqueo en precargas (`preloads`)

## Objetivo
Permitir declarar, por precarga, si debe bloquear la visualización de contenido hasta que resuelva, en lugar de ejecutarse siempre en segundo plano con feedback solo por query como ocurre hoy. Aplica tanto a precargas por página (`pages[].preloads`) como a precargas globales de aplicación (bloque raíz `preloads`).

## Alcance
- Añadir un campo opcional `blocking` (boolean) a cada entrada de precarga, válido tanto en `pages[].preloads` como en el bloque raíz `preloads`, junto a los campos ya soportados (`query`, `body`, `headers`, y `when` solo en `pages[].preloads`).
- Comportamiento por defecto (`blocking` ausente o `false`): idéntico al actual, no bloqueante.
- Cuando al menos una precarga no omitida por `when` de una tanda está marcada `blocking: true`, el render del contenido correspondiente se retrasa hasta que **todas** las precargas bloqueantes de esa tanda dejen de estar en `loading` (éxito o error):
  - para `pages[].preloads`: se retrasa el render del `layout` de la página al crearse la `pageEntry`.
  - para el bloque raíz `preloads`: se retrasa el render inicial de la aplicación al montar el runtime.
- La navegación por hash/URL no se retrasa: el hash cambia de inmediato como hoy; solo se retrasa la aparición del contenido.
- Mientras el render está retrasado, se muestra un indicador de carga genérico, fijo y no configurable, en el lugar del contenido retrasado.
- Las precargas no marcadas como bloqueantes de la misma tanda no se ven afectadas: siguen ejecutándose en paralelo y consumiéndose vía `queryStateFeedback`/referencias `queries.*` como hoy, aunque coexistan con precargas bloqueantes.
- Una precarga bloqueante que termina en `error` desbloquea el render igual que si hubiera terminado en éxito: el contenido se renderiza y el error se refleja donde ya se consume la query (`queryStateFeedback`), sin bloquear indefinidamente ni introducir una pantalla de error distinta a nivel de página o aplicación.
- El bloqueo solo aplica en el momento de creación de la tanda (nueva `pageEntry`, o montaje inicial del runtime). Reevaluaciones o relanzamientos posteriores de una precarga bloqueante ya visible dentro de la misma entrada (p.ej. por cambios en `forms.*`/`queries.*` que alteran su request efectiva) no vuelven a ocultar contenido ya renderizado.

## Fuera de alcance
- Configurar o personalizar visualmente el indicador de carga: queda fijo y genérico, no se añade ningún campo de config para su contenido.
- Cambiar el comportamiento de precargas no marcadas como bloqueantes.
- Cambiar la política de reintentos ya existente del bloque raíz `preloads` (3 intentos totales, sin espera entre intentos).
- Introducir un estado de error a nivel de página o de aplicación distinto del ya existente por query (`queryStateFeedback`).
- Añadir soporte de `when` al bloque raíz `preloads` (sigue sin admitirlo, sin cambios respecto al contrato actual).
- Añadir un timeout o límite de espera adicional para precargas bloqueantes que no resuelven.

## Requisitos funcionales
1. El shape de entrada de precarga (`pages[].preloads` y `preloads` raíz) admite un campo opcional `blocking: boolean` por operación.
2. Por defecto (`blocking` ausente), una precarga es no bloqueante, igual que el comportamiento actual: regresión cero para configs existentes.
3. Al crear una `pageEntry`, si alguna precarga no omitida por `when` de esa tanda tiene `blocking: true`, el runtime no renderiza el `layout` de la página hasta que todas las precargas bloqueantes de esa tanda tengan `status` distinto de `loading`.
4. Mientras el layout está retrasado por (3), el runtime muestra el indicador de carga genérico en su lugar.
5. Al montar el runtime, si alguna precarga del bloque raíz `preloads` tiene `blocking: true`, no se renderiza la página inicial hasta que todas las precargas bloqueantes de ese bloque tengan `status` distinto de `loading`; mientras tanto se muestra el mismo indicador de carga genérico.
6. Una precarga bloqueante cuya firma de request ya coincide con una query visible existente (reevaluación selectiva por firma) no reintroduce un bloqueo si no vuelve a `loading`.
7. Las precargas no bloqueantes de una tanda no retrasan el render, incluso compartiendo tanda con precargas bloqueantes.
8. El error de una precarga bloqueante desbloquea el render igual que el éxito.
9. Una precarga bloqueante omitida por su condición `when` no bloquea el render (se trata como si no existiera para esa entrada), igual que ya ocurre hoy con la evaluación de `when`.

## Requisitos no funcionales
- El nuevo campo `blocking` se valida con Zod igual que el resto del shape de precarga, con mensajes de error consistentes con `config/validation.md`.
- No debe introducir una regresión de cobertura por debajo del umbral mínimo del 80 % ya exigido sobre `src/`.
- El indicador de carga genérico debe ser accesible: anunciado como estado de carga (p. ej. contenedor con `role="status"`), consistente con el tratamiento accesible ya existente en el fallback `loading` de `queryStateFeedback`.

## Criterios de aceptación
- Dada una página con un preload `blocking: true` y otro sin la flag, al entrar en la página no se ve el `layout` hasta que el preload bloqueante resuelve; el resultado del preload no bloqueante se refleja únicamente por su propio `queryStateFeedback` una vez el layout ya está visible.
- Dado un preload bloqueante que termina en error, el layout se renderiza igualmente y el nodo que consuma esa query en `error` muestra su feedback configurado.
- Dado un config sin ningún `blocking` declarado, el comportamiento observable es idéntico al actual.
- Dado el bloque raíz `preloads` con una entrada `blocking: true`, el render inicial de la aplicación se retrasa hasta que esa precarga resuelve, mostrando el indicador de carga genérico.
- Dada una reentrada a la misma página cuyo preload bloqueante ya tiene la misma firma visible (no se relanza), el layout se renderiza de inmediato sin mostrar el indicador de carga.
- Dado un preload con `when` en `pages[].preloads` que se omite por condición, aunque tenga `blocking: true`, no bloquea el render.

## Casos límite
- Todas las precargas de una tanda son bloqueantes y una de ellas nunca resuelve: el layout queda retrasado indefinidamente detrás del indicador genérico; no hay timeout adicional en esta feature.
- Un `operationName` bloqueante en el bloque raíz coincide con el mismo `operationName` (no bloqueante o bloqueante) en `pages[].preloads` de la página inicial, con firma efectiva coincidente (dedup): ambas rutas comparten `queries.{operationName}`, pero el gate de render de cada bloque se evalúa de forma independiente según su propia declaración de `blocking` — el retraso del layout de la página depende solo de lo declarado en `pages[].preloads`, y el retraso del render inicial de la app depende solo de lo declarado en el bloque raíz.
- Navegación a una página cuyas precargas bloqueantes ya están en `success` por firma coincidente con una carga previa: no se muestra el indicador de carga, el layout se renderiza de inmediato.
- Todas las precargas de una tanda quedan omitidas por `when` (agregado en `idle`): no hay nada bloqueante activo, el layout se renderiza de inmediato, igual que hoy.

## Riesgos o preguntas abiertas
- Riesgo técnico: la implementación exacta de "retrasar el render del layout hasta resolver" en el runtime existente (dónde interceptar el árbol de render, cómo coexiste con el patrón declarativo actual basado en `queryStateFeedback` por nodo, y cómo se representa el nuevo estado de bloqueo a nivel de `pageEntry`/montaje de app) requiere decisiones de diseño no triviales. Se marca `requires_design: true` y se delega en `generate-feature-design`.

## Áreas de producto afectadas
- Queries, precargas y feedback (`ai-workflow/docs/app-features/queries/`).
- Contrato de configuración, shape de `preloads` (`ai-workflow/docs/app-features/config/structure.md`).
- Navegación, ciclo de vida de `pageEntry` (`ai-workflow/docs/app-features/navigation/`).

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/queries/preloads.md`
- `ai-workflow/docs/app-features/config/structure.md`
- Posiblemente `ai-workflow/docs/app-features/navigation/navigate-actions.md` si el diseño introduce un nuevo estado observable a nivel de `pageEntry`.
