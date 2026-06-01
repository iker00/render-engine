# 0045 — Repeater: iteración sobre propiedades de un objeto

## Objetivo
Permitir que el nodo `repeater` itere sobre las entradas de un objeto plano resuelto desde `queries.*`, además de sobre arrays como hace hoy. El template debe poder leer tanto el valor de cada entrada como su clave del diccionario, manteniendo la simplicidad declarativa actual y sin abrir paginación remota, filtros cliente ni un DSL de transformación.

El caso de uso real motiva esta extensión: respuestas legacy donde una sección como `resultados` llega como diccionario indexado por id de fuente (`vinfopol`, `bites`, `multas`, `ade`, `camaras`, `fichero-intercambio`, `circulacion`) y cada valor tiene la misma forma. Hoy el repeater no puede recorrer esa estructura y obliga a reescribir el contrato JSON con un array por fuente.

## Alcance
- Detección automática del shape de la fuente resuelta en `repeater.props.items.source`: si es array, comportamiento actual; si es objeto plano, iteración por entradas en orden natural de inserción.
- Nueva propiedad sintética `item.$key` disponible dentro del subárbol iterado cuando la fuente resuelta es objeto. Expone la clave del diccionario de la entrada actual como string.
- Nuevo valor reservado soportado en `repeater.props.items.key`: el literal `"$key"` indica "usa la clave del diccionario como React key". Cualquier otra ruta sigue navegando dentro del valor de la entrada como hoy navega dentro del item del array.
- Reutilización de toda la maquinaria existente del repeater: `props.template`, paginación local con variantes `previousNext` / `numbered` / `scroll`, estado independiente por instancia, reset ante cambio de colección resuelta / `pageSize` / variante de controles, integración con `pageEntry`, formularios, requests y navegación.
- Degradación segura cuando la fuente resuelta no es ni array ni objeto plano iterable: cero iteraciones, igual que hoy.

## Fuera de alcance
- Cualquier DSL de transformación, filtrado, ordenación o proyección sobre la colección resuelta (sigue siendo responsabilidad del backend).
- Reordenar las entradas del objeto por ningún criterio distinto del orden natural de inserción que entrega `Object.keys` sobre el dato runtime.
- Soportar `Map`, `Set` u otras estructuras iterables ajenas al JSON plano. Solo array y objeto plano JSON.
- Exponer `item.$key` cuando la fuente es array. En el caso array, `item.$key` no forma parte del contrato y se trata como ruta no soportada (degrada a string vacío en superficies textuales, igual que cualquier referencia sin valor).
- Exponer una propiedad sintética para el índice numérico de array (`item.$index` o equivalente). Queda fuera de esta feature; si en el futuro se necesita, se abre como alcance propio.
- Paginación remota, cursores, filtros cliente, fuentes ajenas a `queries.*`. Sin cambios respecto al estado vigente.
- Cambios en otros consumidores de colecciones (`list`, `select`, `radioGroup`, `checkboxGroup`). Esta feature toca solo `repeater`.

## Requisitos funcionales

### Detección y orden
- Cuando `repeater.props.items.source` resuelve a un array, el comportamiento es exactamente el actual.
- Cuando `repeater.props.items.source` resuelve a un objeto plano (no array, no `null`), el repeater itera sus entradas propias en el orden natural devuelto por el runtime al recorrerlas.
- Cuando `repeater.props.items.source` resuelve a `null`, `undefined`, un primitivo o cualquier otro valor no iterable según los dos shapes anteriores, el repeater renderiza cero iteraciones igual que hoy.
- Una colección objeto vacía (`{}`) renderiza cero iteraciones de forma silenciosa, sin emitir diagnóstico específico de desarrollo, exactamente igual que un array vacío hoy.

### Clave React por entrada
- `repeater.props.items.key` sigue siendo obligatoria en el contrato.
- El literal `"$key"` pasa a ser un valor reservado y soportado en `repeater.props.items.key`.
- Cuando `repeater.props.items.key` es `"$key"` y la fuente resuelta es objeto, la clave React de cada entrada es la propia clave del diccionario.
- Cuando `repeater.props.items.key` es `"$key"` y la fuente resuelta es array, no existe clave válida por entrada y todas las iteraciones se omiten siguiendo la política actual de keys ausentes; en desarrollo se emite el diagnóstico ya existente para keys efectivas no válidas.
- Cuando `repeater.props.items.key` es una ruta relativa convencional (por ejemplo `id` o `fuente.id`) y la fuente resuelta es objeto, la ruta se navega dentro del valor de la entrada. Esto permite usar un identificador interno estable del valor como React key cuando exista, en lugar de la clave del diccionario.
- La política actual de keys efectivas ausentes, no escalares o duplicadas se mantiene sin cambios: las entradas afectadas se omiten y se emite el diagnóstico en desarrollo ya existente.

