# Plan de implementación: `divider` node (0057)

## Resumen

Cuatro tareas secuenciales:

1. Tipos, esquema Zod y validación previa al render del nodo `divider`.
2. Componente React `DividerNode` y registro en el dispatcher central.
3. Eliminación del separador automático `border-t` en `runtime-node-styling` y `getContainerNodeSurface`.
4. Actualización de `src/dev/config.json` para reemplazar separadores implícitos por nodos `divider` explícitos.

---

## Tarea 01 — Tipo TypeScript, esquema Zod y validación previa al render del nodo `divider`

**ID:** T01
**Estado:** pendiente
**Depende de:** ninguna (primera tarea)

### Objetivo

Añadir el tipo `DividerLayoutNode` al catálogo de tipos, el esquema Zod `dividerNodeSchema`, registrar `'divider'` en `supportedNodeTypes` y en `LayoutNodeType`, y añadir `validateDividerNode` al dispatcher de `validateLayoutNode` en `validate-layout-nodes.ts`.

### Fuera de alcance

- El componente React de render (T02).
- El registro en `layout-node-renderer.tsx` (T02).
- Modificación del separador automático en `runtime-node-styling.ts` (T03).
- Modificación de `src/dev/config.json` (T04).

### Dependencias

Ninguna.

### Impacto esperado en archivos

**Código a modificar:**

- `src/config/runtime-config-types.ts`
  - Añadir `'divider'` a `LayoutNodeType`.
  - Añadir tipo `DividerVariant = 'solid' | 'dashed' | 'dotted' | 'invisible'`.
  - Añadir interfaz `DividerLayoutNode` con `type: 'divider'`, `id?: string`, campos transversales (`queryStateFeedback`, `visibility`, `layout`), `props?: { variant?: DividerVariant }`, `children?: never`.
  - Añadir `DividerLayoutNode` a la unión `LayoutNode`.
- `src/config/runtime-config.ts`
  - Re-exportar `DividerLayoutNode` y `DividerVariant`.
- `src/config/runtime-config-zod.ts`
  - Añadir `'divider'` al array `supportedNodeTypes`.
  - Añadir `supportedDividerVariants = ['solid', 'dashed', 'dotted', 'invisible'] as const`.
  - Añadir `dividerNodeSchema` siguiendo el mismo patrón que `badgeNodeSchema` / `alertNodeSchema`: `type: z.literal('divider')`, campos transversales opcionales, `props` con `variant: z.enum(supportedDividerVariants).optional()` y `.strip()`, `children: z.never().optional()`.
- `src/config/validate-layout-nodes.ts`
  - Importar `DividerLayoutNode` y `dividerNodeSchema`.
  - Añadir `'divider'` al switch en `validateLayoutNode`.
  - Implementar `validateDividerNode` siguiendo el mismo patrón que `validateBadgeNode`/`validateAlertNode`.

**Tests a crear:**

- `src/tests/config-validation/runtime-config-validation-divider.test.ts` (nuevo)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/nodes/index.md`
- Nueva ficha `ai-workflow/docs/app-features/nodes/divider.md`

### Tests

**Ficheros de test:**

- `src/tests/config-validation/runtime-config-validation-divider.test.ts` (nuevo)

**Comportamiento cubierto:**

- Un nodo `{ type: 'divider' }` sin props acepta la validación y devuelve `status: 'ready'`.
- Un nodo con `props.variant: 'solid'` acepta la validación.
- Un nodo con `props.variant: 'dashed'` acepta la validación.
- Un nodo con `props.variant: 'dotted'` acepta la validación.
- Un nodo con `props.variant: 'invisible'` acepta la validación.
- Un nodo con `props.variant: 'underline'` (valor fuera del catálogo) produce `status: 'error'` con `message` conteniendo la ruta `props.variant`.
- Un nodo con `children` declarado acepta la validación sin error. El schema Zod del nodo `divider` no declara el campo `children` (mismo patrón que `alertNodeSchema`) y usa `.strip()` en el objeto raíz, lo que descarta `children` silenciosamente antes del parsing. El subagente no debe añadir `z.never().optional()` en el schema; solo seguir el patrón de `alertNodeSchema`.
- `visibility` en un nodo `divider` válido acepta la validación (los campos transversales funcionan).
- `queryStateFeedback` en un nodo `divider` válido acepta la validación.
- `layout.span` en un nodo `divider` válido acepta la validación.
- `layout.span` con un valor fuera del rango 1–12 produce `status: 'error'`.
- Un nodo `divider` dentro de la collection de un `container` acepta la validación.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/config-validation/runtime-config-validation-divider.test.ts
```

**Restricciones:**

- Reutilizar el helper `createConfigWithLayout` de `src/tests/config-validation/helpers.ts`.
- No añadir snapshots.
- El schema Zod del nodo `divider` sigue el patrón exacto de `alertNodeSchema`: objeto `.strip()` sin campo `children` declarado. No añadir `z.never().optional()` al schema Zod.

### Criterios de finalización

