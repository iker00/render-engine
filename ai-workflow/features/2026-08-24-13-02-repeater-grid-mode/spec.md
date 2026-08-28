# Spec: modo grid en `repeater`

## Objetivo
Permitir que `repeater` renderice sus iteraciones visibles en un layout de grid CSS, con la misma superficie de configuración de grid que ya ofrece `container` (`columns`, `gap`, `align`, `justify`), en lugar de expandir siempre el `template` como hermanos sin wrapper propio.

## Alcance
- Nuevo prop `repeater.props.columns`, con el mismo shape que `container.props.columns`: entero fijo entre `1` y `12`, o mapa responsive cerrado por breakpoint `base | sm | md | lg | xl | 2xl` con valores enteros entre `1` y `12`.
- La presencia de `repeater.props.columns` activa el modo grid del repeater, igual que hoy activa el modo grid de `container`. Su ausencia conserva el comportamiento actual: el `repeater` expande su `template` como hermanos por iteración, sin wrapper propio.
- Nuevo prop `repeater.props.gap`, con la misma escala estable que `container.props.gap` (`sm | md | lg | xl | 2xl`, con compatibilidad heredada para valor CSS string arbitrario). Solo tiene efecto cuando el modo grid está activo. Sin declarar y con grid activo, usa `md` por defecto, igual que `container`.
- Nuevo prop `repeater.props.align`, con el mismo catálogo cerrado que `container.props.align` (`start | center | end | stretch`). Solo tiene efecto en modo grid.
- Nuevo prop `repeater.props.justify`, con el mismo catálogo cerrado que `container.props.justify` (`start | center | end | between | around | evenly`). Solo tiene efecto en modo grid.
- El grid envuelve únicamente las iteraciones renderizables actualmente visibles: después de excluir items con key ausente, no escalar o duplicada, y después de aplicar la ventana de paginación local vigente (`previousNext`, `numbered` o `scroll`) cuando `props.pagination` existe. Cada iteración visible ocupa una celda del grid.
- El nodo raíz visible de `props.template` puede declarar su propio `layout.span` para ocupar más de una columna dentro del grid del repeater, reutilizando exactamente el mismo mecanismo ya documentado para `container` (clamp contra columnas disponibles, cascada de breakpoints, `base` como fallback móvil).
- Los controles de paginación (`previousNext`, `numbered`, `scroll`) se siguen renderizando fuera del área de celdas del grid, sin ocupar una celda.
- Validación: `columns`, `gap`, `align` y `justify` de `repeater` se validan contra los mismos catálogos y shapes cerrados que `container`, con ruta diagnóstica explícita ante valores fuera de contrato.

## Fuera de alcance
- `props.direction` o `props.wrap` en `repeater` (no se añade un modo lineal alternativo; solo el modo grid pedido).
- `props.variant: card` en `repeater`.
- Cualquier animación o transición al cambiar de página o al crecer la ventana de `scroll` dentro del grid.
- Un "empty state" propio del repeater cuando la colección resuelta no produce iteraciones; el grid simplemente se renderiza sin celdas, como ya ocurre hoy sin grid.
- Cambiar el comportamiento de `repeater` fuera del modo grid: sin `props.columns`, el nodo sigue sin introducir markup propio.

## Requisitos funcionales
1. `repeater.props.columns` ausente preserva el comportamiento actual (expansión como hermanos, sin wrapper).
2. `repeater.props.columns` presente activa el modo grid y envuelve las iteraciones visibles en un contenedor con las clases de grid correspondientes (`grid-cols-{n}` fijo o por breakpoint responsive, igual que `container`).
3. `repeater.props.gap`, `repeater.props.align` y `repeater.props.justify` se traducen a las mismas clases estables que sus equivalentes en `container`, y solo tienen efecto cuando el modo grid está activo.
4. En un `repeater` paginado con `columns` activo, el grid contiene exactamente las iteraciones visibles según la variante de paginación activa (página activa en `previousNext`/`numbered`, ventana acumulada en `scroll`).
5. El nodo raíz de `props.template` puede declarar `layout.span` para ocupar columnas dentro del grid del repeater, con el mismo comportamiento de clamp y cascada de breakpoints que en `container`.
6. Los items excluidos por key inválida, no escalar o duplicada siguen sin ocupar celda en el grid, igual que hoy quedan excluidos de la expansión como hermanos.

