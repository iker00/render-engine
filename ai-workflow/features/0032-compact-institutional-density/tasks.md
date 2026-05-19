# Tasks: Compact institutional density

## Resultado de revisión

La feature requiere `design.md` y el artefacto ya existe como contrato técnico obligatorio.

Estado actual del workflow:
- la feature ya está implementada, validada y documentada
- este documento se conserva como contrato de ejecución histórico de la implementación que se siguió
- no queda ninguna tarea de implementación pendiente mientras `status.yaml` mantenga la feature en `complete`

Decisiones de diseño que la implementación no debe reabrir:
- la compactación se resuelve desde la convención visual central existente y no mediante variantes declarativas nuevas en el JSON
- la reducción debe ser sistémica y coordinada entre tipografía, controles, acciones y espaciado vertical, no una suma de ajustes aislados por nodo
- móvil también debe compactarse, pero con recortes más conservadores que desktop para no perder tocabilidad
- la baseline institucional de `0026` y la heurística de secciones de formulario de `0028` se conservan; solo cambia su densidad

Con estas decisiones, la implementación pudo ejecutarse sin reinterpretar arquitectura ni alcance visual. La siguiente tarea que debería escogerse hoy es ninguna; el orden histórico ejecutado fue `T0032-01` → `T0032-02` → `T0032-03` → `T0032-04`.

## T0032-01

### Estado
Completada

### Objetivo
Compactar la jerarquía visual global del runtime reduciendo el tamaño percibido del bloque superior, los saltos tipográficos entre niveles y las separaciones verticales base entre bloques visibles, manteniendo intacta la baseline institucional fijada en `0026`.

### Fuera de alcance
- Compactar todavía controles concretos de formulario, choice groups o botones.
- Reabrir colores, tokens de branding, bordes o tono general del shell.
- Introducir nodos nuevos, theming declarativo o props visuales nuevas en el JSON.
- Actualizar todavía la documentación estable del proyecto.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/runtime-page.tsx` solo si hace falta ajustar una clase estructural ya existente para cerrar la nueva densidad base
  - `src/app/app-shell.tsx` solo si la compactación del marco visible superior exige un ajuste residual real del shell compartido
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/layout-renderer.test.tsx` solo si conviene fijar con integración la nueva jerarquía visible entre heading, párrafo introductorio y bloques siguientes
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `getAppShellContentClassName`, `getAppShellFrameClassName`, `getRuntimePageClassName`, `getHeadingNodeClassName` y `getParagraphNodeClassName` fijan una densidad vertical menor que la baseline actual desde helpers centralizados, sin mover la convención a clases locales dispersas.
- Confirmar que el `h1` principal y los headings secundarios mantienen jerarquía clara tras reducir el salto entre niveles.
- Confirmar que la página visible sigue entrando en un grid estable y que el bloque introductorio ocupa menos altura total que antes sin eliminar separación semántica.
- Confirmar que la compactación responsive del bloque superior queda fijada con clases base y modificadores `sm:`/`lg:` estables cuando aplique, no con ajustes ad hoc por componente.
- Confirmar que el ajuste sigue centralizado en la convención visual base y no reintroduce estilos inline generales ni excepciones dispersas por nodo.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva densidad base del runtime y su efecto sobre la composición general del contenido.

### Criterios de finalización
- La densidad tipográfica y vertical base del runtime queda centralizada y es perceptiblemente más compacta que la baseline previa.
- El bloque superior de una página con formulario entra antes en pantalla sin perder legibilidad ni jerarquía.
- El cambio deja fijada la nueva escala visual base para que la compactación de formularios pueda apoyarse en ella sin redefinirla.
- Los tests unitarios e integrados afectados dejan el comportamiento visible cubierto en verde.

### Cierre de implementación
Completado cuando la compactación base del shell y de la jerarquía visible ya está en código, validada por tests y lista para que los nodos de formulario consuman esa misma dirección visual.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0032-02

### Estado
Completada

### Objetivo
Compactar de forma coordinada los formularios del runtime reduciendo la altura percibida de `input`, `textarea`, `select`, botones, grupos de opciones y secciones `container` dentro de `form`, conservando la semántica funcional y la claridad institucional ya fijadas por `0026` y `0028`.

### Fuera de alcance
- Cambiar reglas de validación, submit, reset, visibilidad o estado compartido del runtime.
- Añadir variantes visuales por tipo de botón o control desde JSON.
- Convertir la compactación en una UI agresivamente densa que sacrifique legibilidad o uso táctil.
- Hacer en esta tarea la pasada documental amplia de la feature.

