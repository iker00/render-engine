# Tasks — `2026-09-02-14-22-modal-vertical-scroll`

## Orden de ejecución
Una única tarea (T1). No hay dependencias externas ni fases posteriores dentro de este plan.

---

## T1 — Limitar el alto del panel del modal a `90vh` con scroll vertical interno

### Objetivo
Modificar `getModalPanelClassName` para que el panel del nodo `modal` incluya siempre, independientemente de `size`, las utilidades Tailwind `max-h-[90vh]` y `overflow-y-auto`, de modo que el panel nunca desborde el viewport y ofrezca scroll vertical interno cuando el contenido lo supere.

### Fuera de alcance
- Cualquier cambio en `modalPanelSizeClassMap` (`sm | md | lg` y sus valores `max-w-*`).
- Cualquier cambio en `getModalOverlayClassName` o en la estructura del overlay.
- Regiones diferenciadas de header/footer con scroll independiente dentro del panel.
- Cualquier cambio en `modal-layout-node.tsx` (foco atrapado, ESC, click en overlay, ARIA, `defaultOpen`): esta tarea no toca ese archivo porque el componente ya consume `getModalPanelClassName(node.props?.size ?? 'md')` sin lógica adicional que deba adaptarse.
- Cualquier cambio en la validación de config del nodo `modal` (`src/config/`).

### Dependencias
Ninguna. Es la primera y única tarea del plan.

### Interfaces
**Consume**: ninguno.

**Produce**: ninguno — `getModalPanelClassName(size?: 'sm' | 'md' | 'lg'): string` ya existe y no cambia su firma pública, solo el contenido de la cadena que retorna. No hay tareas posteriores en este plan que dependan de un contrato nuevo.

### Impacto esperado en archivos
- Código: `src/runtime/runtime-node-styling-modal.ts` — añadir `'max-h-[90vh]'` y `'overflow-y-auto'` al array de clases que construye `getModalPanelClassName`, de forma incondicional (fuera del lookup `modalPanelSizeClassMap`, para que aplique igual a `sm`, `md` y `lg`).
- Tests:
  - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación) — casos sobre `getModalPanelClassName`.
  - `src/tests/layout-renderer/layout-renderer-modal.test.tsx` (ampliación) — caso dentro del `describe('sizes', ...)` existente.
  - `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación) — caso sobre instancias de modal dentro de `repeater.props.template`.
- Documentación: ninguna a actualizar en este paso (se declara como afectada para `update-app-documentation`, ver más abajo). No se modifica ningún archivo de `ai-workflow/docs/` desde esta tarea.

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-modal.test.tsx` (ampliación)
- `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación)

**Comportamiento cubierto**:
- `getModalPanelClassName('sm')`, `getModalPanelClassName('md')` y `getModalPanelClassName('lg')` incluyen `max-h-[90vh]` y `overflow-y-auto` los tres, sin excepción por tamaño.
- `getModalPanelClassName()` sin argumento (default `md`) también incluye `max-h-[90vh]` y `overflow-y-auto`.
- Las clases de ancho existentes por tamaño (`max-w-md`/`max-w-2xl`/`max-w-4xl`) y las clases fijas ya cubiertas por tests existentes (`w-full`, `p-6`, `cursor-auto`, ausencia de `cursor-pointer`) no cambian: los tests existentes de `getModalPanelClassName` en `runtime-node-styling.test.ts` deben seguir en verde sin modificarse, solo se añaden casos nuevos.
- En el runtime renderizado (`layout-renderer-modal.test.tsx`, dentro del `describe('sizes', ...)` ya existente que abre un modal `sm`, `md` y `lg` por separado y lee `className` de `modal-panel`): las tres clases capturadas (`smClass`, `mdClass`, `lgClass`) contienen `max-h-[90vh]` y `overflow-y-auto`, confirmando aplicación uniforme end-to-end además de a nivel de función pura.
- Un `modal` declarado dentro de `repeater.props.template` (`layout-renderer-modal-repeater.test.tsx`): al abrir una instancia de modal de una iteración concreta, el `className` de su `modal-panel` contiene `max-h-[90vh]` y `overflow-y-auto`, igual que fuera de un repeater — cubre el criterio de aceptación de aplicación independiente por iteración sin necesitar lógica nueva porque la función de estilo es la misma para toda instancia.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-modal.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx
```

**Restricciones**:
- No añadir un test dedicado a "contenido que no cabe hace scroll real" simulando alturas de pixel: la resolución de casos límite de la spec (contenido que cabe vs. que no cabe, viewport pequeño, contenido dinámico que crece) es puramente CSS (`max-h-[90vh]` + `overflow-y-auto`) y no observable de forma fiable en jsdom; basta con verificar que las clases correctas están presentes.
- No añadir snapshots de clase completa (`toBe` sobre el string completo de `className`); usar `toContain` como en los tests existentes de la misma suite, para no acoplar el test a clases no relacionadas con el alcance de esta tarea.
- Reusar el harness y los helpers de render ya presentes en cada fichero (`renderRuntimePage`, `RuntimeStateProvider`, etc.); no introducir un helper de render nuevo para este caso.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/modal.md`: la sección "Reglas de render" debe reflejar tras la implementación que el panel limita su alto a `90vh` con scroll vertical interno, de forma uniforme en `sm`/`md`/`lg` y también dentro de `repeater.props.template`. Esta actualización la ejecuta `update-app-documentation`, no esta tarea.

### Criterios de finalización
- `getModalPanelClassName` incluye `max-h-[90vh]` y `overflow-y-auto` para `sm`, `md`, `lg` y para el valor por defecto, sin alterar ninguna otra clase existente.
- Los tres ficheros de test listados están en verde, incluidos los casos nuevos y los ya existentes sin regresión.
- El umbral global de cobertura del proyecto (`pnpm test`) se mantiene sin romperse.

### Cierre de implementación
Completo cuando el código de `src/runtime/runtime-node-styling-modal.ts` está modificado, los tres ficheros de test pasan (`pnpm test --run` sobre cada uno y `pnpm test` global sin romper el umbral de cobertura), y no queda ningún otro archivo de código o test pendiente de tocar para esta feature.
