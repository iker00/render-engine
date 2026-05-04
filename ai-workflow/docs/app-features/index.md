# Índice de features de producto

## Cómo usar este índice
Este índice existe para que una skill o un agente no tenga que leer toda la documentación funcional de la aplicación.

Orden recomendado de lectura:
1. [`../context.md`](../context.md)
2. este índice
3. solo las fichas de feature que sean relevantes para la petición
4. [`../current-state.md`](../current-state.md) si hace falta confirmar qué está implementado hoy

## Features documentadas
- [`./config-driven-ui-runtime.md`](./config-driven-ui-runtime.md): visión general del runtime declarativo ya implementado, su renderer visible actual, el store compartido por instancia, la capa remota `src/queries/`, la base común de acciones UI y la convención visual base con `Tailwind`.
- [`./config-contract.md`](./config-contract.md): contrato funcional del JSON soportado hoy, incluida la raíz `layout` basada en colección, el catálogo declarativo `api`, el nodo `button`, las acciones UI soportadas y las reglas de validación del arranque apoyadas en `Zod`.
- [`./pages-and-navigation.md`](./pages-and-navigation.md): modelo de páginas, `layout` por colección ordenada, resolución de la página activa desde estado compartido y navegación interna actual con `navigateTo` y `goBack`.
- [`./queries-and-feedback.md`](./queries-and-feedback.md): estado compartido de queries, ejecución real por nombre de operaciones `api`, precargas automáticas al entrar en página, disparo declarativo desde botón y feedback visual declarativo por nodo sobre `idle | loading | error | empty | success`.
- [`./forms-and-validation.md`](./forms-and-validation.md): formularios declarativos ya renderizables con `form`, `input`, `textarea` y `select`, estado compartido por `formId.fieldId`, validación `required`, submit vía `executeOperation` y reset estable por `formId`.
- [`./development-workflow.md`](./development-workflow.md): bootstrap de desarrollo local con `src/dev/config.json`, prioridad de `data-config` y límites del modo sin backend.

## Guía rápida de selección
- Si la petición afecta al shape del JSON, sus errores de validación o a referencias dinámicas, leer `config-contract.md`.
- Si la petición afecta a flujo multipágina o navegación, leer `pages-and-navigation.md`.
- Si la petición afecta a llamadas API, preloads, loading, error o empty state, leer `queries-and-feedback.md`.
- Si la petición afecta a formularios, campos, valores por defecto, submit o validación, leer `forms-and-validation.md`.
- Si la petición afecta al modo local de trabajo sin backend, leer `development-workflow.md`.
- Si la petición es amplia o cambia el comportamiento global del runtime, empezar por `config-driven-ui-runtime.md`.
- Si la petición afecta solo a setup técnico o tooling, complementar con [`../architecture.md`](../architecture.md) y [`../current-state.md`](../current-state.md).

## Regla para skills
- No leer todas las fichas por defecto.
- Seleccionar solo las fichas relevantes desde este índice.
- Si una implementación cambia el comportamiento estable de una feature de producto, actualizar la ficha correspondiente.
