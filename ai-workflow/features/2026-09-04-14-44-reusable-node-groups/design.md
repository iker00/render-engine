# Design: Feature 2026-09-04-14-44 - reusable-node-groups

## Contexto
La spec (`spec.md`) define un bloque raíz `groups` (subárboles `LayoutNode[]` parametrizables con un `slot`
opcional), un nodo de catálogo `group` que instancia esos subárboles, y una nueva familia de referencia `group.*`.
La spec fija explícitamente que la resolución de referencias dentro de `groups.{groupId}.template` **no** usa un
scope aislado: `queries.*`, `forms.*`, `item.*`, `row.*`, `t.*` se resuelven igual que si el subárbol estuviera
escrito inline en el punto de instanciación.

Esa decisión de la spec (sin scope aislado de *referencias*) deja abierta una pregunta distinta de arquitectura de
*estado*: `repeater.props.template` ya expande un subárbol compartido varias veces (una por item), y `modal.md`
documenta que el runtime ya resuelve la identidad de un `modal` con `id` literal repetido dentro de ese template
mediante un mecanismo de scoping implícito por contexto de iteración ("Comportamiento en `repeater.props.template`").
`forms/lifecycle.md`, en cambio, no documenta ningún mecanismo equivalente: el estado de formulario vive en un store
plano global `forms.{formId}.{fieldId}`, direccionado por el `id` literal del config. Como `groups.{groupId}.template`
se autoría una única vez y se expande en N puntos de instanciación, cualquier `form` declarado dentro de un `template`
colisiona por defecto entre instancias — igual que ya le pasaría hoy (sin documentar) a un `form` dentro de
`repeater.props.template`.

Esta pregunta se resolvió con el usuario antes de cerrar este design: **se generaliza el mecanismo de scoping que ya
usa `modal` para que también cubra `forms.*`**, en vez de restringir la instanciación múltiple en v1. Ver Decisión 5.

## Objetivos / No objetivos

### Objetivos
- Fijar el contrato de configuración y validación de `groups`/`group`/`slot`.
- Fijar dónde y cómo se resuelve `group.*` dentro del pipeline de referencias existente.
- Fijar el mecanismo de expansión de `template` en render, incluida la sustitución del `slot`.
- Fijar cómo se garantiza independencia de estado entre instancias del mismo `groupId` (formularios, `modal`,
  coordinación de `accordion.props.groupId`), incluyendo el fix de facto que esto supone para `repeater` + `form`.
- Fijar el nivel de soporte en `dev-editor` a nivel de arquitectura (nueva pestaña de dominio, reutilización del
  canvas existente contra un target parametrizable), sin descender a detalle de widget por widget.

### No objetivos
- No se resuelve aquí la tensión con la restricción de v1 de `context.md` (queda explícitamente fuera, ver spec).
- No se diseña anidamiento de `groups` (fuera de alcance v1 por spec).
- No se diseña un mecanismo de direccionamiento explícito cross-instancia (p. ej. "el form de la instancia #2");
  la resolución sigue siendo implícita por contexto ambiente, igual que `item.*` hoy.
- No se detalla aquí cada widget del panel de propiedades de `dev-editor`; eso es nivel de tarea, no de design.

## Decisiones

### 1. Contrato de configuración: bloque raíz `groups`, nodo `group`, nodo reservado `slot`
- **Elegido**: `groups` se añade como bloque raíz opcional en `runtime-config-zod.ts`/`runtime-config-types.ts`,
  hermano de `api`/`pages`/`tokens`/`translations`/`shell`. `group` y `slot` se añaden a la unión discriminada por
  `type` del catálogo de nodos (misma unión que ya usa `container`, `repeater`, etc.), no como un contrato paralelo.
- **Por qué**: reutiliza exactamente el mismo mecanismo estructural (`LayoutNode[]` recursivo) que ya usa
  `repeater.props.template`/`container.children`, en vez de introducir un segundo modelo de árbol.
