# Test Plan: Declarative page navigation actions

## Objetivo
Validar que el runtime puede declarar botones de navegación dentro del `layout`, ejecutar `navigateTo` y `goBack` sobre el historial interno ya existente, reutilizar la reentrada con `preloads` y mantener el gate global de cobertura sin romper configuraciones previas sin interactividad.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada final.

## Bloques de tests esperados

### 1. Contrato del nodo `button` y de sus acciones
Tipo:
- Unit tests de validación estructural del config

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` solo si hace falta cubrir el borde `data-config`

Comportamiento que valida:
- aceptación de `button` con `label` visible y acción `navigateTo` hacia una página existente
- aceptación de `button` con acción `goBack`
- aceptación de varios botones en el mismo `layout`
- aceptación pragmática de claves extra no soportadas en `button.props` o `action`, verificando que no sobreviven al objeto validado final
- tratamiento de `button` como nodo hoja aunque el config incluya `children`
- rechazo de `button` sin `props`, sin `label` o con `label` inválida
- rechazo de acciones sin `type` válido
- rechazo de `navigateTo` sin `pageId`, con `pageId` vacío o con destino inexistente
- compatibilidad hacia atrás de configuraciones sin nodos `button`

Momento de ejecución:
- durante `T0011-01`
- repetir en `T0011-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### 2. Historial interno y semántica de `goBack`
Tipo:
- Unit e integration tests del store compartido y del provider de navegación

Archivos principales:
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`

Comportamiento que valida:
- continuidad de `navigateToPage(pageId)` hacia una página distinta
- `no-op` al navegar a la misma página visible
- retorno correcto con `goBack` tras secuencias como `home -> details -> home`
- poda de la entrada actual del historial al volver atrás
- `no-op` de `goBack` cuando no existe página previa válida
- mantenimiento del error recuperable `page-not-found` solo para navegación imperativa inválida
- reentrada de página con nuevo disparo de `preloads` al volver atrás

Momento de ejecución:
- durante `T0011-02`
- repetir en `T0011-03` y `T0011-04` como parte de la integración final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### 3. Render y ejecución declarativa del botón
Tipo:
- Integration tests del renderer del runtime con interacción de usuario

Archivos principales:
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`

Comportamiento que valida:
- render de un `<button type="button">` con etiqueta visible
- semántica de nodo hoja para `button` aunque llegue con `children`
- navegación efectiva a otra página declarada al activar `navigateTo`
- `no-op` al activar `navigateTo` hacia la misma página visible
- retorno a la página previa válida al activar `goBack`
- `no-op` visible cuando no existe historial previo
- coexistencia de varios botones de navegación dentro de la misma página
- determinismo de la navegación visible ante activaciones rápidas sucesivas
- reutilización del ciclo de `preloads` al entrar por un botón en páginas que los declaran

Momento de ejecución:
- durante `T0011-03`
- repetir en `T0011-04` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### 4. Regresión final del runtime y gate global
Tipo:
- Integration test de regresión del subconjunto afectado del runtime

Archivos principales:
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/tests/runtime-state.test.tsx`
- `src/tests/runtime-page-entry-preloads.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-button-navigation.test.tsx`
- `src/tests/app-shell.test.tsx` solo si aparece impacto real en el arranque visible

Comportamiento que valida:
- continuidad del arranque y del render actual para configuraciones sin botones
- coherencia entre validación del config, historial interno y ejecución declarativa
- reentrada con `preloads` al navegar y al volver atrás
- ausencia de errores recuperables espurios al hacer `goBack` sin historial
- mantenimiento del error recuperable para navegación imperativa inválida
- cumplimiento del gate global de coverage

Momento de ejecución:
- durante `T0011-04`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## Secuencia recomendada tests-first
1. En `T0011-01`, fijar primero por tests qué shapes de `button` y de acción son válidos e inválidos antes de tocar tipos y validación.
2. En `T0011-02`, fijar primero por tests la semántica exacta del historial y de `goBack` antes de ajustar reducer y provider.
3. En `T0011-03`, escribir primero los tests de interacción del botón y de reentrada con `preloads` antes de cablear el nuevo nodo y el ejecutor declarativo.
4. En `T0011-04`, ejecutar la regresión del subconjunto relevante y cerrar con `pnpm test`.

## Comandos de regresión por tarea

### T0011-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0011-02
```bash
pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### T0011-03
```bash
pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-page-entry-preloads.test.tsx
```

### T0011-04
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio sigue acotado a contrato JSON, store compartido, renderer declarativo e interacción en memoria; no introduce routing real de navegador ni un flujo extremo a extremo dependiente de URL.
