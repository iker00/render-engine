# Tasks: Shared runtime state core

## T0006-01

### Estado
Completada

### Objetivo
Introducir la infraestructura base del estado compartido por instancia en `runtime/`, incluyendo tipos, reducer, provider y selectors mínimos, sin cambiar todavía el comportamiento visible del runtime.

### Fuera de alcance
- Mover la página activa visible al estado compartido.
- Añadir nodos de formulario, acciones declarativas o ejecución real de queries.
- Definir feedback visual nuevo para errores o loading.

### Dependencias
- `spec.md`
- `design.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/` en una carpeta nueva `runtime-state/` para provider, reducer, contexto, tipos y selectors
  - `src/app/app-shell.tsx` solo si hace falta preparar el punto de montaje del provider sin usar aún navegación activa
  - `src/config/runtime-config.ts` o tipos públicos solo si la integración necesita importar `RuntimeConfig` o `RuntimePageConfig` desde una frontera estable
- Tests a crear o modificar:
  - `src/tests/` en un archivo nuevo específico para el estado compartido del runtime
  - `src/tests/app-shell.test.tsx` solo si el montaje del provider cambia el árbol sin alterar el contenido visible
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que cada instancia del provider crea un estado aislado de otras instancias.
- Confirmar que el estado inicial contiene `navigation`, `forms` y `queries`.
- Confirmar que la navegación se inicializa con `initialPage` y con una estructura mínima de historial interno.
- Confirmar que el reset total devuelve la instancia a su estado base sin reutilizar datos previos.

### Criterios de finalización
- Existe una infraestructura de estado compartido por instancia basada en `useReducer` + `Context`.
- El shape base del estado deja previstos `history`, `touched` y `dirty`.
- Hay una fachada explícita para leer estado y despachar acciones sin acoplar consumidores al reducer interno.
- Los tests del store base quedan en verde.

### Cierre de implementación
Completado cuando el store base del runtime existe, queda cubierto por tests y no deja decisiones abiertas sobre shape, provider ni mecanismo de reset global.

### Cierre documental
Pendiente de una pasada posterior para reflejar la nueva arquitectura interna del runtime. No se cierra en esta tarea.

## T0006-02

### Estado
Completada

### Objetivo
Mover la resolución de la página activa al estado compartido del runtime y habilitar navegación interna controlada sin cambiar el contrato `pages + initialPage` ni la URL del navegador.

### Fuera de alcance
- Implementar botones, acciones declarativas o UI final de navegación.
- Introducir `routeParams`, deep links o historial del navegador.
- Limpiar automáticamente formularios o queries al cambiar de página.

### Dependencias
- `T0006-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/app/app-shell.tsx`
  - `src/runtime/runtime-page.tsx`
  - `src/runtime/runtime-state/` en selectors, acciones o hooks necesarios para resolver la página activa
  - cualquier ajuste mínimo en `src/app/App.tsx` o `src/app/bootstrap/read-runtime-config.ts` si la integración requiere pasar `config` completa al provider
- Tests a crear o modificar:
  - `src/tests/app-bootstrap.test.tsx`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/layout-renderer.test.tsx` solo si hace falta endurecer la aserción sobre la página visible
  - el archivo de tests del estado compartido introducido en `T0006-01`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`

### Tests requeridos
- Confirmar que una configuración sin interacción sigue renderizando la página `initialPage`.
- Confirmar que la página visible se resuelve desde `navigation.currentPageId` y no desde una selección hardcodeada fuera del store.
- Confirmar que una navegación válida cambia la página activa sin tocar la URL.
- Confirmar que una navegación a página inexistente conserva la página activa anterior y registra un error recuperable en navegación.

### Criterios de finalización
- `AppShell` monta el provider del runtime con la configuración validada.
- `RuntimePage` consume la página activa desde el estado compartido.
- El runtime mantiene el comportamiento actual para configuraciones estáticas.
- Los tests de bootstrap, navegación base y regresión visible quedan en verde.

### Cierre de implementación
Completado cuando la navegación interna ya reside en el store compartido, el arranque sigue siendo equivalente para `initialPage` y los errores de navegación inválida quedan encapsulados sin romper el render.

### Cierre documental
Pendiente de una pasada posterior para alinear la documentación funcional de runtime y navegación interna. No se cierra en esta tarea.

## T0006-03

### Estado
Completada

### Objetivo
Añadir el dominio base de formularios al estado compartido con inicialización predecible, actualización de valores, lectura consistente y reseteo por formulario, dejando preparado el contrato para futuras features de UI de formulario.

### Fuera de alcance
- Introducir nodos `form`, `input`, `select`, `textarea` u otras piezas visuales.
- Implementar validación visual completa o submit real.
- Resolver valores dinámicos procedentes de queries o expresiones declarativas.

