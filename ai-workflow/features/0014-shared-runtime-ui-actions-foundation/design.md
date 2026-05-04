# Design: Shared runtime UI actions foundation

## Contexto
La feature `0011` ya introdujo `button.props.action`, pero solo como contrato específico de navegación y con un ejecutor igualmente específico en `src/runtime/runtime-actions/runtime-navigation-action-executor.ts`. Al mismo tiempo, el provider ya expone primitivas reutilizables para otros dominios del runtime:
- `navigateToPage(pageId)`
- `goBackPage()`
- `executeQueryOperation(operationName)`
- `resetForm(formId)`

La necesidad de `0014` no es añadir otra acción aislada al botón, sino convertir esa superficie en una base común reutilizable por futuros triggers sin reabrir el contrato otra vez. Si se implementa sin diseño previo, quedan abiertas cuatro interpretaciones peligrosas:
- mantener `ButtonAction` como tipo específico del botón y volver a romper la reutilización cuando lleguen `form`, `link` u otros nodos interactivos
- validar `resetForm` contra un catálogo de formularios que hoy no existe en el config
- repartir la semántica de ejecución entre el nodo visual, helpers ad hoc y el provider
- mezclar la nueva base común con un sistema general de `events` fuera del alcance de esta spec

## Objetivos / No objetivos

### Objetivos
- Convertir `action` en un contrato común del runtime, aunque en esta iteración solo lo consuma `button`.
- Ampliar el catálogo soportado a `navigateTo`, `goBack`, `executeOperation` y `resetForm`.
- Reutilizar íntegramente la semántica ya estable de navegación, ejecución remota y reseteo de formularios.
- Mantener la compatibilidad visible de `button.props.action` para los configs existentes.
- Validar antes del render los shapes inválidos y las referencias semánticas que sí pueden cerrarse en bootstrap.

### No objetivos
- Introducir ahora `events`, `onClick`, `onSubmit` o un mapa general de triggers.
- Soportar varias acciones por trigger, secuencias, branching o callbacks por éxito/error.
- Añadir un estado efímero común de acciones para loading, disabled, progreso o error.
- Añadir acciones nuevas fuera del catálogo inicial como `resetQuery`, `refetchQuery` o navegación externa.
- Cambiar la semántica estable del provider, de `preloads`, del historial o del dominio `queries`.

## Decisiones

### 1. El contrato común pasa a ser `RuntimeUiAction`, pero `button.props.action` se mantiene
La base compartida debe dejar de modelarse como `ButtonAction` específico del nodo. El contrato técnico recomendado es un tipo común, por ejemplo `RuntimeUiAction`, con esta familia inicial:

```ts
type RuntimeUiAction =
  | { type: 'navigateTo'; pageId: string }
  | { type: 'goBack' }
  | { type: 'executeOperation'; operationName: string }
  | { type: 'resetForm'; formId: string }
```

`button.props.action` seguirá usando exactamente la misma clave pública `action`, pero ahora apuntando al contrato común en vez de a un subtipo solo de navegación.

Razonamiento:
- la compatibilidad visible del botón se conserva
- el contrato deja de quedar acoplado al primer trigger que lo consume
- futuras features podrán reutilizar la misma unión sin renombrados engañosos

### 2. La validación previa al render debe separar checks estructurales y checks semánticos posibles
La validación del config debe rechazar:
- tipos de acción no soportados
- parámetros obligatorios ausentes o vacíos
- `navigateTo.pageId` hacia una página inexistente
- `executeOperation.operationName` hacia una operación inexistente en `api`

En cambio, **no** debe intentar rechazar `resetForm.formId` por inexistencia en bootstrap, porque el contrato actual no declara formularios dentro de `pages[].layout` y no existe todavía un catálogo semántico cerrado de `formId` comparable al de `pages` o `api`.

Para `resetForm`, la validación cerrable en esta feature es:
- `type === 'resetForm'`
- `formId` string no vacío

