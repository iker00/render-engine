# 0082 — Tareas

Contrato de ejecución para `link-children`. Cada tarea debe ejecutarse en orden salvo que se indique
explícitamente que es independiente. Los IDs son estables; no renombrarlos al cerrar.

Referencias de spec utilizadas a lo largo del plan:
- `spec.md` §Requisitos funcionales 1–8: contrato de aceptación/rechazo del nodo `link` con `children` y con `label`.
- `spec.md` §Criterios de aceptación 1–10: comportamiento observable que debe sostener cada tarea.
- `spec.md` §Casos límite: matriz de aceptación/rechazo para `children` vacío, anidamiento, atributos opcionales.

Subconjunto cerrado de tipos permitidos dentro de `link.children` (en cualquier profundidad):
`container`, `heading`, `paragraph`, `list`, `image`, `badge`, `alert`, `stat`, `divider`, `skeleton`.

Convenciones de la sección `tests` por tarea:
- ficheros de test indicados como `(nuevo)` o `(ampliación)`.
- los comandos asumen ejecución desde la raíz del repo.
- las reglas universales de testing y el umbral del 80% global viven en `ai-workflow/standards/testing-rules.md` y no se
  repiten por tarea.

---

## T1 — Validación de `link` con `children` (schema, tipos y cross-validation recursiva)

- estado: completado
- objetivo: extender el contrato de validación previa del nodo `link` para que acepte un campo `children` al nivel del
  nodo, mutuamente excluyente con `props.label` y `props.icon`, y restringido recursivamente al subconjunto cerrado de
  tipos visuales no interactivos definido en la spec. La normalización debe devolver `children` validados como
  `LayoutNodeCollection`. Mantener intacto el comportamiento existente con `props.label`.
- fuera de alcance: cambios en el renderer (`LinkNode`, `layout-renderer.tsx`, `layout-node-renderer.tsx`); cambios en
  cualquier otra validación de nodo distinta de `link`; cambios en la infraestructura genérica `validateLayoutCollection`
  o `validateLayoutNode` (deben usarse tal cual); cambios en `docs/`.
- dependencias: ninguna.
- impacto esperado en archivos:
  - código:
    - `src/config/runtime-config-zod.ts` (`linkNodeSchema`): hacer `props.label` opcional y añadir
      `children: z.array(z.unknown()).optional()` al objeto del nodo.
    - `src/config/runtime-config-types.ts` (`LinkLayoutNode`): pasar `label?: string` y reemplazar `children?: unknown`
      por `children?: LayoutNodeCollection`.
    - `src/config/validate-layout-nodes.ts` (`validateLinkNode`): declarar la constante de tipos permitidos para
      `link.children` (a la altura de `modalAllowedChildTypes`, línea 79) y aplicar las reglas de cross-validation y la
      restricción recursiva. La normalización final debe devolver `children` cuando aplique; cuando no, no añadir la
      clave.
  - tests:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación): el test
      `does not propagate children from a link node` (línea ~1380) debe sustituirse / actualizarse para reflejar la
      nueva semántica (`children` ya no se descarta silenciosamente; ahora se valida). Añadir el resto de casos del
      sub-bloque `tests`.
  - documentación: ninguno en esta tarea (las fichas se revisan en `update-app-documentation` tras T2).
