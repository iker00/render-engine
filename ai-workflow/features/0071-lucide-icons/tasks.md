# Feature 0071-lucide-icons — Plan de implementación

Plan de ejecución secuencial para añadir soporte de iconos Lucide al runtime. Cada tarea debe completarse y dejar sus tests en verde antes de pasar a la siguiente. Las tareas posteriores asumen que el componente compartido `IconNode` (T1) ya existe.

## Convenciones del plan

- Todos los nodos que reciben `props.icon` siguen el mismo contrato definido por la spec: string opcional, formato PascalCase de Lucide, degradación silenciosa (sin error, sin rechazo en bootstrap) cuando el nombre no resuelve o es string vacío.
- Todos los iconos renderizados pasan por el componente compartido `IconNode` (T1) para garantizar `aria-hidden="true"`, resolución dinámica única, tamaño Tailwind coherente y mismo comportamiento de degradación silenciosa.
- Los tamaños del icono se eligen con utilidades Tailwind (`size-4`, `size-5`, etc.) coherentes con la escala tipográfica del nodo que lo contiene; no se usan estilos inline.
- La validación previa (`zod` + `validate-layout-nodes`) acepta cualquier string como `props.icon`. No se valida contra un catálogo cerrado de nombres.

---

## T1 — Instalación de `lucide-react` y componente compartido `IconNode`

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Instalar `lucide-react` como dependencia de producción y crear el componente compartido `IconNode` que resuelve un nombre de icono Lucide (PascalCase) a runtime y aplica la política de degradación silenciosa, accesibilidad y tamaño Tailwind.
- **Fuera de alcance**:
  - Integrar `IconNode` en ningún nodo del catálogo (las integraciones viven en T2–T7).
  - Catálogo cerrado de iconos permitidos.
  - Validación de `props.icon` en `src/config/`.
  - Dynamic imports por icono individual.
- **Dependencias**: ninguna.

### Impacto esperado en archivos

- Código a modificar:
  - `package.json` (añadir `lucide-react` en `dependencies`).
  - `pnpm-lock.yaml` (regenerado por `pnpm install`).
- Código a crear:
  - `src/runtime/nodes/icon-node.tsx` con el componente compartido `IconNode`.
- Tests a crear:
  - `src/tests/runtime/runtime-icon-node.test.tsx`.
- Documentación a revisar:
  - `ai-workflow/docs/current-state.md`: añadir `lucide-react` al inventario de dependencias del runtime si ya existe esa sección; si no, no editar.
  - `ai-workflow/docs/architecture.md`: no editar (la integración de iconos no cambia ninguna frontera de capa).
  - No se crea ficha por nodo aquí; las fichas se actualizan al integrar cada nodo en sus tareas correspondientes.

### Contrato funcional del componente `IconNode`

- Firma:
  - props: `{ name: string | undefined; className?: string }`.
- Comportamiento:
  - Si `name` es `undefined`, `null` o string vacío, devuelve `null` (no renderiza nada).
  - Si `name` resuelve a un export válido de `lucide-react` (función/componente), renderiza ese componente con `aria-hidden="true"` y `className` recibido.
  - Si `name` no corresponde a ningún export válido de `lucide-react`, devuelve `null` (degradación silenciosa, sin `console.error` ni `console.warn`).
- La resolución del export se hace en tiempo de render leyendo el módulo `lucide-react` completo (import de paquete completo, sin dynamic imports por icono).
- El componente no añade `data-layout-node` ni envuelve el icono en ningún wrapper.

### Tests

- **Ficheros de test**:
  - `src/tests/runtime/runtime-icon-node.test.tsx` (nuevo).
