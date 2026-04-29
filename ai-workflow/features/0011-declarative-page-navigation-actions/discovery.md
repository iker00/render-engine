# Discovery: Declarative page navigation actions

## Problema a resolver
El runtime ya resuelve una página activa desde estado compartido y puede cambiarla internamente con `navigateToPage(pageId)`, pero la configuración JSON todavía no puede declarar navegación entre páginas. Eso mantiene la experiencia en un estado funcionalmente estático: solo hay una página visible y no existe una forma declarativa final de mover al usuario a otra pantalla o volver atrás sin escribir lógica imperativa fuera del renderer.

La petición busca cerrar esa brecha con acciones como `navigateTo` y `goBack`, manteniendo la URL intacta y convirtiendo el runtime en una experiencia multipágina interna real.

## Contexto funcional relevante
- El contrato actual ya separa `pages` e `initialPage`, y la página visible se resuelve desde `navigation.currentPageId`.
- El store compartido ya conserva `history` y un error recuperable `page-not-found`, pero hoy solo expone la acción interna `navigateToPage(pageId)`.
- El reducer actual añade al historial cada navegación a una página distinta y no toca la URL del navegador.
- La reentrada en una página vuelve a disparar sus `preloads`; eso ya está implementado y afecta directamente a cualquier futura acción de navegación.
- El runtime todavía no soporta nodos interactivos ni disparadores declarativos finales desde `layout`, así que exponer `navigateTo` y `goBack` no es solo una ampliación del estado de navegación: también obliga a decidir cómo se representan y desde dónde se disparan esas acciones en el JSON.

## Supuestos actuales
- La navegación de esta feature seguirá siendo interna al runtime y no modificará la URL ni dependerá del router del navegador.
- `navigateTo` debería reutilizar el catálogo actual de páginas por `pageId`, sin abrir todavía `routeParams` ni navegación externa.
- `goBack` debería apoyarse en el historial interno ya existente, no en el historial del navegador.
- La semántica actual de reentrada con relanzado de `preloads` probablemente seguirá aplicando también cuando la entrada venga de `navigateTo` o `goBack`, salvo que producto decida otra cosa.
- La feature no necesita abrir deep links, sincronización con `window.history` ni parámetros de ruta para ser útil en esta iteración.
- Las acciones de navegación no vivirán aisladas; se dispararán desde eventos o acciones asociados a elementos del layout, por ejemplo un botón, un enlace o el envío de un formulario.

## Decisiones ya tomadas
- La navegación declarativa entre páginas no se expondrá como mecanismo autónomo separado del resto de interacciones del runtime.
- `navigateTo` y `goBack` formarán parte del sistema de acciones o eventos asociado a elementos declarativos del layout.
- La misma familia de acciones debería poder ser usada desde distintas superficies interactivas futuras, como botones, enlaces o submit de formularios.
- `goBack` tendrá semántica de `no-op` cuando no exista una página previa válida en el historial interno; no deberá producir error recuperable ni fallback implícito.
- Esta feature, si llega a tener `spec.md`, se limitará solo a navegación entre páginas y no intentará abrir composición con queries, submit de formularios ni otras acciones declarativas.

## Preguntas abiertas
- Si el historial debe tratar repeticiones de forma estricta o pragmática:
  - conservar duplicados al navegar `A -> B -> A`
  - evitar entradas redundantes en algunos casos
  - mantener el comportamiento actual de no añadir nada al navegar a la misma página visible

## Riesgos detectados
- Si se define `navigateTo` y `goBack` sin fijar antes el trigger declarativo, la spec puede quedar incompleta o forzar una segunda feature inmediata para volverla usable.
- Si la primera representación de acciones es demasiado específica, puede bloquear una evolución coherente hacia otros disparadores declarativos del runtime.
- La semántica de `goBack` ya queda acotada como `no-op` sin página previa, pero sigue afectando historial, reentrada de páginas y relanzado de `preloads`.
- El cambio toca contrato JSON, validación, estado compartido, reducer/provider y al menos una nueva superficie visual interactiva; la complejidad transversal es suficiente para prever `design.md`.

## Nota relacionada
- Si en una iteración futura el layout necesita ocultar o mostrar triggers de navegación según exista página anterior, eso probablemente requerirá abrir referencias declarativas sobre estado de navegación, por ejemplo una capacidad equivalente a `navigation.history.back` o derivadas similares. Esa necesidad no forma parte de esta feature y depende además de futuras capacidades como `visibleWhen`.

## Áreas o documentos a revisar después
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/architecture.md`
- `src/runtime/runtime-state/runtime-state-types.ts`
- `src/runtime/runtime-state/runtime-state-reducer.ts`
- `src/runtime/runtime-state/runtime-state-provider.tsx`
- `src/config/validate-runtime-config.ts`
- `src/runtime/layout-node-renderer.tsx`
- `src/runtime/nodes/`

## Recomendación final
Requiere decisión de producto antes de `spec.md`.

La dirección general ya está clara y no parece discutible: navegación interna por estado compartido, sin tocar la URL, con soporte mínimo para `navigateTo` y `goBack`. Lo que todavía bloquea una `spec.md` estable es fijar tres decisiones de contrato:
- el tratamiento funcional del historial interno y sus repeticiones
- el grado de acoplamiento con el futuro sistema general de eventos y acciones del runtime
- si esta feature debe existir de forma separada o absorbida por la futura feature de eventos/acciones

Cuando esas decisiones se cierren, la feature debería pasar a `spec.md` con riesgo alto y `design.md` previsto.
