# Tasks: Runtime nodes code splitting

Feature: `0087-runtime-nodes-code-splitting`
Spec de referencia: [spec.md](./spec.md)
Design de referencia: [design.md](./design.md)

Orden de ejecución obligatorio: T001 → T002 → T003 → T004.

---

## T001 — Mapa central de componentes de nodo con eager en test y lazy en dev/prod

### Estado

completada

### Objetivo

Introducir el módulo `src/runtime/nodes/node-components-map.ts` que centraliza la resolución `type → ComponentType` para
todos los nodos del runtime, exponiendo un único mapa estable `NodeComponents`. El módulo decide en build-time entre dos
variantes según `import.meta.env.MODE`:

- Cuando `import.meta.env.MODE === 'test'`: el mapa expone imports estáticos directos de cada nodo (eager). Renderizar
  `NodeComponents[type]` produce el componente síncronamente, sin Suspense.
- En cualquier otro modo (dev/prod): cada entrada es un
  `React.lazy(() => import('./<archivo>-layout-node').then(m => ({ default: m.<NodeName> })))`. El adaptador
  `.then(...)` traduce el named export del archivo de nodo a `default`, sin tocar los archivos de nodo.

El mapa debe contener exactamente una entrada por cada `node.type` que hoy maneja el switch de
`layout-node-renderer.tsx`. Lista cerrada de claves (orden alfabético interno irrelevante; lo relevante es la
cobertura): `accordion`, `alert`, `badge`, `button`, `checkboxGroup`, `container`, `divider`, `fileManager`, `form`,
`heading`, `image`, `input`, `link`, `list`, `modal`, `paragraph`, `radioGroup`, `repeater`, `select`, `skeleton`,
`stat`, `table`, `tabs`, `textarea`.

El módulo solo expone el mapa. No introduce wrappers Suspense/ErrorBoundary, no instancia componentes y no contiene
lógica de render. `layout-node-renderer.tsx` no se modifica todavía: esta tarea no lo cablea.

### Fuera de alcance

- Modificar `layout-node-renderer.tsx` (es T003).
- Introducir o cablear el wrapper `LazyNode` con Suspense + ErrorBoundary (es T002).
- Añadir `export default` a cualquier archivo bajo `src/runtime/nodes/` (la adaptación named → default vive solo en el
  mapa).
- Granular el code splitting por subcomponentes de un nodo (p. ej. archivos auxiliares dentro de `nodes/file-manager/`);
  Vite/Rollup decide automáticamente si caen en el chunk del nodo o en un chunk compartido.
- Documentar el cambio en `ai-workflow/docs/`.

### Dependencias

Ninguna.

### Impacto esperado en archivos

- Código:
    - `src/runtime/nodes/node-components-map.ts` (nuevo) — exporta `NodeComponents` con las dos variantes condicionadas
      por `import.meta.env.MODE`.
- Tests:
    - `src/tests/runtime/runtime-node-components-map.test.tsx` (nuevo) — unit tests sobre el contenido del mapa en modo
      test.
- Documentación:
    - Ninguna en esta tarea. La actualización de `ai-workflow/docs/app-features/runtime/organization.md` y/o
      `error-behavior.md` se difiere a la pasada `update-app-documentation` tras T004.

### Tests

- **Ficheros de test**:
    - `src/tests/runtime/runtime-node-components-map.test.tsx` (nuevo)
