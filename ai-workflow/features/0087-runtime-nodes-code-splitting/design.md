# Design: 0087 — Runtime nodes code splitting

## Contexto

`src/runtime/layout-node-renderer.tsx` importa hoy de forma estática todos los componentes de nodo (`ContainerNode`, `RepeaterNode`, `HeadingNode`, …, `FileManagerNode`). Esto hace que el bundle inicial `index.js` (~1.4 MB actuales) incluya el código de todos los nodos del catálogo aunque una sesión concreta solo renderice un subconjunto.

Restricciones técnicas del entorno:

- Stack `Vite + React + Tailwind`. Vite/Rollup ya soportan code splitting nativo por `import()` dinámico sin configuración adicional.
- Los nodos en `src/runtime/nodes/` exponen el componente con **named export** (`ContainerNode`, `RepeaterNode`, …), nunca como `default`. `React.lazy()` exige `default`.
- `layout-node-renderer` es la única frontera donde se materializa el dispatcher `type → componente`; ninguna otra capa importa nodos individualmente.
- Algunos nodos reciben `renderedChildren` (`container`, `modal`, `form`, `link`) o expansión estructural propia (`repeater`); el contrato de props debe preservarse intacto.
- `layout-node-renderer` ya aplica `role="status"` / `role="alert"` en los fallbacks de `queryStateFeedback` (`error-behavior.md`). El indicador de error de carga debe alinearse con esa convención.
- El proyecto cuenta con un precedente de gate de bundle por test (`src/tests/dev-runtime/dev-runtime-bundle.test.ts`) que ejecuta `vite build` programático y escanea `dist/assets/`. La misma técnica sirve para verificar que cada nodo produce su chunk independiente.
- Hay ~2300 tests existentes que montan nodos del runtime de forma síncrona. El criterio de aceptación 6 exige que sigan pasando sin modificación.
- Tokens visuales semánticos disponibles tras `0081` (`text-app-danger`, etc.) deben usarse para el indicador de error en lugar de colores crudos.

## Objetivos / No objetivos

### Objetivos

- Que `layout-node-renderer` resuelva cada nodo del runtime mediante una referencia lazy que produzca un chunk independiente en el build de producción.
- Que el chunk de un nodo solo se descargue cuando el dispatcher renderice por primera vez ese `type`.
- Que el fallo de descarga de un nodo concreto quede contenido en su posición sin propagar el error al resto del runtime.
- Que el cambio sea internamente equivalente al render actual una vez el chunk está cargado: mismas props, mismo árbol, mismo comportamiento.
- Que el set actual de tests siga pasando sin modificación.

### No objetivos

- Cambiar el contrato JSON, el shape de props de cualquier nodo o la API pública del runtime.
- Prefetch de chunks (descargar antes de necesitarse).
- Code splitting de capas no-nodo (`runtime-state`, `runtime-references`, `src/queries/`, validación, acciones).
- Reorganización del directorio `src/runtime/nodes/` o del dispatcher para granular más allá de "un chunk por nodo".
- Decidir naming explícito de chunks: el naming automático de Rollup es suficiente.
- Coordinar Suspense con la maquinaria de `queryStateFeedback`/`visibility`: la rama de fallback existente se mantiene tal cual; el lazy actúa después de esa resolución.
- Internacionalización del indicador de error: usa texto fijo en español como el resto de la UI del runtime hoy.

## Decisiones

### D1. Mapa central de componentes de nodo en módulo dedicado

Se introduce un módulo nuevo `src/runtime/nodes/node-components-map.ts` (nombre orientativo) que exporta el mapa `type → ComponentType<any>` que `layout-node-renderer` consume. Dentro de ese módulo se encapsula la doble estrategia descrita en D2.

- **Por qué**: aísla la lógica de "cómo se obtiene el componente de cada `type`" del dispatcher visual. `layout-node-renderer` queda libre de detalles de chunking y se limita a hacer `<NodeComponent {...} />` por `node.type`.
- **Alternativa descartada**: declarar los `React.lazy()` directamente en `layout-node-renderer`. Funcional pero hace muy verboso el dispatcher y mezcla dos responsabilidades distintas (resolución de chunk vs render).
- **Trade-off**: introduce un módulo nuevo y un nivel de indirección. Aceptable: hace el cambio reversible y testeable.

### D2. Eager en test, lazy en dev/prod

`node-components-map.ts` decide en build-time qué versión exportar según `import.meta.env.MODE === 'test'`:

