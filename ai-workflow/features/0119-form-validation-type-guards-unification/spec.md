# 0119 — Form validation type guards unification

## Objetivo
Eliminar una duplicación real de código encontrada al investigar el hallazgo A-14 de la auditoría técnica (2026-07-27).

## Motivación y contexto de la investigación
El hallazgo original sospechaba una posible duplicación de "guardas de tipo" entre `src/config/` (valida que las reglas de formulario en el JSON tengan sentido para el tipo de campo) y `src/runtime/` (ejecuta esas reglas contra el valor que el usuario ha escrito). Investigado en conversación con el usuario, esa sospecha **no se sostiene**: el dispatcher de runtime (`getFirstVisibleValidationError` en `src/runtime/runtime-form-validations.ts`) no vuelve a comprobar compatibilidad de tipo de campo; solo comprueba la forma del valor (`typeof value === 'string'`, `Array.isArray(value)`, etc.), confiando en que `src/config/` ya rechazó cualquier combinación inválida. No hay duplicación peligrosa entre capas.

Lo que sí se encontró, dentro de un único fichero (`src/config/validate-form-field-validations.ts`): dos funciones **byte a byte idénticas** con nombres distintos:
- `supportsTextLengthValidations` (gatea `minLength`/`maxLength`)
- `supportsTextualValidations` (gatea `pattern`/`email`/`url`)

Se investigó si esta coincidencia es accidental o si responde a dos conceptos que podrían divergir con un tipo de campo futuro. Revisado el catálogo real y cerrado de `inputType` (`text`, `email`, `password`, `search`, `tel`, `url`, `number`, `date`, `datetime-local`, `time`): no existe, ni es previsible dentro del alcance intencionadamente acotado del proyecto (`context.md`: "no busca resolver un motor UI completamente genérico"), ningún tipo de campo donde longitud y formato textual deban responder cosas distintas. La coincidencia no es accidental ni frágil: es estructural al catálogo actual. Se descarta mantenerlas separadas como salvaguarda especulativa.

## Alcance
- Fusionar `supportsTextLengthValidations` y `supportsTextualValidations` en una única función en `src/config/validate-form-field-validations.ts`.
- Nombre de la función resultante: `supportsTextLengthAndPatternValidations` (deja explícito en el nombre que cubre ambas categorías de reglas, en vez de elegir arbitrariamente uno de los dos nombres existentes).
- Actualizar los dos call-sites (líneas ~349 y ~369 de `validate-form-field-validations.ts`) para usar la función unificada.
- `supportsSelectionCardinalityValidations` no se toca: cubre una categoría de reglas distinta (`minSelections`/`maxSelections`) sin relación con esta duplicación.

## Fuera de alcance
- Cualquier cambio en `src/runtime/runtime-form-validations.ts` (no tiene duplicación real, confirmado en la investigación).
- Cualquier cambio de comportamiento de validación observable: ninguna combinación campo/regla que hoy se acepta o rechaza cambia.
- Cualquier cambio en `supportsSelectionCardinalityValidations`.

## Requisitos funcionales
1. Existe una única función que decide si un campo admite `minLength`/`maxLength`/`pattern`/`email`/`url`, con el mismo criterio exacto que las dos funciones actuales (idéntico para todos los `target` posibles, porque los cuerpos ya eran idénticos).
2. Los dos call-sites que hoy usan `supportsTextLengthValidations`/`supportsTextualValidations` usan la función unificada.

## Criterios de aceptación
1. `grep -n "supportsTextLengthValidations\|supportsTextualValidations" src/config/validate-form-field-validations.ts` no devuelve ninguna coincidencia.
2. `grep -n "supportsTextLengthAndPatternValidations" src/config/validate-form-field-validations.ts` devuelve exactamente 3 coincidencias (la definición + los 2 call-sites).
3. La suite existente de `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` sigue en verde sin cambiar ninguna aserción.
4. `pnpm lint`, `pnpm build` y `pnpm test` completan sin errores, manteniendo el umbral de cobertura del 80%.

## Riesgos o preguntas abiertas
Ninguno. Alcance cerrado y decidido en conversación con el usuario tras investigación exhaustiva del catálogo real de tipos de campo.

## Documentación afectada
Ninguna. No cambia ningún comportamiento observable ni contrato documentado en `ai-workflow/docs/app-features/`.
