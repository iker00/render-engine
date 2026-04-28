# Design: Page entry query preloads

## Contexto
La feature `0009` ya dejó operativo `config.api`, el ejecutor remoto reusable en `src/queries/` y la fachada `executeQueryOperation(operationName)` para hidratar `queries.{operationName}` desde el store compartido del runtime. También existe ya navegación interna con `navigation.currentPageId` y selección visible de página desde `RuntimePage`.

Lo que todavía no existe es una orquestación declarativa al entrar en página. Eso abre tres riesgos si se implementa sin diseño previo:
- disparar precargas desde componentes visuales o tests ad hoc en lugar de desde un ciclo común del runtime
- dejar ambiguo qué estado agregado debe observar la UI cuando una página lanza varias precargas en paralelo
- mezclar la protección frente a tandas antiguas con un cambio silencioso del contrato individual de `queries.*`

## Objetivos / No objetivos

### Objetivos
- Añadir `preloads` al contrato de página como lista plana de nombres de operación ya declarados en `api`.
- Disparar automáticamente esas operaciones al entrar en la página activa, tanto en el arranque inicial como tras navegación interna.
- Reutilizar la semántica existente de `executeQueryOperation(operationName)` para cada query individual.
- Introducir un estado agregado mínimo de entrada de página, observable desde el store compartido, que distinga `sin precargas`, `loading`, `success` y `error`.
- Garantizar que el estado agregado final solo pueda ser cerrado por la entrada de página más reciente.

### No objetivos
- Abrir una nueva familia de referencias declarativas como `pageEntry.*` dentro del layout JSON en esta misma feature.
- Añadir cancelación real de requests, deduplicación, polling, caché avanzada o políticas alternativas de reentrada.
- Cambiar en silencio la semántica individual de `queries.{queryName}` para imponer latest-only entre ejecuciones concurrentes de la misma operación.
- Introducir orden secuencial, dependencias entre precargas o parámetros específicos por entrada.

## Decisiones

### 1. `preloads` entra en `pages[]` como lista opcional y plana de strings
Cada `RuntimePageConfig` podrá declarar:

```ts
preloads?: string[]
```

Reglas de contrato:
- `preloads` es opcional
- si existe, debe ser un array
- cada entrada debe ser un string no vacío
- la validación de bootstrap no exige que cada nombre exista en `api`; esa comprobación sigue ocurriendo en ejecución para conservar el error recuperable por query ya fijado en la spec

Razonamiento:
- la spec exige un shape simple de generar desde backend legacy
- validar existencia en bootstrap impediría el comportamiento acordado de “operación inexistente como error recuperable dentro de la tanda”

### 2. El runtime añade un dominio agregado mínimo de entrada de página dentro del store compartido
La feature añadirá un dominio nuevo en `RuntimeState` para la entrada activa:

```ts
interface RuntimePageEntryState {
  entryId: number
  pageId: string
  preloadNames: string[]
  status: 'idle' | 'loading' | 'success' | 'error'
}
```

Invariante visible:
- `status: 'idle'` representa explícitamente la entrada actual sin precargas a ejecutar
- `status: 'loading'` representa una tanda activa con al menos una operación pendiente
- `status: 'success'` significa que todas las precargas de esa tanda terminaron en éxito
- `status: 'error'` significa que al menos una precarga de esa tanda falló

No se abre todavía una familia de referencias `pageEntry.*` en `runtime-references/`. La observabilidad nueva queda limitada a store, selectors y hooks del runtime.

Razonamiento:
- la spec pide un ciclo observable común, pero no obliga todavía a convertirlo en dato consumible por el JSON
- mantenerlo primero en `runtime-state/` reduce el cambio y evita fijar demasiado pronto un namespace declarativo nuevo

### 3. La orquestación vive en `runtime-state-provider.tsx`, no en `RuntimePage` ni en `src/queries/`
El ciclo de entrada pertenece al runtime compartido, no a la vista de una página concreta ni a la capa HTTP. La implementación debe:
- observar `navigation.currentPageId`
- localizar la página activa en `config.pages`
- disparar sus `preloads` desde un efecto del provider
- despachar el estado agregado de entrada y los estados individuales de `queries.*`

`src/queries/` sigue siendo solo la frontera de construcción y ejecución remota. `RuntimePage` sigue limitado a renderizar el layout resuelto.

