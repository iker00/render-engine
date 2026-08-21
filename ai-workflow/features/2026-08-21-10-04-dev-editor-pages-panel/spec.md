# Pestaña "Páginas" del editor de configuración en vivo

## Objetivo
Activar la pestaña "Páginas" de la barra flotante del editor de configuración en vivo (hoy deshabilitada con `aria-disabled` y el título "Próximamente", ver `dev-mode-editor.md`), ofreciendo un panel dedicado que permita crear páginas nuevas, eliminarlas, editar su `title`, y designar cuál es la `initialPage` vigente — sin depender de editar el JSON manualmente desde Monaco.

## Alcance
- Habilitar el botón "Páginas" de la barra flotante de selección de dominio.
- Al activarla, sustituir el área central (canvas/paleta de `Layout`) por un panel de formulario dedicado a la gestión de páginas, con el mismo patrón ya usado por `Shell` y `Traducciones` (panel propio, no canvas de manipulación directa).
- Listado de todas las páginas de `config.pages` en su orden actual, mostrando por cada una `id`, `title` (o su ausencia) y si es la `initialPage` vigente.
- Creación de página nueva: formulario con `id` (obligatorio, no vacío, único) y `title` (opcional). La página nueva se añade con `layout: []`, sin `preloads` y sin marcarse automáticamente como `initialPage`.
- Edición del `title` de una página ya existente directamente desde el panel (incluye poder vaciarlo).
- Designación de `initialPage`: un control permite marcar cuál de las páginas listadas es la `initialPage` vigente; el cambio actualiza `config.initialPage` de inmediato.
- Eliminación de página con confirmación explícita. Antes de confirmar el borrado definitivo, si existen referencias `navigateTo` (en el `layout` de cualquier página, en `shell.header` o en `shell.sidebar`) apuntando al `id` de la página a eliminar, el editor debe advertir de su existencia.
- Todas las mutaciones de este panel (crear, eliminar, editar `title`, cambiar `initialPage`) se aplican sobre el mismo `currentConfig` en memoria que gestiona el resto del editor visual, con el mismo pipeline de commit/validación y reflejo inmediato en Monaco y en el selector de página de la barra.

## Fuera de alcance
- Reordenar el array `pages`.
- Renombrar el `id` de una página ya existente (implicaría reescribir toda referencia `navigateTo`/enlace que lo mencione; se deja para una iteración posterior).
- Corrección o reescritura automática de referencias `navigateTo` huérfanas tras un borrado: esta entrega solo advierte, no repara.
- Duplicar una página existente como plantilla de creación.
- Edición del `layout` o de `preloads` de una página desde esta pestaña (sigue siendo terreno de la pestaña `Layout`).
- Cambios a `api`, `tokens`, `Shell` o `Traducciones`.

## Requisitos funcionales
1. El botón "Páginas" de la barra deja de estar deshabilitado; al activarlo se muestra el panel de gestión de páginas en el área central, igual que ya ocurre al entrar en `Shell`/`Traducciones` (el canvas, el overlay de selección y la paleta de nodos de `Layout` desaparecen mientras esta pestaña esté activa).
2. El panel lista todas las páginas de `config.pages`, mostrando por cada una: `id`, `title` (o un placeholder que indique su ausencia) y una marca visual de si es la `initialPage` vigente.
3. Formulario de creación con campos `id` (obligatorio) y `title` (opcional). El control de confirmar creación permanece deshabilitado mientras `id` esté vacío o coincida con un `id` ya existente en `pages`; el motivo se muestra sin necesidad de intentar aplicar desde Monaco.
4. Crear una página añade una entrada a `pages` con el `id`/`title` indicados, `layout: []` y sin `preloads`; no se marca automáticamente como `initialPage`.
5. Cada página del listado permite editar su `title` (incluye poder dejarlo vacío, lo que retira el campo `title` de esa página).
6. Un control (por ejemplo, un selector de página inicial dentro del propio listado) permite designar cuál página es la `initialPage` vigente. Cambiarlo actualiza `config.initialPage` de inmediato y se refleja en Monaco y en el resto del editor sin recargar.
7. Cada página del listado permite eliminarla mediante una acción con confirmación explícita antes del borrado definitivo, salvo las restricciones de los puntos 9 y 10.
8. Antes de confirmar un borrado, si existen referencias `navigateTo` con `pageId` igual al de la página a eliminar — en el `layout` de cualquier página, en las acciones de `shell.header` (menú) o en `shell.sidebar` (`sidebarItem`, a cualquier profundidad) — el diálogo de confirmación indica su existencia (al menos cuántas y dónde) antes de que el usuario confirme el borrado definitivo. El aviso es informativo: no bloquea el borrado si el usuario decide continuar.
9. No se puede eliminar la única página restante de `pages`: la acción de borrado queda deshabilitada con un motivo explícito.
10. No se puede eliminar la página marcada como `initialPage` vigente: la acción de borrado para esa página queda deshabilitada con un motivo explícito, hasta que se reasigne `initialPage` a otra página (ver punto 6).
11. Si el runtime tenía activa (visualizándose) la página eliminada, migra su estado de navegación reutilizando el mismo mecanismo ya existente para configs aplicados (`migrateRuntimeStateAcrossConfig`: degrada a `initialPage` con `params: {}`), sin lógica nueva de migración de navegación.
12. Un commit rechazado por validación (por ejemplo, un `id` que deja de ser único por una condición de carrera con Monaco) conserva el valor tecleado en el formulario y muestra un aviso `role="alert"`, con el mismo criterio de limpieza ya vigente en el resto del panel de propiedades del editor.

