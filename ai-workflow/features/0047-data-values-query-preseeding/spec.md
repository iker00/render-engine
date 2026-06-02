# Spec: data-values — pre-carga de datos fijos en queries

## Objetivo

Permitir que el runtime arranque con valores iniciales fijos en el estado de queries, sin necesidad de ejecutar una llamada API real. Los datos precargados son inmediatamente consumibles por el layout como si hubiera respondido la API, y quedan reemplazados en cuanto se ejecuta una operación con el mismo nombre.

## Alcance

- Nuevo artefacto de configuración `data-values`: un JSON independiente del config existente que mapea nombres de query a sus valores iniciales de `data`.
- En producción: el runtime lee `data-values` desde el atributo HTML `data-values` del elemento raíz (análogo a `data-config`).
- En desarrollo: existe un fichero local `src/dev/data-values.json` que el arranque de dev carga automáticamente si no hay atributo `data-values` en el elemento.
- Cada entrada del JSON inicializa el estado de `queries.{nombre}` con `status: "success"`, `data: <valor>` y `error: null` antes del primer render.
- Cualquier ejecución posterior de una operación con ese nombre (preload, `executeOperation`, acción de botón, submit) sobreescribe ese estado siguiendo la semántica habitual de queries.

## Fuera de alcance

- Modificar el JSON de `data-config` para incluir valores iniciales: `data-values` es un artefacto separado.
- Pre-cargar el estado de `status` o `error` con valores distintos a `success` / `null`.
- Resolución de referencias dinámicas dentro de los valores de `data-values` (los valores son literales JSON).
- Pre-carga de estado de formularios (`forms.*`) o navegación.
- Validación de que el nombre de la query exista como operación declarada en `api`.
- Hot-module replacement (HMR) del fichero `data-values.json` en desarrollo.

## Requisitos funcionales

1. **Carga en producción**: si el elemento raíz tiene el atributo `data-values`, el runtime parsea su contenido como JSON y aplica los valores al estado de queries antes de renderizar la primera página.
2. **Carga en desarrollo**: si no hay atributo `data-values`, el arranque de desarrollo carga `src/dev/data-values.json` y aplica los mismos valores.
3. **Inicialización del estado**: cada clave del JSON de `data-values` produce en `queries.{clave}` el estado `{ status: "success", data: <valor>, error: null }`.
4. **Precedencia de ejecución real**: cualquier ejecución posterior de una operación cuyo nombre coincida con una clave de `data-values` actualiza el estado de la query con el resultado real, sobreescribiendo los valores pre-cargados. Esta sobreescritura sigue exactamente la misma semántica que cualquier otra ejecución de query (incluyendo el reset a `loading` antes de la respuesta).
5. **Compatibilidad con preloads**: si una página tiene `preloads` que referencian una query pre-cargada, el mecanismo de reset de `pageEntry` limpia el estado pre-cargado y ejecuta el preload de la forma habitual.
6. **Comportamiento de cambio de página**: el estado pre-cargado sigue la misma política de limpieza que cualquier query — no se limpia en cambio de página salvo que intervenga un preload de esa página.
7. **JSON inválido en `data-values`**: si el JSON no es parseable, el runtime reporta un error de bootstrap claro y no arranca. No debe fallar silenciosamente ni ignorar el atributo.
8. **Ausencia del artefacto**: si no hay atributo `data-values` ni fichero `src/dev/data-values.json` en desarrollo, el runtime arranca sin datos pre-cargados, sin error.
9. **Formato del JSON**: el JSON de `data-values` es un objeto plano cuyas claves son nombres de query y cuyos valores son cualquier dato JSON válido (objeto, array, primitivo, null). No se admite un array en la raíz.

## Requisitos no funcionales

- El mecanismo de carga de `data-values` debe ser simétrico al de `data-config`: misma capa de bootstrap, misma política de errores de arranque.
- La inicialización del estado de queries a partir de `data-values` debe ocurrir antes del primer render para que los consumidores no vean un parpadeo de estado `idle`.
- El fichero de dev `src/dev/data-values.json` debe estar versionado en el repositorio como ejemplo representativo (puede tener contenido vacío `{}` como punto de partida).

## Criterios de aceptación

| # | Escenario | Resultado esperado |
|---|---|---|
| CA-1 | El elemento raíz tiene `data-values='{"searchUsers":[{"id":"1","name":"Juan"}]}'` | `queries.searchUsers` tiene `status: "success"`, `data: [{id:"1",name:"Juan"}]`, `error: null` en el primer render |
| CA-2 | Una query pre-cargada via `data-values` es referenciada desde `queries.searchUsers.data` en un nodo de layout | El nodo renderiza los datos sin esperar ninguna llamada API |
| CA-3 | `queryStateFeedback` con estado `success` sobre una query pre-cargada | Muestra el contenido de `success` desde el primer render |
| CA-4 | Una operación con el mismo nombre se lanza (preload o `executeOperation`) | El estado de la query transita a `loading` y después al resultado real, sobreescribiendo los datos pre-cargados |
| CA-5 | El atributo `data-values` contiene JSON inválido | El runtime no arranca y muestra un error de bootstrap legible |
| CA-6 | No hay atributo `data-values` ni fichero de dev | El runtime arranca normalmente; no hay error; `queries.*` comienza en `idle` salvo las queries que ya tenían otro mecanismo |
| CA-7 | En desarrollo, `src/dev/data-values.json` contiene entradas válidas | El runtime las carga como si fueran `data-values` del elemento raíz |
| CA-8 | Una entrada de `data-values` tiene el mismo nombre que una query en `api`, pero esa operación aún no se ha ejecutado | El dato pre-cargado permanece disponible y consumible sin que la operación se haya lanzado |
| CA-9 | Una entrada de `data-values` tiene un nombre que no existe en `api` | El runtime carga el dato sin error; `queries.{nombre}` queda en `success` aunque no haya operación declarada con ese nombre |

## Casos límite

- `data-values: {}` (objeto vacío): válido, no inicializa ninguna query.
- Valor `null` en una entrada: `queries.{nombre}.data` se inicializa a `null` con `status: "success"` (coherente con una respuesta 204 de la API).
- Valor primitivo (string, number, boolean) en una entrada: válido, `data` toma ese valor.
- Una página con `preloads` que incluye una query pre-cargada: el preload resetea el estado a `loading` y ejecuta; los datos pre-cargados no sobreviven al ciclo de reset del preload.
- Atributo `data-values` presente con `data-config` también presente: ambos se cargan de forma independiente; no interfieren entre sí.
- Fichero de dev `src/dev/data-values.json` presente pero con atributo `data-values` en el elemento: el atributo tiene precedencia (análogo a `data-config`).

## Áreas de producto afectadas

- Bootstrap del runtime (`src/app/`): lectura del nuevo atributo y del fichero de dev.
- Estado de queries (`src/runtime/`): inicialización previa al primer render con los valores pre-cargados.
- Modo desarrollo (`src/dev/`): nuevo fichero `data-values.json`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/queries/state-model.md`: estado inicial de queries y origen `data-values`.
- `ai-workflow/docs/app-features/development/local-config.md`: nuevo fichero de dev `data-values.json`.
- `ai-workflow/docs/current-state.md`: si cambia el estado del área "Desarrollo local" o "Queries".

## Riesgos o preguntas abiertas

Ninguno. Las decisiones de producto necesarias están resueltas.
