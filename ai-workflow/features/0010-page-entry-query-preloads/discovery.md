# Discovery: Page entry query preloads

## Problema a resolver
El runtime ya puede ejecutar operaciones declaradas en `api` y compartir su estado en `queries.{operationName}`, pero todavía no puede lanzar esas operaciones de forma declarativa al entrar en una página. Eso deja fuera un caso base del producto: cargar datos al abrir una pantalla y exponer un ciclo compartido de carga y resultado para que varias zonas del layout reaccionen al mismo proceso sin duplicar lógica imperativa.

## Contexto funcional relevante
- `pages` e `initialPage` ya forman un modelo estable y la página visible se resuelve desde `navigation.currentPageId`.
- El estado compartido de queries ya existe por instancia y conserva `status`, `data` y `error` por nombre de operación.
- La frontera `api` ya es operativa: el runtime puede ejecutar una operación por nombre mediante `executeQueryOperation(operationName)`.
- La documentación funcional ya anticipa `preloads` a nivel de página, pero hoy sigue siendo una capacidad pendiente y sin contrato cerrado de ejecución observable.
- La petición añade dos necesidades acopladas:
  - disparo declarativo de queries al entrar en una página
  - un estado observable del ciclo de carga de esa entrada para que varios bloques de UI reaccionen al mismo proceso

## Supuestos actuales
- La declaración de `preloads` debería vivir en la página, no en nodos visuales concretos.
- La ejecución al entrar en página debería reutilizar la frontera `api` y el dominio `queries` ya existentes, en lugar de abrir un subsistema remoto paralelo.
- Entrar en una página incluye tanto el arranque inicial sobre `initialPage` como la navegación interna posterior a otra página.
- La carga visible de una pantalla no debería exigir que cada bloque conozca cómo disparar la query; debería bastar con observar estado compartido del runtime.
- Varias zonas del layout pueden necesitar reaccionar al mismo ciclo de entrada aunque consuman datos o mensajes distintos.

## Preguntas abiertas
- Qué shape funcional exacto tendrá `preloads`: solo array de nombres de operación o una estructura más rica con opciones de comportamiento.
- Si las precargas deben ejecutarse siempre en paralelo o si hace falta permitir orden/secuencialidad en algunos casos.
- Qué semántica debe tener reentrar en una página ya visitada: volver a disparar siempre, reutilizar estado previo o permitir ambas estrategias.
- Qué expone exactamente el “estado observable” compartido:
  - solo los estados individuales ya existentes en `queries.*`
  - un ciclo agregado por página o por entrada de navegación
  - ambos
- Cómo se considera el resultado global cuando una página tiene varias precargas y algunas fallan mientras otras tienen éxito.
- Si el layout debe poder reaccionar al ciclo de entrada aunque todavía no exista el consumidor visual declarativo final de `loading`, `error` y `empty`.

## Riesgos detectados
- Si se apoya todo solo en `queries.{name}.status`, la UI puede perder la noción de un ciclo común de entrada de página cuando haya varias precargas simultáneas.
- Si se introduce un estado agregado demasiado específico, la feature puede cerrar prematuramente un modelo que después también necesitarán refetch o acciones mutadoras.
- La semántica de reentrada y recarga afecta comportamiento visible, caching percibido y expectativas de UX; no conviene asumirla en silencio.
- El cambio toca contrato, validación, navegación, estado compartido y orquestación remota; hay complejidad transversal suficiente como para requerir diseño técnico antes de implementar.

## Áreas o documentos a revisar después
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/architecture.md`
- `src/config/validate-runtime-config.ts`
- `src/runtime/runtime-state/`
- `src/queries/`

## Recomendación final
Requiere decisión de producto antes de `spec.md`.

La dirección general está clara: reutilizar `api` + `queries` y permitir `preloads` declarativos al entrar en página. Lo que todavía bloquea una `spec.md` estable es fijar el contrato observable: shape de `preloads`, semántica de reentrada y granularidad del ciclo compartido que la UI podrá observar. Una vez cerradas esas tres decisiones, la feature debería pasar directamente a `spec.md` con riesgo alto y `design.md` previsto.
