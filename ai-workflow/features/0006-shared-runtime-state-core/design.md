# Design: Shared runtime state core

## Objetivo del diseño
Traducir la spec del núcleo de estado compartido a una partición técnica concreta y acotada para que la implementación pueda introducir navegación interna, formularios y queries bajo una misma fuente de verdad por instancia sin convertir el runtime en una librería genérica de state management.

## Estado de partida
Hoy el runtime arranca con una página ya resuelta por `initialPage` y la renderiza sin estado compartido persistente:
- `readRuntimeConfig` valida la configuración y devuelve `config` + `page` lista para render.
- `AppShell` pasa solo la página resuelta a `RuntimePage`.
- `RuntimePage` y `LayoutRenderer` son puramente estáticos.
- No existen todavía módulos `forms/`, `queries/` ni una capa de navegación interna.

Eso deja tres riesgos si la implementación no se diseña antes:
- acoplar la navegación a `AppShell` o a componentes visuales concretos
- crear estados locales separados para formularios y queries que luego haya que reconciliar
- abrir una API demasiado genérica o dependiente de efectos imperativos dispersos

## Decisiones de diseño

### 1. Un store por instancia de runtime basado en React nativo
La feature introducirá un store por instancia usando `useReducer` + `Context`, sin dependencias externas de estado.

Responsabilidades:
- crear un estado aislado por cada montaje del runtime
- ofrecer una fachada común para leer estado y despachar acciones
- permitir resets por dominio y reset total de instancia

Razonamiento:
- la spec exige aislamiento entre instancias y limpieza al desmontar
- `useReducer` permite transiciones explícitas y testeables sin introducir una librería adicional
- un `Context` local al runtime evita prop drilling y deja una única fuente de verdad compartida

### 2. Estado compartido con dominios separados bajo una fachada común
El estado interno se organizará con tres dominios bajo un shape común:

```txt
RuntimeState
  navigation
  forms
  queries
```

Shape base previsto:
- `navigation`
  - `currentPageId: string`
  - `history: string[]`
  - `lastError: RuntimeNavigationError | null`
- `forms`
  - `Record<formId, Record<fieldId, RuntimeFormFieldState>>`
- `queries`
  - `Record<queryName, RuntimeQueryState>`

Shapes de dominio:
- `RuntimeFormFieldState`
  - `value: unknown`
  - `error: string | null`
  - `touched: boolean`
  - `dirty: boolean`
  - `defaultValue?: unknown`
- `RuntimeQueryState`
  - `status: 'idle' | 'loading' | 'success' | 'error'`
  - `data: unknown`
  - `error: RuntimeQueryError | null`

Razonamiento:
- la spec exige que `touched` y `dirty` queden previstos desde la base aunque la primera UI solo dependa de `value` y `error`
- `history` debe existir ya como estructura mínima aunque la primera UI solo use `currentPageId`
- `data` debe poder sobrevivir a una recarga en `loading`, por lo que no se debe limpiar automáticamente al entrar en `loading`

### 3. Reducer central con acciones de dominio explícitas
La implementación usará un reducer central con acciones explícitas por dominio, en lugar de mutaciones sueltas repartidas entre hooks ad hoc.

Familias de acciones previstas:
- navegación
  - inicializar estado con `initialPage`
  - navegar a una página válida
  - registrar error controlado al intentar navegar a una página inexistente
  - resetear navegación al estado inicial de la instancia
- formularios
  - inicializar o registrar estado base de un formulario
  - actualizar valor de campo
  - actualizar error de campo
  - resetear un formulario concreto
  - resetear todos los formularios
- queries
  - inicializar una query compartida
  - pasar a `loading` conservando `data` previo
  - registrar `success`
  - registrar `error` con shape estable de UI
  - resetear una query o todas las queries
- runtime global
  - resetear toda la instancia

Razonamiento:
- la feature todavía no introduce UI final de formularios o queries, así que el contrato debe quedar listo desde acciones y selectors testeables
- las acciones explícitas reducen divergencia entre implementaciones futuras

