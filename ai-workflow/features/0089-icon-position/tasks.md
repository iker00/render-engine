# Tasks — 0089: posición de icono en input, button y link

Contrato de ejecución secuencial para añadir `props.iconPosition: "left" | "right"` opcional a los nodos `input`, `button` y `link`. La validación se cierra en una primera tarea para que las tres tareas de render posteriores trabajen contra un contrato ya estable; el orden 1 → 2 → 3 → 4 es obligatorio.

Reglas universales:
- `pnpm test` queda como gate global de cobertura al cerrar la última tarea; no se repite por tarea.
- `props.iconPosition` solo tiene efecto cuando `props.icon` existe y resuelve a un icono Lucide conocido. Si `icon` está ausente o no resuelve, `iconPosition` se ignora silenciosamente sin lanzar error.
- El valor por defecto implícito de `iconPosition` es `"left"`. Configs existentes sin `iconPosition` deben renderizar exactamente igual que hoy.
- El posicionamiento se implementa exclusivamente con utilidades Tailwind, coherente con el resto del runtime.

---

## T1 — Extender contrato de tipos, schemas Zod y validadores para `props.iconPosition`

### Estado
completed

### Objetivo
Añadir `iconPosition?: 'left' | 'right'` al contrato declarativo de los tres nodos (`input`, `button`, `link`) en su tipo TypeScript, en su esquema Zod y en sus validadores, de forma que:
- los tres nodos acepten `iconPosition: "left"` o `iconPosition: "right"` sin error,
- los tres nodos rechacen cualquier valor fuera del enum con `invalid-layout` y ruta exacta (`{path}.props.iconPosition`),
- los nodos normalizados arrastren `iconPosition` cuando esté declarado y no lo añadan cuando esté ausente,
- en `link`, declarar `iconPosition` junto con `children` se rechace con el mismo diagnóstico literal que usa hoy la restricción `icon + children` (`link nodes cannot have both props.icon and children.`), sin introducir un mensaje nuevo.

Esta tarea cierra el contrato de configuración. Las tareas de render confiarán en que `iconPosition` ya viene normalizado y validado.

