# Feature 0098 — Escala de tamaños del nodo `modal`: plan de implementación

## T1 — Redefinir la escala de anchos en `getModalPanelClassName`

### Estado
completada

### Objetivo
Sustituir el mapeo de anchos de `modalPanelSizeClassMap` en `src/runtime/runtime-node-styling.ts` (~L753) para que produzca clases Tailwind visiblemente diferenciadas entre los tres valores del catálogo cerrado `sm | md | lg`:

- `sm` → `max-w-md` (antes `max-w-sm`).
- `md` → `max-w-2xl` (antes `max-w-md`).
- `lg` → `max-w-4xl` (antes `max-w-lg`).

El resto de la función `getModalPanelClassName` no cambia: mismo orden de clases, mismo array de clases fijas (`relative`, `w-full`, `rounded-card`, `border`, `border-app-border-soft`, `bg-white`, `p-6`, `shadow-shell`, `cursor-auto`, `sm:p-8`), mismo default `'md'` cuando no se pasa `size`, misma firma de tipos (`'sm' | 'md' | 'lg'`).

Este cambio es puramente de datos (valores del `Record`), no de estructura de la función ni de su firma.

### Fuera de alcance
- Ampliar el catálogo de `props.size` con valores nuevos.
- Cambiar la validación Zod de `props.size` (sigue rechazando cualquier valor fuera de `sm | md | lg`; no hay ningún fichero de validación que dependa de los literales de ancho, solo del enum `sm | md | lg`, que no cambia).
- Cambiar `getModalOverlayClassName`, el padding responsive (`p-6`, `sm:p-8`) o cualquier otra clase fija del panel.
- Cambiar `modal-layout-node.tsx`: sigue invocando `getModalPanelClassName(node.props?.size ?? 'md')` sin modificación, ya que el nuevo mapeo vive enteramente dentro de `getModalPanelClassName`.
- Actualizar `ai-workflow/docs/app-features/nodes/modal.md`: la ficha describe los tamaños con adjetivos cualitativos ("estrecho", "estándar", "ancho") sin detallar valores en rem/px, y esa descripción sigue siendo válida con la nueva escala.

### Dependencias
Ninguna. Es la única tarea de la feature.

### Impacto esperado en archivos

**Código:**
- `src/runtime/runtime-node-styling.ts` — modificar los tres valores del objeto `modalPanelSizeClassMap` (~L753-757). No se toca la firma ni el cuerpo de `getModalPanelClassName` más allá de esos tres valores.

**Tests:**
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)

**Documentación:**
- Ninguna. `ai-workflow/docs/app-features/nodes/modal.md` no requiere cambios: solo usa los adjetivos "estrecho/estándar/ancho" para describir `props.size`, sin valores concretos de ancho, y esa descripción sigue siendo precisa con la nueva escala (ver spec.md, sección "Documentación probablemente afectada").

### Tests

**Ficheros de test:**
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación) — añadir casos dentro del `describe('getModalOverlayClassName and getModalPanelClassName', ...)` existente (~L1751), sin crear un nuevo `describe` de nivel superior.

**Comportamiento cubierto:**
- `getModalPanelClassName('sm')` incluye la clase `max-w-md` (`toContain`) y no incluye la clase `max-w-sm` (`not.toContain`).
- `getModalPanelClassName('md')` incluye la clase `max-w-2xl` (`toContain`) y no incluye la clase `max-w-md` (`not.toContain`).
- `getModalPanelClassName('lg')` incluye la clase `max-w-4xl` (`toContain`) y no incluye la clase `max-w-lg` (`not.toContain`).
- `getModalPanelClassName()` sin argumento devuelve exactamente la misma cadena que `getModalPanelClassName('md')` (`toBe`), preservando el default documentado.
- Las clases fijas no relacionadas con el ancho (`w-full`, `rounded-card`, `border`, `border-app-border-soft`, `bg-white`, `p-6`, `sm:p-8`, `shadow-shell`, `relative`) siguen presentes en los tres tamaños (`toContain` sobre al menos `w-full` y `p-6` para cada uno de `sm`, `md`, `lg`, reusando los tests ya existentes de `cursor-auto`/`cursor-pointer` como referencia de estilo).
- Los tests existentes de `cursor-auto`/`cursor-pointer` para `md` y `sm` (~L1756-1766) no se modifican; se mantienen intactos porque el comportamiento de cursor no cambia.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
```

**Restricciones:**
- No modificar `src/tests/layout-renderer/layout-renderer-modal.test.tsx`: el test existente `sizes > sm, md and lg produce visibly different panel width classes` (~L297) ya verifica diferenciación sin acoplarse a clases literales, por lo que sigue pasando sin cambios y no debe duplicarse con asserciones literales a nivel de render (la asserción literal por tamaño vive únicamente en el test unitario de `getModalPanelClassName`).
- Usar `toContain`/`not.toContain`/`toBe` sobre la cadena devuelta; no snapshotear la cadena completa de clases.

### Documentación afectada
Ninguna. Ver justificación en "Impacto esperado en archivos" y en spec.md.

### Criterios de finalización

**Cierre de implementación:**
- `modalPanelSizeClassMap` en `src/runtime/runtime-node-styling.ts` refleja exactamente `sm: 'max-w-md'`, `md: 'max-w-2xl'`, `lg: 'max-w-4xl'`.
- `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts` en verde con los casos nuevos incluidos.
- `pnpm test` completo sigue en verde y el umbral global de cobertura (80% en functions/lines/statements sobre `src/`) se mantiene.

---

## Siguiente tarea
No hay más tareas: T1 es la única unidad de trabajo de esta feature. Al completarse y validarse, la feature queda lista para la fase de documentación (`update-app-documentation`), aunque en este caso no haya cambios documentales pendientes más allá de la revisión ya descartada en spec.md.
