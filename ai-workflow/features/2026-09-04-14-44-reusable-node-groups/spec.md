# Grupos de nodos reutilizables (`groups`)

## Objetivo
Permitir declarar un subárbol de nodos una única vez en la configuración y reutilizarlo desde varias páginas, con
contenido parametrizable (valores) y un hueco de contenido variable (slot), para evitar duplicar el mismo bloque de
UI (por ejemplo una tarjeta, una cabecera de sección o un bloque de acciones) en múltiples puntos del JSON.

## Alcance

### Bloque raíz `groups`
- Nuevo bloque opcional a nivel raíz del JSON, hermano de `api`/`pages`/`preloads`/`tokens`/`translations`/`shell`.
- `groups` es un objeto cuyas claves son `groupId` (string no vacío, único dentro de `groups`) y cuyos valores
  declaran:
  - `params`: array de nombres de parámetro (strings no vacíos, sin duplicados); puede ser `[]` si el grupo no
    necesita parametrizar valores.
  - `template`: colección ordenada de `LayoutNode[]`, mismo modelo que `repeater.props.template` o
    `container.children`. Puede incluir, como máximo una vez en todo el árbol del grupo, un nodo reservado
    `type: "slot"` (sin `props` ni `children` propios) que marca el punto donde se inserta el contenido que pase
    quien instancie el grupo.

### Nuevo nodo de catálogo `group`
- `props.groupId`: string obligatorio; debe existir como clave en el bloque raíz `groups`.
- `props.params`: objeto obligatorio si `groups.{groupId}.params` no está vacío; una clave por cada nombre
  declarado, con valor literal o referencia completa (misma convención que el resto del catálogo, por ejemplo
  `defaultValue` de campos o `image.props.src`).
- `children`: colección opcional de `LayoutNode[]`, interpretada como el contenido del `slot` del grupo. Solo válida
  si `groups.{groupId}.template` declara un nodo `slot`.
- `group` sigue la misma regla transversal que el resto del catálogo (excepto `hidden`): puede declarar
  `layout.span`, `visibility` y `queryStateFeedback`.
- `group` se añade a la lista de nodos cuyo `children` sí se interpreta (junto a `container`, `form`, `modal`,
  `link` y `accordion`).

### Nueva familia de referencia `group.*`
- `group.{paramName}` resuelve, dentro del `template` de una definición de grupo, el valor pasado en
  `props.params.{paramName}` por la instancia `group` que está expandiéndose en ese momento.
- **Decisión de naming**: no se reutiliza el namespace `params.*` ya existente para esto, porque `params.*` está
  reservado hoy a los parámetros de navegación (`navigateTo.params`, hidratación desde la URL) y reutilizarlo aquí
  produciría una colisión semántica real dentro del mismo template si conviven ambos usos. `group.*` es un
  namespace nuevo e independiente, con la misma forma (`group.{unSegmento}`) y el mismo catálogo de superficies que
  hoy tiene `params.*` (ver [[../../docs/app-features/references/reference-resolution.md]]).
- Fuera del `template` de una definición de grupo, `group.*` no forma parte del contrato soportado, igual que
  `item.*` fuera de un `repeater`.

### Resolución de referencias dentro de un grupo
- Cualquier referencia dentro de `groups.{groupId}.template` que **no** sea `group.*` (es decir, `queries.*`,
  `forms.*`, `item.*`, `row.*`, `t.*`, etc.) se resuelve exactamente igual que si ese subárbol estuviera escrito
  directamente en el punto donde se instancia el `group` — sin scope aislado ni reglas nuevas. Esto incluye el
  contenido pasado en `children` de la instancia (el slot): se autoría y resuelve con el mismo criterio que si
  estuviera escrito inline en la página o `repeater` que contiene la instancia.
- Consecuencia directa: un `group` instanciado dentro del `template` de un `repeater` puede pasar `item.*` del
  `repeater` como valor de cualquier `props.params`, y el contenido de su `children` (slot) también puede usar
  `item.*` de ese mismo `repeater` ancestro.

### Combinación con `repeater`
- No se añade ningún campo nuevo a `repeater`. Un nodo `group` es simplemente un nodo más dentro de
  `repeater.props.template`; sus `props.params` pueden referenciar `item.*` de la iteración igual que cualquier
  otro prop consumidor de referencias.

## Fuera de alcance
- **Anidamiento de grupos**: un `groups.{groupId}.template` que contiene un nodo `group` (referenciando otro grupo,
  o a sí mismo) no es un contrato soportado en esta v1; el config completo se rechaza antes del render. Se deja
  como ampliación futura si aparece una necesidad real (ver Riesgos).