- **Comportamiento cubierto**:
    - el mapa exporta exactamente las 24 claves enumeradas en el objetivo, sin claves extra ni faltantes (assertion
      sobre `Object.keys(NodeComponents)`)
    - cada valor del mapa es truthy (no `undefined`)
    - renderizando un `NodeComponents.container` mínimo dentro del provider del runtime, su salida aparece síncronamente
      en el primer render sin necesidad de `findBy*` ni `waitFor` (demuestra rama eager activa en modo test)
    - mismo render para un segundo nodo de naturaleza distinta, p. ej. `NodeComponents.heading` con un texto simple,
      sale en el primer render sin Suspense fallback intermedio
    - un tercer nodo de naturaleza distinta, p. ej. `NodeComponents.divider`, sale en el primer render
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-node-components-map.test.tsx`
- **Restricciones**:
    - reusar helpers existentes de la carpeta `src/tests/layout-renderer/` (p. ej. wrappers de provider y construcción
      de `LayoutNode` mínimos) si ya existen para nodos simples; no crear un harness paralelo.
    - no introducir tests sobre la rama lazy en esta tarea; la rama lazy se verifica en T004 vía bundle output.

### Criterios de finalización

- `NodeComponents` exportado desde `node-components-map.ts` con las 24 entradas listadas.
- En modo test los componentes se obtienen síncronamente sin disparar Suspense.
- Los tests del fichero nuevo pasan en local con el comando indicado.
- TypeScript del proyecto compila sin nuevos errores.
- `layout-node-renderer.tsx` no ha sido modificado todavía.

### Cierre de implementación

Código y tests de la tarea completos, en verde local con el comando indicado, sin regresiones de tipos.

---

## T002 — Wrapper `LazyNode` con Suspense + ErrorBoundary por nodo

### Estado

completada

### Objetivo

Introducir un wrapper local del runtime que sirva de borde de Suspense y de error para cada posición de nodo cuando el
componente concreto sea lazy. El wrapper se define como componente reutilizable, agnóstico al nodo concreto: recibe
`children` y los envuelve en `<Suspense fallback={null}>` y en una error boundary de clase pequeña, local al runtime,
que captura cualquier error lanzado durante la carga del chunk o el render inicial del nodo y muestra un indicador
mínimo.

Contrato funcional del wrapper:

- API: `<LazyNode>{children}</LazyNode>`. No expone props adicionales. El componente lazy lo aporta `children` (en
  T003 será un nodo del mapa, p. ej. `<ContainerNode {...} />`).
- Mientras el componente hijo está suspendido (chunk en descarga), el wrapper renderiza `null`. No introduce ningún
  placeholder visual.
- Si el componente hijo (o la carga del chunk) lanza un error, la error boundary lo captura y renderiza:
  ```tsx
  <div role="alert" className="text-sm text-app-danger">Error al cargar componente</div>
  ```
- La error boundary no propaga el error hacia arriba: lo contiene en su propio borde. Cualquier `LazyNode` hermano sigue
  intacto.
- Tras renderizar el indicador de error, el wrapper no reintenta automáticamente la carga.
- El wrapper es un componente React reutilizable en cualquier posición. No está acoplado a `layout-node-renderer.tsx` en
  esta tarea; el cableado se hace en T003.

### Fuera de alcance

- Cablear el wrapper en `layout-node-renderer.tsx` (es T003).
- Internacionalizar el copy del indicador de error.
- Añadir telemetría o logging propio en la error boundary (puede usar `console.error` si lo hace el patrón estándar de
  React boundaries, pero no se exige).
- Soportar `fallback` parametrizable o variantes del indicador.
- Reintentos automáticos de carga.

### Dependencias

Ninguna. Es independiente de T001; ambas se pueden implementar en paralelo conceptualmente, pero el orden T001 →
T002 está fijado para mantener pasos pequeños y revisables.

### Impacto esperado en archivos

- Código:
    - `src/runtime/lazy-node.tsx` (nuevo) — exporta el componente `LazyNode` y su error boundary interna (no exportada).
- Tests:
    - `src/tests/runtime/runtime-lazy-node.test.tsx` (nuevo) — tests de las tres ramas observables (success, suspense,
      error) usando un `React.lazy` con promesa controlada en el propio test.
- Documentación:
    - Ninguna en esta tarea. Se difiere a `update-app-documentation` tras T004.

### Tests

- **Ficheros de test**:
    - `src/tests/runtime/runtime-lazy-node.test.tsx` (nuevo)
- **Comportamiento cubierto**:
    - `LazyNode` con un hijo síncrono trivial (p. ej. `<span>ok</span>`) renderiza el contenido tal cual en el primer
      render (sin Suspense fallback intermedio)
    - `LazyNode` con un hijo `React.lazy` cuya promesa todavía no resuelve renderiza `null` (el contenedor del test no
      contiene el contenido del hijo y no contiene el indicador de error)
    - `LazyNode` con un hijo `React.lazy` cuya promesa resuelve después renderiza el contenido del hijo tras la
      resolución (usar `await act(() => promesaResolve)` o `findBy*` para esperar al render final)
    - `LazyNode` con un hijo `React.lazy` cuya promesa se rechaza renderiza el indicador de error: existe un elemento
      con `role="alert"` cuyo texto es `Error al cargar componente` y cuyas clases incluyen al menos `text-app-danger`
    - dos `LazyNode` hermanos en el mismo render: si uno falla y otro renderiza correctamente un hijo síncrono, el
      indicador de error solo aparece en la posición fallida y el otro hijo sigue visible
    - tras renderizar el indicador de error, un re-render del mismo árbol no lanza el error de nuevo desde fuera del
      wrapper (la error boundary contiene el fallo)
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-lazy-node.test.tsx`
- **Restricciones**:
    - construir el componente `React.lazy` dentro del propio test usando una promesa controlada manualmente (
      resolver/reject expuestos), sin mocks globales del módulo bajo test.
    - los tests del wrapper no deben depender de archivos reales de `src/runtime/nodes/`; usar componentes triviales
      locales al test.
    - no añadir snapshots; verificar nodos concretos del DOM por rol y texto.
    - silenciar el log de React de la error boundary (`console.error`) solo dentro del test que provoca el rechazo,
      restaurándolo después.