- **Comportamiento cubierto**:
  - Render con nombre válido (`"Search"`): el icono aparece en el DOM como `<svg>` con `aria-hidden="true"`.
  - Render con nombre válido (`"User"`): aparece en el DOM como `<svg>` distinto al anterior (asegura resolución dinámica real, no aliasing).
  - Render con `className` pasado: la clase aparece en el `<svg>` resultante.
  - Render con nombre desconocido (`"NonExistentIconXyz"`): no renderiza nada (el contenedor del test queda vacío) y no produce mensaje en consola.
  - Render con `name=""` (string vacío): no renderiza nada.
  - Render con `name={undefined}`: no renderiza nada.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/runtime/runtime-icon-node.test.tsx`
- **Restricciones**:
  - Capturar `console.error` y `console.warn` con `vi.spyOn` para verificar que la degradación silenciosa no emite avisos.

### Documentación afectada

- `ai-workflow/docs/current-state.md` (si lista stack/dependencias).
- Ninguna ficha de `app-features/nodes/` en esta tarea.
- `ai-workflow/docs/test-index.md` (añadir el nuevo fichero de test).

### Criterios de finalización

- `lucide-react` instalado como `dependencies`.
- `src/runtime/nodes/icon-node.tsx` existe y exporta `IconNode`.
- Los tests de `runtime-icon-node.test.tsx` están en verde.
- `pnpm test` global sigue en verde y la cobertura no baja del umbral exigido.

### Cierre de implementación

- Dependencia instalada, componente compartido publicado y tests propios verdes.
- No se ha modificado todavía ningún nodo del catálogo.

---

## T2 — Alert: reemplazo del placeholder por iconos Lucide semánticos por `props.type`

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Reemplazar el `<span>icon</span>` placeholder del nodo `alert` por un icono Lucide semántico fijo derivado de `props.type`. No se añade prop nueva al contrato.
- **Fuera de alcance**:
  - Añadir un nuevo prop al nodo `alert`.
  - Permitir override del icono por JSON.
  - Cambiar el layout, colores, tamaños o tipografía del bloque.
- **Dependencias**: T1.

### Impacto esperado en archivos

- Código a modificar:
  - `src/runtime/nodes/alert-layout-node.tsx`.
- Código a crear: ninguno.
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-alert.test.tsx`.
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/alert.md`.

### Contrato funcional

- En `alert-layout-node.tsx` se define un mapping cerrado `alertTypeIconMap: Record<AlertType, string>` cuyas claves son `neutral | primary | success | warning | danger | info` y cuyos valores son nombres de iconos Lucide:
  - `neutral`: `"MessageCircle"` (mensaje genérico).
  - `primary`: `"Megaphone"` (información destacada).
  - `success`: `"CheckCircle"` (confirmación).
  - `warning`: `"AlertTriangle"` (advertencia triangular).
  - `danger`: `"XCircle"` (error/cancelación).
  - `info`: `"Info"`.
- El `<span>` con el literal `icon` se sustituye por `<IconNode name={alertTypeIconMap[alertType]} className={\`${text} size-5 shrink-0\`} />`.
- El resto del bloque (layout `flex items-start gap-3 rounded-md p-4`, fondos, título y mensaje) se conserva sin cambios.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-alert.test.tsx` (ampliación).
- **Comportamiento cubierto**:
  - Para cada tipo (`neutral | primary | success | warning | danger | info`) el alert renderiza un `<svg>` dentro del bloque (verificable por `data-layout-node="alert"` → primer `<svg>` descendiente).
  - El `<svg>` lleva `aria-hidden="true"`.
  - El `<svg>` lleva la clase de acento del tipo (`text-gray-700`, `text-blue-700`, etc.) sobre el mismo elemento.
  - El literal `icon` ya no aparece como texto dentro del bloque (regresión negativa).
  - El tipo `success` y `warning` renderizan elementos `<svg>` distintos entre sí (asegura mapping real por tipo, no icono único).
  - Comportamiento de título y mensaje sigue intacto (un caso con `title` y otro sin).
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-alert.test.tsx`
- **Restricciones**:
  - Reusar los helpers `renderRuntimePage` ya presentes en el fichero. No introducir un harness nuevo.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/alert.md`: actualizar la sección de icono placeholder y reflejar que el icono es Lucide fijo por tipo. No se modifica el contrato de props.

### Criterios de finalización

- El bloque de `alert` renderiza el icono Lucide correspondiente al tipo.
- Los tests ampliados están en verde.
- `pnpm test` global sigue en verde.

### Cierre de implementación

- Nodo `alert` consumiendo `IconNode` con mapping cerrado por tipo, sin cambios en el contrato JSON.

---

## T3 — Button: prop opcional `props.icon` con icono a la izquierda del label

- **ID**: T3
- **Estado**: completed
- **Objetivo**: Añadir `props.icon` opcional al nodo `button`. Cuando está presente y resuelve, el icono se renderiza a la izquierda del label. La variante, color y `fullWidth` no se ven afectados.
- **Fuera de alcance**:
  - Posición configurable del icono.
  - Tamaño o color de icono configurable independiente del botón.
  - Iconos en otros nodos.
- **Dependencias**: T1.

### Impacto esperado en archivos

- Código a modificar:
  - `src/config/runtime-config-types.ts` (añadir `icon?: string` en `ButtonLayoutNode['props']`).
  - `src/config/runtime-config-zod.ts` (añadir `icon: z.string().optional()` en `buttonNodeSchema.props`).
  - `src/runtime/nodes/button-layout-node.tsx` (renderizar `<IconNode>` antes del label cuando `props.icon` esté presente).
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`.
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts`.
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/button.md`.

### Contrato funcional

- `props.icon` es string opcional.
- Cuando está presente, el contenido visible del botón es `<IconNode name={icon} className="size-4 shrink-0" />` seguido del label resuelto, separados por un gap apropiado (clase Tailwind del propio botón).
- La inclusión del icono no debe alterar el `type` del `<button>` (sigue siendo `submit` cuando el botón actúa como submit implícito).
- Si `IconNode` devuelve `null` (icono no reconocido o vacío), el botón se renderiza con solo el label, sin contenedor vacío visible.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación).
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).
- **Comportamiento cubierto**:
  - Botón con `props.icon: "Search"` renderiza un `<svg>` con `aria-hidden="true"` antes del texto del label en el DOM.
  - Botón con `props.icon: "Search"` combinado con `variant: outline` y `color: danger` mantiene las clases de variante y color (`outline`/`danger`) intactas y muestra el icono.
  - Botón con `props.icon: "Search"` y `fullWidth: true` mantiene la clase de `fullWidth` y muestra el icono.
  - Botón con `props.icon: "NonExistentIconXyz"` se renderiza solo con el label, sin `<svg>` en el botón.
  - Botón sin `props.icon` renderiza igual que antes (sin `<svg>`, sin regresión).
  - Validación previa acepta `props.icon` como string arbitrario sin rechazo en bootstrap.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
