# Spec: Basic static renderer

## Objetivo
Sustituir el shell provisional actual por un primer renderer declarativo capaz de mostrar una página estática definida en la configuración JSON, validando el flujo base de interpretación de `initialPage`, `pages` y `layout` sin introducir todavía navegación interactiva, formularios ni llamadas API.

## Alcance
- Renderizar la página indicada por `initialPage` a partir de la colección `pages` de la configuración activa.
- Soportar un árbol de layout declarativo y anidable para contenido estático.
- Introducir un conjunto inicial y acotado de nodos soportados: `container`, `heading`, `paragraph` y `list`.
- Definir el comportamiento esperado ante páginas inexistentes, layout inválido y nodos no soportados.
- Aplicar una presentación mínima que permita distinguir jerarquía y legibilidad de los bloques renderizados.
- Mantener compatibilidad con configuraciones que ya incluyan varias páginas, aunque solo se visualice la página inicial en esta feature.

## Fuera de alcance
- Navegación entre páginas o acciones como `navigateTo` y `goBack`.
- Formularios, validación de campos, eventos de usuario o mutaciones de estado interactivo.
- Queries, `preloads`, llamadas API o cualquier dependencia de datos remotos.
- Visibilidad condicional, referencias dinámicas a estado runtime o resolución de expresiones tipo `forms.*`, `queries.*` o `routeParams.*`.
- Sistema visual completo, theming avanzado o catálogo amplio de componentes.
- Soporte para títulos o descripciones de página fuera del árbol `layout`.

## Requisitos funcionales
- La configuración debe seguir organizándose alrededor de `pages` e `initialPage`, en línea con el contrato funcional general del runtime.
- El runtime debe resolver `initialPage` al arrancar y renderizar la página cuyo `id` coincida con ese identificador.
- La colección `pages` puede contener más de una página, pero en esta fase solo se debe mostrar la resuelta por `initialPage`.
- Cada página soportada en esta feature debe definirse al menos por `id` y `layout`.
- El `layout` debe aceptar nodos anidados con un shape homogéneo basado en `type`, `id` opcional, `props` opcional y `children` opcional.
- El nodo `container` debe servir como bloque estructural para agrupar y anidar otros nodos de layout. En esta fase puede soportar como máximo `direction` y `gap` dentro de `props`.
- El nodo `heading` debe permitir mostrar texto de encabezado con una jerarquía visible. En esta fase debe soportar `text` y `level` dentro de `props`.
- El nodo `paragraph` debe permitir mostrar texto corrido legible dentro del flujo del layout. En esta fase debe soportar `text` dentro de `props`.
- El nodo `list` debe permitir mostrar una colección estática de elementos de texto sin depender de datos dinámicos ni de APIs. En esta fase debe soportar `items` dentro de `props`, con un array de strings.
- En esta primera iteración, solo `container` debe admitir `children`; `heading`, `paragraph` y `list` deben resolverse como nodos hoja.
- Cuando el runtime reciba un nodo no soportado o un layout inválido, debe exponer un error visible y diagnóstico en desarrollo.
- En producción, ante nodos no soportados o layout inválido, el runtime debe degradar de forma controlada sin renderizar un mensaje genérico visible para la persona usuaria y sin inventar comportamiento.
- Si `initialPage` no corresponde con ninguna página declarada, el runtime debe mostrar un error claro en lugar de mantener el shell vacío o un contenido ambiguo.
- La ausencia de capacidades fuera de alcance no debe impedir que una configuración simple y válida produzca una página renderizada de extremo a extremo.

## Requisitos no funcionales
- El alcance debe mantenerse deliberadamente pequeño para no convertir esta fase en un motor UI genérico.
- El contrato funcional debe dejar margen para evolucionar después hacia navegación, formularios y queries sin rehacer el modelo base de páginas y layout.
- Los errores de configuración deben priorizar diagnóstico claro en desarrollo y degradación controlada en producción, en coherencia con las convenciones del proyecto.
- La salida visual debe ser suficientemente legible para validar jerarquía de contenido, pero sin fijar todavía un sistema de diseño amplio.
- La feature debe seguir siendo utilizable en desarrollo local sin depender de backend real.

## Criterios de aceptación
- Dada una configuración válida con varias páginas declaradas, el runtime muestra la página cuyo `id` coincide con `initialPage` y no renderiza el resto.
- Dada una página válida con un `layout` anidado compuesto solo por `container`, `heading`, `paragraph` y `list`, el runtime renderiza todo el árbol respetando su estructura declarativa.
- Dada una configuración válida con una lista estática, el runtime muestra sus elementos sin requerir queries, formularios ni referencias dinámicas.
- Si `initialPage` apunta a una página inexistente, el runtime muestra un error visible y comprensible.
- Si el `layout` contiene un nodo con `type` no soportado en esta feature, el runtime no intenta interpretarlo como otro bloque y comunica el problema de forma diagnóstica.
- En desarrollo, un nodo no soportado o un layout inválido muestran un error visible con información diagnóstica suficiente para corregir la configuración.
- En producción, un nodo no soportado o un layout inválido no muestran un mensaje genérico visible y no renderizan contenido inventado como sustitución.
- Si el `layout` tiene una forma inválida para el contrato esperado, el runtime falla de forma explícita y no deja una UI aparentemente correcta pero inconsistente.
- Una configuración simple y válida cargada desde las fuentes ya soportadas por el proyecto produce una página estática visible sin depender de backend ni de interacción adicional.

## Casos límite
- `pages` contiene varias páginas válidas pero solo una coincide con `initialPage`.
- `initialPage` existe pero la página correspondiente tiene un `layout` vacío.
- `initialPage` referencia una página que no existe en `pages`.
- El árbol de layout mezcla nodos válidos con un nodo no soportado.
- Un `container` no tiene `children` o los tiene vacíos.
- Una `list` declara `items` vacíos o con contenido insuficiente para renderizado útil.
- La configuración incluye campos futuros como `preloads`, pero esta feature no debe ejecutarlos ni depender de ellos para pintar la página inicial.

## Riesgos o preguntas abiertas
- Si futuras iteraciones necesitan ampliar `props` por nodo, habrá que hacerlo sin romper el contrato mínimo cerrado en esta feature.
- La degradación sin mensaje visible en producción obliga a definir bien durante la planificación qué superficie queda renderizada cuando falle parte o todo el layout.
- Mantener `list.props.items` como array de strings simplifica esta fase, pero requerirá una evolución explícita cuando entren items dinámicos o contenido enriquecido.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Modelo inicial de páginas renderizables
- Flujo de desarrollo local sin backend

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/current-state.md`
