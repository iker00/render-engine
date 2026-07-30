# Tasks — 0122 — Shell de aplicación con cabecera configurable

Contrato de ejecución para la feature. Alcance: nuevo bloque raíz opcional `shell` con `shell.header` configurable
(logo, título, menú con un nivel de desplegables y acciones), persistente entre páginas, y sección dedicada "Shell"
en el editor visual. Retrocompatibilidad total: sin `shell` o con `shell.header` ausente/vacío, el runtime se
comporta exactamente igual que antes.

Se divide en cinco tareas secuenciales que respetan las fronteras arquitectónicas de `src/config/`, `src/runtime/`,
`src/app/` y `src/dev-runtime/`:

1. **T1** — Contrato de tipos y schemas Zod para `shell` (raíz opcional, `header`, `menuItem`/`menuItemChild`,
   subconjunto de `actions`) y comprobaciones estructurales de shape (`href`/`action`/`children` mutuamente
   excluyentes) en `src/config/`.
2. **T2** — Módulo dedicado `validate-shell.ts` con las validaciones cruzadas (`pageId` en `pages`, `visibility`
   sin `item.*`, `link`/`button` de `actions` con contratos ya vigentes) y su enganche desde
   `validate-runtime-config`.
3. **T3** — Utilidad pura `computeActiveMenuItemIds` que deriva el conjunto de items activos a partir de
   `shell.header.menu` y del `pageId` actualmente visible, incluyendo padres de un hijo activo.
4. **T4** — Componente `AppShellHeader` en `src/runtime/runtime-shell/` que renderiza logo/título/menu leaves/actions
   con estado activo aplicado, más el subcomponente `MenuItemDropdown` con accesibilidad completa (aria, teclado,
   click-fuera, Esc), montado una única vez en la composición raíz de `src/app/` (fuera del `layout-renderer`).
5. **T5** — Sección "Shell" del editor visual: quinto botón de dominio en la barra flotante, `ShellConfigPanel` como
   formulario dedicado (no canvas), reordenación DnD por nivel con `SortableContext` anidados, y commit por parcheo
   de la clave `shell` sobre el último texto crudo válido.

Cada tarea es compilable y testeable de forma aislada. T3 y T4 dejan el comportamiento observable end-to-end desde
un config real; T5 lo hace editable desde el editor visual. T1/T2 dejan contrato y validación listos pero inertes
hasta que T4 los materializa.

## Siguiente tarea a escoger

`0122-T1` — habilita el contrato de tipos y schemas para el resto del plan. `0122-T2` depende de que los schemas
de shell ya existan y estén exportados. `0122-T3` no toca contrato (solo lee tipos) y podría empezar en paralelo a
`0122-T2`, pero se implementa después siguiendo el orden secuencial. `0122-T4` no debe iniciarse hasta cerrar
`0122-T1`, `0122-T2` y `0122-T3`: necesita contrato validado, referencias resueltas contra `pages` y el helper de
estado activo. `0122-T5` cierra el ciclo del editor y depende de `0122-T4` para poder previsualizar cambios.

---

## Task 0122-T1 — Contrato de tipos y schemas Zod para `shell`

- **ID**: 0122-T1
- **Estado**: pending
- **Objetivo**: Añadir el nuevo bloque raíz opcional `shell` (hoy solo con `header`) al contrato de tipos y a los
  schemas Zod del runtime config. Incluye la definición de tipos `ShellConfig`, `ShellHeaderConfig`,
  `MenuItemConfig` (raíz, con `children?: MenuItemChildConfig[]`) y `MenuItemChildConfig` (sin `children`),
  reutilizando literalmente los schemas Zod ya exportados de acción de navegación
  (`navigateToButtonActionSchema`, `goBackButtonActionSchema`) y el contrato transversal de `visibility`. Las
  restricciones de shape mutuamente excluyentes del `menuItem` (`href` XOR `action` XOR `children`, con `label`
  siempre obligatorio) viven en el propio schema Zod vía `superRefine` para que se detecten en el parseo Zod y no
  se dupliquen en `validate-shell.ts`. `shell.header.actions` acepta únicamente nodos de tipo `link` o `button`
  reutilizando sus schemas Zod ya existentes vía un `z.discriminatedUnion('type', [...])` restringido a esos dos
  tipos.
  - Cambios concretos:
    - `src/config/runtime-config-types.ts`:
      - Añadir los tipos `ShellConfig`, `ShellHeaderConfig`, `ShellHeaderLogoConfig` (mismo shape público del prop
        `image`), `MenuItemConfig`, `MenuItemChildConfig` y `ShellHeaderActionNode` (unión discriminada
        `LinkLayoutNode | ButtonLayoutNode`).
      - Añadir `shell?: ShellConfig` a la interfaz `RuntimeConfig` (bloque raíz opcional, hermano de `api`,
        `pages`, `initialPage`, `preloads`, `tokens`, `translations`).
    - `src/config/runtime-config-zod.ts`:
      - Definir un helper Zod interno con los campos base compartidos de `menuItem` (`label` obligatorio,
        `icon?`, `visibility?`, `href?`, `action?`) y factorizarlo entre `menuItemSchema` (raíz) y
        `menuItemChildSchema` (sin `children`). No exponer `menuItemChildSchema` fuera del módulo salvo lo
        estrictamente necesario para los tests unitarios de shape.
      - `menuItemSchema` añade `children?: menuItemChildSchema.array().nonempty().optional()` sobre la base
        común. `menuItemChildSchema` **no** declara `children` (invariante de tipo: máximo un nivel).
      - Aplicar `superRefine` sobre ambos schemas con las reglas:
        - si `children` está presente y (`href` o `action`) también, emitir `code: 'custom'` con `path:
          ['children']` o `['href']`/`['action']` según el campo detectado y mensaje
          `Menu items with children cannot declare href or action.`
        - si ninguno de `href`, `action`, `children` está presente, emitir `code: 'custom'` con
          `path: []` y mensaje `Menu items must declare either href, action or children.`
        - si `href` y `action` están presentes simultáneamente, emitir `code: 'custom'` con `path: ['href']` y
          mensaje `Menu items cannot declare both href and action.`
      - `href` reutiliza el mismo shape que `link.props.href` (literal o referencia dinámica completa) del
        schema Zod ya existente. `action` reutiliza literalmente
        `z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema])` sin
        reimportarlas por copia.
      - `shellHeaderActionNodeSchema = z.discriminatedUnion('type', [linkNodeSchema, buttonNodeSchema])`.
        Reusar exactamente esos schemas ya definidos en el mismo módulo; no duplicarlos.
      - `shellHeaderSchema = z.object({ logo?, title?, menu?, actions? })` con todos los campos opcionales
        independientes.
      - `shellSchema = z.object({ header: shellHeaderSchema.optional() })` con `.strict()` para rechazar claves
        futuras desconocidas (p. ej. un `sidebar` que aún no existe). Nota: reforzará "aditivo puro" y hará
        explícito que el bloque `shell` es cerrado hoy.
      - `logo` reutiliza el shape público de `image.props` ya validado (props del nodo `image` sin envoltura de
        `type`). Extraer del `imageNodeSchema` existente un sub-schema reusable `imagePropsSchema` si aún no
        existe; en caso contrario, referenciar el schema ya expuesto sin duplicarlo.
      - `title` acepta un string (literal, referencia dinámica completa o interpolación `{{...}}`), mismo shape
        de texto que `link.props.label` usa hoy.
    - `src/config/runtime-config-root-zod.ts`:
      - Añadir `shell: shellSchema.optional()` al objeto raíz, junto a `translations`, `tokens` y `preloads`.
      - Confirmar que el schema raíz completo no rechaza la presencia de `shell` ausente, `shell: {}`,
        `shell: { header: {} }` ni `shell: { header: { logo: ..., title: ..., menu: [], actions: [] } }`.