- En **test**: imports estáticos directos de cada nodo. El mapa expone los componentes tal cual. No hay Suspense ni error boundary en la ruta caliente porque no hace falta.
- En **dev/prod**: cada componente del mapa es un `React.lazy(() => import('./X-layout-node').then(m => ({ default: m.XNode })))`. El adaptador `.then(...)` convierte el named export a `default` sin tocar los archivos de nodo.

- **Por qué**:
  - El criterio de aceptación 6 prohíbe modificar los tests existentes. `React.lazy()` suspende al primer render incluso si el módulo ya está cacheado, porque el estado interno del wrapper es por instancia.
  - El comportamiento testeado de cada nodo es idéntico en ambas variantes: tras la carga del chunk, el árbol React es el mismo. Lo único que cambia entre variantes es el mecanismo de obtención del componente, que se cubre con un test dedicado de bundle output (ver D6).
- **Alternativa descartada**: usar `React.lazy()` en todos los entornos y actualizar los ~2300 tests con `waitFor`/`findBy*`. Inviable por volumen y choca con la spec.
- **Alternativa descartada**: precargar todos los módulos en setup global de Vitest. No funciona: el estado interno del wrapper de `React.lazy()` es independiente y siempre suspende en la primera renderización.
- **Trade-off**: existe una rama condicional en build-time entre tests y producción. Aceptable porque (a) la conmutación está concentrada en un único módulo, (b) hay un test específico que ejecuta el build real de producción y valida el path lazy, y (c) el resto del runtime no se entera de la diferencia.
- **Riesgo residual**: si un test futuro quiere ejercitar específicamente la rama lazy (p. ej. simular fallo de chunk), tendrá que montar el lazy manualmente en ese test concreto. Es excepcional y no afecta a la salud actual de la suite.

### D3. Wrapper `LazyNode` con Suspense + ErrorBoundary por nodo

En modo lazy, cada render de nodo en `layout-node-renderer` se envuelve en un wrapper local que combina:

- `<Suspense fallback={null}>` (criterio funcional 3 de la spec: durante la descarga la posición no renderiza nada).
- Un error boundary de clase pequeño y local al runtime que captura fallos de carga de chunk y renderiza el indicador descrito en D4.

El wrapper es por instancia de nodo, no por subárbol. Esto cumple el caso límite "múltiples tipos de nodo distintos: chunks en paralelo" y aísla los fallos por posición.

- **Por qué Suspense por nodo y no en `layout-renderer`**: un Suspense más arriba haría que toda una página/subárbol suspendiera al cargar el primer chunk, y la spec exige que solo la posición del nodo concreto quede vacía.
- **Por qué error boundary propio (no librería)**: el proyecto no tiene hoy ninguna error boundary y el caso de uso es muy acotado (~20 líneas de clase). Añadir `react-error-boundary` como dependencia no aporta nada relevante. Convención `errors` del proyecto: fallar predeciblemente y mostrar mensaje comprensible, no traza técnica — alineado.
- **Alternativa descartada**: dejar que el fallo de chunk propague hacia arriba. Romper toda la página por un nodo cuyo asset falló contradice los requisitos funcionales 4 y el criterio de aceptación 5.
- **Trade-off**: el wrapper añade dos componentes de overhead por nodo renderizado en runtime. Coste despreciable comparado con el ahorro de bundle inicial.

### D4. Indicador de error mínimo en danger semántico

Cuando la error boundary captura un fallo de carga de chunk, renderiza:

```tsx
<div role="alert" className="text-sm text-app-danger">Error al cargar componente</div>
```

- **Por qué**:
  - Alineado con la política de fallbacks `role="alert"` que ya aplica el renderer para estado `error`.
  - Usa tokens semánticos (`text-app-danger`) tras la normalización de `0081`.
  - Texto fijo en español, consistente con el resto de la UI runtime hoy.
  - No introduce ningún acoplamiento con el nodo `alert`.
- **Trade-off**: copy literal embebido en código (no internacionalizado). Aceptable porque el resto del runtime hoy también lo está; si en el futuro se internacionaliza, esta cadena entra en el barrido.

### D5. El adaptador named → default vive en el mapa

Cada entrada del mapa convierte el named export del nodo en `default` mediante un adaptador inline:

```ts
const ContainerNode = React.lazy(() =>
  import('./container-layout-node').then((m) => ({ default: m.ContainerNode })),
)
```

- **Por qué**: evita modificar 25+ archivos de nodos para añadirles un `export default`. La capa de adaptación queda concentrada en el mapa, donde ya está la decisión lazy/eager.
- **Alternativa descartada**: añadir `export default XNode` a cada archivo de nodo. Más limpio en cada archivo, pero diluye el cambio por todo el directorio y mezcla un detalle de tooling con el código del nodo.
- **Trade-off**: el mapa es repetitivo (una línea por nodo). Repetición plana y revisable; no justifica una capa de metaprogramación.

