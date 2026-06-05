> Feature: `0062-button-style-variants`
> Fase: planning
> Fecha: 2026-06-05

# Tasks: variantes de estilo para el nodo `button`

---

## T1 — Extender tipos TypeScript y esquema Zod del nodo `button`

**Estado:** completed
**Dependencias:** ninguna

### Objetivo

Añadir `color`, `variant` y `fullWidth` como props opcionales del nodo `button` en los tipos TypeScript y en el esquema Zod de validación básica de shape, siguiendo el mismo patrón que `badge` y `stat`.

### Fuera de alcance

- Lógica de validación semántica (errores con ruta exacta): es T2.
- Función de styling y clases Tailwind: es T3.
- Cambios en el componente React: es T4.
- No tocar ningún otro nodo ni tipo.

### Impacto esperado en archivos

- **`src/config/runtime-config-zod.ts`**:
  - Añadir constantes:
    ```ts
    export const supportedButtonVariants = ['solid', 'outline', 'ghost', 'link'] as const
    export const supportedButtonColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const
    ```
  - Extender `buttonNodeSchema.props` con:
    ```ts
    color: z.enum(supportedButtonColors).optional(),
    variant: z.enum(supportedButtonVariants).optional(),
    fullWidth: z.boolean().optional(),
    ```
- **`src/config/runtime-config-types.ts`**:
  - Añadir tipos exportados junto a `StatColor`/`StatVariant`:
    ```ts
    export type ButtonColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
    export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link'
    ```
  - Extender `ButtonLayoutNode.props`:
    ```ts
    color?: ButtonColor
    variant?: ButtonVariant
    fullWidth?: boolean
    ```
- **`src/config/runtime-config.ts`**: re-exportar `ButtonColor` y `ButtonVariant` junto a `StatColor`/`StatVariant`.

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-button-styles.test.ts` **(nuevo)**

**Comportamiento cubierto:**
- Un nodo `button` con `props.color: "primary"` y `props.variant: "solid"` pasa el esquema Zod sin error.
- Un nodo `button` con `props.fullWidth: true` pasa el esquema Zod sin error.
- Un nodo `button` sin `color`, `variant` ni `fullWidth` sigue pasando el esquema Zod (son opcionales).
- Un nodo `button` con `props.color: "purple"` falla el esquema Zod (`safeParse` devuelve `success: false`).
- Un nodo `button` con `props.variant: "flat"` falla el esquema Zod.
- Un nodo `button` con `props.fullWidth: "yes"` (string en vez de boolean) falla el esquema Zod.
- Las seis constantes de `supportedButtonColors` y las cuatro de `supportedButtonVariants` están exportadas y tienen los valores correctos.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-button-styles.test.ts
```

**Restricciones:**
- Tests de shape Zod directos (`buttonNodeSchema.safeParse`), no de integración de validación completa del runtime.
- No reusar el harness de integración de `runtime-config-validation-buttons.test.ts`; el nuevo fichero usa `buttonNodeSchema.safeParse` directamente.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/button.md`: actualizar la tabla de props al cerrar la feature completa.

### Criterios de finalización

- `buttonNodeSchema` acepta `color`, `variant` y `fullWidth` opcionales.
- `ButtonLayoutNode.props` incluye los tres campos opcionales con tipos correctos.
- `ButtonColor` y `ButtonVariant` están exportados desde `runtime-config.ts`.
- Tests del fichero nuevo en verde.
- `pnpm test` pasa sin romper cobertura.

### Cierre de implementación

T1 está cerrada cuando los tipos, las constantes Zod y el test de shape en verde son validados con `pnpm test`.

---

## T2 — Extender la función de validación del nodo `button`

**Estado:** completed
**Dependencias:** T1

### Objetivo

Ampliar `validateButtonNode` en `validate-layout-nodes.ts` para que:
1. Mapee los errores de `color`, `variant` y `fullWidth` a mensajes `invalid-layout` con ruta exacta.
2. Propague los tres nuevos campos al nodo normalizado que devuelve la función.

### Fuera de alcance

- Clases Tailwind y función de styling: es T3.
- Componente React: es T4.
- Ningún otro nodo ni función de validación.

### Impacto esperado en archivos

- **`src/config/validate-layout-nodes.ts`** — `validateButtonNode`:
  - Añadir ramas de mapeo de error justo después de las ramas existentes de `label` y `action`:
    ```ts
    if (issuePath[0] === 'props' && issuePath[1] === 'color') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.color".`)
    }
    if (issuePath[0] === 'props' && issuePath[1] === 'variant') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.variant".`)
    }
    if (issuePath[0] === 'props' && issuePath[1] === 'fullWidth') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.fullWidth".`)
    }
    ```
  - Propagar los campos al nodo de retorno:
    ```ts
    props: {
      label: parseResult.data.props.label,
      action,
      color: parseResult.data.props.color,
      variant: parseResult.data.props.variant,
      fullWidth: parseResult.data.props.fullWidth,
    },
    ```

### Tests

**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-button-styles.test.ts` **(ampliación de T1)**