### Criterios de finalización

- `LazyNode` exportado desde `src/runtime/lazy-node.tsx` con la semántica descrita (null en suspense, indicador en
  error, contenido en éxito).
- El indicador de error usa `role="alert"`, copy literal `Error al cargar componente` y `text-app-danger`.
- La error boundary captura el fallo sin propagar fuera de su borde.
- Los tests del fichero nuevo pasan en local con el comando indicado.
- TypeScript del proyecto compila sin nuevos errores.

### Cierre de implementación

Código y tests de la tarea completos, en verde local con el comando indicado, sin regresiones de tipos.

---

## T003 — Cablear `layout-node-renderer` al mapa y al wrapper `LazyNode`

### Estado

completada

### Objetivo

Sustituir en `src/runtime/layout-node-renderer.tsx` los 24 imports estáticos de nodos por el consumo del mapa
`NodeComponents` y envolver el resultado del switch `node.type → JSX` en `<LazyNode>` para que cada posición tenga su
propio borde de Suspense + error. El flujo existente del dispatcher (resolución de visibilidad, fallback de
`queryStateFeedback`, cálculo de `gridChildSpanClassName`) no se altera: solo cambia (a) la fuente de los componentes de
nodo y (b) que el render del nodo concreto pasa por el wrapper.

Forma del cambio:

- Reemplazar los imports `import { ContainerNode } from './nodes/container-layout-node'` (y los 23 análogos) por
  `import { NodeComponents } from './nodes/node-components-map'` y `import { LazyNode } from './lazy-node'`.
- Dentro del switch, cada `case` usa la entrada correspondiente del mapa, p. ej.
  `const ContainerNode = NodeComponents.container; renderedNode = <ContainerNode node={node}>{renderedChildren}</ContainerNode>`.
  Se admite tomar las referencias por desestructuración una sola vez al principio de la función o por `case`; lo
  importante es que `node.type` resuelva a `NodeComponents[type]`.
- Tras resolver `renderedNode` en el switch y antes de aplicar el wrapper `gridChildSpanClassName`, envolver:
  `renderedNode = <LazyNode>{renderedNode}</LazyNode>`. El wrapper se aplica una sola vez por nodo, después del switch.
- El cálculo y aplicación de `getGridChildSpanClassName(...)` sigue aplicándose por fuera de `<LazyNode>`, manteniendo
  intacta la regla actual de exclusión para `repeater` y `modal`.
- En el path de `resolveLayoutNodeVisibility` con `mode === 'fallback'` no se introduce el wrapper: ese path renderiza
  `LayoutRenderer` con los nodos de fallback, que a su vez vuelve a entrar en `LayoutNodeRenderer` por descendencia y
  aplicará el wrapper en cada nodo concreto.

Tras esta tarea, en modo test los ~2300 tests existentes siguen pasando porque `NodeComponents` expone componentes eager
y `LazyNode` con un hijo síncrono renderiza su contenido en el primer render (verificado por T001 y T002). En
dev/prod, cada nodo se carga vía chunk independiente.

### Fuera de alcance

- Cambiar el contrato de props de cualquier nodo.
- Modificar `resolveLayoutNodeVisibility`, `runtime-layout-context`, `runtime-node-styling`,
  `runtime-query-state-feedback` o cualquier helper del runtime fuera de `layout-node-renderer.tsx`.
