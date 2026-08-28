# Spec: dev-editor-api-preloads-navigate-params

## Objetivo
Cerrar los tres puntos del editor visual de desarrollo que hoy no tienen equivalente al editor de pares clave/valor ya usado para `headers`/`query`/`body` en `image.props.fetch`, `form.submitAction` y las acciones `executeOperation`/`executeOperations`, y que por eso solo se pueden editar escribiendo JSON a mano en Monaco:

1. `params` de la acción `navigateTo` (botones, links, menú/sidebar del shell).
2. Las operaciones declaradas en el bloque raíz `api`.
3. Las entradas de `preloads`, a nivel `shell` y a nivel página.

## Alcance
- Editor visual de pares clave/valor para `navigateTo.params`, con el mismo aspecto e interacción que el ya usado para `headers`/`query`.
- Nuevo panel dedicado "Api" en el editor de desarrollo, con el mismo patrón de panel de nivel superior que ya usan "Shell" y "Traducciones", que cubre:
  - CRUD completo de operaciones del bloque `api` (alta, edición, borrado; sin renombrado de clave).
  - Edición de método, endpoint/URL y los tres mapas de parámetros de petición (`query`, `body`, `headers`) de cada operación, reusando el mismo editor visual de pares clave/valor.
  - CRUD de entradas de `preloads` a nivel `shell` y a nivel página (alta, edición, borrado).
  - Por cada entrada de preload: selección de `operationName` mediante desplegable restringido a las claves ya declaradas en `api`, y edición de su `requestParams` (`query`, `body`, `headers`) con el mismo editor de pares clave/valor.
- Sincronización en vivo con Monaco y con el mismo pipeline de validación/commit que ya usa el resto del editor visual.

## Fuera de alcance
- Pickers contextuales conscientes de qué referencias (`queries.*`, `forms.*`, `params.*`, `item.*`) están disponibles en cada punto concreto; el valor de cada fila sigue siendo un campo de texto libre, igual que hoy en `headers`/`query`/`body`.
- Añadir `query` al `fetch` del nodo `image` (hoy solo admite `headers`/`body`); no se toca ese contrato.
- Sustituir o sincronizar la validación manual existente (`validate-api-config.ts`, `validate-preloads.ts`, `validate-actions-visibility.ts`) por un mecanismo distinto — la estrategia técnica se decide en `design.md`.
- Renombrar la clave de una operación `api` ya existente desde el panel.
- Autocorregir o limpiar referencias rotas (`operationName` de un preload que apunta a una operación borrada, u otra referencia a una clave de `api` eliminada) — el comportamiento de validación ante una referencia rota se mantiene igual que hoy.
- Editar `when` u otras condiciones de una entrada de `preloads` más allá de `operationName` y `requestParams`.
- Persistencia a backend: sigue igual que el resto del editor de desarrollo (memoria de sesión + Monaco sincronizado, sin escribir a disco).
- Cambios de comportamiento en producción o en el contrato JSON consumido por el runtime: los datos editables son los mismos que ya acepta el runtime hoy, solo cambia que se puedan editar visualmente.

## Requisitos funcionales

### `navigateTo.params`
- FR1: `params` de una acción `navigateTo` (en `button.props.action`, `link.props.action`, y las acciones de menú/sidebar del shell que reutilizan el mismo contrato) se edita desde un editor visual de pares clave/valor, con el mismo aspecto e interacción que el ya usado para `headers`/`query`.
- FR2: Cada valor de `params` se edita como texto libre; una referencia completa (a `params.*`, `forms.*`, `item.*`, etc.) se escribe igual que ya se escribe hoy en un valor de `headers`/`query`, sin interpolación parcial.
- FR3: Un `navigateTo.params` ya existente que incluya algún valor no-string (number, boolean, null) no rompe el editor: esa fila concreta se muestra en modo de solo lectura (editable solo desde Monaco), sin afectar a la edición del resto de filas del mismo `params` — misma degradación por fila que ya existe hoy para valores anidados de `body`.

### Panel visual "Api" — operaciones
- FR4: Nueva sección de nivel superior "Api" en el editor de desarrollo, con el mismo patrón de panel dedicado que ya usan "Shell" y "Traducciones" (sustituye la edición manual del bloque raíz `api` en Monaco por un formulario).
- FR5: El panel lista las operaciones ya declaradas en `api`, identificadas por su clave.
- FR6: Alta de una operación nueva, con una clave no vacía y no duplicada dentro de `api`; un intento de alta con clave ya existente se rechaza sin aplicar el cambio.
- FR7: Borrado completo de una operación existente.
- FR8: No se permite renombrar la clave de una operación existente desde el panel.
- FR9: Cada operación permite editar su método, endpoint/URL, y sus tres mapas de parámetros de petición (`query`, `body`, `headers`) mediante el editor visual de pares clave/valor.
- FR10: El editor de `body` admite la misma degradación por clave que ya existe hoy en el resto de usos del widget: una clave cuyo valor sea un objeto o array anidado cae a una vista de solo lectura para esa clave concreta, sin afectar a las demás filas del mismo `body`.

### Panel visual "Api" — preloads
- FR11: Las entradas de `preloads` declaradas a nivel `shell` y las declaradas por página se editan visualmente desde el mismo panel "Api" (o una sección asociada dentro de él), sin depender de Monaco.
- FR12: Alta de una entrada de preload nueva, dentro del conjunto correspondiente (`shell` o la página activa que se esté editando).
- FR13: Borrado de una entrada de preload existente.
- FR14: Cada entrada de preload permite elegir a qué operación de `api` apunta (`operationName`) mediante un desplegable restringido a las claves ya declaradas en `api`; no admite escribir un nombre que no exista todavía en `api`.
- FR15: Cada entrada de preload permite editar su `requestParams` (`query`, `body`, `headers`) mediante el mismo editor visual de pares clave/valor, con la misma degradación de `body` que FR10.