- **Trade-off**: `slot` es un tipo de nodo del catálogo que solo es válido en una posición estructural concreta
  (dentro de `groups.{groupId}.template`), a diferencia del resto del catálogo, que es válido en cualquier
  colección de `LayoutNode[]`. Esto exige que el validador recursivo sea consciente de en qué contexto estructural
  se encuentra (ver Decisión 2), en vez de validar `slot` con una regla de shape aislada.
- **Riesgo residual**: ninguno relevante; es la extensión de catálogo más directa posible dado el precedente ya
  existente (`repeater.props.template`).

### 2. Validación: nuevo módulo `validate-groups.ts`, contexto `insideGroupTemplate` en el validador recursivo
- **Elegido**: un módulo nuevo `src/config/validate-groups.ts`, hermano de `validate-preloads`/`validate-api-config`/
  `validate-layout-nodes`/`validate-actions-visibility`/`validate-form-nodes`, invocado desde
  `validate-runtime-config.ts`. Cubre:
  - shape de `groups.{groupId}.params` (array de strings no vacíos, sin duplicados) y `groups.{groupId}.template`
    (reutiliza el validador recursivo de `validate-layout-nodes` con un flag `insideGroupTemplate: boolean` nuevo,
    que habilita `type: 'slot'` como discriminante válido — rechazado como `unsupported-node-type` fuera de ese
    contexto — y rechaza `type: 'group'` anidado dentro de un `template` con el mismo criterio que hoy usa
    `invalid-layout` para otras reglas estructurales cerradas).
  - recuento recursivo de nodos `slot` por definición de grupo (rechazo si > 1, a cualquier profundidad).
  - validación cruzada de cada instancia `group` encontrada en cualquier `layout` (de página, de `container.children`,
    de `repeater.props.template`, etc.): `props.groupId` existe en `groups`; `keys(props.params)` coincide
    exactamente con `groups[groupId].params`; `children` solo es válido si `groups[groupId].template` declara
    exactamente un `slot`.
- **Por qué vs. alternativa**: la alternativa era resolver `slot`/anidamiento con una regla de shape `Zod` aislada
  por posición en el árbol (schema distinto para `groups.*.template` que para el resto de colecciones
  `LayoutNode[]`). Se descarta porque duplicaría el schema recursivo completo del catálogo solo para una diferencia
  de una entrada (`slot` habilitado/`group` deshabilitado), divergiendo con el tiempo del schema principal cada vez
  que se añada un nodo nuevo al catálogo.
- **Trade-off**: el validador recursivo de `validate-layout-nodes` gana un parámetro de contexto que no tenía
  (hasta ahora era puramente estructural, sin más estado que la ruta diagnóstica). Es un cambio de firma interna,
  no de contrato público.
- **Riesgo residual**: ninguno relevante; sigue el mismo patrón "partido por dominio" que ya usa `src/config/`.

### 3. Resolución de `group.*`: namespace nuevo de un único segmento, mismas superficies que `params.*`
- **Elegido**: `group.{paramName}` se añade como namespace reconocido en `src/config/runtime-reference-syntax.ts`
  (contrato neutral de sintaxis) y se resuelve en `runtime-references/`. Admite exactamente un segmento tras el
  namespace (misma frontera que `params.*`, no navegación anidada como `item.*`) y se habilita en exactamente las
  mismas superficies que hoy tiene `params.*` (interpolables, `api.query/body`, `button.props.action.query/body`,
  `form.submitAction.query/body`, `visibility.reference`, `defaultValue` de campos), implementado extendiendo las
  mismas tablas/listas de superficies que ya comprueban `params`, no una tabla paralela.