**Comportamiento cubierto:**
- Un botón con `props.color: "purple"` es rechazado por `readRuntimeConfig` con `code: "invalid-layout"` y un mensaje que contiene la ruta exacta al campo (`.props.color`).
- Un botón con `props.variant: "flat"` es rechazado con `code: "invalid-layout"` y ruta `.props.variant`.
- Un botón con `props.fullWidth: "yes"` es rechazado con `code: "invalid-layout"` y ruta `.props.fullWidth`.
- Un botón con `props.color: ""` (string vacío) es rechazado con `code: "invalid-layout"` y ruta `.props.color`.
- Un botón con `props.color: "danger"`, `props.variant: "outline"` y `props.fullWidth: true` produce un config válido donde el nodo normalizado tiene `props.color === "danger"`, `props.variant === "outline"` y `props.fullWidth === true`.
- Un botón sin las tres props produce un nodo normalizado donde `props.color`, `props.variant` y `props.fullWidth` son `undefined`.
- Los tests de `runtime-config-validation-buttons.test.ts` existentes siguen en verde sin modificación.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-button-styles.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
```

**Restricciones:**
- Usar `readRuntimeConfig` del harness de integración para los tests de rechazo/aceptación de config completa.
- Importar el helper `makeMinimalConfig` o equivalente del mismo patrón que usan otros test de validación de la carpeta `config-validation/`.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/button.md`: actualizar la sección de validación específica al cerrar la feature completa.

### Criterios de finalización

- `validateButtonNode` rechaza `color`, `variant` y `fullWidth` inválidos con `code: "invalid-layout"` y ruta correcta.
- El nodo normalizado contiene `color`, `variant` y `fullWidth` cuando están declarados.
- Tests de T2 en verde.
- `pnpm test` sin regresiones.

### Cierre de implementación

T2 está cerrada cuando `pnpm test` pasa incluyendo los tests de T2 en verde y los tests de botones existentes sin regresión.

---

## T3 — Añadir función de styling para variantes del botón

**Estado:** completed
**Dependencias:** T1

### Objetivo

Añadir en `runtime-node-styling.ts` la función `getButtonVariantClassName(color, variant, fullWidth)` que devuelve la cadena de clases Tailwind correcta para cada combinación. Mantener las funciones `getPrimaryButtonNodeClassName` y `getSecondaryButtonNodeClassName` existentes para no romper otros consumidores internos.

### Fuera de alcance

- Componente React: es T4.
- Tests de integración de render del botón: es T4.
- No eliminar `getPrimaryButtonNodeClassName` ni `getSecondaryButtonNodeClassName`; solo añadir la nueva.

### Impacto esperado en archivos

