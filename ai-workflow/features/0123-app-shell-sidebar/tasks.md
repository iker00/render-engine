# Tasks — 0123 — `shell.sidebar`: menú lateral de navegación jerárquica

Contrato de ejecución para la feature. Alcance: nuevo bloque opcional `shell.sidebar` (hermano aditivo de
`shell.header`, cerrado en `0122`) con un árbol de `sidebarItem` de profundidad arbitraria, expansión inline en
modo expandido, modo rail (solo iconos) con flyout para ramas, auto-expansión de ancestros al navegar, y sección
"Shell" del editor visual extendida con un segundo toggle y un editor recursivo. Retrocompatibilidad total: sin
`shell.sidebar` (con o sin `shell.header`), el runtime se comporta exactamente igual que hoy.

Basado en `spec.md` y en las 10 decisiones de `design.md`. Se divide en ocho tareas secuenciales que respetan las
fronteras de `src/config/`, `src/runtime/` y `src/dev-runtime/`:

1. **T1** — Contrato de tipos y schema Zod recursivo (`z.lazy`) para `sidebarItem` y `shell.sidebar`.
2. **T2** — Validación cruzada recursiva en `validate-shell.ts` (`pageId`, `visibility`, sin `item.*`).
3. **T3** — Utilidad pura `computeActiveSidebarItemIds`, recursiva y sin tope de profundidad.
4. **T4** — `AppShellSidebar`: montaje en `app-shell.tsx`, composición header+sidebar+contenido, render en modo
   expandido con expansión/colapso manual de ramas (sin modo rail todavía).
5. **T5** — Auto-expansión de ramas ancestro del item activo al navegar.
6. **T6** — Modo rail completo: control de colapso, render icon-only con fallback de inicial, y
   `SidebarRailFlyout` con expansión inline anidada dentro del propio panel.
7. **T7** — Editor visual: toggle "Sidebar activo" + scaffold vacío en `ShellConfigPanel`, incluida la corrección
   de un efecto colateral ya presente en el toggle de header (ver T7).
8. **T8** — Editor visual: `SidebarItemListEditor` recursivo (alta/edición/borrado/reordenación por nivel).

T1→T2 y T1→T3 son secuenciales en esta lista pero T3 solo depende de T1 (no de T2); se ejecutan en este orden por
simplicidad de seguimiento, no por dependencia real entre ellas. T4 no puede empezar sin T1+T2+T3 cerradas. T5 y T6
dependen de T4. T7 depende de T4 (previsualización en vivo); T8 depende de T7.

## Siguiente tarea a escoger

`0123-T1` — habilita el contrato de tipos y schema para el resto del plan.

---

## Task 0123-T1 — Contrato de tipos y schema Zod recursivo para `sidebarItem`

- **ID**: 0123-T1
- **Estado**: pending
- **Objetivo**: Añadir `sidebar?: ShellSidebarConfig` a `ShellConfig`, con `sidebarItem` como tipo Zod
  genuinamente recursivo (`z.lazy`), a diferencia de `menuItem`/`menuItemChild` (dos tipos fijos). Cualquier nodo
  del árbol admite los mismos campos, incluidos sus propios `children`, sin tope de profundidad (design decisión
  1).
  - Cambios concretos:
    - `src/config/runtime-config-types.ts`:
      - Añadir:
        ```ts
        export interface SidebarItemConfig {
          label: string
          icon?: string
          visibility?: RuntimeVisibilityConfig
          href?: string
          action?: NavigateToRuntimeUiAction | GoBackRuntimeUiAction
          children?: SidebarItemConfig[]
        }

        export interface ShellSidebarConfig {
          items?: SidebarItemConfig[]
          defaultCollapsed?: boolean
        }
        ```
      - Extender `ShellConfig` con `sidebar?: ShellSidebarConfig` (hermano de `header?`).
    - `src/config/runtime-config-zod.ts`:
      - Definir `sidebarItemBaseFieldsSchema` (`.strict()`) con los mismos campos base que `menuItemFieldsSchema`
        (`label: z.string()`, `icon?`, `visibility?: visibilitySchema`, `href?`, `action?:
        z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema])`), reutilizando
        exactamente esos mismos schemas ya importados por `menuItemFieldsSchema` — sin duplicar sus
        definiciones, solo sin compartir el objeto Zod completo (`sidebarItem` es un tipo propio, no una
        reutilización literal de `menuItem`).
      - Definir `refineSidebarItemShape` (misma lógica que `refineMenuItemShape` sobre `href`/`action`/
        `children`, mensajes propios): `Sidebar items with children cannot declare href or action.` / `Sidebar
        items cannot declare both href and action.` / `Sidebar items must declare either href, action or
        children.`, mismos `path` por caso (`['href']`/`['action']`/`[]`) y mismo `code: 'custom'`.
      - Definir:
        ```ts
        export const sidebarItemSchema: z.ZodType<SidebarItemConfig> = z.lazy(() =>
          sidebarItemBaseFieldsSchema
            .extend({ children: z.array(sidebarItemSchema).nonempty().optional() })
            .superRefine(refineSidebarItemShape),
        )

        export const shellSidebarSchema = z
          .object({
            items: z.array(sidebarItemSchema).optional(),
            defaultCollapsed: z.boolean().optional(),
          })
          .strict()
        ```
      - Extender `shellSchema` con `sidebar: shellSidebarSchema.optional()` (sigue `.strict()`; ya no hace falta
        el comentario existente sobre "un futuro sidebar" — sustituirlo por uno que documente brevemente que
        `sidebar` es hermano aditivo de `header`, ambos opcionales de forma independiente).
    - No tocar `menuItemFieldsSchema`/`menuItemSchema`/`menuItemChildSchema` ni sus mensajes: son un tipo
      completamente independiente (design decisión 1, alternativa descartada).
- **Fuera de alcance**:
  - Validación cruzada (`pageId`, `visibility` contra superficies reales): `0123-T2`.
  - Cualquier render, estado activo o editor visual: `0123-T3` a `0123-T8`.
  - Cualquier cambio a `menuItem`/`menuItemChild`.