- **Múltiples slots nombrados** por grupo: un grupo solo puede declarar un `slot`. Un `template` con más de un nodo
  `slot` rechaza el config completo.
- **Valores por defecto de parámetros**: `props.params` de una instancia debe cubrir exactamente los nombres
  declarados por el grupo, ni más ni menos (ver Requisitos funcionales); no existe mecanismo de valor por defecto
  en v1.
- **Uso de `group` dentro de `shell.header`/`shell.sidebar`**: el catálogo restringido de esas superficies
  (`link`/`button` en acciones de cabecera, `sidebarItem` en sidebar) no incorpora `group` en esta v1.
- **Edición visual con paridad total de drag-and-drop** dentro de la definición de un grupo (ver Requisitos no
  funcionales, soporte en `dev-editor`).
- No se modifica `ai-workflow/docs/context.md` desde esta feature (ver Riesgos).

## Requisitos funcionales
1. Un config que declara un `groupId` en `groups` y una instancia `{ type: "group", props: { groupId, params } }`
   en cualquier `layout` (de página, `container.children`, `repeater.props.template`, etc.) expande el `template`
   del grupo en ese punto, sustituyendo cada `{{group.paramName}}`/`group.paramName` por el valor correspondiente
   de `props.params`.
2. Dos o más instancias del mismo `groupId` con distintos `props.params` se resuelven de forma independiente; el
   estado de una instancia (formularios, queries, navegación) no se comparte por el hecho de compartir `groupId`.
3. El nodo `slot` del `template` de un grupo se sustituye por el `children` de la instancia. Una instancia sin
   `children` sobre un grupo con `slot` renderiza el slot vacío (mismo criterio que un `container` sin hijos).
4. Una instancia con `children` sobre un grupo cuyo `template` no declara `slot` rechaza el config completo antes
   del render.
5. Una instancia cuyo `props.params` omite algún nombre declarado por el grupo, o incluye nombres no declarados,
   rechaza el config completo antes del render.
6. Una instancia cuyo `props.groupId` no existe como clave de `groups` rechaza el config completo antes del
   render.
7. Un `groups.{groupId}.template` con más de un nodo `slot`, o con un nodo `group` anidado, rechaza el config
   completo antes del render.
8. `group.{paramName}` usado fuera del `template` de una definición de grupo no es una referencia soportada.
9. dev-editor: existe una vía de autoría para crear/renombrar/eliminar entradas de `groups`, declarar sus `params`
   y editar su `template`; y una vía para insertar una instancia `group` en el `layout` de una página, elegir su
   `groupId` y editar sus `props.params` y su `children` (slot) — ver Requisitos no funcionales para el nivel de
   soporte esperado en esta v1.

## Requisitos no funcionales
- La validación de `groups` y de instancias `group` se integra en el mismo pipeline de validación previa al
  render (`validateRuntimeConfig`); no existe un segundo mecanismo de validación paralelo.
- La resolución de `group.*` se integra en el mismo módulo central de referencias declarativas
  (`runtime-references/`); ningún nodo visual reimplementa esta navegación por su cuenta.
- **Soporte en `dev-editor` (v1 de esta feature)**: se resuelve con un nivel de soporte más ligero que la edición
  visual actual de `layout`, que hoy es manipulación directa sobre el render real de una página (ver
  [[../../docs/app-features/development/dev-mode-editor.md]]):
  - La gestión de `groups` (alta/baja/renombrado de `groupId`, alta/baja de `params`) vive en una pestaña de
    dominio nueva, con el mismo patrón de panel de formulario dedicado que ya usan `Api`/`Tokens`/`Traducciones`
    (fuera del modelo de canvas/selección de `Layout`).
  - La edición del `template` de un grupo reutiliza el mismo mecanismo de paleta de nodos + panel de propiedades
    generado desde schema que ya existe, pero renderizado sobre una vista de muestra del grupo (con valores mock
    para sus `group.*`, ya que en modo definición no hay una instancia real con `params` concretos) — mismo
    precedente conceptual que la "instancia representativa única" que ya usa el editor para `repeater`.
  - La inserción de una instancia `group` en el `layout` de una página se hace desde la misma paleta de nodos ya
    existente (con un selector del `groupId` disponible), y sus `props.params`/`children` se editan con el mismo
    panel de propiedades y el mismo mecanismo de arrastre sobre `children` que ya tiene `container`.
  - Esta es una decisión de alcance explícita de esta spec, no una confirmación literal previa del usuario sobre
    el nivel de detalle exacto; queda marcada en Riesgos para confirmación si no encaja con lo esperado.
