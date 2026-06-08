# Tasks: dev-mode enable in production (0067)

Contrato de ejecución para la implementación. Las tareas están ordenadas; cada tarea debe completarse antes de iniciar la siguiente.

---

## T1 — Reajustar el bundle gate al alcance del entry chunk

### Estado
completada

### Objetivo
Refinar el gate de bundle de `DevRuntime` (`src/tests/dev-runtime/dev-runtime-bundle.test.ts`) para que verifique la frontera que la spec realmente exige: el bundle inicial de producción (entry chunk y chunks estáticamente preloaded por `index.html`) no contiene marcadores de `DevRuntime`/Monaco. Los chunks lazy emitidos por Vite, que solo se descargan tras una decisión en runtime, quedan fuera del alcance del gate.

La motivación es estrictamente preparar el contrato para T2: tras T2, `main.tsx` mantendrá un `import()` dinámico de `DevRuntime` que Vite emitirá como chunk separado en `dist/assets/`. Ese chunk lazy debe poder existir sin romper el gate. La versión actual del gate, que escanea toda la carpeta `dist/assets/`, es demasiado estricta respecto al NFR1 de la spec (que habla de "bundle inicial", no del directorio completo).

Esta tarea no toca código de runtime. Solo refina el test para acotarlo a su contrato observable real.

### Fuera de alcance
- Modificaciones en `src/main.tsx` o cualquier código de producción: pertenecen a T2.
- Introducir helpers reusables nuevos para parsear `dist/index.html` en otros tests; cualquier extracción de utilidad queda diferida hasta que aparezca un segundo consumidor.
- Cambios en la lista `FORBIDDEN_MARKERS`. La intención del gate (excluir Monaco, `@monaco-editor/react`, `MonacoEnvironment`, `DevRuntime`, `runtimeConfigRootSchema` del bundle inicial) se conserva.
- Cambios en el build de producción, `vite.config.ts` o las opciones de `define` del test.

### Dependencias
Ninguna.

### Impacto esperado en archivos

- Código: ninguno.

- Tests:
  - `src/tests/dev-runtime/dev-runtime-bundle.test.ts` (ampliación) — sustituir la iteración sobre todos los `*.js` de `dist/assets/` por una iteración acotada al entry chunk y a los chunks estáticamente referenciados por `dist/index.html`. La estrategia recomendada:
    1. Tras el `build`, leer `dist/index.html` con `readFile`.
    2. Extraer las rutas de los `<script type="module" src="...">` y los `<link rel="modulepreload" href="...">`, normalizándolas relativo al directorio `dist/` (eliminar prefijo `/`).
    3. Construir el set de ficheros de bundle inicial: rutas extraídas que apunten a ficheros bajo `assets/` y que terminen en `.js`.
    4. Para cada marcador en `FORBIDDEN_MARKERS`, leer únicamente los ficheros de ese set y comprobar que ninguno contiene el marcador.
    5. Mantener el caso que verifica `dist/assets/` con al menos un `*.js` (no se elimina; se mantiene como sanity check del build).
  - El mensaje de error de fallo debe seguir indicando el fichero exacto y el marcador, e incluir un texto adicional aclarando que el alcance del gate es el bundle inicial referenciado desde `index.html`.

- Documentación: ninguna.

### Tests

#### Ficheros de test
- `src/tests/dev-runtime/dev-runtime-bundle.test.ts` (ampliación)

#### Comportamiento cubierto
- Tras un build de producción, `dist/index.html` referencia al menos un script de módulo bajo `assets/*.js`.
- Para cada marcador de `FORBIDDEN_MARKERS`, ninguno de los ficheros JS referenciados estáticamente desde `dist/index.html` (entry + `modulepreload`) lo contiene.
- El caso de sanity preexistente sobre `dist/assets/` (al menos un `*.js`) sigue pasando.
- Si tras un build no se detecta ningún script de módulo en `index.html`, el test falla con un error explícito (la regresión sería que el HTML no engancha el bundle).

#### Comandos durante la implementación
- `pnpm test --run src/tests/dev-runtime/dev-runtime-bundle.test.ts`

#### Restricciones
- No introducir librerías de parsing HTML. Reusar expresiones regulares simples y deterministas sobre el contenido de `dist/index.html`, igual que el resto de tests del repo que inspeccionan ficheros generados.
- No tocar el `beforeAll` que ejecuta `vite.build` ni sus opciones `define`. El alcance del cambio es la fase de aserción.
- Mantener el orden y la semántica de los `it(...)` existentes en la medida de lo posible: el test del sanity check sobre `dist/assets/` debe conservarse; los `it` por marcador se reescriben para usar el set acotado al entry.
- No introducir helpers compartidos nuevos en este fichero. La extracción del set de ficheros del entry vive como función local dentro del propio fichero de test.
- No verificar todavía la existencia del chunk lazy de `DevRuntime`. Esa verificación pertenecería a T2 si la spec lo requiriera; por ahora la spec exige no estar en el bundle inicial, no estar presente como chunk separado.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — la sección "Activación" deberá reflejar la nueva condición por atributo al cerrar la feature vía `update-app-documentation`. T1 no introduce el comportamiento todavía, así que esta entrada solo queda registrada como contexto para la pasada documental posterior.