- tests:
  - ficheros de test:
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
  - comportamiento cubierto:
    - acepta un `link` con `children` formado por un único nodo del subconjunto permitido (p. ej. `paragraph`) y
      `props.href` literal; el resultado normalizado contiene `children` como `LayoutNodeCollection` y no contiene
      `props.label`.
    - acepta un `link` con `children` formado por un `container` que envuelve `heading` + `paragraph` (mezcla del
      subconjunto permitido) y `props.action: navigateTo`; el `container` y sus descendientes quedan validados.
    - acepta un `link` con `children: [{ type: 'divider' }]` (un único nodo `divider`).
    - acepta un `link` con `children` que contiene un `container` sin hijos propios (`container` válido sin
      `children`).
    - acepta un `link` con `children` y `props.target: "_blank"` junto a `props.href`.
    - acepta un `link` con `children` y `props.download` + `props.href`.
    - acepta el comportamiento existente: `link` con `props.label` y sin `children` (no regresión); incluir un caso
      con `props.icon` declarado para confirmar no regresión.
    - rechaza un `link` con `children` y `props.label` simultáneos con diagnóstico exacto:
      `Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.label and children.`
    - rechaza un `link` con `children` y `props.icon` simultáneos con diagnóstico exacto:
      `Page "${pageId}" has an invalid layout at "${path}": link nodes cannot have both props.icon and children.`
      (segmento `${path}`, alineado al patrón existente de cross-validations mutuamente excluyentes en
      `validateLinkNode`; no usar `${path}.props.icon`).
    - rechaza un `link` sin `children` y sin `props.label` con diagnóstico exacto:
      `Page "${pageId}" has an invalid layout at "${path}": link nodes must have either props.label or children.`
      Este chequeo sustituye la exigencia previa "must have either props.label" (que estaba implícita en el schema
      `linkNodeSchema` por `label` requerido); el chequeo de `href` vs `action` se conserva tal cual con sus mensajes
      actuales y NO se sustituye por este.
    - rechaza un `link` con `children: []` (vacío) con diagnóstico exacto:
      `Page "${pageId}" has an invalid layout at "${path}.children": link children cannot be empty.`
    - rechaza un `link` con `children` que contiene un nodo de tipo prohibido directo (`button`) con diagnóstico
      exacto:
      `Page "${pageId}" has an invalid layout at "${path}.children[0]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`
    - rechaza un `link` con `children` que contiene un `container` cuyos `children` incluyen un `button` con
      diagnóstico de la ruta del `button` siguiendo el mismo formato del bullet anterior, con `${path}` reemplazado por
      la ruta exacta del `button` (p. ej.
      `Page "${pageId}" has an invalid layout at "${path}.children[0].children[1]": link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`).
    - rechaza un `link` con `children` que contiene un `link` anidado siguiendo el mismo formato y con la ruta exacta
      del `link` interno.
    - rechaza un `link` con `children` que contiene un `repeater` siguiendo el mismo formato y con la ruta exacta del
      `repeater`.
    - sustituye el test existente `does not propagate children from a link node`: con `children` válido el campo se
      propaga al config normalizado; con `props.label` y sin `children`, el resultado normalizado no contiene la clave
      `children`.
  - comandos durante la implementación:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
  - restricciones:
    - reutilizar la infraestructura de validación recursiva ya existente: invocar `validateLayoutCollection` sobre
      `children` y aplicar la restricción de tipos permitidos al árbol resultante; no duplicar el switch de
      `validateLayoutNode`.
    - el chequeo recursivo de tipos permitidos debe describirse como una función local de `validate-layout-nodes.ts`
      con firma estable (entrada: colección validada + path base + pageId; salida: `{status: 'ready'}` o
      `{status: 'error'; error}`). No reutilizar la constante `modalAllowedChildTypes`; declarar una constante
      independiente con el subconjunto del spec (`linkAllowedChildTypes`).
    - el orden de las cross-validations debe ser: (1) presencia mutuamente excluyente de `children` y
      `props.label`, (2) presencia mutuamente excluyente de `children` y `props.icon`, (3) exigencia de al menos uno
      entre `children` y `props.label`, (4) `children` no vacío, (5) tipos directos permitidos, (6) tipos recursivos
      permitidos, (7) reglas existentes de `href`/`action`/`download`/`target` (sin modificar su comportamiento). Las
      reglas (7) — incluida la exigencia de `props.href` para usar `props.download` o `props.target` — siguen
      aplicando idénticamente cuando el contenido del anchor es `children` en lugar de `label`: no se relajan ni se
      modifican sus mensajes. Añadir un test que confirme: `link` con `children`, `props.action: navigateTo` y
      `props.download` es rechazado con el diagnóstico existente
      `Page "${pageId}" has an invalid layout at "${path}.props.download": download requires props.href.` (mismo
      caso con `props.target` y el mensaje análogo).
    - los diagnósticos de tipo prohibido deben incluir la ruta exacta del nodo prohibido relativa al nodo `link`
      (p. ej. `${path}.children[0].children[1]`).
- documentación afectada:
  - `ai-workflow/docs/app-features/nodes/link.md` (referencia para futura pasada documental, no se toca aquí)
  - `ai-workflow/docs/app-features/nodes/index.md` (referencia para futura pasada documental, no se toca aquí)
- criterios de finalización:
  - `validateLinkNode` acepta y rechaza exactamente los casos enumerados arriba con los diagnósticos descritos.
  - El config normalizado de un `link` con `children` válido contiene `children` como `LayoutNodeCollection`; con
    `props.label` no contiene la clave `children`.
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts` verde.
  - `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: el contrato declarativo y la validación previa al render aceptan `link` con `children`
  con las restricciones del spec, y el resto del catálogo no cambia su comportamiento.

---

## T2 — Render del nodo `link` con `children`

