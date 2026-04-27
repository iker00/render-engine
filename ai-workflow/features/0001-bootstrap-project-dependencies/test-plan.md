# Test Plan: Feature 0001 - bootstrap-project-dependencies

## Objetivo del plan
Validar que la feature deja un bootstrap reproducible, arrancable y verificable para el frontend, sin adelantar capacidades funcionales del runtime que todavía no forman parte del alcance.

## Cobertura y gate global
- El gate de cierre sigue siendo el estándar global del repositorio: mínimo del 80% en `functions`, `lines` y `statements` sobre `src/`.
- `pnpm test` debe ser el comando que aplique ese gate en la implementación final de la feature.
- La skill de implementación debe tratar `pnpm lint`, `pnpm test` y `pnpm build` como validaciones obligatorias al cerrar las tareas que introduzcan o modifiquen código ejecutable.

## Bloques de tests esperados

### 1. Validación de scaffold y arranque base
- Tipo:
  Validación operativa del scaffold, sin e2e.
- Tareas a las que aplica:
  `0001-T01`
- Qué valida:
  - Que el repositorio instala dependencias desde un manifiesto único y versionado.
  - Que el servidor de desarrollo arranca sin errores de bootstrap.
  - Que el bundle de producción compila.
- Comandos de validación:
  - `pnpm install`
  - `pnpm dev` para smoke manual del arranque
  - `pnpm build`

### 2. Unit tests del baseline de calidad
- Tipo:
  Unit tests.
- Tareas a las que aplica:
  `0001-T02`
- Qué valida:
  - Que el shell inicial renderiza el estado visible esperado.
  - Que la infraestructura de test queda conectada correctamente a React y al DOM de pruebas.
  - Que la cobertura se mide sobre `src/` y forma parte del cierre de `pnpm test`.
- Archivos de test esperados:
  - `src/tests/app-shell.test.tsx` o equivalente.
- Comandos de validación:
  - `pnpm lint`
  - `pnpm test`

### 3. Unit tests de resolución de configuración
- Tipo:
  Unit tests.
- Tareas a las que aplica:
  `0001-T03`
- Qué valida:
  - Selección de `src/dev/config.json` en desarrollo local.
  - Lectura y parseo de `data-config` cuando el root HTML la aporta.
  - Respuesta controlada cuando la entrada falta o no puede parsearse.
- Archivos de test esperados:
  - `src/tests/read-runtime-config.test.ts` o equivalente.
- Comandos de validación:
  - `pnpm test`

### 4. Integration tests del bootstrap React
- Tipo:
  Integration tests.
- Tareas a las que aplica:
  `0001-T03`
- Qué valida:
  - Que la aplicación arranca mostrando el shell conectado a la fuente de configuración correcta.
  - Que un `data-config` válido produce el estado esperado en el arranque.
  - Que una configuración ausente o inválida muestra feedback comprensible en lugar de un fallo opaco.
- Archivos de test esperados:
  - `src/tests/app-bootstrap.test.tsx` o equivalente.
- Comandos de validación:
  - `pnpm test`
  - `pnpm build`

## Tests e2e
- No aplican en esta feature.
- Razón:
  El alcance es bootstrap técnico local y aún no existe un runtime funcional ni flujo de usuario estable que justifique automatización de navegador.

## Secuencia recomendada de validación durante implementación
1. En `0001-T01`, validar instalación, arranque y build antes de avanzar.
2. En `0001-T02`, introducir el primer test automatizado y dejar `pnpm lint` y `pnpm test` verdes con el gate de cobertura activo.
3. En `0001-T03`, ampliar primero los tests de bootstrap/configuración y después completar la implementación hasta volver a dejar verdes `pnpm lint`, `pnpm test` y `pnpm build`.

## Criterio de cierre de la feature
- No debe considerarse lista para pasar a documentación si cualquiera de estos puntos falla:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - gate de cobertura del 80% sobre `src/`
