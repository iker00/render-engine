# Spec: `0075-form-on-error-actions`

## Objetivo

Permitir que el nodo `form` defina una secuencia de acciones a ejecutar automáticamente cuando el submit falla (error de API o error de negocio), con el mismo nivel de expresividad que `submitAction.onSuccess`.

## Alcance

Añadir `submitAction.onError` al contrato del nodo `form` con semántica simétrica a `onSuccess`.

## Fuera de alcance

- Ejecutar `onError` cuando el submit falla por validación local de campos; esa situación sigue resolviéndose exclusivamente con mensajes de validación inline.
- Añadir `resetOnError`; no hay necesidad declarada y no forma parte de la simetría solicitada.
- Modificar el comportamiento de `onSuccess`, `resetOnSuccess` ni ninguna otra propiedad de `submitAction`.
- Introducir un canal de estado paralelo para el resultado del submit; el resultado sigue viviendo exclusivamente en `queries.{operationName}`.

## Requisitos funcionales

1. `submitAction.onError` acepta una lista ordenada de acciones del catálogo de botón: `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`.
2. Cada acción de `onError` puede declarar opcionalmente `when` con el mismo shape que `visibility`: `{ reference, operator, value? }`.
3. Las acciones se evalúan y ejecutan en el orden declarado; todas las que cumplan su condición `when` se ejecutan sin semántica de primera coincidencia.
4. Una acción sin `when` siempre se ejecuta.
5. Si la condición `when` no se cumple, la acción se omite silenciosamente.
6. `onError` se ejecuta cuando el submit termina en fallo por error HTTP o por error de negocio vía `errorCondition` (feature `0060`).
7. `onError` **no** se ejecuta cuando el submit falla por validación local de campos.
8. `onError` **no** se ejecuta cuando el submit tiene éxito.
9. Con `submitAction.type: executeOperations` (plural), `onError` se ejecuta si **alguna** de las operaciones de la lista termina en error, simétricamente al comportamiento de `onSuccess` que requiere que todas tengan éxito.
10. Las referencias `queries.{operationName}.*` ya reflejan el estado `error` (incluyendo `error.message` y `error.code`) antes de que se evalúen los `when` de las acciones `onError`.
11. `onSuccess` y `onError` pueden coexistir en el mismo `submitAction`; se ejecuta únicamente el bloque que corresponda al resultado del submit.
12. `resetOnSuccess` no interacciona con `onError`; su ejecución sigue siendo posterior a `onSuccess` y no se ve afectada por la presencia de `onError`.

## Requisitos no funcionales

- La validación del JSON de configuración debe rechazar `onError` con las mismas reglas que `onSuccess`: tipos de acción no soportados, acciones con shape incorrecto o `when` con shape inválido.
- La validación debe producir diagnósticos de ruta exacta, igual que el resto de validaciones del nodo `form`.

## Criterios de aceptación

- Un formulario con `onError` declarado ejecuta las acciones cuando el submit termina en error de API.
- Un formulario con `onError` declarado ejecuta las acciones cuando el submit termina en error de negocio (`errorCondition`).
- Un formulario con `onError` declarado **no** ejecuta las acciones cuando el submit tiene éxito.
- Un formulario con `onError` declarado **no** ejecuta las acciones cuando el submit falla por validación local.
- Las condiciones `when` en `onError` se evalúan correctamente referenciando `queries.{operationName}.error.message` y `queries.{operationName}.error.code`.
- Con `executeOperations`, `onError` se activa si al menos una operación falla, incluso si otras tienen éxito.
- `onSuccess` y `onError` coexisten en el mismo formulario sin interferencia mutua.
- Una configuración con `onError` que contenga tipos de acción inválidos se rechaza antes del render con diagnóstico de ruta.

## Casos límite

- `onError: []` (lista vacía) es válido y no produce efecto; no debe rechazarse en validación.
- Si la misma operación aparece varias veces en `executeOperations` y una instancia falla, `onError` se activa aunque otras instancias de la misma operación tengan éxito.
- Si `onError` incluye una acción `executeOperation` o `executeOperations` que a su vez falla, ese fallo secundario no dispara recursivamente otro ciclo de `onError`; las acciones de `onError` son terminales.
- Si `onError` incluye una acción `resetForm` y el formulario ya no está montado, el comportamiento es el mismo que para `resetForm` en cualquier otro contexto: pantalla estable, sin error.

## Áreas de producto afectadas

- Nodo `form`: contrato de `submitAction`, validación previa al render.
- Documentación de submit: `ai-workflow/docs/app-features/forms/submit.md` y `ai-workflow/docs/app-features/nodes/form.md`.

## Riesgos o preguntas abiertas

Ninguno. La simetría con `onSuccess` resuelve todos los comportamientos sin ambigüedad.
