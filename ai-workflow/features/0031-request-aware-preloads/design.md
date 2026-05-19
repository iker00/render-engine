# Design: Request-aware preloads

## Contexto
La feature cambia a la vez tres fronteras estables del runtime:
- el contrato visible de `pages[].preloads`
- la construcción compartida de requests declarativas
- la orquestación automática de `preloads` y el agregado `pageEntry`

La spec cierra el objetivo funcional, pero deja varias decisiones técnicas que no conviene resolver durante la implementación porque podrían producir resultados divergentes:
- cómo representar internamente el nuevo shape declarativo de `preloads`
- dónde vive la firma estable de request y cómo se comparte con `executeOperation`
- contra qué estado se compara una firma cuando todavía no existe caché histórica por request
- cómo relanzar solo un subconjunto de `preloads` sin romper la semántica agregada de `pageEntry`

## Objetivos
- Normalizar `preloads` a una representación interna explícita y más segura que la lista histórica de strings.
- Reutilizar una única capa de composición y resolución de request para acciones manuales y `preloads`.
- Introducir una firma determinista de request que permita decidir relanzamientos preload a preload.
- Mantener la restricción actual de una única superficie `queries.{operationName}` por nombre sin abrir todavía caché ni multiplicidad simultánea.

## No objetivos
- Introducir una caché reutilizable por firma de request.
- Permitir varias entradas del mismo `operationName` en una misma página.
- Cambiar la semántica funcional de `button.props.action` o `form.submitAction` más allá de reutilizar la capa común de request.
- Exponer la firma o el estado interno de `preloads` como nuevo namespace declarativo.

## Decisiones

### 1. El shape visible de `preloads` se normaliza a un tipo interno estructurado
El JSON seguirá exigiendo una lista ordenada de objetos con exactamente una clave por entrada, por ejemplo:

```json
[
  { "loadUser": {} },
  { "loadTeams": { "query": { "region": "params.region" } } }
]
```

La validación la convertirá a una representación interna explícita, por ejemplo una colección de objetos con:
- `operationName`
- `requestParams`

Motivo:
- evita repartir por el runtime lógica de “leer la única clave del objeto”
- simplifica validaciones cruzadas como duplicados por `operationName`
- deja la capa de estado y de ejecución desacopladas del shape literal de entrada

Consecuencia:
- la forma histórica `preloads: ["loadUser"]` queda rechazada en validación
- la validación debe rechazar entradas con más de una clave, con clave vacía o con payload fuera del contrato
- la validación debe rechazar duplicados por `operationName` dentro de la misma página, aunque todavía no debe rechazar operaciones inexistentes en `api`, porque esa semántica sigue siendo error recuperable de runtime

### 2. La identidad de request vive en `src/queries/`, no en el provider
La firma de request no debe calcularse desde strings sueltos en `runtime-state-provider.tsx`. Debe salir de una capa compartida en `src/queries/` que ya conoce:
- merge entre operación base y overrides
- resolución de referencias contra un snapshot
- normalización final de `query`, `body` y `headers`

La misma frontera debe poder devolver dos artefactos relacionados:
- el request listo para ejecutar
- una descripción serializable y estable de la request efectiva para firmarla

Motivo:
- evita divergencia entre “request que se ejecuta” y “request que se firma”
- mantiene la composición HTTP fuera de la capa React
- deja preparada una futura caché por request sin reabrir la frontera de `queries/`

### 3. La firma se calcula sobre una descripción estable, no sobre el `RequestInit` crudo
La firma debe incluir como mínimo:
- `operationName`
- `method`
- `endpoint`
- `query`
- `body`
- `headers`

La serialización debe ser determinista para objetos equivalentes aunque el orden de claves original difiera. La decisión recomendada es firmar una descripción ya normalizada mediante una serialización estable con orden lexicográfico recursivo de claves.

Motivo:
- `RequestInit` no es una base fiable ni cómoda para una firma estable
- la query string final y los headers deben compararse por valor funcional, no por orden incidental de construcción

### 4. La comparación de `preloads` se hace contra la firma actualmente asociada a `queries.{operationName}`
Mientras no exista caché histórica por firma, el runtime no debe comparar una nueva entrada contra un historial antiguo de `pageEntry`. Debe compararla contra la firma que hoy respalda el estado visible actual de `queries.{operationName}`.

Para ello, el dominio `queries` debe guardar metadatos adicionales por operación, al menos:
- `requestSignature`

Ese metadato debe actualizarse tanto en `loading` como en `success` y `error`, y volver a `null` en `reset`.

