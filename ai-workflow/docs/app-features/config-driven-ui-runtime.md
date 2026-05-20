# Runtime UI configurable

## Objetivo
Renderizar el runtime a partir de una configuración JSON validada, apoyado ya en un estado compartido por instancia para navegación, formularios y queries, con una frontera declarativa real para ejecutar operaciones remotas, dispararlas automáticamente al entrar en página, activarlas desde botones o desde submit de formularios, permitir request params por ejecución sobre una operación `api` base, transportar params de navegación interna por entrada, expandir subárboles completos con `repeater`, mostrar imágenes simples y tablas básicas de lectura, y condicionar la salida visible de cada nodo tanto por estado de query como por valores ya presentes en el propio runtime sin acoplar la UI a HTTP. El catálogo estable de formularios ya cubre selección simple y múltiple sobre una semántica compartida de opciones y se apoya en una baseline institucional ya compactada para reducir densidad vertical sin reabrir el lenguaje visual base.

## Qué resuelve
- Permite que la configuración declare varias páginas y resolver la visible desde el hash del navegador o, en ausencia de hash válido, desde `initialPage`.
- Valida el contrato mínimo del runtime antes de renderizar.
- Apoya esa validación previa al render en una base `Zod`, sin exponer `Zod` en la API pública de bootstrap.
- Interpreta un layout raíz basado en colección ordenada y un catálogo inicial y acotado de nodos.
- Sustituye el shell provisional por una página visible renderizada desde configuración.
- Mantiene una estructura interna separada entre validación de configuración, render de colecciones y piezas concretas por nodo soportado.
- Mantiene un store compartido por instancia para navegación, formularios y queries, con aislamiento entre runtimes montados a la vez.
- Resuelve referencias dinámicas desde una capa central del runtime para las superficies textuales ya soportadas.
- Ejecuta operaciones remotas declaradas en `api` mediante una capa dedicada en `src/queries/` y refleja sus resultados en `queries.{operationName}`.
- Formaliza `api.headers` como parte estable del contrato declarativo y permite que cada ejecución añada `query`, `body` y `headers` sin redefinir otra operación `api`.
- Permite que cada página declare `preloads` como requests declarativas por operación, las compare por firma efectiva y las dispare automáticamente al entrar, con un estado agregado `pageEntry` latest-only para la tanda activa y preparación previa de carga fresca solo para las queries realmente relanzadas.
- Expone una capa común de acciones UI del runtime para que los nodos interactivos deleguen navegación, ejecución remota y reset de formularios sin lógica imperativa específica en el propio nodo visual.
- Permite que `navigateTo` transporte params escalares por entrada, los refleje en el hash canónico del navegador, que `goBack` restaure esa entrada completa desde el historial real y que `preloads` dependan de la reentrada observable real y de su request efectiva, no solo del `pageId`, reaplicando su limpieza selectiva por firma en cada nueva `pageEntry`.
- Añade `repeater` como nodo estructural para repetir un `template` completo por item de una colección `queries.*`, con identidad declarativa por `props.items.key` y degradación a cero iteraciones cuando la colección no está disponible o no es un array.
- Añade `image` como nodo hoja para renderizar `<img>` con `src` y `alt` literales o resueltos desde referencias runtime completas, con degradación segura a no render cuando `src` no produce un string utilizable y fallback de `alt` a string vacío.
- Añade `table` como nodo hoja para tablas semánticas de lectura con cabeceras ordenadas y filas manuales o dinámicas, reutilizando `queries.*` e `item.*` sin abrir plantillas ricas por celda y degradando a cero filas o a celdas vacías cuando faltan datos.
- Permite que cualquier nodo soportado declare `queryStateFeedback` para mostrarse, ocultarse o sustituirse por un fallback local según `idle | loading | error | empty | success`.
- Permite que `item` e `item.*` existan solo dentro del subárbol iterado de un `repeater`, reutilizando la misma semántica de navegación segura por objetos y arrays ya fijada para `queries.{queryName}.data.*`.
- Permite que cualquier nodo soportado declare `visibility` para mostrarse u ocultarse según valores de `forms.*`, `queries.*` y `item.*` cuando exista contexto de iteración, con una semántica compartida entre renderer y formularios.
- Renderiza formularios declarativos reales con `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`, inicializa su estado lazy en `forms.{formId}.{fieldId}`, valida `required` solo sobre campos visibles, soporta submit con `executeOperation` y permite que `defaultValue`, colecciones dinámicas y requests lean `item.*` dentro de `repeater`, incluyendo la reentrada limpia de `defaultValue` dependiente de `preloads`.
- Implementa la presentación visible del runtime con utilidades de `Tailwind CSS`, apoyada ya en tokens globales CSS-first declarados con `@theme` en `src/app/index.css`, sin abrir todavía theming declarativo desde JSON.
- Mantiene la baseline institucional previa, pero con una densidad visible más compacta: shell, bloque introductorio, títulos, párrafos, secciones de formulario y cierre de acciones ocupan menos altura total y se acercan más a la referencia de "Solicitud general".

