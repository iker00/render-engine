# Arquitectura del proyecto

## Objetivo de la arquitectura
Describir la arquitectura estable de la aplicación para que las features nuevas se apoyen en una estructura clara y no tengan que deducir desde cero cómo se separan render, estado, validación e integraciones.

## Módulos principales
- `app/`: arranque, composición raíz, lectura de configuración desde `src/dev/config.json` o `data-config` y surface de errores visibles.
- `config/`: fachada pública del contrato, tipos del runtime config y validación estructural del árbol `layout` y del catálogo declarativo `api`.
- `queries/`: construcción de requests, composición entre operación base y request params por ejecución, ejecución de operaciones remotas por nombre y normalización de errores de red o respuesta.
- `runtime/`: renderer de layout, estado compartido por instancia del runtime, dispatcher central por tipo de nodo, piezas concretas por nodo soportado, resolución de referencias y composición de la página resuelta desde navegación interna.
- `tests/`: tests del bootstrap, validación de configuración, renderer visible y estado compartido del runtime.

## Estructura estable vigente

```txt
src/
  app/
    bootstrap/
  config/
    runtime-config.ts
    runtime-config-types.ts
    runtime-config-validation-errors.ts
    runtime-config-zod.ts
    validate-runtime-config.ts
  queries/
    runtime-api-types.ts
    runtime-api-request.ts
    runtime-api-executor.ts
  runtime/
    layout-renderer.tsx
    layout-node-renderer.tsx
    form-context.tsx
    runtime-collection-sources.ts
    runtime-query-state-feedback.ts
    runtime-node-styling.ts
    runtime-page.tsx
    runtime-actions/
      runtime-navigation-action-executor.ts
      runtime-ui-action-executor.ts
    runtime-references/
      runtime-reference-diagnostics.ts
      runtime-reference-parser.ts
      runtime-reference-resolver.ts
      runtime-reference-types.ts
    runtime-state/
      runtime-state-context.ts
      runtime-state-provider.tsx
      runtime-state-reducer.ts
      runtime-state-selectors.ts
      runtime-state-types.ts
    nodes/
      button-layout-node.tsx
      container-layout-node.tsx
      form-layout-node.tsx
      heading-layout-node.tsx
      input-layout-node.tsx
      list-layout-node.tsx
      radio-group-layout-node.tsx
      paragraph-layout-node.tsx
      checkbox-group-layout-node.tsx
      select-layout-node.tsx
      textarea-layout-node.tsx
  tests/
```

Lectura operativa de esa estructura:
- `runtime-config.ts` mantiene una superficie pública austera para no acoplar consumidores a la organización interna.
- `runtime-config-zod.ts` concentra el contrato estructural interno con esquemas `Zod` y política de descarte de claves extra.
- `runtime-config-validation-errors.ts` adapta fallos estructurales y semánticos al shape público de `RuntimeConfigError`.
- `validate-runtime-config.ts` concentra la validación previa al render, fija el contrato estable de `config.api` y reintroduce las validaciones cruzadas que dependen del conjunto completo ya parseado.
- `queries/` encapsula la frontera HTTP del runtime: resolución de payloads, merge estable entre request base y overrides por ejecución, construcción de `RequestInit`, ejecución contra `fetch` y errores normalizados.
- `layout-renderer.tsx` conserva la responsabilidad de renderizar colecciones ordenadas de nodos.
- `layout-node-renderer.tsx` es el punto central de resolución `type -> pieza de render` y del borde transversal que decide si el nodo se muestra, se oculta o se sustituye por un fallback local.
- `runtime-layout-visibility.ts` centraliza la visibilidad efectiva de cualquier nodo, combinando `queryStateFeedback` y `visibility` con una única precedencia reutilizable por renderer y formularios.
- `form-context.tsx` propaga el `formId` efectivo a cualquier descendiente del árbol del formulario sin exigir props manuales repetidas.
- `runtime-actions/` concentra la traducción `action.type -> handler del provider`, de modo que el nodo visual solo dispara el contrato común y no reimplementa navegación, queries ni formularios.
- `runtime-collection-sources.ts` centraliza la resolución de colecciones efectivas para consumidores multi-valor, separando origen (`values` manuales o `queries.*`) de la proyección final que necesita cada nodo y de la normalización común de selección simple o múltiple para `select`, `radioGroup` y `checkboxGroup`.
- `runtime-node-styling.ts` concentra la convención visual base del runtime y la compatibilidad acotada para `gap` arbitrarios.
- `runtime-query-state-feedback.ts` concentra la derivación `idle | loading | error | empty | success`, la heurística común de `empty` y la resolución de defaults efectivos de `queryStateFeedback`.
- `runtime-references/` fija la semántica central de referencias string, distingue `literal | supported | unsupported | invalid`, soporta `forms.*`, `queries.*` y `params.*` dentro de su frontera actual y evita lógica dispersa en nodos visuales.
- `runtime-state/` concentra un store por instancia basado en `useReducer` + `Context`, con dominios separados para navegación, formularios, queries y `pageEntry`, historial parametrizado por entrada y fachada mínima para navegación, formularios, queries y lectura consistente del último snapshot sin absorber la lógica de red.
- `runtime/nodes/` materializa solo nodos con uso real inmediato, incluido el catálogo actual de formularios declarativos con selección simple y múltiple compartida.
- `runtime-page.tsx` ya no decide la página visible por selección ad hoc; la resuelve desde el estado compartido del runtime.

