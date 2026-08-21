# Design: Feature 2026-08-21-10-04 - dev-editor-pages-panel

## Contexto
El editor de configuración en vivo (`src/dev-runtime/`, ver `dev-mode-editor.md`) ya resuelve el mismo problema de
producto dos veces para otros dominios raíz del config: `Shell` (`shell-config-panel/`) y `Traducciones`
(`translations-panel/`). Ambos sustituyen el canvas de `Layout` por un panel de formulario propio y comparten un
pipeline de commit idéntico en `dev-runtime.tsx`:

1. mutar el valor en memoria de una única clave raíz (`shell` o `translations`),
2. parchear solo esa clave sobre `lastValidConfigText` con el helper genérico `patchRootKey(rawText, key, value)`
   (`src/dev-runtime/layout-canvas/layout-canvas-commit.ts`),
3. `JSON.parse` + `validateRuntimeConfig`,
4. si es válido, `migrateRuntimeStateAcrossConfig(prevState, currentConfig, validation.config, { dataValues })` y
   `flushSync` para aplicar `currentConfig`/`editorBuffer`/`lastValidConfigText` y activar la guardia de cambios
   aplicados; si no, se devuelve el error para que el panel lo muestre como commit rechazado.

El botón "Páginas" de la barra flotante ya existe con `data-testid="dev-editor-toolbar-domain-pages"` y
`aria-disabled="true"` (`floating-toolbar/dev-editor-floating-toolbar.tsx`), y `dev-editor-layer.tsx` ya resuelve
`activeDomain` con un switch que hoy solo contempla `'layout' | 'shell' | 'translations'` para decidir qué se
renderiza en el área central. Añadir `'pages'` a `ToolbarDomain` y a ese switch es una extensión directa del mismo
punto de extensión, no un mecanismo nuevo.

Para el escaneo de referencias huérfanas (`navigateTo` con un `pageId` dado) no existe una utilidad genérica
reutilizable, pero sí hay dos precedentes de forma que informan el algoritmo:
- `compute-active-menu-item-ids.ts` / `compute-active-sidebar-item-ids.ts` (`src/runtime/runtime-shell/`): recorren
  `shell.header.menu` (un nivel) y `shell.sidebar.items` (profundidad arbitraria) comprobando
  `item.action?.type === 'navigateTo' && item.action.pageId === target` — pero su forma de retorno (rutas activas
  para resaltado de UI) no encaja con lo que necesita este panel (conteo + procedencia para un aviso).
- `collectModalIds`/`checkModalRefs` (`src/config/validate-runtime-config.ts`): recorren el `layout` de una página
  ramificando por `node.type` (`container`/`form` → `children`, `modal` → `children`, `repeater` → `props.template`,
  más los `fallback` de `queryStateFeedback.states`) para acumular y comprobar referencias cruzadas. No cubre
  `link.children` ni `tabs.props.items[].children` (no los necesita para su propósito de IDs de modal), así que no es
  reutilizable tal cual para un escaneo de acciones que sí debe cubrir todo el catálogo de nodos con `children`.

Ninguno de los dos precedentes resuelve directamente el caso: `navigateTo` puede aparecer no solo en
`button.props.action`/`link.props.action`, sino anidado dentro de `form.submitAction.onSuccess`/`onError` y de cada
entrada de `executeOperations.operations` (ver `dev-mode-editor.md#selector-de-variante-para-uniones-discriminadas-por-type-acciones`),
sin que ningún precedente actual enumere esa superficie completa.

No existe tampoco ningún diálogo de confirmación con semántica de diálogo en el editor hoy: borrar un nodo del
canvas en modo Editor es inmediato, sin confirmación (`dev-mode-editor.md#eliminar-nodo-modo-editor`). Esta feature
introduce el primer flujo de borrado con confirmación explícita del editor.

## Objetivos / No objetivos

