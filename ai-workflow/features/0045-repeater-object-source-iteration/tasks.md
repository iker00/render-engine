# 0045 — tasks

Contrato de ejecución secuencial para implementar la feature 0045. Cada tarea es atómica, ordenada por dependencia y debe poder cerrarse en una sola pasada de implementación. La pasada de implementación debe seguir el orden exacto T1 → T2 → T3 → T4.

Convenciones:
- Cierre de implementación: código y tests propios de la tarea verdes; no incluye documentación.
- Cierre documental: doc afectada actualizada en una pasada posterior; las tareas T1–T3 declaran su impacto documental pero su cierre documental se ejecuta en T4.
- El umbral global de cobertura 80% sobre `src/` (`pnpm test`) es gate del cierre de la pasada de implementación, no se replica por tarea.

---

## T1 — Reference layer: aceptar y resolver `item.$key`

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Que la capa de referencias reconozca `item.$key` como referencia soportada cuando se evalúa dentro de un subárbol iterado, y que el resolver devuelva el valor de la clave del diccionario cuando el contexto de iteración la aporta, o `missing` cuando no la aporta (caso array). El resto de referencias `item.*` sigue navegando dentro del valor de la entrada exactamente como hoy.
- **Fuera de alcance**:
  - No modificar todavía la detección array/objeto en el repeater ni la propagación de la clave del diccionario al contexto de iteración: aquí solo se añade el campo opcional al tipo de contexto y la lectura desde el resolver. La población real del campo es trabajo de T3.
  - No tocar la validación de `props.items.key` (T2).
  - No abrir `$key` a otras superficies: solo se admite el literal exacto `item.$key`. `item.nested.$key`, `item.$key.foo` u otras formas con `$` siguen siendo rutas inválidas.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-references/runtime-reference-parser.ts` — reconocer el literal exacto `item.$key` como referencia soportada del namespace `item`. Cualquier otra ocurrencia de `$` en una ruta sigue invalidando.
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` — al resolver una referencia soportada `item.$key`, devolver el valor que el contexto de iteración exponga como clave del diccionario; si el contexto no aporta ese campo (caso array o evaluación fuera de repeater), devolver `found: false`.
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` — extender `RuntimeIterationContext` con un campo opcional para la clave del diccionario (por ejemplo `itemKey?: string`). T3 será quien lo pueble; T1 solo añade el contrato del tipo y la lectura.
    - `src/runtime/runtime-references/runtime-reference-types.ts` — si hace falta, extender el tipo de path soportado para reflejar que `['$key']` es válido bajo `item`. Mantener `RuntimeSupportedReference` sin perder el contrato actual de otras namespaces.
  - Tests:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
  - Documentación: ninguna en esta tarea (la actualización de `reference-resolution.md` se consolida en T4).
- **Tests**:
  - Ficheros de test:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - `item.$key` se reconoce como referencia válida cuando se evalúa con un contexto de iteración que aporta clave del diccionario, y se resuelve al valor string de esa clave.
    - `item.$key` evaluado con un contexto de iteración que no aporta clave del diccionario (simulando fuente array) resuelve como missing y degrada a string vacío en superficies textuales (vía `resolveRuntimeTextReference` / interpolación), sin romper el render.
    - `item.$key` evaluado sin contexto de iteración (fuera de repeater) sigue siendo rechazado igual que el resto de `item.*` fuera de repeater.
    - `item.{ruta}` con `ruta` distinta de `$key` sigue navegando dentro del valor de la entrada sin cambios respecto al comportamiento previo, incluyendo el caso de un valor de entrada que contiene una propiedad literal `$key`: la navegación dentro del valor no se ve afectada por la nueva semántica sintética.
    - `item.$key.algo`, `item.algo.$key` y variantes con `$` distintas del literal exacto `item.$key` siguen siendo rechazadas como referencia inválida.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`
  - Restricciones:
    - Reutilizar los helpers existentes del fichero de tests; no introducir un harness paralelo solo para `item.$key`.