Razonamiento:
- evita prometer una validación imposible con el contrato actual
- mantiene la regla de que solo se validan en bootstrap las referencias cuyo catálogo sí existe en el JSON
- deja la semántica de formulario inexistente donde ya vive hoy: en el dominio de estado compartido, sin inventar un error nuevo de contrato

### 3. El ejecutor de acciones debe centralizarse en `src/runtime/runtime-actions/`
La implementación debe sustituir el ejecutor específico de navegación por una capa común de ejecución de acciones UI, por ejemplo `executeRuntimeUiAction(action, handlers)`.

El mapeo esperado es directo:
- `navigateTo` -> `navigateToPage(pageId)`
- `goBack` -> `goBackPage()`
- `executeOperation` -> `void executeQueryOperation(operationName)`
- `resetForm` -> `resetForm(formId)`

`executeOperation` seguirá siendo asíncrona y se lanzará sin abrir un nuevo estado intermedio del botón. El resultado visible seguirá proyectándose exclusivamente en `queries.{operationName}`.

Razonamiento:
- mantiene la lógica de interpretación fuera del nodo visual
- evita duplicar semántica ya estable del provider
- deja una pieza lista para futuros triggers sin que `button` vuelva a ser el centro del diseño

### 4. `ButtonNode` sigue siendo un trigger mínimo y no un subsistema de eventos
`ButtonNode` debe conservar una responsabilidad estrecha:
- renderizar el `<button type="button">`
- aplicar la convención visual existente
- delegar la acción declarada al ejecutor común al hacer click

No debe:
- conocer la semántica de red, navegación o formularios
- esperar promesas para gestionar loading
- introducir props específicas por tipo de acción

Razonamiento:
- respeta la separación entre contrato, ejecución y presentación
- impide que la feature derive silenciosamente en un diseño de eventos general

### 5. La semántica existente de cada dominio se reutiliza sin reinterpretación
- `navigateTo` sigue validándose contra `pages` y usa la navegación interna actual.
- `goBack` sigue usando el historial interno y permanece en `no-op` sin historial.
- `executeOperation` sigue escribiendo en `queries.{operationName}` y conserva los mismos códigos de error (`operation-not-found`, `request-build-failed`, `network-error`, `http-error`, `invalid-json-response`).
- `resetForm` sigue restaurando el estado inicial efectivo del formulario cuando ese formulario ya está inicializado en el store.

La feature no introduce estados visibles nuevos ni altera `queryStateFeedback`, `pageEntry` o la política latest-only de `preloads`.

### 6. La regresión debe fijar compatibilidad hacia atrás y el límite exacto de la base común
La regresión final debe demostrar:
- que los botones existentes de navegación siguen funcionando sin cambios observables
- que `executeOperation` y `resetForm` quedan operativos desde `button.props.action`
- que una configuración previa sin estas acciones nuevas no necesita migración
- que la base común sigue siendo una única acción por trigger y no abre composición implícita

## Riesgos y trade-offs
- Riesgo: mantener nombres y helpers demasiado ligados al botón.
  Mitigación: promover la unión a un tipo común del runtime y usar un ejecutor genérico.

- Riesgo: prometer validación semántica de `resetForm` que el contrato actual no puede cumplir.
  Mitigación: limitar el bootstrap a validar shape y `formId` no vacío, documentando explícitamente el límite.

- Riesgo: introducir lógica asíncrona visible en el botón para `executeOperation`.
  Mitigación: reutilizar solo el dominio `queries` como superficie de resultado, sin estado efímero nuevo.

- Riesgo: mezclar esta base común con la futura feature de `events`.
  Mitigación: fijar expresamente que `button` sigue siendo un trigger implícito y único en esta iteración.

## Migración o despliegue
No hay migración persistida.

Compatibilidad esperada:
- los configs existentes con `button.props.action` de navegación siguen siendo válidos
- la unión común amplía capacidad, pero no cambia las claves públicas del botón
- no se requiere cambiar `preloads`, `queryStateFeedback` ni la API pública del provider

## Preguntas abiertas
- No quedan preguntas abiertas que bloqueen la implementación dentro del alcance de la spec actual.
- La generalización futura a `events` o a otros triggers queda explícitamente fuera de esta feature.