- **Dependencias**: ninguna. Primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` (`SidebarItemConfig`, `ShellSidebarConfig`, `ShellConfig.sidebar`)
    - `src/config/runtime-config-zod.ts` (`sidebarItemBaseFieldsSchema`, `refineSidebarItemShape`,
      `sidebarItemSchema`, `shellSidebarSchema`, `shellSchema` ampliado)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts` (nuevo)
  - Documentación: revisar tras el cierre de implementación (ver "Documentación afectada").
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - Aceptación: config sin `shell.sidebar` (con o sin `shell.header`) valida sin error.
    - Aceptación: `shell.sidebar: {}` valida sin error.
    - Aceptación: `shell.sidebar.items: []` valida sin error.
    - Aceptación: `shell.sidebar.defaultCollapsed: true`/`false` valida sin error; ausente también.
    - Aceptación: un `sidebarItem` con `label` + `href` valida sin error.
    - Aceptación: un `sidebarItem` con `label` + `action` (`navigateTo`, `goBack`) valida sin error.
    - Aceptación: un `sidebarItem` con `icon`, con `visibility` (contrato transversal), valida sin error.
    - Aceptación: un `sidebarItem` con `children` no vacío (cada hijo con `href`/`action` propio) valida sin
      error.
    - Aceptación: un árbol de **cuatro niveles de profundidad** (cada nivel con `children`, hoja en el cuarto
      nivel) valida sin error — prueba explícita de que no hay tope de profundidad.
    - Aceptación: un `sidebarItem` de profundidad 2+ con sus propios `children` valida sin error (recursión
      real, a diferencia de `menuItemChild`).
    - Rechazo: `sidebarItem` sin `label` se rechaza con error Zod sobre `label`.
    - Rechazo: `sidebarItem` con `href` **y** `action` se rechaza con mensaje `Sidebar items cannot declare both
      href and action.` sobre `path: ['href']`.
    - Rechazo: `sidebarItem` sin `href`, `action` ni `children` se rechaza con mensaje `Sidebar items must
      declare either href, action or children.` sobre `path: []`.
    - Rechazo: `sidebarItem` con `children` **y** `href` (o **y** `action`) se rechaza con mensaje `Sidebar
      items with children cannot declare href or action.`
    - Rechazo: `sidebarItem.children: []` (vacío explícito) se rechaza por `.nonempty()`.
    - Rechazo: un hijo anidado en cualquier profundidad que incumpla las mismas reglas de shape (p. ej. hijo de
      tercer nivel con `href` y `action` simultáneos) se rechaza igual que en la raíz — prueba de que la
      recursión aplica el mismo refine a cada nivel.
    - Rechazo: `shell.sidebar` con una clave desconocida se rechaza por `.strict()`.
    - Regresión: los tests ya existentes de `runtime-config-validation-shell.test.ts` (shape de `menuItem`/
      `header`) siguen pasando sin cambios de aserciones.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell.test.ts` (sanity)
    - `pnpm test` (al cierre, para confirmar suite global y gate de cobertura)
  - **Restricciones**:
    - No duplicar los schemas de acción (`navigateToButtonActionSchema`, `goBackButtonActionSchema`) ni la
      lógica de `refineMenuItemShape`: escribir `refineSidebarItemShape` como función propia (mismo algoritmo,
      mensajes distintos), no como wrapper que reformatee el mensaje de la función de `menuItem`.
    - No exponer `sidebarItemBaseFieldsSchema` fuera de `runtime-config-zod.ts`.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/structure.md` — declarar `shell.sidebar` en el bloque `shell`.
  - `ai-workflow/docs/app-features/shell/index.md` — enlazar el nuevo sub-documento de sidebar.
  - `ai-workflow/docs/app-features/shell/sidebar.md` (nuevo) — contrato completo de `shell.sidebar` y
    `sidebarItem`.
- **Criterios de finalización**:
  - `ShellConfig` incluye `sidebar?: ShellSidebarConfig` con `SidebarItemConfig` recursivo exportado.
  - `sidebarItemSchema` acepta árboles de profundidad arbitraria y rechaza los casos de shape inválido a
    cualquier profundidad.
  - Todos los tests nuevos en verde; `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - Tipos y schema recursivo del sidebar están en el árbol; ningún consumidor los lee todavía (inerte hasta
    `0123-T4`).

---

## Task 0123-T2 — Validación cruzada recursiva de `shell.sidebar` en `validate-shell.ts`

- **ID**: 0123-T2
- **Estado**: pending
- **Objetivo**: Añadir a `validate-shell.ts` un recorrido recursivo `validateSidebarItemCrossRefs` que se llama a
  sí mismo por cada `children[i]`, reutilizando sin modificar `validateShellVisibility`/
  `checkShellVisibilityReference` (ya agnósticas a la profundidad del nodo que las invoca — design decisión 2).
  No generalizar el bucle existente de `header.menu` para reutilizarlo aquí (alternativa descartada
  explícitamente en el design).
  - Cambios concretos:
    - `src/config/validate-shell.ts`:
      - Nueva función:
        ```ts
        function validateSidebarItemCrossRefs(
          item: SidebarItemConfig,
          path: string,
          pageIds: ReadonlySet<string>,
          operationNames: ReadonlySet<string>,
        ): { status: 'error'; error: RuntimeConfigError } | null {
          if (item.action?.type === 'navigateTo' && !pageIds.has(item.action.pageId)) {
            return invalidLayout(
              `Shell configuration is invalid at "${path}.action.pageId": pageId "${item.action.pageId}" is not declared in "pages".`,
            )
          }

          if (item.visibility !== undefined) {
            const visibilityError = validateShellVisibility(item.visibility, `${path}.visibility`, operationNames)
            if (visibilityError) return visibilityError
          }

          if (item.children) {
            for (let i = 0; i < item.children.length; i += 1) {
              const childError = validateSidebarItemCrossRefs(item.children[i], `${path}.children[${i}]`, pageIds, operationNames)
              if (childError) return childError
            }
          }

          return null
        }
        ```
        Importante: el chequeo de `visibility` **no** debe retornar `null` de forma temprana (a diferencia de
        `validateMenuItemCrossRefs`, que sí puede porque nunca recursa) — debe continuar hacia `children` cuando
        no hay error, o el recorrido se detendría en el primer nodo con `visibility` válida sin comprobar sus
        hijos.
      - En `validateShellCrossReferences`, tras el bloque existente de `header.actions`, añadir:
        ```ts
        if (shell.sidebar?.items) {
          for (let i = 0; i < shell.sidebar.items.length; i += 1) {
            const itemError = validateSidebarItemCrossRefs(shell.sidebar.items[i], `shell.sidebar.items[${i}]`, pageIdSet, operationNameSet)
            if (itemError) return itemError
          }
        }
        ```
      - Los mensajes reutilizan el mismo prefijo ya vigente `Shell configuration is invalid at "..."`, y la misma
        regla de `item.*` prohibido (heredada automáticamente al reutilizar `validateShellVisibilityCondition`
        sin cambios).
- **Fuera de alcance**:
  - Cualquier render o helper de estado activo: `0123-T3`/`0123-T4`.
  - Refactor de `header.menu`/`validateMenuItemCrossRefs` para generalizarlo a recursión: descartado
    explícitamente en el design (decisión 2).
- **Dependencias**: `0123-T1` cerrado (tipos y schema de `sidebarItem` disponibles).
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/validate-shell.ts` (`validateSidebarItemCrossRefs`, wiring en `validateShellCrossReferences`)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts` (ampliación)
  - Documentación:
    - `ai-workflow/docs/app-features/config/validation.md`
    - `ai-workflow/docs/app-features/shell/sidebar.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts` (ampliación — nuevo
      `describe` de cross-refs, sin tocar los tests de shape de `0123-T1`)
  - **Comportamiento cubierto**:
    - Aceptación: `sidebarItem` raíz con `action.navigateTo.pageId` existente en `pages` valida sin error.
    - Aceptación: `sidebarItem` en tercer/cuarto nivel de anidamiento con `action.navigateTo.pageId` existente
      valida sin error (prueba explícita de recursión más allá de un nivel).
    - Aceptación: `sidebarItem` con `action: { type: 'goBack' }` valida sin error.
    - Aceptación: `sidebarItem` con `visibility` válida en cualquier profundidad (raíz y anidado) valida sin
      error.
    - Rechazo: `sidebarItem.action.navigateTo.pageId` inexistente en `pages`, en la raíz, se rechaza con ruta
      exacta `shell.sidebar.items[i].action.pageId`.
    - Rechazo: el mismo caso anterior mas anidado a profundidad 3 se rechaza con ruta exacta
      `shell.sidebar.items[i].children[j].children[k].action.pageId`.
    - Rechazo: `sidebarItem.visibility` con `item.*` se rechaza con el mismo mensaje ya usado por `menuItem`
      (`Shell menu items do not support item.* references.` — mensaje literal reutilizado sin cambiarlo, ya
      que la función reutilizada es la misma).
    - Rechazo: `sidebarItem.visibility` referenciando una operación inexistente en `api` se rechaza con el
      prefijo de shell, en cualquier profundidad.
    - Regresión: un árbol con un nodo intermedio válido pero un nieto inválido detecta el error del nieto (no
      se detiene prematuramente en el nodo intermedio).
    - Regresión: los tests de shape de `0123-T1` y los cross-refs de `header` (`0122-T2`) siguen pasando sin
      cambios.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell-sidebar.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell.test.ts` (sanity)
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - No añadir un fichero de test nuevo; ampliar el creado en `0123-T1`.
    - No modificar `validateShellVisibility`/`checkShellVisibilityReference`/`validateMenuItemCrossRefs`.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/validation.md`
  - `ai-workflow/docs/app-features/shell/sidebar.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - Todos los casos de cross-ref (aceptación y rechazo) pasan con rutas exactas a cualquier profundidad.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - La validación previa al render acepta o rechaza `shell.sidebar` con diagnóstico de ruta exacta a cualquier
    profundidad. Aún no hay render (`0123-T4`).

