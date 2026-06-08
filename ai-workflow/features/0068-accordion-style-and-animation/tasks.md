# Tasks: accordion — estilos y animación (0068)

Contrato de ejecución para la implementación. Las tareas están ordenadas; cada tarea debe completarse antes de iniciar la siguiente.

Notas globales (aplican a todas las tareas):
- La feature es puramente visual de runtime. No se cambia el contrato JSON, ni `src/config/`, ni el comportamiento funcional del accordion (toggle, grupos, `defaultOpen`, ARIA, coordinación, casos límite).
- Los tests existentes de `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` deben seguir pasando sin tocar su código. Cualquier estrategia que retrase el unmount de `children` al cerrar romperá las aserciones existentes (p. ej. línea 153 espera `queryByText('Contenido visible')).not.toBeInTheDocument()` síncronamente tras `fireEvent.click`). Por tanto, la animación de cierre debe ocurrir sobre el wrapper del cuerpo, no sobre el desmontaje diferido de los hijos.
- Todos los estilos se implementan con utilidades Tailwind y tokens `@theme` (`app-accent`). No introducir estilos inline ni clases hexadecimales hardcodeadas.
- No introducir props nuevas en el JSON (`animation`, `variant`, `color`, etc.). Si una decisión visual entra en conflicto con el contrato JSON existente, no avanzar y reabrir la spec.

---

## T1 — Restyle de la cabecera con `app-accent` y chevron animado

### Estado
completada

### Objetivo
Cambiar el aspecto visual de la cabecera del nodo `accordion` para alinearla con el color primario del sitio y exponer un indicador visual del estado abierto/cerrado:

- Fondo de la cabecera en estado normal: tono suave del color `app-accent` (`bg-app-accent/10`).
- Hover de la cabecera: mismo tono más marcado (`hover:bg-app-accent/20`).
- Anillo de foco: usar `app-accent` en lugar del azul actual (`focus-visible:ring-2 focus-visible:ring-app-accent` reemplazando el `focus:ring-blue-500` existente). Mantener `focus:outline-none` o equivalente para no romper el reset actual.
- Indicador chevron: añadir un icono tipo chevron al final de la cabecera, alineado a la derecha del texto. El icono apunta hacia abajo cuando el accordion está cerrado (`isOpen === false`) y hacia arriba cuando está abierto (`isOpen === true`).
- La rotación del chevron se anima con una transición suave (`transition-transform duration-200 ease-out`) y se controla aplicando una clase `rotate-180` condicional sobre el icono cuando el accordion está abierto.
- El layout de la cabecera pasa a usar `flex items-center justify-between` para acomodar texto a la izquierda y chevron a la derecha sin romper la lectura del label cuando ocupe varias líneas.

El chevron se implementa como un SVG inline dentro del propio componente (sin librería externa, sin nuevo helper) con `aria-hidden="true"`, marcado con `data-layout-node="accordion-chevron"` para que los tests puedan localizarlo de forma estable.

### Fuera de alcance
- Animación del cuerpo del accordion (apertura/cierre): es T2.
- Cualquier cambio en `src/config/`, en la validación o en el contrato JSON.
- Cualquier cambio en la coordinación de grupos (`AccordionGroupProvider`, `useAccordionGroup`).
- Tokens nuevos en `@theme` (`app-accent` ya existe y se reutiliza tal cual).
- Cambios en `ai-workflow/docs/`. La actualización documental se hace al final de la feature vía `update-app-documentation`.

### Dependencias
Ninguna.

### Impacto esperado en archivos

- Código:
  - `src/runtime/nodes/accordion-layout-node.tsx` — modificar el JSX del `<button data-layout-node="accordion-header">`:
    - Sustituir `bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500` por `bg-app-accent/10 hover:bg-app-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent`.
    - Añadir `flex items-center justify-between` para que el texto y el chevron queden alineados en los extremos opuestos.
    - Envolver el `resolvedLabel` actual en un `<span>` para mantener el texto como bloque medible separado del chevron (el `<span>` no necesita `data-layout-node`).
    - Añadir un SVG inline al final del botón con `data-layout-node="accordion-chevron"`, `aria-hidden="true"`, dimensiones `h-4 w-4`, color `text-app-accent`, `transition-transform duration-200 ease-out` y, condicionalmente, la clase `rotate-180` cuando `isOpen === true`. El path interno puede ser un chevron descendente sencillo (por ejemplo `M6 9l6 6 6-6` con `stroke="currentColor"`, `fill="none"`, `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`); la geometría concreta no es contrato, lo es la rotación condicional.
    - Mantener intactas las props ARIA (`aria-expanded`), `type="button"`, `onClick={handleToggle}` y la lectura del `resolvedLabel`. No tocar el flujo de `claimDefaultOpen`, `openInGroup`, `closeInGroup`, `getActiveInstanceId`, `useEffect`, ni el componente `AccordionGroupProvider`.

