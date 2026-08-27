# Spec: nodos de presentación pura permitidos dentro de `form`

## Objetivo
Permitir que los nodos de presentación pura `alert`, `badge`, `stat` y `skeleton` aparezcan como descendientes válidos de un `form`, en cualquier profundidad de su subárbol (hijos directos, anidados dentro de `container`/`accordion`/`tabs`, y dentro de `queryStateFeedback.states.*.fallback` de cualquier nodo que viva dentro de un `form`).

Hoy esa combinación rechaza el config completo, aunque los cuatro nodos son hoja pura, no tocan el store del formulario ni participan en su submit — la misma categoría de nodo que `heading`, `paragraph` o `image`, que ya están permitidos.

## Contexto
- La validación de `form.children` (`validateFormChildren`) se aplica de forma recursiva a todo el subárbol de un `form`, incluidas las colecciones `queryStateFeedback.states.*.fallback` de cualquier nodo dentro de ese subárbol, contra la lista cerrada `FORM_ALLOWED_DESCENDANT_TYPES`.
- Esa lista no se ha actualizado desde que se incorporaron `alert` (`0055`), `badge` (`0054`), `stat` (`0056`) y `skeleton` a un feature posterior; hoy solo cubre `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `fileInput`, `toggle`, `hidden`, `button`, `heading`, `paragraph`, `image`, `table`, `container`, `accordion`, `divider`, `tabs`.
- Caso especialmente relevante: `skeleton.md` documenta su uso primario como `queryStateFeedback.states.loading.fallback`. Ese uso falla hoy si el nodo que declara el feedback vive dentro de un `form` (por ejemplo, el propio `form` mostrando un skeleton mientras su submit está en curso).
- `map` y `link` quedan explícitamente fuera de esta feature: `map` tiene carga diferida y estado propio de marcadores; `link` no es puramente pasivo (declara acciones de navegación `navigateTo`/`goBack`).

## Alcance
- Añadir `alert`, `badge`, `stat` y `skeleton` a la lista de tipos de nodo permitidos como descendientes de `form`, en cualquier profundidad de su subárbol.
- Actualizar el mensaje de error de validación que enumera los tipos permitidos para que refleje la lista ampliada.
- Estos cuatro nodos ya declaran `queryStateFeedback` y `visibility` en su schema; ninguno requiere cambios de shape ni de props.
- El comportamiento de render de los cuatro nodos no cambia en ningún contexto (dentro o fuera de `form`): siguen siendo hoja pura, sin estado local, sin acciones, sin producir entradas en `state.forms[formId]` y sin participar en la validación ni en el payload de submit.

## Fuera de alcance
- `map` y `link` no se añaden a la lista de nodos permitidos dentro de `form` en esta feature.
- Cualquier cambio en el subconjunto de tipos permitidos en celdas ricas de `table` (`image`, `list`, `button`, `container`, `heading`, `paragraph`) queda fuera; es una restricción independiente y no se toca aquí.
- Cambios de props, validación de shape, render o comportamiento propio de `alert`, `badge`, `stat` o `skeleton` fuera del contexto de estar dentro de un `form`.
- Cambios en la semántica general de `queryStateFeedback` o `visibility`.
- Ampliar el catálogo de nodos permitidos en otros contextos restringidos del runtime que no sean `form` (por ejemplo, `repeater.props.template` ya no tiene esta restricción y no se ve afectado).

## Requisitos funcionales
1. Un `form` puede tener `alert`, `badge`, `stat` o `skeleton` como hijo directo de `form.children`.
2. Un `form` puede tener `alert`, `badge`, `stat` o `skeleton` anidado dentro de `container`, `accordion` o `tabs` que a su vez estén dentro del subárbol de un `form`, sin límite de profundidad de anidación.
3. Cualquier nodo dentro del subárbol de un `form` (incluido el propio `form`) puede usar `alert`, `badge`, `stat` o `skeleton` dentro de `queryStateFeedback.states.{estado}.fallback`.
4. El resto de reglas transversales de `form.children` no cambia: los tipos que hoy se rechazan (por ejemplo `map`, `link`, `repeater`, `modal`, `fileManager`) se siguen rechazando exactamente igual que antes.
5. El mensaje de error de validación para un tipo no permitido dentro de un `form` enumera la lista ampliada (incluyendo `alert`, `badge`, `stat` y `skeleton`), de forma que el mensaje sigue siendo veraz respecto al comportamiento real.
6. `alert`, `badge`, `stat` y `skeleton` dentro de un `form` no producen entradas en `state.forms[formId]`, no participan en la validación local del formulario y no aportan ni consumen claves en el payload de submit.

## Requisitos no funcionales
- No introduce cambios de shape en el schema Zod de configuración (`queryStateFeedback` y `visibility` ya estaban declarados en estos cuatro nodos).
- No degrada el comportamiento de configuraciones existentes: cualquier config que ya validaba con éxito antes de esta feature sigue validando exactamente igual.
- Mantiene el umbral mínimo global de cobertura de tests del 80% sobre `src/`.

## Criterios de aceptación
- Un config con `form.children` conteniendo directamente un `alert` (o `badge`, `stat`, `skeleton`) valida sin error y renderiza el nodo con su comportamiento estándar de nodo hoja.
- Un config con un `container` dentro de un `form`, y ese `container` conteniendo un `skeleton`, valida sin error.
- Un config con `form.queryStateFeedback.states.loading.fallback: [{ type: "skeleton", ... }]` valida sin error y muestra el skeleton mientras la query observada está en `loading`.
- Un config con `form.queryStateFeedback.states.error.fallback: [{ type: "alert", props: { type: "danger", message: "..." } }]` valida sin error y muestra el alert cuando la query observada está en `error`.
- Un config con un `tabs` dentro de un `form`, donde uno de los items del `tabs` contiene un `badge` o `stat`, valida sin error.
- Un config con `map` o `link` dentro de un `form` (directo o anidado) sigue rechazándose con el mismo error de validación que antes de esta feature.
- Un config con un tipo de nodo no soportado en absoluto (inventado) dentro de un `form` sigue rechazándose.
- El mensaje de error devuelto al rechazar un tipo no permitido dentro de un `form` incluye `alert`, `badge`, `stat` y `skeleton` en la enumeración de tipos permitidos.
- `alert`, `badge`, `stat` y `skeleton` dentro de un `form` (en cualquiera de los contextos anteriores) no aparecen en `state.forms[formId]` tras inicializar el formulario, ni bloquean el submit, ni el payload de submit incluye ninguna clave derivada de ellos.

## Casos límite
- `alert`/`badge`/`stat`/`skeleton` dentro de un `form` que además está dentro de un `repeater` con contexto `item.*`: deben resolver sus props (`message`, `title`, `label`, `value`, etc.) por iteración igual que ya hacen fuera de formularios, sin comportamiento especial por estar dentro de un `form`.
- `alert`/`badge`/`stat`/`skeleton` como fallback de `queryStateFeedback` en un nodo profundamente anidado dentro de varios `container`/`accordion`/`tabs` encadenados dentro de un `form`: deben validar igual que en el nivel más superficial, sin límite artificial de profundidad.
- Un `form` con `alert`/`badge`/`stat`/`skeleton` combinados con otros nodos ya permitidos (`heading`, `paragraph`, `divider`, etc.) como hermanos: no debe haber interacción especial entre ellos.
- Un `fallback` de `queryStateFeedback` que mezcla nodos permitidos y no permitidos (por ejemplo `[{ type: "alert" }, { type: "map" }]`) dentro de un `form`: el config completo se rechaza igual que hoy, señalando la ruta del nodo no permitido (`map`), sin que la presencia de `alert` en el mismo array afecte al resultado.

## Riesgos o preguntas abiertas
Ninguno. El alcance de nodos (`alert`, `badge`, `stat`, `skeleton`) y las exclusiones explícitas (`map`, `link`) ya se acordaron en la conversación de exploración previa a esta spec.
