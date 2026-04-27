# Test Plan: Tailwind runtime styling baseline

## Objetivo
Validar que la migración del styling visible del runtime a `Tailwind CSS` mantiene el contrato funcional actual y deja una convención clara para futuras extensiones sin introducir todavía theming.

## Cobertura exigida al cierre
- El gate global del proyecto sigue siendo `pnpm test`.
- `pnpm test` debe mantener el umbral mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- Ninguna tarea de implementación puede darse por cerrada sin sus tests relevantes en verde y sin ejecutar `pnpm test` al cierre de la pasada.

## Bloques de tests esperados

### 1. Convención de styling del runtime
Tipo:
- Unit test sobre la utilidad o módulo que compone clases y resuelve compatibilidad de `gap`

Archivo principal:
- `src/tests/` en un archivo específico para la convención de styling del runtime

Comportamiento que valida:
- clases base estables para `container`, `heading`, `paragraph` y `list`
- mapeo correcto de alias de `gap` ya soportados hoy
- compatibilidad explícita para valores arbitrarios de `gap` mediante la excepción acotada elegida en planificación
- ausencia de una API nueva de estilos configurables desde JSON

Momento de ejecución:
- durante `T0005-01`
- repetir en `T0005-02` como parte de la regresión final

Comando recomendado:

```bash
pnpm exec vitest run src/tests/<runtime-styling-test>.test.ts
```

### 2. Renderer visible de layout
Tipo:
- Integration test del runtime renderizado

Archivo principal:
- `src/tests/layout-renderer.test.tsx`

Comportamiento que valida:
- orden visible de varios nodos raíz sin wrapper sintético
- continuidad del contenido renderizado para `heading`, `paragraph`, `container` y `list`
- conservación del tag semántico del `heading` según `level`
- tratamiento de `heading`, `paragraph` y `list` como nodos hoja
- continuidad de `direction` y `gap` en `container`, incluyendo alias soportado y valor arbitrario compatible
- sustitución del mecanismo principal de estilos inline por clases de `Tailwind` en los nodos soportados

Momento de ejecución:
- durante `T0005-02`

Comando recomendado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

### 3. Regresión de bootstrap y shell
Tipo:
- Integration test de arranque y montaje visible

Archivos principales:
- `src/tests/app-bootstrap.test.tsx`
- `src/tests/app-shell.test.tsx` solo si la migración exige tocar el contenedor visible del runtime

Comportamiento que valida:
- la aplicación sigue renderizando exclusivamente la página resuelta por `initialPage`
- los errores de configuración y degradaciones de desarrollo/producción mantienen el comportamiento existente
- la migración visual del runtime no rompe el montaje de la app ni sus superficies de error

Momento de ejecución:
- al cierre de `T0005-02` como regresión de integración

Comando recomendado:

```bash
pnpm exec vitest run src/tests/app-bootstrap.test.tsx
```

## Secuencia recomendada tests-first
1. En `T0005-01`, empezar por el test de la convención de styling para fijar la resolución de clases y la compatibilidad de `gap`.
2. Implementar la utilidad o módulo de styling hasta dejar ese bloque en verde.
3. En `T0005-02`, endurecer `layout-renderer.test.tsx` para cubrir clases base, semántica de `heading` y compatibilidad de `gap` antes de terminar la migración de nodos.
4. Cerrar la pasada con la regresión de bootstrap relevante y `pnpm test`.

## Comandos de regresión por tarea

### T0005-01
```bash
pnpm exec vitest run src/tests/<runtime-styling-test>.test.ts
```

### T0005-02
```bash
pnpm exec vitest run src/tests/<runtime-styling-test>.test.ts src/tests/layout-renderer.test.tsx src/tests/app-bootstrap.test.tsx
pnpm test
```

## E2E
- No aplican en esta feature.
- El cambio no introduce flujos nuevos de usuario ni navegación de navegador; solo alinea el mecanismo de styling del runtime ya existente.
