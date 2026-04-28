# Arquitectura del proyecto

## Objetivo de la arquitectura
Describir la arquitectura estable de la aplicación para que las features nuevas se apoyen en una estructura clara y no tengan que deducir desde cero cómo se separan render, estado, validación e integraciones.

## Módulos principales
- `app/`: arranque, composición raíz, lectura de configuración desde `src/dev/config.json` o `data-config` y surface de errores visibles.
- `config/`: fachada pública del contrato, tipos del runtime config y validación estructural del árbol `layout` y del catálogo declarativo `api`.
- `queries/`: construcción de requests, ejecución de operaciones remotas por nombre y normalización de errores de red o respuesta.
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
    validate-runtime-config.ts
  queries/
    runtime-api-types.ts
    runtime-api-request.ts
    runtime-api-executor.ts
  runtime/
    layout-renderer.tsx
    layout-node-renderer.tsx
    runtime-node-styling.ts
    runtime-page.tsx
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
      container-layout-node.tsx
      heading-layout-node.tsx
      list-layout-node.tsx
      paragraph-layout-node.tsx
  tests/
```

Lectura operativa de esa estructura:
- `runtime-config.ts` mantiene una superficie pública austera para no acoplar consumidores a la organización interna.
- `validate-runtime-config.ts` concentra la validación previa al render y fija también el contrato estable de `config.api`.
- `queries/` encapsula la frontera HTTP del runtime: resolución de payloads, construcción de `RequestInit`, ejecución contra `fetch` y errores normalizados.
- `layout-renderer.tsx` conserva la responsabilidad de renderizar colecciones ordenadas de nodos.
- `layout-node-renderer.tsx` es el punto central de resolución `type -> pieza de render`.
- `runtime-node-styling.ts` concentra la convención visual base del runtime y la compatibilidad acotada para `gap` arbitrarios.
- `runtime-references/` fija la semántica central de referencias string, distingue `literal | supported | unsupported | invalid` y evita lógica dispersa en nodos visuales.
- `runtime-state/` concentra un store por instancia basado en `useReducer` + `Context`, con dominios separados para navegación, formularios, queries y `pageEntry`, y expone la fachada mínima `executeQueryOperation()` sin absorber la lógica de red.
- `runtime/nodes/` materializa solo nodos con uso real inmediato, sin introducir subsistemas vacíos para capacidades futuras.
- `runtime-page.tsx` ya no decide la página visible por selección ad hoc; la resuelve desde el estado compartido del runtime.

## Módulos previstos para próximas features
- `components/`: componentes visuales soportados por futuras ampliaciones del renderer declarativo.
- `forms/`: piezas visuales, validación declarativa y submit apoyados en el dominio `forms` ya existente en `runtime-state/`.
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
- La primera UI estable del runtime es un renderer estático para `container`, `heading`, `paragraph` y `list`.
- La organización interna del runtime separa contrato, validación, render de colecciones y render concreto por nodo sin cambiar el comportamiento observable.
- La presentación base de los nodos visibles del runtime se expresa con utilidades de `Tailwind`, con una excepción acotada basada en variable CSS para `container.props.gap` cuando llega un valor arbitrario.
- El runtime crea un store compartido aislado por instancia, con `useReducer` + `Context`, para sostener navegación, formularios y queries sin depender todavía de subsistemas visuales separados.
- La navegación visible ya se resuelve desde `navigation.currentPageId`; la URL del navegador queda fuera del contrato de esta primera capa interactiva.
- La resolución de referencias declarativas vive en `src/runtime/runtime-references/` y hoy solo abre navegación anidada adicional bajo `queries.{queryName}.data.*`.
- La navegación de subrutas de query usa una semántica iterativa única: índices solo sobre arrays, claves literales sobre objetos y resultado `missing` para rutas bien formadas cuyo dato no está disponible.
- La ejecución remota declarativa vive en `src/queries/`, reutiliza la convención central de referencias del runtime y deja sus resultados visibles solo a través de `queries.{operationName}`.
- La orquestación automática de `preloads` vive en `runtime-state-provider.tsx`, reutiliza la frontera `src/queries/`, captura un snapshot común del estado por entrada y limita la semántica latest-only al agregado `pageEntry`, no a las queries individuales.
- Los errores de bootstrap y validación deben ser diagnósticos en desarrollo; en producción, los errores marcados como solo de desarrollo degradan sin mensaje visible genérico.
