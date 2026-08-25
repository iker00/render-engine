# Design: Feature 2026-08-25-12-01 - table-row-references

## Contexto
`item.*` es hoy la única familia de referencia para navegar el dato "actual" en un contexto de iteración. La resuelve `resolveSupportedReferenceValue` en `src/runtime/runtime-references/runtime-reference-resolver.ts` contra un único objeto `RuntimeIterationContext` (`{ item, key, itemKey?, itemIndex }`) que cada nodo productor (`repeater`, `table`) construye y pasa hacia abajo como prop `iterationContext`, reemplazando por completo el que recibió de su ancestro. La sintaxis de la referencia (qué namespaces existen, qué shape de path es válido) vive por separado en `src/config/runtime-reference-syntax.ts`, consumida tanto por `src/config/` (validación de bootstrap, sin estado en vivo) como por `runtime-references/` (resolución contra estado), tal y como exige `architecture.md`.

Inspección del código actual confirma el mecanismo de sombreado descrito en la spec:
- `repeater-layout-node.tsx` construye `iterationContext = { item, key, itemIndex }` y lo pasa a su subárbol.
- `table-layout-node.tsx` recibe ese `iterationContext` ambiental (lo usa para resolver `props.rows.source: 'item.*'` sin tocarlo) pero, al renderizar cada fila, construye un **nuevo** `rowIterationContext = { item: rowItem, key, itemIndex: rowIndex }` que sustituye por completo al ambiental para las celdas de esa fila. Ese es el punto exacto de sombreado que la spec pide resolver.
- En modo manual, `rowItemMap` nunca se puebla, así que hoy `rowIterationContext` resulta `undefined` para celdas-nodo manuales: el contexto ambiental del `repeater` ancestro se pierde también en modo manual, no solo se sombrea. Este comportamiento actual es más amplio que "sombreo en modo dinámico" y hay que corregirlo para cumplir el requisito 6 de la spec, que no distingue por modo.
- Las celdas string de `table` no pasan hoy por `parseRuntimeReference` en bootstrap (`validate-table-node.ts` solo valida tipo/forma de la celda, nunca su contenido de referencia). La degradación de `item.*`/`row.*` mal usado dentro de una celda es, por tanto, puramente un comportamiento de resolución en runtime, nunca un rechazo de bootstrap — esto ya es así hoy para `item.*` y es la base del requisito 9.
- `parseRuntimeReference` ya tiene precedente para un namespace "condicionalmente soportado": `item` se parsea como `status: 'supported'` solo si `options.allowItemReference` es `true`; si no, como `status: 'unsupported'` (sigue siendo una referencia reconocida, nunca cae a literal). Ambos estados degradan igual en superficies visibles (`resolveRuntimeVisibleValue` trata todo lo que no sea `'resolved'`/`'literal'` como string vacío), así que la distinción existe solo para diagnóstico de desarrollo, no para comportamiento observable.

## Objetivos / No objetivos

### Objetivos
- Decidir cómo `RuntimeIterationContext` puede transportar simultáneamente el `item` del `repeater` ancestro y el `row` propio de `table`, sin que uno sobrescriba al otro.
- Decidir si `row` se registra en `runtime-reference-syntax.ts` junto a `item` o necesita tratamiento propio.
- Dejar clara la estrategia de cambio en `table-layout-node.tsx` para dejar de sombrear el contexto ambiental, en ambos modos (manual y dinámico).

### No objetivos
- No se decide aquí el detalle de tests ni se trocea en tareas (pertenece a `generate-implementation-plan`).
- No se revisita ningún requisito funcional ya cerrado en `spec.md`.
- No se toca el pipeline local de filtros/orden/paginación de `table`; `row.$index` se apoya en la posición ya calculada por ese pipeline.
- No se decide nada sobre `list`, `select`, `radioGroup`, `checkboxGroup` (fuera de alcance de la spec).

## Decisiones