- Añadir nuevos `case` al switch o eliminar alguno existente.
- Verificar el efecto de bundle output (es T004).
- Actualizar documentación amplia (se difiere a `update-app-documentation`).

### Dependencias

- T001 cerrada y en verde.
- T002 cerrada y en verde.

### Impacto esperado en archivos

- Código:
    - `src/runtime/layout-node-renderer.tsx` — sustitución de los 24 imports de nodos por el mapa y por `LazyNode`;
      envolver `renderedNode` después del switch.
- Tests:
    - Ninguno nuevo propio. La cobertura efectiva la dan:
        - todos los ficheros bajo `src/tests/layout-renderer/*` y `src/tests/runtime/*` que montan nodos del runtime,
        - los tests añadidos en T001 y T002.
- Documentación:
    - `ai-workflow/docs/app-features/runtime/organization.md` se verá afectada (descripción de `layout-node-renderer`) y
      `ai-workflow/docs/app-features/runtime/error-behavior.md` se verá afectada (nuevo indicador de fallo de carga por
      nodo). La actualización no se hace en esta tarea: se difiere a `update-app-documentation` tras T004.

### Tests

- **Ficheros de test**:
    - ninguno
- **Comportamiento cubierto**:
    - cubierto por la suite existente bajo `src/tests/layout-renderer/` y `src/tests/runtime/` (regresión: todos los
      nodos siguen renderizando sin cambios en modo test), y por los tests añadidos en T001 (mapa) y T002 (wrapper).
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer`
    - `pnpm test --run src/tests/runtime`
- **Restricciones**:
    - no editar ningún test existente bajo `src/tests/` para acomodar el cambio. Si algún test rompe, el problema está
      en el cableado o en la rama eager del mapa, no en el test.
    - no introducir `waitFor`/`findBy*` nuevos en tests existentes para compensar lazy: con la rama eager activa en
      test, no hace falta.

### Criterios de finalización

- `layout-node-renderer.tsx` no contiene ningún `import` directo de archivos bajo `./nodes/<x>-layout-node`. Sus únicas
  dependencias hacia los nodos son `node-components-map` y `lazy-node`.
- Cada `case` del switch resuelve el componente a través de `NodeComponents[type]`.
- Cada `renderedNode` resultante del switch pasa por `<LazyNode>` exactamente una vez antes de aplicar
  `gridChildSpanClassName`.
- Los comandos indicados pasan en verde sin modificación de los tests existentes.
- `pnpm test` global sigue en verde y la cobertura sigue por encima del 80% según `testing-rules.md`.
- TypeScript del proyecto compila sin nuevos errores.

### Cierre de implementación

Código y tests de la tarea completos, con las suites indicadas en verde local y la pasada global `pnpm test` también en
verde sin caída de cobertura.

---

## T004 — Gate de bundle output: chunks independientes por nodo

### Estado

completada

### Objetivo

Añadir un test que ejecuta `vite build` programático en modo producción y verifica que el code splitting de nodos
efectivamente ocurre. El test sirve como gate de regresión: cualquier cambio futuro que devuelva los nodos al entry
rompe este test.

Forma del test (mismo perfil que `src/tests/dev-runtime/dev-runtime-bundle.test.ts`):

- Ejecuta `build()` de Vite con los tres defines que usa el gate existente: `import.meta.env.DEV: 'false'`,
  `import.meta.env.PROD: 'true'`, `import.meta.env.MODE: JSON.stringify('production')`. Los tres defines son
  necesarios: sin `DEV: 'false'` y `PROD: 'true'`, la rama de DevRuntime en `main.tsx` no se elimina como dead code y
  Vite emite el chunk de DevRuntime como chunk lazy, lo que haría que la invariante 1 quede satisfecha por ese chunk
  aunque ningún nodo se haya separado.
- Reusa la utilidad para extraer los ficheros JS del bundle inicial referenciados desde `dist/index.html` (script
  `type="module"` y `<link rel="modulepreload">`).
- Verifica dos invariantes:
    1. `dist/assets/` contiene más de un fichero `.js`, y al menos un fichero `.js` que no está referenciado desde el
       bundle inicial (`dist/index.html`). Esto demuestra la existencia de chunks lazy distintos del entry.
    2. El bundle inicial no contiene markers literales específicos de componentes de nodo. Los markers son cadenas de
       texto visibles en la UI (no símbolos de código) que sobreviven a la minificación de esbuild. Lista cerrada de
       markers verificados manualmente sobre el bundle pre-feature (`dist/assets/index-*.js`) con `grep -c > 0`
       (garantizan que detectarán regresión):
       - `"No hay ficheros subidos."` — texto del estado vacío en `file-manager/file-manager-list.tsx`
       - `"Arrastra los ficheros aquí o haz clic para seleccionar"` — texto de la drop zone en `file-manager/file-manager-drop-zone.tsx`
       - `"Ver fichero"` — `aria-label` en `file-manager/file-manager-row.tsx`

El test se sitúa en la carpeta `src/tests/dev-runtime/` para alinearse con el patrón existente de gates de bundle (mismo
timeout, misma utilidad `extractEntryJsFiles`).

### Fuera de alcance

- Verificar el número exacto de chunks o un naming concreto generado por Rollup.
- Comprobar tamaños absolutos del bundle inicial frente a un baseline (la spec lo lista como NFR pero no como criterio
  de aceptación testeable, y atar a un número exacto es frágil).
- Probar la rama de error de carga de chunk en producción end-to-end (la cobertura del error boundary vive en T002 con
  `React.lazy` controlado).
- Refactorizar `dev-runtime-bundle.test.ts` para compartir build entre suites.
- Documentar el cambio.

### Dependencias

- T003 cerrada y en verde.

### Impacto esperado en archivos

- Código:
    - Ninguno (excepto eventuales pequeños ajustes si se detecta una regresión durante esta tarea, que serían bug fixes
      acotados al mapa/wrapper/renderer).
- Tests:
    - `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (nuevo) — gate de bundle output para nodos lazy.
