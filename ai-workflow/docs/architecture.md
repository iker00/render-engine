# Arquitectura del proyecto

## Proposito
Este documento resume la arquitectura estable que deben respetar las features nuevas. Debe mantenerse corto: describe limites de capas, responsabilidades y puntos de extension, no el historial de decisiones ni un inventario exhaustivo de archivos.

## Capas principales
- `src/app/`: arranque de la aplicacion, lectura de configuracion desde `data-config` o `src/dev/config.json`, composicion raiz y superficie de errores de bootstrap.
- `src/config/`: contrato del runtime config, tipos publicos, esquemas internos `Zod`, adaptacion de errores y validaciones cruzadas previas al render. La logica de validacion esta partida en modulos por dominio: `validate-preloads`, `validate-api-config`, `validate-layout-nodes`, `validate-actions-visibility`, `validate-form-nodes`; el punto de entrada es `validate-runtime-config`.
- `src/runtime/`: interpretacion del JSON ya validado, render de nodos, estado compartido por instancia, referencias declarativas, acciones UI, formularios, feedback de queries, visibilidad y layout.
- `src/queries/`: frontera remota del runtime: composicion de requests, resolucion de parametros, ejecucion via `fetch`, firma efectiva y normalizacion de errores.
- `src/dev/`: configuracion local versionada para iterar sin backend.
- `src/tests/`: validacion automatizada del contrato, bootstrap, renderer y comportamiento del runtime. Cada fichero de test cubre un único dominio funcional; el mapa de ficheros vive en `ai-workflow/docs/test-index.md`.

## Responsabilidades del runtime
- `layout-renderer` y `layout-node-renderer` forman el borde central de render: deciden que nodo se materializa, aplican visibilidad, feedback por query, expansion estructural de `repeater` y wrappers transversales como `layout.span`.
- `runtime-state/` mantiene el store aislado por instancia con dominios de navegacion, formularios, queries y `pageEntry`.
- `runtime-references/` concentra la semantica de referencias string. Ningun nodo visual debe reimplementar navegacion por `forms.*`, `queries.*`, `params.*` o `item.*`.
- `runtime-actions/` traduce acciones declarativas a handlers del provider. Los nodos interactivos disparan acciones; no gestionan por su cuenta navegacion, red ni reset de formularios.
- `runtime-collection-sources` normaliza colecciones para consumidores como `list`, `select`, `radioGroup` y `checkboxGroup`.
- `runtime-form-validations` concentra la evaluacion de reglas locales de formulario.
- `runtime-query-state-feedback` concentra la derivacion `idle | loading | error | empty | success`.
- `runtime-node-styling` concentra la gramatica visual estable, utilidades de `Tailwind`, variante `card`, gaps y spans de grid.

## Fronteras que no deben romperse
- La configuracion se valida antes de renderizar. Los componentes visuales no deben aceptar contratos ambiguos que deberian rechazarse en `src/config/`.
- La red vive en `src/queries/`. Los nodos visuales no deben construir `fetch`, URLs ni `RequestInit` directamente.
- La resolucion de referencias vive en `runtime-references/`. Evitar parsers locales o accesos ad hoc al estado compartido.
- El estado compartido vive en `runtime-state/`. Los nodos pueden consumir fachada y contexto, pero no duplicar dominios de estado paralelos.
- La navegacion del runtime se sincroniza con hash routing simple. No introducir un router general por `pathname` salvo decision arquitectonica explicita.
- El estilo estable vive en tokens globales y utilidades centralizadas. Evitar estilos inline o APIs visuales libres si no hay feature de theming.
- `repeater` es expansion estructural sin wrapper visual propio. La ocupacion de grid debe venir del nodo visible resultante y de `layout.span`.

## Puntos de extension
- Nuevo nodo declarativo: actualizar contrato en `src/config/`, implementar nodo en `src/runtime/nodes/`, conectarlo desde el dispatcher central, cubrir render y validacion con tests y actualizar fichas funcionales si cambia comportamiento estable.
- Nueva referencia declarativa: extender `runtime-references/`, declarar superficies consumidoras concretas y cubrir rutas validas, no disponibles e invalidas.
- Nueva accion UI: extender el contrato de accion, resolver parametros en la capa comun y delegar en handlers del provider.
- Nueva capacidad remota: mantener composicion y ejecucion en `src/queries/`; exponer resultado solo por dominios del runtime.
- Nueva regla de formulario: validar contrato en `src/config/`, evaluar en `runtime-form-validations` y cubrir submit, edicion y campos ocultos.
- Cambio visual transversal: actualizar `runtime-node-styling` y tokens globales si procede; evitar dispersar clases especiales por nodos no relacionados.

## Criterio de actualizacion
Actualizar este documento solo cuando cambie una frontera arquitectonica, una responsabilidad de capa o un punto de extension estable. Los detalles funcionales pertenecen a `app-features/`; el estado vigente resumido pertenece a `current-state.md`.
