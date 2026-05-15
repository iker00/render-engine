# Tasks: Sede electronica visual alignment

## Resultado de revisión

La feature requiere `design.md` y ya queda fijado en esta fase que:
- los tokens visuales globales vivirán en `src/app/index.css`
- la gramática visual seguirá centralizada en `src/runtime/runtime-node-styling.ts`
- `AppShell` y `RuntimePage` forman parte del alcance visual
- no se introducirán nodos nuevos ni theming declarativo desde JSON
- no se implementarán upload ni acordeones móviles en esta iteración
- la separación de secciones del formulario se resolverá reutilizando `form` y `container`

Con esas decisiones, la implementación puede ejecutarse de forma secuencial sin rediseñar la feature sobre la marcha. La siguiente tarea que debe ejecutarse es `T0026-01`.

## T0026-01

### Estado
Completada

### Objetivo
Instalar la base visual compartida de la feature definiendo tokens globales en CSS y alineando el shell principal de la app con una composición clara, institucional y responsive antes de tocar el catálogo completo de nodos del runtime.

### Fuera de alcance
- Restylar todavía todos los nodos visibles del runtime.
- Introducir variantes declarativas de apariencia en el JSON.
- Añadir nuevas capacidades funcionales de formularios, navegación o queries.
- Resolver todavía la separación detallada de secciones de formulario.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/app/index.css`
  - `src/app/app-shell.tsx`
  - `src/runtime/runtime-page.tsx`
  - `src/runtime/runtime-node-styling.ts` para exponer clases base del shell o frame si conviene centralizarlas ahí
- Tests a crear o modificar:
  - `src/tests/app-shell.test.tsx`
  - `src/tests/app-bootstrap.test.tsx` solo si cambian aserciones visibles del shell o de superficies de error
  - `src/tests/runtime-node-styling.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que existen variables CSS globales estables para color principal, fondos, superficies, bordes, texto, radios y espaciado base.
- Confirmar que el shell visible deja de usar la estética oscura actual y pasa a una composición clara con contenedor principal centrado.
- Confirmar que los errores visibles de bootstrap siguen siendo legibles y no pierden jerarquía dentro del shell nuevo.
- Confirmar que la convención central puede exponer slots reutilizables de shell sin reintroducir estilos inline generales.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva base visual global, el cambio de shell y la nueva referencia temática implícita del runtime.

### Criterios de finalización
- El proyecto dispone de una base de tokens globales reutilizable y acotada.
- `AppShell` y `RuntimePage` ya expresan una composición clara y administrativa coherente con la referencia.
- El cambio deja cerrada la base visual compartida para el resto de nodos sin abrir aún decisiones nuevas de componente.
- Los tests de shell y convención base quedan en verde.

### Cierre de implementación
Completado cuando la base visual global y el shell alineado están en código, validados con tests y listos para que los nodos del runtime consuman esa misma gramática.

### Cierre documental
Pendiente de una pasada posterior sobre estado actual, arquitectura y ficha funcional del runtime. No se cierra en esta tarea.

## T0026-02

### Estado
Completada

### Objetivo
Reescribir la convención visual central del runtime para que `container`, `heading`, `paragraph` y `list` adopten la jerarquía, densidad y superficies de la referencia institucional, manteniendo intacto el contrato funcional del renderer.

### Fuera de alcance
- Restylar todavía los controles de formulario y sus mensajes de error.
- Añadir nodos nuevos como `section`, `card` o `hero`.
- Reabrir el contrato de `container.props.direction` o `container.props.gap`.
- Modificar lógica de visibilidad, navegación o referencias.

### Dependencias
- `T0026-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/nodes/heading-layout-node.tsx`
  - `src/runtime/nodes/paragraph-layout-node.tsx`
  - `src/runtime/nodes/list-layout-node.tsx`
  - `src/runtime/layout-renderer.tsx` solo si hace falta un ajuste mínimo de wrappers o atributos para fijar la nueva jerarquía visual
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/app-shell.test.tsx` solo si se endurecen aserciones de composición visible
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/conventions.md`