### D1. Extender `RuntimeIterationContext` con slots hermanos, no con una pila de contextos padre
**Elegido:** añadir `row?: unknown` y `rowIndex?: number` como campos hermanos de `item`/`key`/`itemKey`/`itemIndex` en la misma interfaz, en vez de introducir una estructura de composición general (`{ ...contexto, parent?: RuntimeIterationContext }` o un array/pila de contextos).
**Por qué:** el único caso real de composición simultánea es exactamente dos roles fijos — el `item` del `repeater` ancestro más cercano y el `row` de la `table` propia — porque `table` no puede anidar otra `table` ni un `repeater` dentro de una celda (contrato ya cerrado en `table.md`: tipos de celda permitidos excluyen `repeater` y `table`). No existe un caso de negocio que requiera más de dos roles simultáneos ni resolución contra un ancestro más lejano que el inmediato. Una pila genérica resolvería un problema que no existe en este dominio y añadiría una indirección (recorrer padres) que ningún consumidor necesita.
**Coste/trade-off:** los campos de "grupo item" (`item`, `key`, `itemIndex`) pasan de obligatorios a opcionales en el tipo, para reflejar honestamente que un contexto puede llevar solo el grupo `row` (tabla sin `repeater` ancestro). Es un ensanchamiento de tipo compatible hacia atrás: todo el código existente que construye estos objetos sigue siendo válido, y todos los consumidores ya leen estos campos con optional chaining (`iterationContext?.item`, etc.), así que no cambia comportamiento en los casos ya cubiertos.
**Riesgo residual:** bajo. El tipo es interno a `runtime-references/` y sus productores (`repeater`, `table`, `modal` en modo edición); no se expone como contrato público de configuración.

### D2. `row` se registra como namespace de primera clase en `runtime-reference-syntax.ts`, con el mismo patrón condicional que `item`
**Elegido:** añadir `'row'` a `RuntimeReferenceNamespace`, a `REFERENCE_PATTERN`, a `hasRecognizedNamespace` y a `hasValidReferenceShape` (misma forma que `item`: navegación de segmentos arbitraria, más la forma sintética exacta `row.$index`). En el resolver, condicionar el `status: 'supported'` de `row` a una nueva opción `allowRowReference`, igual que `allowItemReference` condiciona `item` hoy.
**Por qué frente a la alternativa de tratamiento propio (namespace especial fuera del contrato neutral, o parser local en `runtime-references/`):** `architecture.md` fija que la sintaxis de referencias vive en `src/config/runtime-reference-syntax.ts` como contrato neutral compartido por `src/config/` y `runtime-references/`, precisamente para que la validación de bootstrap no dependa de `src/runtime/`. Aunque hoy ningún validador de bootstrap necesita `allowRowReference: true` (las celdas de `table` no pasan por `parseRuntimeReference` en bootstrap — ver Contexto), registrar `row` en el módulo neutral evita duplicar la definición de namespaces reconocidos y mantiene un único punto de verdad si en el futuro alguna superficie de `table` sí necesitara validar sintaxis de referencia en bootstrap. Seguir el mismo patrón condicional que `item` (en vez de hacer `row` incondicionalmente `'supported'`) mantiene la paridad de diagnóstico de desarrollo entre ambas familias y evita dos formas distintas de resolver el mismo problema en el mismo módulo.
**Coste/trade-off:** una rama más en `hasValidReferenceShape` y en `resolveSupportedReferenceValue`; superficie de tipo (`RuntimeSupportedReference['namespace']`, `RuntimeUnsupportedReference['namespace']`) ligeramente mayor.
**Riesgo residual:** ninguno identificado — no hay switches exhaustivos por namespace fuera de `runtime-reference-syntax.ts` y `runtime-reference-resolver.ts` (verificado: `runtime-reference-diagnostics.ts` no distingue por namespace, solo por `status`).

### D3. `row.$index` es la única referencia sintética de `row`; no existe `row.$key`
**Elegido:** replicar solo el patrón de `item.$index` (posición numérica), no el de `item.$key` (clave de diccionario).
**Por qué:** `table` no itera un diccionario — sus filas siempre tienen una posición ordinal en la vista visible, nunca una "clave" de origen equivalente a la de un `repeater` sobre objeto plano. La spec solo pide `row.$index` (requisitos 4 y 5) y no menciona ninguna forma de clave para `row`.
**Riesgo residual:** ninguno; si en el futuro se necesitara, es una extensión aislada del mismo patrón, no un cambio de forma.

