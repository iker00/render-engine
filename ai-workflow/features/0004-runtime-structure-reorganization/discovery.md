# Discovery: Runtime structure reorganization

## Problema a resolver
La base actual del runtime funciona, pero su estructura interna todavía responde al arranque inicial del proyecto y no a las responsabilidades que ya empiezan a aparecer. El renderer, la validación y los tipos siguen agrupados de forma muy plana, y ya hay señales de deuda como `LayoutFragment`, cuyo único comportamiento es delegar a `renderLayoutNode(node)` sin aportar aislamiento real.

La petición busca aprovechar este momento temprano para ordenar el proyecto antes de añadir más capacidades, moviendo piezas a carpetas coherentes por responsabilidad y eliminando componentes o capas que no justifican su existencia.

## Contexto funcional relevante
- El producto actual sigue en una fase acotada: renderer estático, validación estructural mínima y selección de `initialPage`.
- La arquitectura documentada ya separa `app/`, `config/` y `runtime/`, y además anticipa módulos futuros como `components/`, `forms/`, `queries/` y `shared/`.
- Hoy el código real todavía no refleja esa granularidad: `src/runtime/layout-renderer.tsx` concentra render de nodos, helpers visuales y composición recursiva.
- `src/config/runtime-config.ts` mezcla tipos del contrato y validación estructural del runtime.
- La petición no introduce comportamiento nuevo de producto; el valor esperado es mejorar mantenibilidad, claridad y preparación para futuras features como formularios, eventos y validaciones más ricas.

## Supuestos actuales
- La reorganización debe preservar el comportamiento visible actual del runtime.
- El alcance incluye mover código existente a ubicaciones más coherentes, no crear subsistemas completos futuros sin uso real.
- Tiene sentido eliminar abstracciones vacías o triviales cuando no encapsulan comportamiento, como `LayoutFragment`.
- La estructura resultante debería facilitar que los próximos nodos de render, validaciones y eventos se añadan sin volver a concentrar demasiada lógica en un solo archivo.
- Los tests existentes deben seguir siendo la red principal para demostrar que el refactor no cambia el contrato actual.

## Decisiones ya tomadas
- La feature debe reordenar el código actual cuando haga falta y, además, dejar documentada una estructura objetivo para carpetas futuras como `events/`, `validations` o equivalentes, aunque no todas se creen todavía en código.
- El renderer debe evolucionar hacia un componente central que resuelva `type -> component`, dejando un componente concreto por cada nodo soportado.
- La validación seguirá viviendo en `config/` como frontera de entrada, pero separando mejor tipos y validadores en archivos distintos.
- El alcance incluye eliminar cualquier abstracción redundante que aparezca durante el refactor, no solo `LayoutFragment`, siempre que la limpieza no derive en reescrituras laterales sin beneficio claro.
- La organización final debe priorizar una estructura preparada para crecimiento real del runtime, con espacio claro para layout nodes, validaciones, eventos y utilidades compartidas.

## Preguntas abiertas
- Qué nombres exactos y qué nivel de anidación deben formar parte de la estructura objetivo documentada para acompañar el crecimiento del runtime sin volverla rígida demasiado pronto.
- Si la estructura final debe privilegiar una organización estrictamente por área funcional cercana al dominio (`runtime/renderers`, `config/validation`, `runtime/shared`) o una combinación híbrida con algunos puntos de entrada más genéricos para componentes reutilizables.

## Riesgos detectados
- Reorganizar demasiado pronto con carpetas vacías o fronteras artificiales puede introducir estructura ceremonial sin beneficio inmediato.
- Mover tipos, validadores y renderers a la vez puede mezclar decisiones de arquitectura con refactor mecánico y aumentar el coste de revisión.
- Si no se fija bien el criterio de “responsabilidad”, la nueva estructura puede envejecer igual de rápido cuando entren formularios, queries y eventos.
- El refactor toca imports y tests transversales; aunque el comportamiento no cambie, el riesgo de regresión accidental es real.

## Áreas o documentos a revisar después
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/current-state.md`
- `src/runtime/layout-renderer.tsx`
- `src/runtime/runtime-page.tsx`
- `src/config/runtime-config.ts`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-config-validation.test.ts`

## Recomendación final
Lista para `spec.md`.

La siguiente fase debería convertir estas decisiones en un contrato explícito de reorganización: estructura objetivo documentada, carpetas que se materializan ya con código real, patrón del renderer central con componentes por nodo, separación entre tipos y validación en `config/`, y criterio para eliminar piezas redundantes sin alterar comportamiento. No queda bloqueante funcional; solo hace falta aterrizar la estructura propuesta en la `spec.md`.
