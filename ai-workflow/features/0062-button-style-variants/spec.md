> Feature: `0062-button-style-variants`
> Fase: spec
> Fecha: 2026-06-05

# Spec: variantes de estilo para el nodo `button`

## Objetivo

Ampliar el nodo `button` con dos nuevas props declarativas — `color` y `variant` — que permitan al backend controlar el aspecto visual de un botón sin tocar su semántica de acción. El sistema de colores reutiliza la paleta semántica cerrada ya establecida en `badge`, `alert` y `stat`. Las variantes propuestas cubren los casos de uso más habituales en formularios e interfaces de gestión institucional.

## Alcance

- Nueva prop `props.color`: paleta semántica cerrada de seis valores (`neutral`, `primary`, `success`, `warning`, `danger`, `info`), con default `primary`.
- Nueva prop `props.variant`: catálogo cerrado de cuatro variantes visuales (`solid`, `outline`, `ghost`, `link`), con default `solid`.
- Ambas props son opcionales. Un botón sin `color` ni `variant` explícitos mantiene el comportamiento visual actual como `solid` + `primary`.
- Los botones `submit` implícito dentro de `form` también aceptan `color` y `variant`.
- Nueva prop `props.fullWidth: boolean` (default `false`): cuando es `true`, el botón ocupa el ancho completo de su contenedor padre.
- Integración con el estado de carga y deshabilitado ya existentes en el runtime (si el botón está deshabilitado o ejecutando una operación, el estilo visual refleja ese estado independientemente del color/variante).

## Fuera de alcance

- Tamañoss configurables del botón (`sm`, `lg`, etc.): queda fuera de esta feature.
- Colores libres fuera de la paleta semántica definida (sin valores CSS arbitrarios ni hex).
- Theming o tokens visuales configurables por JSON.
- Iconos dentro del botón.
- Variantes de estilo para otros nodos interactivos (`link`, `input`, etc.).
- Animaciones o transiciones personalizadas más allá de las ya cubiertas por Tailwind.
- Tamaños configurables del botón distintos al ancho completo.
- Estados visuale de deshabilitado y carga del botón: el nodo `button` no tiene actualmente implementación de estado `disabled` ni `loading`; esa capa visual queda fuera del alcance de esta feature y se planificará por separado.

## Definición de variantes

### `solid` (default)

Botón con fondo sólido de color semántico y texto en color contrastante (blanco o muy oscuro). Es la variante más prominente y la que sustituye visualmente al botón actual sin declaración explícita.

| Color | Fondo | Texto |
|---|---|---|
| `neutral` | gris medio sólido | blanco |
| `primary` | azul sólido | blanco |
| `success` | verde sólido | blanco |
| `warning` | amarillo/ámbar sólido | oscuro |
| `danger` | rojo sólido | blanco |
| `info` | cian sólido | oscuro |

### `outline`

Botón con fondo transparente, borde del color semántico y texto del mismo color semántico. Variante secundaria habitual para acciones de menor peso visual.

| Color | Fondo | Borde | Texto |
|---|---|---|---|
| `neutral` | transparente | gris | gris |
| `primary` | transparente | azul | azul |
| `success` | transparente | verde | verde |
| `warning` | transparente | amarillo/ámbar | amarillo/ámbar |
| `danger` | transparente | rojo | rojo |
| `info` | transparente | cian | cian |

### `ghost`

Botón sin fondo ni borde visible en estado normal. Solo el texto lleva el color semántico. Al hacer hover aparece un fondo muy suave del mismo color (similar al fondo de la variante `pill` de `badge`). Se usa para acciones secundarias que no deben competir visualmente con las principales.

### `link`

Botón que se renderiza visualmente como un enlace de texto (sin fondo, sin borde, sin padding visual). El texto lleva el color semántico y muestra subrayado al hacer hover. No usa `<a>` sino `<button>` semántico, por lo que mantiene todas las acciones del runtime sin la semántica de navegación del nodo `link`. Se usa para acciones incrustadas dentro de texto corrido o tablas.

## Paleta de colores semánticos

Idéntica a la ya establecida en `badge`, `alert` y `stat`:

| Valor | Semántica |
|---|---|
| `neutral` | Sin connotación semántica específica |
| `primary` | Acción principal de la pantalla |
| `success` | Confirmación, aprobación o estado positivo |
| `warning` | Advertencia o acción que requiere atención |
| `danger` | Acción destructiva, error o estado crítico |
| `info` | Información adicional o acción informativa |

## Requisitos funcionales