- **`src/runtime/runtime-node-styling.ts`** — añadir al final:

  ```ts
  export function getButtonVariantClassName(
    color: ButtonColor,
    variant: ButtonVariant,
    fullWidth: boolean,
  ): string
  ```

  La función construye las clases en dos grupos:
  1. **Base siempre presente** (igual que el botón actual): `inline-flex items-center justify-center rounded-control border px-4 py-3 sm:px-3.5 sm:py-2.5 text-sm font-semibold leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`
  2. **Clases que dependen de `fullWidth`**:
     - `fullWidth === true`: `w-full` (sustituye `self-start`)
     - `fullWidth === false`: `self-start`
  3. **Clases que dependen de `variant` + `color`** (un mapa o switch por variante):

  **`solid`** — fondo sólido, texto contrastante, borde mismo color:
  | color | fondo | borde | texto | hover fondo | hover borde |
  |---|---|---|---|---|---|
  | `neutral` | `bg-gray-500` | `border-gray-500` | `text-white` | `hover:bg-gray-600` | `hover:border-gray-600` |
  | `primary` | `bg-blue-600` | `border-blue-600` | `text-white` | `hover:bg-blue-700` | `hover:border-blue-700` |
  | `success` | `bg-green-600` | `border-green-600` | `text-white` | `hover:bg-green-700` | `hover:border-green-700` |
  | `warning` | `bg-yellow-400` | `border-yellow-400` | `text-gray-900` | `hover:bg-yellow-500` | `hover:border-yellow-500` |
  | `danger` | `bg-red-600` | `border-red-600` | `text-white` | `hover:bg-red-700` | `hover:border-red-700` |
  | `info` | `bg-cyan-500` | `border-cyan-500` | `text-gray-900` | `hover:bg-cyan-600` | `hover:border-cyan-600` |

  **`outline`** — fondo transparente, borde color, texto color, hover fondo suave:
  | color | fondo | borde | texto | hover |
  |---|---|---|---|---|
  | `neutral` | `bg-transparent` | `border-gray-400` | `text-gray-600` | `hover:bg-gray-50` |
  | `primary` | `bg-transparent` | `border-blue-500` | `text-blue-600` | `hover:bg-blue-50` |
  | `success` | `bg-transparent` | `border-green-500` | `text-green-600` | `hover:bg-green-50` |
  | `warning` | `bg-transparent` | `border-yellow-400` | `text-yellow-600` | `hover:bg-yellow-50` |
  | `danger` | `bg-transparent` | `border-red-500` | `text-red-600` | `hover:bg-red-50` |
  | `info` | `bg-transparent` | `border-cyan-500` | `text-cyan-600` | `hover:bg-cyan-50` |

  **`ghost`** — sin borde visible, sin fondo, texto color, hover fondo suave mismo nivel-100 que `badge pill`:
  | color | borde | fondo | texto | hover |
  |---|---|---|---|---|
  | `neutral` | `border-transparent` | `bg-transparent` | `text-gray-600` | `hover:bg-gray-100` |
  | `primary` | `border-transparent` | `bg-transparent` | `text-blue-600` | `hover:bg-blue-100` |
  | `success` | `border-transparent` | `bg-transparent` | `text-green-600` | `hover:bg-green-100` |
  | `warning` | `border-transparent` | `bg-transparent` | `text-yellow-600` | `hover:bg-yellow-100` |
  | `danger` | `border-transparent` | `bg-transparent` | `text-red-600` | `hover:bg-red-100` |
  | `info` | `border-transparent` | `bg-transparent` | `text-cyan-600` | `hover:bg-cyan-100` |

  **`link`** — texto-enlace sin borde ni fondo, subrayado en hover:
  | color | borde | fondo | texto | hover |
  |---|---|---|---|---|
  | `neutral` | `border-transparent` | `bg-transparent` | `text-gray-600` | `hover:underline underline-offset-2` |
  | `primary` | `border-transparent` | `bg-transparent` | `text-blue-600` | `hover:underline underline-offset-2` |
  | `success` | `border-transparent` | `bg-transparent` | `text-green-600` | `hover:underline underline-offset-2` |
  | `warning` | `border-transparent` | `bg-transparent` | `text-yellow-600` | `hover:underline underline-offset-2` |
  | `danger` | `border-transparent` | `bg-transparent` | `text-red-600` | `hover:underline underline-offset-2` |
  | `info` | `border-transparent` | `bg-transparent` | `text-cyan-600` | `hover:underline underline-offset-2` |

  El `focus-visible:outline-*` usa siempre `focus-visible:outline-app-accent` para todas las variantes y colores (idéntico al comportamiento del botón actual y al de los otros nodos). No introducir clases por color.

  Importar `ButtonColor` y `ButtonVariant` desde `../../config/runtime-config`.

### Tests

**Ficheros de test:**
- `src/tests/runtime/runtime-node-styling.test.ts` **(ampliación)**

