# 0092 — Repeater: literal reservado `$index` para key e índice de iteración

## Objetivo
Permitir que el nodo `repeater` use el índice numérico de iteración como React key mediante el literal reservado `"$index"` en `props.items.key`, y exponer `item.$index` como propiedad sintética dentro del subárbol iterado. Esto desbloquea la iteración de arrays de valores primitivos (strings, números) que hoy no pueden recorrerse con `repeater` porque no existe forma de extraer una key única de cada elemento.

## Alcance
- Nuevo valor reservado `"$index"` en `repeater.props.items.key`: indica "usa el índice numérico de iteración (0, 1, 2…) como React key".
- Funciona tanto con fuentes array como con fuentes objeto plano. En ambos casos el índice es la posición ordinal dentro de la secuencia iterada.
- Nueva propiedad sintética `item.$index` disponible dentro del subárbol iterado de cualquier `repeater`, independientemente del valor de `props.items.key`. Expone el índice numérico de la iteración actual como número.
- `item.$index` está disponible tanto con fuentes array como con fuentes objeto plano.
- No hay detección de duplicados cuando `key` es `"$index"` porque los índices son inherentemente únicos.
- Reutilización de toda la maquinaria existente del repeater: `props.template`, paginación local con variantes `previousNext` / `numbered` / `scroll`, estado independiente por instancia, reset ante cambio de colección, integración con `pageEntry`, formularios, requests y navegación.

## Fuera de alcance
- Exponer `item.$index` fuera del subárbol de un `repeater`. Fuera de ese contexto, `item.$index` no forma parte del contrato soportado y degrada según la política actual (string vacío en superficies textuales).
- Usar `$index` en otros consumidores de colecciones (`list`, `select`, `radioGroup`, `checkboxGroup`). Esta feature toca solo `repeater`.
- Cualquier DSL de transformación, filtrado, ordenación o proyección sobre la colección resuelta.
- Paginación remota, cursores, filtros cliente, fuentes ajenas a `queries.*`.
- Cambiar la semántica de `$key` ni del resto del contrato existente del repeater.

## Requisitos funcionales

### Literal `"$index"` en `props.items.key`
- `repeater.props.items.key` acepta el literal reservado `"$index"` además del literal `"$key"` y de las rutas relativas convencionales.
- Cuando `key` es `"$index"` y la fuente resuelta es un array, cada elemento recibe como React key su índice numérico dentro del array (0, 1, 2…).
- Cuando `key` es `"$index"` y la fuente resuelta es un objeto plano, cada entrada recibe como React key su posición ordinal dentro del orden natural de iteración del objeto (0, 1, 2…).
- No se aplica detección de duplicados cuando `key` es `"$index"`, dado que los índices son inherentemente únicos dentro de una colección.
- Entradas cuyo valor es `null`, `undefined` o un primitivo se iteran normalmente cuando `key` es `"$index"`; el índice sigue siendo válido independientemente del contenido del elemento.