### Objetivos
- Definir cómo se integra la pestaña "Páginas" en el mecanismo de dominios ya existente del editor (barra flotante +
  `dev-editor-layer.tsx`), sin mecanismo paralelo.
- Definir el pipeline de commit para mutaciones de `pages` (alta, edición de `title`, borrado) y de `initialPage`
  (reasignación), reutilizando `patchRootKey` y el resto del pipeline ya vigente para `shell`/`translations`.
- Cerrar el algoritmo de escaneo de referencias `navigateTo` huérfanas: qué recorre, cómo detecta una referencia
  con independencia de en qué campo de acción esté anidada, y qué granularidad de "dónde" expone al usuario.
- Fijar dónde viven las reglas de "no se puede borrar" (única página restante / `initialPage` vigente): en el panel
  del editor, no como invariante nueva de `src/config/`.
- Definir el enfoque del diálogo de confirmación de borrado, dado que no hay un componente reutilizable previo.

### No objetivos
- No reabre el alcance funcional de `spec.md` (reordenar `pages`, renombrar `id`, reparar referencias huérfanas,
  duplicar página, editar `layout`/`preloads` desde esta pestaña siguen fuera).
- No diseña un componente de diálogo de confirmación reutilizable para todo el editor; se resuelve localmente para
  esta pestaña (ver Decisión 5).
- No cambia `migrateRuntimeStateAcrossConfig` ni la política de degradación a `initialPage`: ya cubre el caso de la
  página activa eliminada sin cambios (ver Decisión 4).

## Decisiones

