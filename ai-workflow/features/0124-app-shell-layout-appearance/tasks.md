# Tasks — 0124 — shell de ancho completo, alto adaptable, scroll configurable y espaciado propio

Contrato de ejecución para la feature. Alcance: retirar el envoltorio tipo "card" del runtime (borde, sombra,
superficie, padding perimetral), el límite de ancho centrado (`max-w-shell`) del propio runtime y de la fila
interna del header, el alto mínimo forzado (`min-h-screen` en el runtime y `min-height: 100vh` en `body`/`#root`)
y el fondo general decorativo aplicado hoy a nivel de `body`/`:root`; introducir un padding propio del área de
contenido (equivalente al que hoy aporta la card, aplicado solo alrededor del contenido de página, no del chrome);
y añadir el nuevo campo opcional `shell.scrollBehavior` (`"page"` por defecto = comportamiento actual con header
sticky; `"fixed"` = chrome ancla fijo y el área de contenido hace scroll interno). El bloque de error de
configuración también refleja los mismos cambios visuales.

Retrocompatibilidad: cualquier configuración existente cambia deliberadamente su aspecto visual por defecto (sin
card, sin límite de ancho, sin alto forzado, sin fondo general, con el nuevo padding del área de contenido) sin
necesidad de declarar nada nuevo; únicamente `scrollBehavior` es aditivo (default `"page"` = comportamiento
actual, con header sticky idéntico a hoy).

Basado en `spec.md` (`requires_design: false`). Se divide en **cuatro tareas secuenciales** que respetan las
fronteras de `src/config/` (contrato + validación), `src/app/` + `src/runtime/runtime-node-styling*` (composición
y utilidades visuales) y `src/runtime/runtime-shell/` (composición del chrome cuando aplica):

1. **T1** — Contrato y validación de `shell.scrollBehavior` (tipos + Zod + mensaje de error). Inerte hasta T3.
2. **T2** — Reset visual global del runtime: retirada de card / límite de ancho / alto forzado / fondo general
   (globales + helpers `runtime-node-styling-app-shell.ts` + fila interna de header + `index.html`) + padding
   propio del área de contenido (con y sin sidebar) + bloque de error alineado. Comportamiento de scroll:
   `"page"` implícito (header sticky idéntico a hoy).
3. **T3** — Implementación de `shell.scrollBehavior: "fixed"`: composición condicional en `app-shell.tsx` que
   ancla `shell.header` y `shell.sidebar` (los declarados) al alto disponible del contenedor de montaje y hace
   que el área de contenido haga scroll interno. Depende de T1 (campo disponible) y T2 (composición base ya
   reseteada).
4. **T4** — Sidebar pegajoso con scroll interno propio en modo `"page"` (FR11 y sus criterios de aceptación):
   cierra el hueco detectado tras una relectura de `spec.md` frente al estado ya implementado de T1–T3, que solo
   dejaba el sidebar pegajoso/con scroll interno en modo `"fixed"`. Depende de T2 (sidebar y frame ya reseteados)
   y T3 (contrato de `scrollBehavior` y composición condicional ya resueltos); no reabre nada de T1–T3.

T1 y T2 no tienen dependencia real entre sí (contrato vs. capa visual). Se listan en este orden por convención
del proyecto (contrato-primero) y porque T3 depende de ambos. T3 no puede empezar sin T1 y T2 cerradas. T4 depende
de T2 y T3 cerradas (reutiliza su composición y su prop `scrollBehavior`).

## Estado de ejecución

`0124-T1`, `0124-T2` y `0124-T3` están **completadas** (ver `status.yaml`, `completed_task_ids`). Sus bloques se
conservan íntegros abajo como registro del contrato ya ejecutado; no deben reabrirse ni reinterpretarse.

## Siguiente tarea a escoger

`0124-T4` — única tarea pendiente. Cierra la feature end-to-end.

---

## Task 0124-T1 — Contrato y validación de `shell.scrollBehavior`

- **ID**: 0124-T1
- **Estado**: pending
- **Objetivo**: Añadir `scrollBehavior?: 'page' | 'fixed'` como hermano opcional de `header`/`sidebar` dentro de
  `ShellConfig`, con validación estructural en Zod y mensaje de error alineado con la política ya vigente de
  `shell` (`"Shell configuration is invalid at 'shell.scrollBehavior'."`). Ausencia del campo o `"page"`
  explícito equivalen al comportamiento actual sin cambios; cualquier otro valor se rechaza en validación previa
  al render con ruta canónica exacta.
  - Cambios concretos:
    - `src/config/runtime-config-types.ts`:
      - Añadir un alias exportado:
        ```ts
        export type ShellScrollBehavior = 'page' | 'fixed'
        ```
      - Extender `ShellConfig` con `scrollBehavior?: ShellScrollBehavior` (hermano de `header?`/`sidebar?`).
    - `src/config/runtime-config-zod.ts`:
      - Ampliar `shellSchema` con `scrollBehavior: z.enum(['page', 'fixed']).optional()` manteniendo `.strict()`.
      - No modificar `shellHeaderSchema`, `shellSidebarSchema`, `sidebarItemSchema` ni ningún otro schema del
        bloque.
    - `src/config/validate-shell.ts`:
      - No hace falta añadir cross-refs: el catálogo cerrado `['page', 'fixed']` lo cubre Zod en el parseo
        estructural, y el mensaje de shell (`"Shell configuration is invalid at 'shell{ruta}'."`) ya se compone
        vía el adaptador diagnóstico existente. Si el mensaje formateado para este campo no queda idéntico al
        patrón vigente de shell (`shell.header.menu[i]...`, etc.), ajustar la adaptación mínima en
        `validate-shell.ts` para que la ruta canónica sea exactamente `shell.scrollBehavior` (sin comillas
        internas ni sufijos como `.value`); no cambiar el prefijo ni el resto de mensajes de shell.
- **Fuera de alcance**:
  - Cualquier consumo del nuevo campo desde `AppShell` / `RuntimeStateProvider` / helpers de estilo: `0124-T3`.
  - Cualquier cambio de aspecto visual del runtime (card, width, height, background, padding): `0124-T2`.
  - Cualquier UI en el editor visual para editar `scrollBehavior` en caliente: fuera de alcance de esta feature
    (ver spec, "Fuera de alcance").
- **Dependencias**: ninguna. Primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` (alias `ShellScrollBehavior`, ampliación de `ShellConfig`)
    - `src/config/runtime-config-zod.ts` (ampliación de `shellSchema`)
    - `src/config/validate-shell.ts` (solo si el mensaje canónico requiere una adaptación mínima; en caso
      contrario, sin cambios)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-shell.test.ts` (ampliación)
  - Documentación: revisar tras el cierre de implementación (ver "Documentación afectada").
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-shell.test.ts` (ampliación — nuevo `describe` de
      `scrollBehavior`, sin tocar los tests ya existentes de `header`).
  - **Comportamiento cubierto**:
    - Aceptación: `shell` sin `scrollBehavior` (con o sin `header`, con o sin `sidebar`) valida sin error.
    - Aceptación: `shell.scrollBehavior: "page"` valida sin error.
    - Aceptación: `shell.scrollBehavior: "fixed"` valida sin error.
    - Aceptación: `shell.scrollBehavior: "fixed"` coexiste sin error con `shell.header` declarado, con
      `shell.sidebar.items` no vacío y con ambos a la vez.
    - Rechazo: `shell.scrollBehavior: "unknown"` (string fuera del catálogo) se rechaza con `invalid-layout`
      shell-formato y ruta canónica exacta `shell.scrollBehavior`.
    - Rechazo: `shell.scrollBehavior: 42` (no string) se rechaza igual.
    - Rechazo: `shell.scrollBehavior: null` se rechaza igual (a diferencia de omitirlo, que es válido).
    - Rechazo: cualquier clave desconocida hermana de `header`/`sidebar`/`scrollBehavior` dentro de `shell`
      sigue rechazándose por `.strict()` (regresión — comprobar que el añadido no relajó el schema).
    - Regresión: todos los tests ya vigentes de `runtime-config-validation-shell.test.ts` y de
      `runtime-config-validation-shell-sidebar.test.ts` siguen pasando sin cambios de aserciones.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts` (sanity)
    - `pnpm test` (al cierre, para confirmar suite global y gate de cobertura)
  - **Restricciones**:
    - No introducir un fichero de test nuevo; ampliar el existente.
    - No modificar `shellHeaderSchema`/`shellSidebarSchema` ni sus mensajes.
    - Si al ejecutar el test de rechazo el mensaje real difiere del esperado por detalles de formato
      (comillas internas, sufijo `.value` del `z.enum`), preferir ajustar la adaptación en
      `validate-shell.ts` para que la ruta canónica sea `shell.scrollBehavior`, no relajar el test.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/index.md`
  - `ai-workflow/docs/app-features/config/structure.md` (nuevo campo dentro del bloque `shell`)
  - `ai-workflow/docs/app-features/config/validation.md` (regla del nuevo campo)
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - `ShellConfig` incluye `scrollBehavior?: 'page' | 'fixed'` exportado como alias tipado.
  - `shellSchema` acepta ausencia, `"page"` y `"fixed"`, y rechaza cualquier otro valor con ruta canónica
    exacta `shell.scrollBehavior`.
  - Todos los tests nuevos en verde; `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - El campo `shell.scrollBehavior` existe en el contrato y se valida correctamente; ningún consumidor lo lee
    todavía (inerte hasta `0124-T3`).

