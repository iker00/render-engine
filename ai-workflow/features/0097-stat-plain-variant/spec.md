# Spec: variante `plain` para el nodo `stat`

## Objetivo
Permitir mostrar una métrica o KPI (`label` + `value`) de forma sobria, sin ningún elemento de color de fondo ni barra lateral, reutilizando el nodo `stat` existente en vez de introducir un nodo declarativo nuevo.

## Alcance
- Añadir una tercera variante al nodo `stat`, `props.variant: "plain"`, junto a las existentes `accent` y `tinted`.
- La variante `plain` renderiza `label` (cabecera descriptiva) y `value` (valor principal) sin borde lateral de color y sin fondo de color, a diferencia de `accent` (borde lateral) y `tinted` (fondo suave).
- La variante `plain` mantiene la misma agrupación visual que las otras variantes: icono opcional a la izquierda, `label` sobre `value`.
- `props.icon` sigue siendo opcional en `plain`, con el mismo comportamiento que en `accent`/`tinted` (se renderiza a la izquierda si el nombre de icono resuelve; si no resuelve, se ignora silenciosamente).
- `props.color` se sigue aceptando en el config cuando `variant: "plain"`, pero no tiene ningún efecto visual: el texto de `label` y `value` es siempre neutro. Este comportamiento es coherente con el precedente ya existente en `accent`, donde `color` tampoco tiñe el texto (solo el borde).
- El resto del contrato de `stat` se mantiene sin cambios: `label`/`value` obligatorios y resueltos vía `resolveRuntimeTextReference` (literal, referencia dinámica completa o interpolación `{{...}}`), nodo hoja sin `children`, sin estado local ni interactividad, y campos transversales estándar (`visibility`, `queryStateFeedback`, `layout.span`).

## Fuera de alcance
- Un nodo declarativo nuevo independiente de `stat`.
- Indicador de tendencia (trend indicator).
- Tamaños o pesos tipográficos configurables por JSON para `label`/`value`.
- Subtítulo, descripción adicional o cualquier elemento de texto más allá de `label` y `value`.
- Cambios de comportamiento en las variantes `accent` o `tinted` ya existentes.
- Icono con tamaño o color configurable por JSON (sigue heredando el tratamiento visual estándar del nodo).
- Theming o tokens visuales configurables por JSON.

## Requisitos funcionales
1. `props.variant` acepta `"accent" | "tinted" | "plain"`. El default sigue siendo `"accent"` si no se declara.
2. Cuando `variant: "plain"`:
   - No se renderiza borde lateral de color ni fondo de color en el contenedor del nodo.
   - `label` se muestra con un estilo de texto secundario/muted y `value` con un estilo de texto principal, ambos neutros, sin variar según `props.color`.
   - `props.color`, si se declara, se acepta en la validación pero no cambia el render (mismo criterio de tolerancia que ya aplica hoy a `accent` respecto al texto).
   - `props.icon`, si se declara y el nombre resuelve, se renderiza a la izquierda del bloque `label`/`value`, igual que en `accent`/`tinted`.
3. La resolución de `label` y `value` (literal, referencia dinámica completa, interpolación `{{...}}`) es idéntica a la de `accent`/`tinted` y al resto de nodos textuales (`heading`, `paragraph`, `badge`).
4. `plain` es una variante más del mismo nodo `stat`: hereda sin cambios validación de `label`/`value` obligatorios, comportamiento de nodo hoja, y soporte de `visibility`, `queryStateFeedback` y `layout.span`.

## Requisitos no funcionales
- Implementado con utilidades de `Tailwind CSS`, sin estilos inline, siguiendo el mismo patrón que `accent` y `tinted` en `runtime-node-styling`.
- Sin introducir nuevas dependencias ni superficie de estado.
- Cobertura de tests equivalente a la ya existente para `accent`/`tinted` (render de la nueva variante y validación de `props.variant` extendida).

## Criterios de aceptación
- Un `stat` con `variant: "plain"` se renderiza sin `border-l-4` ni fondo de color, mostrando `label` y `value` con estilo neutro.
- Un `stat` con `variant: "plain"` e `icon` válido muestra el icono a la izquierda del bloque `label`/`value`.
- Un `stat` con `variant: "plain"` y `color` declarado (cualquier valor de la paleta semántica) se renderiza igual que sin `color`: el config no se rechaza y el texto sigue siendo neutro.
- Un `stat` con `variant` fuera de `["accent", "tinted", "plain"]` sigue rechazándose con `invalid-layout` y diagnóstico en `{path}.props.variant`.
- Un `stat` sin `variant` declarado sigue usando `accent` por defecto (sin regresión de comportamiento existente).
- Las variantes `accent` y `tinted` no cambian su render actual.

## Casos límite
- `props.label` o `props.value` vacíos en `variant: "plain"`: mismo comportamiento que en `accent`/`tinted` — el stat se renderiza sin el texto correspondiente, no es un error de render.
- `props.icon` con nombre que no resuelve en `variant: "plain"`: se ignora silenciosamente, igual que en las otras variantes.
- `stat` con `variant: "plain"` dentro de `repeater` con `item.*` en `value`: resuelve por iteración, igual que cualquier otro nodo textual.
- `stat` con `variant: "plain"` dentro de `form`: válido, no participa en validación ni submit, igual que hoy.
- `stat` con `variant: "plain"` y `children` declarados: los hijos no se procesan (regla de nodo hoja, sin cambios).

## Áreas de producto afectadas
- Catálogo de nodos (`stat`), documentado en `ai-workflow/docs/app-features/nodes/stat.md` y referenciado desde `ai-workflow/docs/app-features/nodes/index.md`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/stat.md`: añadir la variante `plain` a la tabla de props, sección propia de comportamiento de render y actualizar "Lo que está fuera de alcance" si deja de aplicar algún punto.
- `ai-workflow/docs/app-features/nodes/index.md`: actualizar la descripción breve de `stat` en la tabla de nodos hoja visibles.

## Riesgos o preguntas abiertas
Ninguno bloqueante. Cambio aditivo y acotado sobre un nodo ya cerrado y documentado, sin impacto transversal entre capas del runtime.