Razonamiento:
- el cambio se apoya en navegación + store + queries al mismo tiempo
- moverlo al provider evita acoplarlo a un consumidor visual específico y conserva la arquitectura descrita en `architecture.md`

### 4. La ejecución automática reutiliza la semántica individual existente, pero comparte un snapshot único de estado por entrada
Cada tanda de `preloads` debe capturar un único snapshot de `RuntimeState` al inicio de la entrada. Todas las operaciones de esa tanda construirán sus requests contra ese snapshot común.

Consecuencias:
- las precargas se lanzan en paralelo real
- una operación rápida no puede alterar el payload resuelto de otra precarga de la misma tanda
- la semántica de `executeQueryOperation(operationName)` se conserva para cada query individual: `loading`, `success`, `error`, preservación del último `data` válido durante recargas y mismos códigos de error normalizados

Para evitar divergencia entre la fachada imperativa y los `preloads`, el provider debería compartir un helper interno que:
- ponga la query en `loading`
- ejecute `executeRuntimeApiOperation(...)` con un snapshot explícito
- despache `set-success` o `set-error`
- devuelva el resultado normalizado para que la tanda agregada pueda cerrarse

Razonamiento:
- sin snapshot común, dos precargas de la misma entrada podrían depender accidentalmente del orden de resolución
- reutilizar un único helper evita que la fachada imperativa y la automática diverjan en errores o transiciones

### 5. El agregado de entrada es latest-only; las queries individuales no cambian su contrato en esta feature
El provider mantendrá un contador monótono `entryId` por entrada de página. Cada tanda:
- registra su `entryId` al empezar
- deja el agregado en `loading` o `idle` según haya `preloads`
- al completarse, solo puede cerrar el agregado si su `entryId` sigue siendo el activo

Las respuestas tardías de una tanda antigua:
- sí pueden seguir cerrando sus queries individuales con la semántica ya existente
- no pueden reescribir el agregado de la entrada más reciente

Razonamiento:
- esto satisface el criterio de aceptación de latest-only donde la spec lo exige
- evita ampliar sin acuerdo el alcance de `0009` hacia control de concurrencia por query, cancelación o deduplicación

### 6. El resultado agregado final se calcula con `Promise.allSettled` semántico sobre resultados normalizados
La tanda de entrada:
- lanza todas las operaciones en paralelo
- espera a que todas terminen
- queda en `success` solo si todas devolvieron éxito
- queda en `error` si al menos una devolvió error

No se cancela la tanda cuando falla una precarga. Las queries exitosas conservan sus datos aunque el agregado final sea `error`.

Razonamiento:
- la spec exige paralelismo sin orden secuencial
- también exige que un éxito parcial preserve datos útiles mientras el agregado refleje error global

## Riesgos y trade-offs
- Riesgo: dejar ambiguo qué significa `idle`.
  Mitigación: fijarlo contractualmente como “entrada actual sin precargas”, no como estado inicial genérico.

- Riesgo: que la fachada imperativa y la automática diverjan en cómo cargan o fallan las queries.
  Mitigación: compartir un helper interno en el provider para ejecutar una operación contra un snapshot explícito.

- Riesgo: asumir latest-only también para `queries.*` y romper silenciosamente la semántica previa de `0009`.
  Mitigación: limitar la protección latest-only al agregado de entrada y documentar ese límite.

- Riesgo: que varias precargas de una misma tanda resuelvan referencias contra estados distintos.
  Mitigación: capturar un snapshot único de `RuntimeState` al comienzo de la entrada.

- Riesgo: crecer demasiado la feature abriendo ya consumidores declarativos de `loading/error/empty`.
  Mitigación: dejar el nuevo estado observable en store/selectors y posponer el namespace declarativo a una iteración posterior.

## Migración o despliegue
No hay migración persistida ni despliegue especial.

Compatibilidad:
- configuraciones sin `preloads` siguen siendo válidas
- una página sin `preloads` mantiene el comportamiento actual, salvo por el nuevo estado agregado interno `idle`
- las configuraciones que declaren un nombre inexistente en `preloads` no fallan en bootstrap; el error aparece en ejecución sobre `queries.{operationName}` y en el agregado de la tanda

## Preguntas abiertas
- No quedan preguntas abiertas que bloqueen implementación dentro del alcance actual.
- La exposición declarativa futura del ciclo agregado al layout queda fuera de esta fase y deberá abrirse como feature separada si se necesita un namespace de referencias nuevo.