- Documentación:
    - `ai-workflow/docs/test-index.md` se verá afectada (entrada nueva bajo `dev-runtime/`).
      `ai-workflow/docs/app-features/runtime/organization.md` y `error-behavior.md` también se verán afectadas por el
      cambio funcional global del runtime. Todas estas actualizaciones se difieren a `update-app-documentation`.

### Tests

- **Ficheros de test**:
    - `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (nuevo)
- **Comportamiento cubierto**:
    - tras `vite build`, `dist/assets/` contiene más de un fichero `.js`
    - tras `vite build`, existe al menos un fichero `.js` bajo `dist/assets/` que NO está referenciado desde
      `dist/index.html` (chunk lazy presente)
    - el contenido concatenado de los ficheros del bundle inicial (entry + modulepreload referenciados desde
      `dist/index.html`) NO contiene el literal `"No hay ficheros subidos."`
    - el contenido concatenado del bundle inicial NO contiene el literal
      `"Arrastra los ficheros aquí o haz clic para seleccionar"`
    - el contenido concatenado del bundle inicial NO contiene el literal `"Ver fichero"`
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/runtime-nodes-bundle.test.ts`
- **Restricciones**:
    - usar `@vitest-environment node` como hace `dev-runtime-bundle.test.ts`.
    - el `build()` programático debe incluir los tres defines: `'import.meta.env.DEV': 'false'`,
      `'import.meta.env.PROD': 'true'`, `'import.meta.env.MODE': JSON.stringify('production')`. Sin ellos, el chunk de
      DevRuntime puede satisfacer la invariante 1 antes del code splitting de nodos.
    - reusar el patrón `extractEntryJsFiles` ya existente. Si esa utilidad no es exportable, duplicarla en el nuevo test
      es aceptable (mismo trade-off que ya se asume en el bundle gate existente); no extraer a helper compartido en esta
      tarea.
    - timeout del `beforeAll` alineado con el ya existente (120_000 ms) para acomodar la build real.
    - no acoplarse a nombres de chunk concretos generados por Rollup; las assertions usan literales de texto de la UI que
      sobreviven a la minificación.

### Criterios de finalización

- El nuevo fichero de test pasa en local con el comando indicado.
- Las assertions de chunks lazy y de ausencia de markers en el bundle inicial pasan tras una build real.
- `pnpm test` global sigue en verde y la cobertura sigue por encima del 80% según `testing-rules.md`.
- TypeScript del proyecto compila sin nuevos errores.

### Cierre de implementación

Código y tests de la tarea completos, con el comando indicado en verde local y la pasada global `pnpm test` también en
verde sin caída de cobertura.

---

## Siguiente tarea a tomar

T001.