- **Documentación afectada**: `ai-workflow/docs/app-features/references/reference-resolution.md` (impacto declarado, cierre documental en T4).
- **Criterios de finalización**:
  - El parser acepta exactamente `item.$key` como referencia soportada del namespace `item` y mantiene el rechazo de otras formas con `$`.
  - El resolver devuelve el valor de la clave del diccionario cuando el contexto de iteración la aporta, y missing cuando no.
  - Los tests nuevos pasan junto con los existentes del fichero.
- **Cierre de implementación**: T1 cierra cuando los tests del fichero indicado están verdes y los tests del proyecto que ya tocaban referencias `item.*` siguen verdes.
- **Cierre documental**: diferido a T4.

---

## T2 — Validación: aceptar `props.items.key: "$key"` como literal reservado

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Que `validateRuntimeConfig` acepte el literal exacto `"$key"` como valor válido de `repeater.props.items.key`, manteniendo el rechazo del resto de rutas relativas mal formadas, vacías o globales.
- **Fuera de alcance**:
  - No tocar la maquinaria de runtime del repeater (T3).
  - No alterar la validación de `props.items.source` ni de paginación.
  - No introducir un nuevo modo de configuración: `"$key"` no es una nueva propiedad, sigue siendo un valor del campo `key` ya existente.
  - No abrir el contrato a otros literales reservados (`$index`, `$value`, etc.) en esta feature.