- **Fuera de alcance**:
  - Validación cruzada (existencia de `pageId`, resolución de referencias `visibility`, validación estructural
    interna de cada nodo `link`/`button` en `actions`): queda para `0122-T2`.
  - Cualquier render del shell o helper de estado activo: queda para `0122-T3`/`0122-T4`.
  - Sección "Shell" del editor visual: queda para `0122-T5`.
  - Actualizar documentación funcional: queda para `update-app-documentation` posterior.
- **Dependencias**: ninguna. Primera tarea del plan.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` (nuevos tipos `ShellConfig`, `ShellHeaderConfig`,
      `ShellHeaderLogoConfig`, `MenuItemConfig`, `MenuItemChildConfig`, `ShellHeaderActionNode`; `shell?` en
      `RuntimeConfig`)
    - `src/config/runtime-config-zod.ts` (nuevos schemas `menuItemSchema`, `menuItemChildSchema`,
      `shellHeaderActionNodeSchema`, `shellHeaderSchema`, `shellSchema`; posible extracción de
      `imagePropsSchema` si no existe ya reutilizable)
    - `src/config/runtime-config-root-zod.ts` (bloque raíz `shell` opcional)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-shell.test.ts` (nuevo)
  - Documentación: revisar tras el cierre de implementación (ver "Documentación afectada") — no ejecutar aquí.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-shell.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - Aceptación: config sin bloque `shell` valida sin error (retrocompat total).
    - Aceptación: `shell: {}` valida sin error.
    - Aceptación: `shell: { header: {} }` valida sin error.
    - Aceptación: `shell.header` solo con `logo` (props válidos del nodo `image`) valida sin error.
    - Aceptación: `shell.header` solo con `title` (literal, referencia completa y con interpolación `{{...}}`)
      valida sin error.
    - Aceptación: `shell.header` solo con `menu: []` valida sin error.
    - Aceptación: `shell.header` solo con `actions: []` valida sin error.
    - Aceptación: `shell.header` con las cuatro claves declaradas y no vacías valida sin error.
    - Aceptación: `menuItem` con `label` + `href` literal valida sin error.
    - Aceptación: `menuItem` con `label` + `action` (`navigateTo` con `pageId`, `goBack`) valida sin error.
    - Aceptación: `menuItem` con `label` + `children: [menuItemChild1, menuItemChild2]` (cada hijo con
      `href`/`action` propio) valida sin error.
    - Aceptación: `menuItem` con `icon` (string arbitrario) valida sin error.
    - Aceptación: `menuItem` con `visibility` (contrato transversal) valida sin error.
    - Aceptación: `shell.header.actions` con un `link` válido valida sin error.
    - Aceptación: `shell.header.actions` con un `button` válido (incluida acción `executeOperation`) valida
      sin error.
    - Aceptación: `shell.header.actions` con un `button` cuya acción sea `executeOperation` (con
      `operationName` referenciado en `api`) valida sin error a nivel de shape.
    - Rechazo: `menuItem` sin `label` se rechaza con error Zod sobre `label`.
    - Rechazo: `menuItem` con `href` **y** `action` se rechaza con `code: 'custom'` y mensaje
      `Menu items cannot declare both href and action.` sobre `path: ['href']`.
    - Rechazo: `menuItem` sin `href`, sin `action` y sin `children` se rechaza con `code: 'custom'` y mensaje
      `Menu items must declare either href, action or children.` sobre `path: []`.
    - Rechazo: `menuItem` con `children` **y** `href` se rechaza con `code: 'custom'` y mensaje
      `Menu items with children cannot declare href or action.`
    - Rechazo: `menuItem` con `children` **y** `action` se rechaza con el mismo mensaje anterior.
    - Rechazo: `menuItem.children: []` (array vacío declarado explícitamente) se rechaza vía la restricción
      `.nonempty()` del schema.
    - Rechazo: `menuItemChild` que declare a su vez `children` se rechaza a nivel Zod (el tipo `menuItemChild`
      no acepta esa clave).
    - Rechazo: `shell.header.actions` con un elemento cuyo `type` es distinto de `link`/`button`
      (p. ej. `table`, `container`) se rechaza por la unión discriminada del schema.
    - Rechazo: `shell` con una clave desconocida (p. ej. `shell: { sidebar: {} }`) se rechaza por `.strict()`
      del `shellSchema`.
    - Regresión: tests ya existentes de `runtime-config-root-zod` (con y sin `translations`, `tokens`,
      `preloads`) siguen pasando sin cambios de aserciones.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts` (sanity de no regresión
      sobre el schema raíz)
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - No introducir snapshots.
    - No duplicar los schemas de acción (`navigateToButtonActionSchema`, `goBackButtonActionSchema`) ni los
      de `link`/`button`: importarlos y reutilizarlos.
    - No exponer `menuItemChildSchema` fuera de `runtime-config-zod.ts` salvo lo estrictamente necesario para
      los tests de tipos (idealmente, cero exports adicionales — los tests validan el shape a través del
      schema raíz).
    - Si al reutilizar el shape de `image.props` se opta por extraer un `imagePropsSchema` compartido, no
      cambiar la semántica ya validada de `imageNodeSchema` (los tests ya existentes de imagen deben pasar
      sin tocar sus aserciones).
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/structure.md` — declarar el nuevo bloque raíz opcional `shell` en
    la sección "Bloques raíz".
  - `ai-workflow/docs/app-features/shell/index.md` (nuevo área) — visión general del bloque `shell` y sus
    secciones.
  - `ai-workflow/docs/app-features/shell/header.md` (nuevo) — contrato completo de `shell.header`, `menuItem`
    y `menuItemChild`.
  - `ai-workflow/docs/app-features/index.md` — enlazar el nuevo área `shell/`.
- **Criterios de finalización**:
  - `RuntimeConfig` incluye `shell?: ShellConfig` con los tipos anidados declarados y exportados desde
    `runtime-config-types.ts`.
  - `runtime-config-root-zod` acepta cualquier config del código de aceptación descrito en tests y rechaza
    todos los casos de rechazo con el error Zod exacto o el mensaje declarado.
  - `menuItemChildSchema` no admite `children`; garantizado por tipo Zod, no por refine posterior.
  - Todos los tests nuevos de `runtime-config-validation-shell.test.ts` en verde.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - Tipos, schemas y comprobaciones de shape del `shell` están en el árbol; los tests declarados arriba pasan;
    la suite global sigue en verde. Ningún consumidor de runtime lee todavía `shell` (queda inerte hasta
    `0122-T4`).

