# Plan de implementación: `accordion` node (0052)

## Resumen

Cuatro tareas secuenciales:

1. Contrato de tipos y esquema Zod del nodo `accordion`.
2. Validación previa al render en `src/config/`.
3. Componente React `AccordionNode` con lógica de grupo y accesibilidad.
4. Registro en el dispatcher central y cobertura de integración de render.

---

## Tarea T-01 — Tipos TypeScript y esquema Zod del nodo `accordion`

**ID**: T-01
**Estado**: pendiente
**Dependencias**: ninguna

### Objetivo

Declarar el tipo TypeScript `AccordionLayoutNode` y el esquema Zod `accordionNodeSchema` que modela el contrato del nodo `accordion` (props, children, campos transversales). Añadir `accordion` al union `LayoutNodeType`, al union `LayoutNode` y al array `supportedNodeTypes`.

### Fuera de alcance

- Lógica de validación cruzada (T-02).
- Componente React (T-03).
- Registro en el dispatcher (T-04).
- Ningún cambio en `runtime-config-root-zod.ts` — ese fichero se toca en T-02.

### Impacto esperado en archivos

**Código fuente:**
- `src/config/runtime-config-types.ts` — añadir interfaz `AccordionLayoutNode`, añadir `'accordion'` a `LayoutNodeType`, añadir `AccordionLayoutNode` al union `LayoutNode`.
- `src/config/runtime-config-zod.ts` — añadir `accordionNodeSchema` (con `props.label: nonEmptyStringSchema`, `props.defaultOpen: z.boolean().optional()`, `props.groupId: z.string().optional()`, `children: z.array(z.unknown()).optional()`, campos transversales estándar); añadir `'accordion'` al array `supportedNodeTypes`.
- `src/config/runtime-config.ts` — re-exportar `AccordionLayoutNode` desde el barrel.

**Tests:**
- `src/tests/config-validation/runtime-config-root-zod.test.ts` (ampliación) — añadir caso para que el schema raíz acepte un nodo `accordion` con label válido dentro de un layout (solo smoke de integración del schema raíz; la cobertura detallada vive en T-02).

**Documentación:**
- `ai-workflow/docs/app-features/nodes/index.md` — añadir entrada `accordion.md` en la sección de nodos estructurales (referencia documental; la ficha completa se crea al invocar `update-app-documentation`).

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-root-zod.test.ts` (ampliación) — añadir caso de aceptación del nodo `accordion` dentro del schema raíz.

**Comportamiento cubierto:**
- El schema raíz `runtimeConfigRootSchema` acepta un nodo con `type: "accordion"` y `props.label: "Sección"` como elemento de `layout`.
- El tipo `AccordionLayoutNode` es compatible con el union `LayoutNode` (verificado implícitamente por TypeScript en tiempo de compilación; no requiere test en tiempo de ejecución).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts
```

