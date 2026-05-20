# Spec: Container variants and grid span

## Objetivo
Ampliar el contrato declarativo de layout del runtime para resolver dos carencias visibles de la v1 sin abrir todavía theming libre desde JSON: permitir presets visuales cerrados para `container` y permitir composición real en layouts con columnas mediante `span` declarativo en cualquier nodo hijo.

La feature debe reforzar la baseline institucional ya fijada por el runtime y mantenerse fiel a la referencia visual de "Solicitud general" aportada por el usuario: tarjetas y bloques con aspecto administrativo sobrio, limpio y consistente, no variantes genéricas desconectadas del lenguaje visual actual.

## Alcance
- Añadir una variante visual declarativa para `container` mediante una prop cerrada `variant`.
- Incorporar un primer preset visual `card` para `container`.
- Mantener la apariencia por defecto actual cuando `container` no declare `variant` o si lo declare y su valor sea `default`.
- Añadir una superficie transversal `layout.span` utilizable por cualquier nodo soportado del árbol `layout`.
- Aplicar `layout.span` solo como semántica de ocupación dentro de un `container` cuyo layout efectivo sea de columnas.
- Mantener una degradación segura cuando `span` aparezca fuera de un contexto donde pueda aplicarse.

## Fuera de alcance
- Abrir una API de estilos arbitrarios, clases libres, tokens visuales por JSON o theming declarativo general.
- Añadir `variant` a nodos distintos de `container` en esta feature, aunque más adelante pueda extenderse a `image` o `button`.
- Introducir una biblioteca grande de variantes visuales; en esta fase solo se exige `card`.
- Convertir `span` en un sistema general de tamaños para layouts `flex`, bases porcentuales, widths libres o reglas de composición arbitrarias.
- Hacer responsive en esta fase ni `container.props.columns` ni `layout.span`.
- Añadir validación contextual estricta en Zod que exija que un nodo con `layout.span` viva necesariamente dentro de un `container` con `columns`.
- Reabrir la baseline institucional del runtime con un rediseño completo de color, tipografía, bordes o tono general.

## Áreas de producto afectadas
- Runtime UI configurable.
- Contrato de configuración.
- Layout declarativo y composición responsive.
- Baseline visual institucional del runtime.

## Requisitos funcionales
- El contrato del nodo `container` debe admitir una prop cerrada `variant`.
- `variant` debe ser opcional y, cuando no exista, el `container` debe conservar su apariencia actual.
- El catálogo inicial de `variant` exigido por esta feature debe incluir `card`.
- `container.variant: card` debe producir una agrupación visual enmarcada y coherente con la referencia institucional ya fijada en el runtime.
- La variante `card` debe sentirse alineada con bloques como tarjetas administrativas, pasos laterales o cajas de ayuda de la referencia aportada, sin convertirse en una tarjeta genérica ajena al sistema visual actual.
- La feature debe dejar abierta la posibilidad de añadir más variantes cerradas en el futuro sin renombrar la superficie del contrato.
- Cualquier nodo soportado del árbol `layout` debe poder declarar `layout.span`.
- `repeater` queda fuera del alcance visible de `layout.span` en esta feature porque no renderiza una raíz visual única; si una repetición necesita ocupar columnas, la raíz del `template` debe ser un nodo visible como `container` y declarar ahí su propio `layout.span`.
- `layout.span` debe representar cuántas columnas ocupa visualmente un nodo dentro del grid efectivo de su padre.
- Cuando un nodo con `layout.span` no viva dentro de un `container` con `columns` efectivas en ese contexto, el runtime no debe romper el render ni invalidar toda la configuración; el valor debe no tener efecto visible.
- La validación estructural previa al render debe validar el shape de `variant` y `layout.span`, pero no debe exigir conocer el contexto completo del padre para aceptar `span`.
- Si un `span` declarado no encaja exactamente con el número de columnas efectivas del contenedor padre, el runtime debe degradar de forma segura sin romper la pantalla.
- La semántica de `span` debe estar pensada para layouts con `columns`; no debe reinterpretarse silenciosamente como width libre o reparto proporcional en layouts `flex`.
- Una configuración existente que no use `variant` ni `layout.span` debe conservar el comportamiento observable actual del runtime.

## Requisitos no funcionales
- La solución debe respetar la restricción global de no abrir todavía theming declarativo desde JSON.
- La terminología del contrato debe mantenerse pequeña, explícita y alineada con el resto del runtime: `variant`, `columns`, `layout`, `span`.
- La capa visual de `card` debe poder resolverse dentro del sistema actual basado en `Tailwind CSS` y tokens globales del runtime.
- La referencia visual de la feature debe seguir siendo la baseline institucional ya vigente y la captura de "Solicitud general", no una estética nueva o neutra.
- La documentación debe dejar claro que esta feature añade presets visuales cerrados y composición acotada sobre el grid ya existente, no una API visual general.

## Criterios de aceptación
- Dado un `container` sin `variant`, el runtime lo renderiza con la misma apariencia base actual.
- Dado un `container` con `variant: card`, el runtime lo renderiza como un bloque visualmente enmarcado y coherente con la referencia institucional del proyecto.
- Dado un `container` con `columns` fijo, el comportamiento observable sigue siendo compatible con el contrato ya existente.
- Dado un nodo cualquiera del layout con `layout.span` dentro de un `container` con `columns`, el nodo ocupa el número de columnas declarado.
- Dado un nodo con `layout.span` fuera de un `container` con `columns`, el runtime no falla y la pantalla sigue renderizando de forma segura.
- Dado un config que usa `span` con shape inválido, la validación previa al render lo rechaza con diagnóstico trazable.
- Dado un config existente que no usa ninguna de las nuevas superficies, el comportamiento visible del runtime no cambia.

## Casos límite
- Un `container` puede declarar `variant: card` y no tener hijos visibles; la variante no debe romper el layout ni inventar contenido.
- Un `container` puede combinar `variant: card` con `columns`; la agrupación visual y la rejilla deben convivir sin perder claridad.
- Un nodo puede declarar `layout.span` dentro de un subárbol donde, por condiciones de layout o visibilidad, en una rama concreta no exista grid efectivo; el runtime debe degradar sin error fatal.
- Un `repeater` dentro de un `container` con `columns` no aplica `layout.span` sobre sí mismo; la ocupación de grid debe declararse en el nodo raíz visible que emite su `template`.
- Un layout puede declarar más nodos con `span` del espacio disponible en una fila; la implementación posterior deberá mantener una degradación visual estable y predecible.
- Un `container` puede seguir usándose en modo lineal (`direction`) sin `columns`; en ese caso `layout.span` de sus hijos no debe reinterpretarse como width libre.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes sobre el alcance principal: la feature añade un preset visual `card` y ocupación declarativa por `span` sobre el grid ya existente de `container`.
- Conviene vigilar que `card` sea suficientemente fiel al lenguaje institucional de la referencia y no derive en una tarjeta genérica demasiado pesada, ornamental o separada del resto del runtime.
- Conviene vigilar que `span` siga siendo semántica de grid y no abra por la puerta de atrás un sistema ambiguo de widths para layouts lineales.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