1. El nodo `button` acepta opcionalmente `props.color` con los seis valores semánticos. Si no se declara, el default es `primary`.
2. El nodo `button` acepta opcionalmente `props.variant` con los cuatro valores del catálogo. Si no se declara, el default es `solid`.
3. Cada combinación `color × variant` produce un estilo visual diferenciable y coherente con la paleta semántica del proyecto.
4. La validación previa al render rechaza valores fuera del catálogo con `invalid-layout` y diagnóstico de ruta exacta, igual que en `badge`, `stat` y otros nodos con paleta cerrada.
5. El nodo `button` acepta opcionalmente `props.fullWidth: boolean`. Cuando es `true`, el botón ocupa el ancho completo del contenedor padre. Default `false`.
6. Los botones sin `action` dentro de `form` (submit implícito) también aceptan `color`, `variant` y `fullWidth`.
7. `props.label` sigue siendo obligatorio y su comportamiento no cambia.

## Requisitos no funcionales

- Los estilos se implementan con utilidades de Tailwind CSS. Sin estilos inline, sin capa visual paralela.
- El sistema no abre theming libre ni APIs de color arbitrario.
- La variante default (`solid` + `primary`) debe ser visualmente compatible con el aspecto actual del botón en la baseline institucional, o mejorarla sin regresión visual.
- Las clases de Tailwind usadas deben ser consistentes con las usadas en `badge`, `alert` y `stat` para los mismos colores semánticos.

## Criterios de aceptación

1. Un botón con `props.color: "danger"` y `props.variant: "solid"` se renderiza con fondo rojo y texto blanco.
2. Un botón con `props.color: "primary"` y `props.variant: "outline"` se renderiza con fondo transparente, borde azul y texto azul.
3. Un botón con `props.color: "success"` y `props.variant: "ghost"` se renderiza sin fondo ni borde en estado normal y con un fondo verde muy suave al hacer hover.
4. Un botón con `props.color: "info"` y `props.variant: "link"` se renderiza como texto cian sin borde ni fondo, con subrayado al hacer hover.
5. Un botón sin `props.color` ni `props.variant` se renderiza igual que `solid` + `primary`.
6. La validación previa rechaza un `button` con `props.color: "purple"` con código `invalid-layout` y ruta correcta.
7. La validación previa rechaza un `button` con `props.variant: "flat"` con código `invalid-layout` y ruta correcta.
8. Un botón con `props.fullWidth: true` ocupa el 100 % del ancho del contenedor padre.
9. Un botón con `props.fullWidth: false` (u omitido) mantiene el ancho natural según su contenido.
10. Un botón submit dentro de `form` acepta y aplica `props.color`, `props.variant` y `props.fullWidth` sin afectar la semántica de submit.
11. Todos los tests existentes del nodo `button` siguen en verde sin modificación.

## Casos límite

- **Botón con `props.color` pero sin `props.variant`**: se aplica `variant: solid` como default con el color declarado.
- **Botón con `props.variant` pero sin `props.color`**: se aplica `color: primary` como default con la variante declarada.
- **Botón sin ninguna de las dos props**: se comporta como `solid` + `primary`. Si el aspecto actual del botón en la baseline ya es ese, no hay diferencia visual.
- **Botón con `props.fullWidth: true` dentro de un contenedor de ancho fijo**: el botón ocupa el 100 % del contenedor, no de la pantalla completa.
- **Botón con `variant: ghost` dentro de un `container` con fondo oscuro**: el fondo de hover suave puede no contrastar bien. Se documenta como limitación conocida fuera del scope de esta feature.
- **Botón con `variant: link` como submit de formulario**: válido. El aspecto de enlace no cambia su comportamiento de submit.
- **`props.color` o `props.variant` resueltos como string vacío `""`**: la validación previa lo rechaza igual que un valor fuera del catálogo.

## Variantes propuestas adicionalmente

Además de `outline` (solicitada explícitamente), se proponen:

- **`ghost`**: variante sin borde con hover suave. Muy común para acciones secundarias que no deben interrumpir el flujo visual. Su patrón de hover usa el mismo fondo suave del nivel 100 que usa `badge pill` y `alert`.
- **`link`**: convierte el botón en apariencia de texto-enlace sin cambiar su semántica de acción declarativa. Útil en celdas de tabla, listas de acciones o texto corrido donde un botón visual interrumpiría la lectura.

Estas dos variantes se incluyen en el alcance de esta feature.

## Riesgos y preguntas abiertas

- **Default para botones existentes**: confirmado que el botón actual no tiene el aspecto de `solid + primary`. El default introduce un cambio visual en todos los botones sin `color`/`variant` declarados. Esto es intencional y deseable, no una regresión.
- **`full-width`**: incluida en esta feature como `props.fullWidth: boolean`.
- **Hover y estados activos en la variante `outline`**: en Tailwind v4 hay que confirmar que las clases de borde y texto de hover estén correctamente safelist-adas o se generen con clases estáticas para los seis colores. Se resuelve en implementación.
