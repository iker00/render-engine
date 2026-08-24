# Pestaña "Tokens" del editor de configuración en vivo

## Objetivo
Activar la pestaña "Tokens" de la barra flotante del editor de configuración en vivo (hoy deshabilitada con `aria-disabled` y el título "Próximamente", ver `dev-mode-editor.md`), ofreciendo un panel dedicado que permita añadir, editar y eliminar los tokens declarados en el bloque raíz `tokens` — incluido su refresco automático opcional — sin depender de editar el JSON manualmente desde Monaco.

## Alcance
- Habilitar el botón "Tokens" de la barra flotante de selección de dominio.
- Al activarla, sustituir el área central (canvas/paleta de `Layout`) por un panel de formulario dedicado a la gestión de tokens, con el mismo patrón ya usado por `Shell`, `Api`, `Traducciones` y `Páginas` (panel propio, no canvas de manipulación directa).
- Listado de todos los tokens de `config.tokens`, mostrando por cada uno su `id`, su `value` (texto plano) y si tiene `refresh` configurado.
- Creación de token nuevo: formulario con `id` (obligatorio, no vacío, único) y `value` (obligatorio, no vacío). El token nuevo se crea sin `refresh`.
- Edición del `value` de un token ya existente directamente desde el panel.
- Alta, edición y baja del sub-bloque `refresh` completo (`operation`, `responsePath`, `intervalSeconds`) de un token ya existente: `operation` se elige de un desplegable restringido a las operaciones ya declaradas en `api` (mismo criterio que `preloads.operationName` en la sección `Api`).
- Eliminación de token con confirmación explícita. Antes de confirmar el borrado definitivo, si existen referencias `tokens.{id}.value` en los headers de cualquier operación de `api`, de `button.props.action.headers`, de `form.submitAction.headers`, de `preloads[].headers` o dentro de `executeOperations[].headers`, el editor debe advertir de su existencia.
- Todas las mutaciones de este panel (crear, eliminar, editar `value`, alta/edición/baja de `refresh`) se aplican sobre el mismo `currentConfig` en memoria que gestiona el resto del editor visual, con el mismo pipeline de commit/validación y reflejo inmediato en Monaco.

## Fuera de alcance
- Enmascarar o proteger visualmente el `value` de un token en el formulario: se edita como texto plano, igual que el resto de campos del panel.
- Reordenar el bloque `tokens`.
- Renombrar el `id` de un token ya existente (implicaría reescribir toda referencia `tokens.{id}.value`; para "renombrar" hay que borrarlo y crear uno nuevo).
- Corrección o reescritura automática de referencias `tokens.{id}.value` huérfanas tras un borrado: esta entrega solo advierte, no repara.
- Pickers contextuales para `value`, `responsePath` o cualquier referencia string: siguen siendo texto libre.
- Visualización o monitorización del estado runtime de refresco de un token (`ready`/`refreshing`/`error`) dentro del panel: este panel edita únicamente la configuración estática declarada; el estado runtime sigue gestionándose igual que hoy y se reconstruye desde `tokens` al aplicar, según ya documenta `dev-mode-editor.md`.
- Disparar manualmente un refresco de token desde el panel.
- Persistencia entre sesiones del navegador: los cambios viven solo en memoria de sesión, igual que el resto del editor.
- Cambios a `layout`, `api`, `pages`, `Shell` o `Traducciones`.

## Requisitos funcionales
1. El botón "Tokens" de la barra deja de estar deshabilitado; al activarlo se muestra el panel de gestión de tokens en el área central, igual que ya ocurre al entrar en `Shell`/`Api`/`Traducciones`/`Páginas` (el canvas, el overlay de selección y la paleta de nodos de `Layout` desaparecen mientras esta pestaña esté activa).
2. El panel lista todos los tokens de `config.tokens`, mostrando por cada uno: `id`, `value` (texto plano) y, si tiene `refresh` declarado, sus tres campos (`operation`, `responsePath`, `intervalSeconds`). Con `tokens` vacío o sin declarar, el panel muestra un mensaje equivalente a `"Sin operaciones declaradas."` de la sección `Api`.
3. Formulario "Añadir token" con `id` (obligatorio) y `value` (obligatorio). El control de confirmar creación se rechaza con un aviso local mientras `id` — tras recortar espacios sobrantes al principio/final — esté vacío o coincida exactamente con el `id` de un token ya existente (comparación sensible a mayúsculas/minúsculas), o mientras `value` esté vacío. El token se crea solo con `{ value }`, sin `refresh`; `refresh` se añade después editando el token ya creado.
4. Cada token del listado permite editar su `value` (input de texto libre que commitea al perder el foco, igual criterio que `title` en `Páginas`); a diferencia de `title`, `value` no puede quedar vacío tras el commit — un intento de vaciarlo se rechaza como cualquier commit inválido.
5. Cada token permite activar o desactivar su sub-bloque `refresh` completo. Al activarlo, se muestran sus tres campos: `operation` (desplegable restringido a `Object.keys(api)`; si `api` no declara ninguna operación, el control para activar `refresh` queda deshabilitado con un motivo explícito), `responsePath` (texto libre) e `intervalSeconds` (numérico positivo). Al desactivarlo, se retira la clave `refresh` completa del token.
6. Si la operación referenciada por `refresh.operation` de un token deja de existir en `api` (por ejemplo, tras borrarla desde la sección `Api`), el desplegable de `operation` de ese token simplemente no ofrece ninguna opción para ese valor — no se inyecta una opción de respaldo ni se fuerza otro valor — mientras el resto de campos de `refresh` de ese token siguen editables con normalidad. La validación cruzada ya existente sigue detectando esa referencia rota igual que antes de esta feature.
7. No hay control para renombrar el `id` de un token ya existente.
8. Cada token permite eliminarse mediante una acción con confirmación explícita (diálogo modal). Antes de confirmar, si existen referencias `tokens.{id}.value` en los headers de cualquier operación de `api`, en `button.props.action.headers`, en `form.submitAction.headers`, en `preloads[].headers` (globales o de cualquier página) o dentro de `executeOperations[].headers`, el diálogo indica su existencia (al menos cuántas y en qué fuente) antes de que el usuario confirme el borrado definitivo. El aviso es informativo: no bloquea el borrado si el usuario decide continuar.
9. Un commit rechazado por validación (alta de token, edición de `value`, alta/edición/baja de `refresh`) conserva el valor tecleado (no revierte en silencio) y muestra un aviso `role="alert"`, con el mismo criterio de limpieza ya vigente en el resto del panel de propiedades del editor.
10. Todas las mutaciones de este panel se aplican sobre el mismo `currentConfig` en memoria que gestiona el resto del editor visual, con el mismo pipeline de commit/validación y reflejo inmediato en Monaco, sin necesidad de pulsar ningún botón "Aplicar" adicional.