- `src/config/runtime-config-types.ts` exporta `DividerLayoutNode` y `DividerVariant`.
- `src/config/runtime-config-zod.ts` exporta `dividerNodeSchema` y `supportedDividerVariants`.
- `validateLayoutNode` en `validate-layout-nodes.ts` tiene el case `'divider'` activo.
- `pnpm test --run src/tests/config-validation/runtime-config-validation-divider.test.ts` pasa en verde.
- `LayoutNode` union incluye `DividerLayoutNode`.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T02) puede ejecutarse.

---

## Tarea 02 — Componente React `DividerNode` y registro en el dispatcher

**ID:** T02
**Estado:** pendiente
**Depende de:** T01 (el tipo y el nodo deben existir)

### Objetivo

Crear `src/runtime/nodes/divider-layout-node.tsx` con el componente `DividerNode`. Registrar el case `'divider'` en `src/runtime/layout-node-renderer.tsx`.

### Fuera de alcance

- Eliminación del separador automático en `runtime-node-styling.ts` (T03).
- Modificación de `src/dev/config.json` (T04).

### Dependencias

T01.

### Impacto esperado en archivos

**Código a crear:**

- `src/runtime/nodes/divider-layout-node.tsx` (nuevo)
  - Interfaz `DividerNodeProps { node: DividerLayoutNode; iterationContext?: RuntimeIterationContext }`.
  - Componente `DividerNode` que renderiza un `<hr>` con `data-layout-node="divider"` y clases Tailwind según `props.variant` (o `'solid'` por defecto):
    - `solid`: `border-t border-app-border-soft` (u equivalente visible continuo en el theme del proyecto).
    - `dashed`: `border-t border-dashed border-app-border-soft`.
    - `dotted`: `border-t border-dotted border-app-border-soft`.
    - `invisible`: sin clases de borde (solo la altura mínima necesaria para actuar como espaciador, p. ej. `block h-0`). Las clases exactas de `invisible` son decisión de implementación: el contrato observable es que no renderiza ninguna línea visible pero ocupa espacio.
  - El componente no necesita leer estado del runtime (sin `useRuntimeState`). No tiene referencias dinámicas que resolver.

**Código a modificar:**

- `src/runtime/layout-node-renderer.tsx`
  - Importar `DividerNode`.
  - Añadir el case `'divider'` en el switch: `renderedNode = <DividerNode node={node} iterationContext={iterationContext} />`.
  - El nodo `divider` no es `'repeater'` ni `'modal'`, por lo que sí entra en la lógica de `gridChildSpanClassName`.

**Tests a crear:**

- `src/tests/layout-renderer/layout-renderer-divider.test.tsx` (nuevo)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/nodes/index.md`
- Nueva ficha `ai-workflow/docs/app-features/nodes/divider.md`

### Tests

**Ficheros de test:**

- `src/tests/layout-renderer/layout-renderer-divider.test.tsx` (nuevo)

**Comportamiento cubierto:**

- Un nodo `{ type: 'divider' }` sin `props.variant` renderiza un elemento con `data-layout-node="divider"`.
- Un nodo con `props.variant: 'solid'` renderiza un elemento con borde visible (clase que contenga `border-t` sin `border-dashed` ni `border-dotted`).
- Un nodo con `props.variant: 'dashed'` renderiza un elemento con clase `border-dashed`.
- Un nodo con `props.variant: 'dotted'` renderiza un elemento con clase `border-dotted`.
- Un nodo con `props.variant: 'invisible'` renderiza un elemento sin clases de borde visible (el elemento está presente en el DOM pero no tiene `border-t`).
- `visibility` con condición evaluada como visible: el nodo `divider` aparece en el DOM.
- `visibility` con condición evaluada como oculta: el nodo `divider` no aparece en el DOM (retorna `null`).
- `layout.span` aplicado al nodo `divider` envuelve el elemento en el `div` con `col-span-*` correspondiente cuando hay `parentGridColumns` activo.
- Un nodo `divider` dentro de `repeater.props.template` se repite una vez por item.
- `children` declarados en el JSON no producen salida visible en el DOM (el componente no los renderiza).

**Comandos durante la implementación:**

```
pnpm test --run src/tests/layout-renderer/layout-renderer-divider.test.tsx
```

**Restricciones:**

- Reutilizar el patrón de fixture de `src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (función `renderRuntimePage` con `RuntimePage` + `RuntimeStateContext.Provider`).
- No snapshots.
- Las clases Tailwind exactas de `invisible` no forman parte del contrato de test observable: el test debe verificar ausencia de `border-t` o de cualquier clase que implique línea visible, no una clase concreta de relleno.

### Criterios de finalización

- `src/runtime/nodes/divider-layout-node.tsx` existe con el componente `DividerNode`.
- `src/runtime/layout-node-renderer.tsx` incluye el case `'divider'`.
- `pnpm test --run src/tests/layout-renderer/layout-renderer-divider.test.tsx` pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T03) puede ejecutarse.

---

## Tarea 03 — Eliminar el separador automático `border-t` de `surface: form-section`