- Tests:
  - `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación) — añadir un nuevo `describe` (`AccordionNode — header styling and chevron`) con los casos descritos en la subsección de tests. No modificar los `describe` existentes.

- Documentación:
  - `ai-workflow/docs/app-features/nodes/accordion.md` — se actualizará al final de la feature vía `update-app-documentation` para reflejar el nuevo aspecto visual y el chevron. No forma parte de esta tarea.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación)

#### Comportamiento cubierto
- La cabecera del accordion (`[data-layout-node="accordion-header"]`) contiene la clase `bg-app-accent/10`, la clase `hover:bg-app-accent/20` y la clase `focus-visible:ring-app-accent`, y no contiene ninguna clase `bg-gray-100`, `bg-gray-200`, `focus:ring-blue-500` o `focus:ring-blue-*` heredada.
- La cabecera contiene un elemento `[data-layout-node="accordion-chevron"]` único, marcado como `aria-hidden="true"`.
- Cuando el accordion está cerrado por defecto (sin `defaultOpen`), el chevron NO tiene la clase `rotate-180`.
- Cuando el accordion arranca con `defaultOpen: true`, el chevron TIENE la clase `rotate-180` en el render inicial.
- Tras hacer click en la cabecera de un accordion cerrado, el chevron pasa a tener `rotate-180`; tras un segundo click, vuelve a perder `rotate-180`.
- El chevron incluye la clase `transition-transform` (verificación literal de presencia de la clase) — comprobación mínima de que se aplica una transición; no se mide la duración ni el easing.
- El chevron se renderiza también dentro de un accordion ubicado en `repeater.props.template` (cada iteración tiene su propio chevron, comprobando `querySelectorAll('[data-layout-node="accordion-chevron"]').length` en una colección de al menos 2 items).
- El chevron y el restyle siguen aplicándose cuando el accordion participa en un `groupId` (comprobación mínima: dos accordions con el mismo `groupId`, el primero `defaultOpen: true`, el primer chevron tiene `rotate-180` y el segundo no; tras click en el segundo, los estados de rotación se invierten en el siguiente render).

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx`

