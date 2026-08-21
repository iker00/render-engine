# Notas — dev-editor-api-preloads-navigate-params

## Corrección post-implementación: raw/normalized divergence de `preloads` (2026-08-21)

`design.md` (D6) y `tasks.md` (T7) asumían que `preloads` podía serializarse "tal cual" —
mismo criterio que `shell.header.actions` — porque no vieron ninguna divergencia entre la forma
que expone el commit de página (`patchRawConfigTextWithLayout`) y la forma normalizada. Esa
asunción era incorrecta: `RuntimePreloadConfig` (forma en memoria/normalizada,
`{ operationName, requestParams, when? }`) y la forma raw que `validatePreloadEntries`
(`src/config/validate-preloads.ts`) acepta en el JSON (`{ [operationName]: requestParams, when?
}`, con el nombre de operación como única clave) son distintas. Serializar el array normalizado
tal cual producía un objeto de 2 claves (`operationName`, `requestParams`) sin `when`, rechazado
por el validador con `"... must be an object with exactly one non-empty operationName key"` — el
bug reportado por el usuario al usar "Añadir precarga" en el panel real.

**Fix aplicado**: `denormalizePreloadsForSerialization` (nueva, en
`src/dev-runtime/layout-canvas/layout-canvas-commit.ts`), aplicada tanto en
`patchRawConfigTextWithPagePreloads` (precargas de página) como en `commitGlobalPreloadsMutation`
(`dev-runtime.tsx`, precargas globales) antes de escribir a texto crudo. Se corrigieron además los
tests de `T7` que afirmaban (incorrectamente) el comportamiento "sin normalizar" como correcto, y
se añadieron regresiones que hacen el round-trip real por `validateRuntimeConfig`.

**Por qué no se detectó en la implementación de T7**: `api-config-panel.test.tsx` prueba
`ApiConfigPanel` con `onCommitGlobalPreloadsMutation`/`onCommitPagePreloadsMutation` mockeados
(nunca invoca el validador real), a diferencia de `shell-config-panel.test.tsx`, que sí usa un
harness con `patchRootKey`/`validateRuntimeConfig` reales. Ninguna suite de esta feature ejercitó
el pipeline de commit de preloads de extremo a extremo contra el validador real hasta esta
corrección.
