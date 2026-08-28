# Spec — 0125 dev-editor-shell-tree-ux

## Objetivo
Mejorar la usabilidad de la sección "Shell" del editor visual en modo desarrollo (`ShellConfigPanel`, ver
[[../../docs/app-features/development/dev-mode-editor.md#sección-shell-dominio-de-configuración]]) para que
configurar árboles de navegación (`shell.header.menu` y `shell.sidebar.items`) sea más legible y más flexible de
reorganizar, sin cambiar el contrato JSON de `shell` ni el comportamiento en producción.

Tres carencias concretas del panel actual motivan la feature:
1. Todos los `menuItem`/`sidebarItem` se muestran siempre con su formulario de campos completo desplegado, lo que
   dificulta ver la forma real del árbol cuando hay varias ramas o profundidad.
2. El arrastre para reordenar está limitado al mismo nivel/mismo padre (ver
   [[../../docs/app-features/development/dev-mode-editor.md#reordenar-por-arrastre]]): no se puede mover un item ya
   creado para que pase a ser hijo de otro, ni sacarlo de su padre actual.
3. `shell.header` y `shell.sidebar` se presentan como dos bloques secuenciales dentro del mismo scroll, sin
   separación visual fuerte entre ambos.

## Alcance
- Control de colapso individual por `menuItem` y por `sidebarItem` (raíz o de cualquier profundidad) que compacta
  el formulario de campos propio del item a una fila resumen, sin ocultar sus hijos.
- Extensión del arrastre ya existente en la sección Shell para permitir anidar un item ya creado como hijo de otro,
  o sacarlo a un nivel distinto (incluida la lista raíz), dentro del mismo árbol (menú del header, o árbol del
  sidebar).
- Bloqueo visual del destino de arrastre que violaría el tope de profundidad de `menuItem` (máximo 1 nivel, ver
  [[../../docs/app-features/shell/header.md#contrato-de-menuitem]]); sin tope equivalente en `sidebarItem`.
- Dos sub-vistas navegables dentro del dominio "Shell": "Header" y "Sidebar", cada una con su propio toggle de
  activación, su propio contenido (logo/título/menú/acciones para Header; items/`defaultCollapsed` para Sidebar) y
  límites visuales claros, en vez de un único scroll continuo.

## Fuera de alcance
- Cualquier cambio al contrato JSON de `shell.header` o `shell.sidebar` (shape, validación, límites de profundidad
  del propio dato) — ver [[../../docs/app-features/shell/header.md]] y [[../../docs/app-features/shell/sidebar.md]].
- Mover items entre la lista de menú del header y el árbol del sidebar: son dominios de datos distintos con reglas
  de profundidad distintas; un intento de arrastre cruzado entre ambos se trata como destino inválido, igual que
  hoy.
- Extender el patrón de sub-vistas dentro de un dominio a otras pestañas del editor (`Api`, `Páginas`, `Tokens`,
  `Translations`). Esta feature sienta el precedente visual pero no lo aplica fuera de `Shell`.
- Deshacer/rehacer, selección múltiple de items, o atajos de teclado dedicados para mover un item — mismos límites
  generales ya documentados para el resto del editor visual.
- Comportamiento responsive/mobile de la sección Shell.
- Persistencia entre sesiones del estado de colapso por item o de la sub-vista activa (Header/Sidebar): se
  resetean al recargar la página, igual que el resto del estado de sesión del editor.

## Requisitos funcionales

### Colapso por item
- Cada `menuItem` (raíz o dentro de `children`) y cada `sidebarItem` (cualquier profundidad) expone un control de
  colapso/expansión individual (`aria-expanded`), con estado por defecto colapsado (decisión revisada durante la
  implementación respecto al expandido-por-defecto original de esta spec: con todas las filas expandidas desde el
  primer render, un árbol con varias ramas reproduce la misma dificultad de lectura que esta feature busca
  resolver).
- El propio control de colapso muestra de forma permanente — tanto colapsado como expandido, no solo como fila
  sustituta al colapsar — el `label` de la fila tal cual está configurado (sin resolver referencias `{{...}}`,
  igual que el breadcrumb de `Layout`) y su `icon` si tiene. Pulsar sobre ese control oculta o muestra únicamente
  el formulario de campos propio del item (`label`, `icon`, `visibility`, selector de modo y campos derivados de
  `href`/`action`/`children`). No oculta a sus hijos: los hijos de un item colapsado siguen renderizados debajo,
  indentados, cada uno con su propio control de colapso independiente.
- Un item en modo "Con submenú"/"Con hijos" (es decir, con un array `children` no vacío) muestra, junto a su fila
  (colapsada o expandida), un icono indicador de rama distinto del `icon` propio del item, para poder distinguir a
  simple vista un item que tiene hijos de uno que no los tiene sin depender del estado de colapso. Un item sin
  `children` (modo "Sin acción", `href` o `action`) nunca muestra este icono.
- El contenedor de hijos de un item con `children` incluye un espacio superior antes de su primer hijo igual al
  espacio vertical (`gap`) que ya separa a items hermanos entre sí en esa misma lista, para que el primer hijo no
  quede pegado visualmente a la fila de su padre.
- Colapsar un item no deshabilita ninguna interacción sobre él ni sobre su subárbol: sigue siendo arrastrable,
  sigue aceptando otros items como hijos por arrastre, y su control de "añadir hijo nuevo" sigue operativo.
- Si un item colapsado tiene un aviso de commit rechazado pendiente (ver
  [[../../docs/app-features/development/dev-mode-editor.md#feedback-cuando-un-cambio-no-se-puede-guardar]]),
  el aviso se mantiene visible o accesible; colapsar un item nunca oculta en silencio un error de validación
  pendiente sobre alguno de sus campos.

### Arrastre extendido entre niveles
- Arrastrar un `menuItem`/`sidebarItem` ya existente hasta el cuerpo de otro item del mismo árbol lo anida como
  hijo de ese item, sujeto a las reglas de profundidad de ese árbol.
- Arrastrar un `menuItem`/`sidebarItem` ya existente hasta una zona de inserción entre hermanos — de su nivel
  actual, de otro padre, o de la lista raíz — lo mueve a esa posición ordinal, cambiando de padre cuando el
  destino pertenece a otro padre distinto del actual.
- Un destino de arrastre que resultaría en un `menuItem` de profundidad mayor a 1 (ver
  [[../../docs/app-features/shell/header.md#contrato-de-menuitem]]) se señala visualmente como inválido durante el
  arrastre (mismo lenguaje visual que ya usa el drop inválido del canvas de Layout) y no se acepta al soltar; el
  config no cambia en ese caso.
- `shell.sidebar.items`, sin tope de profundidad, acepta anidar a cualquier nivel mediante el mismo mecanismo.
- Arrastrar un item sobre sí mismo o sobre uno de sus propios descendientes es siempre un destino inválido (evita
  ciclos), igual que ya aplica en el canvas de Layout.
- Un intento de arrastre entre la lista de menú del header y el árbol del sidebar se trata como destino inválido;
  ambos árboles permanecen dominios de arrastre separados.
- Crear un item nuevo desde cero (alta mediante los controles de formulario ya existentes) sigue disponible sin
  cambios, en cualquier nivel del árbol, colapsado o no el padre de destino.

### Sub-vistas Header / Sidebar
- El dominio "Shell" de la barra flotante pasa a mostrar una sub-navegación con dos opciones: "Header" y "Sidebar".
  Solo una sub-vista es visible a la vez.
- La sub-vista "Header" agrupa: toggle "Header activo", logo, título, lista de menú y lista de acciones.
- La sub-vista "Sidebar" agrupa: toggle "Sidebar activo", `defaultCollapsed` y la lista de elementos del sidebar.
- Cambiar de sub-vista no descarta ni desmonta el estado de la otra: cualquier cambio ya aplicado permanece
  aplicado, y cualquier aviso de commit rechazado pendiente en la sub-vista no visible sigue presente al volver a
  ella.
- Ambas sub-vistas conservan el mismo pipeline de commit y de feedback de rechazo ya documentado para la sección
  Shell, sin cambios de comportamiento de guardado.

## Requisitos no funcionales
- Sin cambios en el contrato JSON de `shell` ni en su validación (`validate-shell.ts`, `runtime-config-zod.ts`):
  esta feature es exclusiva del editor en modo desarrollo.
- Sin cambios de comportamiento observable en producción ni en el runtime fuera de modo desarrollo.
- Los controles nuevos (colapso, sub-vistas, zonas de anidado) deben ser operables por teclado y con semántica ARIA
  adecuada, reutilizando patrones de accesibilidad ya establecidos en el runtime/editor (p. ej. `aria-expanded` de
  `accordion`, `role="tablist"`/`role="tab"` si aplica a la sub-navegación) en vez de introducir un patrón nuevo.
- Debe mantenerse el umbral mínimo global de cobertura de tests del 80% sobre `src/` ya exigido por el proyecto.

## Criterios de aceptación
1. Cada `menuItem` y cada `sidebarItem` tiene un control de colapso/expansión que, al activarse, oculta solo el
   formulario de campos de ese item y deja visibles e interactivos a sus hijos.
2. Con un item colapsado, sigue siendo posible: arrastrarlo, soltar otro item sobre su cuerpo para anidarlo, y usar
   su control de "añadir hijo nuevo".
3. Arrastrar un `sidebarItem` existente hasta el cuerpo de otro `sidebarItem` lo convierte en su hijo, a cualquier
   profundidad, sin límite.
4. Arrastrar un `menuItem` existente hasta el cuerpo de otro `menuItem` de profundidad 0 lo anida como hijo de
   profundidad 1.
5. Intentar anidar un `menuItem` que ya está en profundidad 1 dentro de otro item también en profundidad 1 (lo que
   resultaría en profundidad 2) se bloquea visualmente durante el arrastre y no se acepta al soltar.
6. Arrastrar un `sidebarItem`/`menuItem` a una zona de inserción de la lista raíz lo saca de su padre actual y lo
   sitúa en la posición ordinal correspondiente de la raíz.
7. Un intento de arrastrar un item del menú del header hasta el árbol del sidebar (o viceversa) no produce ningún
   cambio en el config.
8. El dominio "Shell" muestra dos sub-vistas ("Header", "Sidebar") mutuamente excluyentes; el toggle de activación,
   los campos y las listas de cada una siguen funcionando exactamente igual que hoy dentro de su sub-vista.
9. Un aviso de commit rechazado en un campo de la sub-vista no visible sigue mostrándose al volver a esa sub-vista,
   sin haberse perdido por el cambio de sub-vista.
10. El resto de comportamiento ya documentado de la sección Shell (alta/edición/borrado de items y acciones,
    reordenar dentro del mismo nivel, pipeline de commit y su feedback de rechazo) sigue funcionando sin
    regresión.
11. Un `menuItem`/`sidebarItem` con `children` no vacío muestra un icono indicador de rama junto a su fila, tanto
    colapsado como expandido; un item sin `children` nunca lo muestra.
12. La lista de hijos de un item con `children` muestra un espacio antes de su primer hijo igual al espacio entre
    hermanos de esa misma lista.

## Casos límite
- Colapsar un item que tiene un aviso de rechazo (`role="alert"`) pendiente sobre uno de sus campos: el aviso no
  puede quedar oculto en silencio.
- Mover (por arrastre) un item que tiene una rama expandida y con hijos colapsados/expandidos en distintos estados:
  el subárbol completo, incluido el estado de colapso de cada descendiente, viaja con él a la nueva posición sin
  alterarse.
- Arrastrar el último item visible de una lista de hermanos hasta la única zona de inserción disponible de esa
  misma lista (reordenar consigo mismo como único elemento): no debe producir ningún cambio ni error.
- Intentar anidar un item dentro de su propio descendiente (crear un ciclo): destino inválido, igual que en el
  canvas de Layout.
- Cambiar de sub-vista (Header ↔ Sidebar) mientras hay un arrastre en curso: el arrastre en curso se cancela sin
  aplicar cambios (no hay arrastre que cruce sub-vistas, dado que pertenecen a árboles de datos distintos).
- `shell.sidebar.items` vacío o `shell.header.menu` vacío: la sub-vista correspondiente muestra su estado vacío ya
  existente (sin lista que colapsar ni arrastrar), sin cambios respecto a hoy.

## Riesgos o preguntas abiertas
- La extensión del arrastre para anidar/desanidar entre niveles distintos, en listas recursivas de profundidad
  variable (sidebar) y de profundidad acotada (header), requiere decidir una estrategia técnica de geometría de
  zonas de drop (equivalente en espíritu a la ya resuelta para el grid del canvas de Layout en la feature `0106`,
  pero aplicada aquí a árboles recursivos en vez de a un grid). Se marca `requires_design: true` para resolver esa
  estrategia en `generate-feature-design` antes de planificar tareas.
- El mecanismo concreto de sub-navegación (p. ej. `role="tablist"` interno) se deja abierto a
  `generate-feature-design`/`generate-implementation-plan` en cuanto a detalle de implementación; el requisito de
  producto (dos sub-vistas mutuamente excluyentes, sin pérdida de estado entre ellas) ya queda fijado en esta spec.