- **Restricciones**:
  - Reusar los harnesses ya presentes en ambos ficheros.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/button.md`: añadir `props.icon` opcional en la tabla de props y su comportamiento.

### Criterios de finalización

- Tipos, zod y render reflejan el nuevo `props.icon`.
- Los tests ampliados están en verde.
- `pnpm test` global sigue en verde.

### Cierre de implementación

- Botón soporta `props.icon` con degradación silenciosa, sin afectar el resto de variantes ni el comportamiento de submit implícito.

---

## T4 — Heading y Paragraph: prop opcional `props.icon` con icono a la izquierda del texto

- **ID**: T4
- **Estado**: completed
- **Objetivo**: Añadir `props.icon` opcional a los nodos `heading` y `paragraph`. Cuando está presente y resuelve, el icono se renderiza a la izquierda del texto. La jerarquía semántica del `heading` (`<h1>`–`<h6>`) y la del `paragraph` (`<p>`) se conservan.
- **Fuera de alcance**:
  - Tamaño o color del icono configurable.
  - `list` (no recibe `props.icon` en esta feature).
  - Cambios en `props.text` o en clases tipográficas existentes.
- **Dependencias**: T1.

### Impacto esperado en archivos

- Código a modificar:
  - `src/config/runtime-config-types.ts` (`HeadingLayoutNode['props']` y `ParagraphLayoutNode['props']` reciben `icon?: string`).
  - `src/config/runtime-config-zod.ts` (`headingNodeSchema.props` y `paragraphNodeSchema.props` reciben `icon: z.string().optional()`).
  - `src/runtime/nodes/heading-layout-node.tsx` (`createElement` debe incluir el icono como primer hijo cuando aplique).
  - `src/runtime/nodes/paragraph-layout-node.tsx` (idéntico patrón).
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (cubre heading y paragraph).
  - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (este fichero ya cubre layouts raíz básicos con heading/paragraph; ampliar aquí los casos de aceptación de `props.icon`).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`.

### Contrato funcional

- `props.icon` opcional, string.
- Heading: el contenido se renderiza como `<hN data-layout-node="heading" className=...>{icon}{text}</hN>` donde `{icon}` es `<IconNode name={icon} className="size-[1em] shrink-0 inline-block align-middle mr-2" />` cuando hay icono. Si no hay icono o no resuelve, el render es idéntico al actual.
- Paragraph: misma idea, el `<p>` recibe primero `<IconNode>` y luego el texto. Usar contenedor flex inline (`<span className="inline-flex items-baseline gap-2">…</span>`) o equivalente Tailwind que mantenga la línea base alineada y no rompa la semántica del `<p>`.
- La selección concreta de clases Tailwind queda a discreción del implementador siempre que se cumpla: el icono aparece visualmente a la izquierda del texto y la baseline tipográfica se mantiene aceptable.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (ampliación).
  - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación).