### Dependencias
- `T0006-02` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/` en reducer, tipos, acciones y selectors del dominio `forms`
  - cualquier helper local del dominio de formularios estrictamente necesario dentro de `runtime-state/`
- Tests a crear o modificar:
  - el archivo de tests del estado compartido del runtime o un archivo específico del dominio `forms`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Confirmar que el estado se organiza por `forms.{formId}.{fieldId}`.
- Confirmar que un formulario puede inicializar campos con `defaultValue`.
- Confirmar que actualizar un campo cambia su `value` compartido de forma consistente.
- Confirmar que el dominio contempla `error`, `touched` y `dirty` sin rehacer el shape base.
- Confirmar que el reset de un formulario restaura el estado inicial efectivo sin afectar a otros formularios.
- Confirmar que un cambio de página dentro de la misma instancia no limpia por defecto el estado de formularios.

### Criterios de finalización
- El dominio `forms` existe dentro del store compartido con acciones y selectors explícitos.
- El contrato base cubre inicialización, escritura, lectura y reset por formulario.
- El reset por formulario reutiliza el estado base efectivo de la instancia.
- Los tests del dominio de formularios quedan en verde.

### Cierre de implementación
Completado cuando el runtime dispone de un dominio de formularios reutilizable y probado, listo para ser consumido por futuras piezas visuales sin rediseñar el estado.

### Cierre documental
Pendiente de una pasada posterior para actualizar la ficha funcional de formularios y el estado vigente del runtime. No se cierra en esta tarea.

## T0006-04

### Estado
Completada

### Objetivo
Añadir el dominio base de queries al estado compartido con estado `status/data/error`, conservación del último dato válido durante recargas y reset por query o global, dejando preparada la base para futuras integraciones remotas.

### Fuera de alcance
- Ejecutar `fetch`, endpoints declarados o preloads reales.
- Introducir caché persistente, reintentos, deduplicación global o invalidación avanzada.
- Resolver claves de caché parametrizadas o dependientes de `routeParams`.

### Dependencias
- `T0006-03` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/runtime-state/` en reducer, tipos, acciones y selectors del dominio `queries`
  - cualquier helper local del dominio de queries estrictamente necesario dentro de `runtime-state/`
- Tests a crear o modificar:
  - el archivo de tests del estado compartido del runtime o un archivo específico del dominio `queries`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`

### Tests requeridos
- Confirmar que las queries se organizan por nombre compartido dentro de la instancia.
- Confirmar que una query expone como base `status`, `data` y `error`.
- Confirmar que el paso a `loading` conserva el último `data` válido hasta nuevo resultado o reset explícito.
- Confirmar que un error de query se guarda con shape estable y orientado a UI.
- Confirmar que un error recuperable de query no rompe el resto del estado del runtime.
- Confirmar que un cambio de página dentro de la misma instancia no limpia por defecto el estado de queries.

### Criterios de finalización
- El dominio `queries` existe dentro del store compartido con acciones y selectors explícitos.
- La transición `idle/loading/success/error` queda fijada en tests.
- El store conserva el último `data` válido durante recargas.
- Los tests del dominio de queries quedan en verde.

### Cierre de implementación
Completado cuando el runtime dispone de un dominio de queries compartidas probado y listo para ser reutilizado por futuras acciones API sin duplicar estado local por componente.

### Cierre documental
Pendiente de una pasada posterior para actualizar la ficha funcional de queries y el estado vigente del runtime. No se cierra en esta tarea.

## T0006-05

### Estado
Completada

### Objetivo
Cerrar la integración del núcleo compartido con validación final de aislamiento entre instancias, limpieza al desmontar y gate global de cobertura, sin abrir trabajo nuevo fuera del contrato ya fijado.

### Fuera de alcance
- Añadir nuevas capacidades funcionales no previstas en `design.md`.
- Actualizar documentación funcional o arquitectónica dentro de esta misma tarea.
- Introducir herramientas de depuración, devtools o persistencia externa del estado.

### Dependencias
- `T0006-04` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - cualquier ajuste mínimo residual en `src/app/` o `src/runtime/` necesario para cerrar la integración
  - `src/runtime/runtime-state/` solo si la validación final revela incoherencias menores de integración
- Tests a crear o modificar:
  - `src/tests/app-bootstrap.test.tsx`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - el o los archivos de tests del estado compartido introducidos en tareas previas
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/architecture.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`

### Tests requeridos
- Confirmar que dos instancias montadas a la vez no comparten navegación, formularios ni queries.
- Confirmar que desmontar y remontar el runtime crea una instancia limpia.
- Ejecutar la regresión final relevante del runtime, bootstrap y store compartido.
- Ejecutar `pnpm test` para verificar el gate global de cobertura del proyecto.

### Criterios de finalización
- No quedan incoherencias entre store, navegación visible y dominios de formularios/queries.
- El aislamiento por instancia y la limpieza al remontaje quedan cubiertos por tests.
- La regresión final queda en verde y `pnpm test` mantiene el umbral global de cobertura.

### Cierre de implementación
Completado cuando la integración completa del núcleo compartido está validada con tests relevantes y `pnpm test` confirma el gate global del proyecto.

### Cierre documental
Pendiente de una pasada posterior de `update-app-documentation` sobre los documentos listados en el impacto documental.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0006-01`.

No se debe empezar `T0006-02` hasta cerrar `T0006-01`, ni `T0006-03` hasta cerrar `T0006-02`, ni `T0006-04` hasta cerrar `T0006-03`, ni `T0006-05` hasta cerrar `T0006-04`.