## Áreas funcionales principales
- Configuración y contrato JSON.
- Selección de página inicial.
- Render estático de layout.
- Gestión de errores de configuración entre desarrollo y producción.
- Formularios declarativos, validación básica y submit.
- Modo desarrollo local sin backend.

## Estructura de alto nivel
La configuración soportada hoy se organiza alrededor de:
- `api`
- `pages`
- `initialPage`

Cada página soportada define al menos:
- `id`
- `layout`

En el estado actual, `layout` es una colección ordenada de bloques hermanos. La página puede empezar por varios elementos raíz sin requerir un `container` sintético.

## Catálogo inicial de nodos
El renderer estático soporta estos nodos:
- `container`
- `repeater`
- `heading`
- `paragraph`
- `list`
- `image`
- `table`
- `button`
- `form`
- `input`
- `textarea`
- `select`
- `radioGroup`
- `checkboxGroup`

Reglas funcionales vigentes:
- La raíz de página se renderiza como colección; el runtime no inventa un `container` de layout para envolver hermanos.
- `layout: []` es válido y resuelve una página vacía.
- Solo `container` admite `children`.
- `container.props` soporta `direction`, `gap`, `columns`, `variant`, `align`, `justify` y `wrap`.
- cualquier nodo soportado del árbol `layout` puede declarar `layout.span` como ocupación de grid transversal, pero solo tiene efecto visible dentro de un `container` cuyo layout efectivo use `columns`.
- `repeater.props.items.source` solo admite `queries.{queryName}.data` o `queries.{queryName}.data.*`, `repeater.props.items.key` exige una ruta relativa no vacía al item actual y `repeater.props.template` reutiliza una colección `LayoutNode[]` sin `children`.
- `repeater` no introduce markup propio: expande su `template` como hermanos por iteración y omite cualquier item cuya key efectiva sea ausente, no escalar o duplicada, con diagnóstico en desarrollo.
- Un `container` sin `gap` declarado usa `md` como separación visible por defecto.
- Los alias estables de `container.props.gap` soportados hoy (`sm`, `md`, `lg`, `xl`, `2xl`) se resuelven a clases estables de `Tailwind`.
- Un valor arbitrario de `container.props.gap` sigue siendo válido mediante una excepción acotada: clase `Tailwind` con variable CSS local, sin volver a estilos inline completos.
- Si `container.props.columns` existe, el runtime cambia a modo `grid`, aplica `grid-cols-{n}` para `n` entre `1` y `12` y hace que `columns` prevalezca visualmente sobre `direction`.
- `container.props.variant` mantiene una superficie cerrada: ausencia de `variant` y `variant: default` conservan la apariencia histórica, y `variant: card` añade una tarjeta institucional con borde, fondo, sombra y padding propios sin abrir theming libre.
- `container.props.align` y `container.props.justify` se traducen a clases estables según el modo activo del contenedor.
- `container.props.wrap` solo aplica en modo lineal (`flex`); su default efectivo es `nowrap` y no se admite junto con `columns`.
- Dentro de `form`, un `container` conserva la superficie visual de sección solo cuando actúa como bloque vertical por defecto o cuando declara `columns`; si declara `direction: row` sin `columns`, se mantiene como layout lineal `plain` sin sangrado lateral ni márgenes negativos implícitos, y si además declara `variant: card`, la tarjeta sustituye visualmente a esa superficie implícita para evitar doble marco.
- `layout.span` se aplica desde el borde central del renderer con un wrapper ligero solo para nodos visibles distintos de `repeater`; fuera de un grid efectivo no produce efecto, y dentro de grid se clampa al número de columnas del padre antes de emitir `col-span-*`.
- `heading.props` soporta `text` y `level`.
- `paragraph.props` soporta `text`.
- El shell visible del runtime mantiene el mismo marco institucional, pero con menos padding exterior e interior para que la página útil entre antes en pantalla.
- `heading` y `paragraph` conservan su jerarquía semántica actual, pero con una escala tipográfica y un bloque introductorio más contenidos que en la baseline previa.
- `list.props` soporta `items` como array histórico de strings o como origen declarativo manual/dinámico de colecciones escalares u objeto.
- `image.props` soporta `src` y `alt` como strings obligatorios; ambos reutilizan la convención central de literal o referencia runtime completa, `src` solo renderiza la imagen cuando resuelve un string no vacío y `alt` degrada a string vacío si no hay valor textual visible.
- `table.props` soporta `headers` como colección ordenada obligatoria y `rows` como unión exclusiva entre un modo manual `Array<Array<string | number | boolean>>` y un modo dinámico `{ source, cells }`; `source` reutiliza la misma familia de colecciones soportada por `list` y `select`, `cells` conserva el orden de columnas y cada celda string reutiliza la misma semántica visible compartida de literal o referencia completa.
- `button.props` soporta `label` y `action`, con `navigateTo`, `goBack`, `executeOperation` y `resetForm` como acciones declarativas vigentes; `navigateTo` puede añadir `params` escalares por entrada y escribirlos en `#/pageId?...` o `#/?...` para la home funcional; `executeOperation` puede aportar `query`, `body` y `headers` por ejecución; dentro de un `form`, un botón sin `action` actúa como submit implícito.
- `form` renderiza un `<form>` real, hereda un contexto estable de `formId` a sus descendientes, inicializa solo los campos todavía ausentes en el store, elimina por defecto `forms.{formId}` al desmontarse realmente y puede ejecutar `submitAction.type: executeOperation` con `query`, `body` y `headers` por envío.
- `form.persistOnUnmount: true` convierte esa limpieza por desmontaje en una excepción opt-in para conservar la persistencia histórica de un formulario concreto dentro de la misma instancia del runtime.
- `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` leen y escriben exclusivamente en `forms.{formId}.{fieldId}` y comparten una base visual accesible con estado de error, foco por `ring` y sin sombra propia en los controles.
- `input` ya soporta también `number`, `date` y `datetime-local` además del catálogo textual inicial.
- `select` soporta items históricos estáticos y también orígenes declarativos manuales o dinámicos de escalares u objetos; normaliza internamente a string los valores efectivos y deja el valor vigente vacío cuando ya no coincide con ninguna opción disponible.
- `select.props.multiple` activa una semántica de selección múltiple basada en `string[]`, con el mismo orden estable del catálogo efectivo visible y la misma limpieza automática de valores ya inválidos.
- `radioGroup` reutiliza exactamente la misma semántica de opciones y selección simple que `select` simple.
- `checkboxGroup` reutiliza exactamente la misma semántica de opciones y selección múltiple que `select.multiple`.
- `list`, `select`, `radioGroup` y `checkboxGroup` pueden seguir leyendo colecciones desde `queries.*` y además aceptar `item.*` como `source` cuando están dentro de un `repeater`.
- cualquier nodo soportado puede combinar `queryStateFeedback` y `visibility`; si ambos existen, el runtime resuelve primero `queryStateFeedback` y solo evalúa `visibility` cuando la rama principal sigue visible.
- `heading`, `paragraph`, `list`, `image` y `table` usan clases base estables de `Tailwind` para mantener jerarquía, legibilidad y la baseline institucional compacta del runtime.
- `button` se renderiza como control accesible y delega sus acciones al ejecutor común del runtime, manteniendo los efectos visibles dentro de los dominios compartidos de navegación, queries y formularios.

