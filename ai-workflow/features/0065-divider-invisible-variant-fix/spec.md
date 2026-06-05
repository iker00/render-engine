# Spec: 0065 — Divider invisible variant fix

## Objetivo

Corregir el comportamiento del nodo `divider` con `variant: invisible`: actualmente renderiza una línea visible en lugar de actuar como espaciador puro sin línea.

## Contexto del problema

El elemento `<hr>` recibe `border-top-width: 1px` del preflight de Tailwind v4 (capa base activada por `@import "tailwindcss"`). Las clases actuales de la variante `invisible` (`block h-0`) no anulan ese borde, por lo que el nodo sigue mostrando una línea fina aunque la intención declarada sea un separador invisible.

## Alcance

- Corregir las clases Tailwind de la variante `invisible` en el nodo `divider` para que el borde del elemento `<hr>` quede suprimido.
- Actualizar o ampliar los tests del nodo `divider` para cubrir la ausencia de borde visible en la variante `invisible`.
- Actualizar la ficha funcional `ai-workflow/docs/app-features/nodes/divider.md` para reflejar las clases corregidas.

## Fuera de alcance

- Cambios en las variantes `solid`, `dashed` o `dotted`.
- Cambios en el elemento HTML utilizado para renderizar el nodo.
- Cambios en otras propiedades de `invisible` (dimensiones, comportamiento como espaciador).
- Cambios en ningún otro nodo del catálogo.

## Requisitos funcionales

1. Un nodo `divider` con `variant: invisible` no debe renderizar ninguna línea visible en la interfaz.
2. Un nodo `divider` con `variant: invisible` debe seguir ocupando espacio vertical como espaciador (comportamiento conservado).
3. Las variantes `solid`, `dashed` y `dotted` no deben cambiar de comportamiento ni de clases aplicadas.
4. El contrato HTML del nodo (`<hr data-layout-node="divider">`) no cambia.

## Requisitos no funcionales

- El fix debe implementarse exclusivamente con utilidades de Tailwind CSS, sin estilos inline.
- No debe introducir regresiones en los tests existentes del nodo `divider`.

## Criterios de aceptación

- `divider` con `variant: invisible` no muestra borde ni línea visible en el DOM.
- `divider` con `variant: invisible` tiene la clase `border-0` (o equivalente que suprima el borde) aplicada.
- `divider` con `variant: invisible` mantiene la clase `h-0` para actuar como espaciador de altura cero.
- Los tests del nodo `divider` pasan sin modificar las aserciones de las variantes `solid`, `dashed` y `dotted`.
- El umbral de cobertura global del proyecto (≥ 80 % sobre `src/`) sigue cumpliéndose.

## Casos límite

- **`props.variant` ausente**: el default `solid` no se ve afectado por este cambio.
- **`divider` dentro de `repeater.props.template`**: cada instancia del separador invisible sigue siendo invisible.
- **`divider` con `layout.span`**: el wrapper de grid `col-span-*` no interfiere con la corrección visual.
- **`visibility` evalúa como oculto**: el comportamiento de ocultación no se ve afectado.

## Riesgos o preguntas abiertas

Ninguno. El cambio está acotado a una línea de código y su cobertura de tests.

## Documentación afectada

- `ai-workflow/docs/app-features/nodes/divider.md`: actualizar la tabla de clases Tailwind de la variante `invisible`.