**Comportamiento cubierto:**
- `getButtonVariantClassName('primary', 'solid', false)` devuelve una cadena que contiene `bg-blue-600`, `text-white`, `self-start` y no contiene `w-full`.
- `getButtonVariantClassName('primary', 'solid', true)` devuelve una cadena que contiene `w-full` y no contiene `self-start`.
- `getButtonVariantClassName('danger', 'solid', false)` contiene `bg-red-600` y `text-white`.
- `getButtonVariantClassName('warning', 'solid', false)` contiene `bg-yellow-400` y `text-gray-900` (texto oscuro para color de baja luminosidad).
- `getButtonVariantClassName('primary', 'outline', false)` contiene `bg-transparent`, `border-blue-500` y `text-blue-600`.
- `getButtonVariantClassName('success', 'ghost', false)` contiene `bg-transparent`, `border-transparent` y `text-green-600`.
- `getButtonVariantClassName('info', 'link', false)` contiene `text-cyan-600` y `hover:underline`.
- `getButtonVariantClassName('neutral', 'outline', false)` contiene `text-gray-600` y `border-gray-400`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
```

**Restricciones:**
- Los tests comprueban substrings de clase con `toContain`; no importa el orden exacto de las clases.
- No snapshotear la cadena completa: el test de "la clase completa exacta" es frágil y no aporta valor.

### Documentación afectada

- Ninguna durante esta tarea. La ficha de `button.md` se actualiza al cerrar la feature completa.

### Criterios de finalización

- `getButtonVariantClassName` existe y exportada.
- Cubre los 4 variantes × 6 colores × ambos estados de `fullWidth`.
- Tests de T3 en verde.
- `pnpm test` sin regresiones.

### Cierre de implementación

T3 está cerrada cuando `pnpm test` pasa incluyendo los nuevos tests de la función de styling en verde.

---

## T4 — Actualizar el componente `ButtonNode` para usar las nuevas props

**Estado:** completed
**Dependencias:** T1, T2, T3

### Objetivo

Modificar `button-layout-node.tsx` para que use `getButtonVariantClassName` con los valores de `props.color`, `props.variant` y `props.fullWidth` del nodo (con sus defaults: `primary`, `solid`, `false`). La lógica de `isImplicitSubmit` solo afecta al atributo `type` del botón, no al styling.

### Fuera de alcance

- No eliminar `getPrimaryButtonNodeClassName` ni `getSecondaryButtonNodeClassName` de `runtime-node-styling.ts`; pueden quedar como funciones internas ya existentes aunque el componente `button` deje de usarlas directamente.
- No cambiar el comportamiento de acciones, navigación ni submit de formulario.

### Impacto esperado en archivos

- **`src/runtime/nodes/button-layout-node.tsx`**:
  - Importar `getButtonVariantClassName` en lugar de `getPrimaryButtonNodeClassName`/`getSecondaryButtonNodeClassName`.
  - Importar `ButtonColor` y `ButtonVariant` desde `../../config/runtime-config`.
  - Sustituir la lógica de `className`:
    ```ts
    const color: ButtonColor = node.props.color ?? 'primary'
    const variant: ButtonVariant = node.props.variant ?? 'solid'
    const fullWidth = node.props.fullWidth ?? false
    const className = getButtonVariantClassName(color, variant, fullWidth)
    ```
  - El atributo `type={isImplicitSubmit ? 'submit' : 'button'}` no cambia.

### Tests

**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-button-styles.test.tsx` **(nuevo)**

**Comportamiento cubierto:**
- Un botón con `props.color: "danger"` y `props.variant: "solid"` renderiza con clase que contiene `bg-red-600`.
- Un botón con `props.color: "primary"` y `props.variant: "outline"` renderiza con clase que contiene `border-blue-500` y `text-blue-600`.
- Un botón con `props.color: "success"` y `props.variant: "ghost"` renderiza con clase que contiene `text-green-600`.
- Un botón con `props.color: "info"` y `props.variant: "link"` renderiza con clase que contiene `hover:underline`.
- Un botón sin `props.color` ni `props.variant` renderiza con clase que contiene `bg-blue-600` (default `primary` + `solid`).
- Un botón con `props.fullWidth: true` renderiza con clase que contiene `w-full`.
- Un botón con `props.fullWidth: false` (o sin la prop) renderiza con clase que contiene `self-start`.
- Un botón submit implícito dentro de `form` con `props.color: "danger"` y `props.variant: "outline"` renderiza con `type="submit"` y clase que contiene `border-red-500` (criterio de aceptación 10 de la spec).
- Un botón submit implícito dentro de `form` con `props.fullWidth: true` renderiza con `type="submit"` y clase que contiene `w-full` (criterio de aceptación 10).
- Un botón no submit con `props.fullWidth: false` renderiza con `type="button"` y clase que contiene `self-start` (criterio de aceptación 9).
- El atributo `data-layout-node="button"` sigue presente en todos los casos.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-button-styles.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx
```

**Restricciones:**
- Usar el harness existente de `layout-renderer-buttons-text.test.tsx` como referencia de setup (render de `LayoutRenderer` con config mínima).
- Los tests comprueban clases CSS con `toHaveClass` o `className.includes`, no snapshots completos.
- Verificar también que los tests de `layout-renderer-buttons-text.test.tsx` siguen en verde sin modificación.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/button.md`: ficha principal del nodo — actualizar contrato de props, reglas de render, validación y variantes al cerrar la feature completa vía `update-app-documentation`.

### Criterios de finalización

- `ButtonNode` usa `getButtonVariantClassName` para todos sus botones.
- El submit implícito sigue funcionando (atributo `type="submit"`).
- Tests de T4 en verde.
- Tests de `layout-renderer-buttons-text.test.tsx` siguen en verde.
- `pnpm test` sin regresiones ni caída de cobertura por debajo del 80 %.

### Cierre de implementación

T4 está cerrada cuando `pnpm test` pasa con todos los tests en verde y la cobertura por encima del umbral mínimo del proyecto.
