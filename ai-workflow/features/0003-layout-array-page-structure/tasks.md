# Tasks: Feature 0003 - layout-array-page-structure

## Orden de ejecución
1. `0003-T01` - migración del contrato y la validación de `layout` a colección ordenada
2. `0003-T02` - adaptación del renderer para múltiples elementos raíz sin contenedor sintético
3. `0003-T03` - regresiones de bootstrap e integración visibles con el contrato migrado

La siguiente tarea que debe escogerse al empezar implementación es `0003-T01`.

---

## `0003-T01` - Migración del contrato y la validación de `layout` a colección ordenada

- Estado: `completed`
- Objetivo:
  Sustituir el contrato tipado y validado de `pages[].layout` para que deje de ser un único nodo raíz y pase a ser un array ordenado de elementos declarativos, manteniendo la validación explícita de nodos soportados, la capacidad de anidación en `container` y el rechazo claro del shape antiguo basado en objeto.
- Fuera de alcance:
  No adaptar todavía el render visible de React a múltiples hermanos raíz. No introducir nuevos tipos de nodo, soporte funcional de formularios, navegación, queries ni compatibilidad dual entre `layout` objeto y `layout` array.
- Dependencias:
  Parte de la base dejada por `0002`. Debe ejecutarse antes de cualquier cambio de render porque fija el contrato consumido por `RuntimePage`, `LayoutRenderer` y el bootstrap.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `src/config/runtime-config.ts`, `src/app/bootstrap/read-runtime-config.ts` por cambios de tipos exportados, y `src/dev/config.json` para migrar el fixture estable al nuevo shape de `layout`.
  - Tests a crear o modificar:
    `src/tests/runtime-config-validation.test.ts`, `src/tests/read-runtime-config.test.ts`.
  - Documentación a revisar o actualizar:
    `ai-workflow/docs/app-features/config-contract.md`, `ai-workflow/docs/app-features/pages-and-navigation.md`, `ai-workflow/docs/app-features/forms-and-validation.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Unit tests que acepten una página válida con `layout` como array de varios elementos hermanos.
  - Unit tests que acepten `layout: []` como caso válido.
  - Unit tests que rechacen explícitamente `layout` como objeto raíz con mensaje diagnóstico en la ruta `layout`.
  - Unit tests que rechacen elementos inválidos o tipos no soportados tanto en la raíz como dentro de `children`.
  - Unit tests que mantengan el error explícito cuando `initialPage` no existe.
  - Reejecutar `pnpm test` al cerrar la tarea.
- Documentación afectada:
  Sí. La pasada documental posterior deberá describir `layout` solo como colección ordenada y aclarar que la migración abandona el shape raíz antiguo sin ventana de coexistencia.
- Criterios de finalización:
  - `RuntimePageConfig.layout` deja de representar un nodo único y pasa a representar una colección ordenada validada.
  - La validación diferencia con claridad entre colección (`layout`, `children`) y elemento individual de layout.
  - El shape antiguo `layout` como objeto se rechaza como error explícito y no se reinterpreta silenciosamente.
  - `layout: []` y `container.children: []` quedan soportados como casos válidos.
  - El fixture estable de desarrollo ya usa el nuevo contrato raíz.
- Cierre de implementación:
  Completo cuando el contrato tipado, el validador, los fixtures de entrada y sus tests unitarios estén migrados y verdes.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. Deberá actualizar el contrato JSON y el estado vigente del producto para reflejar la nueva raíz basada en colección.

---

## `0003-T02` - Adaptación del renderer para múltiples elementos raíz sin contenedor sintético

- Estado: `completed`
- Objetivo:
  Adaptar `RuntimePage` y el renderer declarativo para consumir una colección de elementos raíz ordenados, renderizando hermanos directos en el orden declarado y preservando la composición existente de `container` sin inventar un nodo de layout `container` para envolver toda la página.
- Fuera de alcance:
  No introducir nuevos nodos soportados ni comportamiento funcional de formularios. No rehacer estilos globales ni ampliar el sistema visual más allá de lo necesario para conservar legibilidad y orden observable.
- Dependencias:
  Depende de `0003-T01`, porque debe consumir el nuevo contrato validado de `layout` como colección.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `src/runtime/layout-renderer.tsx`, `src/runtime/runtime-page.tsx` y, solo si el ajuste visible lo exige, `src/app/index.css`.
  - Tests a crear o modificar:
    `src/tests/layout-renderer.test.tsx`.
  - Documentación a revisar o actualizar:
    `ai-workflow/docs/app-features/config-driven-ui-runtime.md`, `ai-workflow/docs/app-features/config-contract.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Integration tests del renderer con una página cuyo `layout` tenga varios hermanos raíz de tipos distintos y verifiquen el orden visible.
  - Tests que comprueben que un `container` sigue anidando sus `children` con el mismo comportamiento observable que antes.
  - Tests de `layout: []` para asegurar que la página se resuelve sin contenido inventado.
  - Tests que confirmen que no aparece un wrapper de layout `container` artificial alrededor de los hermanos raíz.
  - Reejecutar `pnpm test` al cerrar la tarea.
