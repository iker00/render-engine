# Spec: `divider` node (0057)

## Objetivo

Añadir un nuevo nodo hoja declarativo `divider` al catálogo del runtime que renderiza un separador visual horizontal, con soporte de cuatro variantes de estilo, y eliminar el separador automático que hoy aplican los `container` con `surface: form-section` dentro de formularios.

## Alcance

- Nuevo nodo `divider` en el catálogo del runtime y en la validación previa al render.
- Props:
  - `props.variant: "solid" | "dashed" | "dotted" | "invisible"` — variante visual del separador; por defecto `"solid"`.
- Integración transversal estándar: `visibility`, `queryStateFeedback` y `layout.span` aplicados al nodo completo.
- El nodo `divider` puede aparecer en cualquier posición del árbol de layout donde actualmente se permiten nodos hoja.
- Eliminación del separador automático `border-t` que hoy aplica `surface === 'form-section'` en `runtime-node-styling` a los contenedores directos de formularios. A partir de esta feature, esa separación se declara explícitamente con un nodo `divider` en el JSON de configuración.
- Actualización de la configuración de desarrollo (`src/dev/config.json`) para reemplazar los separadores implícitos de secciones por nodos `divider` explícitos donde sea necesario.

## Fuera de alcance

- Orientación vertical del separador.
- Texto o etiqueta en el interior del separador (p. ej. divisores "OR").
- Grosor o color configurables desde JSON.
- Margen o padding configurables desde JSON; los estilos de espaciado se resuelven con las utilidades de `Tailwind` del nodo o del contenedor padre.
- Configuración de theming visual declarativo.

## Requisitos funcionales

1. El nodo `divider` renderiza un elemento de separación horizontal. El resultado visual depende de `props.variant`:
   - `solid`: línea continua visible (default).
   - `dashed`: línea discontinua visible.
   - `dotted`: línea punteada visible.
   - `invisible`: separador sin línea visual, actúa como espaciador puro.
2. Cuando `props.variant` está ausente, el runtime usa `"solid"` como valor por defecto.
3. El nodo `divider` no acepta `children`; si el JSON los incluye, no se renderizan (datos ignorados por el normalizador, sin error de runtime).
4. Los contenedores dentro de `form` dejan de recibir automáticamente el separador superior `border-t`. La separación visual entre secciones de formulario se consigue declarando un nodo `divider` explícito en el JSON.
5. El nodo `divider` recibe y aplica `visibility`, `queryStateFeedback` y `layout.span` con la semántica transversal estándar del catálogo.

## Requisitos no funcionales

- Estilos implementados con utilidades de Tailwind CSS, sin estilos inline ni API visual configurable.
- Validación previa al render en `src/config/` rechaza valores de `variant` fuera del catálogo cerrado con diagnóstico de ruta explícita.
- La cobertura de tests no debe bajar del umbral global del 80% sobre `src/`.

## Criterios de aceptación

1. Un nodo `divider` sin `props.variant` renderiza una línea horizontal continua (equivalente a `solid`).
2. `props.variant: "dashed"` renderiza una línea horizontal discontinua visible.
3. `props.variant: "dotted"` renderiza una línea horizontal punteada visible.
4. `props.variant: "invisible"` no renderiza ninguna línea visible pero ocupa espacio vertical.
5. Un `container` directamente dentro de un `form` ya no muestra el borde superior automático que tenía antes de esta feature.
6. Colocar un nodo `divider` antes de un `container` dentro de `form` produce el mismo efecto visual separador que tenía antes el borde automático.
7. La validación previa rechaza `props.variant` con un valor fuera del catálogo (`"solid" | "dashed" | "dotted" | "invisible"`).
8. `visibility` aplicado al nodo `divider` oculta o muestra el separador completo.
9. `queryStateFeedback` y `layout.span` aplicados al nodo `divider` funcionan con la semántica estándar del runtime.
10. La configuración de desarrollo local sigue renderizando formularios con la separación visual esperada usando nodos `divider` explícitos.

## Casos límite

- Si `props.variant` está ausente, el runtime usa `"solid"` sin error.
- Si el nodo `divider` declara `children`, esos datos se ignoran sin error de runtime.
- Si `visibility` evalúa como oculto, el separador no ocupa espacio.
- Si `queryStateFeedback` está activo en un estado distinto de la rama principal, el nodo entero se sustituye por el feedback correspondiente.
- Un `divider` dentro de `repeater.props.template` se repite una vez por item, con el mismo comportamiento que cualquier otro nodo hoja.

## Áreas de producto afectadas

- Catálogo de nodos del runtime: nuevo nodo hoja `divider`.
- Validación previa al render (`src/config/`): nuevo esquema para el nodo `divider`.
- Dispatcher central de nodos (`src/runtime/`): registro del nuevo tipo.
- `runtime-node-styling`: eliminación de la lógica `surface === 'form-section'` que aplicaba `border-t` automático.
- Configuración de desarrollo local: reemplazar separadores implícitos por nodos `divider` explícitos en `src/dev/config.json`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md`: añadir entrada `divider.md` al catálogo.
- Nueva ficha `ai-workflow/docs/app-features/nodes/divider.md`.
- `ai-workflow/docs/app-features/nodes/form.md`: actualizar la gramática visual para reflejar que el separador de secciones ya no es automático.

## Riesgos o preguntas abiertas

- **Migración de configuraciones existentes**: los JSON de producción que dependan del separador automático de secciones de formulario perderán el borde superior visual. Al ser un cambio de presentación deliberado, este efecto es esperado y aceptado, pero conviene documentarlo claramente en el commit y en la ficha de `form.md`.