### Fuera de alcance
- Cualquier cambio en el render visual de los nodos (`button-layout-node.tsx`, `input-layout-node.tsx`, `link-layout-node.tsx`).
- Añadir nuevos helpers de estilo en `runtime-node-styling.ts`.
- Tocar nodos distintos de `input`, `button` y `link`.
- Reescribir mensajes de error ya existentes para `icon + children` en `link`.

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-types.ts` (mod) — añadir `iconPosition?: 'left' | 'right'` en `InputLayoutNode.props`, `ButtonLayoutNode.props` y `LinkLayoutNode.props`.
  - `src/config/runtime-config-zod.ts` (mod) — añadir `iconPosition: z.enum(['left', 'right']).optional()` en `inputNodeSchema.props`, `buttonNodeSchema.props` y `linkNodeSchema.props`. Si conviene, exportar `supportedIconPositions = ['left', 'right'] as const` y reutilizarlo en los tres esquemas; no es obligatorio si añade más complejidad que claridad.
  - `src/config/validate-layout-nodes.ts` (mod) — en `validateButtonNode` propagar `iconPosition` al objeto `props` normalizado; en `validateButtonNode` y `validateLinkNode` mapear el issue Zod cuya ruta sea `['props', 'iconPosition']` a `invalidLayout(... "${path}.props.iconPosition" ...)`; en `validateLinkNode` extender la cross-validation existente para que si `hasChildren && hasIconPosition` se rechace con el literal `link nodes cannot have both props.icon and children.` (mismo mensaje que la regla existente para `icon + children`), y propagar `iconPosition` al `props` normalizado cuando aplique.
  - `src/config/validate-form-nodes.ts` (mod) — en el validador del nodo `input` mapear el issue Zod cuya ruta sea `['props', 'iconPosition']` a `invalidLayout(... "${path}.props.iconPosition" ...)` y propagar `iconPosition` al `props` normalizado cuando esté declarado.
- Tests:
  - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación) — bloque dedicado al contrato de `iconPosition` en `input`.
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación) — dos bloques nuevos: contrato de `iconPosition` en `button` y contrato de `iconPosition` en `link` (incluida la cross-validation con `children`).
- Documentación:
  - `ai-workflow/docs/app-features/nodes/input.md` — declarar `props.iconPosition` en el contrato.
  - `ai-workflow/docs/app-features/nodes/button.md` — declarar `props.iconPosition` en el contrato.
  - `ai-workflow/docs/app-features/nodes/link.md` — declarar `props.iconPosition`, marcar que solo aplica en modo `props.label` y reflejar que la restricción `children + iconPosition` reutiliza el diagnóstico existente.

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)

**Comportamiento cubierto**
- `input` acepta `props.iconPosition: "left"` y el nodo normalizado conserva `props.iconPosition: "left"`.
- `input` acepta `props.iconPosition: "right"` y el nodo normalizado conserva `props.iconPosition: "right"`.
- `input` sin `props.iconPosition` produce un nodo normalizado sin la clave `iconPosition` (no se añade por defecto, no rompe configs existentes).
- `input` con `props.iconPosition: "center"` rechaza el config con `code: 'invalid-layout'` y mensaje cuya ruta sea exactamente `<path>.props.iconPosition`.
- `input` con `props.iconPosition` declarado y sin `props.icon` se acepta y el nodo normalizado conserva `iconPosition` (la suppression visual se valida en la tarea de render).
- `button` acepta `props.iconPosition: "left"` y `"right"`, ambos quedan reflejados en el nodo normalizado.
- `button` sin `props.iconPosition` produce un nodo normalizado sin la clave `iconPosition`.
- `button` con `props.iconPosition: "center"` rechaza el config con `code: 'invalid-layout'` y ruta `<path>.props.iconPosition`.
- `button` con `props.iconPosition` declarado y sin `props.icon` se acepta y el nodo normalizado conserva `iconPosition`.
- `link` con `props.label` y `props.iconPosition: "right"` se acepta y el nodo normalizado conserva `props.iconPosition`.
- `link` con `props.label` sin `props.iconPosition` produce un nodo normalizado sin la clave `iconPosition`.
- `link` con `props.iconPosition: "center"` rechaza el config con `code: 'invalid-layout'` y ruta `<path>.props.iconPosition`.
- `link` con `children` y `props.iconPosition` declarado (sin `props.icon`) rechaza el config con el mensaje literal `Page "<pageId>" has an invalid layout at "<path>": link nodes cannot have both props.icon and children.` (mismo diagnóstico que la regla existente `icon + children`).
- `link` con `props.label` y `props.iconPosition` declarado sin `props.icon` se acepta y el nodo normalizado conserva `iconPosition`.

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`

**Restricciones**
- Reutilizar el harness de creación de configs ya presente en ambos ficheros; no añadir builders nuevos.
- No mover los tests existentes de `iconPosition` a un fichero nuevo. Mantener la convención `un fichero por área` ya establecida en `test-index.md`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/input.md`
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/docs/app-features/nodes/link.md`

### Criterios de finalización
- Los tres nodos aceptan `iconPosition: "left" | "right"` con el `props` normalizado coherente.
- Cualquier valor fuera del enum produce `invalid-layout` con la ruta exacta `<path>.props.iconPosition` en los tres nodos.
- La cross-validation `children + iconPosition` de `link` produce exactamente el literal `link nodes cannot have both props.icon and children.`.
- Los ficheros de test de la tarea pasan en verde con los comandos declarados arriba.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T2 — Render de `button` con `iconPosition: right`

### Estado
completed

### Objetivo
Ajustar `ButtonNode` para que cuando el icono resuelva y `props.iconPosition === 'right'`, el icono se renderice a la derecha del label en lugar de a la izquierda. Cuando `iconPosition` sea `"left"`, esté ausente o el icono no resuelva, el render debe ser exactamente el actual.

### Fuera de alcance
- Cambios en el render de `input` o `link`.
- Cambios en el contrato de validación (cerrado en T1).
- Introducir nuevos helpers en `runtime-node-styling.ts` (`button` ya pinta el icono con `className="size-4 shrink-0"` inline).

### Dependencias
T1.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/button-layout-node.tsx` (mod) — leer `node.props.iconPosition`, condicionar el orden de `IconNode` y `label` dentro del `<button>`. La rama por defecto debe seguir siendo `icon` antes que `label` para preservar el comportamiento actual cuando `iconPosition` está ausente.
- Tests:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación) — añadir casos dentro del `describe('button node with props.icon', ...)` existente.
- Documentación:
  - `ai-workflow/docs/app-features/nodes/button.md` — describir el efecto visual de `iconPosition: "right"` y la regla de ignorado silencioso cuando `icon` está ausente o no resuelve.

### Tests

**Ficheros de test**
- `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación)

