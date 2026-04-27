# Tasks: Feature 0002 - basic-static-renderer

## Orden de ejecución
1. `0002-T01` - contrato mínimo del runtime estático y validación de `initialPage` + `layout`
2. `0002-T02` - renderer declarativo para `container`, `heading`, `paragraph` y `list`
3. `0002-T03` - integración en `App`, sustitución del shell provisional y cierre de errores visibles

La siguiente tarea que debe escogerse al empezar implementación es `0002-T01`.

---

## `0002-T01` - Contrato mínimo del runtime estático y validación de `initialPage` + `layout`

- Estado: `completed`
- Objetivo:
  Introducir el contrato mínimo de configuración necesario para esta feature, dejando explícitos los tipos y validaciones de `pages`, `initialPage` y `layout` para que el renderer no consuma estructuras ambiguas ni dependa de los campos provisionales `title` y `description`.
- Fuera de alcance:
  No renderizar todavía nodos visuales ni sustituir el shell actual. No implementar navegación, formularios, queries, `preloads`, referencias dinámicas ni soporte para nodos fuera de `container`, `heading`, `paragraph` y `list`.
- Dependencias:
  Depende del bootstrap ya existente de `0001`. Debe ejecutarse antes de cualquier tarea de render porque fija el contrato que consumirá el resto.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `src/app/bootstrap/read-runtime-config.ts`, nuevos tipos y validadores del runtime en `src/config/` o `src/runtime/` con rutas explícitas para páginas y layout, y `src/dev/config.json` para convertir el fixture actual al shape real de la feature.
  - Tests a crear o modificar:
    `src/tests/read-runtime-config.test.ts` y nuevos tests unitarios del validador o resolvedor de página inicial en `src/tests/`.
  - Documentación a revisar o actualizar:
    `ai-workflow/docs/app-features/config-contract.md`, `ai-workflow/docs/app-features/pages-and-navigation.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Unit tests del parseo o validación del runtime config para aceptar una página con `id` y `layout`.
  - Unit tests del error cuando `initialPage` no existe en `pages`.
  - Unit tests del error cuando `layout` no cumple la forma soportada por esta feature.
  - Unit tests del comportamiento ante nodos con `type` no soportado, verificando que el problema se clasifica de forma explícita para desarrollo y producción.
  - Reejecutar `pnpm test` al cerrar la tarea.
- Documentación afectada:
  Sí. La pasada documental posterior deberá reflejar que la configuración deja de depender del shape provisional con `title` y `description` y pasa a un árbol `layout` validado.
- Criterios de finalización:
  - El runtime config soportado por la aplicación refleja el contrato mínimo real de esta feature.
  - El fixture `src/dev/config.json` ya usa `layout` y deja al menos una página válida renderizable por el renderer estático.
  - El arranque detecta y clasifica de forma explícita estas situaciones: `initialPage` inexistente, `layout` inválido y nodo con `type` no soportado.
  - El código deja preparado un resultado usable por la UI para distinguir entre estado válido y error de configuración sin reinterpretar el contrato en componentes.
- Cierre de implementación:
  Completo cuando el contrato mínimo, sus validaciones y el fixture de desarrollo estén implementados y cubiertos por tests unitarios verdes.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. Deberá actualizar el contrato JSON y aclarar que la navegación sigue fuera de alcance aunque ya existan varias páginas declaradas.

---

## `0002-T02` - Renderer declarativo para `container`, `heading`, `paragraph` y `list`

- Estado: `completed`
- Objetivo:
  Implementar el renderer estático que interpreta el árbol `layout` ya validado y renderiza únicamente los nodos soportados por esta feature, con estilos mínimos para jerarquía y legibilidad y respetando que solo `container` admite `children`.
- Fuera de alcance:
  No integrar todavía el renderer en el flujo final de `App`. No introducir acciones, navegación, formularios, estado compartido, datos remotos, visibilidad condicional ni theming amplio.
- Dependencias:
  Depende de `0002-T01`, porque solo debe consumir un contrato ya validado y un modelo explícito de errores.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    nuevos módulos en `src/runtime/` para renderizar nodos de layout y mapear props soportadas por tipo, y posibles utilidades de presentación o componentes acotados en `src/app/` o `src/runtime/`.
  - Tests a crear o modificar:
    nuevos tests unitarios e integration tests del renderer en `src/tests/` para árboles válidos, contenedores anidados, `heading.level`, párrafos y listas.
  - Documentación a revisar o actualizar:
    `ai-workflow/docs/app-features/config-driven-ui-runtime.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Integration tests del renderer con una página válida que combine `container`, `heading`, `paragraph` y `list`.
  - Tests del comportamiento de `container` con `children` vacíos o ausentes.
  - Tests del render de `list` con `items` vacíos sin inventar contenido adicional.
  - Tests que confirmen que `heading`, `paragraph` y `list` se tratan como nodos hoja y no renderizan `children` aunque existan en la entrada.
  - Reejecutar `pnpm test` al cerrar la tarea.