## Organización estable del runtime
- `src/config/runtime-config.ts` actúa como fachada pública mínima del contrato del runtime.
- `src/config/runtime-config-types.ts` concentra los tipos del contrato y los shapes de resultado/error de validación.
- `src/config/runtime-config-zod.ts` concentra los esquemas `Zod` internos del contrato estructural.
- `src/config/runtime-config-validation-errors.ts` adapta los fallos internos a la taxonomía pública estable de errores.
- `src/config/validate-runtime-config.ts` contiene la validación estructural previa al render y las validaciones cruzadas posteriores al parseo.
- `src/runtime/layout-renderer.tsx` renderiza colecciones ordenadas, conserva el soporte de varios hermanos raíz y propaga opcionalmente un contexto de iteración por subárbol.
- `src/runtime/layout-node-renderer.tsx` centraliza la resolución `type -> pieza de render`, aplica el borde transversal de visibilidad efectiva antes de delegar al nodo concreto, mantiene `repeater` como expansión estructural sin wrapper visual y resuelve también el wrapper genérico de `layout.span` solo cuando el padre efectivo es grid.
- `src/runtime/runtime-layout-context.tsx` propaga un contexto mínimo de layout con las columnas efectivas del grid padre, separado del store global del runtime.
- `src/runtime/form-context.tsx` propaga el `formId` efectivo por descendencia sin acoplar los nodos de campo a props manuales repetidas.
- `src/runtime/runtime-actions/` concentra el ejecutor común `action.type -> handler del provider`, reutilizable por futuros triggers más allá de `button`.
- `src/queries/` concentra también la composición final entre la operación `api` base y los request params por ejecución, incluida la semántica estable de merge para `query`, `body` y `headers`.
- `src/app/index.css` centraliza los tokens visuales globales del runtime con `@theme` de `Tailwind CSS v4`.
- `src/runtime/runtime-node-styling.ts` centraliza la convención visual base, la selección entre modos `flex` y `grid`, la heurística `plain | form-section` para `container` dentro de `form`, la variante cerrada `card`, el mapeo de `columns`, `align`, `justify` y `wrap`, la compatibilidad acotada de `gap` y el cálculo de `col-span-*` con clamp seguro al grid padre.
- `src/runtime/runtime-references/` centraliza parsing, resolución y diagnóstico de referencias string del runtime, incluido el namespace `item` limitado al contexto de iteración y la normalización visible compartida de `image` y celdas de `table`.
- `src/runtime/runtime-collection-sources.ts` concentra la resolución compartida de colecciones efectivas para `list`, `select`, `radioGroup`, `checkboxGroup` y las filas dinámicas de `table`, incluyendo degradación a vacío, proyección declarativa por item, soporte de `item.*` dentro de `repeater` y normalización común de selección simple o múltiple.
- `src/queries/` concentra la construcción de requests, la ejecución contra `fetch` y la normalización de errores remotos.
- `src/runtime/runtime-state/` concentra el provider, reducer, tipos, selectors y acciones del estado compartido del runtime.
- `src/runtime/nodes/form-layout-node.tsx` fija hoy la frontera visible entre rerender, ocultación y desmontaje real del formulario, y usa el store compartido para distinguir entre resetear un formulario existente y eliminarlo completo.
- `src/runtime/runtime-query-state-feedback.ts` concentra la derivación de estado visible de query, incluida la distinción explícita entre `idle` y `loading`, la heurística común de `empty` y la resolución de la respuesta efectiva `show | hide | fallback`.
- `src/runtime/runtime-layout-visibility.ts` compone `queryStateFeedback` y `visibility` en una única decisión reutilizable por renderer y formularios.
- `src/runtime/nodes/` contiene una pieza concreta por nodo soportado hoy: `container`, `repeater`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.

