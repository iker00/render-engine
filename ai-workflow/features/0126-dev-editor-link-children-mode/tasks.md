# Tasks — 0126 — dev-editor-link-children-mode

Contrato de ejecución para la feature. Alcance: permitir que un nodo `link` alterne en el editor visual entre modo
"Texto" (`props.label`) y modo "Elementos anidados" (`children`), reutilizando las reglas de destino de drop ya
vigentes para `link`, extendiendo el placeholder vacío del canvas al nodo `link`, y relajando la validación previa
al render para aceptar `link` con `children: []` (cambio de contrato global, no exclusivo del editor).

Basado en `spec.md` y en las cinco decisiones de `design.md`. Se divide en tres tareas secuenciales:

1. **T1** — Relajar la validación cruzada de `validateLinkNode`: eliminar el rechazo de `link.children === []` en
   `src/config/validate-link-node.ts`. Cambio de contrato global. Habilita el resto del plan (T2 y T3 producen
   nodos con `children: []` en el estado en vivo).
2. **T2** — Extender el placeholder vacío del canvas (`EmptyContainerPlaceholder`, `EmptyPlaceholderNodeType`,
   `EMPTY_PLACEHOLDER_LABEL`, `isEmptyPlaceholderCandidate` en `src/runtime/layout-renderer.tsx`) para incluir
   `link` como tipo con placeholder vacío propio en modo Editor. Sin generalizar a `modal`/`accordion`.
3. **T3** — Widget dedicado "Contenido" del panel de propiedades para `link`, con alcance de escritura ampliado al
   nodo completo (no solo `props`). Integración en `layout-canvas-properties-panel.tsx` siguiendo el mismo
   precedente de composición que la sección "Acción de envío" del `form` (fuera del loop de `SUBSECTIONS`, con
   `onCommitNodeUpdate` que devuelve un nodo entero reconstruido).

Dependencias: T2 y T3 dependen ambas de T1, y son independientes entre sí. Se ejecutan en orden T1 → T2 → T3 para
mantener un cierre secuencial legible; T2 y T3 podrían pararlelizarse por otro agente si hiciera falta.

## Siguiente tarea a escoger

`0126-T1` — habilita el resto del plan (T2 y T3 dependen de que `children: []` deje de ser rechazado por el
pipeline de commit compartido).

---

## Task 0126-T1 — Relajar la validación de `link.children === []`

- **ID**: 0126-T1
- **Estado**: pending
- **Objetivo**: Eliminar el bloque imperativo de cross-validación que rechaza `link` con `children` presente pero
  vacío en `src/config/validate-link-node.ts` (hoy: "Cross-validation (4): children cannot be empty", líneas 119-121
  del fichero actual), sin tocar el resto de reglas cruzadas de `link`. Tras la tarea, un config con
  `{ type: 'link', props: { href: '#' }, children: [] }` pasa `validateRuntimeConfig` con éxito y el runtime lo
  renderiza como un `<a>` vacío (comportamiento ya soportado por el componente de render — condiciona por presencia
  de `children`, no por longitud).
