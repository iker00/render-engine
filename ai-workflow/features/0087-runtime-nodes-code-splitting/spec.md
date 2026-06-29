# Spec: Runtime nodes code splitting

## Objetivo

Reducir el tamaño del bundle JS inicial cargando cada nodo del runtime bajo demanda mediante `React.lazy()`, de forma
que solo se descarguen los chunks de los nodos que realmente aparecen en la configuración de una sesión concreta.

## Alcance

- Todos los nodos en `src/runtime/nodes/` pasan a importarse dinámicamente desde el dispatcher central (
  `layout-node-renderer`).
- El cambio es interno al runtime; no afecta al contrato JSON ni al comportamiento visible de los nodos una vez
  cargados.
- La configuración sigue llegando completa desde backend; el code splitting es exclusivamente del bundle JS del cliente.

## Fuera de alcance

- Lazy loading del editor Monaco / DevRuntime (ya resuelto en `0067`).
- Splitting de capas no relacionadas con nodos: validación de config, `runtime-state`, `src/queries/`, referencias,
  acciones.
- Prefetch anticipado de chunks antes de que un nodo sea necesario.
- Cambios en el contrato JSON o en las props de cualquier nodo.

## Requisitos funcionales

1. Todos los nodos actualmente importados de forma estática en `layout-node-renderer` pasan a importarse dinámicamente.
2. El chunk de un nodo se solicita a red únicamente cuando ese tipo de nodo se necesita renderizar por primera vez.
3. Mientras el chunk está en descarga, la posición del nodo no renderiza nada (`null`).
4. Si la descarga de un chunk falla, se renderiza un indicador de error mínimo en la posición de ese nodo sin que el
   resto del runtime se vea afectado.
5. En renders posteriores, los chunks ya descargados se usan de forma inmediata sin nueva petición a red.
6. El comportamiento funcional de todos los nodos tras su carga es idéntico al actual.

## Requisitos no funcionales

- El chunk principal (`index.js`) debe ser measurablemente más pequeño que antes del cambio.
- El build de producción debe generar chunks separados para los componentes de nodos.
- La cobertura global de tests se mantiene en el umbral mínimo del 80% sobre `src/`.

## Criterios de aceptación

1. El output del build contiene ficheros de chunk independientes correspondientes a nodos del runtime.
2. El chunk `index.js` principal reduce su tamaño respecto al baseline (bundle actual de ~1.4 MB).
3. Una página que usa solo un subconjunto de tipos de nodo no descarga los chunks de los nodos no utilizados en esa
   sesión.
4. Al renderizar un nodo por primera vez, su chunk se carga y el nodo aparece correctamente.
5. Un fallo de carga de chunk en un nodo muestra un indicador de error en esa posición sin afectar al resto del runtime
   ni a otros nodos.
6. Todos los tests existentes pasan sin modificación de comportamiento.

## Casos límite

- **`repeater` con N instancias del mismo tipo de nodo**: todas las instancias comparten el mismo chunk; la descarga
  ocurre una sola vez.
- **`tabs` al cambiar de panel**: si el panel destino contiene un tipo de nodo no descargado aún, su chunk se carga en
  ese momento.
- **`modal` al abrirse**: si el modal contiene un tipo de nodo no descargado, su chunk se carga al abrir el modal.
- **Página con múltiples tipos de nodo distintos**: los chunks se descargan en paralelo en la primera carga.
- **Nodo que ya se renderizó en una página anterior**: su chunk está en caché del navegador y se usa sin nueva petición.

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de alcance y comportamiento están resueltas.

## Áreas de producto afectadas

- Runtime (dispatcher central de nodos).

## Documentación probablemente afectada

- `ai-workflow/docs/architecture.md` si el boundary de Suspense/error por nodo pasa a ser una frontera arquitectónica
  estable.
- `ai-workflow/docs/app-features/runtime/` si el comportamiento de lazy loading se documenta como comportamiento estable
  del runtime.
