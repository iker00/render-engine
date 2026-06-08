# Spec: 0070-tabs-bar-responsive

## Objetivo

Corregir dos problemas visuales del nodo `tabs` relacionados con el tamaño de la barra de tabs:

1. En orientación `vertical`, la barra de botones no tiene restricción de ancho, por lo que etiquetas largas la estiran sin límite.
2. En orientación `horizontal`, cuando hay muchos tabs en pantallas pequeñas, la barra desborda el ancho del container en lugar de hacerse scrollable.

## Alcance

- En orientación `vertical`: aplicar un ancho máximo fijo a la barra de botones (columna izquierda). Las etiquetas que superen ese ancho rompen en múltiples líneas dentro del botón.
- En orientación `horizontal`: aplicar `overflow-x-auto` a la barra de tabs para que, cuando los botones no quepan en el ancho disponible, el usuario pueda scrollear horizontalmente dentro de la barra sin romper el layout de la página.

## Fuera de alcance

- Configuración del ancho máximo de la barra vertical mediante props en el JSON.
- Cambio automático de orientación entre `horizontal` y `vertical` según el breakpoint.
- Truncado de etiquetas largas (el comportamiento elegido es wrapping en múltiples líneas).
- Cambios en el contrato JSON del nodo `tabs` (ni nuevas props ni modificación de las existentes).
- Cambios en la validación previa al render.
- Scroll vertical en la barra de orientación `vertical`.

## Requisitos funcionales

1. En orientación `vertical`, la barra de tabs tiene un ancho máximo fijo determinado en implementación mediante utilidades de Tailwind CSS. Las etiquetas que superen ese ancho se muestran en múltiples líneas dentro del botón correspondiente; no se truncan.
2. En orientación `horizontal`, la barra de tabs permite scroll horizontal cuando el conjunto de botones supera el ancho del container padre. El scroll es interno a la barra; no afecta al scroll vertical de la página ni a su layout.
3. El comportamiento funcional del nodo no cambia: selección de tab activo, visibilidad por item, `defaultTab`, cambio de panel activo y degradación silenciosa ante tabs ocultos funcionan exactamente igual que antes.

## Requisitos no funcionales

1. Los cambios son exclusivamente visuales/CSS; no se introduce lógica nueva en el runtime ni en la validación.
2. Los estilos se implementan con utilidades de Tailwind CSS. No se usan estilos inline.
3. En orientación `horizontal` en pantallas anchas con pocos tabs (caso habitual en desktop), el comportamiento visual debe ser idéntico al estado anterior: sin scroll visible ni cambio perceptible.

## Criterios de aceptación

1. En orientación `vertical`, un tab con una etiqueta muy larga no desborda el ancho de la barra; la etiqueta ocupa varias líneas dentro del botón y la barra mantiene su ancho máximo.
2. En orientación `vertical`, la barra tiene un ancho máximo consistente independientemente de las longitudes de las etiquetas de los distintos tabs.
3. En orientación `horizontal` con muchos tabs en pantalla estrecha (móvil), la barra de tabs scrollea horizontalmente y el resto del layout de la página no se rompe.
4. En orientación `horizontal` en pantalla ancha con pocos tabs, no hay scroll visible y el aspecto es idéntico al estado anterior.
5. El panel activo y la funcionalidad de navegación entre tabs (selección, visibilidad por item, `defaultTab`) funcionan correctamente tras el cambio.
6. Los tests existentes del nodo `tabs` siguen en verde sin modificación.

## Casos límite

- Etiqueta muy larga sin espacios en orientación `vertical`: el texto rompe visualmente dentro del botón (comportamiento de `overflow-wrap: break-word` o equivalente Tailwind) sin desbordarse.
- Muchos tabs con etiquetas largas en orientación `horizontal` en móvil: todos los tabs son accesibles vía scroll horizontal de la barra.
- Un solo tab en orientación `horizontal`: sin scroll, comportamiento idéntico al anterior.
- Tab con visibilidad oculta en orientación `horizontal`: los tabs ocultos no participan en el scroll ni en el layout de la barra; el comportamiento de visibilidad por item no se altera.
- Orientación `vertical` con un solo tab: el ancho máximo se aplica igualmente; el comportamiento no varía respecto al caso de varios tabs.

## Áreas de producto afectadas

- Catálogo de nodos → `tabs` (solo presentación de la barra de botones).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/tabs.md`: actualizar la descripción del comportamiento visual de la barra en ambas orientaciones para reflejar el ancho máximo en vertical y el scroll horizontal en horizontal.

## Riesgos o preguntas abiertas

Ninguno.