- Documentación afectada:
  Sí. La pasada documental deberá explicar que una página puede empezar por varios bloques hermanos sin `container` raíz artificial, manteniendo la anidación interna de contenedores.
- Criterios de finalización:
  - `RuntimePage` renderiza correctamente una colección ordenada de elementos raíz.
  - El orden de la colección coincide con el orden visible de renderizado.
  - La composición de `container` sigue funcionando con `children` como colección anidada.
  - La página vacía no muestra placeholders ni contenedores falsos.
- Cierre de implementación:
  Completo cuando el renderer y sus tests de integración consumen exclusivamente el nuevo contrato de colección y quedan verdes.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. No debe cerrarse sin actualizar la descripción del runtime y del contrato de layout raíz.

---

## `0003-T03` - Regresiones de bootstrap e integración visibles con el contrato migrado

- Estado: `completed`
- Objetivo:
  Ajustar el arranque visible de `App` y sus tests de integración para que el runtime funcione de extremo a extremo con el nuevo shape de `layout`, tanto desde `src/dev/config.json` como desde `data-config`, manteniendo los errores diagnósticos en desarrollo y la degradación silenciosa en producción para layouts inválidos.
- Fuera de alcance:
  No cerrar todavía la pasada documental global de la feature. No introducir nuevos flujos interactivos ni cambios de arquitectura fuera de los puntos ya afectados por la migración de contrato.
- Dependencias:
  Depende de `0003-T02`. Bloquea el cierre técnico de la feature porque valida el comportamiento observable de arranque con fuentes reales de configuración.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `src/app/App.tsx` si la adaptación de tipos o del flujo visible lo exige, `src/dev/config.json` para el fixture final usado por la app y, solo si aparece una regresión de arranque, `src/main.tsx` o `src/app/bootstrap/read-runtime-config.ts`.
  - Tests a crear o modificar:
    `src/tests/app-bootstrap.test.tsx`, `src/tests/app-shell.test.tsx`, `src/tests/main.test.tsx` si el punto de entrada necesita cobertura adicional del shape migrado.
  - Documentación a revisar o actualizar:
    `ai-workflow/docs/app-features/config-driven-ui-runtime.md`, `ai-workflow/docs/app-features/config-contract.md`, `ai-workflow/docs/app-features/pages-and-navigation.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Integration tests de `App` para desarrollo y `data-config` con páginas cuya raíz tenga varios elementos hermanos.
  - Integration tests del error visible en desarrollo cuando `layout` vuelve a declararse como objeto o contiene un elemento raíz inválido.
  - Integration tests de degradación en producción para confirmar que esos errores no muestran fallback genérico visible ni inventan contenido.
  - Reejecutar `pnpm lint`, `pnpm test` y `pnpm build` al cerrar la tarea y la pasada completa.
- Documentación afectada:
  Sí. La pasada documental posterior deberá alinear el estado vigente del producto, el contrato JSON y la explicación del runtime visible con el nuevo shape de página.
- Criterios de finalización:
  - `App` arranca correctamente con el fixture de desarrollo ya migrado al nuevo contrato.
  - La prioridad de `data-config` sobre `src/dev/config.json` sigue intacta con layouts raíz basados en colección.
  - Los errores de configuración del shape antiguo o de elementos inválidos siguen siendo diagnósticos en desarrollo.
  - En producción, la degradación sigue sin mostrar mensajes genéricos visibles ni contenido inventado.
  - Las validaciones finales del proyecto (`pnpm lint`, `pnpm test`, `pnpm build`) quedan verdes con el gate de cobertura intacto.
- Cierre de implementación:
  Completo cuando el flujo visible de arranque, sus regresiones y las validaciones finales del repositorio estén verdes.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. Esa pasada deberá actualizar las fichas funcionales afectadas antes de cerrar documentación en `status.yaml`.
