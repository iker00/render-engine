# Runtime UI configurable

## Objetivo
Renderizar el runtime a partir de una configuración JSON validada, apoyado ya en un estado compartido por instancia para navegación, formularios y queries, con una frontera declarativa real para ejecutar operaciones remotas, dispararlas automáticamente al entrar en página y condicionar la salida visible de cada nodo según el estado de una query sin acoplar la UI a HTTP.

## Qué resuelve
- Permite que la configuración declare varias páginas aunque, por ahora, solo se resuelva la indicada por `initialPage`.
- Valida el contrato mínimo del runtime antes de renderizar.
- Apoya esa validación previa al render en una base `Zod`, sin exponer `Zod` en la API pública de bootstrap.
- Interpreta un layout raíz basado en colección ordenada y un catálogo inicial y acotado de nodos.
- Sustituye el shell provisional por una página visible renderizada desde configuración.
- Mantiene una estructura interna separada entre validación de configuración, render de colecciones y piezas concretas por nodo soportado.
- Mantiene un store compartido por instancia para navegación, formularios y queries, con aislamiento entre runtimes montados a la vez.
- Resuelve referencias dinámicas desde una capa central del runtime para las superficies textuales ya soportadas.
- Ejecuta operaciones remotas declaradas en `api` mediante una capa dedicada en `src/queries/` y refleja sus resultados en `queries.{operationName}`.
- Permite que cada página declare `preloads` y los dispare automáticamente al entrar, con un estado agregado `pageEntry` latest-only para la tanda activa.
- Permite que cualquier nodo soportado declare `queryStateFeedback` para mostrarse, ocultarse o sustituirse por un fallback local según `loading | error | empty | success`.
- Implementa la presentación visible del runtime con utilidades de `Tailwind CSS`, sin abrir todavía una capa de theming definida.

## Áreas funcionales principales
- Configuración y contrato JSON.
- Selección de página inicial.
- Render estático de layout.
- Gestión de errores de configuración entre desarrollo y producción.
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
- `heading`
- `paragraph`
- `list`
- `button`

Reglas funcionales vigentes:
- La raíz de página se renderiza como colección; el runtime no inventa un `container` de layout para envolver hermanos.
- `layout: []` es válido y resuelve una página vacía.
- Solo `container` admite `children`.
- `container.props` soporta `direction` y `gap`.
- Los alias de `container.props.gap` soportados hoy (`sm`, `md`, `lg`) se resuelven a clases estables de `Tailwind`.
- Un valor arbitrario de `container.props.gap` sigue siendo válido mediante una excepción acotada: clase `Tailwind` con variable CSS local, sin volver a estilos inline completos.
- `heading.props` soporta `text` y `level`.
- `paragraph.props` soporta `text`.
- `list.props` soporta `items` como array de strings.
- `button.props` soporta `label` y `action`, con `navigateTo` y `goBack` como acciones declarativas vigentes.
- `heading`, `paragraph` y `list` usan clases base estables de `Tailwind` para mantener jerarquía y legibilidad mínimas.
- `button` se renderiza como control accesible y mantiene la navegación declarativa dentro del estado compartido del runtime.

## Organización estable del runtime
- `src/config/runtime-config.ts` actúa como fachada pública mínima del contrato del runtime.
- `src/config/runtime-config-types.ts` concentra los tipos del contrato y los shapes de resultado/error de validación.
- `src/config/runtime-config-zod.ts` concentra los esquemas `Zod` internos del contrato estructural.
- `src/config/runtime-config-validation-errors.ts` adapta los fallos internos a la taxonomía pública estable de errores.
- `src/config/validate-runtime-config.ts` contiene la validación estructural previa al render y las validaciones cruzadas posteriores al parseo.
- `src/runtime/layout-renderer.tsx` renderiza colecciones ordenadas y conserva el soporte de varios hermanos raíz.
- `src/runtime/layout-node-renderer.tsx` centraliza la resolución `type -> pieza de render` y aplica el borde transversal de `queryStateFeedback` antes de delegar al nodo concreto.
- `src/runtime/runtime-node-styling.ts` centraliza la convención visual base y la compatibilidad acotada de `gap`.
- `src/runtime/runtime-references/` centraliza parsing, resolución y diagnóstico de referencias string del runtime.
- `src/queries/` concentra la construcción de requests, la ejecución contra `fetch` y la normalización de errores remotos.
- `src/runtime/runtime-state/` concentra el provider, reducer, tipos, selectors y acciones del estado compartido del runtime.
- `src/runtime/runtime-query-state-feedback.ts` concentra la derivación de estado visible de query, la heurística común de `empty` y la resolución de la respuesta efectiva `show | hide | fallback`.
- `src/runtime/nodes/` contiene una pieza concreta por nodo soportado hoy: `container`, `heading`, `paragraph`, `list` y `button`.

## Referencias dinámicas ya activas
El runtime resuelve hoy referencias completas en:
- `heading.props.text`
- `paragraph.props.text`

Contrato visible vigente:
- `forms.{formId}.{fieldId}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

Límites funcionales de esa capa:
- no existe interpolación parcial dentro de strings
- la navegación anidada solo se permite bajo `queries.{queryName}.data`
- objetos y arrays pueden recorrerse de izquierda a derecha con una única semántica central
- `status`, `error`, `navigation.*`, `routeParams.*` y `params.*` no se abren como navegación dinámica soportada
- las referencias textuales no resolubles degradan a string vacío y mantienen diagnóstico de desarrollo coherente con la referencia original

## Comportamiento de errores
- Si `initialPage` no coincide con ninguna página declarada, el runtime muestra un error visible.
- Si un botón `navigateTo` apunta a una página inexistente, el runtime rechaza el config antes del render con una ruta diagnóstica del árbol afectado.
- Si el `layout` es inválido, usa el shape raíz antiguo basado en objeto o aparece un nodo no soportado, en desarrollo se muestra un error diagnóstico.
- Los errores estructurales mantienen los códigos públicos actuales y mejoran la trazabilidad con rutas canónicas del JSON cuando el fallo depende de una rama concreta.
- En producción, los errores marcados como `development-only` degradan a una superficie vacía en lugar de mostrar un mensaje genérico o inventar contenido.

## Límites actuales
- La navegación ya vive en estado compartido, pero todavía no existe una UI declarativa final para dispararla desde el árbol JSON.
- No existen todavía disparadores declarativos finales desde layout para lanzar operaciones de `api` fuera de los `preloads` de entrada.
- El estado compartido de formularios y queries ya existe, pero todavía no hay nodos visuales de formulario ni consumidores declarativos de datos remotos fuera de `heading.props.text`, `paragraph.props.text` y `queryStateFeedback`.
- El agregado `pageEntry` todavía no se expone como familia de referencias declarativas dentro del JSON.
- `routeParams.*`, `params.*` y `navigation.*` siguen sin resolverse como referencias soportadas.
- La presentación base del runtime sigue siendo intencionadamente mínima y no define todavía theming, tokens de diseño ni personalización visual declarativa.

## Referencias relacionadas
- [`./config-contract.md`](./config-contract.md)
- [`./pages-and-navigation.md`](./pages-and-navigation.md)
- [`./queries-and-feedback.md`](./queries-and-feedback.md)
- [`./forms-and-validation.md`](./forms-and-validation.md)
- [`./development-workflow.md`](./development-workflow.md)
