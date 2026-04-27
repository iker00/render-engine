# Test Plan: Runtime structure reorganization

## Objetivo
Validar que la reorganización interna del runtime mantiene intacto el comportamiento observable del contrato actual mientras separa responsabilidades en `config/` y `runtime/`.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin volver a ejecutar `pnpm test` al cierre de la pasada.

## Bloques de tests esperados

### 1. Validación del contrato de configuración
Tipo:
- Unit / integration ligera sobre el validador

Archivo principal:
- `src/tests/runtime-config-validation.test.ts`

Comportamiento que valida:
- aceptación de páginas válidas con varios hermanos en `layout`
- aceptación de `layout: []`
- rechazo explícito del shape raíz antiguo basado en objeto
- rechazo explícito de `children` inválidos en `container`
- clasificación de nodos no soportados en raíz y anidados
- resolución de error cuando `initialPage` no coincide con ninguna página

Momento de ejecución:
- durante `T0004-01`
- repetir en `T0004-03` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

### 2. Lectura de configuración en bootstrap
Tipo:
- Integration test de bootstrap de configuración

Archivo principal:
- `src/tests/read-runtime-config.test.ts`

Comportamiento que valida:
- prioridad de `data-config` cuando existe
- uso de `dev-config` en desarrollo cuando no existe `data-config`
- error legible para JSON inválido
- error legible cuando falta una fuente soportada de configuración

Momento de ejecución:
- durante `T0004-01` si cambia la superficie pública de `config/`
- durante `T0004-03` como validación de integración del bootstrap

Comando recomendado:

```bash
pnpm exec vitest run src/tests/read-runtime-config.test.ts
```

### 3. Renderer estático reorganizado
Tipo:
- Integration test de composición visible del runtime

Archivo principal:
- `src/tests/layout-renderer.test.tsx`

Comportamiento que valida:
- orden visible de varios nodos raíz
- ausencia de wrapper sintético alrededor de hermanos raíz
- página vacía cuando `layout` es `[]`
- lista vacía sin placeholders
- tratamiento de `heading`, `paragraph` y `list` como nodos hoja aunque reciban `children`
- continuidad del render de `container` y sus hijos tras mover la lógica a piezas por nodo

Momento de ejecución:
- durante `T0004-02`
- repetir en `T0004-03` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

### 4. Bootstrap visible de la aplicación
Tipo:
- Integration test de la app sobre runtime reorganizado

Archivo principal:
- `src/tests/app-bootstrap.test.tsx`

Comportamiento que valida:
- render exclusivo de la página resuelta por `initialPage`
- prioridad de la página procedente de `data-config`
- errores visibles en desarrollo para `initialPage` inválido, `layout` inválido y nodos no soportados
- degradación silenciosa en producción para errores `development-only`
- error visible cuando falta configuración fuera de desarrollo

Momento de ejecución:
- durante `T0004-03`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/app-bootstrap.test.tsx
```

## Secuencia recomendada tests-first
1. En `T0004-01`, empezar por los tests de validación (`runtime-config-validation`) y, si la fachada pública cambia, ejecutar también `read-runtime-config`.
2. En `T0004-02`, usar `layout-renderer.test.tsx` como red principal antes y después del movimiento del renderer.
3. En `T0004-03`, ejecutar juntos los tests de bootstrap y la regresión del runtime reorganizado.
4. Cerrar la pasada con `pnpm test`.

## Comandos de regresión por tarea

### T0004-01
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts
```

### T0004-02
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

### T0004-03
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/app-bootstrap.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- La reorganización no introduce flujos de navegador nuevos ni interacción de usuario adicional.