- No debe introducir regresión en páginas que no declaran `groups` (bloque ausente se comporta igual que hoy).

## Criterios de aceptación
- [ ] Un grupo con un parámetro de texto y sin slot, instanciado dos veces con valores distintos en la misma
      página, renderiza ambos textos correctamente y de forma independiente.
- [ ] Un grupo con `slot`, instanciado con `children` distinto en dos puntos de la misma página, renderiza cada
      contenido en el punto correspondiente.
- [ ] Un grupo instanciado dentro de `repeater.props.template`, con un `props.params` que referencia `item.algo` y
      un `children` que también referencia `item.algo`, resuelve ambos contra el item de cada iteración.
- [ ] Una instancia con `props.params` incompleto o con claves extra rechaza el config completo antes del render,
      con ruta diagnóstica sobre la instancia concreta.
- [ ] Una instancia con `groupId` inexistente rechaza el config completo antes del render.
- [ ] Un `template` con dos nodos `slot`, o con un nodo `group` anidado, rechaza el config completo antes del
      render.
- [ ] Una instancia con `children` sobre un grupo sin `slot` rechaza el config completo antes del render.
- [ ] Desde `dev-editor`, crear un grupo, declarar un parámetro, insertar una instancia en una página, fijar su
      valor y aplicar, refleja el resultado en el preview y en el buffer de Monaco sin recargar.

## Casos límite
- Grupo con `params: []`: válido, solo aporta reutilización estructural sin valores parametrizados.
- Grupo con `template: []`: válido, la instancia no renderiza nada.
- Grupo sin ningún nodo `slot`: válido; cualquier instancia de ese grupo debe omitir `children` (ver Requisito
  funcional 4).
- Varias instancias del mismo grupo dentro de un mismo `repeater.props.template` (una por item): cada iteración
  resuelve sus propios `props.params`/`children` de forma independiente contra su propio `item.*`.
- Un `props.params` de una instancia usa `item.$key`/`item.$index`/`row.*` cuando la instancia vive en el contexto
  correspondiente: se resuelve con las mismas reglas ya vigentes para esos namespaces.
- `group.*` usado dentro de un `template` fuera de cualquier `slot`, en una superficie que no admite interpolación
  parcial (por ejemplo `visibility.reference`): sigue la misma frontera de superficies que hoy tiene `params.*`.

## Riesgos o preguntas abiertas
- **Tensión con la restricción de v1 de `context.md`**: `context.md` fija hoy que "la v1 es intencionadamente
  acotada: no busca resolver un motor UI completamente genérico". Un sistema de grupos parametrizables con slot y
  alcance global se acerca a ese terreno. El usuario ha indicado que esa restricción podría estar desactualizada y
  quiere revisarla, pero esa revisión queda **fuera de esta spec y no se hace desde aquí** — no se ha editado
  `context.md`. Si al revisarla se decide mantenerla tal cual, esta feature debería releerse contra esa
  restricción antes de planificar.
- **Nivel de soporte en `dev-editor`**: el Requisito no funcional correspondiente fija un nivel de soporte más
  ligero que la paridad completa de drag-and-drop del canvas actual, como decisión de alcance de esta spec. Si el
  usuario esperaba paridad completa (edición del `template` de un grupo con manipulación directa igual que una
  página), esto debe corregirse antes de pasar a `design.md`.
- **Anidamiento de grupos**: queda fuera de alcance v1 por simplicidad y para evitar ciclos; es una ampliación
  natural a evaluar en una feature futura si aparece un caso de uso real que lo requiera.

## Áreas de producto afectadas (alto nivel)
- Contrato de configuración (`config/`): nuevo bloque raíz `groups`.
- Catálogo de nodos (`nodes/`): nuevo nodo `group`, nuevo nodo reservado `slot`.
- Referencias y reactividad declarativa (`references/`): nueva familia `group.*`.
- Combinación con `repeater` (`nodes/repeater.md`): nota de uso sin cambio de contrato de `repeater`.
- Desarrollo local (`development/`): nueva sección de dev-editor para `groups`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config/structure.md` y `config/index.md`.
- `ai-workflow/docs/app-features/nodes/index.md` y nueva ficha `nodes/group.md`.
- `ai-workflow/docs/app-features/references/reference-resolution.md`.
- `ai-workflow/docs/app-features/nodes/repeater.md` (nota de combinación).
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
- `ai-workflow/docs/current-state.md` (si esta feature consolida el estado del área).