---

## Task 0122-T2 — Módulo `validate-shell.ts` con validación cruzada

- **ID**: 0122-T2
- **Estado**: pending
- **Objetivo**: Crear el módulo dedicado `src/config/validate-shell.ts`, orquestado desde
  `validate-runtime-config.ts`, que ejecuta las validaciones cruzadas de `shell` que no puede resolver Zod:
  existencia de `pageId` referenciado por `menuItem.action.navigateTo.pageId` (raíz o dentro de `children`) en
  `pages`; validez de `menuItem.visibility` contra las superficies transversales estándar (`forms.*`,
  `queries.*`, `params.*`, sin `item.*`); y validez estructural interna de cada `link`/`button` declarado en
  `shell.header.actions` reutilizando los cross-refs ya vigentes para esos nodos (existencia de `pageId`,
  `operationName`, `formId`/`modalId` según el caso). Genera sus propios mensajes con prefijo `Shell
  configuration is invalid at "shell.header..."` (formato distinto de `Page "{pageId}" has an invalid layout
  at ...`, como fija el design).
  - Cambios concretos:
    - `src/config/validate-shell.ts` (nuevo):
      - Export principal: `validateShellConfig(config: unknown, pageIds: readonly string[], apiOperationNames:
        readonly string[]): RuntimeConfigValidationResult | null` (mismo estilo que otros validadores del
        módulo).
      - Recibe la config ya parseada por Zod (así garantiza que `shell` cumple el shape de `0122-T1`) y las
        superficies ya extraídas de `pages` y `api` que necesita para los cross-refs.
      - Recorre `shell.header.menu` recursivamente (raíz + un único nivel de `children` gracias a la garantía
        de tipo de `0122-T1`), acumulando el `path` en formato `shell.header.menu[i]` /
        `shell.header.menu[i].children[j]`.
      - Por cada `menuItem` con `action.type === 'navigateTo'` comprueba que su `pageId` existe en `pageIds`; si
        no, devuelve `enrichedInvalidLayout` (o el helper equivalente ya disponible) con `code:
        'invalid-layout'`, ruta `${basePath}.action.pageId` y mensaje `Shell configuration is invalid at
        "${basePath}.action.pageId": pageId "..." is not declared in "pages".`
      - Por cada `menuItem.visibility` presente valida las referencias reutilizando la lógica ya usada por
        `validateVisibility` (mismo parseo de operadores y superficies), pero:
        - construye los mensajes con el prefijo `Shell configuration is invalid at "${basePath}.visibility..."`
          en vez del formato de página;
        - rechaza cualquier referencia a `item.*` (no aplica en shell) con mensaje explícito `Shell menu items
          do not support item.* references.`
      - Por cada entrada de `shell.header.actions[i]` valida:
        - si `type === 'link'`, aplica las mismas cross-checks estructurales ya vigentes para el nodo `link`
          (existencia de `pageId` para `action.navigateTo`, validez de `href`, exclusión de acciones no
          soportadas). Reusa las funciones puras ya existentes (o extrae subhelpers puros si están hoy
          acopladas a un `pageId` de página) sin refactorizar
          `validateRuntimeUiAction`/`validateVisibility`. Los mensajes se emiten con el prefijo `Shell
          configuration is invalid at "shell.header.actions[${i}]..."`.
        - si `type === 'button'`, aplica las mismas cross-checks ya vigentes para `button` incluyendo la
          existencia de `operationName` en `apiOperationNames` para `executeOperation`/`executeOperations`,
          `pageId` para `navigateTo`, y `formId`/`modalId` cuando corresponda. Mismo prefijo de mensaje.
        - la validez de `visibility` en el propio nodo `link`/`button` de `actions` se resuelve con la misma
          semántica del punto anterior (sin `item.*`, prefijo de shell).
      - Devuelve el primer error encontrado siguiendo el mismo patrón "cortocircuito" del resto de validadores
        del módulo (no colecciona todos, igual que hoy).
      - Si `shell` no está declarado o `shell.header` no está, devuelve `null` sin recorrer nada más.
    - `src/config/validate-runtime-config.ts`:
      - Añadir la llamada a `validateShellConfig` inmediatamente después de haber calculado los `pageIds` y los
        `apiOperationNames` (superficies que ya se calculan hoy para otros validadores) y antes de devolver
        el resultado global. Si devuelve un error, propagarlo con el mismo mecanismo que el resto de
        validadores del módulo.
    - Si al implementar T2 se detecta que alguna función interna de `validate-actions-visibility.ts` está
      acoplada a un `pageId` de página cuando podría ser puramente parametrizada por prefijo/superficies
      admitidas, **no refactorizarla en esta tarea**: extraer localmente en `validate-shell.ts` una versión
      con la misma lógica pero mensajes propios y superficies sin `item.*`. El refactor deseable queda anotado
      en el design (decisión 4) y se abordará cuando aparezca un tercer consumidor (`sidebar`).
- **Fuera de alcance**:
  - Cualquier render del shell o helper de estado activo: queda para `0122-T3`/`0122-T4`.
  - Sección "Shell" del editor visual: queda para `0122-T5`.
  - Refactor de `validateRuntimeUiAction`/`validateVisibility` para parametrizarlos por contexto/prefijo:
    explícitamente descartado en design (decisión 4).
  - Actualizar documentación funcional: queda para `update-app-documentation` posterior.