---

## Task 0123-T3 — Utilidad pura `computeActiveSidebarItemIds`

- **ID**: 0123-T3
- **Estado**: pending
- **Objetivo**: Función pura análoga a `computeActiveMenuItemIds` (`0122-T3`) pero recursiva y sin tope de
  profundidad: dado `shell.sidebar.items` y el `pageId` activo, devuelve el conjunto de *paths* del item activo
  y de **todos** sus ancestros de cualquier profundidad (design decisión 6).
  - Cambios concretos:
    - `src/runtime/runtime-shell/compute-active-sidebar-item-ids.ts` (nuevo):
      - Codificación de `path`: raíz usa su índice (`"0"`); un nodo anidado usa
        `"${parentPath}.children.${index}"` (p. ej. `"0.children.2.children.1"`), estable dentro de un único
        árbol, no API pública fuera de este módulo.
      - Firma:
        ```ts
        export interface ActiveSidebarItemState {
          readonly activePaths: ReadonlySet<string>
        }
        export function computeActiveSidebarItemIds(
          items: readonly SidebarItemConfig[] | undefined,
          activePageId: string | null,
        ): ActiveSidebarItemState
        ```
      - Recorrido recursivo interno: por cada item, comprueba si es el destino activo
        (`action.type === 'navigateTo' && action.pageId === activePageId`) y, si tiene `children`, recorre
        primero sus hijos; el item se añade a `activePaths` si él mismo es el destino activo **o** si algún
        descendiente lo es (propagación a todos los ancestros, sin tope, a diferencia de `0122-T3` que solo
        propaga a un padre).
      - Reglas heredadas de `0122-T3`: `items` ausente/vacío o `activePageId: null` → `activePaths` vacío;
        `goBack` y `href` nunca participan; dos items distintos con el mismo `pageId` se marcan ambos activos
        junto con sus respectivos ancestros; la función no evalúa `visibility` (se resuelve en el render).
    - `src/runtime/runtime-shell/index.ts` (ampliación): re-export de `computeActiveSidebarItemIds` y
      `ActiveSidebarItemState`.
- **Fuera de alcance**:
  - Cualquier render: `0123-T4`.
  - Cualquier integración con `runtime-state`: la función es pura, recibe el `pageId` ya calculado desde fuera.
- **Dependencias**: `0123-T1` cerrado (tipo `SidebarItemConfig`).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-shell/compute-active-sidebar-item-ids.ts` (nuevo)
    - `src/runtime/runtime-shell/index.ts` (ampliación)
  - Tests:
    - `src/tests/runtime/runtime-shell-active-sidebar.test.ts` (nuevo)
  - Documentación: ninguna en esta tarea (se documenta cuando sea observable en `0123-T4`/`0123-T5`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-shell-active-sidebar.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `items` `undefined`/`[]`, o `activePageId: null` → `activePaths` vacío.
    - Item raíz con `pageId` activo → su path en `activePaths`.
    - Item raíz con `href` (sin `action`) → nunca activo.
    - Item raíz con `action: goBack` → nunca activo.
    - Item de segundo nivel activo → su path y el path de su padre en `activePaths`.
    - Item de **cuarto nivel** activo → los paths de los cuatro niveles (el propio y sus tres ancestros) están
      todos en `activePaths` — prueba explícita de propagación sin tope.
    - Dos items en ramas distintas con el mismo `pageId` → ambos y sus respectivos ancestros en `activePaths`.
    - Un padre con `children` sin ningún hijo activo → ni el padre ni los hijos aparecen en `activePaths`.
    - Pureza: dos llamadas con las mismas entradas devuelven conjuntos observacionalmente iguales.
    - Robustez: la presencia de `visibility` en cualquier item no influye en el cómputo.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-shell-active-sidebar.test.ts`
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - Función 100% pura: sin `react`, sin `runtime-state`, sin el layout renderer.
- **Documentación afectada**: ninguna en esta tarea (ver `0123-T4`).
- **Criterios de finalización**:
  - `computeActiveSidebarItemIds` cumple todos los casos declarados, incluida la propagación a cualquier
    profundidad.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - El helper existe, es puro, y está re-exportado desde `src/runtime/runtime-shell/index.ts`. Inerte hasta
    `0123-T4`.

---