- **Fuera de alcance**:
  - No tocar `linkNodeSchema` (`src/config/runtime-config-zod.ts`): el schema Zod ya declara `children` como
    `z.array(...).optional()` sin `.min(1)`.
  - No tocar `checkLinkChildrenAllowedTypes` (la comprobación recursiva de tipos permitidos): un array vacío la
    satisface vacuamente.
  - No tocar la regla de mutua exclusión `label` + `children` ni la regla `props.icon`/`iconPosition` + `children`.
  - No tocar `nodeTypeAcceptsChildren` ni el render del nodo `link` en `src/runtime/nodes/`.
  - No tocar la paleta de nodos ni los valores por defecto (`buildDefaultNodeInstance` sigue creando `link` en
    modo texto).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/validate-link-node.ts` (modificar: retirar el bloque "children cannot be empty").
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliar).
  - Documentación afectada (no se toca en esta tarea; ver el campo `documentación afectada` de cierre):
    - `ai-workflow/docs/app-features/nodes/link.md`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - Un `link` con `props: { href: '#' }` y `children: []` (sin `props.label`) pasa `validateRuntimeConfig` con
      éxito (antes se rechazaba con diagnóstico `link children cannot be empty.`).
    - Un `link` con `props: { href: '#' }` y `children: []` también pasa cuando el `link` está anidado dentro de un
      `container`, para confirmar que la relajación aplica en cualquier profundidad, no solo en la raíz.
    - Regresión: un `link` con `props.label: 'x'` + `children: []` sigue rechazándose por la regla de mutua
      exclusión existente (`link nodes cannot have both props.label and children.`), no por la regla eliminada.
    - Regresión: un `link` sin `props.label` y sin `children` (ninguno de los dos) sigue rechazándose con el
      diagnóstico existente `link nodes must have either props.label or children.`.
    - Regresión: un `link` con `children` no vacío que contiene un tipo no permitido (p. ej. `button`) sigue
      rechazándose con el diagnóstico existente del catálogo cerrado (`link children may only be ...`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
  - **Restricciones**: reusar los helpers existentes de `src/tests/config-validation/helpers.ts` para montar
    fixtures de config; no crear un harness paralelo.
- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se edita aquí):
  - `ai-workflow/docs/app-features/nodes/link.md` — sección "Casos límite" (retirar la línea `**children vacío**:
    se rechaza en validación previa.`) y sección "Validación previa al render" (retirar la regla `Si children está
    presente, debe no estar vacío. Un array vacío children: [] rechaza el config con diagnóstico link children
    cannot be empty.`).
- **Criterios de finalización**:
  - `validateLinkNode` deja de rechazar `link` con `children: []` y todos los tests nuevos y de regresión pasan.
- **Cierre de implementación**: el bloque de validación se ha eliminado, la suite de validación de link cubre el
  nuevo comportamiento y la regresión de las tres reglas cruzadas restantes, y `pnpm test --run
  src/tests/config-validation/runtime-config-validation-buttons.test.ts` está en verde.

---

## Task 0126-T2 — Extender el placeholder vacío del canvas al nodo `link`

- **ID**: 0126-T2
- **Estado**: pending
- **Objetivo**: Extender el mecanismo del placeholder vacío de contenedor de `src/runtime/layout-renderer.tsx` para
  incluir `link` como tercer tipo con placeholder vacío propio en modo Editor. Concretamente:
  - Añadir `'link'` al union type `EmptyPlaceholderNodeType` (hoy `'container' | 'form'`, línea 137).
  - Añadir la entrada correspondiente en `EMPTY_PLACEHOLDER_LABEL` con etiqueta análoga a las existentes
    (p. ej. `"Enlace vacío"` — mismo criterio que `"Contenedor vacío"`/`"Formulario vacío"`).
  - Ajustar `isEmptyPlaceholderCandidate` (línea 144) para reconocer `link` con `children` presente y de longitud
    cero, con el mismo criterio que ya aplica a `container`/`form`.

  Tras la tarea, un `link` con `children: []` renderizado bajo un `LayoutEditModeProvider` activo muestra el mismo
  placeholder visible (borde punteado y etiqueta), seleccionable y conectado a `useDroppable` con `nodeType:
  'link'`, que ya usan `container`/`form`. En producción (sin provider) el mismo `link` sigue sin mostrar
  placeholder.
- **Fuera de alcance**:
  - No generalizar el mecanismo a `modal`/`accordion` (`nodeTypeAcceptsChildren` seguirá siendo más ancho que
    `EmptyPlaceholderNodeType`; ver design D3).
  - No tocar `EmptyContainerPlaceholder` en su lógica interna: ya es agnóstico de tipo salvo por el label mostrado
    y por el `type` pasado a `useDroppable`. Aceptar `'link'` es un cambio de tipos, no de lógica.
  - No tocar el componente de render del nodo `link` en `src/runtime/nodes/`: su rama de render ya condiciona por
    presencia de `children`, no por longitud, así que `children: []` ya produce un `<a>` vacío en producción una
    vez la validación deja de rechazarlo.
  - No tocar la capa de arrastre/drop (`insertIntoParentNode`, `withChildren`, `isValidDropTarget`,
    `LINK_ALLOWED_CHILD_TYPES`): ver design D4.
- **Dependencias**: `0126-T1` (los tests montan un config con `link.children: []` que hoy sería rechazado por el
  validador; sin T1 no hay forma de ejercer el placeholder end-to-end sin bypasear el pipeline).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/layout-renderer.tsx` (modificar: `EmptyPlaceholderNodeType`, `EMPTY_PLACEHOLDER_LABEL`,
      `isEmptyPlaceholderCandidate`).
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` (ampliar).
  - Documentación afectada (no se toca en esta tarea; ver el campo `documentación afectada` de cierre):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Contenedores y formularios vacíos
      (modo Editor)".
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - Un `link` con `props: { href: '#' }` y `children: []` renderizado bajo `LayoutEditModeProvider` activo
      muestra el placeholder visible con la etiqueta correspondiente y el borde punteado, con el mismo shape que
      ya cubren los casos de `container` y `form` vacíos en el mismo fichero.
    - El placeholder del `link` vacío es seleccionable (hace click y llama a `onSelectNode` con el `path` del
      `link`) igual que el de `container`/`form`.
    - El placeholder del `link` vacío está conectado como zona droppable con `nodeType: 'link'`, para que las
      reglas de destino de drop existentes lo reconozcan como el `link` mismo (equivalente al comportamiento ya
      cubierto para `container`/`form`).
    - Regresión: el mismo `link` con `children: []` renderizado **sin** `LayoutEditModeProvider` (producción) no
      muestra ningún placeholder: el `<a>` se emite vacío, sin borde punteado ni etiqueta.
    - Regresión: un `link` con `props.label: 'x'` (modo texto) no muestra placeholder ni en modo Editor ni en
      producción; el nodo `container`/`form` vacío sigue mostrando placeholder solo en modo Editor.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx`
  - **Restricciones**: reutilizar el harness de renderizado y los helpers de `LayoutEditModeProvider` ya usados en
    ese fichero para `container`/`form`; no crear un provider mock paralelo. La etiqueta del placeholder
    (`"Enlace vacío"`) debe mantenerse consistente con la convención existente (`"Contenedor vacío"`,
    `"Formulario vacío"`) — si se decide otra, dejarla explícita en el test.
- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se edita aquí):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Contenedores y formularios vacíos
    (modo Editor)" para reflejar que `link` con `children: []` ahora también muestra placeholder equivalente.
- **Criterios de finalización**:
  - `EmptyPlaceholderNodeType` incluye `'link'`, `EMPTY_PLACEHOLDER_LABEL` tiene su entrada, y
    `isEmptyPlaceholderCandidate` reconoce `link` con `children: []`; los tests nuevos y de regresión pasan.
- **Cierre de implementación**: los tres puntos de extensión en `layout-renderer.tsx` están tocados de forma
  mínima, el test de placeholders cubre `link` en modo Editor y su regresión de producción, y `pnpm test --run
  src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` está en verde.

---

## Task 0126-T3 — Widget "Contenido" del panel de propiedades del `link`

- **ID**: 0126-T3
- **Estado**: pending
- **Objetivo**: Añadir al panel de propiedades del nodo `link` un widget dedicado "Contenido" que ofrezca un
  selector con dos opciones ("Texto", "Elementos anidados") y ejecute la conversión de modo (reconstrucción
  completa del nodo) al cambiar la selección, con alcance de escritura ampliado al nodo completo (no solo `props`).

  Concretamente:
  - Crear `src/dev-runtime/layout-canvas/property-fields/link-content-mode-property-field.tsx` con la firma
    equivalente a `ChoiceItemsPropertyField` pero recibiendo el **nodo completo** en lugar de un sub-valor de
    `props`, y devolviendo un **nodo completo** en el `onChange` — a diferencia del resto de widgets del panel, que
    escriben sobre un sub-path.
  - Integrar el widget en `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` como una sección
    adicional que solo se renderiza cuando `node.type === 'link'`, siguiendo el mismo precedente de composición
    que la sección "Acción de envío" del `form` (renderizada fuera del loop `SUBSECTIONS.map(...)`, con
    `onCommitNodeUpdate(path, (currentNode) => nextNode)` devolviendo el nodo reconstruido). La sección se
    renderiza **antes** de `Props`/`Layout`/`Visibilidad`/`Estado de consulta`, análogo al precedente visual del
    selector de variante de acción, para que el usuario decida primero la forma del contenido y luego edite sus
    detalles.
  - Detección del modo activo por forma del nodo, sin campo de estado adicional:
    - `props.label` presente → modo "Texto".
    - `children` presente → modo "Elementos anidados".
    - En cualquier otra forma (nunca debería ocurrir si la validación aceptó el nodo), caer a "Texto" como
      fallback silencioso, mismo criterio de tolerancia que `ChoiceItemsPropertyField.detectMode` para valores
      no reconocibles.
  - Reconstrucción al cambiar de modo:
    - "Texto" → "Elementos anidados": retirar `props.label`, `props.icon`, `props.iconPosition`; añadir
      `children: []`. `props.href`, `props.download`, `props.target`, `props.action` sobreviven exactamente igual
      (mismas claves con los mismos valores).
    - "Elementos anidados" → "Texto": retirar `children` (y todo su subárbol); añadir `props.label: 'Enlace'` sin
      `props.icon`. `props.href`, `props.download`, `props.target`, `props.action` sobreviven exactamente igual.
    - Elegir el modo ya activo (sin cambio real) no debe emitir un commit — mismo criterio que ya aplica el resto
      del panel para cambios idempotentes.
  - Alcance de escritura ampliado: al necesitar mutar el nodo completo (no solo `props`), el callback interno debe
    apoyarse en el mismo mecanismo de patch de nodo entero que ya usa el botón "Eliminar nodo" del panel, es decir
    `onCommitNodeUpdate(path, (currentNode) => nextNode)`. Esto marca la primera vez en el panel que un widget
    fuera del flujo de borrado escribe el nodo completo; ese hecho debe quedar explícito en el propio nombre del
    componente (`LinkContentModePropertyField`) para que una revisión futura no lo confunda con una instancia más
    de `DiscriminatedUnionPropertyField`.
  - Contrato visual: dropdown con las dos opciones, mismo look-and-feel que el selector de variante de acción ya
    existente (requisito no funcional 3 de la spec). No se comparte la maquinaria de detección de unión
    discriminada; ver design D1 y "Restricciones" abajo.
