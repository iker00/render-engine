# Spec: Array contains visibility operator

## Objetivo

Añadir un nuevo operador `arrayContains` al shape compartido de condiciones que usa hoy `visibility`
(`references/visibility.md`) y que se reutiliza en `submitAction.onSuccess[*].when`, `pages[].preloads[*].when` y
`operations[*].when` (button y form). El operador permite comprobar si un array resuelto por `reference` contiene
un elemento que coincide con `value`, ya sea comparando el elemento completo (arrays de valores primitivos) o un
campo concreto de cada elemento vía el nuevo campo `itemField` (arrays de objetos).

Hoy el catálogo de operadores (`equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan`) no permite
expresar "¿existe algún elemento del array cuyo campo X sea igual a Y?" — el caso motivador es comprobar si un
array de permisos como `[{"code": "1-1"}, {"code": "1-2"}, {"code": "3-1"}]` contiene un elemento con
`code: "3-1"`.

## Alcance

- Nuevo valor de operador `arrayContains` añadido al catálogo existente de condición simple, disponible en los 4
  contextos que reutilizan el shape documentados en `references/visibility.md`.
- Nuevo campo opcional `itemField` en la condición simple, solo válido cuando `operator: "arrayContains"`.
  - Presente: string que admite segmentos anidados con notación de punto (ej. `"user.code"`), análoga a la ya
    soportada por `item.*` y `queries.*.data.*`. Se resuelve dentro de cada elemento del array.
  - Ausente: cada elemento del array se compara íntegramente contra `value` (soporta arrays de primitivos).
- `value` obligatorio para `arrayContains`, restringido a literal escalar (`string | number | boolean | null`),
  igual que `equals`/`notEquals`.
- Semántica de coincidencia: `arrayContains` coincide si **al menos un elemento** del array (o su `itemField`, si
  se declara) es estrictamente igual a `value`.
- Degradación cuando `reference` no resuelve a un array (objeto no-array, string, número, booleano, `null`, o
  ausente): no coincide, sin coerciones implícitas — mismo criterio que ya aplican `greaterThan`/`lessThan`.
- Degradación por elemento cuando `itemField` está declarado pero un elemento concreto no lo resuelve (el elemento
  no es un objeto, o falta el segmento): ese elemento se ignora y no aporta coincidencia, sin invalidar la
  evaluación del resto del array.
- `negate` soportado con la misma semántica que el resto de operadores.
- Participación en grupos `and`/`or` como cualquier otra condición simple.
- Validación de shape que rechace el config completo antes del render cuando:
  - `operator: "arrayContains"` y falta `value`.
  - `value` no es un literal escalar soportado.
  - `itemField` está presente pero no es un string.
  - `itemField` está presente en una condición cuyo `operator` no es `arrayContains`.
  - `negate` está presente y no es booleano (regla ya existente, se mantiene igual para este operador).

## Fuera de alcance

- Cualquier cambio en los operadores existentes (`equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`,
  `lessThan`) o en su comportamiento y validación actuales.
- Soporte de anidamiento de grupos (`visibility.conditions` con grupos dentro de grupos) — sigue sin soportarse.
- Extender la sintaxis general de referencias runtime (por ejemplo, wildcards tipo `permissions[]` dentro de
  `reference`); `itemField` es un campo propio de la condición, no una ampliación del lenguaje de referencias.
- Comparaciones distintas a igualdad estricta dentro del array (por ejemplo, "algún elemento mayor que N"); solo
  se cubre coincidencia por igualdad exacta de literal escalar.
- Cualquier UI de edición visual (dev editor) para construir condiciones `arrayContains`.
- Reportar qué posición del array coincidió; el resultado de la condición sigue siendo booleano.

## Requisitos funcionales

1. El catálogo de operadores válidos para una condición simple incluye `arrayContains` en `visibility`,
   `submitAction.onSuccess[*].when`, `pages[].preloads[*].when` y `operations[*].when` (button y form).
2. Una condición `{ reference, operator: "arrayContains", value, itemField? }` coincide cuando `reference` resuelve
   a un array y al menos uno de sus elementos (o el campo `itemField` de al menos uno de ellos, si se declara) es
   estrictamente igual a `value`.
3. Si `itemField` no se declara, la comparación se hace contra el elemento completo del array (soporta arrays de
   valores primitivos, ej. `["a", "b", "c"]`).
4. Si `itemField` se declara, se resuelve como ruta de segmentos anidados dentro de cada elemento objeto del array
   (ej. `itemField: "user.code"` navega `item.user.code` para cada `item`).
5. Si `reference` no resuelve a un array, la condición no coincide (no lanza error de render).
6. Un elemento del array cuyo `itemField` no resuelve a un valor comparable (elemento no objeto, o falta el
   segmento) se ignora para ese elemento sin invalidar la evaluación del resto del array.
7. `negate: true` invierte el resultado de `arrayContains`, igual que ya ocurre con el resto de operadores
   (incluyendo el caso de "no coincide" que pasa a "coincide").
8. `arrayContains` participa en grupos `and`/`or` exactamente igual que cualquier otra condición simple soportada
   hoy.
