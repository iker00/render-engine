> Cuándo leer: estructura de `container`, `gap`, `columns` fijo o responsive, `variant: card`, `align`, `justify`, `wrap`, comportamiento dentro de `form`, `layout.span`.
> Tamaño: medio.
> Relacionados: [[../forms/lifecycle.md]], [[../references/visibility.md]].

# `container`

## Contrato (`props`)
- `props.direction`: string opcional, con soporte visual actual para `row` y fallback a columna cuando `columns` no está presente.
- `props.gap`: string opcional; la escala recomendada y estable hoy es `sm | md | lg | xl | 2xl`, pero cualquier valor CSS string sigue admitiéndose como compatibilidad heredada.
- `props.columns`: entero opcional entre `1` y `12`, o mapa responsive opcional con claves `base | sm | md | lg | xl | 2xl` y valores enteros entre `1` y `12`.
- `props.variant`: opcional, con catálogo cerrado `default | card`.
- `props.align`: opcional, con catálogo cerrado `start | center | end | stretch`.
- `props.justify`: opcional, con catálogo cerrado `start | center | end | between | around | evenly`.
- `props.wrap`: opcional, con catálogo cerrado `nowrap | wrap | wrap-reverse`.

## Reglas de render
- Solo `container` admite `children`.
- Un `container` sin `gap` declarado usa `md` como separación visible por defecto.
- Los alias estables de `container.props.gap` soportados hoy (`sm`, `md`, `lg`, `xl`, `2xl`) se resuelven a clases estables de `Tailwind`.
- Un valor arbitrario de `container.props.gap` sigue siendo válido mediante una excepción acotada: clase `Tailwind` con variable CSS local, sin volver a estilos inline completos.
- Si `container.props.columns` existe, el runtime cambia a modo `grid` y hace que `columns` prevalezca visualmente sobre `direction`.
- `container.props.columns` puede declararse como entero fijo entre `1` y `12`, conservando la salida histórica `grid-cols-{n}`, o como mapa responsive cerrado por breakpoint `base | sm | md | lg | xl | 2xl`.
- En mapas responsive de `columns`, `base` genera la clase sin prefijo y es el fallback móvil recomendado; si falta, el runtime usa una columna hasta que aplique el primer breakpoint declarado.
- `container.props.variant` mantiene una superficie cerrada: ausencia de `variant` y `variant: default` conservan la apariencia histórica, y `variant: card` añade una tarjeta institucional con borde, fondo, sombra y padding propios sin abrir theming libre.
- `container.props.align` y `container.props.justify` se traducen a clases estables según el modo activo del contenedor.
- `container.props.wrap` solo aplica en modo lineal (`flex`); su default efectivo es `nowrap` y no se admite junto con `columns`.

## Dentro de `form`
- Dentro de `form`, un `container` conserva la superficie visual de sección solo cuando actúa como bloque vertical por defecto o cuando declara `columns`; si declara `direction: row` sin `columns`, se mantiene como layout lineal `plain` sin sangrado lateral ni márgenes negativos implícitos, y si además declara `variant: card`, la tarjeta sustituye visualmente a esa superficie implícita para evitar doble marco.
- Los `container` dentro de un `form` se renderizan como `section` semánticas cuando actúan como bloques verticales por defecto o cuando usan `columns`; resuelven la separación visual entre bloques con una única línea superior de sección y padding vertical útil algo más contenido, sin introducir padding horizontal implícito, sangrado lateral ni un nodo nuevo.
- Dentro de `form`, un `container` con `direction: row` y sin `columns` mantiene un layout lineal `plain`, mientras que `columns` conserva la semántica de sección aunque también exista `direction: row`; en ambos casos siguen disponibles `align`, `justify` y la escala ampliada de `gap`.

## `layout.span` (transversal)
- cualquier nodo soportado del árbol `layout` puede declarar `layout.span` como ocupación de grid transversal, pero solo tiene efecto visible dentro de un `container` cuyo layout efectivo use `columns`.
- `node.layout.span` admite enteros entre `1` y `12` o el mismo shape de mapa responsive cerrado.
- En mapas responsive, `base` representa la clase sin prefijo y actúa como fallback móvil recomendado; si se omite, el runtime degrada a una columna hasta que aplique el primer breakpoint declarado.
- Los breakpoints omitidos heredan el valor efectivo anterior siguiendo la cascada de Tailwind.
- Las claves de breakpoint desconocidas y los valores fuera de `1..12`, no enteros o no numéricos se rechazan antes del render con ruta diagnóstica explícita.
- `layout.span` se aplica desde el borde central del renderer con un wrapper ligero solo para nodos visibles distintos de `repeater`; fuera de un grid efectivo no produce efecto.
- Dentro de un grid efectivo, el runtime resuelve las columnas del padre y el `span` del hijo por breakpoint, hereda valores omitidos según la cascada de Tailwind y clampa cada tramo contra las columnas disponibles antes de emitir clases `col-span-*` enumeradas.
- `repeater` puede declarar `layout.span` porque la superficie es transversal, pero esa prop no genera wrapper propio ni ocupación visible sobre el `repeater`; si una repetición necesita ocupar columnas, el nodo raíz visible de `props.template` debe declarar su propio `layout.span`.
- `node.layout.span` se valida solo por shape; el contrato no exige conocer el padre para aceptarlo y el runtime lo degrada sin efecto cuando no existe un grid efectivo donde aplicarlo.

## Validación específica
- `container.props.align`, `container.props.justify` y `container.props.wrap` se validan contra catálogos cerrados y se rechazan con ruta diagnóstica explícita cuando reciben valores fuera de contrato.
- `container.props.variant` se valida contra el catálogo cerrado `default | card` y se rechaza con ruta diagnóstica explícita cuando recibe otro valor.
- `container.props.wrap` no puede coexistir con `container.props.columns`, tanto si `columns` es fijo como responsive; esa combinación se rechaza antes del render.
- Si `container` declara `direction` y `columns` a la vez, ambas props siguen siendo válidas en el contrato, pero `columns` pasa a ser el modo de layout efectivo.
- `container.props.columns` admite enteros entre `1` y `12` o mapas responsive cerrados con claves `base | sm | md | lg | xl | 2xl` y valores enteros entre `1` y `12`.
