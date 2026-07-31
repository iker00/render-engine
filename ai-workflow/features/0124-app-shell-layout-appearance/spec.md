# Spec: shell de ancho completo, alto adaptable, scroll configurable y espaciado propio

## Objetivo

Eliminar el contenedor tipo "card" que hoy envuelve todo el runtime (`rounded-shell`, borde, sombra, fondo blanco y
padding) y el límite de ancho centrado que lo acompaña, para que la aplicación pueda ocupar el 100% del ancho y
alto disponibles tanto si se monta en un HTML vacío (standalone) como si se embebe dentro del contenedor de otra
página. Junto a esto, se retira el fondo general decorativo de la aplicación (gradiente y color de fondo aplicados
hoy a nivel raíz), se introduce un modo de scroll configurable por aplicación (`shell.scrollBehavior`) para que el
chrome (`shell.header`/`shell.sidebar`) pueda quedar fijo mientras solo el contenido hace scroll, y se añade el
espaciado propio entre chrome y contenido que antes aportaba la card, ahora aplicado solo al área de contenido.

Esta spec construye sobre `shell` tal como quedó cerrado en `0122` (`shell.header`) y `0123` (`shell.sidebar`), sin
reabrir su contrato salvo por el nuevo campo `scrollBehavior` descrito aquí.

## Alcance

- Se elimina el contenedor "card" que envuelve hoy todo el runtime: borde, sombra, fondo de superficie y padding
  perimetral. El runtime deja de tener un límite visual propio de "tarjeta"; su chrome y contenido ocupan
  directamente el espacio de su elemento de montaje.
- Se elimina el límite de ancho centrado (`max-w-shell`) que hoy envuelve todo el runtime, incluida la fila interna
  de `shell.header` (logo, título, menú, acciones). El header pasa a ocupar el ancho completo de forma consistente
  con el resto del chrome y el contenido, en vez de quedar centrado en una banda más estrecha mientras el resto de
  la app ya ocupa el ancho completo.
- Se elimina el alto mínimo forzado de viewport (`min-h-screen`/`100vh`) aplicado hoy al elemento raíz del runtime.
  El runtime pasa a ocupar el 100% del alto de su propio contenedor de montaje. Si ese contenedor no declara una
  altura explícita — caso por defecto del `index.html` standalone de este proyecto — el runtime crece de forma
  natural con su contenido y es la página quien hace scroll, sin ningún alto forzado ni recorte de contenido.
  Quien integra la app decide si darle una altura acotada al contenedor de montaje; esto solo hace falta cuando se
  declara `shell.scrollBehavior: "fixed"`, para que el chrome pueda anclarse y el área de contenido pueda hacer
  scroll interno (ver "Casos límite"). Forzar una altura fija (`height`, no `min-height`) al contenedor de montaje
  por defecto es un error: recorta cualquier contenido más alto que esa altura en modo `"page"`.
- Cualquier regla de alto, ancho o fondo que hoy se aplique a selectores globales (`:root`, `body`, `#root`) se
  retira o se reduce al elemento raíz propio del runtime. El runtime no debe imponer estilos que se filtren fuera
  de su propio árbol cuando se embebe dentro de una página anfitriona con su propio `body`/`#root`.
- Se elimina el fondo general decorativo de la aplicación (gradiente de `body` y color de fondo aplicado al
  elemento raíz del runtime). El runtime pasa a no declarar fondo propio a ese nivel; el color de fondo visible lo
  aporta quien integra la app. Esto no afecta al token `--color-app-background` en sí mismo, que sigue existiendo
  en la paleta y sigue siendo usado por otros nodos del catálogo (por ejemplo, el estado activo de `tabs`) — solo
  deja de aplicarse como fondo general del runtime.
- Nuevo campo opcional `shell.scrollBehavior`, hermano de `header` y `sidebar` dentro del bloque raíz `shell`:
  - `"page"` (comportamiento por defecto si el campo no se declara): comportamiento actual — la página completa
    hace scroll; `shell.header` permanece fijado arriba mediante scroll pegajoso ("sticky"), como ya ocurre hoy.
  - `"fixed"`: el chrome (`shell.header` y, si existe, `shell.sidebar`) permanece fijo y visible en todo momento
    ocupando el alto disponible del contenedor de montaje; únicamente el área de contenido de la página activa
    hace scroll internamente cuando su contenido excede el alto disponible.
  - Ausencia de `shell.scrollBehavior`, o de `shell` por completo, equivale a `"page"`: ninguna configuración
    existente cambia su comportamiento de scroll.