## Requisitos no funcionales
- Mantener el umbral mínimo de cobertura del proyecto (80% sobre `src/`) en el código nuevo o modificado.
- No introducir estilos inline; el modo grid se resuelve con las mismas utilidades y convenciones de `Tailwind CSS` que usa `container`.
- No degradar el patrón de render de listas grandes: el wrapper de grid no debe introducir trabajo adicional por iteración más allá del propio wrapper.

## Criterios de aceptación
1. Un `repeater` sin `props.columns` sigue expandiendo su `template` como hermanos, sin wrapper, sin regresión sobre el comportamiento hoy documentado.
2. Un `repeater` con `props.columns: 3` renderiza sus iteraciones visibles dentro de un wrapper con `grid-cols-3`.
3. Un `repeater` con `props.columns` como mapa responsive aplica las clases de grid por breakpoint igual que `container`, con `base` como fallback cuando falta.
4. Un `repeater` con `props.gap` declarado usa la escala estable `sm | md | lg | xl | 2xl`; sin `gap` declarado y con grid activo, usa `md` por defecto.
5. Un `repeater` con `props.align`/`props.justify` declarados traduce a las mismas clases que `container` en modo grid.
6. Un `repeater` paginado (`previousNext` o `numbered`) con `columns` declarado solo incluye en el grid los items de la página activa; cambiar de página recalcula el conjunto de celdas.
7. Un `repeater` paginado (`scroll`) con `columns` declarado incluye en el grid el conjunto acumulado de items visibles tras cada expansión de la ventana.
8. Un nodo raíz de `props.template` con `layout.span` ocupa el número de columnas declarado dentro del grid del repeater, clampado contra las columnas disponibles.
9. Valores de `columns`, `gap`, `align` o `justify` fuera de catálogo o shape se rechazan antes del render con ruta diagnóstica explícita, igual que en `container`.

## Casos límite
- `repeater.props.columns` ausente → comportamiento actual sin cambios.
- Colección resuelta sin iteraciones renderizables (`0` items) con `columns` declarado → el wrapper de grid se renderiza sin celdas.
- Cambio de shape de la fuente (array ↔ objeto plano) o de tamaño de la colección con grid activo → el grid se recalcula sobre las iteraciones vigentes; la paginación local vuelve a su posición inicial, igual que hoy.
- `layout.span` en el nodo raíz de `props.template` mayor que las columnas declaradas del repeater → se clampa igual que en `container`.
- `repeater` con `columns` activo anidado dentro de un `container` con su propio grid externo → el wrapper de grid del repeater ocupa una celda del grid padre como cualquier nodo visible; ver pregunta abierta sobre `layout.span` declarado directamente sobre el propio nodo `repeater` en este escenario.

## Riesgos o preguntas abiertas
- Resuelto en `design.md` (Decisión D3): `layout.span` declarado directamente sobre el propio nodo `repeater` pasa a tener efecto sobre el wrapper de grid del repeater solo cuando ese repeater está en modo grid (`props.columns` presente); sin `columns`, se mantiene la exclusión actual sin cambios.
- Resuelto en `design.md` (Decisión D4): el wrapper de grid del repeater convive con el borde de render actual mediante una bifurcación exclusiva por `props.columns`; sin `columns`, el código y el invariante "sin markup propio" quedan byte-idénticos a hoy.

## Áreas de producto afectadas
- Catálogo de nodos: `repeater` ([`nodes/repeater.md`](../../docs/app-features/nodes/repeater.md)).
- Sistema de grid transversal ya definido por `container` y `layout.span` ([`nodes/container.md`](../../docs/app-features/nodes/container.md)).

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/repeater.md`: nuevo contrato de `columns`/`gap`/`align`/`justify`, activación del modo grid, interacción con paginación.
- `ai-workflow/docs/app-features/nodes/container.md`: posible nota cruzada sobre `layout.span` cuando `repeater` tiene su propio grid activo, según lo que resuelva `generate-feature-design`.