## Task 0123-T4 — `AppShellSidebar` en modo expandido + montaje en `app-shell.tsx`

- **ID**: 0123-T4
- **Estado**: pending
- **Objetivo**: Materializar el render del sidebar en modo expandido (sin modo rail todavía, que llega en
  `0123-T6`): hojas navegables, disparadores de rama con expansión/colapso manual inline, estado activo aplicado,
  y la nueva composición de `app-shell.tsx` cuando `shell.sidebar.items` está declarado y no vacío.
  - Composición en `app-shell.tsx` (design decisión 3): hoy el "frame" (`getAppShellFrameClassName()`) contiene
    `AppShellHeader` seguido de `RuntimePage` como hijos en flujo de documento normal. Cuando
    `shell.sidebar?.items` es no vacío, sustituir el `<RuntimePage />` suelto por:
    ```tsx
    <div className={getAppShellBodyClassName()}>
      <AppShellSidebar sidebar={runtimeConfig.config.shell?.sidebar} />
      <div className={getAppShellBodyContentClassName()}>
        <RuntimePage />
      </div>
    </div>
    ```
    con `AppShellHeader` sin cambios como primer hijo del frame. `getAppShellBodyClassName()` es una fila flex
    simple (`flex w-full`) **sin** sobreescribir `align-items` — el `stretch` por defecto de flexbox hace que
    `AppShellSidebar` y el contenedor de `RuntimePage` igualen su altura entre sí de forma natural, sin tocar el
    `<main>`/`<section>`/frame existentes ni su `min-h-screen` actual. Esto resuelve "el sidebar ocupa la altura
    restante"/"toda la altura" (requisitos 11 y 12) dentro del frame existente, sin reestructurar el chrome
    exterior compartido con la superficie de errores de bootstrap. Sin `shell.sidebar.items` (ausente o `[]`), la
    estructura se mantiene byte a byte igual a hoy (`<RuntimePage />` suelto, sin el nuevo `div`).
  - Cambios concretos:
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (nuevo):
      - `AppShellSidebar({ sidebar }: { sidebar?: ShellSidebarConfig })`: devuelve `null` si `sidebar` es
        `undefined` o `sidebar.items` es `undefined`/`[]` (requisito 3, caso límite de spec).
      - Estado local `expandedPaths: Set<string>` (`useState`, vacío inicialmente), compartido por todo el árbol
        vía props/callback (`onToggleExpand(path)`: añade el path si está ausente, lo quita si está presente).
      - Usa `useRuntimeCurrentPage`, `useRuntimeState`, `useRuntimeStateActions` (mismos hooks que
        `AppShellHeader`) y `computeActiveSidebarItemIds(sidebar.items, activePage?.id ?? null)` de `0123-T3`
        para derivar `activePaths` en cada render.
      - Render recursivo: por cada item de `sidebar.items` (y, recursivamente, de `item.children`), filtrar por
        `matchesVisibilityRule(item.visibility, state)` antes de renderizarlo (mismo patrón que
        `AppShellHeader`, sin dejar hueco).
        - Item **hoja** (`href`/`action`): nuevo componente `SidebarItemLeaf` (análogo a `MenuItemLeaf` pero
          tipado sobre `SidebarItemConfig`, sin reutilizar literalmente `MenuItemLeaf` — design decisión 3, ya
          que `sidebarItem` no comparte tipo Zod con `menuItem`). Reutiliza `resolveRuntimeTextReference` para
          `label`/`href`, `IconNode` para `icon`, `executeRuntimeUiAction` para `action`. Aplica clase de activo
          cuando `activePaths.has(path)`.
        - Item **disparador de rama** (`children` no vacío): `<button type="button" aria-expanded={...}>` con
          `label`/`icon`, que al click llama `onToggleExpand(path)`. Nunca dispara navegación. Si
          `expandedPaths.has(path)`, renderiza un contenedor con los `children` visibles recursivamente
          (mismo mecanismo, path hijo `${path}.children.${index}`), indentado con una clase de estilo estable
          (nueva, ver más abajo). Aplica clase de activo cuando `activePaths.has(path)` (el propio disparador
          puede estar activo sin ser navegable, igual que en header).
      - `collapsed` NO se introduce en esta tarea: el componente siempre renderiza en modo expandido. La firma
        del helper de estilo del contenedor sí acepta ya el parámetro `{ collapsed: boolean }` (ver más abajo)
        para que `0123-T6` no tenga que cambiar su forma, pero esta tarea lo invoca siempre con `collapsed:
        false` y no lee `sidebar.defaultCollapsed`.
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts` (nuevo):
      - `getAppShellBodyClassName()`, `getAppShellBodyContentClassName()` (helpers de la composición en
        `app-shell.tsx`).
      - `getAppShellSidebarClassName({ collapsed }: { collapsed: boolean })` → ancho `w-64` si `!collapsed`
        (design decisión 9; el ancho `w-16` de `collapsed` lo introduce y ejercita `0123-T6`, pero la firma
        vive aquí).
      - `getAppShellSidebarItemClassName({ active }: { active: boolean })` (hojas) y
        `getAppShellSidebarTriggerClassName({ active, expanded }: { active: boolean; expanded: boolean })`
        (disparadores de rama), reutilizando tokens globales (`bg-app-surface-subtle`, `text-app-accent`, etc.)
        de forma consistente con `runtime-node-styling-app-shell-header.ts`.
      - Clase de indentación por nivel de anidamiento para los contenedores de `children` expandidos.
    - `src/runtime/runtime-shell/index.ts` (ampliación): re-export de `AppShellSidebar`.
    - `src/app/app-shell.tsx`: montar `AppShellSidebar` según la composición descrita arriba.
- **Fuera de alcance**:
  - Auto-expansión de ancestros al navegar: `0123-T5`.
  - Modo rail (`collapsed: true`, control de colapso, flyout, fallback de icono ausente): `0123-T6`.
  - Sección "Shell" del editor visual: `0123-T7`/`0123-T8`.
- **Dependencias**: `0123-T1`, `0123-T2` y `0123-T3` cerrados.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (nuevo)
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts` (nuevo)
    - `src/runtime/runtime-shell/index.ts` (ampliación)
    - `src/app/app-shell.tsx` (ampliación: composición condicional del body)
  - Tests:
    - `src/tests/app/app-shell-sidebar.test.tsx` (nuevo)
  - Documentación:
    - `ai-workflow/docs/app-features/shell/sidebar.md`
    - `ai-workflow/docs/app-features/runtime/organization.md`
    - `ai-workflow/docs/app-features/navigation/navigate-actions.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/app/app-shell-sidebar.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Sin `shell.sidebar` (o con `items` ausente/`[]`), no se renderiza ningún elemento de sidebar y la
      composición del body es idéntica a hoy (`RuntimePage` como único hijo tras el header) — regresión sanity.
    - Con `shell.header` y `shell.sidebar` declarados, el header ocupa el frame por encima y el sidebar aparece
      como columna a la izquierda del contenido de página.
    - Con solo `shell.sidebar` (sin `shell.header`), el sidebar aparece como primer elemento del frame.
    - Un `sidebarItem` hoja con `href` se renderiza como `<a href="...">`; uno con `action.navigateTo` se
      renderiza como `<button>` cuyo click dispara navegación real (`executeRuntimeUiAction`).
    - Un `sidebarItem` con `children` se renderiza como `<button aria-expanded="false">` sin hijos visibles por
      defecto; al hacer click, `aria-expanded` pasa a `"true"` y los hijos aparecen inline debajo, indentados.
    - Click sobre un segundo disparador de rama, con el primero ya expandido, deja ambas ramas expandidas
      simultáneamente (requisito 14: sin exclusión).
    - Un árbol de cuatro niveles de profundidad: expandir cada nivel sucesivamente revela el siguiente, hasta
      llegar a la hoja del cuarto nivel.
    - `visibility` oculta un `sidebarItem` (hoja o disparador) sin dejar hueco; si todos los hijos de un
      disparador quedan ocultos, el disparador sigue siendo clicable (se expandiría vacío).
    - Estado activo: un `sidebarItem` cuyo `pageId` coincide con la página visible recibe la clase de activo;
      si está anidado, sus ancestros (disparadores) también la reciben (sin expandirse automáticamente en esta
      tarea — eso es `0123-T5`).
    - Persistencia del montaje: navegar entre páginas no desmonta `AppShellSidebar` (mismo criterio que
      `AppShellHeader` en `0122-T4`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/app-shell-sidebar.test.tsx`
    - `pnpm test --run src/tests/app/app-shell.test.tsx` (sanity de no regresión sobre la composición sin
      sidebar)
    - `pnpm test --run src/tests/app/app-shell-header.test.tsx` (sanity de no regresión sobre el header)
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - No introducir el estado `collapsed` ni leer `sidebar.defaultCollapsed` en esta tarea.
    - No montar Monaco ni el editor visual.
    - Comprobar accesibilidad de expansión con eventos reales de click, no forzando estado interno del
      componente desde el test.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/sidebar.md`
  - `ai-workflow/docs/app-features/runtime/organization.md`
  - `ai-workflow/docs/app-features/navigation/navigate-actions.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - El sidebar es observable en producción en modo expandido, con expansión/colapso manual de ramas a cualquier
    profundidad, estado activo aplicado y composición correcta junto al header.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - El sidebar funciona end-to-end en modo expandido. Auto-expansión (`0123-T5`), modo rail (`0123-T6`) y editor
    (`0123-T7`/`0123-T8`) quedan pendientes.