**ID:** T03
**Estado:** pendiente
**Depende de:** T02 (el nodo `divider` debe estar operativo antes de romper el separador automático)

### Objetivo

Eliminar la lógica en `getContainerNodeStyling` de `src/runtime/runtime-node-styling.ts` que aplica `['border-t', 'border-app-border-soft', 'pt-5', 'sm:pt-6']` cuando `surface === 'form-section'`. A partir de esta tarea, `surface: 'form-section'` ya no produce borde superior en los contenedores dentro de formularios.

Los tests de `layout-renderer-forms.test.tsx` y `runtime-node-styling.test.ts` que verifican la presencia del borde automático deben actualizarse para reflejar que ya no existe.

### Fuera de alcance

- Añadir nodos `divider` en `src/dev/config.json` (T04).
- Cualquier otro cambio en la lógica de styling fuera del bloque `surface === 'form-section'`.

### Dependencias

T02.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/runtime-node-styling.ts`
  - En `getContainerNodeStyling`: eliminar la rama `surface === 'form-section'` del cálculo de `surfaceClassNames`. El bloque resultante solo maneja `variant === 'card'`; para cualquier otro caso `surfaceClassNames = []`.

**Tests a modificar:**

- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
  - Actualizar o añadir test que verifique que `getContainerNodeStyling({ surface: 'form-section' })` **no** incluye `border-t` en el `className` resultante.
  - Asegurarse de que ningún test existente afirma la presencia de `border-t` por `form-section`; si existe, actualizar ese assertion.
- `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación)
  - Si existe algún test que verifica la presencia del borde superior automático en contenedores de sección de formulario, actualizar para que espere su ausencia.

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/nodes/form.md`

### Tests

**Ficheros de test:**

- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación)

**Comportamiento cubierto:**

- `getContainerNodeStyling({ surface: 'form-section' })` devuelve un `className` que **no** contiene `border-t`.
- `getContainerNodeStyling({ surface: 'form-section' })` devuelve un `className` que **no** contiene `pt-5`.
- `getContainerNodeStyling({ variant: 'card' })` sigue devolviendo las clases de tarjeta (regresión).
- Un `container` directamente dentro de un `form` en el renderer ya no tiene el atributo de clase `border-t` en el DOM.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx
```

**Restricciones:**

- No eliminar la función `getContainerNodeSurface` ni el campo `surface` de las opciones de `getContainerNodeStyling`; otras partes del código pueden depender de él. Solo eliminar el efecto visual de `form-section` dentro de `surfaceClassNames`.

### Criterios de finalización

- `getContainerNodeStyling` no aplica `border-t` cuando `surface === 'form-section'`.
- `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` pasa en verde.
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx` pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T04) puede ejecutarse.

---

## Tarea 04 — Actualizar `src/dev/config.json` con nodos `divider` explícitos

**ID:** T04
**Estado:** pendiente
**Depende de:** T03 (el separador automático ya no existe; sin T03 el resultado visual sería incorrecto)

### Objetivo

Revisar `src/dev/config.json` e insertar nodos `divider` explícitos donde los contenedores dentro de formularios dependían del `border-t` automático para producir separación visual entre secciones. El resultado visual del formulario de desarrollo debe ser equivalente al que había antes de T03.

### Fuera de alcance

- Cualquier otro cambio en la lógica de runtime.
- Tests del renderer sobre `src/dev/config.json` (ya cubiertos por las suites existentes con fixtures propias).

### Dependencias

T03.

### Impacto esperado en archivos

**Código a modificar:**

- `src/dev/config.json`
  - Para cada `container` dentro de un `form` que actuaba como sección separada visualmente (es decir, aquellos cuyo `getContainerNodeSurface` devolvía `'form-section'` y no declaran `variant: 'card'`), insertar un nodo `{ "type": "divider" }` inmediatamente antes del `container` en la lista `children` del `form`.

**Tests:**

- No se crean tests nuevos para este cambio. La suite de integración existente cubre el renderizado correcto del runtime con configuración válida.

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/development/local-config.md` (si documenta la estructura del config de desarrollo)

### Tests

**Ficheros de test:** ninguno; cubierto por: suites existentes de `layout-renderer-forms.test.tsx` y `config-validation` que se ejecutan con `pnpm test`.

**Comportamiento cubierto:**

- `src/dev/config.json` pasa la validación del runtime (`validateRuntimeConfig`).
- No se añaden tests nuevos; el gate de cobertura global `pnpm test` valida que no hay regresión.

**Comandos durante la implementación:**

```
pnpm test
```

**Restricciones:**

- Solo modificar el JSON existente; no crear un fichero de config nuevo.
- Los nodos `divider` insertados no deben tener props adicionales a menos que el formulario requiera una variante distinta de `solid`.

### Criterios de finalización

- `src/dev/config.json` no tiene errores de validación al arrancar el runtime en modo desarrollo.
- `pnpm test` pasa en verde con cobertura ≥ 80%.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La feature está implementada completamente.
