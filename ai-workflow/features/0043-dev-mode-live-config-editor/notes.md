# Implementation notes — Feature 0043

## Deviation from spec: zod-to-json-schema not used for JSON Schema generation

`zod-to-json-schema@3.25.2` declares Zod v4 as a peer dependency (`^3.25.28 || ^4`) but does not support Zod v4 internals. Zod v4 removed `_def.typeName` (relied upon by zod-to-json-schema) and replaced it with `_def.type`. The library returns `{"$schema":"..."}` with no further content when given a Zod v4 schema.

**Adaptation**: `dev-runtime-json-schema.ts` uses Zod v4's built-in `toJSONSchema(schema)` (exported from `'zod'`). The package `zod-to-json-schema` remains installed (added in T1) but is not imported anywhere.

**Documentation impact**: `ai-workflow/docs/app-features/development/dev-mode-editor.md` should mention that JSON Schema derivation uses Zod v4's built-in `toJSONSchema`, not the external `zod-to-json-schema` package, and explain why.

## Note: T9 bundle gate uses programmatic Vite build with explicit `define` flags

When running Vite's `build()` API from within a Vitest test environment, `import.meta.env.DEV` was not automatically replaced with `false` even when `mode: 'production'` was set. The tree-shaking of the `if (import.meta.env.DEV)` branch in `main.tsx` requires explicit `define` options:
```ts
define: {
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
  'import.meta.env.MODE': JSON.stringify('production'),
}
```
The CLI `pnpm build` (which calls `vite build`) works correctly without these explicit defines. This is a test-environment artifact, not a production behavior issue.

## Documental tasks for update-app-documentation

- Create `ai-workflow/docs/app-features/development/dev-mode-editor.md` describing the live config editor feature.
- Update `ai-workflow/docs/app-features/development/index.md` to link the new doc.
- Update `ai-workflow/docs/app-features/development/local-config.md` (section "Límites de v1") to reflect that an editable live panel now exists under dev mode.
- Update `ai-workflow/docs/current-state.md` to reflect that the development local area now includes a live editor.