**Comportamiento cubierto**
- Un `button` con `props.icon: "ArrowRight"` y `props.iconPosition: "right"` renderiza el `<svg>` del icono **después** del nodo de texto del label dentro del `<button>` (verificar el orden de los hijos del botón, no la clase exacta).
- Un `button` con `props.icon: "Search"` y `props.iconPosition: "left"` renderiza el `<svg>` antes del label (comportamiento actual).
- Un `button` con `props.icon: "Search"` sin `props.iconPosition` renderiza el `<svg>` antes del label (no regresión; orden idéntico al estado actual).
- Un `button` con `props.iconPosition: "right"` sin `props.icon` no renderiza ningún `<svg>` y el label sigue siendo el único contenido (ignorado silencioso).
- Un `button` con `props.icon: "NonExistentIconXyz"` y `props.iconPosition: "right"` no renderiza ningún `<svg>` (icono no resuelto, regla de degradación silenciosa heredada de `IconNode`).
- Las clases de `color`/`variant`/`fullWidth` se mantienen idénticas independientemente de `iconPosition` (no regresión visual).

**Comandos durante la implementación**
- `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`

**Restricciones**
- No introducir helpers nuevos: la solución debe ser local al componente.
- No verificar el orden con snapshots; usar consultas explícitas sobre el árbol renderizado.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/button.md`

### Criterios de finalización
- `button` renderiza el icono a la derecha cuando `iconPosition === 'right'` y mantiene el comportamiento actual en el resto de casos.
- Los tests del fichero pasan en verde con el comando declarado.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T3 — Render de `input` con `iconPosition: right`

### Estado
completed

### Objetivo
Ajustar `InputNode` para que cuando el icono resuelva y `props.iconPosition === 'right'`, el holder del icono se renderice a la derecha del control `<input>` en lugar de a la izquierda, manteniendo la misma estética compartida del campo (borde, foco, error). Cuando `iconPosition` sea `"left"`, esté ausente o el icono no resuelva, el render debe ser exactamente el actual.

### Fuera de alcance
- Cambios en `button` o `link`.
- Cambios en el contrato de validación.
- Introducir un componente intermedio nuevo. La adaptación debe vivir entre `InputNode` y los helpers de `runtime-node-styling.ts`.

### Dependencias
T1, T2.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/input-layout-node.tsx` (mod) — leer `node.props.iconPosition`, decidir si el holder se renderiza antes o después del `<input>` dentro del wrapper, y pasar el lado al helper de estilos cuando aplique.
  - `src/runtime/runtime-node-styling.ts` (mod) — extender o duplicar el helper `getInputIconHolderClassName` (actualmente con `border-r`) para soportar también el caso derecho con `border-l`. Aceptable cualquiera de estas dos formas:
    - convertir el helper en `getInputIconHolderClassName(position: 'left' | 'right')` y ajustar el call site del input,
    - o añadir un helper hermano `getInputIconHolderClassNameRight()` y mantener el actual para `left`.
    Mantener clases coherentes con la estética actual (`bg-neutral-50`, `flex items-center justify-center px-3`, `shrink-0`, sólo cambia el lado del borde).
- Tests:
  - `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación) — añadir casos dentro del `describe('input icon', ...)` existente.
- Documentación:
  - `ai-workflow/docs/app-features/nodes/input.md` — describir el efecto visual de `iconPosition: "right"`.

### Tests

**Ficheros de test**
- `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación)

**Comportamiento cubierto**
- Un `input` con `props.icon: "Mail"` y `props.iconPosition: "right"` renderiza el holder del icono **después** del `<input>` dentro del wrapper compartido (verificar el orden DOM entre el control y el contenedor del `<svg>`).
- Un `input` con `props.icon: "Mail"` y `props.iconPosition: "left"` renderiza el holder del icono antes del `<input>` (comportamiento actual).
- Un `input` con `props.icon: "Mail"` sin `props.iconPosition` renderiza el holder del icono antes del `<input>` (no regresión).
- Un `input` con `props.iconPosition: "right"` sin `props.icon` renderiza el control con el estilo simple (sin wrapper de icono, sin `<svg>`), idéntico al caso "sin icono".
- Un `input` con `props.icon: "NonExistentIconXyz"` y `props.iconPosition: "right"` renderiza el control con el estilo simple (icono no resuelto, regla de degradación silenciosa).
- Un `input` con `props.icon: "Mail"`, `props.iconPosition: "right"` y validación que produce error mantiene el holder del icono a la derecha y conserva `aria-describedby` apuntando al span de error (no regresión sobre la a11y del campo).