- **Comportamiento cubierto**:
  - `heading` con `props.icon: "User"` y `level: 2` renderiza un `<h2 data-layout-node="heading">` que contiene un `<svg>` con `aria-hidden="true"` antes del texto.
  - `heading` con `props.icon: "User"` en `level: 1` mantiene `<h1>` como elemento de jerarquía.
  - `heading` sin `props.icon` se renderiza exactamente como antes (sin `<svg>` dentro del `<hN>`).
  - `paragraph` con `props.icon: "Info"` renderiza un `<p data-layout-node="paragraph">` que contiene un `<svg>` con `aria-hidden="true"` antes del texto.
  - `paragraph` con `props.icon: "NonExistentIconXyz"` se renderiza con solo el texto, sin `<svg>`.
  - Validación previa: un layout que incluya un `heading` con `props.icon: "Search"` es aceptado sin errores.
  - Validación previa: un layout que incluya un `paragraph` con `props.icon: "Search"` es aceptado sin errores.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx`
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`
- **Restricciones**:
  - No alterar las clases tipográficas existentes (`getHeadingNodeClassName`, `getParagraphNodeClassName`). El icono se compone como hijo del elemento, no como wrapper adicional.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`: añadir `props.icon` opcional para `heading` y `paragraph`. `list` queda explícitamente fuera.

### Criterios de finalización

- Tipos, zod y render reflejan el nuevo `props.icon` en ambos nodos.
- Los tests ampliados están en verde.
- `pnpm test` global sigue en verde.

### Cierre de implementación

- `heading` y `paragraph` soportan `props.icon` con degradación silenciosa y jerarquía semántica intacta.

---

## T5 — Link: prop opcional `props.icon` con icono a la izquierda del label

- **ID**: T5
- **Estado**: completed
- **Objetivo**: Añadir `props.icon` opcional al nodo `link`. Cuando está presente y resuelve, el icono se renderiza a la izquierda del label del enlace dentro del `<a>`.
- **Fuera de alcance**:
  - Cambios en el comportamiento de `props.href`, `props.action`, `props.download` o `props.target`.
  - Cambios en la clase visual del enlace.
- **Dependencias**: T1.

### Impacto esperado en archivos

- Código a modificar:
  - `src/config/runtime-config-types.ts` (`LinkLayoutNode['props']` recibe `icon?: string`).
  - `src/config/runtime-config-zod.ts` (`linkNodeSchema.props` recibe `icon: z.string().optional()`).
  - `src/runtime/nodes/link-layout-node.tsx` (renderizar `<IconNode>` como primer hijo del `<a>` cuando aplique).
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ya cubre `link`).
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ya cubre validación de `link`).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/link.md`.

### Contrato funcional

- `props.icon` opcional, string.
- El `<a data-layout-node="link">` renderiza, cuando hay icono resuelto, `<IconNode className="size-4 shrink-0 inline-block align-middle mr-1" />` antes del label. El resto de atributos (`href`, `download`, `target`, `onClick`) se mantiene intacto.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación).
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).
- **Comportamiento cubierto**:
  - `link` con `props.icon: "ExternalLink"` y `props.href: "https://example.com"` renderiza un `<a>` con `<svg aria-hidden="true">` antes del label.
  - `link` con `props.icon: "ExternalLink"` y `props.action: { type: "navigateTo", pageId: "home" }` renderiza el `<svg>` y mantiene el `href` decorativo `#/home`.
  - `link` con `props.icon: "NonExistentIconXyz"` renderiza sin `<svg>`, solo con el label.
  - `link` sin `props.icon` se renderiza exactamente como antes.
  - Validación previa acepta `props.icon` como string arbitrario.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
