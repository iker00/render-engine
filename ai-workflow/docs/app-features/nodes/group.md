> Cuándo leer: estructura de `group`, instanciación de templates reutilizables, `props.groupId`, `props.params`, resolución de `group.*`, combinación con `repeater`, independencia de instancias, manejo del `slot`.
> Tamaño: medio.
> Relacionados: [[../config/structure.md]], [[../references/reference-resolution.md]], [[repeater.md]].

# `group`

## Contrato (`props`)
- `props.groupId`: string obligatorio; debe existir como clave en el bloque raíz `groups`.
- `props.params`: objeto opcional. Cuando el template del grupo declara `params`, todos esos nombres deben estar presentes en `props.params` con valor literal o referencia soportada (misma convención que `defaultValue` de campos o `image.props.src`). Si el template declara `params: []`, `props.params` puede omitirse o ser `{}`.
- `children`: colección opcional de `LayoutNode[]`, interpretada como contenido del `slot` del template. Solo válida si `groups.{groupId}.template` declara un nodo `slot`.
- `group` sigue la misma regla transversal que el resto del catálogo: puede declarar `layout.span`, `visibility` y `queryStateFeedback`.

## Definición de grupo en el bloque raíz `groups`
Cada entrada del bloque raíz `groups` declara:
- `groupId`: string no vacío y único dentro de `groups`.
- `params`: array de nombres de parámetro (strings no vacíos, sin duplicados). Puede ser `[]` si el grupo no necesita parametrizar valores.
- `template`: array ordenado de `LayoutNode[]`, mismo modelo que `repeater.props.template` o `container.children`. Puede contener, como máximo una vez, un nodo reservado `type: "slot"` (sin `props` ni `children` propios) que marca el punto de inserción del contenido que pase quien instancie el grupo.

## Resolución de referencias dentro del template
Cualquier referencia dentro de `groups.{groupId}.template` que **no** sea `group.*` (es decir, `queries.*`, `forms.*`, `item.*`, `row.*`, `t.*`, `params.*`, etc.) se resuelve exactamente igual que si ese subárbol estuviera escrito directamente en el punto donde se instancia el `group` — sin scope aislado ni reglas nuevas. Esto incluye el contenido pasado en `children` de la instancia (el slot): se autoría y resuelve con el mismo criterio que si estuviera escrito inline en la página o `repeater` que contiene la instancia.

### Namespace `group.*`
- `group.{paramName}` resuelve, dentro del `template` de una definición de grupo, el valor pasado en `props.params.{paramName}` por la instancia `group` que está expandiéndose en ese momento.
- `group.*` no forma parte del contrato soportado fuera del `template` de una definición de grupo, igual que `item.*` fuera de un `repeater`.
- El namespace `group.*` es independiente de `params.*` reservado a parámetros de navegación, evitando colisión semántica cuando ambos coexisten en el mismo template.

### Combinación con `repeater`
Un nodo `group` instanciado dentro de `repeater.props.template` puede pasar `item.*` del `repeater` como valor de cualquier `props.params`, y el contenido de su `children` (slot) también puede usar `item.*` de ese mismo `repeater` ancestro. Cada iteración resuelve su `props.params` e `children` de forma independiente contra su propio `item.*`.

## Reglas de render
- Un config que declara un `groupId` en `groups` y una instancia `{ type: "group", props: { groupId, params } }` en cualquier `layout` expande el `template` del grupo en ese punto, sustituyendo cada `{{group.paramName}}` o `group.paramName` por el valor correspondiente de `props.params`.
- Dos o más instancias del mismo `groupId` con distintos `props.params` se resuelven de forma independiente; el estado de una instancia (formularios, queries, navegación) no se comparte por el hecho de compartir `groupId`.
- El nodo `slot` del `template` se sustituye por el `children` de la instancia. Una instancia sin `children` sobre un grupo con `slot` renderiza el slot vacío (mismo criterio que un `container` sin hijos).
- Una instancia cuyo `groupId` no existe como clave de `groups` rechaza el config completo antes del render.

## Validación específica
- Si un `group` omite `props.groupId`, el config completo se rechaza antes del render.
- Si `group.props.params` omite algún nombre declarado por `groups.{groupId}.params`, o incluye nombres no declarados, el config completo se rechaza antes del render.
- Una instancia con `children` sobre un grupo cuyo `template` no declara `slot` rechaza el config completo.
- Un `groups.{groupId}.template` con más de un nodo `slot`, o con un nodo `group` anidado, rechaza el config completo.
- `group.{paramName}` usado fuera del `template` de una definición de grupo no es una referencia soportada y degrada a string vacío en superficies textuales.

## Límites del nodo
- El anidamiento de grupos (un `groups.{groupId}.template` que contiene un nodo `group`) no es un contrato soportado en esta v1.
- Un grupo solo puede declarar un `slot`.
- Valores por defecto de parámetros no existen en v1; `props.params` debe cubrir exactamente los nombres declarados, ni más ni menos.
- No se soporta el uso de `group` dentro de `shell.header` o `shell.sidebar`.
- Edición visual con paridad completa de drag-and-drop dentro de la definición de un grupo es limitada en esta v1 (ver [[../development/dev-mode-editor.md#Sección-Grupos-dominio-de-configuración]]).
