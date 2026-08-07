# Spec — 0129 dev-editor-icon-widget

## Objetivo
Crear un widget reutilizable de búsqueda y selección de iconos Lucide para el editor visual (dev mode), que
sustituya el input de texto libre actual en todos los campos `icon` ya existentes del catálogo — tanto en el
panel de propiedades genérico de `Layout` como en el panel dedicado de `Shell` — permitiendo encontrar y elegir
un icono por nombre con preview visual, en vez de tener que conocer o adivinar el nombre exacto en PascalCase.

## Alcance
- Nuevo componente reutilizable: input de texto que filtra en vivo el catálogo completo de nombres válidos
  exportados por `lucide-react` (mismo criterio de validez que ya usa `IconNode` para resolver nombre→componente
  en el runtime), mostrando los resultados como una cuadrícula (grid) de celdas, cada una con su icono ya
  renderizado y su nombre.
- Integración en los seis nodos de `Layout` que ya declaran `props.icon`: `button`, `heading`, `paragraph`,
  `link`, `stat`, `input` — vía el mismo hook `x-widget` del dispatcher (`WIDGET_REGISTRY`) que ya usan
  `choice-items`, `layout-span`, `heading-level` y `tabs-orientation`.
- Integración en el panel `Shell`: campo `icon` de cada `menuItem` (raíz y `children`) en
  `shell.header.menu`, y campo `icon` de cada `sidebarItem` (a cualquier profundidad) en `shell.sidebar.items`,
  reutilizando el mismo componente aunque esos campos se editan hoy desde `ShellConfigPanel`, fuera del
  dispatcher genérico de `Layout`.
- Control explícito para quitar el icono ya seleccionado (volver el campo a `undefined`), con el mismo criterio
  ya vigente en otros widgets opcionales del panel.
- Cualquier nodo futuro que declare un campo `icon` siguiendo la misma convención (string PascalCase, catálogo
  Lucide) puede reutilizar este mismo widget de forma consistente con el resto del panel; el mecanismo técnico
  exacto para conectarlo se decide en `generate-implementation-plan`.

## Fuera de alcance
- Cambios al contrato JSON de cualquier nodo o de `shell` — `icon` sigue siendo `string` opcional sin cambios en
  su validación Zod.
- Cambios de comportamiento en producción o en modo Visual del editor — la resolución de nombre a componente y
  su degradación silenciosa ante nombres no reconocidos siguen exactamente igual.
- El icono semántico fijo de `alert` (determinado automáticamente por `props.type`, sin campo editable, ver
  [[../../docs/app-features/nodes/alert.md]]) — no aplica, no hay campo de texto libre que sustituir ahí.
- Búsqueda por categoría, etiquetas o metadata adicional de Lucide más allá del nombre del icono.
- Cualquier catálogo de iconos propio o adicional fuera del paquete `lucide-react` ya instalado.
- Favoritos, iconos usados recientemente, o cualquier otra mejora de descubribilidad más allá de la búsqueda por
  texto.
- Deshacer/rehacer — sigue sin existir en el editor visual, igual que el resto de sus mutaciones.

## Requisitos funcionales

### Widget reutilizable de búsqueda de iconos
- Input de texto que filtra en vivo el catálogo completo de nombres exportados válidos de `lucide-react`, con
  coincidencia por substring sin distinguir mayúsculas/minúsculas sobre el nombre del icono.
- Los resultados se muestran como una cuadrícula (grid) de celdas, no como una lista vertical: varias celdas por
  fila, cada una con el icono ya renderizado y su nombre.
- La celda correspondiente al valor actualmente seleccionado se resalta con un borde propio, distinguida del
  resto de celdas — mismo criterio visual que ya usa el segmento activo del widget de alternancia (`0128`).
- Seleccionar una celda aplica ese nombre como valor del campo de inmediato, con el mismo pipeline de
  commit/validación (`validateRuntimeConfig`) ya vigente en el resto del panel.
- Sin resultados para el texto tecleado: la cuadrícula se muestra vacía, sin error, sin bloquear que el usuario
  borre el texto y siga escribiendo.
- Un control explícito permite quitar el icono ya seleccionado, dejando el campo en `undefined`.

### Valor actual no reconocido
- Si el valor actual del campo no coincide con ningún nombre válido del catálogo (por ejemplo, quedó fijado
  desde una edición manual en Monaco con un nombre inexistente o mal escrito), el widget lo muestra sin preview
  de icono — mismo criterio de degradación silenciosa que ya aplica en producción — conservando ese texto como
  valor actual hasta que el usuario elija un resultado de la búsqueda o lo quite explícitamente.

### Integración en nodos de `Layout`
- `button`, `heading`, `paragraph`, `link`, `stat`, `input`: el campo `props.icon` en la subsección `Props` del
  panel de propiedades usa este widget en vez del campo de texto genérico actual.

### Integración en el panel `Shell`
- `shell.header.menu[].icon` (items raíz y `children`) y `shell.sidebar.items[].icon` (a cualquier profundidad)
  usan el mismo widget reutilizable en vez de su input de texto libre actual dentro de `ShellConfigPanel`.

