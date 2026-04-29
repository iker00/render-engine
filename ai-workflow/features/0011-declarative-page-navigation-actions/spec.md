# Spec: Declarative page navigation actions

## Objetivo
Permitir que el runtime declare navegación interna entre páginas desde el propio `layout`, incorporando un primer disparador interactivo mínimo para que una configuración JSON pueda mover al usuario a otra página o volver a la anterior sin lógica imperativa externa y sin modificar la URL del navegador.

## Alcance
- Añadir una primera superficie interactiva mínima dentro del `layout` para disparar navegación declarativa.
- Introducir un nodo `button` como trigger inicial y acotado para esta primera capacidad interactiva.
- Permitir que un `button` declare una acción de navegación `navigateTo` o `goBack`.
- Reutilizar el estado compartido de navegación ya existente, incluido el historial interno y la resolución de la página activa.
- Mantener la semántica actual de entrada en página: cualquier navegación efectiva vuelve a tratar la página destino como una nueva entrada y relanza sus `preloads` si existen.
- Mantener esta feature centrada en navegación entre páginas, sin abrir todavía un sistema general de acciones declarativas ni otras interacciones de producto.
- Dejar la implementación preparada para que una feature futura pueda mover esta misma semántica de navegación a un modelo más general basado en eventos de interacción, sin exigir resolverlo ahora.

## Fuera de alcance
- Diseñar un motor general de eventos con múltiples triggers, acciones encadenadas o condiciones declarativas.
- Añadir superficies interactivas adicionales como `link`, submit de formularios u otros disparadores distintos de `button`.
- Introducir acciones declarativas de queries, mutaciones API, reset de formularios o combinaciones entre navegación y otras acciones.
- Modificar la URL del navegador, sincronizar con `window.history`, soportar deep links o abrir `routeParams`.
- Exponer todavía referencias declarativas sobre el estado de navegación para decidir visibilidad, deshabilitado o contenido dinámico de los triggers.
- Rediseñar la política actual de `preloads`, caché o reentrada de página más allá de reutilizar el comportamiento ya establecido.

## Requisitos funcionales
- El catálogo de nodos soportados por el runtime debe incorporar un nodo `button` como primera pieza interactiva declarativa.
- Un `button` debe poder mostrar una etiqueta visible y accionable dentro del layout de cualquier página.
- Un `button` puede declarar como mucho una acción de navegación en esta iteración.
- La acción `navigateTo` debe identificar una página destino por `pageId`, reutilizando el catálogo ya declarado en `pages`.
- La acción `goBack` no necesita parámetros adicionales y debe apoyarse en el historial interno del runtime.
- Al activar un `button` con `navigateTo` hacia una página existente y distinta de la página activa, el runtime debe convertir esa página en la nueva página visible.
- Al activar un `button` con `navigateTo` hacia la misma página ya visible, el runtime debe mantener el comportamiento pragmático actual: no cambiar la página, no duplicar historial y no relanzar `preloads`.
- Al activar un `button` con `navigateTo` hacia una página inexistente, el runtime debe conservar la página visible actual y registrar el mismo error recuperable de navegación ya previsto para destinos inválidos.
- Al activar un `button` con `goBack`, el runtime debe volver a la página previa válida más reciente registrada por la navegación interna.
- Si no existe una página previa válida, `goBack` debe comportarse como `no-op`: no cambia la página visible, no crea error recuperable y no inventa un destino alternativo.
- El historial funcional debe conservar el comportamiento ya implícito de las navegaciones efectivas:
  - navegar a la misma página visible no añade una nueva entrada
  - navegar `A -> B -> A` sí registra una nueva entrada de `A`
  - hacer `goBack` después de `A -> B -> A` debe devolver al usuario a `B`
- Cualquier navegación efectiva disparada por `navigateTo` o `goBack` debe tratar la página resultante como una nueva entrada de página y, por tanto, relanzar sus `preloads` si esa página los declara.
- Una configuración existente que no use nodos `button` debe mantener el comportamiento observable actual sin cambios.

## Requisitos no funcionales
- La sintaxis del trigger inicial debe seguir siendo simple de generar desde backend legacy: un nodo visible con una sola acción de navegación.
- La feature debe preservar el alcance acotado de v1: resolver el caso base de navegación entre páginas sin convertirse todavía en un sistema completo de interacción declarativa.
- La navegación debe seguir siendo completamente interna al runtime y determinista aunque el usuario haga varias activaciones rápidas.
- La terminología debe mantenerse alineada con el vocabulario ya establecido del proyecto: `pages`, `initialPage`, `preloads`, `button`, `navigateTo` y `goBack`.
- La primera superficie interactiva debe mantener semántica accesible de botón y no depender exclusivamente de comportamiento visual implícito.
- La validación del config debe rechazar shapes incompatibles o acciones de navegación mal declaradas antes de que el runtime intente ejecutarlas.

## Criterios de aceptación
- Dada una página con un nodo `button` configurado con `navigateTo` hacia otra página existente, al activarlo el runtime muestra la página destino.
- Dado un `button` con `navigateTo` hacia una página que declara `preloads`, al activarlo el runtime trata esa llegada como nueva entrada y dispara sus precargas.
- Dado un `button` con `navigateTo` hacia la misma página que ya está visible, al activarlo no cambia la página ni se relanzan `preloads`.
- Dado un `button` con `navigateTo` hacia una página inexistente, al activarlo el runtime mantiene la página actual y registra el error recuperable de navegación inválida.
- Dado un recorrido `home -> details -> home` mediante navegación declarativa, al activar después un `button` con `goBack` desde `home`, el runtime vuelve a `details`.
- Dado un `button` con `goBack` cuando no existe historial previo válido, al activarlo no ocurre ningún cambio visible ni error recuperable.
- Dada una configuración previa sin nodos `button`, el runtime mantiene su comportamiento actual y sigue renderizando las páginas estáticas existentes.
- Dado un config con un `button` cuya acción de navegación tiene shape inválido o referencia a un destino mal declarado, la validación del contrato la rechaza de forma explícita.

## Casos límite
- Una página puede declarar varios `button` de navegación distintos dentro del mismo `layout`.
- Varias páginas pueden navegar al mismo destino sin colisionar entre sí.
- Un usuario puede alternar rápido entre páginas; la navegación visible debe seguir resolviéndose de forma coherente con la última activación efectiva.
- Volver atrás puede reentrar en una página ya visitada y debe mantener la misma política de relanzar `preloads`.
- Un `button` puede existir en una página sin `preloads`; navegar desde él no debe inventar estados agregados adicionales fuera del comportamiento ya documentado.

## Riesgos o preguntas abiertas
- Esta feature fija un primer trigger interactivo mínimo con `button`; en planificación habrá que decidir cómo conservar una forma de acción reutilizable cuando en el futuro aparezcan `link`, submit de formularios u otros disparadores.
- El historial funcional queda acotado para `navigateTo` y `goBack`, pero futuras capacidades podrían necesitar exponer si existe o no página previa para condicionar la UI.
- La combinación de nuevo nodo visual, validación de contrato, acciones declarativas y semántica de historial sigue siendo lo bastante transversal como para justificar `design.md` antes de implementar.

## Nota de evolución
- Esta feature no introduce todavía `events`, `onClick` ni un motor general de interacción.
- El nodo `button` actúa solo como trigger mínimo y específico para navegación.
- Si más adelante el runtime abre un sistema general de eventos, la intención es reutilizar la misma semántica de `navigateTo` y `goBack` dentro de ese nuevo modelo, en vez de rediseñar la navegación desde cero.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Páginas y navegación

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