- **Dependencias**: ninguna estricta sobre T1. Se puede implementar en paralelo conceptualmente, pero el orden de ejecución acordado es T1 antes que T2.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/validate-layout-nodes.ts` — extender `isValidRepeaterItemKeyPath` (o el helper equivalente) para aceptar el literal exacto `"$key"` además de las rutas relativas convencionales actuales. Cualquier otro uso de `$` en `key` sigue rechazado.
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (ampliación).
  - Documentación: ninguna en esta tarea (la actualización de `repeater.md` se consolida en T4).
- **Tests**:
  - Ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (ampliación)
  - Comportamiento cubierto:
    - Un `repeater` con `props.items.key: "$key"` y `template` válido se acepta y queda normalizado en la config validada con `key: "$key"` literal.
    - El conjunto actual de keys rechazadas (cadena vacía, `item.id`, `{{item.id}}`, `queries.posts.data.0.id`, `author..id`) sigue rechazándose con el mismo mensaje.
    - Otras formas inválidas relacionadas con `$` (`$key.id`, `$key.$key`, `meta.$key`, `$other`) siguen rechazándose con el mismo mensaje, demostrando que solo el literal exacto `"$key"` es el valor reservado admitido.
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-repeater.test.ts`
  - Restricciones:
    - Reutilizar los helpers del fichero (`createConfigWithLayout`, `createRepeaterNode`) y el patrón de aserción existente para errores de validación.
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/repeater.md` (impacto declarado, cierre documental en T4).
- **Criterios de finalización**:
  - `validateRuntimeConfig` acepta `key: "$key"` y rechaza el resto de formas con `$`.
  - Los tests nuevos pasan junto con los existentes del fichero.
- **Cierre de implementación**: T2 cierra cuando los tests del fichero indicado están verdes y el resto de tests del proyecto que tocan validación de repeater siguen verdes.
- **Cierre documental**: diferido a T4.

---

## T3 — Runtime: iteración sobre objeto plano, propagación de clave y soporte de `key: "$key"`

- **ID**: T3
- **Estado**: completed
- **Objetivo**: Que el nodo `repeater` en runtime acepte fuentes resueltas que sean objeto plano además de array. Detectar el shape, iterar las entradas propias y enumerables en orden natural, propagar la clave del diccionario al contexto de iteración para que `item.$key` la pueda resolver, y soportar el literal `"$key"` en `props.items.key` para usar la clave del diccionario como React key. El comportamiento sobre fuente array no debe cambiar y todas las políticas actuales de keys ausentes, no escalares o duplicadas, así como el reset de paginación ante cambio de colección/`pageSize`/variante, deben seguir vigentes.
- **Fuera de alcance**:
  - Soportar `Map`, `Set` u otras estructuras iterables.
  - Exponer `item.$index` o cualquier otra propiedad sintética distinta de `item.$key`.
  - Cambios en `list`, `select`, `radioGroup`, `checkboxGroup` u otros consumidores de colecciones.
  - Diagnóstico nuevo de "objeto vacío"; un objeto `{}` se trata silenciosamente como cero iteraciones, como un array vacío hoy.
- **Dependencias**: T1 (resolución de `item.$key` y campo opcional en `RuntimeIterationContext`), T2 (aceptación del literal `"$key"` en la validación).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/repeater-layout-node.tsx` — extender `resolveRepeaterItems` (o equivalente) para devolver, además del valor de cada entrada, su clave del diccionario cuando la fuente resuelta sea objeto plano; mantener la rama de array sin cambios observables. Adaptar `resolveRepeaterIterations` para:
      - cuando `items.key === '$key'` y la fuente es objeto, usar la clave del diccionario como key efectiva, aplicando la política actual de keys (`null`/no escalar/duplicada → omitir con diagnóstico, aunque la duplicidad sea imposible en un objeto plano);
      - cuando `items.key === '$key'` y la fuente es array, omitir todas las iteraciones y emitir el diagnóstico actual de keys no válidas en desarrollo;
      - cuando `items.key` es una ruta relativa convencional y la fuente es objeto, navegar la ruta dentro del valor de la entrada igual que hoy se navega dentro del item de array.
    - `src/runtime/nodes/repeater-layout-node.tsx` — construir el `RuntimeIterationContext` con `item` apuntando al valor de la entrada y el campo opcional de clave del diccionario poblado solo cuando la fuente era objeto. En fuente array, ese campo sigue ausente.
    - Si la detección de shape o el envoltorio item+clave crece y rompe la lectura del fichero, extraer un helper local en el mismo módulo o en `src/runtime/` con responsabilidad clara; no introducir un módulo nuevo de "iteración" si no es estrictamente necesario.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` (ampliación) — comportamiento de iteración sobre objeto, `$key` y diagnostics relacionados con la nueva semántica.
    - `src/tests/layout-renderer/layout-renderer-repeater-state.test.tsx` (ampliación) — reset de paginación al cambiar la colección resuelta entre array y objeto, y entre objetos distintos.
  - Documentación: ninguna en esta tarea (la actualización de `repeater.md` y `reference-resolution.md` se consolida en T4).
- **Tests**:
  - Ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` (ampliación)
    - `src/tests/layout-renderer/layout-renderer-repeater-state.test.tsx` (ampliación)
  - Comportamiento cubierto:
    - Una fuente que resuelve a un objeto con N claves propias renderiza N expansiones del template en el orden natural de inserción de las claves, equivalente al recorrido `Object.keys` sobre el objeto resuelto.
    - Con `props.items.key: "$key"` y fuente objeto, la React key de cada iteración es la clave del diccionario y `{{item.$key}}` interpolado dentro del template muestra esa misma clave.
    - Con `props.items.key: "fuente.id"` (ruta relativa) y fuente objeto, la React key se navega dentro del valor de la entrada; las entradas cuyo valor no contenga la ruta se omiten con el diagnóstico actual de key no válida.
    - Con `props.items.key: "$key"` y fuente array, el repeater omite todas las iteraciones y emite el diagnóstico actual de keys no válidas en desarrollo.
    - Una fuente que resuelve a `null`, `undefined`, un número, un string o `{}` renderiza cero iteraciones sin lanzar errores.
    - Dentro del subárbol iterado por una fuente objeto, una superficie textual con `{{item.{ruta}}}` sigue navegando dentro del valor de la entrada; `{{item.$key}}` siempre muestra la clave del diccionario, incluso si el valor de la entrada contiene una propiedad literal `$key`.
    - Un `repeater` paginado con fuente objeto aplica `pageSize` sobre la lista de entradas con key válida y única, navega entre páginas y reinicia su estado local cuando la colección resuelta cambia (objeto → otro objeto, objeto → array, array → objeto), igual que hoy con fuente array.
    - Un config existente con fuente array, `items.key` ruta relativa y template invariable produce el mismo render, las mismas keys y los mismos diagnósticos que antes de la feature (regresión).
  - Comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-state.test.tsx`
  - Restricciones:
    - Reusar los helpers ya existentes en ambos ficheros (`renderRuntimePageWithState`, `createRuntimePageState`) en lugar de duplicar fixtures.
    - No introducir snapshots de markup amplio: cada test debe afirmar comportamiento concreto (orden de iteraciones, keys efectivas, contenido textual interpolado, diagnostic emitido).
- **Documentación afectada**: `ai-workflow/docs/app-features/nodes/repeater.md`, `ai-workflow/docs/app-features/references/reference-resolution.md` (impacto declarado, cierre documental en T4).
- **Criterios de finalización**:
  - El repeater itera correctamente sobre array y objeto plano según el shape resuelto, y degrada silenciosamente sobre el resto.
  - `item.$key` está disponible dentro del subárbol iterado de un repeater con fuente objeto y muestra la clave del diccionario; sigue inaccesible cuando la fuente es array.
  - `props.items.key: "$key"` se traduce en uso de la clave del diccionario como React key cuando la fuente es objeto, y en omisión con diagnóstico cuando la fuente es array.
  - Toda la suite del proyecto pasa (`pnpm test`) cumpliendo el umbral global de cobertura del 80% sobre `src/`.
- **Cierre de implementación**: T3 cierra cuando los tests indicados están verdes, la suite completa pasa y se respeta el umbral global de cobertura.
- **Cierre documental**: diferido a T4.

---

## T4 — Documentación funcional de la feature

- **ID**: T4
- **Estado**: completed
- **Objetivo**: Reflejar el comportamiento estable de la feature en la documentación funcional y registrar la feature en los índices que correspondan.
- **Fuera de alcance**:
  - No modificar código de runtime ni de validación.
  - No reabrir decisiones de producto: el contrato es el cerrado en `spec.md`.
  - No tocar `README.md` (entrada breve, no historial).
- **Dependencias**: T1, T2 y T3 con cierre de implementación verde.
- **Impacto esperado en archivos**:
  - Código: ninguno.
  - Tests: ninguno.
  - Documentación:
    - `ai-workflow/docs/app-features/nodes/repeater.md` — incorporar:
      - el soporte de iteración sobre objeto plano además de array, con orden natural de inserción;
      - el contrato extendido de `props.items.key` con el literal reservado `"$key"` y su semántica según el shape de la fuente;
      - la política de degradación silenciosa para fuentes que no sean array ni objeto plano.
    - `ai-workflow/docs/app-features/references/reference-resolution.md` — incorporar:
      - `item.$key` como referencia soportada dentro del subárbol iterado de un `repeater` con fuente objeto;
      - precisar que `item.$key` no aplica fuera de un repeater ni cuando la fuente es array, manteniendo la frontera actual de `item.*`.
    - `ai-workflow/features/index.md` — registrar la feature 0045 en el índice.
    - `ai-workflow/docs/current-state.md` — actualizar el estado vigente del área "Catálogo de nodos" solo si la última feature relevante referenciada cambia con 0045; si no, dejarlo explícito como sin cambios.
- **Tests**:
  - Ficheros: ninguno; cubierto por T1, T2 y T3.
  - Comportamiento cubierto: ninguno propio de esta tarea; la verificación funcional vive en las suites de T1–T3.
  - Comandos durante la implementación: ninguno; tarea exclusivamente documental.
  - Restricciones: mantener el estilo y el tamaño de las fichas actuales; no transformar `repeater.md` ni `reference-resolution.md` en changelogs.
- **Documentación afectada**: ver arriba.
- **Criterios de finalización**:
  - Las dos fichas funcionales describen el nuevo contrato de forma consistente entre sí.
  - El índice de features y el estado vigente reflejan la feature.
  - `status.yaml` queda en estado terminal documental coherente.
- **Cierre de implementación**: ninguno propio; T4 no toca código.
- **Cierre documental**: T4 cierra cuando las cuatro entradas documentales arriba listadas quedan revisadas y actualizadas según el contrato cerrado en T1–T3.

---

## Siguiente tarea sugerida
T1. Es la base de capa de referencias: T2 puede planificarse en paralelo conceptualmente pero T3 depende de T1 explícitamente para el campo de contexto, por lo que el orden recomendado de ejecución es T1 → T2 → T3 → T4.