- estado: completado
- objetivo: hacer que el renderer del runtime produzca un `<a data-layout-node="link">` cuyo contenido sean los nodos
  hijos renderizados cuando el nodo `link` declara `children`, manteniendo intacto el render existente cuando se
  declara `props.label` (con o sin `props.icon`). El comportamiento de `href`, `action`, `download` y `target` debe
  ser idéntico en ambos modos.
- fuera de alcance: cambios en validación (cubiertos por T1); cambios en estilos del propio anchor (la spec no admite
  cambios visuales en el anchor); cambios en otros nodos; cambios en `docs/`.
- dependencias: T1.
- impacto esperado en archivos:
  - código:
    - `src/runtime/layout-renderer.tsx` (`hasChildren`): incluir `'link'` en el type guard para que el contenido del
      anchor se construya con `LayoutRenderer` sobre `node.children` y se pase al nodo vía `renderedChildren`.
    - `src/runtime/layout-node-renderer.tsx` (caso `'link'`): pasar `renderedChildren` al `<LinkNode>`.
    - `src/runtime/nodes/link-layout-node.tsx`: aceptar `renderedChildren?: ReactNode` por props y renderizar la
      rama correspondiente:
      - si `node.children` está definido, ignorar `label` e `icon` y renderizar `{renderedChildren}` dentro del
        anchor.
      - si `node.children` no está definido, mantener literal la rama actual (`<IconNode /> {label}`).
    - el cálculo de `href`, `effectiveHref`, `onClick` y `className` no debe variar entre ramas.
  - tests:
    - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación): añadir un `describe`
      dedicado a `link node con children` dentro del bloque existente de `link`.
  - documentación: ninguno en esta tarea.
- tests:
  - ficheros de test:
    - `src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` (ampliación)
  - comportamiento cubierto:
    - un `link` con `children: [{ type: 'paragraph', props: { text: 'Hola' } }]` y `props.href` se renderiza como
      `<a data-layout-node="link" href="https://...">` con el `paragraph` como contenido del DOM y sin texto de
      `label`.
    - un `link` con `children` compuesto por un `container` que envuelve `heading` + `paragraph` renderiza el árbol
      completo dentro del anchor.
    - un `link` con `children` y `props.action: navigateTo`:
      - el `href` resuelto del anchor es `#/{pageId}` (literal).
      - el clic en el anchor previene el comportamiento por defecto y delega en el ejecutor de acciones del runtime
        (verificación equivalente a la del test existente con `label`).
    - un `link` con `children`, `props.href` y `props.target="_blank"` renderiza el atributo `target` en el anchor.
    - un `link` con `children`, `props.href` y `props.download` renderiza el atributo `download` en el anchor.
    - un `link` con `children` no renderiza el `IconNode`, ni cuando se pasa `props.icon` (caso de regresión negativa
      apoyado en T1 que rechaza esa combinación; aquí se cubre la rama de render asumiendo configuración válida con
      `children`).
    - no regresión: el escenario actual de `link` con `props.label` (con y sin `props.icon`) sigue renderizando el
      label y, cuando aplica, el icono, sin ningún cambio en clases ni atributos.
    - no regresión: visibility / queryStateFeedback / layout.span del nodo `link` siguen comportándose igual cuando
      se usa `children` (basta un test combinado para visibility con `children`).
  - comandos durante la implementación:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx`
  - restricciones:
    - reutilizar el mecanismo estándar `hasChildren` + `renderedChildren` que ya usan `container`, `form` y `modal`;
      no introducir una segunda llamada manual a `<LayoutRenderer>` dentro de `LinkNode`.
    - no añadir variantes de clase nuevas en `getLinkNodeClassName`; el className del anchor debe ser idéntico al
      actual en ambas ramas.
    - los nuevos tests deben reutilizar el harness de render ya empleado en el bloque `link node render`
      (importaciones, providers, helpers de la misma carpeta) en lugar de montar un harness nuevo.
- documentación afectada:
  - `ai-workflow/docs/app-features/nodes/link.md` (referencia para futura pasada documental, no se toca aquí)
  - `ai-workflow/docs/app-features/nodes/index.md` (referencia para futura pasada documental, no se toca aquí)
- criterios de finalización:
  - El runtime renderiza `link` con `children` produciendo el árbol esperado dentro del anchor, manteniendo `href`,
    `download`, `target` y el comportamiento de `action` idénticos al modo con `label`.
  - El comportamiento del modo `props.label` (con y sin `props.icon`) no cambia.
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-buttons-text.test.tsx` verde.
  - `pnpm test` global verde y cobertura ≥ 80%.
- cierre de implementación: el nodo `link` soporta el modo `children` end-to-end (validación previa + render) y el
  modo `label` sigue intacto.
