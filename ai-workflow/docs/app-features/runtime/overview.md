> Cuándo leer: visión global del runtime, qué resuelve, áreas funcionales principales, estructura de alto nivel de la configuración.
> Tamaño: medio.
> Relacionados: [[organization.md]], [[../nodes/index.md]], [[../shell/header.md]].

# Visión general del runtime

## Objetivo
Renderizar el runtime a partir de una configuración JSON validada, apoyado en un estado compartido por instancia para navegación, formularios y queries, con una frontera declarativa real para ejecutar operaciones remotas, dispararlas automáticamente al entrar en página, activarlas desde botones o desde submit de formularios, permitir request params por ejecución sobre una operación `api` base, transportar params de navegación interna por entrada, expandir subárboles completos con `repeater`, paginar localmente colecciones de `repeater`, mostrar imágenes simples y tablas de lectura con procesamiento local opt-in, interpolar texto visible acotado con `{{...}}`, componer grids de `container` con columnas y spans fijos o responsive, y condicionar la salida visible de cada nodo tanto por estado de query como por valores ya presentes en el propio runtime sin acoplar la UI a HTTP.

El catálogo estable de formularios cubre selección simple y múltiple sobre una semántica compartida de opciones y se apoya en una baseline institucional ya compactada para reducir densidad vertical sin reabrir el lenguaje visual base.

## Qué resuelve
- Permite que la configuración declare varias páginas y resolver la visible desde el hash del navegador o, en ausencia de hash válido, desde `initialPage`.
- Valida el contrato mínimo del runtime antes de renderizar.
- Apoya esa validación previa al render en una base `Zod`, sin exponer `Zod` en la API pública de bootstrap.
- Interpreta un layout raíz basado en colección ordenada y un catálogo inicial y acotado de nodos.
- Sustituye el shell provisional por una página visible renderizada desde configuración.
- Mantiene una estructura interna separada entre validación de configuración, render de colecciones y piezas concretas por nodo soportado.
- Mantiene un store compartido por instancia para navegación, formularios y queries, con aislamiento entre runtimes montados a la vez.
- Resuelve referencias dinámicas e interpolación parcial `{{...}}` desde una capa central del runtime para las superficies visibles soportadas.
- Ejecuta operaciones remotas declaradas en `api` mediante una capa dedicada en `src/queries/` y refleja sus resultados en `queries.{operationName}`.
- Formaliza `api.headers` como parte estable del contrato declarativo y permite que cada ejecución añada `query`, `body` y `headers` sin redefinir otra operación `api`.
- Permite que cada página declare `preloads` como requests declarativas por operación, las compare por firma efectiva y las dispare automáticamente al entrar, con un estado agregado `pageEntry` latest-only para la tanda activa y preparación previa de carga fresca solo para las queries realmente relanzadas.
- Expone una capa común de acciones UI del runtime para que los nodos interactivos deleguen navegación, ejecución remota y reset de formularios sin lógica imperativa específica en el propio nodo visual.
- Permite que `navigateTo` transporte params escalares por entrada, los refleje en el hash canónico del navegador, que `goBack` restaure esa entrada completa desde el historial real y que `preloads` dependan de la reentrada observable real y de su request efectiva, no solo del `pageId`, reaplicando su limpieza selectiva por firma en cada nueva `pageEntry`.
- Añade `repeater` como nodo estructural para repetir un `template` completo por item de una colección `queries.*`, con identidad declarativa por `props.items.key`, paginación local opcional mediante `props.pagination`, variantes de controles `previousNext`, `numbered` y `scroll`, y degradación a cero iteraciones cuando la colección no está disponible o no es un array.
- Añade `image` como nodo hoja para renderizar `<img>` con `src` y `alt` literales, resueltos desde referencias runtime completas o interpolados parcialmente, con degradación segura a no render cuando `src` no produce un string utilizable y fallback de `alt` a string vacío.
- Añade `table` como nodo hoja para tablas semánticas de lectura con cabeceras ordenadas, filas manuales o dinámicas, filtros locales por columna, ordenación local por una única columna activa y paginación local opt-in, reutilizando `queries.*` e `item.*` en referencias completas o placeholders visibles y degradando a cero filas o a celdas vacías cuando faltan datos.
- Permite que cualquier nodo soportado declare `queryStateFeedback` para mostrarse, ocultarse o sustituirse por un fallback local según `idle | loading | error | empty | success`.
- Permite que `item` e `item.*` existan solo dentro del subárbol iterado de un `repeater`, reutilizando la misma semántica de navegación segura por objetos y arrays ya fijada para `queries.{queryName}.data.*`.
- Permite que cualquier nodo soportado declare `visibility` para mostrarse u ocultarse según valores de `forms.*`, `queries.*` y `item.*` cuando exista contexto de iteración, con una semántica compartida entre renderer y formularios.
- Renderiza formularios declarativos reales con `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`, inicializa su estado lazy en `forms.{formId}.{fieldId}`, valida `required` solo sobre campos visibles, soporta submit con `executeOperation` y permite que `defaultValue`, colecciones dinámicas y requests lean `item.*` dentro de `repeater`, incluyendo la reentrada limpia de `defaultValue` dependiente de `preloads`.
- Implementa la presentación visible del runtime con utilidades de `Tailwind CSS`, apoyada ya en tokens globales CSS-first declarados con `@theme` en `src/app/index.css`, sin abrir todavía theming declarativo desde JSON.
- Mantiene la baseline institucional previa, pero con una densidad visible más compacta: shell, bloque introductorio, títulos, párrafos, secciones de formulario y cierre de acciones ocupan menos altura total y se acercan más a la referencia de "Solicitud general".
- Permite declarar un bloque raíz opcional `shell` con un chrome de aplicación compartido y persistente entre páginas; hoy cubre `shell.header` (logo, título, menú de navegación con un nivel de desplegables y acciones de usuario restringidas a `link`/`button`), montado una única vez por sesión fuera del ciclo de vida de cada página.
- El runtime ocupa el 100% del ancho y alto disponibles de su contenedor de montaje, sin límite de ancho centrado, sin contenedor tipo "tarjeta" (borde, sombra, fondo de superficie, padding perimetral) ni fondo general decorativo propio; el área de contenido de página aporta su propio padding uniforme, independiente del chrome (`shell.header`/`shell.sidebar`), que permanece "edge to edge". Admite un modo de scroll configurable (`shell.scrollBehavior`: `"page"` | `"fixed"`, default `"page"`) para que el chrome permanezca fijo mientras solo el contenido de la página activa hace scroll interno; ver [[../shell/index.md]].

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