### Criterios de finalización
- El gate de bundle escanea exclusivamente el conjunto de ficheros JS referenciados estáticamente desde `dist/index.html`.
- Los marcadores `monaco-editor`, `@monaco-editor/react`, `MonacoEnvironment`, `DevRuntime`, `runtimeConfigRootSchema` no aparecen en ese conjunto tras el build (estado actual: sigue pasando porque el `import()` de DevRuntime aún está bajo la rama dead-code-eliminada `import.meta.env.DEV`).
- `pnpm test --run src/tests/dev-runtime/dev-runtime-bundle.test.ts` pasa en verde.
- `pnpm test` sigue cumpliendo el umbral del 80 % de cobertura.

### Cierre de implementación
T1 está cerrada cuando el gate del bundle ha sido reacotado al entry chunk, los tests del fichero pasan en verde, y `pnpm test` no rompe regresiones ni cobertura.

---

## T2 — Activar `DevRuntime` en producción cuando el root tiene `data-enable-dev-mode`

### Estado
completada

### Objetivo
Permitir que `DevRuntime` se monte en builds de producción cuando el elemento raíz del runtime contenga el atributo HTML `data-enable-dev-mode` en el momento del bootstrap, manteniendo intacto el comportamiento de desarrollo (`import.meta.env.DEV === true` siempre monta `DevRuntime`).

La decisión se factoriza en una función pura `shouldMountDevRuntime(rootElement, isDev)` que vive en `src/app/bootstrap/should-mount-dev-runtime.ts`. Esto hace la lógica testeable por unidades sin depender de `import.meta.env.DEV` (constante en tiempo de compilación en Vitest) y separa la decisión del cableado React. `main.tsx` consume el helper pasándole `import.meta.env.DEV` como parámetro explícito.

El `import()` dinámico de `./dev-runtime/dev-runtime` debe permanecer dentro de la rama positiva de la decisión, de manera que en producción solo se solicite el chunk cuando el atributo está presente. El refinamiento del bundle gate hecho en T1 garantiza que la coexistencia del chunk lazy no rompe el contrato del bundle inicial.

### Fuera de alcance
- Cambios en el comportamiento interno de `DevRuntime`, el editor Monaco o el drawer. La feature solo añade un segundo gate de activación al bootstrap.
- Persistencia, autenticación o validación del valor del atributo. Solo se comprueba presencia con `hasAttribute`.
- Activación dinámica tras el montaje: el atributo se lee una sola vez en bootstrap; modificaciones posteriores en DevTools no tienen efecto. No se añade observador ni listener.
- Cambios en `vite.config.ts`, en `define` ni en el proceso de build.
- Un modo "solo lectura" del editor para producción.
- Cualquier cambio en `dev-runtime-bundle.test.ts`. T1 ya dejó el gate listo para absorber la nueva configuración de chunks.
- Documentación funcional bajo `ai-workflow/docs/`. La actualización de `dev-mode-editor.md` y del índice de development corresponde a `update-app-documentation` al cerrar la feature.

### Dependencias
T1.

### Impacto esperado en archivos

- Código:
  - `src/app/bootstrap/should-mount-dev-runtime.ts` (nuevo) — exporta una función pura:
    ```ts
    export function shouldMountDevRuntime(
      rootElement: HTMLElement | null,
      isDev: boolean,
    ): boolean
    ```
    Reglas:
    - Si `rootElement` es `null`, devuelve `false` (no hay sobre qué decidir; el bootstrap reproducirá el fallo de `createRoot` igual que hoy).
    - Si `isDev` es `true`, devuelve `true` con independencia del atributo.
    - Si `isDev` es `false`, devuelve `rootElement.hasAttribute('data-enable-dev-mode')`.
    No realiza side effects. No lee `import.meta.env.DEV` (lo recibe por parámetro).
  - `src/main.tsx` — sustituir la condición actual `import.meta.env.DEV` por una llamada al helper. La estructura recomendada:
    ```ts
    import { shouldMountDevRuntime } from './app/bootstrap/should-mount-dev-runtime'
    ...
    const rootElement = document.getElementById('root')!
    const root = ReactDOM.createRoot(rootElement)
    if (shouldMountDevRuntime(rootElement, import.meta.env.DEV)) {
      const { DevRuntime } = await import('./dev-runtime/dev-runtime')
      root.render(<React.StrictMode><DevRuntime /></React.StrictMode>)
    } else {
      root.render(<React.StrictMode><App /></React.StrictMode>)
    }
    ```
    Mantener `void bootstrap()` y la signatura `async function bootstrap()` como están. El `!` sobre `getElementById('root')` se conserva para preservar el comportamiento de fallo de bootstrap definido por la spec en "Casos límite".

