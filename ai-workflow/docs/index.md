# Indice de contexto del proyecto

## Proposito
Este indice existe para que una skill o un agente pueda decidir que contexto leer sin cargar por defecto toda la documentacion transversal del proyecto.

No sustituye a los artefactos obligatorios de cada fase ni a los indices especializados. Solo orienta la seleccion inicial de documentos.

## Documentos transversales
- `context.md`: marco breve de producto, stack, restricciones globales y propiedad de datos. Leer en discovery, spec y cuando el contrato de ejecucion no baste para entender el comportamiento esperado.
- `workflow.md`: fases, artefactos, gates, estado estructurado y reglas de mantenimiento del workflow. Leer siempre que una skill coordine discovery, spec, planning, implementation o documentation.
- `architecture.md`: organizacion tecnica estable, limites de capas y decisiones arquitectonicas vigentes. Leer cuando se planifique, revise o implemente un cambio con impacto tecnico no trivial.
- `conventions.md`: convenciones repetibles de implementacion y mantenimiento documental. Leer cuando se escriban planes, se implemente codigo o se cierre documentacion.
- `current-state.md`: inventario de capacidades vigentes y limites actuales. Leer solo cuando haga falta confirmar si algo ya esta implementado, documentar estado estable o resolver dudas de alcance actual.
- `onboarding.md`: entrada humana al proyecto. No leer por defecto en skills salvo que la tarea sea de onboarding o explicacion general.
- `../features/index.md`: mapa de features planificadas, archivadas y completadas. Leer cuando haga falta contexto historico, coordinacion entre features o actualizar el mapa de entregas.

## Indices especializados
- `app-features/index.md`: puerta de entrada al comportamiento funcional estable del runtime. Usar para seleccionar solo las fichas funcionales relevantes.
  No leerlo si la tarea no afecta comportamiento de producto, contrato JSON, runtime visible, formularios, queries, navegacion o modo de desarrollo local.

## Estandares
Los documentos de `ai-workflow/standards/` se seleccionan segun el tipo de trabajo:
- `testing-rules.md`: siempre que se planifiquen, escriban o validen tests.
- `coding-style.md`: cuando se planifique o edite codigo.
- `react-best-practices.md`: cuando el cambio afecte componentes, hooks, renderer o estado React.
- `error-handling.md`: cuando el cambio afecte validacion, degradacion, errores remotos o diagnosticos.
- `security-basics.md`: cuando el cambio afecte datos externos, requests, configuracion no confiable o superficies de entrada.

No leer todos los estandares por defecto. En planning o review, leer todos solo si la feature es transversal, de riesgo alto o afecta simultaneamente varias areas de calidad. En implementation, leer solo los relevantes para la tarea salvo que el plan pida otra cosa.

## Uso desde skills
Las skills son la fuente de verdad sobre que documentos leer siempre y cuales leer solo si aplica.

Este indice sirve solo para descubrir contexto adicional cuando la skill activa no deje claro que documento transversal, estandar o ficha funcional conviene consultar.

No usar este documento para sustituir los bloques `Leer siempre` y `Leer si aplica` de cada skill.

## Regla para skills
- No leer todos los documentos transversales por defecto.
- No leer todas las fichas de `app-features/` por defecto.
- Los artefactos obligatorios de la fase activa deben estar definidos en la skill correspondiente, no en este indice.
- Las skills pueden referenciar este indice como mapa auxiliar, pero no deben delegar aqui su contrato de lectura.
- Si se actualiza el mapa documental o el proposito de un documento, actualizar este indice.
