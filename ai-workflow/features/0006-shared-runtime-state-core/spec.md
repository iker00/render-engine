# Spec: Shared runtime state core

## Objetivo
Definir un núcleo de estado compartido dentro del runtime para sostener navegación interna, formularios y queries bajo un mismo modelo operativo, de forma que las siguientes iteraciones del renderer puedan reutilizar una única fuente de verdad por instancia sin duplicar estado ni acoplar la UI a lógica imperativa dispersa.

## Alcance
- Introducir un estado compartido por instancia de runtime que agrupe navegación, formularios y queries.
- Fijar el comportamiento base esperado de cada dominio de estado aunque la UI final de formularios, acciones y feedback todavía crezca en features posteriores.
- Mantener la navegación como estado interno del runtime, sin cambiar la URL del navegador.
- Preservar el modelo de formularios por `formId.fieldId` ya descrito en la documentación funcional.
- Preservar el modelo de queries compartidas por nombre, con estado `status/data/error` reutilizable por varios bloques de la misma pantalla.
- Garantizar que el renderer actual siga pudiendo arrancar y renderizar `initialPage` aunque una configuración no use todavía navegación interactiva, formularios ni queries reales.

## Fuera de alcance
- Introducir routing del navegador, deep links o sincronización con historial externo.
- Diseñar el catálogo completo de nodos de formulario o cerrar en esta feature toda la UX de validación visual.
- Implementar una capa completa de cliente API avanzada con caché persistente, reintentos automáticos, deduplicación global o políticas complejas de invalidación.
- Resolver `routeParams`, interpolación compleja de strings o un motor genérico de expresiones declarativas.
- Añadir autenticación, permisos, subida de archivos, tablas avanzadas o theming.
- Convertir esta feature en la implementación completa de navegación funcional, formularios finales y queries remotas; su objetivo es fijar el núcleo compartido que esas capacidades usarán.

## Requisitos funcionales
- Cada instancia montada del runtime debe crear y mantener su propio estado compartido, aislado de otras instancias presentes en la misma página.
- El estado compartido debe incluir, como mínimo, el identificador de página actual resuelto desde `initialPage` al arrancar.
- La selección de página activa debe poder cambiarse internamente sin rehacer el contrato base de `pages` e `initialPage` y sin tocar la URL del navegador.
- El estado de navegación debe incluir desde esta base una estructura mínima preparada para historial interno, aunque la primera UI solo dependa directamente de la página actual.
- Si una navegación interna intenta resolver una página inexistente, el runtime debe tratarlo como error controlado y conservar la página activa anterior.
- El estado de formularios debe vivir dentro del runtime y organizarse por `forms.{formId}.{fieldId}` con una única fuente de verdad compartida entre los bloques que lean o escriban esos valores.
- El estado de formularios debe permitir inicialización predecible, actualización de valores, lectura consistente y reseteo controlado por formulario sin exigir eventos personalizados para el mantenimiento básico de los datos.
- El reseteo de un formulario debe restaurar el estado inicial efectivo de cada campo dentro de esa instancia, incluyendo `defaultValue` cuando exista.
- El modelo base de formulario debe contemplar al menos `value` y `error` por campo, y dejar prevista la incorporación de `touched` y `dirty` sin rehacer el contrato del estado.
- El estado de queries debe vivir dentro del runtime y organizarse por nombre de query o acción declarada, de forma que varios bloques puedan reaccionar al mismo resultado compartido.
- Cada query debe exponer como base `status`, `data` y `error`, alineado con la documentación funcional vigente.
- La representación de error de query debe ser estable y orientada a UI, evitando acoplar los consumidores al shape técnico bruto de red o backend.
- Las queries compartidas deben identificarse en esta fase por nombre declarado, sin introducir todavía claves de caché dependientes de parámetros.
- Cuando una query vuelva a cargar, el runtime debe poder mantener el último dato válido mientras el nuevo estado pasa por `loading`, salvo que una acción futura defina una limpieza explícita.
- El núcleo compartido debe permitir que futuras precargas de página y acciones mutadoras actualicen el mismo estado de queries sin duplicar resultados locales por componente.
- Cuando una configuración no use todavía formularios ni queries, el runtime debe seguir comportándose como hoy y renderizar la página inicial sin exigir configuración adicional.
- El ciclo de vida del estado debe ser predecible: al desmontar la instancia del runtime no debe persistir estado anterior de navegación, formularios o queries en una instancia nueva salvo que una feature futura lo abra explícitamente.
- Un cambio de página dentro de la misma instancia debe conservar por defecto el estado existente de formularios y queries mientras no se defina una regla explícita de limpieza.
- Los errores recuperables de formularios o queries no deben romper por sí solos todo el render de la página; deben quedar encapsulados en su dominio de estado para que la UI pueda decidir cómo reaccionar.
- La solución debe soportar oficialmente varias instancias del runtime montadas a la vez sin compartir navegación, formularios ni queries entre ellas.
- El núcleo debe poder exponer una fachada común de estado compartido apoyada internamente en dominios separados para navegación, formularios y queries.
- Debe existir una capacidad interna de reseteo total del estado del runtime además de resets por dominio o por formulario.

