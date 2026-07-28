# Tasks — 0119 — Form validation type guards unification

Alcance mínimo, una única tarea. Decisión ya cerrada en `spec.md` tras investigación exhaustiva en conversación.

---

## Task 1 — Fusionar `supportsTextLengthValidations`/`supportsTextualValidations`

- **ID**: 0119-T1
- **Estado**: pending
- **Objetivo**: En `src/config/validate-form-field-validations.ts`, sustituir las dos funciones idénticas
  `supportsTextLengthValidations` y `supportsTextualValidations` por una única función
  `supportsTextLengthAndPatternValidations(target: FormFieldValidationTarget)`, con el mismo cuerpo exacto que
  ambas comparten hoy. Actualizar los dos call-sites (`minLength`/`maxLength` en ~línea 349, `pattern`/`email`/`url`
  en ~línea 369) para usar el nombre nuevo.
- **Fuera de alcance**: `supportsSelectionCardinalityValidations` (categoría de reglas distinta, no se toca). Cualquier fichero de `src/runtime/`.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: `src/config/validate-form-field-validations.ts` (una función eliminada, una renombrada/unificada, dos call-sites actualizados).
  - Tests: ninguno a crear o modificar.
- **Tests**:
  - Ficheros de test: ninguno nuevo; cubierto por `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (existente).
  - Comportamiento cubierto: ninguna combinación campo/regla cambia de aceptada a rechazada ni viceversa.
  - Comandos: `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts`.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**: los 4 criterios de aceptación de `spec.md` verificados; `pnpm lint`, `pnpm build`, `pnpm test` en verde.