**Restricciones:**
- No añadir casos de rechazo en este fichero; esos tests viven en T-02.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/index.md` — entrada accordion pendiente de ficha completa.

### Criterios de finalización

- `AccordionLayoutNode` tipado en `runtime-config-types.ts` con los campos `type`, `id?`, `props` (label, defaultOpen?, groupId?), `children?`, campos transversales (`queryStateFeedback?`, `visibility?`, `layout?`).
- `accordionNodeSchema` creado en `runtime-config-zod.ts` con las mismas restricciones.
- `'accordion'` presente en `supportedNodeTypes` y en el union `LayoutNodeType`/`LayoutNode`.
- `AccordionLayoutNode` re-exportado desde `runtime-config.ts`.
- El caso de smoke en `runtime-config-root-zod.test.ts` pasa.
- `pnpm test` verde.

### Cierre de implementación

Código, tipos y test de smoke en verde. El dispatcher no reconoce aún `accordion` (se registra en T-04).

---

## Tarea T-02 — Validación previa al render del nodo `accordion`

**ID**: T-02
**Estado**: pendiente
**Dependencias**: T-01

### Objetivo

Implementar `validateAccordionNode` en `src/config/validate-layout-nodes.ts`, registrarlo en el switch de `validateLayoutNode`, y actualizar `runtime-config-root-zod.ts` para que el schema raíz soporte `accordion` con children recursivos.

Las reglas de validación son:
- `props.label` obligatorio y no vacío; rechazo con diagnóstico de ruta `"${path}.props.label"`.
- `props.defaultOpen` si presente, debe ser booleano; rechazo con diagnóstico `"${path}.props.defaultOpen"`.
- `props.groupId` si presente, debe ser string (puede estar vacío pero no nulo); rechazo con diagnóstico `"${path}.props.groupId"`.
- `children` se validan recursivamente con `validateLayoutCollection`; admite cualquier nodo válido del catálogo.
- Campos transversales (`queryStateFeedback`, `visibility`, `layout.span`) validados con las funciones compartidas existentes.

### Fuera de alcance

- Componente React (T-03).
- Registro en el dispatcher (T-04).
- No hay restricción de placement (accordion puede aparecer en cualquier posición del árbol; no se añade ninguna lista `accordionAllowedChildTypes` — cualquier nodo válido del catálogo es admitido en `children`).

### Impacto esperado en archivos

**Código fuente:**
- `src/config/validate-layout-nodes.ts` — añadir `validateAccordionNode`, añadir case `'accordion'` en el switch de `validateLayoutNode`. Actualizar `modalAllowedChildTypes` (el `Set` definido cerca del inicio del fichero) para incluir `'accordion'`, ya que la spec dice que `accordion` puede aparecer en cualquier posición del árbol de layout — lo que incluye estar dentro de `modal.children`.
- `src/config/runtime-config-root-zod.ts` — añadir `accordionNodeLooseSchema` con `children: z.array(layoutNodeSchema).optional()` y registrarlo en `layoutNodeSchema` (union).

**Tests:**
- `src/tests/config-validation/runtime-config-validation-accordion.test.ts` (nuevo) — suite completa de aceptación y rechazo.

**Documentación:**
- Ninguna actualización en esta tarea.

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-accordion.test.ts` (nuevo)