9. El shape de validación existente se extiende: `value` es obligatorio y debe ser literal escalar soportado;
   `itemField`, si está presente, debe ser string; `itemField` solo es válido cuando `operator` es `arrayContains`
   (declararlo junto a otro operador rechaza el config).

## Requisitos no funcionales

- Ningún operador ni comportamiento existente de `visibility` cambia como efecto secundario de esta feature
  (retrocompatibilidad total con condiciones ya declaradas).
- La cobertura global de tests se mantiene en el umbral mínimo del 80% sobre `src/`.
- Los mensajes de rechazo de shape para `arrayContains` siguen el mismo estilo y ruta exacta (`path.operator`,
  `path.value`, `path.itemField`) que los operadores existentes, para mantener consistencia de diagnóstico.

## Criterios de aceptación

1. Dado `{"permissions": [{"code": "1-1"}, {"code": "1-2"}, {"code": "2-2"}, {"code": "3-1"}]}` proyectado en
   `queries.x.data.permissions`, una condición `{ reference: "queries.x.data.permissions", operator:
   "arrayContains", itemField: "code", value: "3-1" }` coincide (nodo visible); con `value: "9-9"` no coincide.
2. Dado `queries.x.data.tags` resuelto como `["a", "b", "c"]`, una condición `{ reference: "queries.x.data.tags",
   operator: "arrayContains", value: "b" }` (sin `itemField`) coincide; con `value: "z"` no coincide.
3. Dado `queries.x.data.permissions` resuelto como objeto no-array, string, `null` o ausente, `arrayContains` no
   coincide en ningún caso, sin lanzar error de render.
4. Una condición `{ operator: "arrayContains", itemField: "code" }` sin `value` rechaza el config completo antes
   del render.
5. Una condición `{ operator: "arrayContains", value: { nested: true } }` (objeto, no literal escalar) rechaza el
   config completo.
6. Una condición `{ operator: "arrayContains", value: "3-1", itemField: 123 }` (`itemField` no string) rechaza el
   config completo.
7. Una condición `{ operator: "equals", value: "3-1", itemField: "code" }` (`itemField` en operador que no es
   `arrayContains`) rechaza el config completo.
8. Un grupo `{ operator: "or", conditions: [{ reference: "queries.x.data.permissions", operator: "arrayContains",
   itemField: "code", value: "3-1" }, { reference: "forms.f.role", operator: "equals", value: "admin" }] }`
   coincide si cualquiera de las dos condiciones coincide, igual que con cualquier otro operador.
9. `negate: true` sobre una condición `arrayContains` que no coincide invierte el resultado a "coincide", y
   viceversa.
10. `arrayContains` está disponible y se comporta igual en los 4 contextos que reutilizan el shape (`visibility`,
    `submitAction.onSuccess[*].when`, `preloads[*].when`, `operations[*].when`).

## Casos límite

- **Array vacío**: `reference` resuelve a `[]` → `arrayContains` nunca coincide, independientemente de `itemField`.
- **`itemField` con segmento inexistente en todos los elementos**: ningún elemento aporta coincidencia → no
  coincide (equivalente a array vacío tras proyección).
- **Elementos de tipos mixtos en el array** (ej. `[{code: "1-1"}, "suelto", 42]`) con `itemField: "code"`: solo el
  elemento objeto se evalúa contra `itemField`; los elementos no-objeto se ignoran sin invalidar el resto.
- **`value` es `null`**: comparación válida igual que en `equals`/`notEquals`; coincide si algún elemento (o su
  `itemField`) es exactamente `null`.
- **Array con un único elemento**: se comporta igual que cualquier tamaño de array; no hay caso especial.
- **`itemField` declarado sobre un array de primitivos**: cada primitivo no es objeto, por lo que ningún elemento
  resuelve `itemField` → no coincide (comportamiento consistente con "elemento no comparable se ignora", no un
  error de render).

## Riesgos o preguntas abiertas

Ninguno bloqueante. Decisiones acordadas en la conversación de exploración previa (`explore-feature-scope`):

- Mecanismo de sub-campo: nuevo campo `itemField` (en vez de extender la sintaxis de `reference` con wildcards,
  que sería un cambio transversal mayor y fuera de alcance de esta feature).
- Nombre del operador: `arrayContains`.
- Restricción de tipo de `value`: igual que `equals`/`notEquals` (literal escalar).
- Degradación ante referencia no-array o elemento no comparable: no coincide, sin coerciones implícitas,
  consistente con el criterio ya usado por `greaterThan`/`lessThan`.

## Áreas de producto afectadas

- `references/visibility.md` (catálogo de operadores, shape de condición simple, validación de shape) y los 3
  contextos adicionales que reutilizan el mismo shape de condición (`submitAction.onSuccess[*].when`,
  `preloads[*].when`, `operations[*].when` de button y form).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/references/visibility.md`: añadir `arrayContains` al catálogo de operadores,
  documentar `itemField`, sus reglas de validación y casos límite.
- `ai-workflow/docs/app-features/references/index.md`: revisar si resume el catálogo de operadores y necesita
  mención del nuevo operador.
