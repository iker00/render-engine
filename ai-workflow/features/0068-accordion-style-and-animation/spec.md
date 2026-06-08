# Spec: 0068 — Accordion: estilos y animación

## Objetivo

Mejorar la apariencia visual del nodo `accordion` usando el color primario del sitio en lugar del gris genérico actual, y añadir una transición suave al abrir y cerrar el cuerpo. El cambio es puramente visual y de runtime: no introduce nuevas props, no modifica el contrato JSON ni el comportamiento funcional existente.

## Alcance

- Cabecera del accordion: fondo con tono suave del color primario del sitio (`app-accent`), con estado hover más marcado del mismo tono.
- Anillo de foco de la cabecera: usa el color primario del sitio en lugar del azul genérico actual.
- Indicador visual de estado abierto/cerrado: icono tipo chevron en la cabecera que cambia de orientación según el estado del accordion.
- Transición de apertura: el cuerpo del accordion aparece con una animación suave al expandirse.
- Transición de cierre: el cuerpo del accordion desaparece con una animación suave al contraerse.
- Todos los estilos se implementan con utilidades de Tailwind CSS y tokens globales del tema, sin estilos inline ni capas visuales paralelas.

## Fuera de alcance

- Ninguna prop nueva en el JSON (`animation`, `variant`, `color` u otra).
- El color primario no es configurable por instancia desde JSON.
- La duración o el tipo de animación no son configurables desde JSON.
- No se cambia el comportamiento funcional del accordion: toggle, grupos, `defaultOpen`, coordinación de grupos, accesibilidad ARIA y casos límite siguen igual.
- No se cambia el contrato de validación de `src/config/`.
- No se introduce theming declarativo ni API visual configurable.
- No se mejoran los estilos de otros nodos.

## Requisitos funcionales

1. La cabecera del accordion usa un fondo de tono suave del color `app-accent` en estado normal.
2. El hover de la cabecera usa un tono algo más marcado del mismo color.
3. El anillo de foco (`focus-visible` o `focus`) usa el color `app-accent`.
4. La cabecera muestra un icono tipo chevron alineado a la derecha. El icono está orientado hacia abajo cuando el accordion está cerrado y hacia arriba cuando está abierto.
5. El chevron tiene una transición suave de rotación al cambiar de estado.
6. El cuerpo del accordion aparece con una transición suave al expandirse (apertura).
7. El cuerpo del accordion desaparece con una transición suave al contraerse (cierre).
8. Las transiciones no deben ser agresivas: duración corta, easing natural.

## Requisitos no funcionales

- No se introducen props nuevas ni cambios en el contrato JSON.
- Los tests existentes del nodo `accordion` deben seguir en verde sin modificación.
- El umbral de cobertura global del proyecto (80 %) no debe verse afectado.
- Los tokens visuales globales (`app-accent`, etc.) se consumen desde `@theme` de `src/app/index.css`, no se hardcodean valores hexadecimales en el componente.

## Criterios de aceptación

- [ ] La cabecera tiene fondo con tono suave de `app-accent` en estado normal.
- [ ] El hover de la cabecera es visualmente distinguible y usa el mismo tono con más intensidad.
- [ ] El anillo de foco usa `app-accent`.
- [ ] El chevron está visible en la cabecera, alineado a la derecha del texto.
- [ ] El chevron apunta hacia abajo cuando el accordion está cerrado y hacia arriba cuando está abierto.
- [ ] La rotación del chevron tiene una transición suave.
- [ ] Al abrir el accordion, el cuerpo aparece con una transición suave (no aparece de golpe).
- [ ] Al cerrar el accordion, el cuerpo desaparece con una transición suave (no desaparece de golpe).
- [ ] Ningún test existente del nodo `accordion` falla tras el cambio.
- [ ] El cambio no rompe el umbral de cobertura global.

## Casos límite

- **Accordion dentro de `repeater`**: cada instancia mantiene su chevron y animación de forma independiente.
- **Accordion con `groupId`**: el chevron y la animación se comportan igual que en el caso independiente; el cambio no interfiere con la coordinación de grupos.
- **Accordion con `defaultOpen: true`**: el chevron arranca en orientación "abierto" sin animación inicial (no se anima el montaje inicial).
- **Accordion sin `children`**: la transición se aplica igualmente aunque el cuerpo esté vacío.
- **Accordion dentro de `form`**: los estilos no interfieren con los campos de formulario del cuerpo.
- **Visibility oculto**: ni cabecera ni cuerpo se renderizan; el cambio visual no afecta a esta rama.
- **`queryStateFeedback` activo**: el nodo entero se sustituye por el feedback; el cambio visual no afecta a esta rama.

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de producto están cerradas.
