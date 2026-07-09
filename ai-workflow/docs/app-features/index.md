# Índice de features de producto

## Cómo usar este índice
Este índice existe para que una skill o un agente no tenga que leer toda la documentación funcional de la aplicación.

Cada área es una subcarpeta con su propio `index.md` que detalla los sub-documentos disponibles y cuándo leer cada uno. La regla general es: **cargar solo los sub-documentos relevantes, no la subcarpeta entera**.

Orden recomendado de lectura:
1. este índice
2. el `index.md` del área o áreas que aplican
3. solo los sub-documentos concretos que sean relevantes para la petición

## Áreas funcionales

| Área | Cuándo leer |
|---|---|
| [`runtime/`](./runtime/index.md) | Visión global del runtime, organización interna de `src/`, política transversal de errores, límites globales de v1. |
| [`config/`](./config/index.md) | Estructura del JSON soportado (`api`, `pages`, `initialPage`, `preloads`, `layout`), modelo de página, validación previa al render. |
| [`references/`](./references/index.md) | Sistema de referencias dinámicas (`queries.*`, `forms.*`, `params.*`, `item.*`), interpolación `{{...}}`, `visibility`, `queryStateFeedback`. |
| [`auth/`](./auth/index.md) | Tokens de autenticación, inyección en operaciones, refresco automático proactivo. |
| [`nodes/`](./nodes/index.md) | Una ficha por nodo soportado: `container`, `repeater`, `table`, `image`, `form`, `input`, `textarea`, `select`, `choice-groups`, `toggle`, `hidden`, `button`, `heading-paragraph-list`. |
| [`forms/`](./forms/index.md) | Ciclo de vida del estado de formulario, valores por defecto, reglas de validación local, submit y reset. |
| [`queries/`](./queries/index.md) | Modelo de estado de queries, ejecución declarativa de operaciones `api`, `preloads`, feedback visual por estado. |
| [`navigation/`](./navigation/index.md) | Modelo de páginas, hash routing canónico, acciones `navigateTo`/`goBack`, params transportados, `pageEntry`. |
| [`development/`](./development/index.md) | Modo desarrollo local sin backend, carga de configuración desde `src/dev/config.json` o `data-config`. |

## Guía rápida de selección
- Si la petición afecta a un nodo concreto del catálogo, leer su ficha en [`nodes/<nodo>.md`](./nodes/index.md). El resto del catálogo no aplica por defecto.
- Si la petición afecta al shape del JSON o sus errores de validación, leer [`config/structure.md`](./config/structure.md) y/o [`config/validation.md`](./config/validation.md).
- Si la petición afecta a referencias dinámicas, interpolación, visibility o feedback por estado de query, leer el sub-doc concreto bajo [`references/`](./references/index.md).
- Si la petición afecta a formularios, leer las fichas de [`forms/`](./forms/index.md) o los nodos de formulario en [`nodes/`](./nodes/index.md) según el alcance.
- Si la petición afecta a llamadas API, `preloads`, loading, error o empty state, leer los sub-docs relevantes bajo [`queries/`](./queries/index.md).
- Si la petición afecta a flujo multipágina o navegación, leer [`navigation/`](./navigation/index.md).
- Si la petición afecta al modo local de trabajo sin backend, leer [`development/local-config.md`](./development/local-config.md).
- Si la petición es global o transversal del runtime, empezar por [`runtime/overview.md`](./runtime/overview.md).
- Si la petición afecta solo a setup técnico o tooling, probablemente no necesita ninguna ficha funcional.

## Regla para skills
- No leer todas las áreas por defecto.
- Seleccionar solo los sub-documentos relevantes desde este índice y desde el `index.md` del área correspondiente.
- Este índice no decide la lectura de documentación transversal del proyecto (`context.md`, `architecture.md`, `conventions.md`).
- Si una implementación cambia el comportamiento estable de un área, actualizar el sub-documento correspondiente y, si el alcance cambió, su `index.md` de área.