---

## Task 0123-T5 — Auto-expansión de ramas ancestro al navegar

- **ID**: 0123-T5
- **Estado**: pending
- **Objetivo**: Cuando la página activa coincide con un `sidebarItem` anidado, expandir automáticamente todas
  sus ramas ancestro (requisito 15), sin colapsar nunca una rama ya expandida manualmente por otra razón (design
  decisión 5: unión, nunca reemplazo).
  - Cambios concretos:
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (ampliación):
      - Añadir un `useEffect` con dependencia en el `pageId` de la página activa (`activePage?.id`) que, en cada
        cambio, ejecuta:
        ```ts
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          activePaths.forEach((path) => next.add(path))
          return next
        })
        ```
        usando el `activePaths` ya calculado en el mismo render vía `computeActiveSidebarItemIds` (`0123-T3`).
        Añadir el path de una hoja activa (que nunca es un disparador) es inofensivo: `expandedPaths` solo se
        consulta para decidir si un disparador de rama muestra sus hijos.
      - No recalcular `expandedPaths` desde cero en ningún punto; no eliminar paths existentes por ninguna
        razón distinta de la interacción manual del usuario (`onToggleExpand`, ya existente desde `0123-T4`).
- **Fuera de alcance**:
  - Modo rail: `0123-T6`.
  - Cualquier persistencia de `expandedPaths` fuera de memoria de sesión (ya cubierto por el punto de montaje
    estable del componente, igual que `0123-T4`).
- **Dependencias**: `0123-T3` y `0123-T4` cerradas.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (ampliación — nuevo `useEffect`)
  - Tests:
    - `src/tests/app/app-shell-sidebar.test.tsx` (ampliación)
  - Documentación:
    - `ai-workflow/docs/app-features/shell/sidebar.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/app/app-shell-sidebar.test.tsx` (ampliación — nuevo `describe` de auto-expansión)
  - **Comportamiento cubierto**:
    - Un `sidebarItem` de tercer nivel cuyo `pageId` coincide con la página inicial visible aparece con sus dos
      ramas ancestro ya expandidas al montar, sin ninguna interacción manual previa.
    - Navegar (vía acción `navigateTo` de otro control, p. ej. un botón de página) hacia una página cuyo
      `sidebarItem` correspondiente está anidado en una rama previamente colapsada expande esa rama
      automáticamente tras la navegación.
    - Una rama expandida manualmente por el usuario, no relacionada con el item activo, permanece expandida tras
      navegar a otra página (no se colapsa nunca automáticamente).
    - Una rama que el usuario había colapsado manualmente, que contiene al nuevo item activo tras navegar, se
      reabre igualmente (la auto-expansión gana sobre el colapso manual previo).
    - Navegar de vuelta a una página cuyo `sidebarItem` ya no está anidado en ninguna rama (o no existe en el
      árbol) no colapsa ninguna rama ya expandida.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/app-shell-sidebar.test.tsx`
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - Verificar navegación real (hash) o el mismo mecanismo ya usado por los tests de `0123-T4`/`0122-T4`, no
      manipulando `expandedPaths` directamente desde el test.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/sidebar.md`
- **Criterios de finalización**:
  - Todos los casos de auto-expansión y de persistencia de expansión manual declarados arriba pasan.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - La navegación mantiene siempre visible el item activo en modo expandido, sin regresión de expansión manual.

---

## Task 0123-T6 — Modo rail: colapso, render icon-only y `SidebarRailFlyout`