### Propiedad sintética `item.$index`
- `item.$index` es una referencia sintética disponible dentro del subárbol iterado de cualquier `repeater`, con independencia del valor de `props.items.key`.
- Expone el índice numérico (0, 1, 2…) de la iteración actual como número.
- Funciona tanto con fuentes array como con fuentes objeto plano.
- `item.$index` tiene precedencia sobre cualquier propiedad literal `$index` que pudiera existir dentro del valor del item, de forma análoga a la precedencia de `item.$key` sobre propiedades literales `$key`.
- Las superficies donde `item.$index` es utilizable son las mismas donde hoy es utilizable `item.$key` e `item.*`: superficies visibles interpolables, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `button.props.action.params`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`, `defaultValue` de campos, `visibility.reference`, y como `source` anidado de los consumidores de colecciones.
- `item.$index` fuera del subárbol de un `repeater` no forma parte del contrato soportado y degrada a string vacío en superficies textuales, igual que `item.*` fuera de un `repeater`.

### Paginación e integración
- La paginación local del repeater opera de forma idéntica cuando `key` es `"$index"`. Los índices asignados corresponden a la posición dentro de la colección completa filtrada, no a la posición dentro de la página visible.
- El reset de página activa o ventana visible ante cambio de la colección resuelta, `pageSize` o variante de controles se mantiene sin cambios.
- La integración con `pageEntry`, formularios anidados, requests declarativos y navegación dentro del subárbol iterado no cambia.

## Requisitos no funcionales
- La feature no altera el comportamiento observable del repeater cuando `key` no es `"$index"`. Todos los configs actuales siguen funcionando sin cambios.
- El nuevo soporte se valida con tests unitarios y de runtime, manteniendo el umbral mínimo global de cobertura del 80% sobre `src/`.
- La documentación funcional afectada se actualiza para reflejar el nuevo contrato.

## Criterios de aceptación
- Un `repeater` con `key: "$index"` sobre un array de strings (`["a", "b", "c"]`) renderiza tres expansiones del template con React keys 0, 1 y 2.
- Un `repeater` con `key: "$index"` sobre un array de objetos renderiza una expansión por elemento con el índice como React key.
- Un `repeater` con `key: "$index"` sobre un objeto plano renderiza una expansión por entrada con la posición ordinal como React key.
- Un `repeater` con `key: "$index"` sobre un array donde algún elemento es `null` o un primitivo renderiza la iteración normalmente sin omitir entradas.
- Dentro del subárbol iterado, `{{item.$index}}` muestra el índice numérico de la iteración actual, independientemente del valor de `props.items.key`.
- `item.$index` funciona tanto con fuentes array como con fuentes objeto plano.
- Un `repeater` con `key: "id"` (no `$index`) sigue exponiendo `item.$index` como referencia sintética utilizable en el template.
- Un `repeater` cuya fuente resuelve a `null`, `undefined`, un primitivo o una colección vacía renderiza cero iteraciones sin errores.
- Un `repeater` paginado con `key: "$index"` aplica `pageSize`, navega entre páginas y reinicia su estado local al cambiar la colección de la misma forma que con otros valores de key.
- Un config existente que usa `key: "id"` o `key: "$key"` sigue produciendo el mismo render que antes de la feature.
- La validación de configuración acepta `"$index"` como valor válido en `repeater.props.items.key` y lo rechaza en rutas que no sean literales reservados válidos (por ejemplo `"$index.algo"` sigue siendo inválido).

## Casos límite
- Array de strings con valores duplicados (`["a", "a", "b"]`): con `key: "$index"` funciona correctamente porque los índices (0, 1, 2) son únicos, a diferencia de lo que pasaría con un hipotético `key: "item"`.
- Item cuyo valor contiene una propiedad literal `$index`: `item.$index` devuelve siempre el índice numérico de iteración, nunca la propiedad interna del valor. La propiedad sintética tiene precedencia.
- Array vacío o objeto vacío: cero iteraciones de forma silenciosa, sin diagnóstico, igual que hoy.
- Cambio de fuente entre array y objeto entre renders: el repeater resetea su estado local como con cualquier cambio de colección resuelta; `item.$index` sigue exponiéndose correctamente con el nuevo shape.
- Repeater anidado: cada nivel de repeater expone su propio `item.$index` en su contexto de iteración. El `$index` del repeater interior no sobreescribe el del exterior salvo en su propio subárbol, siguiendo la misma semántica que `item.*`.

## Riesgos o preguntas abiertas
- **Trade-off aceptado**: las React keys basadas en índice pueden causar problemas de reconciliación si el array cambia de orden entre renders. Es aceptable para los casos de uso previstos (datos estáticos, append-only, o arrays de primitivos donde no hay alternativa mejor).

## Áreas de producto afectadas a alto nivel
- Catálogo de nodos: `repeater`.
- Resolución de referencias: nueva propiedad sintética `item.$index` dentro del subárbol iterado.
- Validación de configuración: ampliación del contrato de `repeater.props.items.key` para admitir el literal reservado `"$index"`.

## Documentación probablemente afectada a alto nivel
- `ai-workflow/docs/app-features/nodes/repeater.md`
- `ai-workflow/docs/app-features/references/reference-resolution.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/features/index.md`