- Documentación afectada:
  Sí. La pasada documental deberá registrar el primer catálogo de nodos soportados y sus props mínimas (`direction`, `gap`, `text`, `level`, `items`).
- Criterios de finalización:
  - Existe un renderer declarativo aislado del bootstrap que recorre el árbol de layout sin depender del shell provisional.
  - Los cuatro tipos soportados renderizan una salida visible y legible con estilos mínimos coherentes.
  - El renderer no interpreta nodos no soportados como si fueran otro componente ni ejecuta comportamiento fuera de alcance.
  - El comportamiento de nodos hoja y contenedores queda cubierto por tests observables.
- Cierre de implementación:
  Completo cuando el renderer de layout y sus tests están verdes y consumen exclusivamente el contrato fijado por `0002-T01`.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. No debe cerrarse sin actualizar la descripción del runtime estático disponible.

---

## `0002-T03` - Integración en `App`, sustitución del shell provisional y cierre de errores visibles

- Estado: `completed`
- Objetivo:
  Sustituir el shell de bootstrap actual por la primera experiencia real de runtime estático, integrando la resolución de la página inicial, el renderer de layout y los estados de error visibles en desarrollo, mientras en producción la degradación no muestra un mensaje genérico al usuario ni inventa contenido.
- Fuera de alcance:
  No reintroducir `title` o `description` de página fuera de `layout`. No añadir navegación interactiva, `preloads`, formularios, queries ni panel de edición local.
- Dependencias:
  Depende de `0002-T02`. Bloquea el cierre de la feature porque conecta bootstrap, validación y render visible de extremo a extremo.
- Impacto esperado en archivos:
  - Código a crear o modificar:
    `src/app/App.tsx`, `src/app/app-shell.tsx` o su sustituto directo, posibles componentes de error o runtime page en `src/app/` o `src/runtime/`, `src/app/index.css` si hace falta ajustar estilos mínimos globales y `src/main.tsx` solo si la integración lo exige.
  - Tests a crear o modificar:
    `src/tests/app-bootstrap.test.tsx`, `src/tests/app-shell.test.tsx` o sus equivalentes actualizados al nuevo comportamiento visible, y cualquier test de integración adicional necesario para errores de desarrollo y degradación en producción.
  - Documentación a revisar o actualizar:
    `ai-workflow/docs/app-features/config-driven-ui-runtime.md`, `ai-workflow/docs/app-features/config-contract.md`, `ai-workflow/docs/app-features/pages-and-navigation.md`, `ai-workflow/docs/current-state.md`.
- Tests requeridos:
  - Integration tests de `App` mostrando la página resuelta por `initialPage` cuando hay varias páginas declaradas.
  - Integration tests del error visible y diagnóstico en desarrollo para `initialPage` inexistente, `layout` inválido y nodo no soportado.
  - Integration tests de degradación en producción para confirmar que no se muestra un mensaje genérico visible al usuario cuando el layout es inválido o el nodo no está soportado.
  - Reejecutar `pnpm lint`, `pnpm test` y `pnpm build` al cerrar la tarea y la pasada completa.
- Documentación afectada:
  Sí. La pasada documental posterior deberá reflejar que el shell provisional desaparece y que el estado vigente del producto ya incluye un renderer estático inicial sin navegación ni datos remotos.
- Criterios de finalización:
  - `App` deja de renderizar el shell provisional y pasa a mostrar la página declarativa resuelta desde la configuración activa.
  - Si existen varias páginas válidas, solo se muestra la indicada por `initialPage`.
  - Los errores de configuración son visibles y diagnósticos en desarrollo.
  - En producción, la degradación evita mostrar mensajes genéricos al usuario y no sustituye el layout fallido por contenido inventado.
  - La aplicación sigue arrancando desde `src/dev/config.json` y desde `data-config` con el comportamiento observable esperado.
- Cierre de implementación:
  Completo cuando la integración visible del runtime estático y sus validaciones finales (`pnpm lint`, `pnpm test`, `pnpm build`) quedan verdes con el gate de cobertura intacto.
- Cierre documental:
  Pendiente hasta la pasada documental de la feature. Esa pasada deberá actualizar las fichas funcionales afectadas y dejar el estado listo para transición a `documentation`.