- **ID**: 0123-T6
- **Estado**: pending
- **Objetivo**: Completar el modo rail (design decisiones 7, 8, 9): control de colapso dentro del propio
  sidebar, render icon-only con fallback de inicial para items sin `icon`, y un flyout accesible para ramas,
  con expansión inline recursiva dentro del propio panel para profundidades 3+ (sin flyouts anidados en
  cascada — decisión ya cerrada con el usuario).
  - Cambios concretos:
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (ampliación):
      - Nuevo estado local `collapsed: boolean`, inicializado con `sidebar.defaultCollapsed ?? false`.
      - Nuevo control de colapso: `<button type="button" aria-pressed={collapsed}>` en la cabecera del propio
        sidebar (antes de la lista de items), con `aria-label` que refleje la acción disponible (p. ej.
        "Colapsar barra lateral" / "Expandir barra lateral"); al click, invierte `collapsed`.
      - `getAppShellSidebarClassName({ collapsed })` (ya definida en `0123-T4`) pasa a recibir el valor real,
        alternando entre `w-64` (expandido) y `w-16` (rail).
      - Cuando `collapsed === true`, cada item de **nivel raíz** cambia su render:
        - Hoja: solo icono (o fallback, ver abajo), sin texto de `label` visible; `aria-label` y atributo
          `title` con el `label` resuelto completo (tooltip accesible nativo, sin componente de tooltip
          dedicado).
        - Disparador de rama: solo icono/fallback, `aria-haspopup="menu"`, `aria-expanded` reflejando si su
          propio flyout está abierto (estado local `open` por trigger, un booleano por item de nivel raíz con
          `children`, mismo patrón que `MenuItemDropdown`). Al click, abre/cierra `SidebarRailFlyout` anclado a
          ese trigger.
      - Fallback de icono ausente (design decisión 8): cuando un item (en cualquier profundidad, dentro de la
        barra colapsada o dentro de un flyout) no declara `icon`, renderizar la primera letra en mayúscula del
        `label` ya resuelto como glifo, en el lugar del icono, conservando `label` completo como nombre
        accesible. Implementar como pequeño helper compartido (p. ej. `resolveSidebarItemGlyph(item, state)`)
        usado tanto por el render icon-only de nivel raíz como por `SidebarRailFlyout`.
      - Reutiliza la clase `getAppShellSidebarItemClassName`/`getAppShellSidebarTriggerClassName` ya existentes,
        ampliando `runtime-node-styling-app-shell-sidebar.ts` con variantes o parámetros para el modo icon-only
        si las clases actuales no cubren ese caso (p. ej. ocultar el texto del label, centrar el icono).
    - `src/runtime/runtime-shell/sidebar-rail-flyout.tsx` (nuevo):
      - Props: el `sidebarItem` disparador (con `children`), su `path`, `activePaths`, `expandedPaths` y
        `onToggleExpand` (las mismas piezas de estado ya usadas por el modo expandido en `0123-T4`/`0123-T5` —
        un único origen de verdad para "qué ramas están expandidas", tanto en la barra expandida como dentro de
        un flyout).
      - Reutiliza el mismo patrón de accesibilidad que `MenuItemDropdown` (`0122`, decisión 6): `role="menu"`,
        cierre por click-fuera (listener `mousedown` sobre el contenedor trigger+panel) y por `Esc` (con
        retorno de foco al trigger), foco al primer item visible al abrir, `overflow-y-auto` en el panel.
      - Dentro del panel, cada hijo del item se renderiza igual que en modo expandido: hoja navegable (cierra
        el flyout al seleccionarla), o disparador de rama que se expande **inline dentro del mismo panel**
        (usando `expandedPaths`/`onToggleExpand` compartidos) en vez de abrir un segundo flyout — sin importar
        la profundidad restante del árbol (decisión ya cerrada con el usuario, recogida en design decisión 7).
      - No es una reutilización literal de `MenuItemDropdown` (asume la forma fija de `menuItem`/
        `menuItemChild`), pero replica su mismo patrón de interacción sobre `sidebarItem`.
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts` (ampliación): clases del panel de flyout (paneles
      `absolute`, `overflow-y-auto`) y del glifo de fallback (inicial de label).
- **Fuera de alcance**:
  - Cualquier cambio a `MenuItemDropdown`/`shell.header`.
  - Comportamiento responsive/mobile (fuera de spec).
  - Sección "Shell" del editor visual: `0123-T7`/`0123-T8`.
- **Dependencias**: `0123-T4` cerrada (estructura base, `expandedPaths`/`onToggleExpand`, helpers de estilo con
  la firma `{ collapsed }` ya definida).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-shell/app-shell-sidebar.tsx` (ampliación: `collapsed`, control de colapso, render
      icon-only raíz)
    - `src/runtime/runtime-shell/sidebar-rail-flyout.tsx` (nuevo)
    - `src/runtime/runtime-node-styling-app-shell-sidebar.ts` (ampliación)
    - `src/runtime/runtime-shell/index.ts` (ampliación — re-export si aplica)
  - Tests:
    - `src/tests/app/app-shell-sidebar-rail.test.tsx` (nuevo)
  - Documentación:
    - `ai-workflow/docs/app-features/shell/sidebar.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/app/app-shell-sidebar-rail.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - `shell.sidebar.defaultCollapsed: true` arranca la sesión con el sidebar ya en modo rail (`w-16`, labels no
      visibles como texto).
    - El control de colapso alterna `w-64`/`w-16` y actualiza su propio `aria-pressed`/`aria-label`.
    - Un `sidebarItem` hoja sin `icon`, en modo rail, muestra la inicial de su `label` como glifo y expone el
      `label` completo vía `aria-label`/`title`.
    - Un `sidebarItem` con `icon`, en modo rail, muestra el icono (no la inicial).
    - Click sobre el icono de un disparador de rama en modo rail abre `SidebarRailFlyout` con `role="menu"` y
      `aria-expanded="true"` en el trigger; los hijos visibles (filtrados por `visibility`) aparecen en el
      panel.
    - `Esc` con el flyout abierto lo cierra y devuelve el foco al trigger; click fuera del trigger+panel lo
      cierra; seleccionar una hoja del flyout lo cierra y dispara su navegación/acción.
    - Un hijo dentro del flyout que a su vez tiene `children` (profundidad 3+) se expande **inline dentro del
      mismo panel** al hacer click, sin abrir un segundo flyout ni cerrar el primero.
    - Navegar a otra página con el sidebar en modo rail mantiene el modo rail tras la navegación (persistencia
      en memoria de sesión, requisito 18).
    - Regresión: en modo expandido (`collapsed: false`), el comportamiento de `0123-T4`/`0123-T5` no cambia.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/app-shell-sidebar-rail.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-sidebar.test.tsx` (sanity de no regresión sobre modo expandido)
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - No añadir una librería externa de posicionamiento de popovers (`@floating-ui`/`radix` siguen fuera de
      alcance).
    - Comprobar teclado con eventos reales (`fireEvent.keyDown`/`click`), no forzando foco manual desde el test.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/sidebar.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - Todos los criterios de aceptación de spec sobre modo rail, flyout y fallback de icono están cubiertos por
    tests y en verde.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - El sidebar es funcional end-to-end (modo expandido + modo rail + flyout) en producción. Queda pendiente
    únicamente el editor visual (`0123-T7`/`0123-T8`).

---