---

## Task 0124-T2 — Reset visual global del runtime y espaciado propio del área de contenido

- **ID**: 0124-T2
- **Estado**: pending
- **Objetivo**: Materializar el reset visual global descrito en la spec (FR1–6, FR11–12) manteniendo el
  comportamiento de scroll actual (`"page"`), sin depender todavía de `shell.scrollBehavior`. Al terminar esta
  tarea, cualquier configuración existente (con o sin `shell`, con o sin `sidebar`) se renderiza a ancho y
  alto completos del contenedor de montaje, sin card, sin fondo general y con un padding uniforme propio del
  área de contenido. El header, si existe, sigue siendo sticky (comportamiento `"page"` idéntico a hoy). El
  bloque de error de configuración adopta el mismo aspecto.
  - Cambios concretos, agrupados por archivo:
    - `src/app/index.css`:
      - Eliminar la declaración `background: linear-gradient(...)` de `body` (FR6). Conservar el resto de
        propiedades de `body` (`margin`, `min-width`, `font-family`) sin cambios.
      - Eliminar la declaración `background: var(--color-app-background)` de `:root` (FR6). Conservar el resto
        del bloque `:root` (`color`, `font-synthesis`, `text-rendering`, antialias).
      - Eliminar por completo la regla `body, #root { min-height: 100vh; }` (FR4/FR5). El runtime deja de
        forzar altura mínima desde CSS global.
      - **No** tocar el token `--color-app-background` en `@theme` — sigue existiendo en la paleta (spec
        Alcance: el token permanece para otros usos del catálogo).
      - **No** tocar `--radius-shell`, `--shadow-shell` ni `--container-shell` en `@theme` — aunque sus
        consumidores en `runtime-node-styling-app-shell.ts` desaparecen en esta tarea, `shadow-shell` sigue
        usado por otros nodos (`runtime-node-styling-modal.ts`) y los tokens en sí no son parte del reset.
    - `index.html`:
      - Añadir `style="height: 100vh"` (o el equivalente `class` + regla local, decidir en implementación
        priorizando lo más sencillo; el proyecto no tiene `#layout-renderer` en el CSS global) al `<div
        id="layout-renderer">` para que, en modo standalone (uso directo de `index.html`), el runtime siga
        ocupando el 100% del alto de la ventana ahora que `body, #root { min-height: 100vh }` desaparece del
        CSS. La spec fija explícitamente que "quien integra la app decide ese alto (dándole 100vh en
        index.html para standalone)": esa responsabilidad se cumple aquí.
    - `src/runtime/runtime-node-styling-app-shell.ts`:
      - `getAppShellClassName()`: sustituir `'min-h-screen bg-app-background text-app-text'` por
        `'flex h-full w-full flex-col text-app-text'`. El `<main>` raíz del runtime deja de imponer alto
        mínimo de viewport y fondo propio (FR1, FR4, FR6), pasa a ocupar el 100% del alto de su contenedor
        de montaje (`h-full`) y monta una columna flex vertical que servirá tanto al comportamiento actual
        `"page"` como al futuro `"fixed"` (`0124-T3`).
      - `getAppShellContentClassName()`: sustituir
        `'mx-auto flex w-full max-w-shell px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12'` por
        `'flex w-full flex-1 min-w-0 min-h-0'`. Elimina el límite de ancho (`max-w-shell` + `mx-auto`) y el
        padding perimetral tipo card (FR2). `flex-1 min-h-0` deja al content ocupar el alto restante del
        `<main>` sin forzar overflow todavía (T3 activará overflow interno solo cuando `scrollBehavior:
        "fixed"`; en `"page"`, `min-h-0`/`flex-1` no cambian el comportamiento observable respecto a
        `"auto"`).
      - `getAppShellFrameClassName()`: sustituir
        `'w-full rounded-shell border border-app-border-strong bg-app-surface p-4 shadow-shell sm:p-6 lg:p-8'`
        por `'flex w-full flex-1 min-w-0 min-h-0 flex-col'`. Elimina el borde, sombra, fondo, radio y
        padding tipo card (FR1). El frame pasa a ser una columna flex simple que alberga
        `AppShellHeader` (si aplica), la fila de body (si hay `sidebar`) o el área de contenido suelta.
      - Añadir un nuevo helper exportado en el mismo módulo:
        ```ts
        // Padding propio del área de contenido, equivalente al que hoy aporta la card que se elimina en
        // 0124. `shell.header` y `shell.sidebar` no llevan este padding: siguen anclados a los bordes del
        // contenedor de montaje ("edge to edge") y quedan visualmente separados del contenido por su propia
        // superficie/borde ya existente. Aplicado tanto por el envoltorio de `RuntimePage` cuando hay
        // sidebar como por el `RuntimePage` suelto cuando no lo hay, y por el bloque de error de
        // configuración.
        export function getAppShellContentPaddingClassName() {
          return 'p-4 sm:p-6 lg:p-8'
        }
        ```
      - `getRuntimePageClassName()`, `getAppShellErrorEyebrowClassName()`, `getAppShellErrorTitleClassName()`
        y `getAppShellErrorBodyClassName()`: sin cambios.
    - `src/runtime/runtime-node-styling-app-shell-header.ts`:
      - `getAppShellHeaderInnerClassName()`: sustituir
        `'mx-auto flex w-full max-w-shell flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8'`
        por `'flex w-full flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8'` (FR3:
        eliminar el límite de ancho centrado de la fila interna, sin tocar padding, gap, flex-wrap ni el
        contrato del header).
      - `getAppShellHeaderClassName()`: sin cambios en esta tarea. `sticky top-0 z-10 …` sigue vigente para
        el comportamiento `"page"` idéntico a hoy. El paso a chrome fijo por estructura se decide en
        `0124-T3`.
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts`:
      - Sin cambios en esta tarea. `getAppShellBodyClassName()` (`'flex w-full'`) y
        `getAppShellBodyContentClassName()` (`'min-w-0 flex-1'`) siguen sirviendo la composición actual con
        sidebar; el padding del área de contenido lo aporta ahora el envoltorio de `RuntimePage` desde
        `app-shell.tsx`, no el propio contenedor de sidebar (el sidebar debe seguir "edge to edge").
    - `src/app/app-shell.tsx`:
      - En la rama principal (config válida):
        - Cambiar `<section className={\`${getAppShellContentClassName()} items-center\`} …>` por
          `<section className={getAppShellContentClassName()} …>`. El helper ya expresa el layout completo
          del content wrapper sin necesidad de sufijar `items-center` (ya no hay una card centrada dentro
          de una banda con margen; el frame ocupa todo el ancho).
        - En la rama sin sidebar, envolver `<RuntimePage />` en un `<div>` con
          `getAppShellContentPaddingClassName()` para que el contenido de página quede padded (FR11).
          Añadir `data-testid="runtime-page-content"` (o similar estable) para poder probar el padding.
        - En la rama con sidebar, aplicar `getAppShellContentPaddingClassName()` al envoltorio ya existente
          alrededor de `<RuntimePage />` — el `<div>` que hoy usa `getAppShellBodyContentClassName()`
          concatena la nueva clase (`\`${getAppShellBodyContentClassName()} ${getAppShellContentPaddingClassName()}\``).
      - En `renderErrorBlock`:
        - Reemplazar `\`${getAppShellContentClassName()} flex-col justify-center\`` por
          `\`${getAppShellContentClassName()} flex-col justify-center\`` (queda como está: `justify-center`
          y `flex-col` siguen apilando el mensaje vertical y centrado, ahora sobre un content sin banda
          centrada por `mx-auto`/`max-w-shell`).
        - Reemplazar `\`${getAppShellFrameClassName()} grid gap-6\`` por
          `\`${getAppShellFrameClassName()} ${getAppShellContentPaddingClassName()} grid gap-6\``. El frame
          ya no aporta padding propio; el bloque de error usa el mismo padding del área de contenido para
          que el mensaje no quede pegado al borde (FR12).
        - En la rama `development-only && !isDevelopment` (sin mensaje), sustituir el `<main
          className={getAppShellClassName()} />` vacío por el mismo `<main>` con el nuevo helper (queda con
          el reset aplicado igual que la rama con mensaje; no requiere padding porque no hay contenido).
    - No introducir ningún cambio a `RuntimeStateProvider`, `RuntimePage`, `AppShellHeader`,
      `AppShellSidebar` ni al catálogo de nodos: el reset es puramente CSS/estructura de wrappers.
- **Fuera de alcance**:
  - Cualquier cambio de comportamiento de scroll o de composición condicional por `shell.scrollBehavior`:
    `0124-T3`.
  - Cualquier ajuste al sidebar más allá del padding del área de contenido a su derecha: `0124-T3` decide si
    el sidebar necesita `overflow-y-auto` interno en modo `"fixed"`.
  - Cualquier cambio de tokens (`--color-app-background`, `--radius-shell`, `--shadow-shell`,
    `--container-shell`): siguen usados por otros nodos o simplemente permanecen inertes.
  - Cualquier UI del editor visual: no aplica.
- **Dependencias**: ninguna respecto a T1 (contrato independiente). Primera tarea "materializable" del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/app/index.css`
    - `index.html`
    - `src/runtime/runtime-node-styling-app-shell.ts`
    - `src/runtime/runtime-node-styling-app-shell-header.ts` (una sola línea)
    - `src/app/app-shell.tsx`
  - Tests:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación de aserciones existentes + assert del
      nuevo helper)
    - `src/tests/app/app-shell.test.tsx` (ampliación + actualización del test "renders the runtime inside a
      centered light shell frame")
    - `src/tests/app/app-shell-header.test.tsx` (ampliación mínima: la fila interna deja de tener
      `max-w-shell`/`mx-auto`)
  - Documentación:
    - `ai-workflow/docs/app-features/runtime/design-tokens.md` (los tokens siguen; el uso del "shell como
      card" se retira — reflejarlo)
    - `ai-workflow/docs/app-features/runtime/overview.md` (aspecto general del runtime: ancho/alto/fondo)
    - `ai-workflow/docs/app-features/shell/header.md` (fila interna a ancho completo)
    - `ai-workflow/docs/current-state.md` (fila "Shell de aplicación")
    - `ai-workflow/docs/test-index.md` (si se añaden nuevos casos observables por nombre)
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/app/app-shell.test.tsx` (ampliación — sustituye el bloque de aserciones sobre card;
      añade aserciones sobre padding del contenido y sobre el error block)
    - `src/tests/app/app-shell-header.test.tsx` (ampliación — assert de que la fila interna del header ya
      no lleva `max-w-shell` ni `mx-auto`)
  - **Comportamiento cubierto**:
    - `getAppShellClassName()` devuelve exactamente `'flex h-full w-full flex-col text-app-text'` (sin
      `min-h-screen`, sin `bg-app-background`).
    - `getAppShellContentClassName()` devuelve exactamente `'flex w-full flex-1 min-w-0 min-h-0'` (sin
      `mx-auto`, sin `max-w-shell`, sin padding perimetral).
    - `getAppShellFrameClassName()` devuelve exactamente
      `'flex w-full flex-1 min-w-0 min-h-0 flex-col'` (sin `rounded-shell`, sin `border`, sin
      `bg-app-surface`, sin `shadow-shell`, sin padding perimetral).
    - `getAppShellContentPaddingClassName()` devuelve exactamente `'p-4 sm:p-6 lg:p-8'`.
    - `getAppShellHeaderInnerClassName()` devuelve un string que **no** contiene `mx-auto` ni `max-w-shell`,
      y **sí** contiene `flex w-full`, `flex-wrap`, `items-center`, `justify-between`, `gap-4`, `px-4 py-3`,
      `sm:px-6`, `lg:px-8`.
    - Render de una config sin `shell`: `runtime-app` **no** lleva `min-h-screen` ni `bg-app-background`;
      `runtime-shell-content` **no** lleva `max-w-shell`, `mx-auto`, `px-*` ni `py-*` perimetrales;
      `runtime-shell-frame` **no** lleva `rounded-shell`, `border`, `bg-app-surface`, `shadow-shell` ni
      padding; el envoltorio del contenido de página (`runtime-page-content` o equivalente estable)
      **sí** lleva `p-4 sm:p-6 lg:p-8`.
    - Render de una config con `shell.sidebar.items` no vacío: el envoltorio del contenido de página
      (`getAppShellBodyContentClassName()` + `getAppShellContentPaddingClassName()`) lleva el padding; el
      propio `AppShellSidebar` **no** lleva ese padding (sigue "edge to edge"); el `AppShellHeader` (si
      declarado) tampoco lo lleva.
    - Render de una config con `shell.header` declarado: la fila interna del header no lleva `mx-auto` ni
      `max-w-shell`; el resto del contrato del header (`sticky`, `top-0`, `z-10`, `bg-app-surface`,
      `shadow-shell`, `border-b`) permanece.
    - Bloque de error de configuración: `runtime-app` con el mismo reset; `runtime-shell-content` sin
      `max-w-shell` ni padding perimetral; `runtime-shell-frame` sin card pero con
      `getAppShellContentPaddingClassName()` aplicado (por eso el texto del error no queda pegado al borde).
    - Sanity: los tests existentes de `AppShellHeader`, `AppShellSidebar` (`0122-T4`, `0123-T4`, `0123-T5`,
      `0123-T6`) siguen pasando sin cambios (excepto la sola línea de fila interna del header que se
      actualiza aquí).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`
    - `pnpm test --run src/tests/app/app-shell.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-header.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-sidebar.test.tsx` (sanity de no regresión)
    - `pnpm test --run src/tests/app/app-shell-sidebar-rail.test.tsx` (sanity de no regresión)
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - No introducir estilos inline nuevos en componentes React del runtime; toda la presentación debe
      resolverse con utilidades de Tailwind y helpers centralizados en `runtime-node-styling-*.ts`, siguiendo
      la convención global del proyecto.
    - No introducir tokens visuales nuevos; el reset se apoya en tokens ya existentes.
    - No leer `shell.scrollBehavior` desde `AppShell` en esta tarea (aunque el campo exista ya vía T1); el
      wiring completo del modo `"fixed"` es responsabilidad exclusiva de T3.
    - Al actualizar los tests del helper, comprobar los strings **exactos** (usar `toBe`), no `toContain`,
      para blindar el reset frente a regresiones silenciosas.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/runtime/design-tokens.md`
  - `ai-workflow/docs/app-features/runtime/overview.md`
  - `ai-workflow/docs/app-features/shell/header.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - Los helpers de `runtime-node-styling-app-shell.ts` y `runtime-node-styling-app-shell-header.ts` devuelven
    los strings exactos declarados arriba.
  - Toda config existente (con o sin `shell`, con o sin `sidebar`) se renderiza a ancho y alto completos del
    contenedor de montaje, sin card, sin fondo general y con el nuevo padding del área de contenido, sin
    regresión en `AppShellHeader`/`AppShellSidebar`.
  - El bloque de error refleja el mismo reset y usa el nuevo padding.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - Reset visual global cerrado y observable. El comportamiento de scroll sigue siendo el actual (`"page"`
    implícito; header sticky). El modo `"fixed"` queda pendiente de T3.

---

## Task 0124-T3 — `shell.scrollBehavior: "fixed"`: chrome anclado y scroll interno del área de contenido

- **ID**: 0124-T3
- **Estado**: pending
- **Objetivo**: Consumir `shell.scrollBehavior` desde `AppShell` para conmutar entre la composición actual
  (`"page"`, idéntica a la del cierre de T2) y una composición con `shell.header` y `shell.sidebar` (los
  declarados) anclados al alto disponible del contenedor de montaje, con el área de contenido haciendo scroll
  interno cuando su contenido excede ese alto (FR7–FR10, y todos los criterios de aceptación de spec sobre
  `"fixed"`).
  - Estrategia de layout (no fijada por spec — Riesgos; se fija aquí para converger entre agentes):
    - `AppShell` lee `scrollBehavior = runtimeConfig.config.shell?.scrollBehavior ?? 'page'`.
    - Cuando `scrollBehavior === 'page'`: composición idéntica a la del cierre de T2, sin cambios. El header,
      si existe, sigue siendo sticky (`getAppShellHeaderClassName()` sin cambios). El área de contenido no
      lleva `overflow-y-auto`. **Retrocompatibilidad total** con el estado post-T2.
    - Cuando `scrollBehavior === 'fixed'`:
      - El `<main>` raíz sigue usando `getAppShellClassName()` (`flex h-full w-full flex-col text-app-text`)
        pero se le concatena `'overflow-hidden'` — esto impide que el propio `<main>` haga scroll y confina
        el desbordamiento al hijo declarado.
      - `<section>` (`runtime-shell-content`) y frame (`runtime-shell-frame`) se mantienen con sus helpers
        actuales (`flex w-full flex-1 min-w-0 min-h-0` y `flex w-full flex-1 min-w-0 min-h-0 flex-col`); las
        clases `flex-1 min-h-0` de T2 ya sirven aquí sin cambios.
      - Sin embargo, esas clases NO bastan por sí solas para propagar el confinamiento de altura hasta el
        envoltorio del contenido: los hijos directos del frame (fila de body en la rama con sidebar, o el
        propio envoltorio de `RuntimePage` en la rama sin sidebar) tienen `min-height: auto` por defecto y
        no se dejan contraer. Sin acotar esa cadena, el envoltorio de contenido crece con su contenido, el
        `'overflow-y-auto'` no se activa (el clipping lo hace el `<main>` con `'overflow-hidden'`, pero el
        scrollbar del envoltorio nunca aparece) y el sidebar tampoco queda acotado en altura, con lo que su
        propio `'overflow-y-auto'` tampoco entra en juego. Para cerrar esto de forma explícita, **solo en
        modo `"fixed"`**:
        - La fila de body (`getAppShellBodyClassName()`, hoy `'flex w-full'`, envoltorio de
          sidebar + contenido) recibe adicionalmente `'flex-1 min-h-0'`.
        - El envoltorio del contenido de página, en la rama con sidebar (hoy
          `getAppShellBodyContentClassName() + getAppShellContentPaddingClassName()`), recibe
          adicionalmente `'flex-1 min-h-0 overflow-y-auto'`.
        - El envoltorio del contenido de página, en la rama sin sidebar (hoy solo
          `getAppShellContentPaddingClassName()`), recibe adicionalmente `'flex-1 min-h-0 overflow-y-auto'`
          (el envoltorio pasa a ser un hijo directo del frame que ocupa el alto restante y hace scroll
          interno).
        - `AppShellSidebar`, además del `'overflow-y-auto'` de su propio contenedor, hereda `h-full`
          implícito por su padre (fila body con `flex-1 min-h-0` que a su vez ancla el sidebar a la altura
          disponible por el `stretch` por defecto del flex row).
        Restringir estas clases al modo `"fixed"` (y no aplicarlas globalmente en T2 como retrocompatibles)
        evita cualquier riesgo de regresión visual observable en modo `"page"`, donde hoy la cadena no está
        acotada y el body crece con su contenido.
      - `AppShellHeader`, cuando existe, se renderiza sin `sticky top-0 z-10` (deja de necesitarlo — el
        chrome ya está anclado por la propia estructura fija del frame): añadir un helper alternativo
        `getAppShellHeaderClassName({ pinned: boolean })` con lookup map explícito de dos ramas y actualizar
        `AppShellHeader` para pasar `pinned = scrollBehavior !== 'fixed'` (por defecto `true`,
        retrocompatible). En modo `"fixed"`, el helper devuelve el mismo string que hoy pero sin
        `'sticky'`, `'top-0'` y `'z-10'`. Ver "Restricciones".
      - `AppShellSidebar`, cuando existe, adopta scroll interno propio con `overflow-y-auto` alrededor de su
        propia lista de items (spec Riesgos: "criterio razonable", elegimos scroll interno propio del
        sidebar independiente del área de contenido). Añadir un helper
        `getAppShellSidebarClassName({ collapsed, scrollable })` (ampliando la firma existente sin
        romperla: `scrollable` por defecto `false`) que suma `'overflow-y-auto'` cuando `scrollable`. La
        elevación del prop `scrollBehavior` hasta `AppShellSidebar` puede hacerse añadiendo `scrollBehavior`
        como prop opcional a `AppShellSidebar` (`"page"` por defecto) — retrocompatible.
      - El envoltorio del área de contenido (`getAppShellBodyContentClassName()` +
        `getAppShellContentPaddingClassName()`) suma `'overflow-y-auto'` solo cuando `scrollBehavior ===
        'fixed'`. Sin sidebar, el envoltorio de `RuntimePage` suma también `'overflow-y-auto'` en modo
        `"fixed"`. Se resuelve pasando la clase adicional desde `AppShell` (composición condicional), sin
        añadir un helper `runtime-node-styling-*` dedicado (una clase suelta es suficiente y evita ampliar
        la superficie del módulo por una sola condición binaria).
    - Ninguna otra rama del árbol del runtime necesita cambios: `RuntimeStateProvider`, `RuntimePage`,
      catálogo de nodos, `LayoutRenderer`, etc. permanecen intactos.
  - Cambios concretos, agrupados por archivo:
    - `src/runtime/runtime-node-styling-app-shell-header.ts`:
      - Sustituir `getAppShellHeaderClassName()` sin parámetros por
        `getAppShellHeaderClassName({ pinned }: { pinned: boolean })` con lookup map explícito de dos ramas
        (patrón "Resolución de variantes visuales" de `conventions.md`, precedente:
        `divider-layout-node.tsx`), no dos strings distintos concatenados condicionalmente en el JSX del
        componente. El default por convención de llamada es `pinned: true` (retrocompatible: el llamador
        actual pasa `{ pinned: true }`).
      - `AppShellHeader` (`src/runtime/runtime-shell/app-shell-header.tsx`): añadir prop opcional
        `pinned?: boolean` (default `true`) y propagarlo a `getAppShellHeaderClassName({ pinned })`.
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts`:
      - Ampliar `getAppShellSidebarClassName({ collapsed })` a `getAppShellSidebarClassName({ collapsed,
        scrollable })` con `scrollable?: boolean` (default `false`). Cuando `scrollable`, suma
        `'overflow-y-auto'` al string devuelto. No tocar el resto de helpers del módulo.
      - `AppShellSidebar` (`src/runtime/runtime-shell/app-shell-sidebar.tsx`): añadir prop opcional
        `scrollBehavior?: ShellScrollBehavior` (default `'page'`, retrocompatible) y propagarla a
        `getAppShellSidebarClassName({ collapsed, scrollable: scrollBehavior === 'fixed' })`.
    - `src/app/app-shell.tsx`:
      - Añadir al inicio de la rama principal:
        ```ts
        const scrollBehavior: ShellScrollBehavior = runtimeConfig.config.shell?.scrollBehavior ?? 'page'
        const isFixed = scrollBehavior === 'fixed'
        ```
      - Concatenar `'overflow-hidden'` al `<main>` cuando `isFixed`. Precomputar el string en una variable
        local para mantener el JSX limpio.
      - Pasar `pinned={!isFixed}` a `<AppShellHeader>`.
      - Pasar `scrollBehavior={scrollBehavior}` a `<AppShellSidebar>` (rama con sidebar).
      - En la rama con sidebar, cuando `isFixed`:
        - Sumar `'flex-1 min-h-0'` al `<div className={getAppShellBodyClassName()}>` (fila body).
        - Sumar `'flex-1 min-h-0 overflow-y-auto'` al envoltorio de `RuntimePage` (mismo string ya
          compuesto por `getAppShellBodyContentClassName()` + `getAppShellContentPaddingClassName()`,
          más `'flex-1 min-h-0 overflow-y-auto'`).
      - En la rama sin sidebar, cuando `isFixed`, sumar `'flex-1 min-h-0 overflow-y-auto'` al envoltorio de
        `RuntimePage` (mismo string ya compuesto por `getAppShellContentPaddingClassName()`, más
        `'flex-1 min-h-0 overflow-y-auto'`).
      - Cuando `!isFixed` (modo `"page"`), la composición es byte a byte idéntica al cierre de T2: ni
        `overflow-hidden` en el `<main>`, ni las clases de acotación de altura (`flex-1 min-h-0`), ni
        `overflow-y-auto` en los envoltorios, ni cambios de props en `AppShellHeader`/`AppShellSidebar`
        (aparte de sus valores por defecto retrocompatibles).
    - No introducir un helper `getFixedRuntimeContentScrollClassName()` ni un helper específico para las
      clases de acotación (`'flex-1 min-h-0'` y `'overflow-y-auto'`): son concatenaciones binarias locales
      de dos-tres clases sueltas, dentro del criterio ya establecido por `conventions.md` de resolver casos
      binarios triviales sin abrir superficie extra en el módulo de estilos.
- **Fuera de alcance**:
  - Scroll interno propio del sidebar más allá de `overflow-y-auto` en modo `"fixed"`: la spec no exige más
    (Riesgos), y si aparece necesidad real (indicador de scroll, botón "hacia arriba", etc.) se resuelve en
    una spec de ajuste posterior.
  - Degradación activa o aviso cuando `scrollBehavior: "fixed"` se declara sin altura acotada del contenedor
    de montaje (spec Fuera de alcance).
  - Cualquier UI para conmutar `scrollBehavior` en caliente (spec Fuera de alcance).
- **Dependencias**: `0124-T1` y `0124-T2` cerradas.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-node-styling-app-shell-header.ts` (nueva firma de `getAppShellHeaderClassName`
      con lookup map)
    - `src/runtime/runtime-shell/app-shell-header.tsx` (prop `pinned?`)
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts` (nueva firma de
      `getAppShellSidebarClassName` con `scrollable?`)
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (prop `scrollBehavior?`)
    - `src/app/app-shell.tsx` (lectura de `shell.scrollBehavior`, cableado de `pinned`, `scrollBehavior` y
      `'overflow-y-auto'` condicional)
  - Tests:
    - `src/tests/app/app-shell-scroll-behavior.test.tsx` (nuevo)
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación — nuevos casos para el parámetro
      `pinned` del header y `scrollable` del sidebar)
    - `src/tests/app/app-shell.test.tsx` (ampliación mínima — un caso de regresión: sin
      `shell.scrollBehavior`, el runtime se comporta igual que al cierre de T2, incluidos `pinned: true`
      por defecto y ausencia de `overflow-y-auto` en el content)
  - Documentación:
    - `ai-workflow/docs/app-features/shell/index.md`
    - `ai-workflow/docs/app-features/shell/header.md` (comportamiento sticky supeditado a
      `scrollBehavior: "page"`)
    - `ai-workflow/docs/app-features/shell/sidebar.md` (mención de `overflow-y-auto` interno en modo
      `"fixed"`)
    - `ai-workflow/docs/app-features/runtime/overview.md` (modo `"fixed"` como capacidad nueva)
    - `ai-workflow/docs/current-state.md` (fila "Shell de aplicación")
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/app/app-shell-scroll-behavior.test.tsx` (nuevo) — comportamiento end-to-end en cada uno
      de los cinco escenarios de spec.
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación) — dos nuevos `it` breves para las
      firmas ampliadas.
    - `src/tests/app/app-shell.test.tsx` (ampliación) — un `it` de regresión sanity sin
      `shell.scrollBehavior`.
  - **Comportamiento cubierto**:
    - `getAppShellHeaderClassName({ pinned: true })` devuelve exactamente el string vigente al cierre de
      T2 (`'sticky top-0 z-10 w-full border-b border-app-border-soft bg-app-surface shadow-shell'`);
      `getAppShellHeaderClassName({ pinned: false })` devuelve el mismo string **sin** `'sticky'`,
      `'top-0'` ni `'z-10'`, conservando el resto (`w-full`, `border-b`, `border-app-border-soft`,
      `bg-app-surface`, `shadow-shell`).
    - `getAppShellSidebarClassName({ collapsed: false, scrollable: false })` devuelve exactamente el
      string vigente al cierre de T2; con `scrollable: true`, el string devuelto **contiene**
      `'overflow-y-auto'` además del resto (`w-64`, `shrink-0`, `border-r`, `border-app-border-soft`,
      `bg-app-surface`). Idem `collapsed: true` (con `w-16`).
    - Regresión sin campo: una config sin `shell.scrollBehavior` renderiza `runtime-app` **sin**
      `'overflow-hidden'`, `AppShellHeader` **con** `sticky top-0 z-10`, envoltorio del contenido de
      página **sin** `'overflow-y-auto'` **ni** `'flex-1'` **ni** `'min-h-0'`, la fila body (rama con
      sidebar) **sin** `'flex-1'` **ni** `'min-h-0'`, y `AppShellSidebar` (cuando declarado) **sin**
      `'overflow-y-auto'`. Identidad byte a byte con el cierre de T2 (aparte de las props opcionales
      añadidas, cuyo default preserva la salida).
    - `shell.scrollBehavior: "page"` explícito reproduce exactamente el mismo comportamiento que la
      ausencia del campo (regresión adicional).
    - `shell.scrollBehavior: "fixed"` sin `shell.sidebar` y sin `shell.header`: `runtime-app` lleva
      `'overflow-hidden'`; el envoltorio del contenido de página lleva `'flex-1'`, `'min-h-0'` y
      `'overflow-y-auto'` además de `getAppShellContentPaddingClassName()`; no se renderiza
      `AppShellHeader` ni `AppShellSidebar`.
    - `shell.scrollBehavior: "fixed"` con solo `shell.header`: `AppShellHeader` se renderiza sin las
      clases `sticky top-0 z-10` (assertion negativa sobre las tres clases); el resto del header sigue
      idéntico; el envoltorio del contenido de página lleva `'flex-1 min-h-0 overflow-y-auto'`.
    - `shell.scrollBehavior: "fixed"` con `shell.header` + `shell.sidebar`: header sin `sticky`; la fila
      body lleva `'flex-1'` y `'min-h-0'`; `AppShellSidebar` con `'overflow-y-auto'`; envoltorio del área
      de contenido con `'flex-1'`, `'min-h-0'` y `'overflow-y-auto'`; `runtime-app` con
      `'overflow-hidden'`.
    - `shell.scrollBehavior: "fixed"` con solo `shell.sidebar` (sin `shell.header`): fila body con
      `'flex-1 min-h-0'`; sidebar con `'overflow-y-auto'`; envoltorio del área de contenido con
      `'flex-1 min-h-0 overflow-y-auto'`; sin `AppShellHeader` (no se renderiza).
    - Sanity: los tests existentes de `AppShellHeader`, `AppShellSidebar`, `AppShellSidebarRail`,
      cerrados en `0122-T4`, `0123-T4`/`0123-T5`/`0123-T6`, siguen pasando sin cambios (excepto el
      `describe` del header que se amplía con el nuevo parámetro `pinned`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/app-shell-scroll-behavior.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`
    - `pnpm test --run src/tests/app/app-shell.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-header.test.tsx` (sanity)
    - `pnpm test --run src/tests/app/app-shell-sidebar.test.tsx` (sanity)
    - `pnpm test --run src/tests/app/app-shell-sidebar-rail.test.tsx` (sanity)
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - `AppShell` es el único punto de lectura de `shell.scrollBehavior`; no propagarlo por contexto ni por
      un store; pasarlo por prop hasta `AppShellSidebar` y hasta el envoltorio del contenido.
    - Resolver la variante `pinned` con lookup map `Record<'pinned' | 'unpinned', string>` (o similar
      cerrado por variante) en `runtime-node-styling-app-shell-header.ts`, siguiendo el patrón obligatorio
      de `conventions.md` para variantes visuales; no repetir el JSX del header por rama `if/else`.
    - No introducir un contexto de tipo `ShellLayoutContext` para propagar `scrollBehavior`; una cascada
      simple de props resuelve el caso sin abrir una nueva capa transversal.
    - No añadir `overflow-hidden` al `<html>`/`<body>`; el confinamiento del scroll vive dentro del
      `<main>` raíz del runtime.
    - Verificar clases con assertions específicas (`toHaveClass('sticky', 'top-0', 'z-10')` vs.
      `not.toHaveClass(...)`), no snapshots.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/index.md`
  - `ai-workflow/docs/app-features/shell/header.md`
  - `ai-workflow/docs/app-features/shell/sidebar.md`
  - `ai-workflow/docs/app-features/runtime/overview.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - `shell.scrollBehavior` conmuta correctamente el chrome entre sticky/no-sticky (header) y añade
    `overflow-y-auto` al sidebar (si declarado) y al envoltorio de contenido; `runtime-app` gana
    `'overflow-hidden'` solo en modo `"fixed"`.
  - Ausencia del campo y `"page"` explícito reproducen el comportamiento post-T2 sin diferencias
    observables.
  - Los cinco escenarios de spec (ausente, `"page"` explícito, `"fixed"` solo header, `"fixed"` header +
    sidebar, `"fixed"` solo sidebar) están cubiertos por tests y en verde.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - Feature completa end-to-end: contrato + validación + reset visual + comportamiento de scroll
    configurable. Lista para la pasada documental posterior con `update-app-documentation`.

