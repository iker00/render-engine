# Spec: 0083 — Tabs panel visual polish

## Objetivo

Mejorar la apariencia y UX del nodo `tabs` añadiendo padding interno al panel de contenido, un borde perimetral que delimite visualmente el área del panel respecto al resto de la página, y el mismo espaciado entre nodos hijos que tienen las secciones del runtime. El tab activo debe conectarse visualmente con el panel (técnica "tab conectado") para reforzar la relación entre la etiqueta y su contenido.

## Alcance

Afecta exclusivamente al componente visual del nodo `tabs` en su capa de estilos (`runtime-node-styling.ts` y el componente asociado). Sin cambios en contrato JSON, validación, lógica de runtime ni comportamiento funcional.

Aplica a ambas orientaciones: `horizontal` y `vertical`.

## Fuera de alcance

- Cambios en `props`, contrato JSON o esquemas Zod.
- Cambios en lógica de selección de tab activo, visibilidad por item o comportamiento de formulario.
- Theming declarativo desde JSON o nuevas props visuales.
- Cambios en la barra de tabs más allá de eliminar el borde de conexión en el tab activo.
- Animaciones o transiciones nuevas.

## Requisitos funcionales

### Panel de contenido

1. El panel del tab activo debe tener un borde en los cuatro lados usando el token `app-border-soft` (`neutral-200`).
2. El panel debe tener padding interno uniforme en los cuatro lados. El valor concreto se decide en implementación, pero debe ser perceptible y proporcional al espaciado general del runtime (referencia: `p-4` o equivalente).
3. El fondo del panel no cambia; mantiene el fondo heredado del contexto.
4. Los nodos hijos del panel deben apilarse con el mismo gap que las secciones del runtime: `flex flex-col gap-5`. Esto evita que los nodos queden pegados entre sí sin espaciado.

### Técnica "tab conectado"

5. En orientación `horizontal`: el tab activo no tiene borde inferior, de forma que su base se "funde" visualmente con el borde superior del panel. Los tabs inactivos conservan apariencia sin borde inferior visible.
6. En orientación `vertical`: el tab activo no tiene borde derecho, de forma que su lado derecho se "funde" visualmente con el borde izquierdo del panel. Los tabs inactivos conservan apariencia sin borde derecho visible.
7. El resultado visual debe percibirse como que el contenido está "dentro" del tab activo.

### Coherencia con tokens existentes

8. Todos los valores de color, borde y radio deben usar exclusivamente tokens del sistema (`border-app-border-soft`, `rounded-*` usando los radios existentes, etc.). No se introducen valores de color crudos.

## Requisitos no funcionales

- Sin cambios en el contrato JSON ni en validaciones: cero impacto en tests de contrato y validación existentes.
- Los tests de render actuales del nodo `tabs` no deben romperse.
- Los cambios de estilo deben declararse en `runtime-node-styling.ts`, no inline en el JSX del componente.

## Criterios de aceptación

- [ ] El panel del tab activo tiene borde visible en los cuatro lados con el color `app-border-soft`.
- [ ] El panel tiene padding interno apreciable en todos los lados.
- [ ] Los nodos hijos del panel se apilan con `gap-5` entre ellos, sin quedar pegados.
- [ ] En orientación `horizontal`, el tab activo no tiene borde inferior: la transición visual entre etiqueta y panel es continua.
- [ ] En orientación `vertical`, el tab activo no tiene borde derecho: la transición visual entre etiqueta y panel es continua.
- [ ] Los tabs inactivos mantienen su aspecto actual sin alteraciones visuales no intencionadas.
- [ ] La visualización es coherente con el resto de tokens del runtime (sin colores crudos fuera de la paleta semántica).
- [ ] Los tests existentes de `tabs` siguen en verde.
- [ ] La cobertura global del proyecto no cae por debajo del 80%.

## Casos límite

- Tab único visible: el panel muestra borde, padding y gap igualmente.
- Tab sin `children` (panel vacío): el panel renderiza con borde y padding, pero vacío por dentro.
- Tab con un solo nodo hijo: el gap no produce espacio adicional perceptible (comportamiento correcto de `flex-col gap-5`).
- Orientación `vertical` con etiquetas largas con wrapping: el borde izquierdo del panel debe alinearse correctamente con el lado derecho de la barra de tabs.
- Tabs dentro de un `container` con `variant: card`: el borde del panel no debe duplicar visualmente el borde de la card contenedora. Este caso no requiere tratamiento especial en v1; si visualmente resulta excesivo, se resuelve en una feature posterior.

## Riesgos o preguntas abiertas

Ninguno. El alcance está cerrado y los tokens necesarios ya existen en el sistema.

## Áreas de producto afectadas

- Nodo `tabs` (ficha `ai-workflow/docs/app-features/nodes/tabs.md`).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/tabs.md`: actualizar sección de comportamiento visual para describir el nuevo aspecto del panel.
