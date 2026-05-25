# Discovery: strings dinámicos

## Problema a resolver
El runtime ya permite que ciertos strings del JSON sean referencias dinámicas completas, por ejemplo `queries.searchUsers.data.name`, `forms.user.name`, `params.id` o `item.title` dentro de un `repeater`.

La nueva necesidad es poder declarar interpolación parcial dentro de strings del JSON, combinando texto literal con referencias runtime como `queries.*`, `item.*` o `forms.*`. El caso buscado no es repetir la referencia completa actual como valor entero, sino permitir frases o valores compuestos.

## Contexto funcional relevante
- La convención actual distingue entre string literal, referencia completa soportada y referencia escapada con `\`.
- Las referencias completas ya se resuelven en texto visible (`heading`, `paragraph`), `image.src`, `image.alt`, celdas de `table`, request params, `navigateTo.params`, `defaultValue`, fuentes de colección, keys de `repeater` y `visibility.reference`.
- Hoy sí existen referencias completas: un texto como `queries.searchPosts.data.0.title` se resuelve porque el string entero es la referencia. Lo que no existe es interpolación parcial: un texto como `Nombre: {{queries.user.data.name}}` todavía no mezcla literal y valor dinámico.
- Las referencias soportadas vigentes incluyen `queries.{queryName}`, `queries.{queryName}.data`, `queries.{queryName}.data.*`, `queries.{queryName}.status`, `queries.{queryName}.error`, `forms.{formId}.{fieldId}`, `params.{paramName}` e `item`/`item.*` dentro de contexto de iteración.
- `params.*` está soportado solo como `params.{paramName}` y no admite navegación anidada.
- `visibility.value` compara strings literales y no debe reinterpretarlos como referencias.
- La ampliación posterior del alcance incluye también proyecciones visibles de colecciones: listas, opciones de `select`/`radioGroup`/`checkboxGroup` y celdas de `table`.

## Supuestos actuales
- El objetivo principal es hacer que props textuales y proyecciones visibles de colecciones puedan mostrar valores runtime sin tener que escribir una pantalla React específica.
- La decisión de producto ya descarta limitar esta feature a referencias completas: el objetivo es interpolación parcial.
- Conviene mantener la compatibilidad con backend legacy: las referencias deben seguir siendo strings simples fáciles de generar.
- La feature no debería abrir expresiones arbitrarias, filtros, operadores, formateadores ni transformaciones de datos en esta iteración.
- Donde el resultado no sea escalar renderizable, las superficies visibles deberían conservar la degradación actual a string vacío.

## Decisiones cerradas
- La sintaxis de interpolación parcial será `{{referencia.runtime}}`, por ejemplo `Hola {{queries.user.data.name}}`.
- El alcance aplicará a superficies visibles directas: `heading.props.text`, `paragraph.props.text`, `button.props.label`, labels de campos y `image.props.src` / `image.props.alt`.
- El alcance aplicará también a superficies de render y proyección de colecciones: strings visibles de `list`, `list.props.items.itemText`, `select`/`radioGroup`/`checkboxGroup` `props.items.label` y `props.items.value`, celdas string de `table` y `table.props.rows.cells`.
- En proyecciones de colecciones, `item.*` representará el item local que se está materializando, sin abrir `item.*` como namespace global fuera de `repeater` y de esas proyecciones.
- La interpolación parcial no aplicará inicialmente a requests (`query`, `body`, `headers`) ni a `navigateTo.params`.
- Si una referencia dentro de una plantilla no resuelve, se sustituirá por string vacío en superficies visibles.
- No se añadirá escape específico para escribir delimitadores `{{` o `}}` como texto literal.

## Preguntas abiertas
Sin preguntas abiertas de producto en discovery.

## Riesgos detectados
- Abrir interpolación parcial cambia una decisión histórica explícita del runtime y puede afectar muchos consumidores de strings.
- Si más adelante se aplica a request params, una referencia ausente podría convertir errores de construcción de request en strings vacíos silenciosos, cambiando la semántica actual.
- Extender todas las superficies string sin catálogo cerrado puede reinterpretar literales existentes que hoy se muestran tal cual; el alcance ampliado sigue usando un catálogo cerrado de superficies visibles y de proyección.
- Interpolar `value` de opciones puede afectar selección, limpieza de valores inválidos y submit si el catálogo cambia.
- Una sintaxis sin delimitadores para interpolación parcial sería ambigua con texto literal que contiene puntos.

## Documentos o áreas a revisar después
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `src/runtime/runtime-references/`
- `src/runtime/nodes/`
- `src/queries/`
- `src/config/validate-runtime-config.ts`
- `src/tests/runtime-reference-resolution.test.tsx`
- `src/tests/layout-renderer.test.tsx`
- `src/tests/runtime-api-execution.test.ts`
- `src/tests/runtime-config-validation.test.ts`

## Recomendación final
Lista para `spec.md`.

La decisión principal ya queda fijada: esta feature debe abrir interpolación parcial dentro de strings con sintaxis `{{...}}`, limitada a superficies visibles concretas y proyecciones de colecciones, sin escape específico para los delimitadores de plantilla.
