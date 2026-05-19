# Test plan: Compact institutional density

## Objetivo de validación
Demostrar que la compactación visual del runtime reduce densidad de forma coordinada en shell, tipografía, formularios, secciones y acciones, sin romper la baseline institucional existente ni la semántica funcional del renderer.

Estado actual del workflow:
- la feature ya cerró implementación, validación y documentación
- este plan se conserva como contrato de validación histórico de la pasada ejecutada
- no queda ninguna ejecución pendiente mientras `status.yaml` mantenga `phase: complete`

## Unit tests esperados

### Convención visual central
- Archivo objetivo:
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - las clases expuestas por `getAppShellContentClassName`, `getAppShellFrameClassName`, `getRuntimePageClassName`, `getHeadingNodeClassName` y `getParagraphNodeClassName` reducen la separación y la escala visual base respecto al baseline anterior
  - las clases de `getFormNodeClassName`, `getFieldWrapperClassName`, `getFieldLabelClassName` y `getFieldControlClassName` definen una densidad más compacta sin perder foco visible ni estados de error
  - las clases de `getPrimaryButtonNodeClassName` y `getSecondaryButtonNodeClassName` compactan padding y altura percibida, pero conservan la jerarquía visual entre CTA principal y acción secundaria
  - las clases de `getChoiceGroupClassName`, `getChoiceOptionClassName` y `getContainerNodeStyling({ surface: 'form-section' })` reducen los huecos verticales acumulados sin eliminar la separación por bloques
  - la diferencia entre móvil base y breakpoints mayores queda fijada mediante clases responsivas estables, no por mediciones manuales ni snapshots opacos
- Comandos recomendados:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts`

## Integration tests esperados

### Shell y composición visible
- Archivos objetivo:
  - `src/tests/app-shell.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - el shell y la página visible siguen renderizando dentro de la baseline institucional clara ya existente
  - el bloque introductorio de una página representativa ocupa menos altura total que antes y mantiene una jerarquía clara entre título, descripción y contenido
  - las pantallas sin formulario también heredan la compactación de título y espaciado sin quedar visualmente colapsadas
  - los `container` dentro de `form` siguen actuando como secciones separadas, pero con un espaciado vertical más contenido
  - las aserciones visibles distinguen, cuando aplique, la densidad móvil base y los ajustes `sm:`/`lg:` sin exigir tests de navegador real
- Comandos recomendados:
  - `pnpm exec vitest run src/tests/app-shell.test.tsx src/tests/layout-renderer.test.tsx`

### Formularios, acciones y regresión funcional
- Archivos objetivo:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` siguen funcionando igual a nivel de edición, validación y submit tras el ajuste visual
  - `textarea` y `select.multiple` conservan una altura mínima utilizable aunque el sistema general se compacte
  - el submit implícito dentro de `form` sigue exponiendo CTA principal y mantiene su semántica funcional
  - las acciones secundarias y de navegación mantienen la semántica actual aunque su tamaño visible se reduzca
  - la compactación no rompe la lógica de errores visibles, foco ni feedback de formularios
- Comandos recomendados:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx`

### Integración sobre configuración representativa
- Archivos objetivo:
  - `src/tests/app-shell.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - la configuración local de desarrollo sigue siendo válida y suficientemente representativa para ejercer la nueva densidad compacta
  - el cierre de acciones queda más próximo al contenido y la composición general sigue siendo coherente entre móvil base y breakpoints mayores fijados por clases responsivas estables
- Comandos recomendados:
  - `pnpm exec vitest run src/tests/app-shell.test.tsx src/tests/runtime-state.test.tsx`

## E2E
- No aplica en esta feature.
- La compactación visual debe quedar cerrada con tests unitarios e integrados sobre clases estables y comportamiento observable del runtime, sin introducir navegador real en esta iteración.

## Secuencia recomendada de validación durante implementación
1. Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts` tras cerrar la compactación de la convención visual central.
2. Ejecutar `pnpm exec vitest run src/tests/app-shell.test.tsx src/tests/layout-renderer.test.tsx` tras cerrar la compactación del bloque superior y de la composición visible.
3. Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx` tras cerrar la compactación de formularios y acciones.
4. Ejecutar `pnpm test` al final de `T0032-03` para validar regresión global y gate de cobertura.

## Gate de cierre
- La implementación no debe darse por cerrada hasta dejar en verde los bloques relevantes anteriores.
- `pnpm test` debe seguir confirmando el umbral mínimo global del 80% en `functions`, `lines` y `statements` sobre `src/`.
- El cierre documental de la feature debe apoyarse en una pasada previa con tests relevantes en verde; no sustituye la validación técnica.
