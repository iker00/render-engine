# Design: Action-level API request params

## Contexto
La feature `0009` ya dejó operativa la frontera HTTP declarativa en `src/queries/`, con construcción de requests desde `config.api`, resolución dinámica de referencias del runtime y proyección visible del resultado en `queries.{operationName}`. La feature `0014` consolidó `executeOperation` como acción UI compartida y `0015` reutilizó esa misma acción desde `form.submitAction`.

Hoy el runtime ya tiene una base parcial útil para `0018`:
- `src/queries/runtime-api-request.ts` ya sabe construir `query` y `body` desde la operación base y serializar el `body` JSON cuando aplica.
- `executeQueryOperation(operationName, options?)` ya acepta un segundo argumento interno en el provider.
- `form-layout-node.tsx` ya envía un segundo argumento al ejecutar `submitAction`, lo que demuestra que la capa de runtime ya prevé contexto por ejecución aunque el contrato público todavía no lo formalice.

Lo que falta es cerrar el contrato y la partición técnica para que:
- `headers` pase a ser parte estable del contrato `api`
- `button.props.action.type: executeOperation` pueda aportar `query`, `body` y `headers`
- `form.submitAction.type: executeOperation` pueda aportar esos mismos canales
- la combinación entre payload base y payload por ejecución sea única, comprobable y reutilizable en todas las superficies

Sin este diseño quedarían abiertas varias divergencias:
- validar `headers` en `api` pero no en acciones o submit, o viceversa
- duplicar la lógica de merge entre `button`, `form` y `queries/`
- resolver parámetros por ejecución demasiado pronto en el renderer en vez de hacerlo en el momento real de disparo
- romper compatibilidad con la semántica estable de `request-build-failed`, `queries.{operationName}` o la conservación del último dato válido durante recargas

## Objetivos / No objetivos

### Objetivos
- Formalizar un shape compartido de parámetros de request reutilizable por `api`, `button.props.action` y `form.submitAction`.
- Mantener `operationName` como vínculo obligatorio con una operación ya declarada.
- Resolver parámetros por ejecución contra el snapshot real del runtime en el momento de disparo.
- Centralizar la combinación entre operación base y override por ejecución dentro de `src/queries/`, no en nodos visuales.
- Preservar la proyección visible exclusiva en `queries.{operationName}` y la semántica actual de errores normalizados.
- Mantener compatibilidad con configuraciones existentes que usan `executeOperation` sin payload adicional.

### No objetivos
- Añadir nuevos tipos de acción, secuencias, branching o callbacks por éxito/error.
- Permitir parámetros por ejecución en `preloads`.
- Abrir merge profundo arbitrario, interpolación parcial o un lenguaje general de transformaciones.
- Introducir un dominio nuevo de estado visible para acciones o submit.
- Reorganizar la arquitectura de `runtime-actions/` o `runtime-state/` más allá de la ampliación mínima necesaria.

## Decisiones

### 1. Se introduce un shape compartido de request params declarativos y `headers` pasa a ser canal de primer nivel en `api`
La operación base `api.{operationName}` pasa a admitir:
- `query`
- `body`
- `headers`

La acción `executeOperation` y `form.submitAction` reutilizarán exactamente esos mismos nombres de canal.

Reglas cerradas:
- `query` sigue siendo un objeto plano de claves no vacías con valores escalares declarativos
- `headers` usa el mismo shape de objeto plano, pero con resultado final siempre string
- `body` sigue siendo un árbol JSON declarativo
- `GET` no admite `body` ni en la operación base ni en el override por ejecución

Razonamiento:
- evita que `headers` siga siendo una capacidad implícita del builder HTTP pero no del contrato documentado
- mantiene el vocabulario alineado entre backend, config y runtime
- reduce refactors porque `src/queries/` ya conoce esos tres canales

### 2. El override por ejecución amplía `executeOperation`; no crea una familia nueva de acciones
`ExecuteOperationRuntimeUiAction` debe crecer para admitir opcionalmente:
- `query`
- `body`
- `headers`

`form.submitAction` reutiliza ese mismo tipo ampliado.

La consecuencia es que:
- `button.props.action` y `form.submitAction` comparten exactamente la misma semántica
- `runtime-ui-action-executor.ts` no toma decisiones de merge; solo reenvía la acción al handler compartido
- `form-layout-node.tsx` no reconstruye payloads; solo pasa el `submitAction` ya validado

Razonamiento:
- ya existe una acción estable llamada `executeOperation`
- la feature busca parametrizar esa primitiva, no inventar otra
- dejar la misma superficie en botón y formulario reduce divergencias funcionales y de testing