## Task 0123-T7 — Editor visual: toggle "Sidebar activo" + scaffold vacío

- **ID**: 0123-T7
- **Estado**: pending
- **Objetivo**: Añadir el toggle "Sidebar activo" a `ShellConfigPanel`, junto al toggle "Header activo" ya
  existente, que crea `shell.sidebar: { items: [] }` al activarse. Esta tarea corrige además un efecto colateral
  ya presente en el toggle de header, expuesto por la introducción de una segunda subsección de `shell`.
  - **Corrección requerida — `handleToggleHeader` borra hoy todo `shell`, no solo `header`**:
    `shell-config-panel.tsx` implementa hoy:
    ```ts
    function handleToggleHeader(nextActive: boolean) {
      onCommitShellMutation(() => (nextActive ? { header: {} } : undefined))
    }
    ```
    Desactivar el header sustituye **todo** el objeto `shell` por `undefined`, no solo la clave `header`. Esto
    era inocuo mientras `header` era la única clave posible de `shell` (`0122`), pero con `sidebar` como hermano
    aditivo se convierte en una regresión real: desactivar el header borraría silenciosamente un
    `shell.sidebar` ya configurado. Corregir a:
    ```ts
    function commitShellSectionToggle(section: 'header' | 'sidebar', nextActive: boolean) {
      onCommitShellMutation((prevShell) => {
        const next = { ...(prevShell ?? {}) }
        if (nextActive) {
          next[section] = section === 'header' ? {} : { items: [] }
        } else {
          delete next[section]
        }
        return Object.keys(next).length === 0 ? undefined : next
      })
    }
    ```
    (nombres de variables orientativos; mantener el resto del pipeline de commit sin cambios). Desactivar una
    sección conserva la otra si está activa; si ambas quedan desactivadas, el resultado es `shell: undefined`
    (mismo comportamiento observable que hoy cuando solo existía `header`).
  - Cambios concretos:
    - `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` (ampliación):
      - `getSidebarItemJsonSchema()` (`toJSONSchema(sidebarItemSchema)`, cacheado a nivel de módulo, mismo
        patrón que `getMenuItemJsonSchema`).
      - `getShellSidebarJsonSchema()` (`toJSONSchema(shellSidebarSchema)`, cacheado igual).
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (ampliación):
      - Reemplazar `handleToggleHeader` por la función corregida de arriba (reutilizada también para el toggle
        de sidebar).
      - Añadir `sidebar = shell?.sidebar`, `sidebarActive = sidebar !== undefined`.
      - Añadir un segundo `<BooleanPropertyField label="Sidebar activo" .../>` justo debajo del de header,
        cableado a `commitShellSectionToggle('sidebar', nextActive)`.
      - Cuando `sidebarActive`, renderizar un contenedor propio de la sección Sidebar (fieldset con su propio
        `legend`, análogo al de "Menú" del header) que en esta tarea solo monta el scaffold vacío: sin items
        aún, sin control "Añadir elemento de sidebar" — eso llega en `0123-T8`. Deja el punto de montaje listo
        (p. ej. un `<SidebarItemListEditor items={sidebar.items ?? []} onCommitItems={...} />` ya importado pero
        cuya implementación real es la de `0123-T8`; si se prefiere no depender de un componente aún no
        existente, dejar en esta tarea solo el toggle + `legend` vacío y posponer el import a `0123-T8` —
        decidir en implementación sin afectar el criterio de aceptación de esta tarea, que es únicamente sobre
        el toggle).
  - No introducir en esta tarea ningún control de alta/edición/borrado/reordenación de `sidebarItem`: eso es
    `0123-T8`.
- **Fuera de alcance**:
  - `SidebarItemListEditor` recursivo y su DnD: `0123-T8`.
  - Cualquier cambio al render en producción (`0123-T4`/`0123-T5`/`0123-T6`).
