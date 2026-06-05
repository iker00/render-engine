# Plan de implementación: 0065 — Divider invisible variant fix

## Resumen

Fix de una línea en el mapa de variantes de `DividerNode` para que la variante `invisible` incluya `border-0` y así suprima el borde que aplica el preflight de Tailwind v4 al elemento `<hr>`. Se amplía el test de render existente para verificar la presencia de `border-0` y se actualiza la tabla de clases en la ficha funcional del nodo.

---

## Tarea T-01 — Corregir las clases Tailwind de la variante `invisible` en `DividerNode`

**ID**: T-01
**Estado**: completada
**Dependencias**: ninguna

### Objetivo

Añadir `border-0` al string de clases de la variante `invisible` en `variantClassMap` dentro de `src/runtime/nodes/divider-layout-node.tsx`, de modo que el preflight de Tailwind v4 no renderice ninguna línea visible cuando la variante es `invisible`.

### Fuera de alcance

- Cambios en las variantes `solid`, `dashed` o `dotted`.
- Cambios en el elemento HTML (`<hr>`), en su atributo `data-layout-node` o en cualquier otra prop del componente.
- Cambios en otras propiedades de `invisible` (`block`, `h-0`), que se conservan.
- Cambios en cualquier otro nodo del catálogo.
- Cambios en el schema Zod de validación del nodo `divider`.
- Introducción de estilos inline o clases que no sean utilidades de Tailwind CSS.

### Impacto esperado en archivos

| Archivo | Acción |
|---|---|
| `src/runtime/nodes/divider-layout-node.tsx` | Modificar: cambiar `'block h-0'` por `'block h-0 border-0'` en `variantClassMap.invisible`. |
| `src/tests/layout-renderer/layout-renderer-divider.test.tsx` | Ampliar: añadir aserción `toHaveClass('border-0')` en el test de la variante `invisible`; añadir test que verifica que `border-0` no está en las variantes `solid`, `dashed` y `dotted`. |

### Tests

#### Ficheros de test

- `src/tests/layout-renderer/layout-renderer-divider.test.tsx` **(ampliación)**: añade casos al `describe` existente `DividerNode — data-layout-node and variants`.

#### Comportamiento cubierto

- Un nodo `divider` con `variant: "invisible"` tiene la clase `border-0` aplicada en el elemento `<hr>`.
- Un nodo `divider` con `variant: "invisible"` mantiene las clases `block` y `h-0`.
- Un nodo `divider` con `variant: "invisible"` no tiene `border-t`.
- Un nodo `divider` con `variant: "solid"` no tiene `border-0`.
- Un nodo `divider` con `variant: "dashed"` no tiene `border-0`.
- Un nodo `divider` con `variant: "dotted"` no tiene `border-0`.

Los tests existentes de las variantes `solid`, `dashed` y `dotted` deben seguir pasando sin modificación de sus aserciones.

#### Comandos durante la implementación

```
pnpm test --run src/tests/layout-renderer/layout-renderer-divider.test.tsx
```

#### Restricciones

- Reusar el harness `renderRuntimePage` ya presente en el fichero; no introducir nuevos helpers.
- No modificar el test del caso `variant: "invisible" without border-t class` (nombre y aserción existentes se conservan). La aserción de `border-0` se añade como aserción adicional en ese mismo test o como test nuevo nombrado explícitamente, a criterio del implementador, siempre que la intención sea inequívoca.
- No usar snapshots.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/divider.md`: actualizar la fila `invisible` en la tabla de variantes de estilo para reflejar las clases corregidas (`block h-0 border-0`).

### Criterios de finalización

- `variantClassMap.invisible` en `divider-layout-node.tsx` contiene `'block h-0 border-0'`.
- El test de `variant: "invisible"` verifica `toHaveClass('border-0')`.
- Los tests de `variant: "solid"`, `variant: "dashed"` y `variant: "dotted"` verifican `not.toHaveClass('border-0')` (o pasan sin esa aserción si ya no tienen clase `border-0`, sin alterar las aserciones previas).
- `pnpm test --run src/tests/layout-renderer/layout-renderer-divider.test.tsx` pasa con todos los tests en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados: `pnpm test --run src/tests/layout-renderer/layout-renderer-divider.test.tsx` pasa en verde, sin regresiones en los tests preexistentes del fichero.