### 3. La combinación entre operación base y override por ejecución vive en `src/queries/`
La construcción final del request debe ocurrir solo en la frontera HTTP. La partición objetivo es:
- `src/config/`: tipos y validación estructural/semántica del nuevo contrato
- `src/runtime/`: transporte del `ExecuteOperationRuntimeUiAction` ya parseado hasta el provider
- `src/queries/`: composición final entre operación base y parámetros por ejecución, resolución de referencias y serialización del request

La regla de implementación es explícita:
- ni `button-layout-node.tsx`
- ni `form-layout-node.tsx`
- ni `runtime-ui-action-executor.ts`

deben mergear `query`, `body` o `headers`.

Razonamiento:
- evita lógica duplicada entre triggers
- mantiene la red fuera de los nodos visuales
- alinea la feature con el principio ya vigente de que `queries/` encapsula la frontera HTTP del runtime

### 4. `executeQueryOperation` se amplía con `requestParams`, manteniendo compatibilidad
La fachada del provider debe evolucionar desde:
- `executeQueryOperation(operationName, options?)`

a una forma compatible con:
- `executeQueryOperation(operationName, { requestParams?, snapshotState?, fetch? })`

`requestParams` contendrá opcionalmente:
- `query`
- `body`
- `headers`

El resto del runtime no necesita conocer el resultado del merge; solo entrega ese bloque al provider.

Razonamiento:
- el segundo argumento ya existe internamente, así que la ampliación es incremental
- evita romper tests o callers que ya usan `fetch` o `snapshotState`
- deja `preloads` intactos porque pueden seguir llamando sin `requestParams`

### 5. La semántica de combinación se fija antes de resolver referencias y se aplica por canal
La operación efectiva se deriva combinando primero las dos capas declarativas y resolviendo después el payload resultante contra el snapshot runtime.

Reglas cerradas:
- `query`: unión superficial por clave; prevalece la acción o el submit
- `headers`: unión superficial por clave; prevalece la acción o el submit
- `body`:
  - si solo existe una capa, esa capa es el body efectivo
  - si ambas capas existen y ambas son objetos raíz planos o anidados JSON, se combinan de forma superficial por clave en raíz, con prevalencia de la acción o submit
  - si una de las dos capas usa un valor raíz no objeto, el body de la acción o submit sustituye por completo al body base

La combinación no hace merge profundo recursivo entre ramas repetidas. Si una clave raíz coincide y ambas ramas son objetos, prevalece la rama completa del override por ejecución.

Razonamiento:
- mantiene la semántica predecible y fácil de documentar
- evita abrir un motor de merge arbitrario
- permite reutilizar una misma operación base con variaciones concretas sin duplicarla en `api`

### 6. La validación se reparte entre `Zod`, validación cruzada y tiempo de invocación
`Zod` debe cerrar el shape de:
- `api.headers`
- `action.query`
- `action.body`
- `action.headers`
- `submitAction.query`
- `submitAction.body`
- `submitAction.headers`

La validación cruzada en `validate-runtime-config.ts` debe cerrar al menos:
- `operationName` existente en `api`
- prohibición de `body` para `GET` tanto en operación base como en override por ejecución
- claves vacías o valores no soportados en `query` y `headers`

La invocación en `src/queries/` sigue cerrando lo que depende del estado runtime:
- referencias no resolubles
- valores resueltos incompatibles con el canal final
- imposibilidad de serializar el payload resultante según las reglas estables

Razonamiento:
- preserva la frontera actual entre contrato inválido y dato ausente en ejecución
- evita meter en bootstrap validaciones imposibles sin snapshot runtime
- mantiene la semántica de `request-build-failed` como error de ejecución, no de parseo del config

### 7. `headers` se resuelve con semántica estricta de string y no abre casos especiales de omisión
El contrato de `headers` se cierra así:
- shape declarativo: objeto plano
- clave: string no vacío
- valor declarado: string literal o referencia completa que resuelva a string
- valor resuelto no string: error `request-build-failed`
- el merge entre headers base y por ejecución ocurre antes de construir `RequestInit`
- si la request efectiva lleva `body` serializado y el conjunto efectivo de headers no declara ningún `content-type` en ninguna variante de casing, el builder añade `content-type: application/json`
- si el conjunto efectivo de headers ya declara `content-type` en cualquier casing, ese valor explícito prevalece y el builder no añade una segunda cabecera implícita

No se abre en esta feature:
- arrays de cabeceras
- cabeceras repetidas con el mismo nombre
- omisión condicional de claves
- normalización general por casing más allá de evitar duplicar el `content-type` implícito