**Comportamiento cubierto:**
- Acepta un nodo `accordion` con solo `props.label` declarado.
- Acepta `props.defaultOpen: true`.
- Acepta `props.defaultOpen: false`.
- Acepta `props.groupId: "group-a"`.
- Acepta `children: []` (array vacío).
- Acepta `children` con nodos válidos del catálogo (`heading`, `paragraph`, `container`, `form`, `button`).
- Acepta `accordion` dentro de `container.children`.
- Acepta `accordion` dentro de `repeater.props.template`.
- Acepta `accordion` dentro de `form.children`.
- Acepta `accordion` dentro de `modal.children` (gracias a que `modalAllowedChildTypes` incluye `'accordion'`).
- Rechaza un nodo sin `props.label` — el resultado tiene `status: "error"` con mensaje que contiene `props.label`.
- Rechaza `props.label: ""` (string vacío) — error con ruta `props.label`.
- Rechaza `props.defaultOpen: "true"` (string, no booleano) — error con ruta `props.defaultOpen`.
- Rechaza `props.defaultOpen: 1` (número, no booleano) — error con ruta `props.defaultOpen`.
- Rechaza `props.groupId: 42` (número, no string) — error con ruta `props.groupId`.
- Acepta `visibility` y `queryStateFeedback` con la semántica transversal estándar (al menos un caso positivo).
- Acepta `layout.span` válido (al menos un caso positivo).
- `children` con un nodo de tipo desconocido produce error con código `unsupported-node-type`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-accordion.test.ts
```

**Restricciones:**
- Usar `createConfigWithLayout` del `helpers.ts` de la carpeta `config-validation/` (patrón existente en todos los demás ficheros de validación).
- No añadir restricción de placement (accordion puede ir en cualquier posición).

### Documentación afectada

- Ninguna en esta tarea.

### Criterios de finalización

- `validateAccordionNode` implementado y registrado en el switch.
- `accordionNodeLooseSchema` en `runtime-config-root-zod.ts`.
- Todos los casos del fichero de test en verde.
- `pnpm test` verde.

### Cierre de implementación

Validación completa, tests en verde. El componente React no existe aún (T-03).

---

## Tarea T-03 — Componente React `AccordionNode` con lógica de grupo

**ID**: T-03
**Estado**: pendiente
**Dependencias**: T-01, T-02

### Objetivo

Crear `src/runtime/nodes/accordion-layout-node.tsx` con el componente `AccordionNode`. El componente gestiona el estado abierto/cerrado local, coordina grupos de accordions (varios accordions con el mismo `groupId` en la misma página) y aplica accesibilidad ARIA.

Requisitos de comportamiento:
- Estado local `isOpen` inicializado con `props.defaultOpen ?? false`.
- La cabecera es un `<button type="button">` con `aria-expanded={isOpen}` y `data-layout-node="accordion-header"`.
- El cuerpo (children) solo está en el DOM cuando `isOpen === true`; usa `data-layout-node="accordion-body"`.
- `props.label` resuelto con `resolveRuntimeTextReference` (patrón de `TabsNode`).
- **Mecanismo de grupo**: cuando `props.groupId` está definido, usar un `Context` de React compartido entre todos los `AccordionNode` de la misma página. El contexto expone el `groupId` activo actualmente abierto y un setter. Al abrir un accordion del grupo, el setter actualiza el groupId activo; los demás accordions con el mismo groupId cierran su estado local comparando su propia instancia con el groupId activo.

  Implementación concreta del contexto de grupo:
  - Crear `src/runtime/runtime-accordion-group.tsx` que exporte `AccordionGroupProvider` (envuelve `RuntimePage` o el árbol de layout; ver nota abajo) y el hook `useAccordionGroup`.
  - `AccordionGroupProvider` mantiene un estado `Map<string, string | null>` donde la clave es el `groupId` y el valor es el `instanceId` del accordion actualmente abierto en ese grupo.
  - Cada `AccordionNode` con `groupId` genera un `instanceId` estable con `useId()` de React 18 (hook determinista que produce un id único por instancia de componente sin necesidad de estado ni efectos secundarios).
  - Al pulsar la cabecera de un accordion cerrado: llamar al setter del contexto con `(groupId, instanceId)` — esto abre el accordion actual y cierra los demás del mismo grupo.
  - Al pulsar la cabecera de un accordion abierto: llamar al setter con `(groupId, null)` — cierra el accordion y deja el grupo sin ninguno abierto.
  - **Dónde colocar el provider**: el `AccordionGroupProvider` debe envolver el árbol de layout de la página actual. El lugar natural es `src/runtime/runtime-page.tsx`, donde ya existe el proveedor de estado del runtime. Añadir `AccordionGroupProvider` como proveedor interno, dentro de `RuntimeStateProvider`.

- **Caso límite — varios `defaultOpen: true` en el mismo grupo**: al inicializar, solo el primero en orden de árbol queda abierto. Implementar registrando los accordions de un mismo grupo en orden de montaje: el primer accordion en montar para un `groupId` que tiene `defaultOpen: true` se registra como activo; los siguientes ignoran su `defaultOpen` si el grupo ya tiene un activo.
- Estilos con clases Tailwind únicamente; sin estilos inline.

### Fuera de alcance

- Registro en el dispatcher `layout-node-renderer.tsx` (T-04).
- Acciones `openAccordion`/`closeAccordion` externas.
- Animaciones de apertura/cierre.
- Persistencia de estado.

### Impacto esperado en archivos

**Código fuente:**
- `src/runtime/nodes/accordion-layout-node.tsx` (nuevo) — componente `AccordionNode`.
- `src/runtime/runtime-accordion-group.tsx` (nuevo) — `AccordionGroupProvider`, `useAccordionGroup`.
- `src/runtime/runtime-page.tsx` (modificación) — envolver el árbol con `AccordionGroupProvider`.

**Tests:**
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (nuevo) — suite completa de comportamiento del componente.

**Documentación:**
- Ninguna en esta tarea.

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (nuevo)

**Comportamiento cubierto:**
- Un accordion con `defaultOpen: false` (o sin declarar) renderiza su cabecera pero no su cuerpo en el DOM al montar.
- Un accordion con `defaultOpen: true` renderiza su cabecera y su cuerpo en el DOM al montar.
- Al hacer clic en la cabecera de un accordion cerrado, el cuerpo aparece en el DOM.
- Al hacer clic en la cabecera de un accordion abierto, el cuerpo desaparece del DOM (toggle).
- La cabecera expone `aria-expanded="false"` cuando el accordion está cerrado.
- La cabecera expone `aria-expanded="true"` cuando el accordion está abierto.
- `props.label` con valor literal se renderiza en la cabecera.
- `props.label` con interpolación `{{queries.q.data.title}}` resuelve la referencia y muestra el valor resuelto en la cabecera.
- Dos accordions con el mismo `groupId`: al expandir el segundo, el primero se contrae automáticamente.
- Dos accordions con el mismo `groupId` con `defaultOpen: true`: solo el primero en el DOM arranca expandido.
- Un accordion sin `groupId` puede estar expandido al mismo tiempo que cualquier otro accordion de la página.
- Un accordion con `visibility` que evalúa a oculto no renderiza nada (cabecera ni cuerpo).
- Un accordion con `queryStateFeedback` en estado que activa el feedback sustituye el nodo entero por el feedback; la cabecera no se muestra.
- Un accordion sin `children` o con `children: []` al expandirse muestra el cuerpo vacío sin error.
- Un accordion dentro de un `form` renderiza correctamente (cabecera y cuerpo con campos de formulario).
- `layout.span` aplicado a `accordion` produce el wrapper de grid correcto (patrón estándar del runtime).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx
```