## Requisitos no funcionales
- Componente único reutilizado entre las dos superficies de integración (dispatcher `x-widget` de `Layout` y
  `ShellConfigPanel` de `Shell`), sin duplicar lógica de filtrado, preview o commit entre integraciones.
- La búsqueda debe sentirse fluida al teclear sobre el catálogo completo (del orden de mil quinientos nombres),
  sin lag perceptible.
- Sin dependencias nuevas: reutiliza `lucide-react`, ya instalado y ya importado en el runtime (`IconNode`) para
  resolver nombre→componente.
- Sin coste adicional en el bundle de producción: el widget vive exclusivamente en el editor de desarrollo
  (`src/dev-runtime/`), que ya queda fuera del bundle de producción salvo activación explícita con
  `data-enable-dev-mode` (ver [[../../docs/app-features/development/index.md]]).
- Un commit rechazado por validación sigue el mismo patrón ya documentado: el campo conserva el valor
  introducido, se muestra un aviso `role="alert"` con código/mensaje, y se limpia al guardar correctamente o al
  cambiar de selección.
- El control debe ser operable por teclado sobre la cuadrícula de resultados: navegación en dos ejes (flechas
  arriba/abajo entre filas, izquierda/derecha entre celdas de la misma fila), selección de la celda con foco y
  cierre del buscador, con semántica accesible de tipo grid/cuadrícula (no listbox lineal), reutilizando
  patrones ya establecidos en el panel donde aplique.
- Mantener el umbral mínimo global de cobertura de tests del 80% sobre `src/`.
- Sin cambios de comportamiento observable en producción ni en modo Visual del editor.

## Criterios de aceptación
1. Seleccionar un nodo `button`/`heading`/`paragraph`/`link`/`stat`/`input` con `props.icon` ya declarado y
   reconocido muestra el widget con el icono actual y su preview visible.
2. Teclear en el input de búsqueda filtra la cuadrícula de resultados por substring case-insensitive sobre el
   nombre, cada celda con su icono renderizado y su nombre.
3. Seleccionar una celda de la cuadrícula fija `props.icon` al nombre PascalCase elegido, aplicado con el mismo
   pipeline de commit/validación del resto del panel.
4. Un `props.icon` con valor no reconocido muestra el widget sin preview de icono, sin bloquear la búsqueda ni
   el resto del panel.
5. Pulsar el control de limpieza quita `props.icon` del nodo, dejándolo en `undefined`.
6. Un commit rechazado por validación conserva el valor introducido en el widget y muestra el aviso
   `role="alert"` ya documentado, sin modificar el config aplicado.
7. Editar el campo `icon` de un `menuItem` (raíz o hijo) en el panel `Shell` usa el mismo widget de búsqueda,
   con el mismo comportamiento de filtro, selección y limpieza que en `Layout`.
8. Editar el campo `icon` de un `sidebarItem` (a cualquier profundidad) en el panel `Shell` usa el mismo widget,
   con el mismo comportamiento.
9. El resto del comportamiento ya documentado del panel de propiedades y del panel `Shell` (sincronización con
   Monaco, guardia de cambios aplicados, exclusión mutua con el panel de Monaco) sigue funcionando sin regresión
   al usar este widget en cualquiera de sus integraciones.
10. No hay cambio de comportamiento en producción ni en modo Visual: un `icon` con nombre no reconocido se sigue
    degradando en silencio (sin render) exactamente igual que antes de esta feature.

## Casos límite
- Texto de búsqueda que no coincide con ningún nombre del catálogo: cuadrícula de resultados vacía, sin mensaje
  de error, campo de búsqueda sigue editable.
- Campo `icon` no declarado (valor inicial ausente): el widget arranca sin selección ni texto de búsqueda, sin
  ninguna celda resaltada, mostrando el catálogo disponible para empezar a filtrar.
- Cambiar de nodo seleccionado en `Layout`, o de sub-vista Header/Sidebar en `Shell`, con un aviso de commit
  rechazado pendiente en el widget: el aviso se descarta, igual que el resto de campos del panel.
- Un `sidebarItem` en modo rail sin `icon`: sigue mostrando como sustituto la inicial de su `label` en
  producción (ya documentado); este widget solo cambia cómo se elige el valor en el editor, no ese
  comportamiento de render.
- Texto de búsqueda que coincide con un gran número de resultados (por ejemplo, una sola letra común): el
  número de columnas de la cuadrícula y la cantidad de celdas mostradas simultáneamente son detalle de
  implementación bajo el requisito de fluidez ya fijado (ver Riesgos), sin cambiar el comportamiento observable
  del campo.

## Riesgos o preguntas abiertas
- El mecanismo técnico exacto para que un nodo futuro con un campo `icon` equivalente herede este widget
  (detección por convención de nombre de campo vs. registro explícito por integración) se resuelve en
  `generate-implementation-plan`; no cambia el comportamiento ya fijado en esta spec para las integraciones ya
  identificadas (los seis nodos de `Layout` y los dos campos de `Shell`).
- El número de columnas de la cuadrícula y el límite de celdas mostradas simultáneamente (mostrarlas todas,
  paginar o virtualizar) se resuelven como detalle de implementación bajo el requisito no funcional de fluidez
  ya fijado, sin abrir una decisión de producto adicional.