## Requisitos no funcionales
- Coherencia visual y de interacción con las secciones de dominio ya existentes (`Api`, `Páginas`): mismo estilo de panel de formulario y de tabla, sin canvas.
- Accesibilidad: acciones de eliminar con nombre accesible explícito, confirmación de borrado con semántica de diálogo (`role="alertdialog"`, foco atrapado, cierre por `Esc` o click fuera, devolviendo el foco al elemento que tenía antes de abrirse — mismo patrón que `Páginas`), listado de tokens navegable por teclado.
- No introduce una segunda fuente de verdad para `tokens`: sigue siendo el mismo `currentConfig` que gestiona la guardia de cambios aplicados, el botón "Guardar", el autocompletado de Monaco y el HMR.
- Los valores de token siguen sin persistir entre sesiones del navegador (comportamiento ya establecido en `auth/tokens.md`); esta feature no lo cambia.
- Se mantiene el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación
- Con la pestaña "Tokens" hoy deshabilitada, tras esta feature el botón está habilitado y activarlo muestra el listado de tokens del config activo.
- Crear un token con un `id` nuevo y un `value` lo añade a `config.tokens`, visible de inmediato en el listado de esta pestaña y disponible como referencia `tokens.{id}.value` en el resto del editor (por ejemplo, al editar headers desde la sección `Api`).
- Intentar crear un token con `id` vacío/duplicado, o con `value` vacío, no lo crea y expone el motivo sin necesidad de pasar por Monaco/Aplicar.
- Editar el `value` de un token existente actualiza `tokens.{id}.value`, reflejado de inmediato en Monaco y en el resto del editor sin recargar.
- Activar `refresh` en un token con `operation`/`responsePath`/`intervalSeconds` válidos añade el sub-bloque `refresh` completo; desactivarlo lo retira por completo sin afectar a `value`.
- Sin ninguna operación declarada en `api`, no es posible activar `refresh` en ningún token; el motivo queda explícito en la interfaz.
- Al intentar eliminar un token referenciado en algún header de `api`/`button`/`form`/`preloads`/`executeOperations`, el diálogo de confirmación menciona esa referencia antes de que el borrado sea definitivo.
- Eliminar un token no referenciado en ningún header se completa tras la confirmación estándar, sin aviso adicional de referencias.

## Casos límite
- `id` con espacios en blanco al principio/final: se normaliza igual que la unicidad de `id` ya vigente en `Api`/`Páginas` (recorte, comparación exacta sensible a mayúsculas/minúsculas).
- Desactivar `refresh` de un token no afecta a su `value`; solo retira la clave `refresh` completa.
- El escaneo de referencias huérfanas al borrar se limita a las cinco superficies de headers ya documentadas en `auth/tokens.md` (`api.{op}.headers`, `button.props.action.headers`, `form.submitAction.headers`, `preloads[].headers`, `executeOperations[].headers`); no cubre ninguna otra forma de referenciar un token.
- Borrar un token que otro token referencia en su propio `refresh` (una operación de refresco que a su vez use `tokens.{id}.value` en sus headers) queda cubierto por el mismo escaneo del punto anterior, sin lógica adicional específica para ese caso.
- Un token eliminado que tenía `refresh` activo no requiere ninguna limpieza adicional de temporizadores en el editor: al aplicarse el nuevo config sin ese token, el estado de `tokens` se reconstruye igual que ya documenta `dev-mode-editor.md` (§ Preservación de estado al aplicar).

## Riesgos o preguntas abiertas
- El escaneo de referencias huérfanas de un token (buscar `tokens.{id}.value` dentro de los mapas `headers` en las cinco superficies ya citadas) es una variante del ya implementado para el borrado de páginas (que busca `{ type: 'navigateTo', pageId }`), pero con una forma de coincidencia distinta (valor de string dentro de un mapa clave-valor, no un campo estructural). Si conviene generalizar el escáner existente o construir uno específico para esta forma se deja como decisión de `generate-feature-design`.
- El widget concreto para activar/desactivar y editar el sub-bloque `refresh` (checkbox/toggle que revela tres campos condicionales, con `operation` restringido al catálogo de `api`) no tiene precedente exacto en el editor actual; su implementación concreta se deja para `generate-feature-design`.