- **Restricciones**:
  - Reusar harnesses ya presentes en ambos ficheros.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/link.md`: añadir `props.icon` en la tabla de props y su comportamiento de render.

### Criterios de finalización

- Tipos, zod y render reflejan el nuevo `props.icon`.
- Los tests ampliados están en verde.
- `pnpm test` global sigue en verde.

### Cierre de implementación

- `link` soporta `props.icon` con degradación silenciosa y comportamiento de navegación intacto.

---

## T6 — Stat: prop opcional `props.icon` con icono a la izquierda del bloque label/value

- **ID**: T6
- **Estado**: completed
- **Objetivo**: Añadir `props.icon` opcional al nodo `stat`. Cuando está presente y resuelve, el icono se renderiza a la izquierda del bloque que contiene `label` y `value` (no por encima de cada uno, sino una columna de icono independiente). El icono debe ser coherente visualmente tanto en variante `accent` como en variante `tinted`.
- **Fuera de alcance**:
  - Cambio en los colores de la paleta semántica.
  - Tamaño del icono configurable por JSON.
  - Color del icono independiente del color del stat.
- **Dependencias**: T1.

### Impacto esperado en archivos

- Código a modificar:
  - `src/config/runtime-config-types.ts` (`StatLayoutNode['props']` recibe `icon?: string`).
  - `src/config/runtime-config-zod.ts` (`statNodeSchema.props` recibe `icon: z.string().optional()`).
  - `src/runtime/nodes/stat-layout-node.tsx` (cuando hay icono, el contenido se envuelve en una fila `flex items-center gap-3` con `<IconNode>` a la izquierda y el bloque `label`/`value` a la derecha; sin icono se preserva el render actual).
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-stat.test.tsx`.
  - `src/tests/config-validation/runtime-config-validation-stat.test.ts`.
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/stat.md`.

### Contrato funcional

- `props.icon` opcional, string.
- En variante `accent`: el icono se renderiza dentro de `<div data-layout-node="stat">`, a la izquierda del bloque `label`/`value`, con el color del borde (o un tono coherente con la paleta `accent`).
- En variante `tinted`: el icono se renderiza dentro del fondo tinted, a la izquierda del bloque `label`/`value`, usando una clase de color coherente con `text-{color}-600` o `text-{color}-700`.
- Si `IconNode` devuelve `null`, el stat se renderiza exactamente como antes (sin contenedor flex extra ni espacio reservado para el icono).

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (ampliación).
  - `src/tests/config-validation/runtime-config-validation-stat.test.ts` (ampliación).
- **Comportamiento cubierto**:
  - `stat` con `variant: accent`, `color: primary` y `props.icon: "TrendingUp"` renderiza un `<svg>` con `aria-hidden="true"` dentro de `[data-layout-node="stat"]` y mantiene la clase `border-blue-500` y el contenido `label`/`value`.
  - `stat` con `variant: tinted`, `color: success` y `props.icon: "TrendingUp"` renderiza un `<svg>` con `aria-hidden="true"` y mantiene la clase `bg-green-100`.
  - `stat` con `props.icon: "NonExistentIconXyz"` se renderiza igual que el stat sin icono.
  - `stat` sin `props.icon` se renderiza exactamente como antes (sin `<svg>`).
  - Validación previa acepta `props.icon` como string arbitrario.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-stat.test.tsx`
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-stat.test.ts`
- **Restricciones**:
  - Reusar harnesses ya presentes en ambos ficheros.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/stat.md`: añadir `props.icon` en la tabla de props y su comportamiento por variante.

### Criterios de finalización

- Tipos, zod y render reflejan el nuevo `props.icon`.
- Los tests ampliados están en verde.
- `pnpm test` global sigue en verde.

### Cierre de implementación

- `stat` soporta `props.icon` con degradación silenciosa y coherencia visual en ambas variantes.

---

## T7 — Input: prop opcional `props.icon` con icono visualmente dentro del campo

- **ID**: T7
- **Estado**: completed
- **Objetivo**: Añadir `props.icon` opcional al nodo `input`. Cuando está presente y resuelve, el icono aparece visualmente dentro del campo, a la izquierda del área de texto, sin desplazar ni ocultar el placeholder ni el texto escrito. El icono es decorativo, no recibe foco y no afecta a la validación.
- **Fuera de alcance**:
  - Iconos a la derecha o dentro del área de error.
  - Iconos en `textarea`, `select`, `radioGroup`, `checkboxGroup`.
  - Tamaño/color de icono configurable.
  - Cambios en la maquinaria de validación o en el `aria-describedby`.
- **Dependencias**: T1.

### Impacto esperado en archivos