- **Fuera de alcance**:
  - No tocar el dispatcher genérico (`property-field-dispatcher.tsx`) ni `getDiscriminatedUnionVariants` (ver
    design D1).
  - No introducir un `x-widget` nuevo dentro del sub-schema de `props`: el widget no se registra por schema
    porque su alcance de escritura no está confinado a `props` (ver design D1).
  - No tocar `insertIntoParentNode`, `withChildren`, `isValidDropTarget` ni `LINK_ALLOWED_CHILD_TYPES` (ver
    design D4).
  - No tocar la paleta ni `buildDefaultNodeInstance('link')`: sigue creando el `link` en modo "Texto".
  - No añadir deshacer/rehacer del cambio de modo (queda fuera de esta feature, igual que el resto de mutaciones
    del canvas).
- **Dependencias**: `0126-T1` (la conversión "Texto" → "Elementos anidados" produce `children: []` que hoy es
  rechazado por `validateRuntimeConfig`, así que sin T1 el commit del widget siempre acabaría descartado por el
  pipeline compartido). `0126-T2` no es dependencia técnica, pero la aceptación end-to-end de esta tarea (poder
  arrastrar un `heading` sobre el placeholder resultante) solo es completa cuando T2 esté cerrada; el widget se
  puede implementar y testar aislado antes de T2, pero el criterio de aceptación 1 de la spec exige las tres
  tareas cerradas.
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/link-content-mode-property-field.tsx` (nuevo).
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificar: añadir la sección del widget
      condicionada a `node.type === 'link'`, fuera del loop de `SUBSECTIONS`).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-link-content-mode.test.tsx` (nuevo).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliar).
  - Documentación afectada (no se toca en esta tarea; ver el campo `documentación afectada` de cierre):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
    - `ai-workflow/docs/app-features/nodes/link.md`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-link-content-mode.test.tsx` (nuevo) — cubre el widget
      aislado, con un `onCommitNodeUpdate` mockeado que captura la mutación completa emitida.
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación) — cubre la integración del
      widget en el panel real (que el widget se monte solo para `node.type === 'link'`, y que su commit vaya por
      el mismo `onCommitNodeUpdate` que el resto de subsecciones).
  - **Comportamiento cubierto** (widget aislado, fichero nuevo):
    - Detección del modo activo por forma del nodo: un `link` con `props.label` activa la opción "Texto"; un
      `link` con `children` activa "Elementos anidados"; un `link` con ninguna de las dos formas (contra-fáctico)
      cae a "Texto" sin lanzar.
    - El selector renderiza dos opciones legibles ("Texto", "Elementos anidados") con el mismo shape de dropdown
      que el selector de variante de acción existente (mismo elemento base y `aria-label`/`role` equivalentes).
    - Cambio "Texto" → "Elementos anidados": el nodo emitido en `onCommitNodeUpdate` tiene `children: []`, sin
      `props.label`, sin `props.icon`, sin `props.iconPosition`; conserva `props.href`, `props.download`,
      `props.target` y `props.action` con sus valores originales cuando estaban declarados.
    - Cambio "Elementos anidados" → "Texto": el nodo emitido tiene `props.label: 'Enlace'`, sin `children`, sin
      `props.icon`; conserva `props.href`, `props.download`, `props.target` y `props.action` con sus valores
      originales.
    - Cambio a la opción ya activa no dispara `onCommitNodeUpdate` (idempotencia).
    - Caso spec (casos límite): un `link` con `props.icon` + `props.label` cambia a "Elementos anidados" y el
      nodo emitido no conserva ni `icon` ni `iconPosition` ni `label`.
    - Caso spec (casos límite): un `link` con `props.action: { type: 'navigateTo', pageId: '...' }` (sin `href`)
      sobrevive sin cambios en la clave `action` en ambos sentidos de la conversión.
  - **Comportamiento cubierto** (integración panel, ampliación):
    - El widget "Contenido" solo se renderiza cuando el nodo seleccionado es un `link`; para `container`, `form`,
      `button`, `heading` (y una selección representativa del resto del catálogo) el panel no muestra la
      subsección.
    - Cuando el widget está montado, aparece junto al resto de subsecciones (`Props`, `Layout`, `Visibilidad`,
      `Estado de consulta`), con la etiqueta "Contenido".
    - Un cambio de modo del widget viaja por el mismo `onCommitNodeUpdate(path, patchFn)` que el resto del panel:
      el mock del test captura una llamada con `path` correcto y `patchFn` que, aplicado al nodo, devuelve la
      reconstrucción esperada.
    - Regresión: la matriz existente de `submitAction`, subsecciones y `pendingRejections` sigue funcionando
      igual (no se rompe ninguno de los tests ya presentes en el fichero).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-link-content-mode.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - **Restricciones**:
    - Reutilizar el mismo shape de mock de `onCommitNodeUpdate` y los helpers de fixture de nodo ya usados por
      `layout-canvas-properties-panel.test.tsx` y por `layout-canvas-property-field-choice-items.test.tsx`; no
      crear un harness paralelo.
    - No añadir un test que confirme end-to-end que arrastrar un `heading` sobre el placeholder resultante inserta
      el nodo: ese flujo end-to-end está cubierto por la matriz combinada de `layout-canvas-drop-validity.test.ts` /
      `layout-canvas-palette-insert.test.tsx` / `layout-renderer-edit-mode-placeholders.test.tsx` una vez las tres
      tareas están cerradas, y volver a probarlo aquí duplicaría cobertura sin aportar información nueva. Los
      criterios de aceptación 1-3 de la spec se validan combinando las suites existentes tras T1+T2+T3.
    - Durante la implementación de T3, verificar puntualmente que `layout-canvas-palette-insert.test.tsx` ya
      cubre `link` como destino de drop (no solo `container`/`form`); si no lo hace, añadir un único caso mínimo
      para no depender de "por analogía con container" al cerrar el criterio de aceptación 1 de la spec.
- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se edita aquí):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — nueva subsección o extensión de la existente
    para documentar el widget "Contenido" del `link`, su detección por forma del nodo y su reconstrucción.
  - `ai-workflow/docs/app-features/nodes/link.md` — nota sobre el mecanismo de activación del modo "Elementos
    anidados" desde el editor visual (junto al resto de comportamiento ya documentado).
- **Criterios de finalización**:
  - El widget aislado y su integración en el panel pasan los tests; un `link` con `props.label` mostrado en el
    panel ofrece el selector "Contenido" con "Texto" preseleccionado, y cambiar a "Elementos anidados" reconstruye
    el nodo cumpliendo el contrato de la spec.
- **Cierre de implementación**: el nuevo componente vive en
  `src/dev-runtime/layout-canvas/property-fields/link-content-mode-property-field.tsx`, la integración en
  `layout-canvas-properties-panel.tsx` monta la sección solo para `node.type === 'link'`, ambos ficheros de test
  (`layout-canvas-property-field-link-content-mode.test.tsx` nuevo y `layout-canvas-properties-panel.test.tsx`
  ampliado) están en verde, y `pnpm test --run <cada fichero>` de la lista de comandos también.
