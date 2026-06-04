# tasks.md — feature 0055-alert-node

## Resumen

Tres tareas secuenciales para añadir el nodo hoja `alert` al runtime:

1. Contrato de tipos y esquema Zod
2. Validación previa al render
3. Componente de render, registro en el dispatcher y tests completos de render

---

## T01 — Tipos TypeScript y esquema Zod para el nodo `alert`

**ID:** T01
**Estado:** pending
**Dependencias:** ninguna

### Objetivo

Declarar el tipo `AlertLayoutNode` en `runtime-config-types.ts`, añadir `'alert'` al union `LayoutNodeType` y al array `supportedNodeTypes`, y escribir `alertNodeSchema` en `runtime-config-zod.ts`. Esta tarea cierra el contrato de datos que T02 y T03 consumen.

### Fuera de alcance

- Lógica de validación cruzada (T02).
- Componente de render (T03).
- Registro en el dispatcher (T03).
- Tests de render (T04).

### Impacto esperado en archivos

**Código:**
- `src/config/runtime-config-types.ts` — añadir tipos `AlertLayoutNode`, `AlertType` (enum semántico), actualizar `LayoutNodeType` y `LayoutNode`.
- `src/config/runtime-config-zod.ts` — añadir `supportedAlertTypes`, `alertNodeSchema`, y añadir `'alert'` a `supportedNodeTypes`.
- `src/config/runtime-config.ts` — re-exportar `AlertLayoutNode` y `AlertType`.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-alert.test.ts` (nuevo, ver sub-bloque tests).

**Documentación afectada:**
- `ai-workflow/docs/app-features/nodes/index.md` — entrada nueva en tabla de nodos hoja visibles.
- Nueva ficha `ai-workflow/docs/app-features/nodes/alert.md`.
- `ai-workflow/docs/test-index.md` — entrada nueva en `config-validation/`.

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-alert.test.ts` (nuevo)

**Comportamiento cubierto:**
- `validateRuntimeConfig` acepta un nodo `alert` con `type`, `props.message` obligatorio y sin `props.type` (usa default `neutral`).
- Acepta `alert` con cada uno de los seis `props.type` válidos (`neutral`, `primary`, `success`, `warning`, `danger`, `info`).
- Acepta `alert` con `props.title` opcional presente como string.
- Acepta `alert` sin `props.title` declarado.
- Acepta `alert` con `props.message` conteniendo un placeholder `{{queries.foo.data}}`.
- Acepta `alert` con `props.title` conteniendo un placeholder `{{forms.f.field}}`.
- Acepta `alert` con `visibility`, `queryStateFeedback` y `layout.span` declarados.
- Acepta `alert` con `children` declarados en el input raw — el resultado no incluye `children` (nodo hoja).
- Rechaza `alert` sin `props.message` — el error contiene `props.message`.
- Rechaza `alert` con `props.message` como número — el error contiene `props.message`.
- Rechaza `alert` con `props.type` con valor fuera del catálogo (`"error"`, `"warn"`, etc.) — el error contiene `props.type`.
- Rechaza `alert` con `props.title` como número — el error contiene `props.title`.
- Rechaza `alert` con `layout.span` inválido — el error contiene `layout.span`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-alert.test.ts
```

**Restricciones:**
- Reusar el helper `createConfigWithLayout` de `src/tests/config-validation/helpers.ts`.
- Seguir el patrón de `runtime-config-validation-badge.test.ts`: función local `createAlertNode(overrides)`, `describe` separados por aceptación y rechazo.
- No añadir snapshot tests.

### Criterios de finalización

- `AlertLayoutNode` y `AlertType` exportados desde `src/config/runtime-config.ts`.
- `alertNodeSchema` presente en `runtime-config-zod.ts` y `'alert'` en `supportedNodeTypes`.
- `'alert'` presente en `LayoutNodeType` y en el union `LayoutNode`.
- Todos los tests de `runtime-config-validation-alert.test.ts` en verde.
- `pnpm test` pasa el umbral de cobertura global del 80%.

### Cierre de implementación

Código y tests de la tarea completos y en verde. El schema y los tipos están disponibles para T02 y T03.

---

## T02 — Validación previa al render: `validateAlertNode`

**ID:** T02
**Estado:** pending
**Dependencias:** T01 (tipos y esquema Zod disponibles)

### Objetivo

Implementar `validateAlertNode` en `src/config/validate-layout-nodes.ts` y registrarla en el switch de `validateLayoutNode`. La función debe cubrir: parsing con `alertNodeSchema`, mapeo de errores específicos a rutas exactas (`props.message`, `props.type`, `props.title`), validación transversal de `queryStateFeedback` y `visibility`, y construcción del nodo validado con los campos tipados.

### Fuera de alcance

- Componente de render (T03).
- Tests de render (T04).
- Cambios en formularios ni en types adicionales.

### Impacto esperado en archivos

**Código:**
- `src/config/validate-layout-nodes.ts` — añadir `validateAlertNode` (función privada), añadir `case 'alert'` en el switch de `validateLayoutNode`, importar `AlertLayoutNode` y `alertNodeSchema`.

**Tests:**
- `src/tests/config-validation/runtime-config-validation-alert.test.ts` (ampliación: los tests de T01 ya validan este comportamiento; T02 no añade ficheros nuevos, los tests existentes del fichero ya ejercen `validateAlertNode` implícitamente al llamar a `validateRuntimeConfig`).

**Documentación afectada:**
- ninguna (los documentos afectados se declaran en T01 y se actualizan post-implementación con `update-app-documentation`).

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-alert.test.ts` (ampliación)