## Requisitos no funcionales
- Consistencia visual: el nuevo panel y los widgets reusados mantienen la misma convención visual (Tailwind, patrones de accesibilidad `aria-label`/`role="alert"`) que el resto del panel de propiedades del editor visual; no se introduce una paleta de estilos nueva.
- Toda mutación aplicada desde estos paneles pasa por el mismo pipeline de validación/commit que ya usa el resto del editor: un cambio inválido se rechaza de forma visible, sin aplicar el cambio parcialmente.
- Sincronización en vivo con Monaco: editar desde cualquiera de estos paneles se refleja de inmediato en el JSON de Monaco, y viceversa, igual que el resto del editor visual.
- Exclusivo del editor de desarrollo: sin cambios en el comportamiento de producción ni en el contrato JSON consumido por el runtime.

## Criterios de aceptación
- Dado un botón con acción `navigateTo` y `params` ya declarado como mapa string→string, su panel de propiedades muestra un editor de filas clave/valor (no JSON crudo ni campo deshabilitado); añadir, editar o quitar una fila actualiza el config y el Monaco en vivo.
- Dado un `navigateTo.params` con algún valor no-string, el panel muestra esa fila en solo lectura sin bloquear la edición de las demás filas.
- Dado el bloque `api` vacío o inexistente, el panel "Api" permite dar de alta una operación nueva con clave, método, endpoint y, opcionalmente, `query`/`body`/`headers`, resultando en un config válido.
- Un intento de alta de operación con una clave ya existente en `api` se rechaza sin aplicar el cambio.
- Borrar una operación desde el panel la elimina del bloque `api`; si algún `preloads`/`executeOperation` la referenciaba, la validación cruzada ya existente sigue detectando esa referencia rota igual que hoy (sin cambio en el comportamiento de validación).
- Dado un preload con `operationName` apuntando a una operación existente, el desplegable la muestra seleccionada.
- Dado el alta de una entrada de preload nueva (shell o página), el desplegable de `operationName` solo ofrece las claves ya declaradas en `api`.
- Todo cambio rechazado por el pipeline de validación existente muestra el mismo aviso ya usado en el resto del editor, sin aplicar el cambio.

## Casos límite
- Alta de operación `api` con clave ya existente: rechazada, sin mutación aplicada.
- `preloads` con `operationName` que no tiene operación declarada en `api` (posible si el config llega así desde Monaco o de una operación borrada después): el desplegable no puede ofrecerlo como opción seleccionable puesto que no existe en `api`; ese valor permanece intacto en el config hasta que el usuario lo cambie explícitamente o declare la operación correspondiente — no se fuerza a vaciar el campo ni se autocorrige.
- Fila de `navigateTo.params`/`headers`/`query`/`body` con clave vacía: mismo comportamiento ya vigente hoy en el resto de usos del widget de pares clave/valor.
- `body` de una operación `api` o de un `requestParams` de preload con algún valor anidado (objeto o array): misma degradación por clave (solo lectura para esa fila) ya vigente en `body` en el resto del editor.
- `api` vacío o sin declarar: el panel "Api" muestra un estado vacío con opción de alta, sin romper el resto del editor.
- `preloads` vacío o sin declarar, a nivel `shell` o de una página concreta: el panel muestra un estado vacío con opción de alta.

## Riesgos o preguntas abiertas
- Resuelto en `design.md` (D1): `api` y `preloads` ya cuentan con tipado TypeScript y schemas `Zod` reutilizables (`RuntimeApiConfig`, `RuntimeApiOperation`, `RuntimeApiRequestParams`, `RuntimePreloadConfig`, `runtimeApiOperationShellSchema`, `runtimeApiRequestParamsSchema`), aunque no estén enganchados al parser Zod raíz. El panel visual se construye contra ese tipado ya existente y sigue usando `validate-api-config.ts`/`validate-preloads.ts` sin modificarlos como única fuente de verdad de validación — no hace falta un cambio transversal de validación para esta feature.
- Resuelto en `design.md` (D4): el botón de pestaña "Api" ya existe en el código actual de la barra de herramientas flotante (`dev-editor-floating-toolbar.tsx`, `data-testid="dev-editor-toolbar-domain-api"`), renderizado deshabilitado con `title="Próximamente"` — no hace falta UI nueva a nivel de barra, solo activarlo. `preloads` vive dentro de la misma pestaña "Api", como segunda sub-vista (ver `design.md` D3).

## Áreas de producto afectadas
- Editor de desarrollo (`dev-runtime`): panel de propiedades, barra de herramientas flotante.
- Navegación (`navigateTo.params`): sin cambio de comportamiento en runtime, solo editor visual nuevo.
- Queries/api y preloads: sin cambio de comportamiento en runtime, solo editor visual nuevo.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/development/` (si documenta los dominios/paneles del editor visual).
- `ai-workflow/docs/app-features/navigation/navigate-actions.md` (mención de que `params` ya tiene editor visual, si aplica).
- `ai-workflow/docs/app-features/queries/` (si documenta `api`/`preloads` desde la perspectiva del editor visual).
- `EDITOR-VISUAL-ROADMAP.md` (marcar el punto 2 del roadmap, "Editor visual de `api`", como abordado).