Motivo:
- la superficie visible de datos sigue siendo única por `operationName`
- si otra página reutiliza el mismo `operationName` con una firma distinta, la query actual deja de representar la request previa aunque el usuario vuelva atrás
- esta comparación reproduce el comportamiento correcto sin inventar todavía una caché que rehidrate datos históricos

Consecuencia importante:
- volver a una página antigua solo evita relanzar si la firma requerida coincide con la firma actualmente asociada a `queries.{operationName}`
- si otra entrada intermedia usó el mismo `operationName` con otra firma, la vuelta debe relanzar porque la query visible ya no representa la request anterior

### 5. `pageEntry` debe distinguir entre el conjunto visible de preloads y el subconjunto realmente relanzado
El agregado `pageEntry` sigue siendo la unidad visible de la tanda automática, pero ya no puede modelarse solo con `preloadNames`.

La implementación debe conservar al menos dos piezas de información:
- el conjunto visible de preloads resueltos para la entrada activa, con sus firmas
- el subconjunto que se ha relanzado realmente en la tanda actual

La transición recomendada es:
- si la página no tiene `preloads`, `pageEntry` queda en `idle`
- si la página tiene `preloads` pero ninguna firma cambió respecto a las queries actuales, no se abre una nueva tanda `loading`
- si una o más firmas cambiaron, el runtime abre una tanda `loading`, resetea solo esas queries y ejecuta solo ese subconjunto
- al cerrar la tanda, `pageEntry` queda en `success` si todas las recargas necesarias salieron bien, o en `error` si alguna falló

Motivo:
- la spec exige decisión preload a preload
- evita falsos `loading` cuando no hubo relanzamientos reales
- conserva la semántica de carga fresca solo donde la firma cambió

### 6. Toda reevaluación automática de `preloads` parte de un snapshot único común
La planificación y la ejecución de una tanda deben partir del mismo snapshot del runtime para toda la entrada activa.

Orden recomendado:
1. Resolver la página activa.
2. Normalizar sus `preloads`.
3. Construir para todos ellos la request efectiva y su firma con un único snapshot compartido.
4. Comparar contra las firmas actuales del dominio `queries`.
5. Si hay cambios, resetear y lanzar solo las queries afectadas usando ese mismo snapshot.

Motivo:
- evita que distintos preloads de la misma tanda vean estados diferentes dentro del mismo ciclo
- mantiene la semántica ya fijada por features anteriores para composición de request

### 7. Los errores recuperables de preload siguen entrando por la misma frontera de ejecución
`operation-not-found` y `request-build-failed` no deben convertirse en errores de validación tardía ni en excepciones del provider. Deben seguir materializándose como errores recuperables de `queries.{operationName}`.

La implementación puede reutilizar la misma capa de ejecución ya existente, siempre que permita transportar la firma resuelta o, en su defecto, el objetivo de firma asociado a ese intento.

Motivo:
- mantiene coherencia con la semántica actual de acciones manuales
- evita una segunda vía de errores para `preloads`

## Impacto estructural previsto
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config-zod.ts`
- `src/config/validate-runtime-config.ts`
- `src/queries/runtime-api-types.ts`
- `src/queries/runtime-api-request.ts`
- `src/queries/runtime-api-executor.ts`
- `src/runtime/runtime-state/runtime-state-types.ts`
- `src/runtime/runtime-state/runtime-state-reducer.ts`
- `src/runtime/runtime-state/runtime-state-provider.tsx`
- `src/runtime/runtime-state/runtime-state-selectors.ts` si hace falta exponer lecturas más explícitas de firma o plan activo
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/runtime-state.test.tsx`

## Riesgos y trade-offs
- Riesgo: reintroducir divergencia entre request ejecutada y request firmada.
  Mitigación: una única capa de resolución en `src/queries/`.

- Riesgo: comparar contra historial de `pageEntry` y asumir una caché que todavía no existe.
  Mitigación: comparar contra la firma actualmente asociada a `queries.{operationName}`.

- Riesgo: abrir bucles de relanzamiento por recalcular firmas durante un `loading` ya en curso.
  Mitigación: persistir `requestSignature` también en `loading` y usarla en la comparación antes de relanzar.

- Riesgo: que el agregado `pageEntry` siga reflejando la lista nominal de preloads y no la tanda real.
  Mitigación: distinguir el conjunto visible resuelto del subconjunto efectivamente relanzado.

## Preguntas abiertas
- No quedan preguntas técnicas bloqueantes para pasar a implementación.
- La caché futura por firma deberá decidir dónde rehidrata resultados históricos, pero esa decisión queda fuera de esta iteración.