**Comandos durante la implementación**
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`

**Restricciones**
- Reutilizar el wrapper y los helpers ya existentes; no recrear la estructura visual del campo desde cero.
- No verificar clases internas del icono mediante coincidencia exacta; comprobar el orden DOM y la presencia/ausencia del `<svg>`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/input.md`

### Criterios de finalización
- `input` renderiza el holder del icono a la derecha cuando `iconPosition === 'right'` y mantiene el comportamiento actual en el resto de casos.
- El borde del holder cambia de lado (`border-l` cuando el icono está a la derecha) coherente con la estética actual.
- Los tests del fichero pasan en verde con el comando declarado.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T4 — Render de `link` con `iconPosition: right`

### Estado
completed

### Objetivo
Ajustar `LinkNode` para que en modo `props.label`, cuando el icono resuelva y `props.iconPosition === 'right'`, el icono se renderice a la derecha del label en lugar de a la izquierda. Cuando `iconPosition` sea `"left"`, esté ausente o el icono no resuelva, el render debe ser exactamente el actual. El modo `children` queda fuera por el contrato existente.

### Fuera de alcance
- Cambios en `button` o `input`.
- Cualquier cambio en la rama `children` del `LinkNode` (`iconPosition` no aplica ahí; la cross-validation ya lo cubre en T1).
- Tocar utilidades comunes de href/action (`link-action-href.ts`).

### Dependencias
T1, T2, T3.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/link-layout-node.tsx` (mod) — leer `node.props.iconPosition`, condicionar el orden de `IconNode` y `label` dentro de la rama `props.label` del anchor. El margen actual del icono (`mr-1`) debe convertirse en `ml-1` cuando el icono va a la derecha; el resto de clases (`size-4 shrink-0 inline-block align-middle`) se mantienen.
- Tests:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación) — añadir casos dentro del `describe('link node render', ...)` existente.
- Documentación:
  - `ai-workflow/docs/app-features/nodes/link.md` — describir el efecto visual de `iconPosition: "right"` en modo `props.label` y reiterar que no aplica en modo `children`.

### Tests

**Ficheros de test**
- `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación)

**Comportamiento cubierto**
- Un `link` con `props.label`, `props.icon: "ExternalLink"` y `props.iconPosition: "right"` renderiza el `<svg>` del icono **después** del texto del label dentro del `<a>`.
- Un `link` con `props.label`, `props.icon: "ExternalLink"` y `props.iconPosition: "left"` renderiza el `<svg>` antes del label (comportamiento actual).
- Un `link` con `props.label`, `props.icon: "ExternalLink"` sin `props.iconPosition` renderiza el `<svg>` antes del label (no regresión).
- Un `link` con `props.label`, `props.iconPosition: "right"` sin `props.icon` no renderiza ningún `<svg>` y el `<a>` solo contiene el label (ignorado silencioso).
- Un `link` con `props.label`, `props.icon: "NonExistentIconXyz"` y `props.iconPosition: "right"` no renderiza ningún `<svg>` (icono no resuelto, regla de degradación silenciosa).
- Cuando el icono va a la derecha, su `className` usa `ml-1` en lugar de `mr-1` para mantener la separación visual con el label (verificar la presencia de la utilidad sobre el `<svg>`, no la clase completa).

**Comandos durante la implementación**
- `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`

**Restricciones**
- No verificar el orden con snapshots; usar consultas explícitas sobre el árbol renderizado.
- No tocar la rama `children` del anchor; los tests existentes de `link con children` deben seguir verdes sin modificación.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/link.md`

### Criterios de finalización
- `link` en modo label renderiza el icono a la derecha cuando `iconPosition === 'right'` y mantiene el comportamiento actual en el resto de casos.
- La utilidad de margen del icono cambia coherentemente (`ml-1` cuando va a la derecha).
- Los tests del fichero pasan en verde con el comando declarado.
- `pnpm test` global pasa en verde con la cobertura ≥ 80% en `functions`, `lines` y `statements`.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## Siguiente tarea a escoger
T1 — Extender contrato de tipos, schemas Zod y validadores para `props.iconPosition`.