- **Por qué**: es una decisión ya tomada explícitamente por la spec ("mismo catálogo de superficies que hoy tiene
  `params.*`"); el design solo fija el punto de integración concreto (extender, no duplicar, las tablas existentes)
  para evitar que ambas listas diverjan con el tiempo.
- **Trade-off**: ninguno relevante — es la opción de menor superficie de cambio.
- **Riesgo residual**: ninguno.

### 4. Expansión de `template` en render: contexto de grupo aditivo + slot como "portal"
- **Elegido**: `GroupLayoutNode` (nuevo, en `src/runtime/nodes/`) hace, en este orden, al renderizar una instancia
  `group`:
  1. Resuelve cada `props.params.{name}` contra el contexto ambiente en su propia posición del árbol (el mismo
     pipeline de resolución que usa cualquier otro nodo consumidor de referencias), obteniendo valores concretos.
  2. Renderiza `props.children` (el contenido del slot) usando ese mismo contexto ambiente, **antes** de entrar en
     ningún proveedor de contexto nuevo — así el slot nunca ve `group.*`, igual que si estuviera escrito inline en
     el punto de instanciación (requisito de la spec).
  3. Renderiza `groups[groupId].template` envuelto en un proveedor de contexto nuevo y aditivo (no sustituye el
     contexto de iteración de `item.*`/`row.*` ya existente, se añade a él) que expone los valores resueltos en (1)
     para la resolución de `group.*`.
  4. Cuando el recorrido del `template` llega al nodo reservado `slot`, un componente `SlotLayoutNode` mínimo
     renderiza el contenido ya capturado en (2) en vez de recursar sobre props/children propios (que `slot` no
     tiene).
- **Por qué**: reutiliza el mismo patrón de "contexto de renderizado ambiente aditivo" que ya usa el runtime para
  `item.*`/`row.*`, en vez de hacer una transformación estática previa del árbol (sustitución de placeholders antes
  de renderizar). Se descarta la transformación estática porque los valores de `props.params` pueden depender de
  estado reactivo (`item.*`, `forms.*`, `queries.*`) que cambia entre renders — habría que recalcular la
  transformación en cada cambio de estado igualmente, sin ganar nada frente a modelarlo como contexto de React.
- **Trade-off**: `group` y `slot` se conectan al dispatcher central como cualquier otro nodo (arquitectura.md), pero
  `slot` es un nodo "vacío" cuyo único rol es leer de un contexto — es una excepción menor al resto del catálogo,
  ya justificada por ser un nodo reservado, no de autoría libre.
- **Propiedad útil derivada de la Decisión 2**: como `groups.*.template` rechaza cualquier `group` anidado, el
  contexto de grupo (paso 3) nunca se anida más de un nivel en tiempo de render — no hace falta una pila, solo un
  valor de contexto sustituido, lo que simplifica la implementación frente a lo que sí necesita, por ejemplo, el
  contexto de iteración de `repeater` (que sí puede anidarse).
- **Riesgo residual**: ninguno nuevo más allá del ya cubierto por la Decisión 5 (ver abajo) para nodos con `id`
  direccionado globalmente dentro del `template`.

### 5. Estado por instancia: generalizar el scoping de `modal` a `forms.*` (y verificar `accordion.props.groupId`)
- **Elegido** (decisión tomada con el usuario): se generaliza el mecanismo que hoy usa `modal` para dar estado de
  apertura independiente por iteración de `repeater` para que cubra también `forms.{formId}.{fieldId}`, y se aplica
  igualmente cuando el subárbol repetido proviene de una instancia `group` (no solo de un `repeater`). Concretamente:
  - Se introduce un concepto compartido de **cadena de scope ambiente**: una lista ordenada (más interno primero) de
    tokens, uno por cada `repeater` ancestro activo (ya existe hoy, es la base del mecanismo de `modal`) más uno por
    cada instancia `group` ancestra activa (nuevo). El token de una instancia `group` se deriva de su posición
    estructural en el árbol renderizado (no requiere que el autor del config declare nada nuevo).
  - Un helper compartido nuevo (p. ej. `runtime-instance-scope.ts`, en la frontera de `runtime-references/` por ser
    un concepto de contexto ambiente análogo al de `item.*`) computa/expone esa cadena y resuelve un `id` literal
    (`formId`, `modalId`, `accordion.props.groupId`) contra ella para obtener la clave de store efectiva. Lo
    consumen: el dominio `forms` de `runtime-state/` (clave efectiva de `forms.{formId}.{fieldId}`), la resolución
    de `openModal`/`closeModal` en `runtime-actions/` (ya existente para `repeater`, ahora también para `group`), y
    la coordinación de `accordion.props.groupId`.
  - Con cadena de scope vacía (nodo fuera de todo `repeater`/`group`), la clave efectiva es idéntica a la de hoy —
    cero regresión en configs que no usan `repeater` con nodos con `id` repetido ni `groups`.
  - Una referencia externa a `forms.{formId}.{fieldId}` (o un `openModal`/`closeModal`) emitida desde fuera de toda
    cadena de scope que produjo una instancia con ese `id` se degrada a "no encontrado", con el mismo criterio de
    degradación ya vigente para referencias bien formadas sin dato disponible — no hay direccionamiento explícito
    cross-instancia (coherente con el No objetivo correspondiente).
- **Por qué vs. alternativas**: la alternativa más barata (restringir en v1 la instanciación de un `groupId` con
  `form` en su `template` a una sola vez por página, validado en bootstrap) se descartó explícitamente por el
  usuario a favor de esta, que no recorta el requisito funcional 2 de la spec y además corrige de facto una
  limitación ya existente y no documentada de `form` dentro de `repeater.props.template`.
- **Coste/trade-off asumido**: es la decisión de mayor superficie de cambio de todo el design — toca
  `runtime-state/` (dominio `forms`), `runtime-references/` (nueva cadena de scope ambiente), `runtime-actions/`
  (resolución de `openModal`/`closeModal`/`resetForm`) y los nodos `form`, `modal` y `accordion`. Es sensiblemente
  más grande que lo que la spec original daba a entender ("no scope aislado" hablaba de referencias, no de
  identidad de estado).
- **Recomendación de secuenciación para el plan**: tratar el scoping generalizado de `forms`/`modal`/`accordion`
  dentro de `repeater.props.template` como un incremento separable y testeable de forma independiente, previo a
  construir `groups` encima. Es en sí mismo un fix de un comportamiento no documentado hoy, con su propio contrato
  de tests, y reduce el riesgo de integración de la parte de `groups` al apoyarse en una base ya validada.
- **Riesgo residual**: `accordion.props.groupId` no se ha verificado contra el código (no hay doc equivalente a la
  sección "Comportamiento en `repeater.props.template`" de `modal.md` para `accordion`) — ver Preguntas abiertas.

### 6. `dev-editor`: nueva pestaña "Grupos", canvas existente sobre un target parametrizable
- **Elegido**: se añade `Grupos` como séptima pestaña de dominio (mismo patrón de barra que `Api`/`Tokens`), con:
  - Un panel de lista + CRUD (alta/baja/renombrado de `groupId`, alta/baja de `params`) siguiendo el mismo patrón
    de commit de clave raíz única (`commitGroupsMutation` parcheando solo `groups`) que ya usan
    `Shell`/`Traducciones`/`Api`/`Páginas`/`Tokens`.
  - Edición del `template` de un grupo reutilizando el mismo canvas (paleta + panel de propiedades generado desde
    schema) que ya edita `pages[activePage].layout`, pero retargeteado contra `groups.{groupId}.template` en vez de
    contra la página activa — exige generalizar el concepto de "raíz editable" del canvas (hoy implícitamente fijo a
    la página activa) a un target parametrizable, con el commit parcheando esa ruta en vez de `layout`.
  - Vista de muestra durante la edición del `template` con valores mock para `group.*` (no hay instancia real en
    modo definición), reutilizando el mismo proveedor de contexto de grupo de la Decisión 4 alimentado con valores
    placeholder en vez de resueltos contra estado en vivo — mismo precedente conceptual que la instancia única de
    muestra que ya usa `repeater` en modo Editor.
  - Autoría de una instancia `group` en `Layout`: se inserta desde la misma paleta de nodos ya existente, con un
    selector de `groupId` (deshabilitado con motivo explícito si `groups` está vacío, mismo criterio que el
    interruptor de refresco de `Tokens`); `props.params` se generan como campos de texto libre por cada
    `groups[groupId].params` (sin picker dedicado, coherente con el límite ya documentado de "sin pickers
    contextuales"); `children` (slot) se edita con el mismo mecanismo de arrastre que `container.children`, visible
    solo si el grupo elegido declara `slot`. Cambiar el `groupId` de una instancia reconstruye `props.params`/
    `children` desde cero (mismo criterio que el resto de selectores de variante del panel).
- **Por qué vs. alternativa**: la alternativa (construir un segundo árbol de edición específico para `groups`) se
  descarta porque duplicaría toda la maquinaria de paleta/panel de propiedades/reglas de drop ya existente, en
  contra del principio de extensión por dispatcher central que ya sigue el resto del catálogo.
- **Trade-off**: la generalización del canvas a un target parametrizable es un refactor interno real, cuyo alcance
  exacto depende de cuánto asume hoy la implementación actual que el root editable es siempre la página activa —
  no verificado contra el código en esta fase de design (ver Preguntas abiertas).
- **Riesgo residual**: alcance del refactor del canvas sin confirmar; nivel de soporte deliberadamente más ligero
  que la paridad completa de `Layout` (ya asumido y señalado como riesgo por la propia spec).

## Riesgos y trade-offs
- La Decisión 5 es, con diferencia, la de mayor riesgo de todo el design: cambia código compartido de
  `runtime-state/forms`, `runtime-references/` y `runtime-actions/` que hoy no tiene ningún test de "mismo `id`
  repetido en dos instancias" fuera del caso ya cubierto de `modal` en `repeater`. Mitigación propuesta: secuenciar
  como incremento independiente y testeable antes de construir `groups` (ver Decisión 5).
- El nivel de soporte de `dev-editor` es v1 deliberadamente ligero (ya señalado por la propia spec); el refactor
  del canvas a un target parametrizable es el único punto técnico de esa sección sin verificar contra el código.
- Tensión con la restricción de v1 de `context.md`: heredada de la spec, no resuelta aquí, sigue abierta.

## Migración o despliegue
- Cambio puramente aditivo en el contrato: `groups` es un bloque raíz opcional nuevo; ausencia de bloque se
  comporta igual que hoy. `group`/`slot` son tipos de nodo nuevos que no cambian el shape de ningún nodo existente.
- La generalización de la Decisión 5 debe preservar exactamente el comportamiento actual (mismas claves de store)
  cuando la cadena de scope ambiente está vacía — no hay migración de datos porque no hay estado persistido entre
  sesiones (`context.md`: el estado de formularios/queries es local al runtime, no persiste en disco).
- No hay bloque de datos histórico que migrar ni cambio de contrato observable en producción fuera de las
  superficies nuevas descritas.

## Preguntas abiertas
- **`accordion.props.groupId` sin verificar**: no hay documentación equivalente a la sección "Comportamiento en
  `repeater.props.template`" de `modal.md` para `accordion`. Antes de planificar la Decisión 5 en detalle, hay que
  confirmar contra `nodes/accordion.md` (y si hace falta, el código) si su coordinación ya es local-por-subárbol
  (como `modal`) o global-plana (como `forms.*` hasta ahora) para saber si necesita el mismo trabajo de
  generalización o ya es segura por construcción.
- **Alcance del refactor del canvas de `dev-editor`** a un target parametrizable (Decisión 6): no verificado contra
  la implementación actual. Confirmar durante la planificación cuánto asume hoy el código que el root editable es
  siempre `pages[activePage].layout`.