---

## Task 0124-T4 — Sidebar pegajoso con scroll interno propio en modo `"page"`

- **Motivación de esta tarea**: al releer `spec.md` tras el cierre de T1–T3, FR11 y sus criterios de aceptación
  correspondientes fijan que `shell.sidebar` debe permanecer siempre visible mediante posicionamiento pegajoso
  propio, **con scroll interno cuando sus elementos exceden el alto disponible bajo la cabecera**, y que este
  comportamiento **es independiente de `shell.scrollBehavior`** — aplica igual en `"page"` que en `"fixed"` ("donde
  ya se anclaba por el propio mecanismo de esa modalidad"). El estado implementado en T1–T3 solo cerró este
  comportamiento para `"fixed"` (`getAppShellSidebarClassName({ collapsed, scrollable: scrollBehavior ===
  'fixed' })` en `src/runtime/runtime-node-styling-app-shell-sidebar.ts:17`, sin ningún `sticky` ni scroll interno
  cuando `scrollBehavior` es `"page"` o está ausente). Esta tarea cierra ese hueco sin reabrir T1–T3.
- **ID**: 0124-T4
- **Estado**: pending
- **Objetivo**: En modo `"page"` (ausente o `"page"` explícito), `shell.sidebar`, cuando existe, queda posicionado
  con `position: sticky` justo debajo de `shell.header` (o pegado a `top: 0` si no hay header), ocupando el alto
  disponible del viewport bajo la cabecera, con scroll interno propio (`overflow-y-auto`) que se activa solo
  cuando sus elementos visibles exceden ese alto y se detiene al llegar al último elemento. El comportamiento en
  modo `"fixed"` no cambia (ya lo cierra T3: bounded por la cascada flex `min-h-0`/`flex-1` + `overflow-y-auto`).
  Como el alto real de `shell.header` varía según su contenido (logo, título, menú con `flex-wrap`, acciones), la
  posición pegajosa del sidebar necesita conocer ese alto en tiempo de ejecución (spec, "Riesgos") — se mide con
  `ResizeObserver` sobre el nodo raíz de `AppShellHeader` y se propaga como variable CSS local, siguiendo la
  única excepción admitida por `conventions.md` a "no reintroducir un objeto `style` completo" (precedente:
  `getContainerNodeStyling`/`--runtime-container-gap` en `src/runtime/runtime-node-styling-container.ts`).
  - Estrategia de implementación (fija aquí para converger entre agentes; no estaba fijada por spec):
    - **Medición del alto del header** (`src/app/app-shell.tsx` y, en espejo, `src/dev-runtime/dev-runtime.tsx`):
      - Declarar, en la parte superior de la función del componente y **antes de cualquier `return` condicional**
        (regla de los hooks de React — `app-shell.tsx` no tiene hoy ningún hook; `dev-runtime.tsx` ya tiene varios
        y no tiene ningún `return` condicional antes de su JSX final, así que el punto de inserción es libre
        siempre que sea top-level de la función, junto al resto de hooks):
        ```ts
        const [headerNode, setHeaderNode] = useState<HTMLElement | null>(null)
        const [headerHeightPx, setHeaderHeightPx] = useState(0)

        useLayoutEffect(() => {
          if (headerNode === null) {
            setHeaderHeightPx(0)
            return
          }
          setHeaderHeightPx(headerNode.getBoundingClientRect().height)
          const observer = new ResizeObserver((entries) => {
            setHeaderHeightPx(entries[0].contentRect.height)
          })
          observer.observe(headerNode)
          return () => observer.disconnect()
        }, [headerNode])
        ```
        `useLayoutEffect` (no `useEffect`): la medición síncrona vía `getBoundingClientRect()` antes del primer
        paint evita un parpadeo de un frame con `top: 0px` mientras se espera el primer callback (siempre
        asíncrono) de `ResizeObserver`. En `dev-runtime.tsx`, nombrar las variables `devHeaderNode`/
        `devHeaderHeightPx`/`setDevHeaderNode` para no colisionar con el resto de nombres `dev*` ya presentes en
        ese componente; insertarlas junto a `devScrollBehavior`/`isDevFixed` (línea ~448 de ese fichero, ya
        top-level y sin condicional previo).
      - `AppShellHeader` (`src/runtime/runtime-shell/app-shell-header.tsx`): añadir `ref?: Ref<HTMLElement>` a
        `AppShellHeaderProps` y reenviarlo al `<header>` raíz existente (`<header ref={ref}
        data-testid="app-shell-header" ...>`). React 19 acepta `ref` como prop normal en componentes función, sin
        `forwardRef`. Cuando `header` es `undefined` o `isShellHeaderEmpty(header)`, el componente sigue
        devolviendo `null` sin cambios — React resuelve el ref a `null` en ese caso, que es exactamente el valor
        que debe disparar `headerHeightPx = 0`. No cambiar el resto de la firma de `AppShellHeaderProps` (sigue
        aceptando `header`/`pinned` igual que hoy). Exportar `AppShellHeader` igual que hoy (`export function
        AppShellHeader(...)`), sin tocar `src/runtime/runtime-shell/index.ts`.
      - `AppShell`: pasar `ref={setHeaderNode}` a `<AppShellHeader>`. `dev-runtime.tsx`: pasar
        `ref={setDevHeaderNode}` a su `<AppShellHeader>`.
    - **Propagación al sidebar**: `AppShell` pasa `stickyTopPx={headerHeightPx}` a `<AppShellSidebar>` (rama con
      sidebar); `dev-runtime.tsx` pasa `stickyTopPx={devHeaderHeightPx}` a su propio `<AppShellSidebar>`. Se pasa
      siempre (no solo en modo `"page"`); es la propia composición del helper de estilo (ver abajo) la que decide
      si se usa.
    - **Nueva variable CSS y clases del sidebar** (`src/runtime/runtime-node-styling-app-shell-sidebar.ts`):
      - Importar `type { CSSProperties } from 'react'` y `type { ShellScrollBehavior } from
        '../config/runtime-config-types'`.
      - Añadir:
        ```ts
        type AppShellSidebarStickyStyle = CSSProperties & {
          '--shell-sidebar-sticky-top': string
        }

        export function getAppShellSidebarStickyStyle(stickyTopPx: number): AppShellSidebarStickyStyle {
          return {
            '--shell-sidebar-sticky-top': `${stickyTopPx}px`,
          } as AppShellSidebarStickyStyle
        }
        ```
      - Sustituir la firma actual de `getAppShellSidebarClassName({ collapsed, scrollable })` (introducida en
        `0124-T3`) por:
        ```ts
        export function getAppShellSidebarClassName({
          collapsed,
          scrollBehavior = 'page',
        }: {
          collapsed: boolean
          scrollBehavior?: ShellScrollBehavior
        }) {
          const widthClass = collapsed ? 'w-16' : 'w-64'
          const baseClassName = `${widthClass} shrink-0 border-r border-app-border-soft bg-app-surface`

          if (scrollBehavior === 'fixed') {
            return `${baseClassName} overflow-y-auto`
          }

          return `${baseClassName} sticky top-[var(--shell-sidebar-sticky-top)] h-[calc(100vh_-_var(--shell-sidebar-sticky-top))] overflow-y-auto`
        }
        ```
        El parámetro `scrollable` desaparece; toda la resolución de variante pasa a estar keyed por
        `scrollBehavior` (patrón "Resolución de variantes visuales" de `conventions.md` mediante rama explícita
        por valor, no por booleano derivado). `overflow-y-auto` pasa a aplicarse en **ambos** modos (antes solo en
        `"fixed"`); en modo `"page"` se le suman `sticky`, `top-[var(--shell-sidebar-sticky-top)]` y
        `h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]`. El guion bajo (`_`) dentro de `calc(...)` es
        obligatorio: Tailwind traduce `_` a espacio literal dentro de un valor arbitrario, y `calc()` exige
        espacios alrededor del operador `-` para no ambigüar con un custom property con signo negativo — sin los
        guiones bajos, Tailwind emitiría CSS `calc()` inválido.
    - **`AppShellSidebar`** (`src/runtime/runtime-shell/app-shell-sidebar.tsx`):
      - Añadir `stickyTopPx?: number` (default `0`) a `AppShellSidebarProps`.
      - Sustituir la llamada actual `getAppShellSidebarClassName({ collapsed, scrollable: scrollBehavior ===
        'fixed' })` por `getAppShellSidebarClassName({ collapsed, scrollBehavior })`.
      - Añadir `style` al `<nav>` raíz: `style={scrollBehavior === 'fixed' ? undefined :
        getAppShellSidebarStickyStyle(stickyTopPx)}`. En modo `"fixed"`, sin `style` (idéntico a hoy — el ancho
        disponible se lo da la fila flex, no la variable CSS).
    - Ningún cambio a `RuntimeStateProvider`, `RuntimePage`, catálogo de nodos, `LayoutRenderer`,
      `AppShellHeader` más allá de la nueva prop `ref`, ni al contrato de `shell.scrollBehavior` (`0124-T1`, sin
      tocar). El `<main>`/`<section>`/frame de `0124-T2`/`0124-T3` tampoco cambian.
  - Limitación aceptada y no resuelta por esta tarea (documentar si aplica, no bloquea el cierre): entre el
    primer render y el primer `useLayoutEffect`, si el navegador pintara ese frame intermedio (React aplica
    `useLayoutEffect` antes del paint, así que en un navegador real no debería ser observable), el `top` podría
    ser momentáneamente `0px`. Es el mismo tipo de imprecisión de implementación que la propia spec deja fuera de
    contrato en "Riesgos" para la coordinación header/sidebar; no introducir lógica adicional (por ejemplo,
    ocultar el sidebar hasta la primera medición) para pulir este detalle.
- **Fuera de alcance**:
  - Cualquier cambio al modo `"fixed"` ya cerrado por `0124-T3`: sigue bounded por la cascada flex +
    `overflow-y-auto` sin `sticky` ni variable CSS (`0124-T3` ya satisface FR11 en ese modo).
  - Cualquier cambio al contrato de `shell.scrollBehavior` (`0124-T1`) o al reset visual global (`0124-T2`).
  - Indicadores de scroll, botón "volver arriba" o cualquier affordance visual adicional para el scroll interno
    del sidebar (spec, Fuera de alcance de T3, extensible aquí por el mismo criterio).
  - Soporte a navegadores sin `ResizeObserver`: no se introduce ningún fallback; el proyecto no documenta hoy una
    matriz de compatibilidad que lo exija.
  - `SidebarRailFlyout` (modo rail, `0123-T6`): su propio scroll interno (`max-h-[70vh]` en
    `getAppShellSidebarRailFlyoutPanelClassName`) es independiente y no se toca.
- **Dependencias**: `0124-T2` y `0124-T3` cerradas (composición base y prop `scrollBehavior` en
  `AppShellSidebar`/`AppShell` ya existen). Última tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts` (nueva firma de `getAppShellSidebarClassName`,
      nuevo `getAppShellSidebarStickyStyle`)
    - `src/runtime/runtime-shell/app-shell-header.tsx` (prop `ref`)
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (prop `stickyTopPx?`, `style` condicional)
    - `src/app/app-shell.tsx` (medición del header, `ref`/`stickyTopPx` cableados)
    - `src/dev-runtime/dev-runtime.tsx` (mismo cableado en espejo para la vista previa de desarrollo)
  - Tests:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación — sustituye el test de `scrollable` de
      `0124-T3` y añade `getAppShellSidebarStickyStyle`)
    - `src/tests/app/app-shell-scroll-behavior.test.tsx` (ampliación — corrige la aserción de `0124-T3` que
      esperaba ausencia de `overflow-y-auto` en modo `"page"`, y añade los nuevos escenarios de medición)
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación — ejercita el mismo cableado de medición/`sticky`
      pero a través de `DevRuntime`/`DevRuntimeReady`, ver más abajo; no es un sanity check de aserciones ya
      existentes, es cobertura de comportamiento propia de esta tarea)
    - `src/tests/app/app-shell-sidebar.test.tsx` (sanity — confirmar que ningún test existente asume ausencia de
      `sticky`/`overflow-y-auto`/`style` en el `<nav>` del sidebar; ampliar solo si algo rompe)
  - Documentación:
    - `ai-workflow/docs/app-features/shell/sidebar.md`
    - `ai-workflow/docs/app-features/shell/index.md`
    - `ai-workflow/docs/app-features/runtime/overview.md`
    - `ai-workflow/docs/current-state.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
    - `src/tests/app/app-shell-scroll-behavior.test.tsx` (ampliación)
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación — cobertura de comportamiento propia, no sanity)
    - `src/tests/app/app-shell-sidebar.test.tsx` (sanity, ampliación solo si necesario)
  - **Comportamiento cubierto**:
    - `getAppShellSidebarClassName({ collapsed: false })` (sin `scrollBehavior`, default `'page'`) y
      `getAppShellSidebarClassName({ collapsed: false, scrollBehavior: 'page' })` devuelven ambos exactamente
      `'w-64 shrink-0 border-r border-app-border-soft bg-app-surface sticky top-[var(--shell-sidebar-sticky-top)] h-[calc(100vh_-_var(--shell-sidebar-sticky-top))] overflow-y-auto'`.
    - `getAppShellSidebarClassName({ collapsed: true, scrollBehavior: 'page' })` devuelve el mismo string con
      `w-16` en vez de `w-64`.
    - `getAppShellSidebarClassName({ collapsed: false, scrollBehavior: 'fixed' })` devuelve exactamente
      `'w-64 shrink-0 border-r border-app-border-soft bg-app-surface overflow-y-auto'` (idéntico al cierre de
      `0124-T3`, sin `sticky` ni las clases de `top`/`h`) — regresión explícita del modo `"fixed"`.
    - `getAppShellSidebarStickyStyle(56)` devuelve `{ '--shell-sidebar-sticky-top': '56px' }`;
      `getAppShellSidebarStickyStyle(0)` devuelve `{ '--shell-sidebar-sticky-top': '0px' }`.
    - End-to-end (`app-shell-scroll-behavior.test.tsx`), con `ResizeObserver` stubbeado igual que en
      `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx` (clase mock que captura los callbacks
      registrados vía `vi.stubGlobal('ResizeObserver', MockResizeObserver)` en `beforeEach`, `vi.unstubAllGlobals()`
      en `afterEach`), con `shell.header` + `shell.sidebar` declarados y sin `scrollBehavior` (modo `"page"`):
      - Render inicial: `app-shell-sidebar` tiene las clases `sticky`, `top-[var(--shell-sidebar-sticky-top)]`,
        `h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]` y `overflow-y-auto`.
      - Tras invocar (dentro de `act(...)`) el callback de `ResizeObserver` capturado con una entrada sintética
        `{ contentRect: { height: 56 } }`, `app-shell-sidebar` expone `toHaveStyle('--shell-sidebar-sticky-top:
        56px')` (mismo patrón de aserción que `src/tests/layout-renderer/layout-renderer-container.test.tsx:264`
        para `--runtime-container-gap`).
    - Config con `shell.sidebar` pero **sin** `shell.header`, modo `"page"`: `app-shell-sidebar` tiene `sticky`,
      `top-[var(--shell-sidebar-sticky-top)]`, `h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]` y
      `overflow-y-auto`, con `toHaveStyle('--shell-sidebar-sticky-top: 0px')` (sin header que medir, altura 0 por
      defecto, sin necesidad de disparar ningún callback de `ResizeObserver`).
    - `shell.scrollBehavior: "fixed"` con `shell.header` + `shell.sidebar`: `app-shell-sidebar` **no** tiene
      `sticky`, **no** tiene ninguna clase `top-[...]`/`h-[...]`, y **no** tiene el atributo `style` con
      `--shell-sidebar-sticky-top` (regresión byte a byte del cierre de `0124-T3`).
    - `shell.scrollBehavior: "page"` explícito reproduce el mismo comportamiento que omitir el campo (regresión
      adicional, ya cubierta en general por `0124-T3` pero extendida aquí al sidebar).
    - Sanity: los tests existentes de `AppShellHeader`/`AppShellSidebar` (`0122-T4`, `0123-T4`, `0123-T5`,
      `0123-T6`, `0124-T3`) siguen pasando sin cambios de aserciones salvo los explícitamente descritos arriba.
    - `dev-runtime.test.tsx` (mismo cableado que en `app-shell.tsx`, pero a través de `DevRuntime`/
      `DevRuntimeReady` — esto **no** es un sanity check de aserciones ya existentes, es la única cobertura de
      comportamiento propia de esta tarea para `src/dev-runtime/dev-runtime.tsx`). Añadir un nuevo `describe`
      junto a los ya existentes de "DevRuntime shell header mount"/"DevRuntime shell sidebar mount", con el mismo
      stub de `ResizeObserver` que en `app-shell-scroll-behavior.test.tsx`/`layout-canvas-grid-drop-zones.test.tsx`
      (`vi.stubGlobal('ResizeObserver', MockResizeObserver)` en `beforeEach`, `vi.unstubAllGlobals()` en
      `afterEach`) y el helper `makeRootElement`/`render(<DevRuntime rootElement={...} />)` ya usado por ese
      fichero:
      - Con `shell: { header: { title: 'My App' }, sidebar: { items: [{ label: 'Home', href: '/home' }] } }` y sin
        `scrollBehavior` (modo `"page"`): `app-shell-sidebar` tiene las clases `sticky`,
        `top-[var(--shell-sidebar-sticky-top)]`, `h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]` y
        `overflow-y-auto`.
      - Tras invocar (dentro de `act(...)`) el callback de `ResizeObserver` capturado con una entrada sintética
        `{ contentRect: { height: 40 } }`, `app-shell-sidebar` expone
        `toHaveStyle('--shell-sidebar-sticky-top: 40px')`.
      - Con `shell: { scrollBehavior: 'fixed', header: { title: 'My App' }, sidebar: { items: [...] } }`:
        `app-shell-sidebar` **no** tiene `sticky` ni ninguna clase `top-[...]`/`h-[...]`, ni el atributo `style`
        con `--shell-sidebar-sticky-top` (regresión del modo `"fixed"` dentro del preview de desarrollo, igual
        que en `app-shell.tsx`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-node-styling.test.ts`
    - `pnpm test --run src/tests/app/app-shell-scroll-behavior.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-sidebar.test.tsx` (sanity)
    - `pnpm test --run src/tests/app/app-shell-header.test.tsx` (sanity — la nueva prop `ref` no debe cambiar
      ningún comportamiento observable del header)
    - `pnpm test --run src/tests/app/app-shell.test.tsx` (sanity)
    - `pnpm test` (al cierre, para confirmar suite global y gate de cobertura)
  - **Restricciones**:
    - No reintroducir un objeto `style` completo para toda la presentación del sidebar; la única propiedad en
      `style` es la variable CSS `--shell-sidebar-sticky-top`, siguiendo la excepción ya admitida por
      `conventions.md`.
    - Mantener el guion bajo (`_`) en `h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]`; no reescribirlo con un
      espacio literal (clase inválida en HTML) ni sin espacio/guion bajo (CSS `calc()` inválido).
    - No mover la medición del header a `AppShellSidebar` ni a un contexto compartido: `AppShell`/`dev-runtime.tsx`
      son los únicos puntos que conocen el nodo del header y el que del sidebar; `stickyTopPx` viaja por prop,
      igual que `scrollBehavior` ya viaja por prop desde `0124-T3` (no introducir `ShellLayoutContext`).
    - Los hooks nuevos (`useState`/`useLayoutEffect`) deben declararse antes de cualquier `return` condicional en
      `AppShell`, para no violar las reglas de hooks de React.
    - Verificar clases con `toHaveClass(...)`/`not.toHaveClass(...)` específicas y `toHaveStyle(...)` para la
      variable CSS; no usar snapshots.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/sidebar.md`
  - `ai-workflow/docs/app-features/shell/index.md`
  - `ai-workflow/docs/app-features/runtime/overview.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - En modo `"page"` (ausente o explícito), con `shell.sidebar` declarado, el sidebar es `sticky`, ocupa el alto
    disponible bajo el header medido en tiempo de ejecución (o `100vh` si no hay header) y hace scroll interno
    propio solo cuando sus elementos lo exceden.
  - El modo `"fixed"` permanece byte a byte idéntico al cierre de `0124-T3`.
  - Los cinco escenarios de spec para FR11 (con header, sin header, `"page"` ausente/explícito, `"fixed"`) están
    cubiertos por tests y en verde.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - Feature `0124` completa end-to-end respecto a `spec.md` vigente: contrato + validación + reset visual +
    scroll configurable + sidebar pegajoso con scroll interno propio, independiente de `scrollBehavior`. Lista
    para la pasada documental con `update-app-documentation`.
