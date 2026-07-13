# Tasks: 0083 — Tabs panel visual polish

## Resumen ejecutivo

La feature es un cambio puramente visual sobre el nodo `tabs`, sin impacto en contrato JSON ni en lógica de runtime.
Toda la modificación vive en `src/runtime/runtime-node-styling.ts` (clases del panel y del botón activo) más la
actualización del test unitario que ya cubre esas funciones. El componente JSX no cambia porque las firmas actuales de
`getTabsPanelClassName()` y `getTabsButtonClassName(isActive, orientation)` ya proveen toda la información necesaria.

Una sola tarea atómica cubre todo el alcance.

Siguiente tarea a ejecutar: **T1**.

---

## T1 — Aplicar borde, padding y técnica "tab conectado" en el styling del nodo `tabs`

- **ID**: T1
- **Estado**: completada
- **Objetivo**: Modificar las funciones de estilo del nodo `tabs` para que el panel del tab activo tenga un borde
  perimetral con el token `app-border-soft`, padding interno uniforme y un layout `flex flex-col gap-5` que apile sus
  nodos hijos con el mismo espaciado vertical que las secciones del runtime, y para que el tab activo aplique la
  técnica "tab conectado" omitiendo el borde del lado que linda con el panel (inferior en `horizontal`, derecho en
  `vertical`). El tab activo sustituye su indicador actual `border-b-2 border-primary-600` por un borde de tres lados
  con `app-border-soft` que se funde con el del panel. El indicador semántico de tab activo sigue siendo la
  combinación de `text-primary-700` + `font-semibold` ya existente, sin nuevo color crudo.

- **Fuera de alcance**:
  - Cambios en `props.items`, `props.orientation`, `props.defaultTab` o cualquier otra prop del nodo.
  - Cambios en el contrato JSON o en los esquemas Zod.
  - Cambios en `tabs-layout-node.tsx` (componente JSX) más allá de lo que pudiera necesitar la firma de las funciones
    de estilo; la implementación debe mantener las firmas actuales para evitar tocar el JSX.
  - Cambios en la lógica de selección de tab activo, visibilidad por item o comportamiento de formulario.
  - Theming declarativo desde JSON o nuevas props visuales.
  - Animaciones o transiciones nuevas más allá de las existentes.
  - Tratamiento especial para el caso `tabs` dentro de `container variant: card` (el spec lo deja explícitamente para
    una posible feature futura).

- **Dependencias**: ninguna.

- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-node-styling.ts` — modificar `getTabsPanelClassName()` para añadir
      `border border-app-border-soft p-4 flex flex-col gap-5` (con `p-4` o padding perceptible equivalente)
      manteniendo `flex-1`; modificar
      `getTabsButtonClassName(isActive, orientation)` para que la rama activa devuelva, en lugar del par actual
      `border-b-2 border-primary-600`, un borde de tres lados con `border-app-border-soft` apropiado a la
      `orientation` (en `horizontal`: borde superior, izquierdo y derecho; en `vertical`: borde superior, izquierdo
      e inferior), conservando `text-primary-700`, `font-semibold`, `transition-colors` y los orientation classes
      existentes. La rama inactiva no cambia.
  - Tests:
    - `src/tests/runtime/runtime-node-styling.test.ts` — actualizar los casos del bloque
      `T6 — tabs styling functions` que asertan el contenido actual de panel y botón activo, y añadir los casos
      nuevos descritos en el sub-bloque `tests` de esta tarea.
  - Documentación a revisar tras la implementación (no se actualiza en esta tarea, queda como referencia para
    `update-app-documentation`):
    - `ai-workflow/docs/app-features/nodes/tabs.md` — sección "Comportamiento visual de la barra de tabs": añadir
      descripción del nuevo aspecto visual del panel (borde + padding) y de la técnica "tab conectado" por
      orientación.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación) — actualiza y amplía el bloque
      `T6 — tabs styling functions` ya existente. No se crean ficheros nuevos.
  - **Comportamiento cubierto**:
    - `getTabsPanelClassName()` contiene `flex-1`, `border`, `border-app-border-soft` y un padding interno
      perceptible (`p-4` o equivalente declarado por la implementación). El nombre del padding utilizado debe ser un
      token Tailwind del sistema, no un valor crudo.
    - `getTabsPanelClassName()` contiene `flex`, `flex-col` y `gap-5` para apilar los nodos hijos del panel con el
      mismo espaciado vertical que las secciones del runtime.
    - `getTabsPanelClassName()` no contiene `bg-` ni cambia el fondo (preserva el fondo heredado del contexto).
    - `getTabsButtonClassName(true, 'horizontal')` contiene `border-app-border-soft`, contiene clases que aplican
      borde a los lados superior, izquierdo y derecho, y NO contiene una clase de borde inferior visible (ni
      `border-b`, ni `border-b-2`, ni `border-b-4`, etc.) ni `border-primary-600`.
    - `getTabsButtonClassName(true, 'vertical')` contiene `border-app-border-soft`, contiene clases que aplican
      borde a los lados superior, izquierdo e inferior, y NO contiene una clase de borde derecho visible (`border-r*`)
      ni `border-primary-600`.
    - `getTabsButtonClassName(true, 'horizontal')` y `getTabsButtonClassName(true, 'vertical')` siguen conteniendo
      `text-primary-700`, `font-semibold` y `transition-colors`, además de los orientation classes existentes
      (`shrink-0 whitespace-nowrap` para `horizontal`, `text-left whitespace-normal break-words` para `vertical`).
    - `getTabsButtonClassName(false, 'horizontal')` y `getTabsButtonClassName(false, 'vertical')` no contienen
      `border-app-border-soft` ni `border-primary-600` (los tabs inactivos no introducen borde visible nuevo).
    - Los casos existentes del bloque `T6` que verifican estructura general de root, bar y orientación se mantienen
      verdes sin cambios funcionales.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx`
  - **Restricciones**:
    - No introducir colores crudos (`neutral-*`, `gray-*`, valores hex) fuera de los tokens semánticos del sistema.
    - No declarar estilos inline en `tabs-layout-node.tsx`; todo cambio de clase vive en `runtime-node-styling.ts`.
    - Mantener las firmas actuales de `getTabsPanelClassName()` y `getTabsButtonClassName(isActive, orientation)`
      para no obligar a tocar el JSX.

- **Documentación afectada**:
  - `ai-workflow/docs/app-features/nodes/tabs.md` (referencia para `update-app-documentation`).

- **Criterios de finalización**:
  - El panel del tab activo muestra borde en los cuatro lados con `app-border-soft` y padding interno perceptible
    en los cuatro lados, sin alterar el fondo heredado.
  - El panel apila sus nodos hijos con `flex flex-col gap-5`, replicando el espaciado vertical de las secciones del
    runtime.
  - En `horizontal`, el tab activo no tiene borde inferior visible y aplica borde superior, izquierdo y derecho con
    `app-border-soft`, fusionándose con el borde superior del panel.
  - En `vertical`, el tab activo no tiene borde derecho visible y aplica borde superior, izquierdo e inferior con
    `app-border-soft`, fusionándose con el borde izquierdo del panel.
  - Los tabs inactivos siguen renderizándose sin borde visible nuevo.
  - Los tests del fichero `src/tests/runtime/runtime-node-styling.test.ts` están en verde, incluyendo los casos
    nuevos y los previos del bloque `T6`.
  - Los tests existentes del nodo `tabs`
    (`src/tests/layout-renderer/layout-renderer-tabs.test.tsx`,
    `src/tests/runtime/runtime-form-tabs.test.tsx`,
    `src/tests/config-validation/runtime-config-validation-tabs.test.ts`,
    `src/tests/config-validation/runtime-config-validation-forms-tabs.test.ts`) siguen verdes sin modificaciones.

- **Cierre de implementación**:
  - Código y tests de la tarea completos y validados.
  - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` y
    `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx` en verde.
  - `pnpm test` completo en verde respetando el umbral global de cobertura del proyecto (regla global).
