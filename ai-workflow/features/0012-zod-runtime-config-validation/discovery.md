# Discovery: validación del runtime config con Zod

## Problema a resolver
La validación estructural del runtime config vive hoy en lógica manual dentro de `src/config/validate-runtime-config.ts`. Funciona, pero concentra reglas heterogéneas, mezcla parsing con validaciones cruzadas y deja poco margen para evolucionar el contrato con errores más trazables y mantenibles.

La petición busca sustituir o reforzar esa validación con esquemas `Zod` para:
- mejorar la legibilidad del contrato soportado
- hacer más trazable el origen de los errores
- reducir coste de evolución cuando entren nuevos nodos, props o ramas del JSON

## Contexto funcional relevante
- El runtime valida toda la configuración antes de renderizar.
- El contrato visible actual está documentado en `ai-workflow/docs/app-features/config-contract.md`.
- `validateRuntimeConfig` devuelve hoy un resultado estable con `status: ready | error`, `RuntimeConfigError` y resolución de `initialPage`.
- El estado actual del proyecto declara explícitamente que todavía no existe validación con `Zod`.
- La base documental del proyecto ya considera `Zod` parte del stack, pero `package.json` todavía no lo declara como dependencia.

## Supuestos actuales
- La feature debe preservar el contrato funcional ya soportado salvo que la spec diga lo contrario.
- El consumidor público principal sigue siendo `validateRuntimeConfig`, aunque su implementación interna cambie.
- La mejora principal esperada es diagnóstica y de mantenibilidad, no abrir todavía nuevas capacidades del JSON.
- Instalar `zod` parece necesario en implementación, pero no bloquea esta fase de discovery.

## Preguntas abiertas
- ¿La spec debe exigir sustitución completa del validador manual o permitir una estrategia híbrida donde `Zod` cubra estructura y queden validaciones cruzadas fuera del esquema?
- ¿El shape público de `RuntimeConfigError` debe mantenerse intacto o puede enriquecerse con path/cause derivados de `Zod`?
- ¿Qué nivel de compatibilidad exacta se espera para los mensajes actuales de error: mismo `code`, mismos textos, o solo misma semántica?
- ¿La feature debe limitarse al runtime config actual o dejar preparada una base reutilizable para futuras validaciones de formularios o acciones?

## Riesgos detectados
- Riesgo de regresión silenciosa en configuraciones hoy válidas si el esquema `Zod` cambia matices del contrato.
- Riesgo de empeorar el diagnóstico visible si la adaptación desde `Zod` a `RuntimeConfigError` se hace de forma demasiado genérica.
- Riesgo de duplicar reglas si se mantiene demasiado tiempo un modelo híbrido sin frontera clara entre esquema y validaciones adicionales.
- Riesgo de que la documentación siga describiendo un contrato distinto del realmente aceptado si no se actualizan fichas funcionales tras la migración.

## Áreas y documentos a revisar después
- `src/config/validate-runtime-config.ts`
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config.ts`
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts`
- `src/app/bootstrap/read-runtime-config.ts`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/current-state.md`

## Recomendación final
Lista para `spec.md`.

La ambigüedad principal está en la estrategia técnica interna, no en el objetivo funcional. La spec puede fijar como contrato que:
- la validación del runtime config pase a apoyarse en `Zod`
- el runtime preserve el contrato JSON estable actual salvo cambios explícitos
- los errores ganen trazabilidad sin degradar la semántica pública esperada por bootstrap y tests

La decisión entre sustitución completa o refuerzo híbrido puede resolverse en `design.md` si la planificación confirma que el riesgo es alto.
