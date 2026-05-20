# Tasks: Container variants and responsive grid span

## Resultado de revisión

La feature requiere `design.md` porque introduce dos decisiones transversales que no conviene delegar a la implementación:
- `layout.span` debe aplicarse desde un wrapper genérico del renderer, no desde cada nodo individual
- `variant: card` debe convivir con la baseline institucional y con la heurística actual de secciones dentro de `form` sin crear dobles superficies ambiguas

La revisión cerró la única ambigüedad bloqueante del plan: `repeater` queda fuera del alcance visible de `layout.span` en esta feature. Si una repetición necesita ocupar columnas, el nodo raíz visible de `props.template` debe declarar su propio `layout.span`, normalmente con un `container` como raíz del template.

## T0034-01

### Estado
Completada

### Objetivo
Ampliar el contrato del runtime para soportar `container.props.variant` y `layout.span` como superficies declarativas validadas antes del render, manteniendo compatibilidad con configuraciones existentes y sin introducir validación contextual contra el padre.

### Fuera de alcance
- Aplicar todavía las clases visibles de `card`.
- Aplicar todavía el efecto visible de `span` en el renderer React.
- Actualizar todavía la documentación estable del producto.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/config/runtime-config-types.ts`
  - `src/config/runtime-config-zod.ts`
  - `src/config/validate-runtime-config.ts`
  - `src/config/runtime-config.ts` solo si la fachada pública necesita reexportar tipos nuevos
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que `container.props.variant` acepta `default` y `card`.
- Confirmar que ausencia de `variant` sigue siendo válida y no altera la normalización actual.
- Confirmar que cualquier nodo soportado puede declarar `layout.span`.
- Confirmar que `repeater` queda excluido de la semántica visible de `layout.span` y que el patrón soportado para repeticiones con grid span es aplicar `layout.span` en el nodo raíz visible del `template`.
- Confirmar que `layout.span` solo acepta enteros entre `1` y `12`.
- Confirmar que shapes inválidos de `variant`, `layout` o `layout.span` se rechazan con diagnóstico trazable a la ruta correcta.
- Confirmar que configuraciones históricas sin `variant` ni `layout.span` siguen siendo válidas.
- Confirmar que `layout.span` se acepta también dentro de `container`, `form` y nodos hoja para fijar de verdad su carácter transversal.

### Documentación afectada
- Pendiente de actualización posterior para reflejar el contrato ampliado de `container` y el nuevo bloque transversal `layout`.

### Criterios de finalización
- El contrato JSON soporta `variant` y `layout.span` sin ambigüedad.
- La validación estructural previa al render acepta las nuevas superficies válidas y rechaza shapes inválidos con rutas canónicas.
- La feature no exige todavía conocer el contexto del padre para aceptar `span`.
- La compatibilidad con JSON históricos queda fijada por tests.

### Cierre de implementación
Completado cuando bootstrap puede aceptar o rechazar de forma determinista todo el nuevo shape declarativo sin cambiar todavía el render visible.

### Cierre documental
Pendiente de una pasada posterior. No se cierra en esta tarea.

## T0034-02

### Estado
Completada

### Objetivo
Implementar la variante visual `container.props.variant: card` dentro de la capa central de styling, manteniendo intacta la apariencia actual por defecto y fijando la precedencia visual entre `card` y la superficie implícita de sección dentro de `form`.

### Fuera de alcance
- Aplicar todavía el efecto visible de `layout.span`.
- Añadir variantes nuevas distintas de `card`.
- Reabrir la baseline institucional con un rediseño global o theming declarativo.

### Dependencias
- `T0034-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/dev/config.json` solo si conviene añadir una composición representativa para iteración local
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md` solo si la implementación fija una convención visual reusable nueva

### Tests requeridos
- Confirmar que un `container` sin `variant` conserva exactamente la apariencia visible actual.
- Confirmar que `variant: default` renderiza igual que la ausencia de `variant`.
- Confirmar que `variant: card` añade una superficie estable y cerrada coherente con la baseline institucional.
- Confirmar que `variant: card` puede convivir con `columns` sin perder el layout grid ya existente.
- Confirmar que un `container` dentro de `form` con `variant: card` no acumula también la superficie implícita de sección si eso produciría doble marco visual.
- Confirmar que contenedores existentes dentro y fuera de formularios siguen renderizando sin regresión observable.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la variante `card`, su relación con la baseline institucional y su convivencia con formularios.

