# Spec: Zod runtime config validation

## Objetivo
Migrar la validación del runtime config a una base apoyada en `Zod` para que el contrato JSON del runtime sea más explícito, evolucione con menos fricción y produzca diagnósticos más trazables, sin ampliar en esta feature las capacidades funcionales del JSON ni romper la frontera pública que el bootstrap y los tests ya consumen.

## Alcance
- Sustituir la base principal de validación estructural del runtime config por esquemas `Zod`.
- Preservar el contrato funcional ya soportado del JSON de runtime para `api`, `pages`, `initialPage`, `preloads` y el catálogo vigente de nodos declarativos.
- Mantener `validateRuntimeConfig` como entrada pública estable para validar la configuración antes de renderizar.
- Permitir que la validación siga resolviendo una configuración lista para usar o un error de configuración semánticamente equivalente al actual.
- Mejorar la trazabilidad del origen de errores de configuración, especialmente cuando el problema afecta a rutas concretas del JSON.
- Dejar abierta una capa complementaria para validaciones cruzadas o reglas no expresables de forma razonable dentro del esquema, siempre que esa capa no duplique sin necesidad el contrato principal.

## Fuera de alcance
- Añadir nuevas capacidades del contrato JSON, nuevos nodos o nuevas props declarativas.
- Cambiar la semántica funcional de `api`, `pages`, `initialPage`, `preloads`, referencias dinámicas o navegación.
- Abrir todavía validación `Zod` para formularios, acciones declarativas, payloads remotos u otras áreas distintas del runtime config de arranque.
- Rediseñar el flujo visible de bootstrap fuera de lo necesario para seguir informando errores de configuración.
- Introducir una nueva taxonomía pública de errores ajena a la que hoy conocen bootstrap y tests si no existe una razón explícita de producto.

## Requisitos funcionales
- El runtime debe seguir validando toda la configuración antes de intentar renderizarla.
- La validación basada en `Zod` debe aceptar el mismo shape estable del contrato actual para:
  - `api` como catálogo de operaciones nombradas
  - `pages` como colección ordenada de páginas
  - `initialPage` como identificador de entrada
  - `preloads` como lista opcional de strings no vacíos
  - `layout` como colección ordenada de nodos soportados
- El catálogo de nodos soportados por la validación debe seguir alineado con el contrato vigente del runtime en el momento de implementar la feature, sin perder soporte para nodos ya admitidos.
- Una configuración válida debe seguir produciendo un resultado listo para usar por el runtime sin exigir transformaciones manuales adicionales por parte del consumidor público.
- Una configuración inválida debe seguir produciendo un error de configuración antes del render, con semántica suficiente para distinguir al menos errores de layout/configuración inválida, nodo no soportado e `initialPage` inexistente.
- Si `initialPage` no coincide con ninguna página declarada, la validación debe seguir fallando de forma explícita aunque el resto de la estructura sea válida.
- Si el shape de `layout`, `api`, `pages`, `preloads` o de un nodo soportado es incompatible con el contrato, la validación debe seguir rechazarlo antes de renderizar.
- La mejora diagnóstica debe permitir ubicar mejor el origen del fallo dentro del JSON cuando el problema dependa de una ruta concreta, sin obligar al consumidor de la API pública a entender internamente `Zod`.
- La feature puede combinar esquema `Zod` y validaciones cruzadas adicionales, pero la frontera pública debe seguir ofreciendo un único resultado coherente de validación.
- Una configuración existente que hoy sea válida debe seguir siendo válida salvo que dependa de un comportamiento ambiguo o accidental no documentado; cualquier endurecimiento intencionado debe quedar explícito y justificarse en planificación.

## Requisitos no funcionales
- La migración debe priorizar legibilidad y mantenibilidad del contrato por encima de reescribir solo por sustitución tecnológica.
- La solución debe evitar duplicar reglas estructurales entre el esquema `Zod` y lógica manual paralela salvo cuando una validación cruzada lo haga inevitable.
- La validación resultante debe seguir siendo determinista y ejecutarse en el borde del bootstrap sin introducir dependencia del render React.
- La terminología usada en el contrato y en los diagnósticos debe mantenerse alineada con la documentación funcional del proyecto: `api`, `pages`, `initialPage`, `preloads`, `layout` y tipos de nodo soportados.
- La mejora diagnóstica no debe degradar la política actual de visibilidad de errores entre desarrollo y producción.
- La feature debe preservar el alcance acotado de v1: reforzar la calidad del contrato actual sin convertir esta iteración en un motor general de validaciones reutilizables para toda la aplicación.

## Criterios de aceptación
- Dada una configuración actualmente válida con `api`, `pages`, `initialPage` y `layout`, `validateRuntimeConfig` la sigue aceptando y devuelve un resultado listo para usar.
- Dado un config con `initialPage` que no coincide con ninguna página declarada, `validateRuntimeConfig` sigue devolviendo un error explícito previo al render.
- Dado un config con `pages` no array, `layout` no array, `preloads` mal declarado o un nodo con shape inválido, la validación lo rechaza antes de renderizar.
- Dado un config con un nodo no soportado dentro de `layout` o `children`, la validación lo rechaza de forma explícita y no lo reinterpreta silenciosamente.
- Dado un config inválido por una ruta concreta del JSON, el resultado de validación ofrece un diagnóstico al menos tan útil como el actual y preferiblemente más trazable hacia esa ruta.
- Dada una configuración existente que no depende de la nueva implementación interna, su comportamiento observable en bootstrap y tests no cambia por el mero hecho de usar `Zod`.
- Dado un error de validación marcado como visible en desarrollo o siempre visible según la semántica estable actual, la política de presentación entre desarrollo y producción se mantiene.

## Casos límite
- `api` puede estar vacío y seguir siendo válido si el resto del contrato lo es.
- `preloads` puede no declararse o declararse como lista vacía.
- `layout` puede ser una colección vacía.
- Una página puede incluir varios nodos hermanos en la raíz sin `container` sintético.
- Una configuración puede mezclar estructuras válidas con una única rama inválida; la validación debe rechazar el conjunto completo y señalar la rama problemática de forma útil.
- El contrato puede requerir validaciones que dependen de más de un campo, como la coherencia entre `initialPage` y `pages`; esas reglas no deben perderse al pasar a `Zod`.

## Riesgos o preguntas abiertas
- Queda por decidir en planificación si la migración debe ser sustitución completa del validador manual o una estrategia híbrida con validaciones cruzadas posteriores al esquema.
- Queda por decidir qué compatibilidad exacta se exige para los mensajes de error: misma semántica y códigos, o también textos prácticamente idénticos.
- Si la adaptación desde `Zod` a `RuntimeConfigError` se simplifica demasiado, se puede perder parte de la trazabilidad que motiva la feature.
- La migración toca una frontera central del runtime y el contrato estable del bootstrap; por eso sigue justificando `design.md` antes de implementar.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Desarrollo local del runtime

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/development-workflow.md`