**Restricciones:**
- Reusar el patrón de fixture `renderRuntimePage` presente en `layout-renderer-modal.test.tsx` y `layout-renderer-tabs.test.tsx`.
- No añadir snapshots.
- El test de `layout.span` puede basarse en el patrón de `layout-renderer-grid-spans.test.tsx`.

### Documentación afectada

- Ninguna en esta tarea.

### Criterios de finalización

- `AccordionNode` y `AccordionGroupProvider` implementados.
- `runtime-page.tsx` envuelve el layout con `AccordionGroupProvider`.
- Todos los casos del fichero de test en verde.
- `pnpm test` verde.

### Cierre de implementación

Componente funcionando con grupo y accesibilidad. El dispatcher aún no reconoce `accordion` (T-04).

---

## Tarea T-04 — Registro en el dispatcher central y cobertura de integración

**ID**: T-04
**Estado**: pendiente
**Dependencias**: T-01, T-02, T-03

### Objetivo

Registrar `AccordionNode` en `layout-node-renderer.tsx` para que el dispatcher central reconozca el tipo `accordion`. Verificar que `gridChildSpanClassName` se aplica correctamente al nodo `accordion` (no está en la lista de exclusión junto a `repeater` y `modal`). Añadir el caso de integración de `accordion` dentro de `repeater.props.template` en el test de render.

### Fuera de alcance

- Nuevos comportamientos de render no cubiertos en T-03.
- Cambios en el schema Zod o en la validación.

### Impacto esperado en archivos

**Código fuente:**
- `src/runtime/layout-node-renderer.tsx` (modificación) — importar `AccordionNode`, añadir `case 'accordion':` en el switch con `renderedNode = <AccordionNode node={node} iterationContext={iterationContext} />`.

**Tests:**
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación) — añadir casos de accordion dentro de `repeater.props.template`.

**Documentación:**
- `ai-workflow/docs/app-features/nodes/index.md` — actualizar entrada accordion para marcarla lista (referencia; la ficha completa se escribe con `update-app-documentation`).

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación — casos del repeater)

**Comportamiento cubierto:**
- Un nodo `accordion` dentro de `repeater.props.template` renderiza una instancia por iteración.
- Cada instancia de accordion del repeater tiene su estado abierto/cerrado independiente.
- Si el accordion en el template declara `groupId`, expandir la instancia de una iteración colapsa la de otra iteración del mismo grupo (todas las instancias de todas las iteraciones participan en el mismo grupo de página).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx
```

**Restricciones:**
- No duplicar los casos de T-03; esta ampliación solo añade los escenarios de repeater.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/index.md` — entrada accordion (referencia documental).

### Criterios de finalización

- `'accordion'` registrado en el switch de `layout-node-renderer.tsx`.
- Los casos de repeater en el fichero de test en verde.
- `pnpm test` verde con cobertura global ≥ 80%.

### Cierre de implementación

Dispatcher actualizado, tests de integración con repeater en verde, cobertura global validada.

---

## Orden de ejecución

T-01 → T-02 → T-03 → T-04

Cada tarea habilita la siguiente. T-04 es el cierre de implementación de la feature.
