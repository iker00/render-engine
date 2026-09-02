# `2026-09-02-14-22-modal-vertical-scroll` — Scroll vertical del panel del nodo `modal`

## Objetivo

Cuando el contenido de un nodo `modal` supera la altura disponible del viewport, el panel debe limitar su alto máximo y ofrecer scroll vertical interno, en lugar de desbordarse sin control.

## Alcance

- Limitar el alto máximo del panel del `modal` a `90vh` del viewport.
- Activar scroll vertical interno (`overflow-y-auto`) sobre el panel cuando su contenido supera ese alto máximo.
- Aplicar el comportamiento de forma uniforme a los tres tamaños existentes (`sm`, `md`, `lg`).
- Aplicar el comportamiento a toda instancia de `modal`, incluidas las declaradas dentro de `repeater.props.template`.
- Mantener sin cambios el resto del contrato y comportamiento actual del nodo: overlay, mecanismos de cierre (ESC, click en overlay, `closeModal`), foco atrapado, `aria-label`/`role="dialog"`, `props.size`, `props.defaultOpen`, `props.label`.

## Fuera de alcance

- Definir regiones nombradas de header/footer con comportamiento de scroll diferenciado (p. ej. cabecera o pie fijos mientras el cuerpo hace scroll). El panel completo es un único bloque scrollable, igual que hoy es un único bloque de contenido.
- Cambiar el ancho del panel (`max-w-*` por tamaño) o cualquier otro aspecto visual no relacionado con el alto.
- Scroll de página a nivel de overlay (el overlay se mantiene `fixed inset-0` sin scroll propio).
- Comportamiento de scroll horizontal.
- Cambios en el catálogo de tamaños (`sm | md | lg`) o en sus valores por defecto.

## Requisitos funcionales

- El panel del `modal` no debe superar el 90% de la altura del viewport (`max-h-[90vh]` o equivalente), independientemente de `props.size`.
- Cuando el contenido de `children` cabe dentro de ese alto máximo, el panel se comporta como hoy: sin scrollbar visible, alto ajustado al contenido.
- Cuando el contenido de `children` supera ese alto máximo, aparece scroll vertical dentro del panel; el usuario puede desplazarse por todo el contenido sin que el panel crezca más allá del límite.
- El overlay sigue cubriendo todo el viewport y el panel permanece centrado dentro de él, igual que hoy.
- El comportamiento aplica igual dentro de `repeater.props.template`: cada instancia de modal limita su propio panel de forma independiente.

## Requisitos no funcionales

- El cambio se implementa únicamente con utilidades de `Tailwind CSS`, sin estilos inline ni lógica JS adicional de medición de altura.
- No debe introducir regresión de accesibilidad: el foco atrapado, `role="dialog"`, `aria-modal` y `aria-label` se mantienen exactamente igual que hoy.
- No debe alterar el comportamiento de cierre (ESC, click en overlay, `closeModal`) ni el ciclo de vida de un `form` interno.

## Criterios de aceptación

- Un `modal` cuyo contenido cabe en el viewport no muestra scrollbar y su alto sigue ajustándose al contenido, igual que antes del cambio.
- Un `modal` cuyo contenido es más alto que el 90% del viewport limita su alto y permite hacer scroll vertical dentro del panel para ver todo el contenido.
- El límite de alto y el scroll se comportan igual en los tres tamaños (`sm`, `md`, `lg`).
- Un `modal` declarado dentro de `repeater.props.template` con contenido alto también limita su alto y permite scroll, de forma independiente por iteración.
- ESC, click en overlay y `closeModal` siguen cerrando el modal con contenido largo igual que con contenido corto.
- El foco sigue atrapado dentro del panel y se restaura al cerrar, también cuando el panel tiene scroll activo.

## Casos límite

- **Modal sin `children`**: sin cambio de comportamiento; panel vacío, sin scroll.
- **Modal con contenido justo en el límite de `90vh`**: no debe mostrar scrollbar de forma inconsistente por redondeos; basta con que el límite se aplique de forma consistente vía CSS.
- **Viewport muy pequeño (móvil)**: el límite de `90vh` se recalcula sobre el alto real del viewport del dispositivo; el panel nunca debe quedar completamente fuera de pantalla ni impedir alcanzar el contenido mediante scroll.
- **`form` largo dentro de `modal`** (muchos campos): el scroll del panel permite llegar hasta los botones de submit/cierre sin que estos queden inaccesibles.
- **Contenido dinámico que crece tras abrir el modal** (p. ej. tras una query): el límite y el scroll se aplican igual, ya que son puramente CSS y reaccionan al alto real del contenido en cada render.

## Riesgos o preguntas abiertas

Ninguna pendiente. Estrategia de scroll confirmada: limitar el panel a `max-h-[90vh]` con `overflow-y-auto` interno sobre el panel completo (sin regiones de header/footer diferenciadas).