## Requisitos no funcionales
- La solución debe ser lo bastante transversal para servir de base a varias features, pero mantenerse acotada y entendible para la v1.
- El modelo resultante debe reforzar la separación entre render visual, lógica de estado e integraciones de red ya marcada por la arquitectura del proyecto.
- La incorporación del núcleo compartido no debe degradar el comportamiento estable del renderer estático ya existente cuando no haya interacción.
- La terminología del estado debe seguir las convenciones ya documentadas para `forms.*`, `queries.*` y navegación interna del runtime.
- La feature debe dejar un contrato suficientemente claro como para que la planificación pueda dividir después navegación, formularios y queries en tareas verificables sin reinterpretar el modelo base.

## Criterios de aceptación
- Dada una configuración válida sin capacidades interactivas nuevas, el runtime sigue arrancando en `initialPage` y renderiza la misma página visible que hoy.
- Dada una instancia de runtime, su página activa se resuelve desde estado interno compartido y no desde una selección hardcodeada fuera de ese estado.
- Dada una transición interna de navegación dentro de la misma instancia, la página activa cambia sin modificar la URL del navegador.
- Dada una navegación hacia una página inexistente, el runtime conserva la página activa previa y registra un error controlado en lugar de dejar el estado en una situación ambigua.
- Dado un valor escrito en `forms.userSearch.name`, cualquier lectura posterior de `forms.userSearch.name` dentro de la misma instancia devuelve el mismo valor actual hasta que se cambie o se resetee el formulario.
- Dado el reseteo de un formulario, sus campos vuelven al estado base definido para esa instancia, aplicando `defaultValue` cuando exista, sin afectar a otros formularios del mismo runtime.
- Dada una query compartida llamada `searchUsers`, varios bloques de la misma instancia pueden observar el mismo `status`, `data` y `error` sin mantener copias locales divergentes.
- Dada una recarga de `searchUsers`, el runtime puede mantener visible el último `data` válido mientras el `status` cambia temporalmente a `loading`.
- Dado un error recuperable en una query concreta, el runtime conserva operativa la instancia y la UI puede seguir mostrando otros bloques no afectados.
- Dadas dos instancias del runtime montadas a la vez, un cambio de página, de formulario o de query en una de ellas no altera el estado de la otra.
- Dado el desmontaje y remontaje del runtime, la nueva instancia arranca con un estado limpio y no reutiliza silenciosamente el estado anterior.
- Dado un cambio de página normal dentro de la misma instancia, el runtime conserva por defecto el estado de formularios y queries existentes mientras no se configure una limpieza explícita.

## Casos límite
- Una configuración declara varias páginas pero ninguna interacción cambia la navegación; el runtime debe seguir mostrando solo la página inicial sin comportamiento inesperado adicional.
- Un formulario existe en varias páginas o se renderiza condicionalmente; por defecto su estado se preserva mientras viva la misma instancia, salvo que una acción o regla futura ordene reiniciarlo.
- Una query puede pasar por `idle`, `loading`, `success` y `error` varias veces dentro de la misma sesión; el estado compartido debe soportar estas transiciones sin dejar a la UI en un estado ambiguo.
- Una pantalla puede depender a la vez de estado de navegación, formularios y queries; el núcleo debe evitar dependencias circulares o acoplamientos que obliguen a duplicar datos entre dominios.
- Una instancia puede no usar alguno de los tres dominios; el núcleo compartido debe tolerarlo sin exigir inicialización manual innecesaria.
- Dos pantallas distintas pueden observar la misma query compartida dentro de la instancia; el cambio de página no debe forzar por sí mismo la pérdida del último resultado disponible.

## Riesgos o preguntas abiertas
- Hay riesgo de que esta feature derive hacia una mini librería de state management genérica; la planificación debe mantenerla enfocada al runtime declarativo y a sus tres dominios concretos.
- Al ser una base transversal, conviene cerrar un `design.md` antes de programar para evitar decisiones divergentes entre `runtime/`, `forms/` y `queries/`.

## Áreas de producto afectadas
- Runtime UI configurable
- Páginas y navegación
- Formularios y validación
- Queries y feedback
- Arquitectura interna del runtime

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