## Referencias dinámicas ya activas
El runtime resuelve hoy referencias completas en:
- `heading.props.text`
- `paragraph.props.text`
- `image.props.src`
- `image.props.alt`
- celdas string de `table` en modo manual o dinámico

Contrato visible vigente:
- `item`
- `item.{segmentosAnidados}`
- `forms.{formId}.{fieldId}`
- `params.{paramName}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

Límites funcionales de esa capa:
- no existe interpolación parcial dentro de strings
- la navegación anidada solo se permite bajo `queries.{queryName}.data`
- `item.*` solo existe dentro del subárbol iterado de un `repeater`
- objetos y arrays pueden recorrerse de izquierda a derecha con una única semántica central
- `params.*` solo admite `params.{paramName}` y no abre navegación anidada adicional
- cuando nace de la URL, `params.*` expone siempre strings ya normalizados desde el hash canónico
- `status`, `error`, `navigation.*` y `routeParams.*` no se abren como navegación dinámica soportada
- las referencias textuales no resolubles degradan a string vacío y mantienen diagnóstico de desarrollo coherente con la referencia original

Además, el runtime reutiliza la misma convención de referencias completas en:
- `api.query`
- `api.headers`
- hojas string de `api.body`
- `table.props.rows.cells`
- `button.props.action.query`
- `button.props.action.body`
- `button.props.action.headers`
- `form.submitAction.query`
- `form.submitAction.body`
- `form.submitAction.headers`
- `navigateTo.params`
- `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`
- `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`
- `repeater.props.items.key`
- `visibility.reference`

## Comportamiento de errores
- Si `initialPage` no coincide con ninguna página declarada, el runtime muestra un error visible.
- Si un botón `navigateTo` apunta a una página inexistente, el runtime rechaza el config antes del render con una ruta diagnóstica del árbol afectado.
- Si el navegador entra con un hash inválido o con un slug de página inexistente, el runtime degrada a `initialPage` y reescribe la URL a `#/`.
- Si el `layout` es inválido, usa el shape raíz antiguo basado en objeto o aparece un nodo no soportado, en desarrollo se muestra un error diagnóstico.
- Los errores estructurales mantienen los códigos públicos actuales y mejoran la trazabilidad con rutas canónicas del JSON cuando el fallo depende de una rama concreta.
- En producción, los errores marcados como `development-only` degradan a una superficie vacía en lugar de mostrar un mensaje genérico o inventar contenido.