- `shell.sidebar`, cuando existe, permanece siempre visible durante el scroll mediante posicionamiento pegajoso
  propio ("sticky"), con scroll interno independiente cuando su lista de elementos visibles excede el alto
  disponible bajo la cabecera; ese scroll interno se detiene de forma natural al llegar al último elemento, y no
  aparece ningún scroll si todos los elementos ya son visibles. Este comportamiento es independiente de
  `shell.scrollBehavior` y aplica igual en `"page"` (donde el resto de la página sigue haciendo scroll normal) que
  en `"fixed"` (donde ya se anclaba por el propio mecanismo de esa modalidad).
- Espaciado propio del área de contenido: se introduce un padding uniforme alrededor del contenido de página (con o
  sin `shell.sidebar` presente), equivalente al que hoy aporta la card que se elimina. `shell.header` y
  `shell.sidebar` no llevan ese padding — permanecen anclados a los bordes del contenedor de montaje ("edge to
  edge"), separados del contenido únicamente por ese padding del área de contenido y por el borde/superficie que ya
  usan hoy.
- La separación visual entre chrome y contenido, más allá del nuevo espaciado, se resuelve sin cambios en los tokens
  de color ya usados por `shell.header`/`shell.sidebar`: al desaparecer el fondo blanco compartido que antes
  igualaba visualmente card y contenido, la superficie ya existente del header/sidebar (con su borde ya existente)
  queda naturalmente diferenciada del contenido, que pasa a no tener fondo propio. No se requiere introducir un
  nuevo tono de superficie para este objetivo.

## Fuera de alcance

- Cambios al contrato funcional o de navegación de `shell.header` (`0122`) o `shell.sidebar` (`0123`) más allá de:
  (a) la eliminación del límite de ancho en la fila interna del header, (b) el nuevo campo `scrollBehavior`, y
  (c) el nuevo comportamiento pegajoso con scroll interno propio de `shell.sidebar`.
- Theming declarativo desde JSON (colores, radios, sombras configurables) — sigue fuera de v1, sin cambios respecto
  a las limitaciones ya documentadas.
- Comportamiento responsive/mobile del shell más allá del ya excluido en `0122`/`0123`.
- Empaquetado de la aplicación como librería embebible con una API de montaje dedicada. El mecanismo de embebido ya
  existe hoy (un elemento contenedor donde se monta el runtime vía `ReactDOM.createRoot`); esta spec solo ajusta el
  CSS/layout para que ese mecanismo ya existente se comporte correctamente a cualquier ancho/alto de contenedor.
- Cualquier UI o configuración para que quien integra la app elija `scrollBehavior` dinámicamente en caliente; es un
  valor estático de la configuración JSON, igual que el resto de campos de `shell`.
- Degradación activa o aviso en tiempo de ejecución cuando `scrollBehavior: "fixed"` se declara sin que el
  contenedor de montaje tenga una altura acotada real. Ver Riesgos.

## Requisitos funcionales

1. El elemento raíz del runtime deja de aplicar borde, sombra, fondo de superficie y padding tipo "card"; su
   contenido ocupa directamente el ancho y alto disponibles de su contenedor de montaje.
2. El elemento raíz del runtime deja de aplicar un límite de ancho centrado; el chrome y el contenido ocupan el
   100% del ancho disponible.
3. La fila interna de `shell.header` (logo, título, menú, acciones) deja de aplicar su propio límite de ancho
   centrado, quedando consistente con el resto del chrome a ancho completo.
4. El elemento raíz del runtime deja de forzar un alto mínimo de viewport; ocupa el 100% del alto de su contenedor
   de montaje.
5. Ninguna regla de alto, ancho o fondo asociada a esta feature se declara sobre selectores globales (`:root`,
   `body`, `#root`); toda regla queda acotada al elemento raíz propio que renderiza el runtime.
6. El elemento raíz del runtime deja de aplicar el fondo general decorativo (gradiente y color de fondo) que hoy
   se aplica a nivel de aplicación. El token de color subyacente permanece disponible para otros usos del catálogo
   de nodos.
7. `shell.scrollBehavior` es un campo opcional dentro del bloque raíz `shell`, con dos valores admitidos: `"page"`
   y `"fixed"`. Cualquier otro valor se rechaza en validación previa al render.
8. Si `shell.scrollBehavior` no se declara, o `shell` no se declara, el comportamiento de scroll es `"page"`:
   idéntico al comportamiento actual, sin cambios.
9. Con `shell.scrollBehavior: "page"`, la página completa (más allá del contenedor de montaje) hace scroll;
   `shell.header`, si existe, permanece fijado arriba mediante scroll pegajoso, igual que hoy.
10. Con `shell.scrollBehavior: "fixed"`, `shell.header` y `shell.sidebar` (los que estén declarados) permanecen
    fijos y visibles ocupando el alto disponible del contenedor de montaje; el área de contenido de la página activa
    hace scroll internamente sin desplazar el chrome.
11. `shell.sidebar`, cuando existe, permanece visible en todo momento durante el scroll mediante posicionamiento
    pegajoso propio, independientemente de `shell.scrollBehavior`. Si su lista de elementos visibles excede el alto
    disponible bajo la cabecera, hace scroll interno propio que se detiene al llegar al último elemento; si todos
    los elementos caben, no muestra ningún scroll.
12. El área de contenido de página aplica un padding uniforme propio, con o sin `shell.sidebar` presente.
    `shell.header` y `shell.sidebar` no llevan ese padding.
13. El bloque de error de configuración (mostrado cuando la config raíz o los `data-values` son inválidos) refleja
    los mismos cambios de esta spec: sin card, sin límite de ancho, sin fondo general, con el mismo padding del área
    de contenido.
14. Ninguno de los cambios anteriores requiere declarar nada nuevo en la configuración salvo `scrollBehavior`; una
    configuración existente sin `shell`, o con `shell.header`/`shell.sidebar` ya declarados, adopta automáticamente
    el nuevo aspecto de ancho completo, alto adaptable, sin fondo general, con el nuevo espaciado y con el sidebar
    pegajoso, sin ninguna acción adicional.

## Requisitos no funcionales

- A diferencia del patrón habitual de features aditivas de este proyecto (nueva funcionalidad tras un campo opcional
  que no afecta a quien no lo declara), esta feature cambia deliberadamente el aspecto visual por defecto de
  **cualquier** configuración existente: toda app pierde la card, el límite de ancho, el alto mínimo forzado y el
  fondo general sin necesidad de declarar nada. Es un cambio visual global intencionado, pedido explícitamente.
  Únicamente `scrollBehavior` sigue el patrón aditivo habitual (default `"page"` = comportamiento actual).
- El comportamiento de accesibilidad ya fijado para `shell.header`/`shell.sidebar` (foco, `aria-*`, navegación por
  teclado, scroll pegajoso) no debe regresar con ninguno de los cambios de esta spec.
- Los cambios se implementan con utilidades de Tailwind CSS y los tokens de diseño ya existentes, sin introducir
  theming declarativo ni una capa visual paralela, siguiendo la restricción global ya vigente del proyecto.
- El mecanismo de montaje del runtime (elemento contenedor + `ReactDOM.createRoot`) no cambia; esta spec no
  introduce una nueva superficie de integración, solo ajusta el CSS para que el mecanismo actual se comporte bien a
  cualquier ancho/alto de contenedor.

## Criterios de aceptación

- Dada cualquier configuración existente sin `shell`, el runtime se renderiza a ancho y alto completos del
  contenedor de montaje, sin card, sin fondo general y con el nuevo padding del área de contenido.
- Dado un config con `shell.header` y/o `shell.sidebar` ya declarados (sin `scrollBehavior`), el comportamiento de
  scroll es idéntico al actual (`"page"`), con el header fijado arriba mediante scroll pegajoso.
- Dado `shell.scrollBehavior: "fixed"` sin `shell.sidebar`, el header permanece visible en todo momento y el área
  de contenido hace scroll interno cuando su contenido excede el alto disponible.
- Dado `shell.scrollBehavior: "fixed"` con `shell.header` y `shell.sidebar` declarados, ambos permanecen visibles
  en todo momento y solo el área de contenido hace scroll interno.
- Dado `shell.scrollBehavior` con un valor fuera del catálogo (`"page"`/`"fixed"`), el config se rechaza en
  validación previa con diagnóstico de ruta exacta.
- Dado un config con `shell.sidebar` cuyos elementos visibles exceden el alto disponible bajo la cabecera, en
  cualquier valor de `scrollBehavior` (`"page"` o `"fixed"`), la barra lateral permanece visible durante el scroll
  y su lista de elementos hace scroll internamente, deteniéndose al llegar al último elemento.
- Dado un config con `shell.sidebar` cuyos elementos caben en el alto disponible bajo la cabecera, la barra
  lateral no muestra ningún scroll interno, en ningún valor de `scrollBehavior`.
- Dado el bloque de error de configuración, se renderiza sin card, sin límite de ancho y sin fondo general, igual
  que el resto del runtime.
- Montado el runtime dentro de un contenedor de altura acotada embebido en una página anfitriona (no a pantalla
  completa), el runtime ocupa el 100% de ese contenedor sin forzar el alto de la página anfitriona ni filtrar
  estilos de fondo/alto fuera de su propio árbol.
- Dado un config con `shell.header`, la fila interna del header ocupa el ancho completo del contenedor, sin
  quedar centrada en una banda más estrecha que el resto del chrome/contenido.

## Casos límite

- `shell.scrollBehavior: "fixed"` declarado, pero el contenedor de montaje no tiene una altura acotada real (por
  ejemplo, un `<div>` embebido con alto `auto` dentro de una página que crece con el contenido): el confinamiento
  del *área de contenido* no tiene un límite de alto del que recortar, por lo que ese aspecto concreto degrada
  visualmente a un comportamiento equivalente a `"page"`. Es responsabilidad de quien integra la app dar una altura
  acotada al contenedor de montaje si declara `scrollBehavior: "fixed"` y quiere ese confinamiento; esta spec no
  introduce validación ni aviso en tiempo de ejecución para este caso. El posicionamiento pegajoso de
  `shell.header`/`shell.sidebar` no depende de esta altura acotada — sigue funcionando igual, con o sin ella,
  porque no necesita un contenedor ancestro de altura definida.
- Configuración sin `shell.header` ni `shell.sidebar`: el runtime renderiza solo el área de contenido con su nuevo
  padding, sin ningún cambio de comportamiento de navegación/formularios/queries.
- `shell.scrollBehavior: "page"` explícito (en vez de omitido): comportamiento idéntico a omitirlo.

## Riesgos o preguntas abiertas

- Estrategia CSS concreta para lograr el modo `"fixed"` (por ejemplo, estructura de altura basada en `100%`/`100dvh`
  en cascada frente a otras alternativas) no se fija en esta spec; es una decisión de implementación sin impacto en
  el contrato funcional descrito aquí.
- Coordinación entre el posicionamiento pegajoso de `shell.header` y el de `shell.sidebar`: como ambos son
  pegajosos y el sidebar debe quedar anclado justo debajo de la cabecera (no detrás ni tapado por ella), la
  implementación necesita conocer el alto real de la cabecera, que puede variar según su contenido (logo, título,
  menú, acciones, incluido el ajuste de línea del menú). Esta spec no fija la estrategia concreta (por ejemplo,
  medir el alto en tiempo de ejecución) — es una decisión de implementación sin impacto en el contrato funcional.
- Esta feature no introduce ningún mecanismo para que el equipo de backend detecte si una integración concreta es
  standalone o embebida; el único control expuesto es `shell.scrollBehavior`, decidido igual que el resto de campos
  de `shell`, de forma estática en la configuración JSON.

## Áreas de producto afectadas

- `shell` (`shell.header`, `shell.sidebar`, nuevo `shell.scrollBehavior`).
- Apariencia general del runtime (fondo, ancho, alto) — hoy documentada en `runtime/design-tokens.md` y
  `runtime/overview.md`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/shell/index.md`, `shell/header.md`, `shell/sidebar.md`.
- `ai-workflow/docs/app-features/runtime/design-tokens.md`, `runtime/overview.md`.
- `ai-workflow/docs/app-features/config/structure.md`, `config/validation.md` (nuevo campo `shell.scrollBehavior`).
- `ai-workflow/docs/current-state.md` (fila de "Shell de aplicación").