- Tests:
  - `src/tests/app/should-mount-dev-runtime.test.ts` (nuevo) — cubre el helper como función pura sin tocar React ni el DOM real más allá de `document.createElement('div')`.
  - `src/tests/app/main.test.tsx` (ampliación) — añadir como mucho un caso de regresión que confirme que `DevRuntime` sigue montándose cuando el root tiene el atributo en modo DEV (el resto del comportamiento bajo `import.meta.env.DEV === true` ya está cubierto). No se introducen casos de producción aquí porque `import.meta.env.DEV` es constante en compilación bajo Vitest; la cobertura de la rama de producción vive en el helper.

- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Activación". La actualización se hace al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.
  - `ai-workflow/docs/app-features/development/index.md` — sin cambios estructurales esperados; revisar al actualizar la ficha.

### Tests

#### Ficheros de test
- `src/tests/app/should-mount-dev-runtime.test.ts` (nuevo)
- `src/tests/app/main.test.tsx` (ampliación)

#### Comportamiento cubierto

Helper `shouldMountDevRuntime`:
- Devuelve `true` cuando `isDev === true` y el `rootElement` no tiene el atributo.
- Devuelve `true` cuando `isDev === true` y el `rootElement` tiene el atributo (precedencia del flag DEV).
- Devuelve `true` cuando `isDev === false` y el `rootElement` tiene `data-enable-dev-mode` con valor vacío (`setAttribute('data-enable-dev-mode', '')`).
- Devuelve `true` cuando `isDev === false` y el `rootElement` tiene `data-enable-dev-mode` con un valor arbitrario de string (p. ej. `'true'`, `'false'`, `'1'`, `'yes'`); el valor es irrelevante.
- Devuelve `false` cuando `isDev === false` y el `rootElement` no tiene el atributo.
- Devuelve `false` cuando `rootElement` es `null`, con independencia de `isDev` (incluye el caso `isDev: true` con root null para documentar que la decisión no monta DevRuntime si no hay raíz).

`main.tsx`:
- Caso de regresión: cuando el root tiene `data-enable-dev-mode` y el entorno es DEV (Vitest), `DevRuntime` se monta exactamente una vez (mismo aserto que el caso existente "mounts DevRuntime when import.meta.env.DEV is true"). Sirve para garantizar que el helper se ha cableado correctamente y no se ha introducido un short-circuit que rompa el camino actual.
- Los tests preexistentes siguen pasando sin modificación funcional: `createRoot` se llama con `#root`, `render` se invoca exactamente una vez, y `DevRuntime` (no `App`) se monta en el camino DEV por defecto.

#### Comandos durante la implementación
- `pnpm test --run src/tests/app/should-mount-dev-runtime.test.ts`
- `pnpm test --run src/tests/app/main.test.tsx`
- `pnpm test --run src/tests/dev-runtime/dev-runtime-bundle.test.ts`

#### Restricciones
- Construir el `rootElement` de los tests del helper con `document.createElement('div')` y `setAttribute`; no inyectarlo en `document.body` salvo que un test lo requiera explícitamente.
- No usar mocks para `import.meta.env.DEV` dentro de `should-mount-dev-runtime.test.ts`: el helper recibe `isDev` por parámetro, así que basta con pasar `true`/`false`.
- En `main.test.tsx` reusar el patrón existente (`vi.mock('react-dom/client', ...)`, `vi.mock('../../dev-runtime/dev-runtime', ...)`, `vi.resetModules()` por test). No introducir un harness nuevo; el caso de regresión añade el atributo sobre `#root` antes del `import('../../main')`.
- No reescribir la nota final de `main.test.tsx` que documenta la limitación de Vitest sobre `import.meta.env.DEV`; ajustarla si procede para reflejar que la rama de producción se cubre vía el helper.
- No introducir snapshots ni assertions sobre `className`/strings completos del DOM en estos tests.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Activación" deja de afirmar que la decisión es exclusivamente estructural y pasa a describir las dos condiciones: `import.meta.env.DEV` o presencia de `data-enable-dev-mode` en el root.
- `ai-workflow/docs/app-features/development/index.md` — revisar el resumen de la subsección para no contradecir la nueva ficha; no se espera reescritura amplia.

La actualización documental se ejecuta al cerrar las tareas de implementación vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- `shouldMountDevRuntime` está implementado como función pura en `src/app/bootstrap/should-mount-dev-runtime.ts` y cubierto por su fichero de tests con los seis casos enumerados.
- `src/main.tsx` consume el helper y mantiene el `import()` dinámico de `DevRuntime` dentro de la rama positiva; el comportamiento DEV preexistente está intacto.
- En un build de producción sin el atributo, `App` se monta y el chunk de `DevRuntime` no se descarga (el chunk puede existir como recurso lazy en `dist/assets/`, pero el bundle inicial no lo referencia).
- En un build de producción con el atributo, `DevRuntime` se monta y el chunk lazy se descarga.
- `pnpm test` sigue cumpliendo el umbral del 80 % de cobertura.

### Cierre de implementación
T2 está cerrada cuando el helper, su test y la integración en `main.tsx` están en su sitio, los tests indicados pasan en verde y `pnpm test` no rompe regresiones ni cobertura. Al cerrar T2 la feature queda lista para invocar `update-app-documentation`, que se encarga de reflejar la nueva activación en `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

---

## Próxima tarea
T1 — Reajustar el bundle gate al alcance del entry chunk.