### Acceso a la entrada desde el template
- Dentro del subárbol iterado, `item` y `item.{ruta}` siguen apuntando al valor de la entrada actual (el elemento del array o el valor del diccionario).
- `item.$key` está disponible como referencia válida solo cuando la fuente resuelta es objeto, y expone la clave del diccionario como string. Es legible desde las mismas superficies donde hoy es legible `item.*`: superficies visibles interpolables, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `button.props.action.params`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`, `defaultValue` de campos, `visibility.reference`, y como `source` anidado de los consumidores de colecciones (`repeater`, `list`, `select`, `radioGroup`, `checkboxGroup`).
- `item.$key` fuera del subárbol de un `repeater` que itera un objeto no forma parte del contrato soportado, igual que `item.*` no forma parte del contrato fuera de un `repeater`.

### Paginación e integración
- La paginación local del repeater opera de forma idéntica sobre la lista de entradas filtradas por key válida y única, sea la fuente array u objeto. El orden visible respeta el orden natural de iteración del objeto.
- El reset de página activa o ventana visible ante cambio de la colección resuelta, `pageSize` o variante de controles se mantiene, también cuando la fuente es objeto.
- La integración con `pageEntry`, formularios anidados, requests declarativos (`button.props.action`, `form.submitAction`) y navegación dentro del subárbol iterado no cambia.

## Requisitos no funcionales
- La feature no altera el comportamiento observable del repeater cuando la fuente resuelve a array. Todos los configs actuales siguen funcionando sin cambios.
- La detección array/objeto vive en la capa de runtime que ya resuelve la fuente del repeater; no se introducen parsers locales en nodos visuales ni se duplica lógica de referencias.
- El nuevo soporte se valida con tests unitarios y de runtime, manteniendo el umbral mínimo global de cobertura del 80% sobre `src/`.
- La documentación funcional afectada se actualiza para reflejar el nuevo contrato (`repeater.md` y `reference-resolution.md`).

## Criterios de aceptación
- Un `repeater` cuya fuente resuelve a un objeto plano con N claves propias renderiza exactamente N expansiones de su `template` en el orden natural de iteración del objeto.
- Un `repeater` con `props.items.key: "$key"` sobre una fuente objeto usa cada clave del diccionario como React key, y las entradas con clave duplicada (imposible en un objeto plano pero verificable como caso límite) o no escalar se omiten con el diagnóstico actual en desarrollo.
- Un `repeater` con `props.items.key: "fuente.id"` sobre una fuente objeto navega `fuente.id` dentro del valor de cada entrada y la usa como React key; las entradas cuyo valor no tenga `fuente.id` se omiten siguiendo la política actual.
- Un `repeater` con `props.items.key: "$key"` sobre una fuente array omite todas sus iteraciones y emite el diagnóstico actual de keys no válidas en desarrollo.
- Dentro del subárbol iterado por una fuente objeto, una superficie textual que interpola `{{item.$key}}` muestra la clave de la entrada actual; con `item.{ruta}` navega dentro del valor de la entrada como hasta ahora.
- Un `repeater` cuya fuente resuelve a `null`, `undefined`, un número, un string o `{}` renderiza cero iteraciones sin lanzar errores ni romper el resto del layout.
- Un `repeater` paginado con fuente objeto aplica `pageSize`, navega entre páginas y reinicia su estado local al cambiar la colección resuelta de la misma forma que con fuente array.
- Un config existente que iteraba un array sigue produciendo el mismo render, las mismas keys y los mismos diagnósticos que antes de la feature.

## Casos límite
- Objeto con claves que se solapan con propiedades especiales del propio valor (por ejemplo una entrada cuyo valor incluye una propiedad `$key` literal): `item.$key` siempre devuelve la clave del diccionario, nunca la propiedad interna del valor, dado que la propiedad sintética se resuelve antes que la navegación dentro del valor.
- Objeto donde algún valor es `null` o un primitivo: la entrada se itera igualmente; `item` expone ese valor pero las superficies textuales y consumidores que esperen un objeto se degradan según su política actual.
- Objeto con propiedades heredadas o no enumerables: solo se iteran las claves propias y enumerables del objeto resuelto, equivalentes a `Object.keys`.
- Fuente que resuelve a un array que contiene elementos no objeto (por ejemplo `["a", "b"]`): comportamiento actual sin cambios; `item.$key` no aplica.
- `props.items.source` apuntando a `queries.{queryName}.data.{ruta}` donde la ruta termina en un objeto en lugar de un array: la nueva semántica de iteración por entradas se activa de forma natural.
- Cambio de la fuente resuelta entre array y objeto a lo largo del tiempo (por ejemplo, una reejecución de la query devuelve otra forma): el repeater paginado resetea su estado local como con cualquier cambio de colección resuelta.

## Riesgos o preguntas abiertas
- Ninguna abierta. Las decisiones de producto y la superficie del contrato quedan cerradas en esta spec. Quedan para `generate-feature-design`/`generate-implementation-plan` las decisiones técnicas concretas: dónde exactamente vive la detección array/objeto, cómo se modela la propiedad sintética `item.$key` dentro de `runtime-references/`, y cómo se preserva la simetría de validación de `props.items.key` con el nuevo valor reservado `"$key"`.

## Áreas de producto afectadas a alto nivel
- Catálogo de nodos: `repeater`.
- Resolución de referencias: nueva propiedad sintética `item.$key` dentro del subárbol iterado de un `repeater` con fuente objeto.
- Validación de configuración: ampliación del contrato de `repeater.props.items.key` para admitir el literal reservado `"$key"`.

## Documentación probablemente afectada a alto nivel
- `ai-workflow/docs/app-features/nodes/repeater.md`
- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/current-state.md` si el área "Catálogo de nodos" cambia su última feature relevante.
- `ai-workflow/features/index.md` para registrar la nueva feature.