- **Dependencias**: `0123-T4` cerrada (previsualización en vivo del sidebar activo, mismo criterio que `0122-T5`
  respecto a `0122-T4`).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` (ampliación)
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (ampliación: toggle + corrección de
      `handleToggleHeader`)
  - Tests:
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - Activar "Sidebar activo" desde `sin shell` produce `shell: { sidebar: { items: [] } }`.
    - Activar "Sidebar activo" con `shell.header` ya activo produce `shell: { header: {...}, sidebar: { items:
      [] } }` sin alterar el `header` existente.
    - Desactivar "Sidebar activo" con solo sidebar activo produce ausencia total de `shell` (`shell: undefined`
      en el config resultante, equivalente a no declararlo).
    - Desactivar "Sidebar activo" con `header` también activo conserva `shell.header` intacto y solo elimina la
      clave `sidebar`.
    - **Regresión del bug corregido**: desactivar "Header activo" con `shell.sidebar` ya configurado (con items
      no vacíos) conserva `shell.sidebar` intacto — antes de esta tarea, este caso borraba todo `shell`.
    - Desactivar "Header activo" con `sidebar` no activo reproduce el comportamiento ya existente (`shell:
      undefined`).
    - El toggle de sidebar coexiste con el resto de campos ya existentes del panel (`logo`, `title`, `menu`,
      `actions`) sin efectos secundarios sobre ellos.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - No modificar el pipeline de commit (`onCommitShellMutation`) ni el patrón de `pendingRejections` ya
      existente.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - El toggle "Sidebar activo" funciona de forma independiente del de "Header activo" en ambas direcciones,
    incluida la corrección de la regresión del borrado cruzado.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - El toggle existe y es correcto; el editor aún no permite gestionar `sidebarItem` (`0123-T8`).

---

## Task 0123-T8 — Editor visual: `SidebarItemListEditor` recursivo

- **ID**: 0123-T8
- **Estado**: pending
- **Objetivo**: Editor recursivo genuino (a diferencia de los dos componentes fijos de header,
  `ShellMenuListEditor`/`ShellMenuChildrenListEditor` — design decisión 10) para alta, edición, borrado y
  reordenación de `sidebarItem` a cualquier profundidad, integrado en `ShellConfigPanel` bajo el toggle de
  `0123-T7`.
  - Cambios concretos:
    - `src/dev-runtime/shell-config-panel/sidebar-item-mode.ts` (nuevo):
      - Reutiliza el tipo `MenuItemMode` y el objeto `MODE_LABELS` ya exportados por `menu-item-mode.ts` (mismos
        cuatro modos, mismas etiquetas — sin las restricciones de tipo que sí impiden reutilizar los schemas
        Zod).
      - `computeSidebarItemMode(item: SidebarItemConfig): MenuItemMode` (misma lógica que
        `computeMenuItemMode`, adaptada al tipo `SidebarItemConfig`).
      - Constantes propias `NEW_ROOT_ITEM_LABEL`/`NEW_CHILD_LABEL` (mismo valor `'Nuevo elemento'`).
    - `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx` (nuevo):
      - Análogo a `menu-item-fields-editor.tsx`: campos `label`, `icon`, selector de modo (`none`/`href`/
        `action`/`children`, reutilizando `DiscriminatedUnionPropertyField` para `action` igual que el header),
        `visibility` (mismo editor de condición simple/grupo ya usado por el panel de propiedades del canvas).
      - Usa `getSidebarItemJsonSchema()` de `0123-T7` para resolver los sub-schemas de `action`/`visibility`.
      - A diferencia del header, no hay parámetro `allowChildren` fijo por profundidad: cualquier
        `sidebarItem`, a cualquier nivel, puede pasar a modo "Con hijos".
    - `src/dev-runtime/shell-config-panel/sidebar-item-list-editor.tsx` (nuevo):
      - `SidebarItemListEditor({ items, path, onCommitItems })`: renderiza la lista de un único nivel (raíz o
        `children` de un padre concreto) con alta/edición/borrado usando `SidebarItemFieldsEditor` por fila, y
        reordenación con `ShellDndSortableList`/`ShellDndSortableRow` (reutilizados sin cambios desde
        `shell-config-panel-dnd.tsx` — ya son genéricos por índice, no acoplados a `menuItem`), un
        `dndContextId` derivado de `path` (p. ej. `shell-sidebar-root` para la raíz, `shell-sidebar-${path}`
        para cualquier nivel anidado).
      - Cuando una fila está en modo "Con hijos" (`item.children !== undefined`), renderiza **siempre** de forma
        incondicional (sin toggle propio de "expandir para editar") un `SidebarItemListEditor` anidado para sus
        `children`, con su propio `path` extendido y su propio `dndContextId` — el propio componente se
        renderiza a sí mismo. Mismo convenio que el header (la sublista de `children` ya se muestra
        incondicionalmente cuando existe), extendido a profundidad arbitraria.
      - "Añadir" en cualquier nivel crea un nuevo `sidebarItem` con `{ label: NEW_ROOT_ITEM_LABEL, href: '' }`
        (mismo convenio de semilla válida que el header). "Quitar" elimina la fila de su propio nivel.
      - Reordenar con DnD nunca mueve un item entre niveles distintos (mismo diseño estructural ya usado por
        header: un `DndContext` por nivel, por lo que un cross-level drop no es observable).
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (ampliación): montar
      `<SidebarItemListEditor items={sidebar.items ?? []} path="root" onCommitItems={commitSidebarItems} />`
      dentro de la sección Sidebar ya scaffoldeada en `0123-T7`, con `commitSidebarItems` parcheando
      `shell.sidebar.items` de forma análoga a `commitMenu` del header (conservando `defaultCollapsed` si ya
      existía).
- **Fuera de alcance**:
  - Cualquier cambio al render en producción.
  - Deshacer/rehacer o selección múltiple (mismos límites ya documentados para el resto del editor).
- **Dependencias**: `0123-T7` cerrada.
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/sidebar-item-mode.ts` (nuevo)
    - `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx` (nuevo)
    - `src/dev-runtime/shell-config-panel/sidebar-item-list-editor.tsx` (nuevo)
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (ampliación: montaje del editor recursivo)
  - Tests:
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (nuevo)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación — integración/montaje)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
    - `ai-workflow/docs/app-features/shell/sidebar.md`
    - `ai-workflow/docs/test-index.md`
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (nuevo) — comportamiento propio del editor
      recursivo, aislado de `ShellConfigPanel`.
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación) — montaje del editor dentro del panel y
      un commit end-to-end.
  - **Comportamiento cubierto**:
    - Alta de un item en la raíz produce un `sidebarItem` válido (`href: ''`) añadido a `shell.sidebar.items`.
    - Editar `label`/`icon`/modo (`href`/`action`/`children`)/`visibility` de un item raíz actualiza el config
      correctamente.
    - Cambiar el modo de un item a "Con hijos" reemplaza su variante anterior por `children: [nuevo item]` y
      muestra inmediatamente la sublista anidada para ese padre.
    - Añadir un segundo, tercer y cuarto nivel de anidamiento (hijo de hijo de hijo) mediante el mismo mecanismo
      de "Con hijos" produce un árbol de cuatro niveles válido — prueba explícita de recursión real en el
      editor.
    - Borrar un item de un nivel anidado no afecta a los items hermanos de ese mismo nivel ni a los de otros
      niveles.
    - Reordenar por DnD dentro de la raíz persiste el nuevo orden; reordenar por DnD dentro de los `children`
      de un padre concreto persiste el nuevo orden de ese `children` sin afectar a la raíz ni a otros padres.
    - Un intento de arrastrar un item entre la raíz y un nivel de `children` (o entre dos padres distintos) no
      produce cambio observable (mismo criterio estructural que el header).
    - Un commit rechazado por validación (p. ej. `label` en blanco) conserva el valor introducido y muestra el
      aviso `role="alert"` correspondiente, sin revertir en silencio.
    - Integración: activar el toggle de `0123-T7`, añadir un item con `action.navigateTo` y ver el sidebar real
      renderizado con ese item (previsualización en vivo, mismo criterio que `0122-T5`).
    - Commit: un cambio del editor de sidebar parchea únicamente la clave `shell` (dentro de ella,
      `sidebar.items`), dejando intacto el resto del documento (`layout`, `api`, `initialPage`, `preloads`,
      `tokens`, `translations`, `shell.header`).
    - Regresión: los tests ya vigentes de `ShellMenuListEditor`/`ShellMenuChildrenListEditor` (header) siguen
      pasando sin cambios.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
    - `pnpm test` (al cierre)
  - **Restricciones**:
    - Reutilizar `ShellDndSortableList`/`ShellDndSortableRow` de `shell-config-panel-dnd.tsx` sin modificarlos;
      si su forma actual no basta para un `dndContextId` derivado de un `path` recursivo, generalizar solo la
      construcción del id desde el componente llamador, no la API interna de esos dos componentes.
    - No añadir dependencias externas nuevas (`@dnd-kit/core` ya instalado).
    - No introducir un toggle de "expandir para editar" en el formulario: la sublista de `children` se muestra
      siempre que exista, igual que en el header.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
  - `ai-workflow/docs/app-features/shell/sidebar.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - Un usuario puede dar de alta, editar, borrar y reordenar `sidebarItem` a cualquier profundidad desde el
    formulario, viendo el resultado reflejado en el sidebar real.
  - Todos los criterios de aceptación de spec sobre el editor visual de sidebar están cubiertos por tests y en
    verde.
  - `pnpm test` (suite completa) en verde sin bajar el 80% de cobertura.
- **Cierre de implementación**:
  - La feature queda completa end-to-end: contrato + validación + render (expandido y rail) + editor visual
    recursivo. Lista para la pasada documental posterior con `update-app-documentation`.