### Tests requeridos
- Confirmar que `heading` mantiene la resolución semántica por `level`, pero adopta una escala tipográfica clara y administrativa.
- Confirmar que `paragraph` y `list` comparten color, legibilidad y espaciado coherentes con la referencia clara.
- Confirmar que `container` sigue soportando `direction` y `gap`, incluyendo alias y valor arbitrario, mientras adopta la nueva gramática de composición.
- Confirmar que los nodos de contenido siguen renderizando el mismo texto y orden visible sin wrappers funcionales inventados.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva convención visual base y el abandono de la estética oscura previa.

### Criterios de finalización
- La convención central del runtime expresa ya la jerarquía tipográfica y de composición de la referencia.
- Los nodos de contenido visibles dejan de parecer piezas aisladas o de un shell técnico oscuro.
- El contrato funcional del renderer permanece estable y queda cubierto por regresión.
- Los tests de styling y renderer quedan en verde.

### Cierre de implementación
Completado cuando la gramática visual base de contenido queda centralizada, consumida por los nodos hoja y validada sin abrir capacidades nuevas del JSON.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0026-03

### Estado
Completada

### Objetivo
Alinear `form`, `button`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` con la referencia de sede electrónica, cerrando la tarjeta principal del trámite, la separación de bloques internos y la jerarquía de acciones sin alterar la semántica funcional de formularios.

### Fuera de alcance
- Introducir upload de archivos, autocomplete, búsqueda remota u otros campos nuevos.
- Implementar acordeones o secciones colapsables en móvil.
- Añadir variantes visuales configurables por botón o campo desde JSON.
- Cambiar reglas de validación, submit, reset o estado compartido del runtime.

### Dependencias
- `T0026-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/form-layout-node.tsx`
  - `src/runtime/nodes/button-layout-node.tsx`
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/textarea-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/nodes/radio-group-layout-node.tsx`
  - `src/runtime/nodes/checkbox-group-layout-node.tsx`
  - `src/runtime/nodes/container-layout-node.tsx` si hace falta una variante estable de sección dentro de formulario
  - `src/runtime/form-context.tsx` solo si hace falta propagar contexto visual mínimo para secciones o barra de acciones sin tocar contrato funcional
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx` solo si alguna aserción de formulario visible necesita endurecerse
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que `form` renderiza una tarjeta o superficie principal clara y consistente con la composición acordada.
- Confirmar que labels, controles, focus y errores de `input`, `textarea` y `select` comparten la misma gramática visual y mantienen accesibilidad básica.
- Confirmar que `radioGroup` y `checkboxGroup` conservan controles nativos, pero con una presentación coherente con el resto del formulario.
- Confirmar que los botones mantienen su semántica funcional actual y exponen una jerarquía visual clara con esta convención estable: submit implícito como CTA primaria dentro de `form`, `resetForm` y `goBack` como secundarios, y resto de acciones explícitas dentro de `form` como auxiliares secundarias.
- Confirmar que contenedores usados dentro del formulario pueden separar bloques de campos sin requerir un nodo declarativo nuevo.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva gramática de formularios y sus límites funcionales intactos.

### Criterios de finalización
- El formulario visible del runtime funciona como tarjeta principal del trámite y no como una pila de controles sueltos.
- Los campos y acciones comparten una apariencia institucional uniforme.
- La separación de bloques de formulario queda resuelta con el catálogo actual, sin abrir API visual nueva.
- La semántica de submit, validación y navegación sigue estable y cubierta por tests.

### Cierre de implementación
Completado cuando el catálogo actual de formularios ya adopta la gramática visual acordada y sus tests funcionales siguen cerrando el comportamiento existente.

### Cierre documental
Pendiente de una pasada posterior sobre formularios, runtime y estado actual. No se cierra en esta tarea.

## T0026-04

### Estado
Completada

### Objetivo
Cerrar la integración visual de la feature sobre una configuración representativa del runtime y validar que la composición responsive, la jerarquía de lectura y la coherencia entre pantallas quedan estabilizadas sin depender del JSON de ejemplo oscuro previo.

### Fuera de alcance
- Reabrir la convención central ya fijada en tareas anteriores.
- Añadir nuevas capacidades declarativas para describir layouts más ricos.
- Convertir esta tarea en una pasada documental amplia.
- Introducir tests e2e o navegador real.

### Dependencias
- `T0026-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/dev/config.json` añadiendo o ajustando una página representativa de sede sin eliminar los flujos de desarrollo ya usados para navegación, queries, `repeater` y formularios
  - `src/app/app-shell.tsx` o `src/runtime/runtime-page.tsx` solo si aparece un ajuste residual real de composición final
  - `src/runtime/runtime-node-styling.ts` solo para ajustes mínimos residuales del sistema visual ya definido
- Tests a crear o modificar:
  - `src/tests/app-shell.test.tsx`
  - `src/tests/app-bootstrap.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` si hace falta cerrar la regresión de acciones visibles
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Confirmar que la configuración local de desarrollo sigue siendo válida, conserva los flujos ya útiles para desarrollo y además ejercita una página representativa de la nueva composición institucional.
- Confirmar que el runtime mantiene la jerarquía de lectura principal en pantallas con y sin formulario.
- Confirmar mediante aserciones de clases estables que shell, contenido principal, tarjeta de formulario y barra de acciones expresan la adaptación responsive prevista para móvil, tablet y desktop.
- Confirmar que la integración visible del shell, el contenido y la barra de acciones no reintroduce la estética oscura anterior.
- Ejecutar la regresión conjunta del subconjunto visual afectado y cerrar con `pnpm test` para validar el gate global de coverage.

### Documentación afectada
- Pendiente de la pasada documental posterior para dejar trazabilidad estable del nuevo baseline visual.

### Criterios de finalización
- La feature queda validada de extremo a extremo sobre una configuración representativa del runtime actual.
- La regresión visual queda acotada al baseline institucional acordado.
- El gate global de tests y coverage queda en verde.

### Cierre de implementación
Completado cuando la composición visible final queda integrada, probada y lista para pasar a documentación sin deuda funcional abierta dentro del alcance visual.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0026-05

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y técnica afectada para dejar explícita la nueva referencia visual del runtime, su base de tokens, sus límites y la gramática común adoptada por shell, contenido y formularios.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Añadir roadmap de theming declarativo, upload o acordeones dentro de la documentación estable.
- Convertir `README` u otros documentos breves en un changelog largo.

### Dependencias
- `T0026-04` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md` solo si la implementación introduce una capa visual reusable adicional relevante
  - `ai-workflow/docs/conventions.md` solo si la gestión de tokens o slots visuales fija una convención repetible nueva
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/features/index.md`
- Estado del workflow:
  - `ai-workflow/features/0026-sede-electronica-visual-alignment/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en la evidencia ya verde de `T0026-04`, incluido `pnpm test`.

### Documentación afectada
- Esta tarea sí cierra la documentación pendiente de la feature.

### Criterios de finalización
- La documentación deja claro qué partes de la referencia son obligatorias, cuáles se difieren y cómo se materializan con el catálogo actual.
- El estado vigente del runtime describe la nueva base clara institucional en lugar del baseline oscuro anterior.
- `status.yaml` queda listo para pasar a fase documental o de cierre según el resultado de la pasada.

### Cierre de implementación
Ya cerrado por `T0026-04`. Esta tarea no reabre código salvo ajuste documental mínimo estrictamente necesario para coherencia del workflow.

### Cierre documental
Completado cuando la documentación afectada y `status.yaml` reflejan de forma estable el nuevo baseline visual del runtime.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0026-01`.

No se debe empezar `T0026-02` hasta cerrar `T0026-01`.

No se debe empezar `T0026-03` hasta cerrar `T0026-02`.

No se debe empezar `T0026-04` hasta cerrar `T0026-03`.

No se debe empezar `T0026-05` hasta cerrar `T0026-04`.
