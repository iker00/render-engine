# Tasks: accordion — gap fijo en el cuerpo (0069)

Contrato de ejecución para la implementación. La feature consta de una única tarea atómica.

Notas globales (aplican a la tarea):
- La feature es puramente visual de runtime. No se cambia el contrato JSON, ni `src/config/`, ni el comportamiento funcional del accordion (toggle, grupos, `defaultOpen`, ARIA, coordinación, casos límite, transición ya implementada en feature 0068).
- Los tests existentes de `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` deben seguir pasando sin tocar su código.
- El gap se implementa con utilidades Tailwind ya en uso en el proyecto. No introducir estilos inline ni clases hexadecimales hardcodeadas.
- No se introducen props nuevas (`props.gap` ni equivalentes). El gap es siempre fijo.
- El alias `md` del nodo `container` está mapeado en `src/runtime/runtime-node-styling.ts` (`containerGapClassMap.md = 'gap-5'`). El gap del cuerpo del accordion debe usar la misma utilidad Tailwind `gap-5` para mantener consistencia visual con `md`.

---

## T1 — Gap fijo entre hijos del cuerpo del accordion

### Estado
completada

### Objetivo
Añadir un espaciado vertical fijo entre los hijos directos del cuerpo del nodo `accordion` cuando está expandido, equivalente al gap `md` del nodo `container` (`gap-5` en Tailwind).

Estrategia de implementación:
- En `src/runtime/nodes/accordion-layout-node.tsx`, el `<div>` que actualmente envuelve la llamada a `<LayoutRenderer ... />` dentro del cuerpo del accordion lleva las clases `px-4 py-2`. A esas clases se les añaden `flex flex-col gap-5` (en ese orden semántico): `flex flex-col` asegura que los hijos directos del `LayoutRenderer` (que es un Fragment, por lo que los nodos hijos quedan como hermanos directos del wrapper) se dispongan como columna, y `gap-5` aplica el espaciado entre ellos.
- El wrapper interno con `px-4 py-2 flex flex-col gap-5` solo se renderiza cuando `node.children` existe y tiene al menos un elemento (comportamiento actual preservado). Cuando el cuerpo está colapsado o sin hijos, el wrapper no está en el DOM y por tanto el gap no produce efecto observable.
- No se altera ningún otro aspecto del JSX: el wrapper exterior `[data-layout-node="accordion-body"]` con `animate-accordion-open`/`animate-accordion-close` y el `onAnimationEnd` se conservan tal cual.
- No se introducen nuevas clases en `src/app/index.css`, ni se modifica `containerGapClassMap`, ni el sistema de theming. La elección de `gap-5` es deliberada para mantener consistencia visual con `md` sin crear acoplamiento de código.

### Fuera de alcance
- Cualquier cambio del contrato JSON o de validación (`src/config/`).
- Hacer configurable el gap desde JSON (`props.gap` u otro).
- Cambios en la coordinación de grupos, animaciones o lógica de apertura/cierre.
- Cambios en `containerGapClassMap` o en utilidades de `runtime-node-styling.ts`.
- Cambios en el wrapper exterior del cuerpo (`data-layout-node="accordion-body"`).
- Cambios documentales bajo `ai-workflow/docs/`; se actualizan después de cerrar la implementación vía `update-app-documentation`.

### Dependencias
Ninguna.

### Impacto esperado en archivos

- Código:
  - `src/runtime/nodes/accordion-layout-node.tsx` — modificar la línea que actualmente declara `<div className="px-4 py-2">` (el wrapper interno que envuelve `<LayoutRenderer ... />` cuando hay hijos) para que pase a declarar `<div className="px-4 py-2 flex flex-col gap-5">`. No cambiar nada más del fichero.

- Tests:
  - `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación) — añadir un nuevo `describe` (`AccordionNode — body gap between children`) con los casos descritos en la subsección de tests. No modificar los `describe` existentes.

- Documentación:
  - `ai-workflow/docs/app-features/nodes/accordion.md` — se actualizará al final de la feature vía `update-app-documentation` para mencionar el gap fijo del cuerpo en la sección de estilo visual. No forma parte de esta tarea.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación)

#### Comportamiento cubierto
- Con un accordion abierto (`defaultOpen: true`) y dos o más hijos, el wrapper interno del cuerpo (el que contiene `px-4 py-2`) tiene además las clases `flex`, `flex-col` y `gap-5`. Selector: `container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')`.
- Con un accordion abierto y un único hijo, el mismo wrapper interno también tiene `flex`, `flex-col` y `gap-5` (la presencia de las clases no depende del número de hijos; el gap es transparente en este caso).
- Con un accordion cerrado por defecto (sin `defaultOpen`), el wrapper interno con `px-4 py-2` NO existe en el DOM (sigue valiendo la comprobación existente del fichero sobre ausencia de body en cerrado). En consecuencia, tampoco existen las clases `gap-5` ni `flex flex-col` aplicadas a ningún elemento dentro de `[data-layout-node="accordion-body"]`.
- Con un accordion abierto y `children: []`, el wrapper interno con `px-4 py-2 flex flex-col gap-5` NO se renderiza (regla preservada del comportamiento actual). Verificación: `container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')` devuelve `null`.
- Tras hacer click en la cabecera de un accordion cerrado con dos o más hijos, el wrapper interno pasa a estar en el DOM y contiene las clases `flex`, `flex-col` y `gap-5` (verificación tras el `fireEvent.click` que ya usa el resto del fichero, sin esperas asíncronas).

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx`

#### Restricciones
- Reusar los helpers locales del fichero (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`). No introducir helpers nuevos.
- Las aserciones de clases Tailwind se hacen con `toHaveClass` o `classList.contains(...)`. No comparar `className` completo como cadena.
- No introducir snapshots de DOM ni assert sobre estilos calculados (`getComputedStyle`).
- No modificar los `describe` existentes ni reordenar tests previos.
- No introducir esperas asíncronas (`await waitFor`, fake timers) para validar la presencia/ausencia del wrapper interno: el render es síncrono por contrato.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/accordion.md` — añadir una mención al gap fijo del cuerpo en la sección de estilo visual (consistente con el gap `md` del nodo `container`). La actualización se ejecuta al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- El wrapper interno del cuerpo del accordion (`px-4 py-2`) se renderiza con las clases adicionales `flex flex-col gap-5` cuando el accordion está expandido y tiene al menos un hijo.
- El wrapper interno no se renderiza cuando el accordion está cerrado o no tiene hijos (comportamiento previo preservado).
- Todos los tests del fichero `layout-renderer-accordion.test.tsx` pasan: los previos sin modificación y los nuevos del bloque añadido.
- `pnpm test` sigue pasando y cumpliendo el umbral global del 80 % de cobertura.

### Cierre de implementación
T1 está cerrada cuando el wrapper interno del cuerpo del accordion incluye las clases `flex flex-col gap-5` además de `px-4 py-2`, los tests previos y los nuevos pasan en verde, y `pnpm test` no rompe regresiones ni cobertura. Al cerrar T1, la feature queda lista para invocar `update-app-documentation`, que se encarga de reflejar el gap fijo en `ai-workflow/docs/app-features/nodes/accordion.md`.

---

## Próxima tarea
T1 — Gap fijo entre hijos del cuerpo del accordion.

---

## Documentación afectada (resumen global)
- `ai-workflow/docs/app-features/nodes/accordion.md` — única ficha funcional afectada. La actualización se ejecuta al final de la feature vía `update-app-documentation`.