### D6. Tests: render de nodos sin cambios + nuevo test de bundle output

Dos frentes de cobertura:

1. **Tests existentes de nodos**: se mantienen tal cual gracias a D2.
2. **Nuevo test de bundle output**: estilo `dev-runtime-bundle.test.ts`. Ejecuta `vite build` programático en modo producción y verifica:
   - Que `dist/assets/` contiene chunks separados para componentes de nodo (el set exacto es flexible: se asserta sobre la existencia de N chunks distintos del entry y, opcionalmente, de la ausencia de markers de nodos concretos en el entry).
   - Que el entry no contiene markers identificables de nodos del catálogo (por ejemplo, marcas estables presentes solo en uno o varios archivos de nodo). Se mantiene tolerante a la convención de nombres de chunk de Rollup.

- **Por qué**: el comportamiento que cambia con esta feature es exactamente el de bundling. La forma honesta de testarlo es ejercitando el build real, como ya hace el bundle gate de DevRuntime.
- **Trade-off**: el test es lento (build real de Vite). Aceptable: mismo perfil que el gate ya existente.

### D7. No cambia el contrato del dispatcher

`layout-node-renderer` mantiene su flujo actual: resolución de visibilidad, fallback de `queryStateFeedback`, switch por `node.type`, wrapper de `layout.span`. Lo único que cambia dentro de cada `case` es que el JSX pasa por el `<LazyNode>` wrapper:

```tsx
case 'container':
  renderedNode = (
    <LazyNode Component={NodeComponents.container}>
      <ContainerNodeProps node={node}>{renderedChildren}</ContainerNodeProps>
    </LazyNode>
  )
```

(Pseudocódigo orientativo; la firma exacta del wrapper se cierra en planning.)

- **Por qué**: el flujo existente está validado por miles de tests y conviene tocar lo mínimo. La integración con `visibility` y `queryStateFeedback` no se altera.
- **Trade-off**: cada `case` se hace levemente más verboso. Aceptable y revisable.

## Riesgos y trade-offs

### R1. Divergencia conductual entre test y prod

D2 introduce una rama condicional. Mitigación:

- La diferencia está confinada a un módulo único (`node-components-map.ts`).
- Un test específico de bundle output ejercita el path lazy en build real (D6).
- Cualquier nueva capacidad transversal (p. ej. wrapper de telemetría por nodo) tendría que respetar ambas ramas.

### R2. Carga visible: "flash" de espacio vacío al primer render de un nodo

Con `fallback={null}`, la posición del nodo está ausente del DOM hasta que el chunk llega. En sesiones rápidas no se percibe; en redes lentas hay un breve hueco visual. Esto está aceptado explícitamente en el requisito funcional 3 de la spec. Mitigación documental: queda explícito como comportamiento esperado.

### R3. Cobertura del 80% sobre `src/`

El nuevo módulo de mapa y el wrapper `LazyNode` deben quedar cubiertos. El test de bundle ejercita el módulo en producción; los tests existentes ejercitan los nodos a través del mapa en su variante eager. El error boundary necesita un test mínimo dedicado que simule fallo de carga (rejected promise en un lazy controlado) para no romper la cobertura.

### R4. Compatibilidad con `React.StrictMode`

`main.tsx` monta el árbol bajo `React.StrictMode`, que duplica el `useState`/`useEffect` en desarrollo. `React.lazy` está pensado para esto y se comporta correctamente. No se prevé impacto.

### R5. Server-side y SSR

El proyecto no hace SSR; todo el runtime renderiza en cliente. `React.lazy` con `Suspense fallback={null}` es seguro en este contexto. No hay riesgo de hydration mismatch porque no hay hydration.

### R6. Helpers compartidos por nodos

Algunos archivos en `src/runtime/nodes/` son helpers de soporte (`link-action-href.ts`, `use-image-fetch-source.ts`, `icon-node.tsx`, subcarpeta `file-manager/`). Vite/Rollup decidirá automáticamente si caen en el chunk del nodo consumidor o en un chunk compartido cuando varios nodos los necesiten. No requiere intervención manual. Si un helper queda incluido en el entry por estar referenciado desde código no lazy, será visible en el test de bundle output y se trata como bug.

## Migración o despliegue

No aplica. Cambio interno sin contrato externo afectado. Una vez mergeado, los chunks aparecen en el siguiente build de producción sin acción adicional desde el backend ni desde el HTML host.

## Preguntas abiertas

Ninguna bloqueante. Decisiones cerradas para que la planificación pueda trocear sin reabrir arquitectura.