- Código a modificar:
  - `src/config/runtime-config-types.ts` (`InputLayoutNode['props']` recibe `icon?: string`).
  - `src/config/runtime-config-zod.ts` (`inputNodeSchema.props` recibe `icon: z.string().optional()`).
  - `src/runtime/nodes/input-layout-node.tsx`:
    - Cuando hay icono resuelto, el `<input>` se envuelve en un contenedor `relative`; el `<IconNode>` se coloca con `absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none` (o utilidades Tailwind equivalentes) y el `<input>` lleva una clase de `padding-left` compensatorio (`pl-10` o equivalente).
    - Cuando no hay icono o no resuelve, el render conserva exactamente el layout actual (sin contenedor extra, sin padding compensatorio).
  - `src/runtime/runtime-node-styling.ts` puede recibir un helper auxiliar si el implementador detecta repetición; no es obligatorio.
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-forms.test.tsx`.
  - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (validación previa).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/input.md`.

### Contrato funcional

- `props.icon` opcional, string.
- Con icono presente y resuelto:
  - El `<input>` lleva una clase de padding-left mayor que la base.
  - El icono se sitúa dentro del campo visualmente (overlay absoluto) con `pointer-events-none` para no robar foco ni clicks.
  - El icono lleva una clase de color neutra (`text-gray-500` o equivalente Tailwind) que no compite con el color del foco.
- Con icono ausente o no resuelto:
  - El `<input>` mantiene su `getFieldControlClassName` actual sin padding extra.
- La presencia del icono no altera el `aria-describedby`, el manejo de error ni el `id` estable `${formId}-${fieldId}`.

### Tests

- **Ficheros de test**:
  - `src/tests/layout-renderer/layout-renderer-forms.test.tsx` (ampliación).
  - `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación).
- **Comportamiento cubierto**:
  - `input` con `props.icon: "Mail"` dentro de un `form` renderiza un `<svg aria-hidden="true">` dentro del wrapper del campo, hermano del `<input>`, no como descendiente del propio `<input>`.
  - `input` con `props.icon: "Mail"` aplica una clase de padding-left mayor en el `<input>` (verificable con `toHaveClass('pl-10')` o equivalente acordado en la implementación; el test no debe acoplarse a un valor concreto de Tailwind si el implementador elige otro: comprobar que la clase del `<input>` contiene el prefijo `pl-`).
  - El `<svg>` no participa en el orden de tabulación (no recibe foco): verificable porque no es focusable por defecto (`aria-hidden="true"` y elemento `<svg>` sin `tabindex`).
  - `input` con `props.icon: "Mail"` y validación `required` activa: tras un submit con valor vacío el `aria-describedby` apunta correctamente al span de error y el icono sigue presente.
  - `input` con `props.icon: "Mail"` y placeholder declarado: el placeholder sigue siendo visible en el `<input>` (el atributo se mantiene).
  - `input` con `props.icon: "NonExistentIconXyz"` se renderiza sin `<svg>` y sin padding extra (mismo shape que sin icono).
  - Validación previa acepta `props.icon` como string arbitrario.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms.test.tsx`
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts`
- **Restricciones**:
  - Reusar harnesses y fixtures ya presentes en ambos ficheros (helpers de form en `layout-renderer`).
  - No introducir helpers compartidos nuevos solo para esta tarea; si surge duplicación con otros nodos de formulario, dejarla para futuras refactorizaciones explícitas.

### Documentación afectada

- `ai-workflow/docs/app-features/nodes/input.md`: añadir `props.icon` en la tabla de props, su comportamiento visual y la nota de accesibilidad (decorativo, `aria-hidden`, no afecta validación ni focus).

### Criterios de finalización

- Tipos, zod y render reflejan el nuevo `props.icon`.
- Los tests ampliados están en verde.
- `pnpm test` global sigue en verde.

### Cierre de implementación

- `input` soporta `props.icon` con degradación silenciosa, padding compensatorio cuando aplica, y accesibilidad/validación intactas.

---

## Orden de ejecución y siguiente tarea

1. T1 (foundation).
2. T2 (alert).
3. T3 (button).
4. T4 (heading + paragraph).
5. T5 (link).
6. T6 (stat).
7. T7 (input).

La siguiente tarea que debe escogerse es **T1**. T2–T7 son independientes entre sí en cuanto a código pero todas dependen de T1; pueden ejecutarse en cualquier orden tras T1, aunque se recomienda seguir el orden listado para mantener cambios pequeños y revisables.