#### Restricciones
- Reusar los helpers locales (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`) ya definidos en el fichero. No introducir helpers nuevos.
- Para localizar el chevron usar `container.querySelector('[data-layout-node="accordion-chevron"]')` o `getByRole('button').querySelector(...)`. No usar selectores basados en geometría del SVG.
- Las aserciones de clases Tailwind se hacen con `toHaveClass` o `classList.contains(...)`. No comparar `className` completo como cadena.
- No introducir snapshots de DOM. No assert sobre estilos calculados (`getComputedStyle`), solo sobre presencia/ausencia de clases.
- No modificar los `describe` existentes ni reordenar tests previos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/accordion.md` — añadir mención al fondo `app-accent`, al chevron como indicador visual del estado, y a la rotación animada. La actualización se ejecuta al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- La cabecera del accordion se renderiza con `bg-app-accent/10`, `hover:bg-app-accent/20` y `focus-visible:ring-app-accent`, sin restos de las clases `bg-gray-*` o `focus:ring-blue-500` anteriores.
- Existe un único chevron `[data-layout-node="accordion-chevron"]` por accordion, con `aria-hidden="true"` y la clase `rotate-180` aplicada exactamente cuando el accordion está abierto.
- El chevron incluye la clase `transition-transform`.
- Todos los tests del fichero pasan: los previos sin modificación y los nuevos del bloque añadido.
- `pnpm test` sigue cumpliendo el umbral global del 80 % de cobertura.

### Cierre de implementación
T1 está cerrada cuando el restyle de la cabecera y el chevron animado están implementados, los tests previos y los nuevos pasan en verde, y `pnpm test` no rompe regresiones ni cobertura.

---

## T2 — Transición suave de apertura y cierre del cuerpo

### Estado
completada

### Objetivo
Añadir una transición visual suave al wrapper del cuerpo del accordion (`[data-layout-node="accordion-body"]`) para que al expandirse y al contraerse el bloque no aparezca ni desaparezca de golpe.

Estrategia de implementación obligatoria:
- Mantener la lógica actual de `isOpen` y la coordinación de grupos sin cambios.
- Renderizar siempre el wrapper `<div data-layout-node="accordion-body">` (independientemente de `isOpen`), aplicando clases Tailwind que animan la altura mediante el patrón `grid-template-rows` (`grid grid-rows-[0fr]` cuando cerrado, `grid grid-rows-[1fr]` cuando abierto, con `transition-[grid-template-rows] duration-200 ease-out`).
- Dentro del wrapper anterior, mantener un `<div className="overflow-hidden">` que envuelve la renderización condicional de los hijos.
- Los hijos (`<LayoutRenderer ... />`) se siguen renderizando condicionalmente con el patrón actual `{isOpen && (...)}`. NO se introduce desmontaje diferido, NO se introducen timers, NO se usan callbacks `onTransitionEnd`. Esta restricción es obligatoria para preservar las aserciones síncronas de los tests existentes (p. ej. línea 153 de `layout-renderer-accordion.test.tsx`).
- Las clases de padding actuales (`px-4 py-2`) se aplican al `<div className="overflow-hidden">` interior, no al wrapper exterior, para que el wrapper pueda colapsar a altura cero sin dejar padding residual.
- Cuando `isOpen` pasa de `true` a `false`, los hijos se desmontan síncronamente (igual que hoy) y el wrapper exterior anima su altura de `1fr` a `0fr`. Visualmente, el espacio circundante colapsa de forma suave aunque el contenido desaparezca de inmediato. Esta es la interpretación funcional acordada para conciliar el requisito "no desaparece de golpe" con la restricción "los tests existentes no se modifican".
- Cuando `isOpen` pasa de `false` a `true`, los hijos se montan inmediatamente y el wrapper anima su altura de `0fr` a `1fr`, mostrando los hijos progresivamente conforme el espacio se abre (el `overflow-hidden` los recorta hasta que la animación finaliza).
- No se anima el montaje inicial cuando `defaultOpen: true`: dado que `isOpen` arranca en `true`, el wrapper ya nace con `grid-rows-[1fr]` y no hay transición de estado inicial. Esto cubre el caso límite "Accordion con `defaultOpen: true`: el chevron arranca en orientación abierto sin animación inicial".
- Si `node.children` está ausente o vacío, el wrapper sigue existiendo y la transición se aplica igual, mostrando un colapso/expansión vacío (cubre el caso límite "Accordion sin children").

### Fuera de alcance
- Cualquier cambio de comportamiento funcional (toggle, ARIA, grupos, `defaultOpen`, coordinación, `visibility`, `queryStateFeedback`).
- Hacer configurable la duración o el easing desde JSON.
- Reemplazar la animación CSS por una solución basada en librerías externas (`framer-motion`, `react-transition-group`, etc.).
- Cambios en `src/config/`.
- Cambios documentales bajo `ai-workflow/docs/`; se actualizan al final de la feature vía `update-app-documentation`.

### Dependencias
T1.

### Impacto esperado en archivos

- Código:
  - `src/runtime/nodes/accordion-layout-node.tsx` — modificar el bloque actual:
    ```tsx
    {isOpen && (
      <div data-layout-node="accordion-body" className="px-4 py-2">
        {node.children && node.children.length > 0 ? (
          <LayoutRenderer nodes={node.children} iterationContext={iterationContext} />
        ) : null}
      </div>
    )}
    ```
    Sustituirlo por una versión equivalente en comportamiento pero con wrapper siempre presente:
    ```tsx
    <div
      data-layout-node="accordion-body"
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
    >
      <div className="overflow-hidden">
        {isOpen && node.children && node.children.length > 0 ? (
          <div className="px-4 py-2">
            <LayoutRenderer nodes={node.children} iterationContext={iterationContext} />
          </div>
        ) : null}
      </div>
    </div>
    ```
    El `px-4 py-2` se mueve a un wrapper interno renderizado solo cuando hay hijos, para que el wrapper exterior pueda colapsar a altura cero sin dejar padding residual ni alterar la apariencia cuando el accordion está abierto.

- Tests:
  - `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación) — añadir un nuevo `describe` (`AccordionNode — body open/close transition`) con los casos descritos abajo. No modificar los `describe` existentes (incluido el bloque que asume desmontaje síncrono de hijos al cerrar).

- Documentación:
  - `ai-workflow/docs/app-features/nodes/accordion.md` — añadir descripción de la transición suave de apertura/cierre y precisar que los hijos siguen desmontándose del DOM al cerrar (la transición opera sobre el wrapper). Se actualiza al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación)

#### Comportamiento cubierto
- Con el accordion cerrado por defecto, el wrapper `[data-layout-node="accordion-body"]` SÍ está en el DOM (a diferencia del comportamiento anterior, que lo desmontaba). El test verifica `container.querySelector('[data-layout-node="accordion-body"]')` no nulo cuando el accordion está cerrado.
- Con el accordion cerrado, el wrapper del cuerpo tiene la clase `grid-rows-[0fr]` y no tiene `grid-rows-[1fr]`. También tiene `grid` y `transition-[grid-template-rows]`.
- Con el accordion abierto (vía `defaultOpen: true`), el wrapper del cuerpo tiene la clase `grid-rows-[1fr]` y no tiene `grid-rows-[0fr]`.
- Tras hacer click en la cabecera de un accordion cerrado, el wrapper pasa a tener `grid-rows-[1fr]` y los hijos aparecen en el DOM (`getByText('...')`).
- Tras hacer click en la cabecera de un accordion abierto (defaultOpen: true), el wrapper pasa a tener `grid-rows-[0fr]` y los hijos dejan de estar en el DOM (`queryByText('...')` devuelve null). Este test valida explícitamente que el desmontaje sigue siendo síncrono al cerrar.
- Con el accordion abierto y `children` declarados, dentro del wrapper exterior existe un wrapper interno con clase `overflow-hidden`, y dentro de éste un wrapper con `px-4 py-2` que contiene los hijos.
- Con el accordion abierto y `children: []`, el wrapper exterior y el `overflow-hidden` existen pero no contienen el wrapper de padding (`px-4 py-2`) ni ningún hijo.
- Con el accordion cerrado, el wrapper interno `overflow-hidden` existe pero no contiene `px-4 py-2` ni hijos.
- Caso `visibility` oculto: el wrapper exterior `[data-layout-node="accordion-body"]` NO se renderiza (ni la cabecera tampoco), igual que en el comportamiento previo (este caso ya está cubierto en los tests previos del fichero; no es necesario duplicarlo aquí salvo que aporte cobertura nueva sobre el wrapper en sí — preferible omitir si ya existe equivalente).
- Caso `queryStateFeedback` activo en modo `fallback`: el accordion entero se sustituye por el fallback y el wrapper del cuerpo no se renderiza (también ya cubierto en tests previos; no duplicar).

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx`

#### Restricciones
- Reusar los helpers locales del fichero (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`).
- Las aserciones de clases Tailwind se hacen con `toHaveClass` o `classList.contains(...)`. No comparar `className` completo como cadena.
- Para verificar la jerarquía interna del wrapper (existencia del `overflow-hidden` y del bloque de padding), usar selectores CSS sobre `container` y comprobar `.children` o `querySelector`. No assert sobre la geometría calculada.
- No introducir esperas asíncronas (`await waitFor`, fake timers) para validar el desmontaje al cerrar: el desmontaje es síncrono por contrato.
- No modificar los tests previos del fichero (`AccordionNode — initial state`, `AccordionNode — ARIA accessibility`, `AccordionNode — toggle behavior`, etc.) ni los helpers compartidos.
- No introducir snapshots de DOM.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/accordion.md` — actualizar la sección "Comportamiento" para mencionar la transición suave de apertura/cierre y aclarar que los hijos siguen desmontándose del DOM al cerrar (la transición opera sobre el wrapper). La actualización se ejecuta al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- El wrapper `[data-layout-node="accordion-body"]` está siempre en el DOM cuando el accordion no está oculto por `visibility` ni reemplazado por `queryStateFeedback`.
- El wrapper anima la transición de `grid-template-rows` con duración corta y easing natural.
- Los hijos se montan/desmontan síncronamente en función de `isOpen`, preservando las aserciones existentes.
- El padding del cuerpo (`px-4 py-2`) está dentro de un wrapper interno renderizado solo cuando hay hijos.
- Todos los tests del fichero pasan: los previos sin modificación y los nuevos del bloque añadido.
- `pnpm test` sigue cumpliendo el umbral global del 80 % de cobertura.

### Cierre de implementación
T2 está cerrada cuando la transición del cuerpo está implementada con el patrón CSS-only descrito, los hijos siguen desmontándose síncronamente al cerrar, los tests previos y los nuevos pasan en verde, y `pnpm test` no rompe regresiones ni cobertura. Al cerrar T2 la feature queda lista para invocar `update-app-documentation`, que se encarga de actualizar `ai-workflow/docs/app-features/nodes/accordion.md` con el nuevo aspecto visual y la transición.

---

## Próxima tarea
T1 — Restyle de la cabecera con `app-accent` y chevron animado.

---

## Documentación afectada (resumen global)
- `ai-workflow/docs/app-features/nodes/accordion.md` — única ficha funcional afectada. Las actualizaciones se ejecutan al final de la feature vía `update-app-documentation`.