Razonamiento:
- `headers` es la parte más sensible a ambigüedad si se acepta un shape demasiado amplio
- un contrato estricto reduce sorpresas y facilita generación desde backend legacy

### 8. La resolución por ejecución usa siempre el snapshot más reciente, también en submit
La operación efectiva debe resolverse contra el snapshot runtime capturado en el momento real de disparo.

Esto implica:
- `button.props.action` usa el snapshot leído por el provider al ejecutar la acción
- `form.submitAction` sigue usando el snapshot más reciente tras validación local del formulario
- el merge entre payload base y override ocurre dentro de `src/queries/` usando ese snapshot único

Razonamiento:
- evita usar valores stale de `forms.*` o `queries.*`
- preserva la semántica ya cuidada en `form-layout-node.tsx`
- mantiene un único momento de resolución para todos los canales del request

### 9. La superficie visible no cambia: todo sigue proyectándose en `queries.{operationName}`
La feature no introduce un dominio nuevo para loading, error o éxito por trigger. Toda ejecución derivada de:
- botón con `executeOperation`
- submit de formulario con `executeOperation`

sigue escribiendo exclusivamente en `queries.{operationName}`.

Se preservan además estas reglas:
- `loading` conserva el último `data` válido
- un fallo de construcción deja `status: error` con `code: request-build-failed`
- no se emite red si el request no puede construirse
- `resetOnSuccess` sigue dependiendo del resultado final de la operación ya combinada

Razonamiento:
- evita duplicar fuentes de verdad
- mantiene intactas las features de feedback visual y formularios ya implementadas
- reduce el coste de adopción documental y de tests de regresión

## Estructura objetivo

```txt
src/
  config/
    runtime-config-types.ts
    runtime-config-zod.ts
    validate-runtime-config.ts
  queries/
    runtime-api-types.ts
    runtime-api-request.ts
    runtime-api-executor.ts
  runtime/
    runtime-actions/
      runtime-ui-action-executor.ts
    runtime-state/
      runtime-state-provider.tsx
    nodes/
      button-layout-node.tsx
      form-layout-node.tsx
  tests/
    runtime-config-validation.test.ts
    runtime-api-execution.test.ts
    runtime-state.test.tsx
    runtime-ui-actions.test.tsx
```

Notas:
- el punto principal de cambio técnico debe ser `runtime-api-request.ts`; el resto de capas solo propaga `requestParams`
- no hace falta reabrir `runtime-navigation-action-executor.ts`
- no hace falta cambiar la semántica de `preloads`

## Estrategia de implementación
1. Ampliar tipos y esquemas para introducir `headers` en `api` y `requestParams` en `executeOperation`.
2. Endurecer `validate-runtime-config.ts` para cerrar shapes inválidos y la prohibición de `body` en `GET` también a nivel de acción y submit.
3. Extender `runtime-api-types.ts` y `runtime-api-request.ts` para aceptar parámetros por ejecución y componer la operación efectiva en una sola capa.
4. Adaptar `runtime-state-provider.tsx`, `runtime-ui-action-executor.ts` y `form-layout-node.tsx` para transportar `requestParams` sin lógica de merge local.
5. Cubrir regresión sobre validación, builder HTTP, acciones UI y submit de formularios.

## Riesgos y trade-offs
- Riesgo: repartir la lógica de combinación entre `form`, `button` y `queries/`.
  Mitigación: fijar que todo merge vive solo en `src/queries/`.

- Riesgo: aceptar un merge de `body` demasiado complejo o implícito.
  Mitigación: limitarlo a combinación superficial en raíz y sustitución total para raíces no objeto.

- Riesgo: romper `executeQueryOperation` o `preloads` existentes.
  Mitigación: ampliar la firma del segundo argumento sin cambiar su uso actual cuando `requestParams` no existe.

- Riesgo: permitir que `headers` acepte valores no string y terminar con serialización inconsistente.
  Mitigación: contrato estricto de string final y error de construcción cuando no se cumpla.

- Riesgo: resolver referencias antes de tiempo y usar snapshots stale.
  Mitigación: hacer toda la resolución dentro del builder del request usando el snapshot de la invocación real.

## Migración o despliegue
No hay migración persistida.

Compatibilidad esperada:
- una operación `api` existente sin `headers` sigue funcionando igual
- un `button.props.action` o `form.submitAction` que solo declare `operationName` conserva su comportamiento actual
- `preloads` siguen usando solo la operación base declarada

## Preguntas abiertas
- No quedan preguntas abiertas bloqueantes si la implementación respeta esta partición.
- Quedan fuera de esta feature posibles ampliaciones futuras como merge profundo, omisión condicional de claves o parámetros por ejecución en `preloads`.