**Comportamiento cubierto:**

Los tests añadidos en esta tarea amplían el fichero con casos que verifican comportamiento específico de `validateAlertNode` más allá del parsing Zod puro:

- Un `alert` válido completo (`type`, `props.message`, `props.type`, `props.title`) pasa la validación y devuelve el nodo con todos los campos normalizados.
- El nodo normalizado tiene `props.type` igual al valor declarado (no al default).
- El nodo normalizado tiene `props.title` solo cuando fue declarado.
- El nodo normalizado tiene `props.message` igual al string declarado.
- Rechaza `alert` con `props.message` ausente incluso cuando `props.title` está presente — error en `props.message`.
- El error de `props.type` inválido apunta exactamente a la ruta `{path}.props.type`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-alert.test.ts
```

**Restricciones:**
- `validateAlertNode` debe seguir el patrón de `validateBadgeNode`: `safeParse`, mapeo explícito de cada prop inválida antes del fallback `mapLeafNodeIssue`, luego `validateQueryStateFeedback` y `validateVisibility`, finalmente construcción del nodo.
- No añadir lógica en `validate-form-nodes.ts` ni en otros módulos de validación.

### Criterios de finalización

- `validateAlertNode` registrada en el switch de `validateLayoutNode`.
- Todos los tests de `runtime-config-validation-alert.test.ts` en verde (incluyendo los de T01 y los añadidos en esta tarea).
- `pnpm test` pasa el umbral de cobertura global del 80%.

### Cierre de implementación

Código y tests de la tarea completos y en verde. `validateLayoutNode` delega correctamente en `validateAlertNode` para el tipo `'alert'`.

---

## T03 — Componente `AlertNode`, registro en el dispatcher y tests completos de render

**ID:** T03
**Estado:** pending
**Dependencias:** T01 (tipos disponibles), T02 (validación lista)

### Objetivo

Crear `src/runtime/nodes/alert-layout-node.tsx` con el componente `AlertNode`, que renderiza el bloque horizontal con zona de icono placeholder y zona de contenido (cabecera opcional + mensaje). Registrar `AlertNode` en `layout-node-renderer.tsx` añadiendo el `case 'alert'` al switch y su import. Escribir `layout-renderer-alert.test.tsx` con la cobertura completa de render (casos básicos, interpolación, transversales, integración en repeater y form, y casos límite).

El componente debe:
- Usar un `colorMap` de tipo `Record<AlertType, { bg: string; text: string }>` con las clases Tailwind coherentes con la paleta ya usada en `badge` (mismos shades: `100` para fondo, `700` para acento/texto, o equivalente por color).
- Renderizar `data-layout-node="alert"` en el elemento raíz.
- Renderizar el icono placeholder como un elemento `<span>` con la clase de texto de acento del tipo y el literal `icon` como contenido de texto (visible en DOM para tests).
- Renderizar `props.title` como `<strong>` cuando está presente y no es string vacío; omitir el elemento si está ausente o vacío (string vacío es equivalente a ausente a nivel visual).
- Renderizar `props.message` resuelto con `resolveRuntimeTextReference`.
- Resolver `props.title` (cuando está presente) con `resolveRuntimeTextReference`.
- Usar el default `'neutral'` cuando `props.type` no está declarado.
- No tener estado local ni efectos secundarios.
- Usar solo clases Tailwind, sin estilos inline.

Los shades exactos de Tailwind por tipo son los mismos que `badge` en la variante `pill`:

| Tipo | bg | text/accent |
|---|---|---|
| `neutral` | `bg-gray-100` | `text-gray-700` |
| `primary` | `bg-blue-100` | `text-blue-700` |
| `success` | `bg-green-100` | `text-green-700` |
| `warning` | `bg-yellow-100` | `text-yellow-700` |
| `danger` | `bg-red-100` | `text-red-700` |
| `info` | `bg-cyan-100` | `text-cyan-700` |

### Fuera de alcance

- Validación de config (T02).
- Icono definitivo de librería externa (spec lo excluye explícitamente).
- Nuevos ficheros de test más allá de `layout-renderer-alert.test.tsx`.

### Impacto esperado en archivos

**Código:**
- `src/runtime/nodes/alert-layout-node.tsx` (nuevo) — componente `AlertNode`.
- `src/runtime/layout-node-renderer.tsx` — importar `AlertNode`, añadir `case 'alert'` al switch.

**Tests:**
- `src/tests/layout-renderer/layout-renderer-alert.test.tsx` (nuevo)

**Documentación afectada:**
- `ai-workflow/docs/app-features/nodes/alert.md` (nueva ficha, post-implementación con `update-app-documentation`).
- `ai-workflow/docs/app-features/nodes/index.md` (entrada en tabla de nodos hoja visibles, post-implementación).
- `ai-workflow/docs/test-index.md` — entrada nueva en `layout-renderer/`.

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-alert.test.tsx` (nuevo)