### Criterios de finalización
- La variante `card` queda centralizada en el helper visual estable del runtime.
- La apariencia por defecto de `container` sigue intacta cuando `variant` no se usa.
- La precedencia entre `card` y `form-section` queda cerrada y testeada.
- No se introduce una API visual paralela ni estilos inline generales.

### Cierre de implementación
Completado cuando `container` puede renderizar de forma estable `default` y `card`, con tests de styling y renderer en verde.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0034-03

### Estado
Completada

### Objetivo
Implementar la semántica visible de `layout.span` de forma genérica para cualquier nodo soportado, propagando el contexto de grid padre y aplicando un clamp seguro al número efectivo de columnas para evitar roturas visibles.

### Fuera de alcance
- Añadir responsive declarativo por breakpoint.
- Convertir `span` en widths libres para layouts `flex`.
- Reabrir la validación estructural ya fijada en `T0034-01`.

### Dependencias
- `T0034-01` completada
- `T0034-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/layout-node-renderer.tsx`
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/runtime-node-styling.ts`
  - `src/runtime/runtime-layout-context.tsx`
- Tests a crear o modificar:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Confirmar que un nodo con `layout.span` dentro de un `container` con `columns` recibe la ocupación visible correcta.
- Confirmar que `layout.span` funciona sobre nodos hoja y también sobre nodos compuestos como `container` o `form`.
- Confirmar que `repeater` no introduce wrapper de span propio y que una repetición solo ocupa columnas cuando el nodo raíz visible de su `template` declara `layout.span`.
- Confirmar que un nodo con `layout.span` fuera de un grid efectivo no rompe el render y no cambia visiblemente su layout.
- Confirmar que un `span` mayor que las columnas efectivas del padre se degrada a un ancho máximo seguro del grid padre en vez de abrir columnas implícitas inesperadas.
- Confirmar que varios hermanos con spans distintos mantienen una colocación estable dentro del grid ya existente.
- Confirmar que un nodo oculto por `queryStateFeedback` o `visibility` no deja un wrapper residual que reserve espacio de grid.
- Confirmar que el soporte previo de `columns`, `direction`, `align`, `justify`, `wrap` y `gap` sigue intacto.

### Documentación afectada
- Pendiente de actualización posterior para reflejar la nueva semántica transversal de `layout.span`, su degradación fuera de grid y el clamp seguro frente a columnas insuficientes.

### Criterios de finalización
- `layout.span` queda implementado una sola vez en el borde central del renderer y no repartido por nodo.
- El contexto de grid padre se propaga de forma explícita y acotada a la capa de layout.
- La degradación segura frente a padres no grid o spans sobredimensionados queda fijada por tests.
- No aparece una dependencia nueva del store global del runtime para resolver layout.

### Cierre de implementación
Completado cuando cualquier nodo soportado puede declarar `layout.span` con comportamiento estable y seguro dentro del grid del padre, y sin efecto fuera de él.

### Cierre documental
Pendiente de la pasada documental posterior. No se cierra en esta tarea.

## T0034-04

### Estado
Completada

### Objetivo
Actualizar la documentación funcional y técnica afectada para dejar explícitos el nuevo `variant` de `container`, el alcance de `card`, el bloque transversal `layout.span`, la degradación fuera de grid y el estado final del workflow de la feature.

### Fuera de alcance
- Reabrir decisiones de contrato o renderer ya cerradas.
- Convertir `README.md` en changelog.
- Introducir roadmap de responsive declarativo, nuevas variantes o theming desde JSON.

### Dependencias
- `T0034-03` completada

### Impacto esperado en archivos
- Documentación a crear o modificar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/features/index.md`
- Estado del workflow a actualizar:
  - `ai-workflow/features/0034-container-variants-and-responsive-grid-span/status.yaml`

### Tests requeridos
- No introduce tests nuevos por sí misma.
- Debe apoyarse en que `T0034-03` haya dejado en verde el subconjunto relevante y el gate global `pnpm test`.

### Documentación afectada
- Se cierra en esta propia tarea.

### Criterios de finalización
- La documentación estable deja claro que `variant` sigue siendo una variante cerrada y que `layout.span` solo es semántica de grid.
- La degradación fuera de grid y el clamp seguro frente al padre quedan documentados de forma consistente.
- `status.yaml` refleja la feature lista para implementación o completada según el estado real de la pasada.
- El índice de features deja de presentar `0034` como pendiente cuando corresponda.

### Cierre de implementación
No aplica; la implementación debe llegar cerrada desde `T0034-03`.

### Cierre documental
Completado cuando la documentación afectada queda actualizada y `status.yaml` refleja el estado real de la feature.