### Decisión 1 — Integración como dominio nuevo en el mecanismo ya existente
`ToolbarDomain` gana el valor `'pages'`. `dev-editor-floating-toolbar.tsx` quita `aria-disabled`/`title` del botón
`data-testid="dev-editor-toolbar-domain-pages"` y lo conecta a `onDomainSelected('pages')`, igual que ya hacen
`shell`/`translations`. `dev-editor-layer.tsx` añade una rama `activeDomain === 'pages'` al switch de renderizado
central (mismo punto donde hoy se decide `ShellConfigPanel`/`TranslationsConfigPanel` vs. canvas de `Layout`),
mostrando un nuevo `PagesConfigPanel`. Cambiar de/hacia el dominio `pages` limpia la selección de nodo del canvas,
reutilizando la misma regla ya vigente para `shell`/`translations` ("Cambiar de pestaña de dominio fuera de
`Layout`").

Alternativa descartada: tratar "Páginas" como un modo dentro de `Layout` en vez de un dominio de barra independiente.
Se descarta porque contradice el propio contrato ya fijado por la barra (seis dominios excluyentes) y porque la spec
ya asume ese patrón explícitamente ("mismo patrón ya usado por `Shell` y `Traducciones`").

### Decisión 2 — Dos funciones de commit, una por clave raíz, siguiendo el patrón existente
Se añaden `commitPagesMutation` y `commitInitialPageMutation` en `dev-runtime.tsx`, junto a `commitShellMutation`/
`commitTranslationsMutation`, con idéntica forma:
- `commitPagesMutation(mutate: (pages: PageConfig[]) => PageConfig[])` — usada por alta, edición de `title` y
  borrado de página. Parchea únicamente la clave raíz `pages` vía `patchRootKey`.
- `commitInitialPageMutation(mutate: (initialPage: string) => string)` — usada solo por el selector de página
  inicial. Parchea únicamente la clave raíz `initialPage`.

Ambas siguen el resto del pipeline sin cambios: `JSON.parse` + `validateRuntimeConfig` sobre el texto parcheado,
`migrateRuntimeStateAcrossConfig` si la validación es correcta, `flushSync` para aplicar `currentConfig`/
`editorBuffer`/`lastValidConfigText`/guardia de cambios aplicados, o devolver el error de validación sin tocar
`currentConfig` si se rechaza (mismo criterio de "commit rechazado conserva el valor tecleado" ya vigente en el
resto del panel).

Alternativa descartada: una única función de commit combinada que reciba una mutación sobre `{ pages, initialPage }`
y parchee ambas claves en un solo commit. Se descarta porque ninguna operación de esta feature necesita tocar ambas
claves a la vez (crear/editar/borrar página solo toca `pages`; el selector de inicial solo toca `initialPage` — la
página nueva nunca se marca automáticamente como inicial, y no se permite borrar la `initialPage` vigente sin
reasignar antes), así que una función combinada añadiría superficie sin necesidad real y rompería el patrón
"una función de commit por clave raíz" ya establecido por `commitShellMutation`/`commitTranslationsMutation`.

### Decisión 3 — Escaneo de referencias huérfanas: recorrido estructural genérico, no enumeración de campos de acción
El escaneo se implementa como una única función pura (nueva, en el módulo del panel de Páginas, no en
`src/config/` ni en `src/runtime/`) que recorre genéricamente cualquier valor JSON — sin conocer los nombres de
campo concretos (`props.action`, `submitAction`, `onSuccess`, `onError`, `operations`, etc.) — descendiendo por todo
objeto y array anidado, y cuenta como referencia cualquier objeto con la forma `{ type: 'navigateTo', pageId: <id
buscado> }`.

La función se invoca de forma independiente contra tres raíces distintas para poder etiquetar la procedencia con la
granularidad que pide la spec ("al menos cuántas y dónde"):
- `page.layout` de cada página de `pages` → etiqueta "en la página «{page.id}»".
- `shell.header` → etiqueta "en el menú del header".
- `shell.sidebar` → etiqueta "en el sidebar".

El resultado agregado (conteo total + lista de etiquetas con conteo por procedencia) alimenta el texto del diálogo
de confirmación.

Alternativa descartada: enumerar explícitamente cada campo portador de una acción (`button.props.action`,
`link.props.action`, `form.submitAction.onSuccess[]`/`onError[]`, `executeOperations.operations[]`) y su lógica de
detección de `navigateTo` por caso, replicando el conocimiento de forma ya disperso en
`runtime-config-types.ts`/`runtime-config-zod.ts` y en el selector de variante del editor. Se descarta por dos
razones: (a) es más frágil — cualquier variante de acción nueva o cualquier nodo nuevo que incorpore una acción
anidada exigiría actualizar la enumeración a mano, mientras que el recorrido genérico la cubre automáticamente en
cuanto la acción aparece en el JSON; (b) el aviso es explícitamente informativo y no bloqueante (requisito 8: "no
bloquea el borrado si el usuario decide continuar"), así que el riesgo residual de un falso positivo estructural
(un objeto no relacionado con las claves `type`/`pageId` coincidentes) es aceptable frente al riesgo de un falso
negativo por enumeración incompleta, que sería más grave porque silenciaría un aviso que sí debería mostrarse.

Riesgo residual aceptado: el recorrido genérico no distingue si el `{ type: 'navigateTo', pageId }` encontrado está
en una posición sintácticamente válida como acción (podría, en teoría, colarse un valor idéntico en un campo no
relacionado si el config se editó a mano de forma extraña). Dado que el propio `validateRuntimeConfig` ya garantiza
que `currentConfig` es válido antes de llegar a este panel, y que el catálogo de nodos no declara ninguna otra
propiedad con esa forma exacta, el riesgo práctico es despreciable.

Coste: el escaneo recorre todo `pages` completo en cada intento de borrado (no en cada render), lo cual es aceptable
dado que los configs de este editor son de tamaño de desarrollo/edición manual, no datasets de producción a escala.

### Decisión 4 — Migración de navegación al borrar la página activa: sin código nuevo
El requisito 11 de la spec (si el runtime tenía activa la página eliminada, migra a `initialPage` con `params: {}`)
ya lo resuelve `migrateRuntimeStateAcrossConfig`, invocado igual que en cualquier otro commit del editor (Decisión
2): al eliminar la página, el nuevo `validation.config` ya no la contiene en `pages`, y la migración de navegación
ya documentada ("si la página activa sigue existiendo... si no existe, degrada a `initialPage`") cubre el caso sin
ninguna rama especial para el origen "borrado desde el panel de Páginas". No se toca `dev-runtime-state-migration.ts`.

### Decisión 5 — Diálogo de confirmación de borrado: componente local a esta pestaña, no una capa compartida nueva
No existe hoy ningún flujo de confirmación con semántica de diálogo en el editor (el borrado de nodo en `Layout` es
inmediato). Esta feature introduce un diálogo de confirmación (`role="alertdialog"`, foco gestionado al abrir y
devuelto al disparador al cerrar, cierre con `Esc` y con clic fuera) implementado localmente dentro del módulo del
panel de Páginas, siguiendo el mismo lenguaje visual plano ya vigente en el resto del editor (sin caja/fondo
sobrecargados, cabeceras de texto simple) en vez de crearse como un componente genérico reutilizable en
`src/dev-runtime/` para cualquier futuro caso de borrado.

Alternativa descartada: extraer desde ya un `ConfirmDialog` compartido pensado para un futuro uso en `Traducciones`
(que hoy borra entradas sin confirmar) u otros dominios. Se descarta por prematuro: no hay una segunda necesidad
real todavía, y generalizar sobre un único caso de uso arriesga una abstracción equivocada. Si aparece una tercera
necesidad de confirmación en el editor, ese sería el momento de extraer el componente compartido.

### Decisión 6 — Reglas "no se puede borrar" como guarda de UI, no como invariante de `src/config/`
Las dos restricciones de borrado (no eliminar la única página restante; no eliminar la `initialPage` vigente) se
calculan en el panel directamente sobre `currentConfig.pages`/`currentConfig.initialPage` para deshabilitar la
acción con un `title` explicativo, sin añadir una regla nueva a `validate-runtime-config.ts`. Motivo: son reglas de
flujo de trabajo del editor de desarrollo (evitar dejar el config sin páginas o con un `initialPage` colgante *desde
esta pestaña*), no invariantes estructurales del contrato del runtime — un config con una sola página, o cuyo
`initialPage` coincide con la única declarada, sigue siendo perfectamente válido para `src/config/` y para el
runtime en producción. Mantener la regla fuera de `src/config/` respeta el límite arquitectónico de que la
validación previa al render no debe absorber política específica de una superficie de edición concreta.

## Riesgos y trade-offs
- **Falsos positivos del escaneo genérico** (Decisión 3): aceptado porque el aviso es informativo, no bloqueante.
- **Dos commits independientes en vez de uno combinado** (Decisión 2): coherente con el patrón existente; implica
  que crear una página y marcarla como inicial en el mismo gesto no es posible en un único commit — no es un caso
  que la spec pida (la creación nunca marca `initialPage` automáticamente).
- **Diálogo de confirmación no generalizado** (Decisión 5): riesgo de una futura duplicación si `Traducciones` u
  otro dominio necesita confirmar un borrado; aceptado por evitar abstraer sobre un único caso de uso.
- **Coste del escaneo en cada intento de borrado** (Decisión 3): recorre todas las páginas; aceptable a la escala de
  un config de desarrollo, se ejecuta solo al intentar borrar, no en cada render del panel.

## Migración o despliegue
No aplica — cambio de superficie de editor de desarrollo, sin migración de datos ni de contrato de configuración en
producción. El shape de `pages`/`initialPage` no cambia.

## Preguntas abiertas
Ninguna bloqueante. Las dos incertidumbres señaladas en `spec.md` quedan resueltas: la estrategia de escaneo de
referencias huérfanas en la Decisión 3, y la ausencia de validación de `preloads` se mantiene confirmada como fuera
de alcance (no depende de `pageId`, según ya señala la propia spec).