### Dependencias
- `T0032-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/button-layout-node.tsx` solo si hace falta fijar una distinción visual mínima adicional entre submit implícito y acciones secundarias sin cambiar semántica
  - `src/runtime/nodes/form-layout-node.tsx` solo si hace falta ajustar el layout visible base del formulario
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/textarea-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/nodes/radio-group-layout-node.tsx`
  - `src/runtime/nodes/checkbox-group-layout-node.tsx`
  - `src/runtime/nodes/container-layout-node.tsx` solo si la compactación de secciones requiere un ajuste residual del wrapper actual
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si alguna aserción visible de acciones dentro de formulario necesita endurecerse
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `getFormNodeClassName`, `getFieldWrapperClassName`, `getFieldLabelClassName`, `getFieldControlClassName`, `getPrimaryButtonNodeClassName`, `getSecondaryButtonNodeClassName`, `getChoiceGroupClassName` y `getChoiceOptionClassName` reflejan la nueva densidad compacta sin romper foco visible ni contraste.
- Confirmar que `input`, `textarea` y `select` reducen padding y altura percibida, manteniendo valor, placeholder, label y mensajes de error legibles.
- Confirmar que `textarea` y `select.multiple` siguen teniendo altura mínima suficiente para uso real aunque el sistema base se compacte.
- Confirmar que la CTA primaria dentro de `form` sigue destacando frente a acciones secundarias aunque ambas reduzcan tamaño.
- Confirmar que las secciones `container` dentro de `form` mantienen su papel de bloque separado, pero con menor distancia vertical acumulada respecto al baseline anterior.
- Confirmar que la compactación de controles y acciones también queda descrita con clases base y modificadores responsivos estables, evitando depender de inspección manual en navegador para distinguir móvil y desktop.
- Confirmar que la semántica funcional de edición, submit implícito, reset y choice groups permanece estable tras el ajuste visual.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva densidad estable de formularios, acciones y secciones.

### Criterios de finalización
- Los controles y acciones del runtime se perciben más compactos y administrativos sin perder affordance ni comodidad mínima en móvil.
- La separación vertical entre grupos de campos, secciones y cierre de acciones queda reducida de forma coherente y no aislada por nodo.
- La semántica funcional previa de formularios sigue cubierta por regresión.
- Los tests de styling, renderer y formularios quedan en verde.

### Cierre de implementación
Completado cuando el catálogo actual de formularios ya adopta la densidad compacta acordada y sus tests funcionales siguen cerrando el comportamiento existente.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0032-03

### Estado
Completada

### Objetivo
Cerrar la integración visible de la feature sobre la configuración representativa del runtime y validar que la compactación se aplica de forma coherente en pantallas con y sin formulario, sin romper la adaptación responsive ni el gate global de tests y cobertura.

### Fuera de alcance
- Reabrir la convención visual cerrada en tareas anteriores salvo bug demostrado por tests.
- Introducir nuevas capacidades declarativas, nuevos nodos o nuevo theming.
- Sustituir esta tarea por una pasada documental amplia.
- Añadir tests e2e o navegador real.

### Dependencias
- `T0032-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/dev/config.json` solo si hace falta reforzar el ejemplo local representativo de la compactación final
  - `src/runtime/runtime-node-styling.ts` solo para ajustes residuales detectados por regresión
  - `src/app/app-shell.tsx` o `src/runtime/runtime-page.tsx` solo para ajustes residuales estrictamente necesarios para cerrar la integración
- Tests a crear o modificar:
  - `src/tests/app-shell.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Confirmar que la configuración de desarrollo sigue siendo válida y representa un caso suficiente para percibir la nueva densidad general.
- Confirmar mediante aserciones de clases estables que shell, título, descripción, secciones de formulario, controles y barra de acciones quedan más contenidos en móvil base y en los breakpoints mayores soportados por los modificadores responsivos declarados.
- Confirmar que una pantalla sin formulario también hereda la compactación de jerarquía tipográfica y espaciado general sin colapsar su composición.
- Ejecutar la regresión conjunta del subconjunto visual afectado y cerrar con `pnpm test` para validar el gate global del 80% sobre `src/`.

### Documentación afectada
- Pendiente de la pasada documental posterior para reflejar la integración final del baseline compacto.

### Criterios de finalización
- La compactación queda validada de extremo a extremo sobre el runtime representativo actual.
- El resultado visible es más cercano a la referencia aportada por el usuario que al baseline anterior, sin romper consistencia entre pantallas.
- El subconjunto afectado y el gate global de tests y cobertura quedan en verde.

### Cierre de implementación
Completado cuando la feature queda integrada y validada de extremo a extremo, con `pnpm test` en verde y sin deuda funcional abierta dentro del alcance acordado.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0032-04

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y de estado para dejar explícito que el runtime mantiene la baseline institucional previa, pero con una densidad visual más compacta y coordinada en tipografía, formularios, secciones y acciones.

### Fuera de alcance
- Reabrir decisiones de implementación ya cerradas.
- Convertir `README.md` u otros documentos breves en changelog.
- Diseñar theming declarativo o variantes futuras de densidad fuera del alcance actual.

### Dependencias
- `T0032-03` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0032-compact-institutional-density/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0032-03` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable describe con precisión qué se compactó y qué permanece deliberadamente igual respecto a la baseline institucional previa.
- Queda claro que la feature ajusta densidad y proporción general, no el contrato funcional del runtime ni su lenguaje visual base.
- `status.yaml` refleja correctamente el cierre real del workflow de la feature (`complete` cuando ya no quedan tareas abiertas) sin contradicciones con los artefactos reales.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0032-03`.

### Cierre documental
Completado cuando la documentación funcional y el estado del workflow quedan actualizados de forma consistente.