## Requisitos no funcionales
- Coherencia visual y de interacción con las secciones de dominio ya existentes (`Shell`, `Traducciones`): mismo estilo de panel de formulario, sin canvas.
- Accesibilidad: acciones de eliminar con nombre accesible explícito, confirmación de borrado con semántica de diálogo, listado de páginas navegable por teclado.
- No introduce una segunda fuente de verdad para `pages`/`initialPage`: sigue siendo el mismo `currentConfig` que gestiona la guardia de cambios aplicados, el botón "Guardar", el autocompletado de Monaco y el HMR.
- Se mantiene el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación
- Con la pestaña "Páginas" hoy deshabilitada, tras esta feature el botón está habilitado y activarlo muestra el listado de páginas del config activo.
- Crear una página con un `id` nuevo la añade a `config.pages` con `layout: []`, visible de inmediato tanto en el selector de página de la barra flotante como en el listado de esta pestaña.
- Intentar crear una página con `id` vacío o duplicado no la crea y expone el motivo sin necesidad de pasar por Monaco/Aplicar.
- Eliminar una página que no es la `initialPage` ni la única restante la retira de `config.pages` tras confirmar; si el runtime la tenía activa, migra a `initialPage` sin error.
- Intentar eliminar la única página restante, o la marcada como `initialPage`, no la elimina; el motivo queda explícito en la interfaz.
- Marcar otra página como `initialPage` actualiza `config.initialPage`, reflejado en Monaco y en el resto del editor sin recargar la página del navegador.
- Editar el `title` de una página existente se refleja en `document.title` la próxima vez que esa página esté activa, según el comportamiento ya descrito en `page-model.md`.
- Al intentar eliminar una página referenciada por un `navigateTo` de otra página, de `shell.header` o de `shell.sidebar`, el diálogo de confirmación menciona esa referencia antes de que el borrado sea definitivo.

## Casos límite
- `id` con espacios en blanco al principio/final: se trata como cualquier otro `id` no vacío tras normalizar espacios sobrantes; dos `id` que solo difieran en mayúsculas/minúsculas no se consideran duplicados salvo coincidencia exacta (mismo criterio que ya usa la unicidad de `id` en `pages`).
- Eliminar una página distinta de la activa/inicial no afecta a la navegación en curso del runtime.
- El escaneo de referencias huérfanas se limita a ocurrencias de la acción declarativa `navigateTo` con ese `pageId`; no cubre otras formas de apuntar a una página fuera de ese catálogo de acciones.
- Cambiar `initialPage` no elimina ni modifica `preloads`/`layout` de ninguna página; solo reescribe el campo `initialPage` del config raíz.
- Crear una página nueva no cambia automáticamente de pestaña de dominio ni de página activa en el runtime: el usuario permanece en "Páginas" tras crear y decide manualmente cuándo pasar a `Layout` para editar su contenido.

## Riesgos o preguntas abiertas
- El algoritmo de escaneo de referencias huérfanas (recorrer `layout` de todas las páginas más `shell.header`/`shell.sidebar` buscando `navigateTo` con un `pageId` dado) es una pieza técnica nueva sin precedente directo en el editor actual; su estrategia concreta de implementación se deja para `generate-feature-design`.
- Esta feature no valida ni advierte sobre `preloads` que pudieran depender indirectamente de la página eliminada; no aplica porque `preloads` no referencia `pageId`.
