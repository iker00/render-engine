# Test plan: Dynamic strings

## Gate general
- Implementar con enfoque tests-first por tarea.
- Ejecutar tests enfocados durante cada tarea para mantener feedback corto.
- Ejecutar `pnpm test` antes de cerrar T05 para validar suite completa y cobertura.
- El umbral global vigente sigue siendo minimo 80% en `functions`, `lines` y `statements` sobre `src/`.
- No se requieren tests e2e: el comportamiento se cubre con unit tests de resolucion y tests de integracion del runtime en jsdom.

## Unit tests esperados

### Resolucion central de interpolacion
Archivo: `src/tests/runtime-reference-resolution.test.tsx`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx
```

Debe validar:
- Strings sin delimitadores conservan literal, referencia completa, referencia completa escapada y diagnosticos existentes.
- Strings con uno o varios placeholders sustituyen cada referencia por texto visible.
- Placeholders consecutivos, al inicio, al final y con espacios alrededor de la referencia.
- `string`, `number`, `boolean`, `0` y `false` se muestran como texto.
- Objetos, arrays, `null`, `undefined`, ruta ausente, referencia invalida, referencia no soportada y placeholder vacio producen string vacio.
- `params.userId` resuelve y `params.user.id` se trata como fuera de contrato.
- `item` e `item.*` resuelven solo con `iterationContext`; fuera de ese contexto degradan a string vacio.
- Contenido de placeholder que fuera de `{{...}}` seria literal, como `{{foo.bar}}` o `{{texto}}`, produce string vacio dentro del placeholder.
- Delimitadores no emparejados no rompen la resolucion.

### Validacion de contrato de proyecciones
Archivo: `src/tests/runtime-config-validation.test.ts`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

Debe validar:
- `list.props.items.itemText` acepta strings con `{{item.*}}` en colecciones manuales y dinamicas de objetos.
- `select`, `radioGroup` y `checkboxGroup` aceptan `label` y `value` con templates en colecciones manuales y dinamicas de objetos.
- Arrays historicos de opciones aceptan `label` interpolado y `value` string interpolado, sin relajar la homogeneidad vigente de values.
- Las proyecciones del catalogo cerrado que contienen delimitadores no emparejados se aceptan y quedan para degradacion estable en runtime.
- Las proyecciones sin template siguen rechazando rutas invalidas.
- `repeater.props.items.key`, `props.items.source`, `visibility.reference`, `queryStateFeedback` y cabeceras de `table` no se convierten en superficies interpolables.
- Requests y `navigateTo.params` conservan su validacion previa.

## Integration tests esperados

### Superficies visibles directas
Archivo: `src/tests/layout-renderer.test.tsx`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

Debe validar:
- `heading.props.text` y `paragraph.props.text` renderizan texto literal combinado con `queries.*`, `forms.*`, `params.*` e `item.*`.
- `button.props.label` interpola `item.*` dentro de `repeater` y no rompe acciones existentes.
- Labels de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` interpolan y se actualizan cuando cambia el estado observado.
- Al menos un label de campo bajo `repeater` resuelve `item.*` desde el contexto de iteracion.
- `select` usa el label resuelto como nombre accesible.
- `image.props.src` interpola el `src` efectivo y conserva no render cuando queda vacio.
- `image.props.alt` interpola y degrada placeholders ausentes a string vacio.
- `table` manual y dinamica interpolan celdas sin eliminar filas por placeholders ausentes.

### Listas y opciones
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Listas con strings declarados directamente interpolan referencias globales e `item.*` cuando viven bajo `repeater`.
- `list.props.items.itemText` usa `item.*` local por entrada de coleccion.
- `select` dinamico renderiza labels compuestos y almacena values interpolados como strings efectivos.
- `radioGroup` y `checkboxGroup` comparten la misma semantica de labels y values.
- Values interpolados desde `0` y `false` se conservan como los strings efectivos `0` y `false`.
- Values interpolados a string vacio y values duplicados conservan una degradacion estable sin romper render, normalizacion ni submit.
- Cambios en queries o formularios actualizan labels/values efectivos y limpian selecciones invalidas con la politica existente.

### Superficies fuera de alcance
Archivos:
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-config-validation.test.ts`

Comando enfocado:
```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-config-validation.test.ts
```

Debe validar:
- `api.query`, `api.body`, `api.headers`, `pages[].preloads.*.query/body/headers`, `button.props.action.*` y `form.submitAction.*` no interpolan strings parciales.
- Requests con referencias completas ausentes siguen fallando con `request-build-failed`; templates parciales en requests se tratan como literales.
- `navigateTo.params` resuelve referencias completas soportadas, pero no interpola `"prefix-{{params.userId}}"`.
- `defaultValue` conserva referencias completas soportadas y trata templates parciales como literales.
- `visibility.value` compara literales aunque contengan `{{...}}`.
- `visibility.reference`, fuentes de coleccion y `repeater.props.items.key` siguen cerrados.

## E2E
No aplican tests e2e para esta entrega. No hay integracion real con backend ni comportamiento de navegador que no pueda cubrirse con jsdom y mocks existentes.

## Comandos de cierre
Durante la implementacion:
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
pnpm exec vitest run src/tests/layout-renderer.test.tsx
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-config-validation.test.ts
```

Antes de dar por cerrada la pasada de implementacion:
```bash
pnpm test
```
