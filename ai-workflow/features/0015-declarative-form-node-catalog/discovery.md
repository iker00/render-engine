# Discovery: Declarative form node catalog

## Problema a resolver
El runtime ya dispone de un dominio interno `forms` organizado por `formId.fieldId`, con inicialización, escritura, lectura y reset, pero ese estado todavía no tiene una frontera declarativa real en `pages[].layout`.

Hoy la configuración puede:
- leer `forms.{formId}.{fieldId}` como referencia
- resetear un formulario por `formId` desde una acción común

Pero todavía no puede:
- declarar un nodo `form` en el catálogo soportado
- declarar campos reales dentro del árbol JSON
- inicializar el estado de formularios desde la propia configuración

El resultado es que cualquier formulario real sigue dependiendo de componentes React específicos del caso de uso, justo lo contrario del objetivo del runtime configurable.

## Contexto funcional relevante
- `0006-shared-runtime-state-core` ya dejó estable el dominio `forms` y dejó fuera expresamente nodos visuales como `form`, `input`, `select` o `textarea`.
- `0014-shared-runtime-ui-actions-foundation` ya dejó `action` como contrato reutilizable para triggers futuros como `form`, de modo que submit y reset ya tienen una base compartida razonable.
- La documentación funcional ya anticipa formularios declarativos, campos reutilizables, `defaultValue`, `onSubmit` y reset tras éxito, pero también deja claro que la UX declarativa de validación sigue pendiente.
- El catálogo visible actual solo soporta `container`, `heading`, `paragraph`, `list` y `button`, así que introducir `form` abre un nuevo bloque estructural, no una simple variante visual.

## Supuestos actuales
- La feature debería reutilizar el dominio `forms` ya existente en el store y no crear un estado paralelo de formularios.
- El nodo `form` debería convertirse en la unidad declarativa que conecte configuración, render e inicialización del estado `forms.{formId}.{fieldId}`.
- Para que el nodo `form` sea útil de verdad, no basta con añadir `type: form`; hace falta al menos un catálogo mínimo de campos declarativos consumibles desde JSON.
- La validación visual completa, reglas complejas y flujos avanzados de submit no tienen por qué entrar en la primera iteración si eso impide fijar una frontera simple y estable.
- La base de acciones común introducida en `0014` hace razonable reutilizar `executeOperation` y `resetForm` en futuras interacciones del formulario, en vez de inventar contratos nuevos.

## Decisiones ya cerradas
- La primera iteración incluirá `form`, `input`, `textarea` y `select`, dejando `radioGroup` y `checkboxGroup` para una feature posterior.
- El nodo `form` reutilizará `children` como colección ordenada del runtime y, en esta iteración, admitirá campos de formulario y `button`.
- El estado interno seguirá organizado por `forms.{formId}.{fieldId}`.
- En el árbol declarativo, el `formId` lo aporta el nodo `form` contenedor y cada campo declarará solo `fieldId`.
- El identificador del formulario se expresará con `form.id`, no con `props.formId`.
- El `form` tendrá submit declarativo mínimo reutilizando la acción común existente, en concreto `submitAction` con `type: executeOperation`.
- El submit debe permitir enviar datos del propio formulario mediante referencias ya soportadas en `api.body`, por ejemplo `forms.userForm.email`.
- El formulario podrá declarar `resetOnSuccess` como flag opcional.
- `defaultValue` aceptará tanto literales como referencias completas ya soportadas por el runtime.
- `select` solo admitirá `items` estáticos en esta iteración.
- La validación declarativa inicial se limitará a `required`.
- Los campos condicionales quedan fuera de alcance.
- El nodo `form` se renderizará como un `<form>` real, interceptará `onSubmit`, evitará el submit HTML nativo y mantendrá soporte de envío con Enter cuando aplique.

## Preguntas abiertas
- Cómo se modela exactamente el catálogo mínimo de campos en la spec:
  - props comunes compartidas
  - props específicas de `input`, `textarea` y `select`
  - shape exacto de `select.props.items`
- Qué semántica exacta tendrá la inicialización declarativa de campos cuando el formulario ya exista en estado:
  - cuándo se inicializa un campo
  - cuándo se conserva un valor ya escrito
  - cómo evitar sobrescrituras inesperadas al rerenderizar o volver a una página
- Si el submit del `form` convivirá con `button` de acción libre dentro de `form.children` sin reglas adicionales o si la spec debe limitar explícitamente qué acciones se consideran submit frente a acciones auxiliares.

## Riesgos detectados
- Si la feature se formula solo como “añadir `type: form`”, quedará un nodo vacío que no elimina la necesidad de componentes React específicos.
- Si se intenta cerrar en una sola pasada todo el catálogo previsto de campos, validación declarativa completa, items dinámicos y submit avanzado, el alcance puede crecer demasiado para v1.
- La decisión sobre la estructura interna del formulario condiciona tipos públicos, validación `Zod`, renderer, inicialización del store y reutilización de acciones, así que hay complejidad transversal real.
- El estado `forms` ya existe y se conserva entre páginas; si la inicialización declarativa de campos no define bien su semántica, pueden aparecer sobrescrituras inesperadas o defaults ambiguos al remontar o revisitar páginas.
- La capacidad de leer referencias `forms.*` ya está activa; abrir escritura declarativa sin fijar bien cuándo se inicializa un campo puede generar comportamientos difíciles de explicar.

## Documentos o áreas de código a revisar después
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/features/0006-shared-runtime-state-core/`
- `ai-workflow/features/0014-shared-runtime-ui-actions-foundation/`
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config-zod.ts`
- `src/config/validate-runtime-config.ts`
- `src/runtime/layout-node-renderer.tsx`
- `src/runtime/layout-renderer.tsx`
- `src/runtime/runtime-state/`
- `src/runtime/nodes/`

## Recomendación final
Lista para `spec.md`, con algunas decisiones de comportamiento todavía por concretar dentro de la propia spec.

La dirección general y el alcance mínimo ya están suficientemente fijados para pasar a la siguiente fase:
- catálogo inicial con `form`, `input`, `textarea` y `select`
- `form.children` como colección ordenada reutilizable
- estado por `forms.{formId}.{fieldId}` con `form.id` como identificador declarativo
- submit declarativo mínimo reutilizando `executeOperation`
- `resetOnSuccess`, `defaultValue` dinámico y validación `required` como capacidades iniciales

La `spec.md` todavía tendrá que concretar detalles de contrato y semántica de inicialización, pero esas decisiones ya no bloquean el paso de discovery a spec. La feature sigue requiriendo `design.md` porque afectará al contrato JSON, a la validación previa al render, al renderer y al acoplamiento con el store compartido.