### D4. `table-layout-node.tsx` construye siempre el contexto de fila por composición (`{ ...iterationContext, row, rowIndex }`), nunca por sustitución
**Elegido:** en los tres puntos donde `table-layout-node.tsx` hoy construye o usa un contexto de iteración para resolver celdas (celdas string en modo manual, celdas string en modo dinámico, celdas-nodo en ambos modos), sustituir la construcción actual por un spread del `iterationContext` ambiental recibido como prop, añadiendo `row` (solo en modo dinámico) y `rowIndex` (siempre, 1-based, derivado de la posición del row dentro de `visibleRows`, que ya refleja filtros + orden + paginación aplicados).
**Por qué:** es el cambio mínimo que resuelve el sombreado sin tocar la propagación del contexto en el resto del árbol (`layout-renderer.tsx`, `layout-node-renderer.tsx` y todos los nodos intermedios como `container` siguen reenviando `iterationContext` sin cambios, porque ahora `item` y `row` conviven en el mismo objeto). `rowIndex` ya es 1-based por construcción trivial (`rowIndex + 1` sobre el índice de `.map` en `visibleRows`), sin tocar el pipeline de filtros/orden/paginación.
**Efecto colateral necesario, no alcance añadido:** hoy, en modo manual, las celdas-nodo no reciben ningún `iterationContext` (`rowIterationContext` es `undefined` porque `rowItemMap` nunca se puebla en ese modo). El requisito 6 de la spec exige que `item` del `repeater` ancestro esté disponible "dentro de las celdas de esa table" sin cualificar por modo, así que construir el contexto compuesto también en modo manual (con `row` ausente pero `rowIndex` presente) es necesario para cumplir ese requisito, no una extensión de alcance.
**Coste/trade-off:** cambia comportamiento observable de celdas-nodo en modo manual dentro de un `repeater` (antes perdían `item.*` del ancestro; ahora lo mantienen). Es exactamente lo que pide el requisito 6 y no está cubierto hoy por ningún test según lo inspeccionado; conviene que el plan de implementación lo señale como caso de test explícito.
**Riesgo residual:** bajo, acotado a `table-layout-node.tsx`.

### D5. No se modifica `src/config/` (validadores de bootstrap)
**Elegido:** ningún validador de `src/config/` necesita `allowRowReference: true` ni ninguna otra referencia a `row`.
**Por qué:** confirmado leyendo `validate-table-node.ts` — el contenido de celdas string de `table` (manual o `cells` dinámico) nunca se pasa por `parseRuntimeReference` en bootstrap, solo se valida su tipo (`string | number | boolean | NodeObject`). Esto ya es así hoy para `item.*` mal usado en celdas y es la base técnica del requisito 9 (degradación silenciosa, sin rechazo de bootstrap). El mismo vacío de validación cubre `row.*` sin cambios adicionales.
**Riesgo residual:** ninguno — es una constatación, no una decisión de trade-off.

## Riesgos y trade-offs
- **Cambio de comportamiento intencional y sin compatibilidad retroactiva** (ya cerrado en `spec.md`): cualquier config existente que use `item.*` como contexto de fila dentro de celdas de `table` pasará a degradar a vacío. No es una regresión de este diseño; es el comportamiento pedido.
- **Ensanchar `RuntimeIterationContext` a campos opcionales** es un cambio de tipo compartido por `repeater`, `table` y el modo edición de `modal`. El riesgo de romper algún consumidor existente es bajo porque todos ya leen con optional chaining, pero el plan de implementación debe correr la suite completa de tests de `repeater` y de edición en modo dev, no solo los de `table`.
- **Superficie de test ampliada**: la combinación relevante de casos (table standalone vs. anidada en repeater, modo manual vs. dinámico, con y sin paginación/filtro/orden, celda string vs. celda-nodo, `container` anidado en celda) es no trivial. No se trocea aquí — queda para `generate-implementation-plan`, pero se señala como riesgo de cobertura a vigilar contra el umbral global del 80%.

## Migración o despliegue
No aplica. No hay datos persistentes que migrar ni flag de compatibilidad (explícitamente fuera de alcance en `spec.md`). El cambio es de comportamiento en tiempo de render; las configuraciones existentes que dependían de `item.*` como contexto de fila de `table` deben migrarse manualmente a `row.*`, tal y como ya asume la spec.

## Preguntas abiertas
Ninguna bloqueante. Las dos preguntas técnicas señaladas en `spec.md` quedan resueltas en D1 y D2 de este documento.
