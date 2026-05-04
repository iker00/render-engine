# Discovery: Shared runtime UI actions foundation

## Problema a resolver
El runtime ya tiene capacidades aisladas para navegar entre páginas, ejecutar operaciones `api`, relanzar queries y resetear formularios, pero cada una vive hoy en una superficie distinta y sin una fachada declarativa común para eventos disparados por la UI.

En el estado actual:
- `button` conoce una acción específica de navegación en `props.action`
- el nodo `button` llama a un ejecutor dedicado de navegación
- el provider expone handlers sueltos como `navigateToPage`, `goBackPage`, `executeQueryOperation`, `resetForm`
- no existe todavía una base común para que distintos triggers de UI reutilicen el mismo modelo de acción sin lógica imperativa ad hoc

La petición busca fijar esa base compartida para que el runtime pueda declarar acciones UI como navegar, llamar endpoints, relanzar queries o resetear formularios desde un contrato coherente y extensible.

## Contexto funcional relevante
- La feature `0011` introdujo `button` y navegación declarativa, pero con una forma deliberadamente específica: `button.props.action` solo soporta `navigateTo | goBack`.
- La feature `0009` ya dejó operativa la ejecución remota por nombre mediante `executeQueryOperation(operationName)`, con construcción de requests desde el estado del runtime y códigos de error estables.
- La feature `0010` ya resuelve `preloads` declarativos al entrar en página, así que existe un precedente de orquestación declarativa de operaciones remotas, aunque no disparada por eventos de UI.
- El dominio `forms` ya soporta reset por formulario en el store compartido, pero todavía no existe una UI declarativa de formularios ni un submit declarativo final.
- El runtime ya centralizó dos capas transversales importantes:
  - referencias dinámicas en `src/runtime/runtime-references/`
  - feedback visual por estado de query en `queryStateFeedback`
- El único ejecutor de acciones del runtime hoy es `src/runtime/runtime-actions/runtime-navigation-action-executor.ts`, lo que confirma que todavía no hay una familia general de acciones del runtime.

## Supuestos actuales
- La base común debe reutilizar las primitivas existentes del runtime en lugar de duplicarlas: navegación, ejecución remota y reset de formularios ya tienen semántica funcional previa.
- La primera versión no necesita abrir un motor completo de automatización con condiciones arbitrarias, expresiones generales o flujos asíncronos complejos.
- La capa común debería servir para más de un trigger futuro, no solo para `button`; los candidatos obvios son submit de formularios, enlaces u otros eventos de interacción.
- La evolución debe preservar compatibilidad razonable con la navegación declarativa ya existente en `button`, o al menos ofrecer una migración clara.
- `refetch` probablemente no deba modelarse como un subsistema distinto si la query ya está definida por nombre en `api`; funcionalmente puede ser la misma primitiva de ejecutar una operación declarada otra vez.

## Preguntas abiertas
- Cuál debe ser la superficie declarativa base del trigger:
  - mantener `button.props.action` y generalizar solo el catálogo interno de acciones
  - introducir ya una forma común como `onClick` o `events`
  - definir una transición compatible entre ambas
- Si un evento UI debe soportar:
  - exactamente una acción
  - una lista ordenada de acciones
  - una lista con política explícita de fallo o continuación
- Qué catálogo mínimo entra en la primera spec de esta base común:
  - solo `navigateTo`, `goBack`, `executeOperation`, `resetForm`
  - o también follow-ups como refetch tras éxito, limpieza de query o navegación condicionada al resultado
- Si `refetchQuery` debe existir como acción explícita o si la acción estable debe ser simplemente `executeOperation(queryName)` reutilizando la operación declarada en `api`.
- Cómo se expresa el resultado visible de acciones disparadas por la UI:
  - reaprovechando únicamente el estado persistente ya existente (`queries.*`, `forms.*`, `navigation.*`)
  - o añadiendo estado efímero de evento/acción para loading, error o disabled

## Riesgos detectados
- Si la feature se limita a “extraer helpers” sin fijar contrato JSON compartido, no resolverá el problema funcional pedido y seguirá existiendo acoplamiento ad hoc en los nodos interactivos.
- Si la nueva base se diseña demasiado alrededor de `button`, volverá a aparecer la misma rigidez al introducir submit de formularios u otros triggers.
- Si se abre demasiado pronto un sistema de acciones encadenadas, callbacks por éxito/error o branching declarativo, la v1 puede volverse innecesariamente ambiciosa y difícil de validar.
- La decisión impacta validación de config, tipos públicos, renderer, runtime-actions, provider y futuras features de formularios, así que la complejidad transversal justifica `design.md`.
- Cambiar la forma de `button` demasiado pronto puede generar fricción con la feature `0011`, ya implementada y documentada como comportamiento estable.

## Documentos o áreas a revisar después
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/features/0011-declarative-page-navigation-actions/`
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config-zod.ts`
- `src/config/validate-runtime-config.ts`
- `src/runtime/nodes/button-layout-node.tsx`
- `src/runtime/runtime-actions/`
- `src/runtime/runtime-state/runtime-state-provider.tsx`

## Recomendación final
Requiere decisión de producto antes de `spec.md`.

La necesidad está clara y el hueco funcional también: el runtime ya tiene primitivas suficientes para una base común de acciones UI, pero todavía faltan decisiones de contrato que cambian materialmente la spec:
- la superficie declarativa inicial del evento o trigger
- si la unidad base es una acción única o una secuencia de acciones
- si la primitiva remota estable será `executeOperation` por nombre o una familia más específica (`refetchQuery`, mutaciones con follow-ups, etc.)

Cuando esas decisiones queden cerradas, la feature debería pasar a `spec.md` con riesgo alto y `design.md` previsto, porque afectará a un contrato transversal del runtime y no solo a un nodo concreto.
