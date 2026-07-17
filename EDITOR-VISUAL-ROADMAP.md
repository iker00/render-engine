# Editor visual de configuración — roadmap

> Notas de la conversación de exploración (`explore-feature-scope`) sobre añadir una capa visual (drag-and-drop +
> formularios) al modo de desarrollo local, como alternativa al editor Monaco actual. No es un artefacto de
`ai-workflow/`; es un resumen de decisión para retomar el hilo más adelante.

## Motivación

Hoy, editar la configuración en desarrollo se hace con el editor Monaco del drawer de `DevRuntime` (JSON +
autocompletado vía JSON Schema derivado del schema Zod raíz). Funciona, pero implica escribir JSON a mano. La idea es
añadir una capa visual — edición directa sobre el preview renderizado más formularios de propiedades — para que
gestionar la configuración no dependa de tocar JSON directamente.

## Decisiones tomadas en la exploración

- **Alcance final**: cubrir todo el config (`layout`, `api`, `pages`, `preloads`, `tokens`, `translations`), pero *
  *secuenciado en varias features**, no como una sola entrega.
- **Audiencia**: developers. El objetivo es que el flujo habitual sea la UI, no JSON a mano — Monaco se mantiene como
  vía de escape para casos puntuales.
- **Relación con Monaco**: coexisten. El editor visual y Monaco son dos vistas del mismo estado, **sincronizadas en vivo
  ** (editar en una se refleja en la otra al instante).
- **Persistencia**: sin cambios respecto a hoy — solo memoria de sesión, sin escribir a disco. Para conservar el
  resultado se sigue usando el botón "Copiar" existente.
- **Formularios de propiedades**: derivados del mismo schema Zod que ya alimenta el autocompletado de Monaco (
  `runtimeConfigRootSchema` → `toJSONSchema`), para no duplicar el contrato.

## Feature 1 — mecánica de edición (revisado tras profundizar en `explore-feature-scope`)

La idea original de "árbol de layout con drag-and-drop" (un panel tipo *layers*, separado del preview, donde se
arrastran filas de una lista) **no es el modelo elegido**. En su lugar:

- **Manipulación directa sobre el propio preview renderizado**, estilo Webflow/Framer: se hace click/hover
  directamente sobre los nodos ya renderizados de la página activa para seleccionarlos, arrastrarlos o reanidarlos.
  No hay un panel de árbol/lista independiente del render.
- **Jerarquía visible vía breadcrumb de ancestros** del nodo seleccionado (no un panel de árbol aparte), para poder
  navegar y editar un `container`/`form` padre y no solo las hojas.
- **Contenedores vacíos con placeholder visible**: todo `container`/`form` sin `children` se renderiza en el canvas
  de edición con un placeholder (borde punteado), aunque en producción no muestre nada — así siempre hay un target
  de selección y de drop, incluso para empezar una página desde cero.
- **`repeater` con instancia representativa única**: el canvas muestra siempre 1 instancia de `props.template` (con
  datos mock si no hay datos reales disponibles). Esa instancia es la única unidad seleccionable/editable/anidable;
  no se editan instancias repetidas por separado.
- **Selector de página**: el canvas/preview edita una sola página a la vez (la activa); hace falta un selector para
  cambiar de página dentro de la feature 1. El alta/baja de páginas y `initialPage` sigue siendo la feature 3.
- **Paleta de nodos**: arrastrar tipos nuevos del catálogo directamente sobre el canvas para insertarlos.
- **Formulario de propiedades** por nodo seleccionado, igual que en la decisión general de arriba.

## Complejidad y riesgos identificados

- La manipulación directa sobre el render real es notablemente más compleja que un árbol tipo *layers*: hay que
  interceptar drag sobre cualquier nodo del catálogo sin romper su propio comportamiento (tablas con scroll interno,
  imágenes, repeaters), calcular zonas de drop contra el layout real (incluyendo el `span` responsive de
  `node.layout`), y mantener seleccionable un nodo aunque esté vacío o cambie de tamaño.
- `api`, `pages`, `tokens` y `translations` siguen siendo más bien CRUD de formularios/listas, no manipulación
  directa sobre un render — el patrón de esta feature 1 no se traslada tal cual a esas features siguientes.
- La elección de librería para el drag-and-drop ya **no está cerrada**: la nota original asumía `dnd-kit` porque
  partía de un árbol tipo lista (reordenar filas). Con manipulación directa sobre el preview, ese problema es
  distinto (drop zones calculadas contra layout real, no contra una lista), y puede que `dnd-kit` siga sirviendo o
  no sea el mejor fit. Queda como decisión explícita para `design.md`, con alternativas comparadas por escrito.
- Las referencias string (`queries.x`, `forms.x`, `params.x`, `{{...}}`) que atraviesan varios bloques del config
  necesitan pickers conscientes del contexto disponible, no solo campos de texto libre — si no, la UI no aporta frente a
  escribir JSON.
- La sincronización en vivo entre el canvas visual y el JSON de Monaco deja una pregunta abierta legítima para la
  spec de la feature 1: qué debe mostrar el canvas cuando el JSON de Monaco está momentáneamente inválido a mitad de
  edición. No bloquea escribir la spec; debe quedar como pregunta abierta explícita dentro de ella.
- Es un cambio transversal (`src/config/`, la UI del drawer, sincronización bidireccional, manipulación directa sobre
  contenido renderizado) con más de una estrategia técnica razonable → candidato claro a `requires_design: true` en
  `status.yaml` antes de planificar tareas. Dada la complejidad de la manipulación directa (frente a un árbol tipo
  lista), el riesgo se reevalúa de `medium` a **`high`**.

## Secuencia de implementación propuesta

1. **Edición visual directa del layout** — manipulación directa sobre el preview renderizado de la página activa
   (seleccionar, arrastrar/reanidar, insertar desde paleta), breadcrumb de jerarquía, placeholders para contenedores
   vacíos, instancia representativa única para `repeater`, selector de página, y formulario de propiedades por nodo
   seleccionado, sincronizado en vivo con Monaco. Base del patrón: reutilización del schema Zod para generar
   formularios, y la lógica de mutación/validación que reutilizarán las features siguientes.
2. **Editor visual de `api`** — CRUD de operaciones (`method`, `endpoint`, `query`, `body`, `headers`) mediante
   formularios, reutilizando los pickers de referencias que salgan de la feature 1 si aplica.
3. **Editor visual de `pages` / navegación** — alta, edición y borrado de páginas, `initialPage`, y su relación con el
   selector de página y el canvas de la feature 1.
4. **Editor visual de `tokens`** — gestión de tokens de autenticación declarados en el config.
5. **Editor visual de `translations`** — gestión de las entradas de `translations` usadas por las referencias
   `translations.*`.

Cada punto de la secuencia es candidato a su propia `spec.md` (y probablemente `tasks.md`); no se reserva número de
feature (`NNNN-feature-name`) hasta invocar `generate-feature-spec` sobre el punto correspondiente.

## Próximo paso

Invocar `generate-feature-spec` para el punto 1 (edición visual directa del layout), dejando explícita en la spec la
pregunta abierta sobre el comportamiento ante JSON temporalmente inválido en Monaco. Marcar `requires_design: true`
y `risk_level: high` en `status.yaml` dado el riesgo transversal y la complejidad de la manipulación directa
identificados arriba.
