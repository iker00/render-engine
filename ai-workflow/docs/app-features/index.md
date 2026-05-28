# Índice de features de producto

## Cómo usar este índice
Este índice existe para que una skill o un agente no tenga que leer toda la documentación funcional de la aplicación.

Orden recomendado de lectura:
1. este índice
2. solo las fichas de feature que sean relevantes para la petición
3. ninguna otra ficha funcional por defecto

## Features documentadas
- [`./config-driven-ui-runtime.md`](./config-driven-ui-runtime.md): visión general del runtime declarativo ya implementado, su renderer visible actual, el store compartido por instancia, la capa remota `src/queries/`, la base común de acciones UI, la navegación parametrizada por entrada, los `preloads` declarativos por firma de request, el nodo `repeater` con paginación local opcional y variantes `previousNext`, `numbered` y `scroll`, los nodos `image` y `table` con filtros, ordenación y paginación local opt-in, strings visibles interpolables con `{{...}}`, el alcance actual de `container` con defaults de `gap`, modo `grid` por `columns` fijo o responsive, variante visual cerrada `card`, `layout.span` transversal fijo o responsive sobre grids efectivos y la baseline institucional compacta hoy vigente.
- [`./config-contract.md`](./config-contract.md): contrato funcional del JSON soportado hoy, incluida la raíz `layout` basada en colección, el catálogo declarativo `api`, el shape objeto de `preloads`, el alcance ampliado de `container.props`, el bloque transversal `node.layout.span`, mapas responsive cerrados para `columns` y `span`, los nodos `button`, `repeater` con `props.pagination.controls.variant`, `image` y `table` con `props.columns` y `props.pagination`, `navigateTo.params`, `radioGroup.props.optionLayout`, `checkboxGroup.props.optionLayout`, la URL canónica basada en hash, la superficie `props.validations` de formularios, las referencias `params.*` e `item.*`, el catálogo cerrado de strings interpolables y las reglas de validación del arranque apoyadas en `Zod`.
- [`./pages-and-navigation.md`](./pages-and-navigation.md): modelo de páginas, `layout` por colección ordenada, resolución de la página activa desde el hash del navegador y el estado compartido, navegación canónica `#/` y `#/pageId`, `navigateTo`, `goBack`, reentrada por `pageEntry`, reevaluación selectiva de `preloads` por firma y resolución de params desde URL e `item.*` cuando una acción nace dentro de `repeater`.
- [`./queries-and-feedback.md`](./queries-and-feedback.md): estado compartido de queries, ejecución real por nombre de operaciones `api`, `requestSignature` efectiva por query, lectura de `queries.*` en referencias completas o placeholders visibles `{{...}}`, precargas automáticas selectivas por firma al entrar o reevaluar una entrada de página, disparo declarativo desde botón o formulario y feedback visual declarativo por nodo sobre `idle | loading | error | empty | success`, incluido `repeater` como consumidor estructural de colecciones con paginación local opt-in, variantes locales de control y los consumidores visibles `image` y `table`, con procesamiento local de tablas separado del estado remoto.
- [`./forms-and-validation.md`](./forms-and-validation.md): formularios declarativos ya renderizables con `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`, incluyendo labels y opciones interpolables, `select.multiple`, la variante visual opt-in `optionLayout: 'inline'` para choice groups, estado compartido por `formId.fieldId`, `defaultValue` también desde `params.*` e `item.*` dentro de `repeater` pero no interpolado parcialmente, limpieza por desmontaje como comportamiento por defecto, persistencia opt-in con `persistOnUnmount`, validación local declarativa vía `props.validations`, submit vía `executeOperation`, reset estable por `formId`, integración de `container` como sección también cuando usa columnas y una densidad visual más compacta para campos, acciones y separaciones.
- [`./development-workflow.md`](./development-workflow.md): bootstrap de desarrollo local con `src/dev/config.json`, prioridad de `data-config` y límites del modo sin backend.

## Guía rápida de selección
- Si la petición afecta al shape del JSON, sus errores de validación o a referencias dinámicas, leer `config-contract.md`.
- Si la petición afecta a flujo multipágina o navegación, leer `pages-and-navigation.md`.
- Si la petición afecta a llamadas API, preloads, loading, error o empty state, leer `queries-and-feedback.md`.
- Si la petición afecta a formularios, campos, valores por defecto, submit o validación, leer `forms-and-validation.md`.
- Si la petición afecta al modo local de trabajo sin backend, leer `development-workflow.md`.
- Si la petición es amplia o cambia el comportamiento global del runtime, empezar por `config-driven-ui-runtime.md`.
- Si la petición afecta solo a setup técnico o tooling, probablemente no necesita ninguna ficha funcional.

## Regla para skills
- No leer todas las fichas por defecto.
- Seleccionar solo las fichas relevantes desde este índice.
- Este índice no decide la lectura de documentación transversal.
- Si una implementación cambia el comportamiento estable de una feature de producto, actualizar la ficha correspondiente.