### 4. Errores recuperables modelados en el estado, no como fallos fatales
Los errores de navegación y query se tratarán como errores recuperables de dominio.

Decisiones:
- una navegación a página inexistente no lanza excepción fatal ni cambia `currentPageId`
- el error queda registrado en `navigation.lastError`
- los errores de query se guardan como un shape estable y orientado a UI, no como error técnico bruto

Shape orientativo de error:
- `RuntimeNavigationError`
  - `code: 'page-not-found'`
  - `message: string`
  - `pageId: string`
- `RuntimeQueryError`
  - `message: string`
  - `code?: string`

Razonamiento:
- la spec exige encapsular errores recuperables para que la UI decida cómo reaccionar
- la UI no debe depender del shape crudo de `fetch`, backend o librerías futuras

### 5. Integración de navegación sin cambiar el contrato de configuración
`readRuntimeConfig` seguirá validando y devolviendo la configuración completa, pero la página visible dejará de depender solo del `page` resuelto fuera del estado.

Integración prevista:
- `AppShell` montará un provider del runtime con `config` y `initialPage`
- un selector del runtime resolverá la página visible a partir de `navigation.currentPageId`
- `RuntimePage` recibirá la página activa desde el estado compartido

Razonamiento:
- la spec exige que la página activa resida en estado interno compartido
- no se debe rehacer el contrato `pages + initialPage`
- la URL del navegador sigue fuera de alcance

### 6. Sin anticipar todavía integración real de red ni nodos de formulario
La feature solo deja el núcleo de estado listo para reutilización.

No entra en este diseño:
- ejecutar endpoints reales
- montar nodos `form`, `button` o acciones declarativas completas
- resolver `routeParams`
- definir fallback visual de errores o loading para bloques de UI

Razonamiento:
- el valor de esta feature es fijar la base compartida, no adelantar capacidades posteriores a medias

## Estructura objetivo

```txt
src/
  runtime/
    runtime-page.tsx
    runtime-state/
      runtime-state-provider.tsx
      runtime-state-context.ts
      runtime-state-reducer.ts
      runtime-state-types.ts
      runtime-state-selectors.ts
```

Notas de partición:
- `runtime-state/` vive dentro de `runtime/` porque esta feature crea estado interno del renderer, no un sistema global de app.
- No se crean todavía carpetas `forms/` o `queries/` independientes porque aún no existe UI o integración real que justifique esas fronteras como módulos autónomos.
- Los tipos de estado no deben mezclarse con `src/config/` porque no forman parte del contrato JSON validado en el borde.

## Estrategia de implementación
La implementación debería avanzar en este orden:

1. Fijar tipos, reducer y tests del store compartido sin tocar todavía el render visible.
2. Integrar navegación interna en `AppShell` y `RuntimePage` para que la página activa salga del estado compartido.
3. Añadir acciones/selectors de formularios y queries con tests específicos de comportamiento.
4. Cerrar con pruebas de aislamiento entre instancias, reset al remontaje y gate global de cobertura.

Esta secuencia minimiza riesgo porque:
- el contrato del estado queda estable antes de integrarlo en el render
- la navegación puede validarse sin depender de formularios o queries reales
- los dominios futuros se añaden sobre una base ya probada

## Riesgos y mitigaciones
- Riesgo: convertir `runtime-state/` en una API demasiado genérica.
  Mitigación: limitar el estado a navegación, formularios y queries; no introducir middleware, plugins ni helpers abstractos sin uso real.

- Riesgo: romper el arranque actual del runtime al mover la resolución de página al store.
  Mitigación: mantener tests de bootstrap y exigir que una configuración sin interacción siga renderizando `initialPage`.

- Riesgo: acoplar tests a detalles internos del reducer.
  Mitigación: probar principalmente comportamiento observable mediante selectors, hooks públicos del provider y render de la página visible.

- Riesgo: perder el último `data` válido de una query al pasar a `loading`.
  Mitigación: fijar ese comportamiento en tests del dominio de queries antes de implementar.

## Impacto documental posterior
Cuando el código esté implementado, la pasada documental debería revisar:
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