## Límites actuales
- El catálogo común de acciones UI sigue intencionadamente corto: no existen todavía secuencias, branching, callbacks por éxito o error, condiciones declarativas ni varias acciones por trigger.
- `visibility` cubre solo una condición simple por nodo y no introduce `fallback`, composición booleana ni expresiones arbitrarias.
- El trigger sigue siendo implícito por tipo de nodo; todavía no existe un sistema general de `events`, `onClick` u `onSubmit` compartido entre superficies interactivas.
- El catálogo de formularios sigue intencionadamente acotado a `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`; no existen todavía subida de archivos, autocompletado, búsqueda remota, paginación ni carga incremental de opciones.
- La validación declarativa de formularios ya cubre `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections`, pero siguen fuera de alcance validaciones remotas, cruzadas y mensajes personalizados efectivos.
- El agregado `pageEntry` todavía no se expone como familia de referencias declarativas dentro del JSON.
- `routeParams.*` y `navigation.*` siguen sin resolverse como referencias soportadas.
- `params.*` sigue intencionadamente fuera de `visibility` y de las fuentes dinámicas de colección.
- El runtime sigue intencionadamente acotado a hash routing simple y no abre un router general por `pathname`, subrutas ni segmentos dinámicos.
- El runtime no expone todavía theming ni personalización visual declarativa desde JSON; la capa estable actual se limita a tokens globales en CSS y a la gramática compartida codificada en el propio runtime.
- `layout.span` sigue intencionadamente acotado a semántica de grid sobre `columns`; no existe soporte responsive por breakpoint, widths libres para layouts `flex` ni wrapper visible propio en `repeater`.

## Referencias relacionadas
- [`./config-contract.md`](./config-contract.md)
- [`./pages-and-navigation.md`](./pages-and-navigation.md)
- [`./queries-and-feedback.md`](./queries-and-feedback.md)
- [`./forms-and-validation.md`](./forms-and-validation.md)
- [`./development-workflow.md`](./development-workflow.md)