- **Dependencias**: `0122-T1` cerrado (schemas Zod y tipos de `shell` disponibles).
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/validate-shell.ts` (nuevo)
    - `src/config/validate-runtime-config.ts` (orquestación de `validateShellConfig`)
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-shell.test.ts` (ampliación — este fichero ya
      existe desde `0122-T1` y se amplía aquí con los cross-refs)
  - Documentación:
    - `ai-workflow/docs/app-features/config/validation.md` — nuevas reglas cross-ref del bloque `shell`.
    - `ai-workflow/docs/app-features/shell/header.md` — reglas de validación cruzada del header.
    - `ai-workflow/docs/test-index.md` — anotar la nueva sección del fichero de tests de shell.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-shell.test.ts` (ampliación) — añadir un `describe`
      propio para cross-refs de `shell`, sin tocar los tests de shape de `0122-T1`.
  - **Comportamiento cubierto**:
    - Aceptación: `menuItem` raíz con `action.navigateTo.pageId` referenciando una página existente valida sin
      error.
    - Aceptación: `menuItem` dentro de `children` con `action.navigateTo.pageId` existente valida sin error.
    - Aceptación: `menuItem` con `action: { type: 'goBack' }` valida sin error (goBack no requiere cross-ref).
    - Aceptación: `menuItem` con `visibility` referenciando `forms.someForm.someField`, `queries.someQuery.data`
      o `params.someParam` con las superficies correctas valida sin error.
    - Aceptación: `shell.header.actions` con un `link` cuyo `action.navigateTo.pageId` existe en `pages` valida
      sin error.
    - Aceptación: `shell.header.actions` con un `button` cuya acción es `executeOperation` con
      `operationName` presente en `api` valida sin error.
    - Rechazo: `menuItem.action.navigateTo.pageId` referenciando una página que no existe en `pages` se rechaza
      con `code: 'invalid-layout'` y ruta exacta `shell.header.menu[i].action.pageId` (o
      `shell.header.menu[i].children[j].action.pageId` si aplica) y el mensaje declarado arriba.
    - Rechazo: `menuItem.visibility` con `item.*` se rechaza con mensaje explícito `Shell menu items do not
      support item.* references.` y ruta exacta al nodo `visibility`.
    - Rechazo: `menuItem.visibility` con una referencia `queries.foo.data` cuando `queries.foo` no existe en
      `api` se rechaza con el prefijo de shell (mismo patrón que hoy en visibility de nodos de página, pero con
      mensaje propio).
    - Rechazo: `shell.header.actions[i]` con `link` que declare `pageId` inexistente en `pages` se rechaza
      con `code: 'invalid-layout'`, ruta `shell.header.actions[i].props.action.pageId` y prefijo de shell.
    - Rechazo: `shell.header.actions[i]` con `button.props.action.executeOperation.operationName` inexistente en
      `api` se rechaza con `code: 'invalid-layout'`, ruta correspondiente y prefijo de shell.
    - Regresión: los tests de shape de `0122-T1` siguen pasando sin cambios.
    - Regresión: los tests ya existentes de `validate-actions-visibility.test.ts`,
      `runtime-config-validation-buttons.test.ts` y `runtime-config-validation-visibility.test.ts` siguen
      pasando sin cambios (no debe haber refactor de sus consumidores).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-shell.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts` (sanity)
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts` (sanity)
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - No añadir un fichero de test nuevo; ampliar el ya creado en `0122-T1`.
    - No introducir snapshots.
    - No modificar el formato de mensajes de `validateRuntimeUiAction`/`validateVisibility` para adaptarlos a
      shell; los mensajes de shell son propios de este módulo.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/validation.md`
  - `ai-workflow/docs/app-features/shell/header.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - `validate-shell.ts` existe y está orquestado desde `validate-runtime-config.ts`.
  - Todos los casos declarados en tests (aceptación y rechazo) pasan con las rutas y mensajes exactos.
  - Ningún test ya vigente de otros validadores se ha degradado por refactor lateral.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - La validación previa al render acepta o rechaza los criterios de la spec para `shell` con diagnósticos de
    ruta exacta y mensaje propio. El comportamiento observable del runtime aún no cambia (no hay render).

---

## Task 0122-T3 — Utilidad pura `computeActiveMenuItemIds`

- **ID**: 0122-T3
- **Estado**: pending
- **Objetivo**: Implementar y probar la función pura que deriva el conjunto de items del menú marcados como
  activos en función del `pageId` de la página actualmente visible, incluyendo la propagación al `menuItem`
  padre cuando cualquiera de sus `children` está activo. La función es sin estado, sin dependencias del
  provider ni del store: solo recibe `shell.header.menu` (raíz + un nivel) y el `pageId` activo. `goBack` nunca
  participa en el resaltado automático.
  - Cambios concretos:
    - `src/runtime/runtime-shell/compute-active-menu-item-ids.ts` (nuevo):
      - Firma:
        ```ts
        export interface ActiveMenuItemState {
          readonly activePaths: ReadonlySet<string>
        }
        export function computeActiveMenuItemIds(
          menu: readonly MenuItemConfig[] | undefined,
          activePageId: string | null,
        ): ActiveMenuItemState
        ```
        `activePaths` contiene una entrada por cada `menuItem` (raíz o child) que deba mostrarse como activo,
        codificada como `path` estable (p. ej. `[0]`, `[2, 1]` serializado a `"0"`, `"2.1"`).
      - Reglas:
        - `menu` ausente o vacío → `activePaths` vacío.
        - `activePageId` `null` → `activePaths` vacío.
        - Un `menuItem` de nivel raíz o dentro de `children` con `action.type === 'navigateTo'` y
          `pageId === activePageId` se añade al set.
        - Si un `menuItem` de `children` está activo, el path del `menuItem` padre también se añade al set
          (incluso si el padre no es navegable directamente por tener `children`).
        - Dos `menuItem` distintos que apunten al mismo `pageId` se añaden ambos al set con sus paths
          respectivos.
        - `action.type === 'goBack'` nunca se marca como activo.
        - `menuItem` con solo `href` (sin `action`) nunca se marca como activo (no hay `pageId` que comparar).
    - `src/runtime/runtime-shell/index.ts` (nuevo): re-export del helper para consumo desde
      `AppShellHeader` en `0122-T4`.
- **Fuera de alcance**:
  - Cualquier render del shell: queda para `0122-T4`.
  - Cualquier integración con `runtime-state` o `runtime-navigation`: la función es pura y recibe el `pageId`
    ya calculado desde fuera.
- **Dependencias**: `0122-T1` cerrado (tipos `MenuItemConfig`/`MenuItemChildConfig` disponibles).
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-shell/compute-active-menu-item-ids.ts` (nuevo)
    - `src/runtime/runtime-shell/index.ts` (nuevo)
  - Tests:
    - `src/tests/runtime/runtime-shell-active-menu.test.ts` (nuevo)
  - Documentación: ninguna en esta tarea (el comportamiento se documenta cuando queda observable en
    `0122-T4`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-shell-active-menu.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `menu` `undefined` con `activePageId` cualquiera → `activePaths` vacío.
    - `menu: []` con `activePageId` cualquiera → `activePaths` vacío.
    - `activePageId: null` con `menu` no vacío → `activePaths` vacío.
    - Un `menuItem` raíz con `action.navigateTo.pageId === activePageId` → `activePaths` contiene el path del
      item raíz.
    - Un `menuItem` raíz con `action.navigateTo.pageId` distinto de `activePageId` → `activePaths` vacío.
    - Un `menuItem` raíz con `action.goBack` que casualmente coincidiera con el pageId (n/a, `goBack` no
      declara `pageId`) → nunca activo.
    - Un `menuItem` raíz con solo `href` → nunca activo aunque `activePageId` sea el mismo string que la url.
    - Un `menuItem` raíz con `children` y uno de esos `children` con `action.navigateTo.pageId === activePageId`
      → `activePaths` contiene tanto el path del hijo como el del padre.
    - Un `menuItem` raíz con `children` sin ningún hijo activo → ni el padre ni sus hijos aparecen en
      `activePaths`.
    - Dos `menuItem` raíz distintos (con `pageId` idéntico) → ambos aparecen en `activePaths` cuando esa
      página está activa.
    - Un `menuItem` de raíz activo y otro `menuItem` con `children` cuyo hijo también apunta al mismo `pageId`
      → aparecen los tres paths (raíz activo directo, hijo activo, padre del hijo activo).
    - Pureza: llamar dos veces con las mismas entradas devuelve `activePaths` con los mismos elementos (no
      importa si es el mismo objeto identidad-comparable; sí que sea observacionalmente igual).
    - Robustez: `menuItem` con `visibility` declarada no influye en el cómputo — la función no evalúa
      `visibility`, solo `pageId` (visibility se resuelve en el render con las utilidades ya existentes).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-shell-active-menu.test.ts`
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - No importar nada de `react`, `runtime-state`, `runtime-references` ni el layout renderer: la función es
      100% pura.
    - No introducir snapshots.
    - Codificación del `path`: elegir una única representación estable en la propia función y documentarla en
      un comentario breve del módulo (una sola línea); no exponerla como API pública fuera de este módulo.
- **Documentación afectada**: ninguna en esta tarea (ver `0122-T4`).
- **Criterios de finalización**:
  - `computeActiveMenuItemIds` cumple todos los casos declarados.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - El helper existe, es puro, tiene el juego completo de tests y está re-exportado desde
    `src/runtime/runtime-shell/index.ts`. Aún no lo consume nadie hasta `0122-T4`.

---

## Task 0122-T4 — `AppShellHeader` + `MenuItemDropdown` + montaje en `src/app/`

- **ID**: 0122-T4
- **Estado**: pending
- **Objetivo**: Materializar el render del `shell.header` como componente `AppShellHeader` en
  `src/runtime/runtime-shell/`, montado una única vez por sesión de runtime en la composición raíz de
  `src/app/app-shell.tsx`, envolviendo al `layout-renderer` de la página activa (no formando parte de él).
  Incluye el subcomponente `MenuItemDropdown` con accesibilidad completa (aria, teclado, click-fuera, Esc) y el
  cableado del estado activo derivado con `computeActiveMenuItemIds` de `0122-T3`. El render reutiliza sin
  reimplementar:
  - `runtime-references` para resolver `title` y `menuItem.label`/`icon` con el mismo mecanismo de texto
    dinámico del resto del runtime;
  - `runtime-state` (fachada del dominio de navegación) para leer el `pageId`/`pageEntry` activo;
  - `runtime-actions` (`executeRuntimeUiAction`) para disparar `navigateTo`/`goBack` desde cada `menuItem`;
  - los componentes de nodo ya existentes para renderizar `logo` (props del nodo `image` — instanciando el
    componente `image` con esos props sin envolver en `type`) y cada entrada de `shell.header.actions` (usando
    el dispatcher central de nodos, restringido a `link`/`button` ya en el tipo).
  - Cambios concretos:
    - `src/runtime/runtime-shell/app-shell-header.tsx` (nuevo):
      - `AppShellHeader` recibe `header?: ShellHeaderConfig` y no renderiza nada si es `undefined` o si es
        `{}`.
      - Layout: `<header>` con dos áreas — izquierda (logo → título → menú, en ese orden, omitiendo ausentes)
        y derecha (actions). Implementado con utilidades de `Tailwind` (`flex`, `justify-between`), sin estilos
        inline. Extraer las clases estables a `src/runtime/runtime-node-styling-app-shell-header.ts` (nuevo
        módulo hermano de los `runtime-node-styling-*` existentes) para no dispersar clases largas en el JSX y
        respetar la convención de `runtime-node-styling`.
      - `logo`: instancia el componente del nodo `image` con `props: shell.header.logo` (sin envolverlo como
        un layout-node; el componente ya sabe degradar si `src`/`alt`/`fetch` no resuelven).
      - `title`: renderiza el resultado de `resolveRuntimeTextReference` sobre `header.title` dentro de un
        `<span>` o `<h1>` semántico (elegir un único elemento y documentarlo en el estilo helper). Si el
        string resuelto está vacío, no se renderiza el elemento.
      - `menu`: itera `header.menu ?? []`. Para cada `menuItem`:
        - resuelve su `visibility` con las mismas utilidades ya usadas por el layout renderer (excluyendo
          `item.*`, garantizado por `0122-T2`); si oculto, no se renderiza (el hueco no se reserva).
        - si tiene `children`: renderiza un trigger + `MenuItemDropdown` (ver más abajo). El trigger no es
          navegable directamente (no dispara acción al click; solo abre/cierra el desplegable).
        - si tiene `href`: renderiza un `<a href={resolvedHref}>` con `label` interpolado e `icon` opcional
          (misma semántica que `link` de layout: mismo helper de icono/label).
        - si tiene `action`: renderiza un `<button>` que al click llama a `executeRuntimeUiAction` con esa
          acción, reutilizando exactamente el mismo executor que ya usa `link`/`button` en el layout.
        - aplica clase de "activo" cuando el path del item está en `activePaths` de `computeActiveMenuItemIds`.
          La clase resuelta se centraliza en el módulo de styling nuevo; no dispersar clases duplicadas.
      - `actions`: itera `header.actions ?? []` y renderiza cada nodo con el dispatcher central de nodos
        (`layout-node-renderer` o el helper de despacho equivalente hoy disponible), respetando su contrato
        completo (incluida `visibility` propia del `link`/`button`). Los `actions` se posicionan en el área
        derecha vía el layout ya descrito, no vía un flag específico en el nodo.
      - No introduce ni consume `LayoutEditModeContext`; el shell no participa del canvas de edición del
        layout de la página en `0122-T4` (esa integración vive en `0122-T5`, y aún ahí edita config, no
        interacciona con el render vivo).
    - `src/runtime/runtime-shell/menu-item-dropdown.tsx` (nuevo):
      - Subcomponente para un único `menuItem` con `children` no vacío.
      - Estado local `open` con `useState`. Sin librería externa de posicionamiento (design decisión 6): CSS
        `position: absolute` sobre un contenedor `relative` ya renderizado por el trigger.
      - Accesibilidad:
        - Trigger: `aria-haspopup="menu"`, `aria-expanded` sincronizado con `open`, `type="button"`.
        - Contenedor del desplegable: `role="menu"`.
        - Cada hijo renderizado: `role="menuitem"`.
        - Foco: al abrir con click, el foco se mueve al primer `menuitem` del desplegable; navegación con
          flechas arriba/abajo entre hijos; `Home`/`End` para primero/último; `Esc` cierra y devuelve el foco
          al trigger.
        - Cierre: click fuera del contenedor (raíz + desplegable), pulsar `Esc`, o seleccionar (click/Enter/
          Space) un `menuitem` hijo. La selección de un hijo también dispara su acción/navegación exactamente
          igual que en menú raíz.
      - Cada hijo dentro del desplegable aplica el estado activo con la misma lógica que el menú raíz (paths
        del set `activePaths` de `computeActiveMenuItemIds`).
      - Si un hijo tiene `visibility` que evalúa oculto, no se renderiza; si el desplegable acaba sin hijos
        visibles, el trigger sigue funcionando y abre un desplegable con contenido vacío (comportamiento
        anotado en spec como no bloqueante).
    - `src/runtime/runtime-node-styling-app-shell-header.ts` (nuevo):
      - Helpers `getAppShellHeaderClassName()`, `getAppShellHeaderInnerClassName()`,
        `getAppShellHeaderLeftClassName()`, `getAppShellHeaderActionsClassName()`,
        `getAppShellHeaderMenuItemClassName({ active })`, `getAppShellHeaderDropdownClassName()`,
        `getAppShellHeaderDropdownItemClassName({ active })` con utilidades Tailwind estables. Reutilizar
        tokens globales (`bg-app-surface`, `text-app-text`, etc.) cuando existan.
    - `src/app/app-shell.tsx`:
      - Renderizar `<AppShellHeader header={runtimeConfig.shell?.header} />` inmediatamente por encima del
        contenido de la página activa, dentro del `<main>` ya existente (o del contenedor equivalente que hoy
        envuelve al renderer), de forma que el header persista con el mismo elemento montado entre
        navegaciones (no dependa del `pageId` ni del `pageEntry`).
      - Pasar por props/contexto el `pageId` activo al `AppShellHeader` desde donde ya lo consume el resto de
        la composición hoy (fachada de `runtime-state` accesible desde este nivel).
      - Sin `shell.header`, el nuevo componente devuelve `null` y no hay diferencia observable respecto al
        estado actual (retrocompat total).
- **Fuera de alcance**:
  - Sección "Shell" del editor visual: queda para `0122-T5`.
  - Comportamiento responsive/mobile del header y del desplegable (colapso, hamburguesa, reubicación en
    viewport estrecho): explícitamente fuera de spec.
  - Cualquier persistencia de estado del desplegable entre navegaciones: el estado local `open` se resetea con
    el ciclo de vida del propio componente cuando corresponda; no se coordina con el store.
  - Extensión a `shell.sidebar` u otros dominios del shell: fuera de scope.
- **Dependencias**: `0122-T1`, `0122-T2` y `0122-T3` cerrados. Sin T1/T2 el config no llega válido a este
  nivel; sin T3 no hay estado activo derivado.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-shell/app-shell-header.tsx` (nuevo)
    - `src/runtime/runtime-shell/menu-item-dropdown.tsx` (nuevo)
    - `src/runtime/runtime-shell/index.ts` (ampliación — re-export del componente principal)
    - `src/runtime/runtime-node-styling-app-shell-header.ts` (nuevo)
    - `src/app/app-shell.tsx` (montaje del header en la composición raíz)
  - Tests:
    - `src/tests/app/app-shell-header.test.tsx` (nuevo)
    - `src/tests/app/app-shell-header-dropdown.test.tsx` (nuevo)
  - Documentación:
    - `ai-workflow/docs/app-features/shell/header.md` (ampliación: comportamiento de render, estado activo,
      dropdown, accesibilidad)
    - `ai-workflow/docs/app-features/runtime/organization.md` — anotar el nuevo módulo `runtime-shell/`.
    - `ai-workflow/docs/app-features/navigation/navigate-actions.md` — anotar que el shell participa como
      fuente de `navigateTo`/`goBack` con el mismo executor que `link`/`button`.
    - `ai-workflow/docs/test-index.md` — nuevos ficheros de test.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/app/app-shell-header.test.tsx` (nuevo) — cobertura de render de logo/title/menu leaves/
      actions, ausencia de header sin `shell`, orden, activo, `visibility`, montaje una única vez.
    - `src/tests/app/app-shell-header-dropdown.test.tsx` (nuevo) — cobertura completa del
      `MenuItemDropdown`: apertura/cierre por click, Esc, click-fuera, selección de hijo, `aria-expanded`,
      `role="menu"`/`menuitem`, foco/teclado, activo en hijos y padre.
  - **Comportamiento cubierto**:
    - Sin `shell` declarado, el DOM del `main` no contiene el elemento `<header>` de `AppShellHeader` (o el
      componente devuelve `null`). El resto del layout renderiza igual que hoy (regresión sanity).
    - Con `shell: {}` o `shell: { header: {} }`, mismo comportamiento que sin `shell`.
    - Con `shell.header.logo` declarado, el header contiene un `<img>` con el `src`/`alt` esperados.
    - Con `shell.header.title` (literal, referencia dinámica e interpolación) declarado, el header contiene el
      texto resuelto.
    - Con `shell.header.menu` con un item raíz `href`, se renderiza un `<a href="...">`. Al click, el
      comportamiento nativo del anchor sigue vigente (no se llama a `executeRuntimeUiAction`).
    - Con `shell.header.menu` con un item raíz `action.navigateTo`, se renderiza un `<button>` cuyo click
      delega en `executeRuntimeUiAction` con esa acción y produce navegación observable a la nueva página.
    - Con `shell.header.menu` con un item raíz `action.goBack`, mismo patrón; retrocede el historial del
      runtime.
    - `visibility` en un `menuItem` (con condición cumplida u oculta) muestra/oculta el item; el resto del
      menú del mismo nivel se recalcula sin dejar hueco.
    - Orden fijo: `logo` → `title` → `menu` en el área izquierda; `actions` en el área derecha, con
      independencia de qué elementos existan (omitiendo ausentes sin dejar hueco).
    - Persistencia del header entre navegaciones: navegar entre dos páginas mantiene el mismo elemento
      montado (verificable p. ej. por `data-testid` estable y por el hecho de que un `useEffect` de montaje
      no vuelve a dispararse). Este test previene regresiones del "header montado una única vez por sesión".
    - Estado activo: un `menuItem` cuyo `pageId` coincide con la página visible aparece con la clase de
      activo aplicada por `runtime-node-styling-app-shell-header`.
    - Un `menuItem` con `children`, uno de cuyos hijos está activo, aparece con la clase de activo (tanto en
      el padre como en el hijo).
    - `shell.header.actions` con un `link` y un `button` renderiza cada nodo con el dispatcher central; una
      acción `executeOperation` en un `button` de `actions` dispara la operación real al click.
    - Dropdown (`app-shell-header-dropdown.test.tsx`):
      - Estado inicial: trigger visible, `aria-expanded="false"`, desplegable no en el DOM (o en el DOM con
        estilo de oculto — decidir según implementación y documentarlo).
      - Click sobre el trigger abre el desplegable, `aria-expanded="true"`, foco se mueve al primer hijo.
      - `Esc` con desplegable abierto cierra el desplegable, `aria-expanded="false"`, foco vuelve al trigger.
      - Click fuera del contenedor (raíz + desplegable) cierra el desplegable.
      - Seleccionar un hijo (click/Enter/Space) cierra el desplegable y dispara la acción de ese hijo
        exactamente como si fuera un `menuItem` raíz navegable.
      - Navegación con `ArrowDown`/`ArrowUp` mueve el foco entre `menuitem` hijos; `Home`/`End` van al primero
        y al último.
      - `role="menu"`/`role="menuitem"` presentes.
      - Regresión: el trigger de un padre con `children` no dispara `executeRuntimeUiAction` al click; solo
        abre/cierra el desplegable.
      - Regresión: un hijo del desplegable con `visibility` oculto no aparece en el DOM.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/app-shell-header.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-header-dropdown.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-shell-active-menu.test.ts` (sanity de no regresión sobre
      `0122-T3`)
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Reutilizar el harness de montaje de `src/tests/app/app-shell.test.tsx` como referencia estilística; si
      hace falta compartir fixtures, mover a `helpers.tsx` de esa carpeta.
    - No montar Monaco ni el editor visual: el header vive en producción, sin dependencia del modo dev.
    - No introducir snapshots.
    - Comprobar la accesibilidad de teclado usando eventos reales (`fireEvent.keyDown` u homólogo), no forzando
      focus manual con `.focus()` desde el test.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/shell/header.md`
  - `ai-workflow/docs/app-features/runtime/organization.md`
  - `ai-workflow/docs/app-features/navigation/navigate-actions.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - Todos los criterios de aceptación de spec sobre render, orden, persistencia entre páginas y estado activo
    están cubiertos por tests y en verde.
  - Config real con `shell.header` declarado renderiza el header y persiste entre navegaciones, con
    interacción de teclado y ratón que pasa los tests declarados.
  - Config sin `shell` (o con `shell.header` ausente/vacío) no produce diferencias observables respecto al
    estado actual.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - El header es observable en producción, montado una única vez, con dropdown accesible y estado activo
    aplicado. La feature es funcional end-to-end desde el JSON. La sección "Shell" del editor visual queda
    pendiente en `0122-T5`.

---

## Task 0122-T5 — Sección "Shell" del editor visual

- **ID**: 0122-T5
- **Estado**: pending
- **Objetivo**: Añadir la nueva sección de nivel superior "Shell" a la barra de dominio del editor visual como
  quinto botón, junto a `Layout`, `Api`, `Páginas`, `Tokens`. Al seleccionarla, sustituir el área donde
  normalmente se renderiza el canvas de `Layout` por un formulario dedicado (`ShellConfigPanel`) que permite
  configurar `shell.header` completo: toggle de activación del header, campos para `logo`, `title`, y las
  listas `menu` y `actions` (incluida alta/edición de `children` por `menuItem`). Reutilizar los widgets
  genéricos del panel de propiedades ya vigentes donde el shape coincide, y usar `@dnd-kit/core` con
  `SortableContext` anidados por nivel para la única interacción drag-and-drop soportada en esta sección
  (reordenar `menu` en su nivel). El commit reutiliza el mismo pipeline que el canvas: `validateRuntimeConfig`
  + parcheo de la clave `shell` sobre el último texto crudo válido conocido.
  - Cambios concretos:
    - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx`:
      - Añadir el quinto botón `Shell` al selector de pestaña de dominio; sí funcional (a diferencia de
        `Api`/`Páginas`/`Tokens` que siguen deshabilitados por ahora).
      - Al activar `Shell`, la barra emite un `onDomainSelected('shell')` que el layer de dev-editor
        interpreta cambiando el contenido central por `ShellConfigPanel`.
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`:
      - Cablear el estado de pestaña de dominio para renderizar `ShellConfigPanel` cuando el dominio activo es
        `shell` en vez del layout renderer + overlays.
      - Al entrar en `shell`, limpiar la selección de nodo del canvas (mismo comportamiento que ya existe al
        cambiar de página en el canvas).
      - Al salir de `shell` (volver a `Layout`), no dejar residuo de selección propia (la sección Shell no usa
        el modelo de "nodo seleccionado", pero sí puede tener un item de menú/acción en edición local).
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (nuevo):
      - Formulario dedicado con secciones:
        - Toggle "Header activo": activa/desactiva la existencia de `shell.header` en el config (marcar
          `shell.header = {}` o eliminar la clave).
        - Sub-formulario `Logo`: campos `src`, `alt`, `fetch` (mismos que `image.props`), usando el dispatcher
          genérico ya existente que se apoya en el schema Zod del nodo `image`.
        - Campo `Title`: input de texto plano (misma semántica de referencias que en el panel de propiedades
          del canvas — sin picker contextual, texto libre).
        - Lista `Menu`: cada entrada renderiza un `MenuItemEditorRow` con campos `label`, `icon`, selector de
          modo (Sin acción/`href`/`action.navigateTo`/`action.goBack`/`children`) via
          `DiscriminatedUnionPropertyField` adaptado (o su composición manual si el shape no encaja
          exactamente en el dispatcher — decidir en implementación con la restricción de reutilizar el mismo
          widget siempre que sea representable); botones "Añadir"/"Quitar"; drag-handle para reordenar dentro
          del mismo nivel.
        - Lista `Actions`: cada entrada es un `link` o `button` completo editado con el mismo panel de
          propiedades por nodo que ya usa el canvas (`layout-canvas-properties-panel`), restringido al schema
          de esos dos nodos. Alta/baja/reordenación con controles de formulario estándar (no DnD sobre
          `actions` — solo `menu` reordena por DnD, como fija la spec).
      - Cuando un `menuItem` está en modo "Con desplegable" (`children`), se expande una sublista con sus
        `menuItemChild` (mismos campos que el `menuItem` raíz salvo que no hay opción de crear `children`
        anidados: garantía tipo `menuItemChildSchema` de `0122-T1`). La sublista es reordenable con su propio
        `SortableContext`.
    - `src/dev-runtime/shell-config-panel/shell-config-panel-dnd.tsx` (nuevo, opcional según decisión de
      partición interna):
      - Un `SortableContext` para la lista raíz de `menu`, y un `SortableContext` por cada padre con
        `children` visible en el formulario (cada uno con su `items` propio y su callback de reordenación
        propio). Cada `menuItem` recibe un `useSortable` en su handle. Los `items` de cada contexto son los
        ids estables de sus entradas (usar un id sintético estable por posición si el `menuItem` no tiene
        clave natural).
      - Al reordenar, el callback aplica el nuevo orden sobre una copia inmutable de `shell.header.menu`
        (raíz) o del array `children` del padre correspondiente y dispara el commit del config.
    - Commit:
      - Reutilizar el mismo pipeline del canvas: aplicar la mutación sobre el config actual, ejecutar
        `validateRuntimeConfig`, y si es válido, actualizar el estado del runtime y parchear la clave `shell`
        sobre el último texto crudo válido conocido del buffer Monaco (mismo mecanismo que hoy parchea la
        clave `layout` del canvas — extraer un helper de parcheo por clave raíz si el existente hoy está
        acoplado a `layout`; en ese caso, generalizar a `patchRootKey(rawText, key, value)` sin cambiar el
        comportamiento del canvas existente y usarlo también aquí).
      - Un commit del panel de Shell activa la misma guardia de "cambios aplicados" del canvas.
      - Ningún commit del panel de Shell toca las claves `layout`/`api`/`initialPage`/`preloads`/`tokens`/
        `translations` del texto crudo.
- **Fuera de alcance**:
  - Cualquier cambio de comportamiento del canvas de `Layout` o del panel de propiedades por nodo
    seleccionado.
  - Cualquier drag-and-drop distinto de "reordenar `menu` dentro de su mismo nivel" (ninguna operación DnD
    sobre `actions`, ninguna operación DnD entre niveles raíz y `children`).
  - Persistencia del estado del panel Shell entre recargas del navegador.
  - Rehacer el panel de `Api`/`Páginas`/`Tokens` (que siguen "Próximamente").
- **Dependencias**: `0122-T4` cerrado. Sin T4, editar Shell no permitiría previsualizar los cambios sobre el
  render real, lo que rompería la promesa de "el mismo config editado se ve al instante" que ya vale para el
  canvas.
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` (nuevo botón `Shell`, callbacks)
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (render condicional del `ShellConfigPanel`)
    - `src/dev-runtime/shell-config-panel/shell-config-panel.tsx` (nuevo)
    - `src/dev-runtime/shell-config-panel/shell-config-panel-dnd.tsx` (nuevo)
    - Posible generalización del helper de parcheo de clave raíz sobre el texto crudo del buffer Monaco (si
      hoy está acoplado a `layout`).
  - Tests:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación: nuevo botón `Shell`)
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación: render de `ShellConfigPanel` al activar
      `Shell`, limpieza de selección al entrar/salir)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (nuevo: edición completa del formulario, commit,
      validación fallida, reordenación DnD por nivel)
  - Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — nueva sección "Shell" en el editor
      visual, con reglas de DnD por nivel y commit por parcheo de clave.
    - `ai-workflow/docs/app-features/shell/header.md` — cerrar la ficha con la referencia al editor visual.
    - `ai-workflow/docs/test-index.md` — nuevos ficheros/ampliaciones de test.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación)
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación)
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Toolbar: el quinto botón `Shell` está presente, no muestra "Próximamente", y `aria-pressed` refleja
      correctamente el estado seleccionado (mutuamente excluyente con `Layout`).
    - Layer: al pulsar `Shell` en la toolbar, el área central deja de renderizar el `LayoutRenderer` y
      renderiza el `ShellConfigPanel`. Al volver a `Layout`, se restaura la vista del canvas.
    - Layer: al entrar a `Shell` con un nodo del canvas seleccionado, se limpia la selección (misma política
      documentada para `Api`/`Páginas`/`Tokens`).
    - Panel: toggle de activación del header pasa el config de `sin shell` a `shell: { header: {} }` y
      viceversa, y esa mutación es válida.
    - Panel: editar `logo` (campo `src`/`alt`) actualiza el config y el buffer de Monaco de inmediato, y el
      header montado en producción refleja el cambio al instante.
    - Panel: editar `title` (con literal y con `{{...}}`) igual que el punto anterior.
    - Panel: alta de un `menuItem` raíz con `label` + `href` produce config válido y renderiza en el header.
    - Panel: alta de un `menuItem` con `action.navigateTo.pageId` desde el selector de variante — al elegir
      `navigateTo`, aparecen los campos propios de la variante (mismo patrón que `link.props.action`).
    - Panel: alta de `children` sobre un `menuItem` reemplaza la variante `Sin acción`/`href`/`action` por la
      lista de `menuItemChild` (el schema de shape rechaza mezclar; el editor lo refleja igualando la
      restricción).
    - Panel: reordenar `menu` raíz con DnD persiste el nuevo orden en el config; reordenar `children` de un
      mismo padre con DnD persiste el nuevo orden dentro de ese `children`. Un intento de mover un `menuItem`
      de la raíz al `children` de un padre (o viceversa) queda fuera de la operación soportada: el DnD por
      nivel no lo permite; el test cubre que ese intento no produce cambios y no crashea.
    - Panel: alta/edición/orden de `actions` con controles de formulario (sin DnD) — cambiar tipo (`link` ↔
      `button`) reconstruye el shape con los defaults del nuevo tipo (mismo comportamiento del selector de
      variante ya vigente).
    - Panel: un commit rechazado por validación (p. ej. `menuItem` con `label` en blanco tras editarlo) no
      revierte el campo en silencio: mismo patrón de feedback `role="alert"` con código y mensaje del error,
      igual que en `layout-canvas-properties-panel-commit-feedback` — reutilizar ese patrón sin duplicar UI.
    - Commit: un cambio en el panel Shell parchea únicamente la clave `shell` del texto crudo del buffer
      Monaco; el resto del documento (`api`, `pages`, `initialPage`, `preloads`, `tokens`, `translations`,
      `layout` de cada página) permanece byte a byte igual.
    - Commit: un cambio válido activa la misma guardia de "cambios aplicados" del canvas.
    - Regresión: los tests ya vigentes del canvas siguen pasando sin cambios de aserciones; no hay
      interacción indirecta desde `ShellConfigPanel` al canvas.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
    - `pnpm test --run src/tests/app/app-shell-header.test.tsx` (sanity de no regresión sobre `0122-T4`)
    - `pnpm test` (una vez al cierre, para confirmar la suite global y el gate de cobertura)
  - **Restricciones**:
    - Reutilizar `DiscriminatedUnionPropertyField` para el selector de modo del `menuItem`
      (`href`/`navigateTo`/`goBack`/`children`) siempre que el shape sea representable con esa API; si el
      caso de `children` no encaja como una variante más, extender el widget o componerlo puntualmente sin
      duplicar el resto de variantes.
    - Reutilizar el editor de condición `visibility` (simple/grupo) ya usado en el panel de propiedades del
      canvas para `menuItem.visibility`, sin duplicar UI.
    - Reutilizar el pipeline de commit del canvas; si hoy el parcheo está acoplado a la clave `layout`,
      generalizarlo con una única función `patchRootKey(rawText, key, value)` que reciba el nombre de la
      clave sin cambiar el comportamiento del canvas existente.
    - No introducir snapshots.
    - Usar `SortableContext` anidados por nivel (uno por lista de `menu` raíz + uno por cada padre con
      `children` abierto en el formulario), no un único contexto para todo el árbol.
    - No añadir dependencias externas nuevas: `@dnd-kit/core` ya está instalado.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
  - `ai-workflow/docs/app-features/shell/header.md`
  - `ai-workflow/docs/test-index.md`
- **Criterios de finalización**:
  - Todos los criterios de aceptación de spec sobre el editor visual están cubiertos por tests y en verde.
  - Un usuario puede activar/desactivar el header, editar sus campos, gestionar `menu` (raíz + `children`) y
    `actions` desde el formulario, ver el resultado en el header real y persistirlo en el buffer de Monaco sin
    tocar otras claves del documento.
  - `pnpm test` (suite completa) en verde sin bajar el umbral de cobertura global del 80%.
- **Cierre de implementación**:
  - La feature es completa end-to-end: contrato + validación + render + editor. Queda lista para la pasada
    documental posterior con `update-app-documentation`.