**Comportamiento cubierto:**

*Render básico y colores:*
- Un `alert` con `props.type: "neutral"` renderiza un elemento con `data-layout-node="alert"` en el DOM.
- El elemento con `data-layout-node="alert"` para tipo `neutral` tiene la clase `bg-gray-100`.
- Cada uno de los seis tipos renderiza su clase de fondo exacta en el elemento raíz: `neutral → bg-gray-100`, `primary → bg-blue-100`, `success → bg-green-100`, `warning → bg-yellow-100`, `danger → bg-red-100`, `info → bg-cyan-100`.
- Un `alert` sin `props.type` declarado renderiza con la clase `bg-gray-100` (default `neutral`).

*Icono placeholder:*
- El elemento raíz del alert contiene un `<span>` hijo con el texto exacto `"icon"` para todos los tipos.

*Título y mensaje:*
- Un `alert` con `props.title: "Aviso"` renderiza un elemento `<strong>` con el texto `"Aviso"` visible en el DOM.
- Un `alert` sin `props.title` no contiene ningún elemento `<strong>` en el DOM.
- Un `alert` con `props.title: ""` (cadena vacía) no contiene ningún elemento `<strong>` en el DOM.
- Un `alert` con `props.message: "Texto de mensaje"` muestra ese texto visible en el DOM.
- Un `alert` con `props.message: ""` renderiza el bloque `[data-layout-node="alert"]` sin error (el mensaje es vacío).

*Interpolación:*
- `props.message` con `{{queries.foo.data}}` resuelve al valor de `queries.foo.data` en el estado cuando la query tiene status `success`.
- `props.title` con `{{forms.f.name}}` resuelve al valor del campo `name` del formulario `f` en el estado.
- `props.title` con un placeholder `{{queries.nonexistent.data}}` sin esa query en el estado renderiza el `<strong>` con texto vacío (o lo omite si el texto resuelto es vacío); el alert en conjunto no falla en render.
- `props.message` con un placeholder que no resuelve renderiza el mensaje vacío sin error de render.

*Transversales:*
- Un `alert` con `visibility` evaluada a `false` (condición de ocultación activa) no se renderiza en el DOM.
- Un `alert` con `queryStateFeedback` en estado `loading` con fallback de `paragraph` renderiza el fallback en lugar del alert.
- Un `alert` con `layout.span: 4` dentro de un `container` con `columns: 12` se envuelve en un `div` con clase `col-span-4`.

*Integración repeater:*
- Un `alert` dentro de un `repeater` con dos ítems distintos renderiza dos elementos `[data-layout-node="alert"]`, cada uno con el `props.message` resuelto con `item.*` de su iteración correspondiente (textos distintos en cada bloque).
- Un `alert` dentro de un `repeater` con `props.title` usando `item.*` renderiza el `<strong>` con el valor correcto por iteración.

*Integración form:*
- Un `alert` como hijo de un `form` renderiza el elemento `[data-layout-node="alert"]` en el DOM sin error.
- El alert dentro del form no produce ningún campo en `state.forms[formId]` (el store de formularios no incluye entradas generadas por el nodo alert).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-alert.test.tsx
```

**Restricciones:**
- Reusar el harness `renderRuntimePage` / `renderRuntimePageWithState` / `createRuntimePageState` del patrón ya establecido en `layout-renderer-badge.test.tsx`.
- Para el test de "alert dentro de form sin campos en state.forms": usar `createRuntimeState` del store, construir el estado con el config que contiene el form+alert, renderizar y verificar que `Object.keys(state.forms[formId] ?? {})` no incluye ninguna clave derivada del nodo alert.
- No usar snapshot tests.
- Verificar colores por clase CSS, no por estilos inline (la implementación usa solo Tailwind).

### Criterios de finalización

- `alert-layout-node.tsx` creado y exportando `AlertNode`.
- `layout-node-renderer.tsx` registra el `case 'alert'`.
- Todos los tests de `layout-renderer-alert.test.tsx` en verde.
- `pnpm test` pasa el umbral de cobertura global del 80%.

### Cierre de implementación

Código y tests de la tarea completos y en verde. El nodo `alert` es renderable desde cualquier layout JSON válido y queda validado en todos sus contextos de uso declarados en la spec.

---

## Orden de ejecución

T01 → T02 → T03

La siguiente tarea a escoger es **T01**.