## Módulos previstos para próximas features
- `components/`: componentes visuales soportados por futuras ampliaciones del renderer declarativo.
- `queries/`: ampliaciones futuras para refetch declarativo y consumidores visuales apoyados en la frontera remota ya existente.
- `devtools/`: soporte de desarrollo local para cargar y editar configuración sin backend.
- `shared/`: utilidades, adaptadores y piezas reutilizables entre módulos.

## Principios estructurales
- Separar interpretación de configuración y presentación.
- Mantener la red y las llamadas API fuera de los componentes visuales.
- Resolver referencias declarativas en una capa explícita de runtime.
- Validar la configuración antes de intentar renderizarla.
- Tratar la navegación interna como estado de aplicación, no como routing del navegador en la primera versión.

## Decisiones estables iniciales
- El repositorio arranca como frontend de paquete único en la raíz.
- El contrato operativo base del proyecto es `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint` y `pnpm test`.
- La entrada de producción será `data-config` en el elemento root HTML.
- En desarrollo existe una fuente local versionada en `src/dev/config.json` para iterar sin backend.
- La configuración se valida antes de renderizar y falla con errores semánticos explícitos cuando `initialPage` o `layout` no cumplen el contrato soportado.
- La validación estructural interna del runtime config se apoya en `Zod`, pero bootstrap y tests siguen consumiendo una única fachada pública estable con códigos de error semánticos.
- La primera UI estable del runtime es un renderer estático para `container`, `heading`, `paragraph` y `list`.
- La organización interna del runtime separa contrato, validación, render de colecciones y render concreto por nodo sin cambiar el comportamiento observable.
- La presentación base de los nodos visibles del runtime se expresa con utilidades de `Tailwind`, con una excepción acotada basada en variable CSS para `container.props.gap` cuando llega un valor arbitrario.
- El runtime crea un store compartido aislado por instancia, con `useReducer` + `Context`, para sostener navegación, formularios y queries sin depender todavía de subsistemas visuales separados.
- La navegación visible ya se resuelve desde `navigation.currentPageId`, pero la unidad histórica real es una entrada con `entryId`, `pageId` y `params`; la URL del navegador queda fuera del contrato de esta primera capa interactiva.
- La resolución de referencias declarativas vive en `src/runtime/runtime-references/`, soporta `params.{paramName}` como namespace plano adicional y sigue abriendo navegación anidada solo bajo `queries.{queryName}.data.*`.
- La navegación de subrutas de query usa una semántica iterativa única: índices solo sobre arrays, claves literales sobre objetos y resultado `missing` para rutas bien formadas cuyo dato no está disponible.
- La ejecución remota declarativa vive en `src/queries/`, reutiliza la convención central de referencias del runtime, compone allí mismo la operación `api` base con `requestParams` por ejecución y deja sus resultados visibles solo a través de `queries.{operationName}`.
- La orquestación automática de `preloads` vive en `runtime-state-provider.tsx`, reutiliza la frontera `src/queries/`, captura un snapshot común del estado por entrada ya parametrizada, se dispara por la entrada activa y limita la semántica latest-only al agregado `pageEntry`, no a las queries individuales.
- La interpretación de `button.props.action` ya no vive en el propio nodo visual: un ejecutor común en `src/runtime/runtime-actions/` delega en los handlers del provider para `navigateTo`, `goBack`, `executeOperation` y `resetForm`.
- La semántica declarativa de feedback por query vive fuera de los nodos visuales concretos: el renderer central consulta `queries.{queryName}`, deriva un estado visible único y decide entre nodo original, ocultación o fallback local reutilizando `LayoutRenderer`.
- La visibilidad efectiva de nodos y campos ya no depende solo de `queryStateFeedback`: una capa compartida combina esa semántica con reglas `visibility` basadas en `forms.*` y `queries.*`, manteniendo la precedencia `queryStateFeedback` antes de `visibility`.
- Los formularios declarativos viven íntegramente dentro de `runtime/`: `form` actúa como frontera de inicialización, validación `required` y submit, mientras los campos leen y escriben solo en `forms.{formId}.{fieldId}`.
- La decisión de visibilidad efectiva de un nodo se reutiliza tanto en render como en validación de submit para evitar divergencias entre `queryStateFeedback`, `visibility` y reglas `required`.
- `list` y `select` reutilizan una misma capa de resolución de colecciones para evitar semánticas divergentes entre catálogo visual, formularios y estado compartido.
- Los errores de bootstrap y validación deben ser diagnósticos en desarrollo; en producción, los errores marcados como solo de desarrollo degradan sin mensaje visible genérico.
